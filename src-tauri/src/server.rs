// src-tauri/src/server.rs
// Stellar — 組み込み HTTP サーバー（ブラウザ拡張機能との通信用）
// 127.0.0.1:57321 で起動し、論文インポート API を提供する
// CORS ヘッダーで chrome-extension://* からのアクセスを許可する

use crate::db::get_pool;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// サーバーのバージョン
const SERVER_VERSION: &str = "0.1.0";

/// ブラウザ拡張機能からの論文インポート DTO
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePaperRequest {
    title: String,
    #[serde(default)]
    authors: Vec<String>,
    year: Option<i32>,
    journal: Option<String>,
    doi: Option<String>,
    url: Option<String>,
    r#abstract: Option<String>,
    pdf_url: Option<String>,
    #[serde(default)]
    include_pdf: bool,
}

/// API レスポンス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    paper_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// HTTP サーバーを起動する（Tauri setup 内から呼び出される）
pub async fn start_server(app: AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:57321").await {
        Ok(l) => l,
        Err(e) => {
            log::error!("HTTP サーバーの起動に失敗 (127.0.0.1:57321): {}", e);
            return;
        }
    };

    log::info!("Stellar HTTP サーバーを起動しました: 127.0.0.1:57321");

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let app_clone = app.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, app_clone).await {
                        log::error!("HTTP リクエスト処理に失敗: {}", e);
                    }
                });
            }
            Err(e) => {
                log::error!("TCP 接続の受け入れに失敗: {}", e);
            }
        }
    }
}

/// 個別の HTTP 接続を処理する
async fn handle_connection(
    mut stream: tokio::net::TcpStream,
    app: AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut buf = vec![0u8; 65536];
    let n = stream.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buf[..n]);

    // リクエストラインをパース
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        send_response(&mut stream, 400, &ApiResponse {
            ok: false,
            paper_id: None,
            version: None,
            error: Some("Bad Request".to_string()),
        }).await?;
        return Ok(());
    }

    let method = parts[0];
    let path = parts[1];

    match (method, path) {
        ("GET", "/api/status") => {
            send_response(&mut stream, 200, &ApiResponse {
                ok: true,
                paper_id: None,
                version: Some(SERVER_VERSION.to_string()),
                error: None,
            }).await?;
        }
        ("POST", "/api/papers") => {
            // リクエストボディを抽出
            let body = extract_body(&request);
            match serde_json::from_str::<CreatePaperRequest>(&body) {
                Ok(dto) => {
                    match handle_create_paper(app, dto).await {
                        Ok(paper_id) => {
                            send_response(&mut stream, 200, &ApiResponse {
                                ok: true,
                                paper_id: Some(paper_id),
                                version: None,
                                error: None,
                            }).await?;
                        }
                        Err(e) => {
                            send_response(&mut stream, 500, &ApiResponse {
                                ok: false,
                                paper_id: None,
                                version: None,
                                error: Some(e),
                            }).await?;
                        }
                    }
                }
                Err(e) => {
                    send_response(&mut stream, 400, &ApiResponse {
                        ok: false,
                        paper_id: None,
                        version: None,
                        error: Some(format!("リクエストのパースに失敗: {}", e)),
                    }).await?;
                }
            }
        }
        ("OPTIONS", _) => {
            // CORS プリフライト
            send_cors_preflight(&mut stream).await?;
        }
        _ => {
            send_response(&mut stream, 404, &ApiResponse {
                ok: false,
                paper_id: None,
                version: None,
                error: Some("Not Found".to_string()),
            }).await?;
        }
    }

    Ok(())
}

/// HTTP リクエストからボディ部分を抽出する
fn extract_body(request: &str) -> String {
    // ヘッダーとボディの境界（\r\n\r\n または \n\n）
    if let Some(idx) = request.find("\r\n\r\n") {
        request[idx + 4..].to_string()
    } else if let Some(idx) = request.find("\n\n") {
        request[idx + 2..].to_string()
    } else {
        String::new()
    }
}

/// 論文を作成する（DB に挿入、オプションで PDF をダウンロード）
async fn handle_create_paper(
    app: AppHandle,
    dto: CreatePaperRequest,
) -> Result<String, String> {
    let pool = get_pool(&app);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let authors_json = serde_json::to_string(&dto.authors).unwrap_or("[]".to_string());

    // PDF ダウンロード（オプション）
    let pdf_path = if dto.include_pdf {
        if let Some(ref pdf_url) = dto.pdf_url {
            match download_pdf(&app, pdf_url, &id).await {
                Ok(path) => Some(path),
                Err(e) => {
                    log::warn!("PDF のダウンロードに失敗: {}", e);
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };

    sqlx::query(
        "INSERT INTO papers (id, title, authors, year, journal, doi, url, abstract, pdf_path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)",
    )
    .bind(&id)
    .bind(&dto.title)
    .bind(&authors_json)
    .bind(dto.year)
    .bind(&dto.journal)
    .bind(&dto.doi)
    .bind(&dto.url)
    .bind(&dto.r#abstract)
    .bind(&pdf_path)
    .bind(&now)
    .bind(&now)
    .execute(pool.as_ref())
    .await
    .map_err(|e| format!("論文の作成に失敗: {}", e))?;

    Ok(id)
}

/// PDF をダウンロードしてアプリデータディレクトリに保存する
async fn download_pdf(
    app: &AppHandle,
    url: &str,
    paper_id: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Stellar/0.1.0")
        .send()
        .await
        .map_err(|e| format!("PDF ダウンロードリクエストに失敗: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("PDF ダウンロードに失敗: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("PDF データの読み込みに失敗: {}", e))?;

    let app_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("アプリデータディレクトリの取得に失敗: {}", e))?;
    let pdfs_dir = app_path.join("pdfs");
    std::fs::create_dir_all(&pdfs_dir)
        .map_err(|e| format!("PDF ディレクトリの作成に失敗: {}", e))?;

    let filename = format!("{}.pdf", paper_id);
    let dest_path = pdfs_dir.join(&filename);
    std::fs::write(&dest_path, &bytes)
        .map_err(|e| format!("PDF ファイルの書き込みに失敗: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

/// JSON レスポンスを送信する（CORS ヘッダー付き）
async fn send_response(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    body: &ApiResponse,
) -> Result<(), Box<dyn std::error::Error>> {
    let body_json = serde_json::to_string(body)?;
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "Unknown",
    };

    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        status, status_text, body_json.len(), body_json
    );

    stream.write_all(response.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}

/// CORS プリフライトレスポンスを送信する
async fn send_cors_preflight(
    stream: &mut tokio::net::TcpStream,
) -> Result<(), Box<dyn std::error::Error>> {
    let response = "HTTP/1.1 204 No Content\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Access-Control-Max-Age: 86400\r\n\
         Connection: close\r\n\
         \r\n";

    stream.write_all(response.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}

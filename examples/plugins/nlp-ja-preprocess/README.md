# NLP Preprocessing (Japanese)

Stellar の質的分析ビューに「テキスト前処理 (日本語)」タブを追加するアドオンです。

## Features

- コード付きセグメントを対象にした日本語テキスト分析
- 品詞フィルター: 名詞、動詞、形容詞
- 上位語の頻度チャートと CSV 書き出し
- `analyze_cooccurrence` による共起ペア集計
- 閾値付き SVG キーワードネットワーク
- 共起テーブルのソートと CSV 書き出し

## Install

Settings > Add-ons > Add from file から `nlp-ja-preprocess-v1.0.0.stellar-plugin` を選択してください。

## Notes

- 外部ネットワーク通信とランタイム npm 依存はありません。
- 共起分析は Stellar 本体の `analyze_cooccurrence` Tauri コマンドを使います。
- 頻度分析と品詞フィルターは、アドオン内の軽量な日本語ヒューリスティックで行います。
- 「全セグメント」は、プロジェクト内のコード付きセグメントを重複排除して集計します。

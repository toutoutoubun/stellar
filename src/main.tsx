// src/main.tsx
// Stellar — アプリケーションエントリーポイント
// React ルートの初期化とテーマの適用を行う

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// スタイル読み込み（テーマ → グローバルの順で読み込む）
import "./styles/themes.css";
import "./styles/global.css";

// デフォルトテーマの適用
document.documentElement.setAttribute("data-theme", "white");

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("ルート要素が見つかりません: #root");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

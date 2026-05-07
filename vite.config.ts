// vite.config.ts
// Stellar — Vite 設定
// Tauri 2.0 + React + Tailwind CSS v4

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Tauri 開発サーバーのホスト設定
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // kuromoji (18MB CJS辞書) は Vite の依存最適化から除外
  // dev server でも build でもバンドルに含めない
  optimizeDeps: {
    exclude: ["kuromoji"],
  },

  // Tauri はセキュリティ上の理由で固定ポートを推奨
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // 外部プロキシ（Tauri dev / サンドボックス等）経由のアクセスを許可
    allowedHosts: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // WSL2 環境でのファイル監視問題を回避
      ignored: ["**/src-tauri/**"],
    },
  },

  // 本番ビルドの最適化（低メモリ環境対応）
  build: {
    // modulePreload を無効化:
    // Tauri アプリではブラウザのネイティブ modulepreload が不要
    modulePreload: false,
    // Tauri はセキュリティコンテキストで ES2021+ をサポート
    target: "es2021",
    // 低メモリ環境では minify を無効化（OOM 防止）
    minify: false,
    // ソースマップ無効（メモリ節約）
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    // CSS コード分割を無効化（メモリ節約）
    cssCodeSplit: false,
    rollupOptions: {
      // 巨大依存をexternalにしてバンドルから除外 → OOM回避
      // ブラウザでは index.html の importmap で CDN にマッピング
      external: ["kuromoji", "pdfjs-dist", "docx", "marked"],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) return "vendor-react";
          if (id.includes("node_modules/@codemirror/") || id.includes("node_modules/@uiw/") || id.includes("node_modules/@lezer/") || id.includes("node_modules/style-mod") || id.includes("node_modules/crelt") || id.includes("node_modules/w3c-keyname")) return "vendor-codemirror";
          if (id.includes("node_modules/@tauri-apps/")) return "vendor-tauri";
          if (id.includes("node_modules/")) return "vendor-misc";
          return undefined;
        },
      },
      // Rollup キャッシュ無効化でメモリ削減
      cache: false,
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        if (warning.code === 'MISSING_GLOBAL_NAME') return;
        warn(warning);
      },
    },
  },
});

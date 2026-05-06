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

  // Tauri はセキュリティ上の理由で固定ポートを推奨
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
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
    // Vite はデフォルトで動的 import() を __vitePreload ヘルパーでラップする。
    // このヘルパーが vendor-codemirror チャンク（1.6MB）に配置されるため、
    // GraphView の lazy load 時に不要な巨大チャンクの評価が連鎖的にトリガーされ、
    // Safari WKWebView (Tauri) で "undefined is not an object (evaluating 'new Map')"
    // クラッシュが発生する。Tauri アプリではブラウザのネイティブ modulepreload が
    // 不要なため、この機能を完全に無効化する。
    modulePreload: false,
    // Tauri はセキュリティコンテキストで ES2021+ をサポート
    target: "es2021",
    // 低メモリ環境では minify を軽量に
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // ソースマップはデバッグ時のみ
    sourcemap: !!process.env.TAURI_DEBUG,
    chunkSizeWarningLimit: 2000,
    // CSS コード分割を無効化（メモリ節約）
    cssCodeSplit: false,
    // チャンク分割でビルド時メモリ使用量を削減
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 細かくチャンク分割してピークメモリを抑制
          // 循環参照を避けるため、相互依存パッケージは同一チャンクにまとめる
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) return "vendor-react";
          if (id.includes("node_modules/@codemirror/") || id.includes("node_modules/@uiw/") || id.includes("node_modules/@lezer/")) return "vendor-codemirror";
          if (id.includes("node_modules/pdfjs-dist") || id.includes("node_modules/react-pdf-highlighter")) return "vendor-pdf";
          // prop-types は vendor-misc 側の react-pdf-highlighter も使うため
          // vendor-graph に入れると循環依存が発生する → vendor-misc に落とす
          if (
            id.includes("node_modules/react-force-graph") ||
            id.includes("node_modules/force-graph") ||
            id.includes("node_modules/d3") ||
            id.includes("node_modules/kapsule") ||
            id.includes("node_modules/react-kapsule") ||
            id.includes("node_modules/accessor-fn") ||
            id.includes("node_modules/canvas-color-tracker") ||
            id.includes("node_modules/index-array-by") ||
            id.includes("node_modules/float-tooltip") ||
            id.includes("node_modules/lodash-es") ||
            id.includes("node_modules/bezier-js") ||
            id.includes("node_modules/@tweenjs/") ||
            id.includes("node_modules/d3-force-3d") ||
            id.includes("node_modules/internmap") ||
            id.includes("node_modules/robust-predicates") ||
            id.includes("node_modules/delaunator")
          ) return "vendor-graph";
          if (id.includes("node_modules/@tauri-apps/")) return "vendor-tauri";
          if (id.includes("node_modules/zustand")) return "vendor-zustand";
          if (id.includes("node_modules/@tanstack/")) return "vendor-tanstack";
          if (id.includes("node_modules/")) return "vendor-misc";
          return undefined;
        },
      },
      // Rollup のキャッシュ無効化（メモリ節約）
      cache: false,
      // 循環チャンク警告を抑制（graph 系サブ依存の相互参照は実行時無害）
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      },
    },
  },
});

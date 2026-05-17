// Zen Wabi-Sabi Grayscale Theme for Stellar
// Minimal visual theme: ink, washi paper, quiet lines, and generous negative space.

const THEME_ID = "zen-wabi-sabi-grayscale-theme.sumi-stillness";

export function register({ registerTheme }) {
  registerTheme({
    id: THEME_ID,
    label: "Sumi Stillness",
    description: "Pure grayscale Japanese minimalism: soft washi texture, ink lines, quiet spacing.",
    preview: {
      bg: "#f6f5f2",
      text: "#232323",
      accent: "#555555",
      sidebar: "#e6e4df",
    },
    cssVariables: {
      "--color-bg-primary": "#f6f5f2",
      "--color-bg-secondary": "#eceae5",
      "--color-bg-tertiary": "#dedbd3",
      "--color-bg-sidebar": "#e6e4df",
      "--color-bg-card": "rgba(250, 249, 246, 0.92)",
      "--color-bg-hover": "rgba(35, 35, 35, 0.06)",

      "--color-text-primary": "#232323",
      "--color-text-secondary": "#555555",
      "--color-text-tertiary": "#777777",
      "--color-text-inverse": "#f6f5f2",

      "--color-accent-primary": "#333333",
      "--color-accent-secondary": "#777777",
      "--color-accent-warning": "#6a6a6a",
      "--color-accent-danger": "#1f1f1f",
      "--color-accent-info": "#555555",

      "--color-border-primary": "rgba(35, 35, 35, 0.22)",
      "--color-border-secondary": "rgba(35, 35, 35, 0.12)",

      "--radius-sm": "2px",
      "--radius-md": "3px",
      "--radius-lg": "4px",
      "--radius-input": "2px",
      "--radius-button": "2px",
      "--radius-tag": "2px",

      "--shadow-sm": "0 1px 0 rgba(35,35,35,0.08)",
      "--shadow-md": "0 8px 24px rgba(35,35,35,0.08)",
      "--shadow-lg": "0 18px 42px rgba(35,35,35,0.1)",
      "--transition-fast": "120ms ease-out",
      "--transition-normal": "180ms ease-out",
    },
    extraCss: `
      [data-theme="${THEME_ID}"] {
        color-scheme: light;
        font-family:
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "Hiragino Sans",
          "Yu Gothic",
          Georgia,
          serif;
        background:
          radial-gradient(circle at 18% 22%, rgba(35,35,35,0.035) 0 1px, transparent 1.4px) 0 0 / 28px 28px,
          linear-gradient(90deg, rgba(35,35,35,0.025) 1px, transparent 1px) 0 0 / 72px 72px,
          linear-gradient(0deg, rgba(35,35,35,0.02) 1px, transparent 1px) 0 0 / 72px 72px,
          linear-gradient(180deg, #f6f5f2 0%, #eceae5 100%);
      }

      [data-theme="${THEME_ID}"] body {
        background:
          radial-gradient(ellipse at 82% 12%, rgba(35,35,35,0.045), transparent 28%),
          radial-gradient(ellipse at 12% 88%, rgba(35,35,35,0.035), transparent 32%),
          linear-gradient(180deg, rgba(255,255,255,0.52), transparent 44%);
      }

      [data-theme="${THEME_ID}"] body::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483639;
        pointer-events: none;
        background:
          repeating-linear-gradient(0deg, rgba(35,35,35,0.018) 0 1px, transparent 1px 6px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 8px);
        opacity: 0.8;
        mix-blend-mode: multiply;
      }

      [data-theme="${THEME_ID}"] body::after {
        content: "間";
        position: fixed;
        right: 28px;
        bottom: 24px;
        z-index: 2147483640;
        pointer-events: none;
        color: rgba(35, 35, 35, 0.08);
        font-family:
          "Hiragino Mincho ProN",
          "Yu Mincho",
          Georgia,
          serif;
        font-size: 72px;
        font-weight: 400;
        line-height: 1;
      }

      [data-theme="${THEME_ID}"] button,
      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] select,
      [data-theme="${THEME_ID}"] textarea {
        border: 1px solid rgba(35, 35, 35, 0.24) !important;
        background: rgba(250, 249, 246, 0.84) !important;
        box-shadow: none !important;
      }

      [data-theme="${THEME_ID}"] button {
        color: #232323 !important;
        font-family:
          "Hiragino Sans",
          "Yu Gothic",
          system-ui,
          sans-serif;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: none;
      }

      [data-theme="${THEME_ID}"] button:hover {
        background: #232323 !important;
        border-color: #232323 !important;
        color: #f6f5f2 !important;
        transform: translateY(-1px);
      }

      [data-theme="${THEME_ID}"] button:active {
        transform: translateY(0);
      }

      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] textarea,
      [data-theme="${THEME_ID}"] select {
        color: #232323 !important;
        font-family:
          "Hiragino Sans",
          "Yu Gothic",
          system-ui,
          sans-serif;
      }

      [data-theme="${THEME_ID}"] input:focus,
      [data-theme="${THEME_ID}"] textarea:focus,
      [data-theme="${THEME_ID}"] select:focus {
        outline: 1px solid #232323 !important;
        outline-offset: 2px;
      }

      [data-theme="${THEME_ID}"] aside,
      [data-theme="${THEME_ID}"] [class*="sidebar" i] {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.28), transparent),
          linear-gradient(90deg, rgba(35,35,35,0.025) 1px, transparent 1px) 0 0 / 32px 32px,
          #e6e4df !important;
        border-right: 1px solid rgba(35,35,35,0.16) !important;
        box-shadow: none !important;
      }

      [data-theme="${THEME_ID}"] [style*="var(--color-bg-card)"],
      [data-theme="${THEME_ID}"] [style*="var(--color-bg-secondary)"],
      [data-theme="${THEME_ID}"] [class*="card" i],
      [data-theme="${THEME_ID}"] dialog {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.08)),
          rgba(250, 249, 246, 0.88) !important;
        border: 1px solid rgba(35,35,35,0.14) !important;
        box-shadow: 0 10px 30px rgba(35,35,35,0.06) !important;
      }

      [data-theme="${THEME_ID}"] h1,
      [data-theme="${THEME_ID}"] h2,
      [data-theme="${THEME_ID}"] h3,
      [data-theme="${THEME_ID}"] h4 {
        color: #232323 !important;
        font-family:
          "Hiragino Mincho ProN",
          "Yu Mincho",
          Georgia,
          serif;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-shadow: none !important;
      }

      [data-theme="${THEME_ID}"] h1,
      [data-theme="${THEME_ID}"] h2 {
        border-bottom: 1px solid rgba(35,35,35,0.18);
        padding-bottom: 0.32em;
      }

      [data-theme="${THEME_ID}"] a {
        color: #232323 !important;
        text-decoration-thickness: 1px;
        text-underline-offset: 0.24em;
      }

      [data-theme="${THEME_ID}"] [role="tab"],
      [data-theme="${THEME_ID}"] [class*="tag" i],
      [data-theme="${THEME_ID}"] [class*="badge" i] {
        border: 1px solid rgba(35,35,35,0.18) !important;
        background: transparent !important;
        color: #555555 !important;
        font-weight: 400;
        letter-spacing: 0.06em;
      }

      [data-theme="${THEME_ID}"] table,
      [data-theme="${THEME_ID}"] [role="grid"] {
        border-color: rgba(35,35,35,0.14) !important;
      }

      [data-theme="${THEME_ID}"] ::selection {
        background: #232323;
        color: #f6f5f2;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-track {
        background: #eceae5;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-thumb {
        background: #777777;
        border: 2px solid #eceae5;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-thumb:hover {
        background: #232323;
      }
    `,
  });
}

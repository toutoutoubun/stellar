// Y2K Kawaii 2010s Theme for Stellar
// A visual-first theme add-on: pastel gloss, rounded UI, sticker sparkle.

const THEME_ID = "y2k-kawaii-2010s-theme.prism-heart";

export function register({ registerTheme }) {
  registerTheme({
    id: THEME_ID,
    label: "Prism Heart 2012",
    description: "Glossy Japanese Y2K kawaii: pastel chrome, candy gradients, rounded everything.",
    preview: {
      bg: "#fff0fb",
      text: "#5b3a75",
      accent: "#ff72c8",
      sidebar: "#d9c7ff",
    },
    cssVariables: {
      "--color-bg-primary": "#fff0fb",
      "--color-bg-secondary": "#f7ddff",
      "--color-bg-tertiary": "#dff5ff",
      "--color-bg-sidebar": "#eadfff",
      "--color-bg-card": "rgba(255, 255, 255, 0.82)",
      "--color-bg-hover": "rgba(255, 114, 200, 0.18)",

      "--color-text-primary": "#5b3a75",
      "--color-text-secondary": "#8a5ca6",
      "--color-text-tertiary": "#b77fd0",
      "--color-text-inverse": "#ffffff",

      "--color-accent-primary": "#ff72c8",
      "--color-accent-secondary": "#67d8ff",
      "--color-accent-warning": "#ffd166",
      "--color-accent-danger": "#ff4f93",
      "--color-accent-info": "#9c8cff",

      "--color-border-primary": "rgba(255, 114, 200, 0.55)",
      "--color-border-secondary": "rgba(156, 140, 255, 0.45)",

      "--radius-sm": "12px",
      "--radius-md": "18px",
      "--radius-lg": "26px",
      "--radius-input": "20px",
      "--radius-button": "999px",
      "--radius-tag": "999px",

      "--shadow-sm": "0 3px 10px rgba(255, 114, 200, 0.22), inset 0 1px 0 rgba(255,255,255,0.8)",
      "--shadow-md": "0 10px 24px rgba(156, 140, 255, 0.26), inset 0 1px 0 rgba(255,255,255,0.85)",
      "--shadow-lg": "0 18px 42px rgba(255, 114, 200, 0.32), inset 0 1px 0 rgba(255,255,255,0.9)",
      "--transition-fast": "120ms cubic-bezier(.2,.9,.2,1.2)",
      "--transition-normal": "220ms cubic-bezier(.2,.9,.2,1.1)",
    },
    extraCss: `
      [data-theme="${THEME_ID}"] {
        color-scheme: light;
        font-family:
          "Hiragino Maru Gothic ProN",
          "Hiragino Sans",
          "Yu Gothic UI",
          "Yu Gothic",
          "Arial Rounded MT Bold",
          system-ui,
          sans-serif;
        background:
          radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.95) 0 2px, transparent 3px) 0 0 / 38px 38px,
          radial-gradient(circle at 80% 16%, rgba(255, 209, 102, 0.42), transparent 25%),
          radial-gradient(circle at 18% 80%, rgba(103, 216, 255, 0.35), transparent 26%),
          linear-gradient(135deg, #fff0fb 0%, #f8ddff 36%, #dff5ff 72%, #fff6d7 100%);
      }

      [data-theme="${THEME_ID}"] body {
        background:
          linear-gradient(120deg, rgba(255,255,255,0.36), transparent 30%),
          radial-gradient(circle at 92% 8%, rgba(255,114,200,0.26), transparent 22%),
          radial-gradient(circle at 8% 88%, rgba(156,140,255,0.26), transparent 24%);
      }

      [data-theme="${THEME_ID}"] body::before {
        content: "♡ ✧ ☆ ♡ ✦";
        position: fixed;
        top: 54px;
        right: 18px;
        z-index: 2147483640;
        pointer-events: none;
        color: rgba(255, 114, 200, 0.5);
        font-size: 22px;
        letter-spacing: 10px;
        text-shadow:
          0 0 8px rgba(255,255,255,0.95),
          0 0 18px rgba(255,114,200,0.42);
      }

      [data-theme="${THEME_ID}"] body::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483639;
        pointer-events: none;
        background:
          linear-gradient(90deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 100%) 0 0 / 64px 64px,
          linear-gradient(0deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 100%) 0 0 / 64px 64px;
        mix-blend-mode: soft-light;
      }

      [data-theme="${THEME_ID}"] button,
      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] select,
      [data-theme="${THEME_ID}"] textarea {
        border-width: 2px !important;
        border-style: solid !important;
        backdrop-filter: blur(14px) saturate(1.35);
      }

      [data-theme="${THEME_ID}"] button {
        background-image:
          linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.18)),
          linear-gradient(135deg, rgba(255,114,200,0.24), rgba(103,216,255,0.2)) !important;
        box-shadow:
          0 8px 18px rgba(255, 114, 200, 0.28),
          inset 0 1px 0 rgba(255,255,255,0.95),
          inset 0 -4px 10px rgba(156,140,255,0.14);
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      [data-theme="${THEME_ID}"] button:hover {
        transform: translateY(-1px) scale(1.025);
        filter: saturate(1.16) brightness(1.03);
        box-shadow:
          0 12px 26px rgba(255, 114, 200, 0.38),
          0 0 0 4px rgba(255,255,255,0.45),
          inset 0 1px 0 rgba(255,255,255,1);
      }

      [data-theme="${THEME_ID}"] button:active {
        transform: translateY(1px) scale(0.99);
      }

      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] textarea,
      [data-theme="${THEME_ID}"] select {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.58)) !important;
        box-shadow:
          inset 0 2px 8px rgba(156,140,255,0.16),
          0 4px 14px rgba(103,216,255,0.18);
      }

      [data-theme="${THEME_ID}"] aside,
      [data-theme="${THEME_ID}"] [class*="sidebar" i] {
        background:
          radial-gradient(circle at 20% 12%, rgba(255,255,255,0.85), transparent 18%),
          repeating-linear-gradient(135deg, rgba(255,255,255,0.36) 0 10px, transparent 10px 20px),
          linear-gradient(180deg, #eadfff 0%, #ffd9f3 52%, #dff5ff 100%) !important;
        border-right: 2px solid rgba(255, 114, 200, 0.55) !important;
        box-shadow: 8px 0 26px rgba(255, 114, 200, 0.18);
      }

      [data-theme="${THEME_ID}"] [style*="var(--color-bg-card)"],
      [data-theme="${THEME_ID}"] [style*="var(--color-bg-secondary)"] {
        background-image:
          linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.16)) !important;
        backdrop-filter: blur(18px) saturate(1.3);
        box-shadow:
          0 12px 34px rgba(156, 140, 255, 0.18),
          0 0 0 1px rgba(255,255,255,0.46) inset;
      }

      [data-theme="${THEME_ID}"] h1,
      [data-theme="${THEME_ID}"] h2,
      [data-theme="${THEME_ID}"] h3,
      [data-theme="${THEME_ID}"] h4 {
        font-weight: 900;
        text-shadow:
          0 1px 0 #ffffff,
          0 0 12px rgba(255, 114, 200, 0.45);
      }

      [data-theme="${THEME_ID}"] a,
      [data-theme="${THEME_ID}"] [role="tab"],
      [data-theme="${THEME_ID}"] [class*="tag" i] {
        border-radius: 999px !important;
      }

      [data-theme="${THEME_ID}"] ::selection {
        background: #ff72c8;
        color: #ffffff;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar {
        width: 16px;
        height: 16px;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-track {
        background: linear-gradient(180deg, #fff0fb, #dff5ff);
        border: 2px solid rgba(255, 114, 200, 0.5);
        border-radius: 999px;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-thumb {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.7), transparent),
          linear-gradient(135deg, #ff72c8, #9c8cff 48%, #67d8ff);
        border: 2px solid #ffffff;
        border-radius: 999px;
        box-shadow: 0 0 10px rgba(255,114,200,0.45);
      }
    `,
  });
}

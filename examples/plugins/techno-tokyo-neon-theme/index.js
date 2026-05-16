// Techno Tokyo Neon Theme for Stellar
// Visual-first add-on: blue-black city glow, kanji neon signs, luminous controls, and cyber nodes.

const THEME_ID = "techno-tokyo-neon-theme.shinjuku-circuit";

export function register({ registerTheme }) {
  registerTheme({
    id: THEME_ID,
    label: "Shinjuku Circuit",
    description: "Neon Tokyo in blue-black: glowing kanji, signboard components, cyan-magenta nodes.",
    preview: {
      bg: "#050915",
      text: "#e6fbff",
      accent: "#00f0ff",
      sidebar: "#08111f",
    },
    cssVariables: {
      "--color-bg-primary": "#050915",
      "--color-bg-secondary": "#08111f",
      "--color-bg-tertiary": "#0d1930",
      "--color-bg-sidebar": "#06101f",
      "--color-bg-card": "rgba(8, 17, 31, 0.88)",
      "--color-bg-hover": "rgba(0, 240, 255, 0.16)",

      "--color-text-primary": "#e6fbff",
      "--color-text-secondary": "#9befff",
      "--color-text-tertiary": "#7d88a8",
      "--color-text-inverse": "#050915",

      "--color-accent-primary": "#00f0ff",
      "--color-accent-secondary": "#ff2bd6",
      "--color-accent-warning": "#fff14a",
      "--color-accent-danger": "#ff3c6f",
      "--color-accent-info": "#6f7bff",

      "--color-border-primary": "rgba(0, 240, 255, 0.55)",
      "--color-border-secondary": "rgba(255, 43, 214, 0.42)",

      "--radius-sm": "6px",
      "--radius-md": "8px",
      "--radius-lg": "10px",
      "--radius-input": "6px",
      "--radius-button": "6px",
      "--radius-tag": "4px",

      "--shadow-sm": "0 0 10px rgba(0,240,255,0.24), inset 0 0 12px rgba(0,240,255,0.08)",
      "--shadow-md": "0 0 18px rgba(0,240,255,0.28), 0 0 32px rgba(255,43,214,0.12), inset 0 0 18px rgba(0,240,255,0.1)",
      "--shadow-lg": "0 0 28px rgba(0,240,255,0.36), 0 0 58px rgba(255,43,214,0.2), inset 0 0 28px rgba(0,240,255,0.12)",
      "--transition-fast": "90ms cubic-bezier(.2,.9,.2,1)",
      "--transition-normal": "160ms cubic-bezier(.2,.9,.2,1)",
    },
    extraCss: `
      [data-theme="${THEME_ID}"] {
        color-scheme: dark;
        --tokyo-cyan: #00f0ff;
        --tokyo-pink: #ff2bd6;
        --tokyo-violet: #6f7bff;
        --tokyo-yellow: #fff14a;
        --tokyo-ink: #050915;
        --tokyo-panel: rgba(8, 17, 31, 0.9);
        font-family:
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic UI",
          "Yu Gothic",
          "Noto Sans JP",
          system-ui,
          sans-serif;
        background:
          linear-gradient(90deg, rgba(0,240,255,0.08) 1px, transparent 1px) 0 0 / 42px 42px,
          linear-gradient(0deg, rgba(255,43,214,0.06) 1px, transparent 1px) 0 0 / 42px 42px,
          radial-gradient(circle at 18% 18%, rgba(0,240,255,0.24), transparent 24%),
          radial-gradient(circle at 82% 10%, rgba(255,43,214,0.22), transparent 22%),
          radial-gradient(circle at 70% 86%, rgba(111,123,255,0.2), transparent 28%),
          linear-gradient(180deg, #050915 0%, #071021 52%, #02040b 100%);
      }

      [data-theme="${THEME_ID}"] body {
        background:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 7px),
          linear-gradient(180deg, rgba(0,240,255,0.04), transparent 34%),
          linear-gradient(120deg, transparent 0 62%, rgba(255,43,214,0.07) 62% 64%, transparent 64%);
      }

      [data-theme="${THEME_ID}"] body::before {
        content: "東京  電脳  解析  星図";
        position: fixed;
        top: 62px;
        right: 20px;
        z-index: 2147483640;
        pointer-events: none;
        writing-mode: vertical-rl;
        color: rgba(230, 251, 255, 0.82);
        background:
          linear-gradient(180deg, rgba(0,240,255,0.16), rgba(255,43,214,0.14)),
          rgba(5,9,21,0.72);
        border: 1px solid rgba(0,240,255,0.74);
        box-shadow:
          0 0 8px rgba(0,240,255,0.72),
          0 0 20px rgba(0,240,255,0.42),
          0 0 36px rgba(255,43,214,0.24),
          inset 0 0 18px rgba(0,240,255,0.18);
        padding: 12px 8px;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.18em;
        text-shadow:
          0 0 4px #ffffff,
          0 0 10px var(--tokyo-cyan),
          0 0 18px var(--tokyo-pink);
      }

      [data-theme="${THEME_ID}"] body::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483639;
        pointer-events: none;
        background:
          linear-gradient(90deg, transparent 0 49%, rgba(0,240,255,0.12) 49% 50%, transparent 50% 100%) 0 0 / 220px 100%,
          repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 4px);
        mix-blend-mode: screen;
        opacity: 0.72;
      }

      [data-theme="${THEME_ID}"] button,
      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] select,
      [data-theme="${THEME_ID}"] textarea {
        border: 1px solid rgba(0,240,255,0.58) !important;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015)),
          rgba(8,17,31,0.86) !important;
        color: #e6fbff !important;
        box-shadow:
          0 0 12px rgba(0,240,255,0.2),
          inset 0 0 18px rgba(0,240,255,0.08) !important;
        backdrop-filter: blur(12px) saturate(1.35);
      }

      [data-theme="${THEME_ID}"] button {
        position: relative;
        overflow: hidden;
        font-weight: 850;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        text-shadow:
          0 0 5px rgba(230,251,255,0.92),
          0 0 12px rgba(0,240,255,0.72);
      }

      [data-theme="${THEME_ID}"] button::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(90deg, transparent 0 10%, rgba(0,240,255,0.22) 10% 12%, transparent 12% 82%, rgba(255,43,214,0.2) 82% 84%, transparent 84%),
          linear-gradient(180deg, rgba(255,255,255,0.14), transparent 38%);
        opacity: 0.78;
      }

      [data-theme="${THEME_ID}"] button:hover {
        transform: translateY(-1px);
        border-color: #ff2bd6 !important;
        color: #ffffff !important;
        background:
          linear-gradient(135deg, rgba(0,240,255,0.2), rgba(255,43,214,0.18)),
          rgba(8,17,31,0.94) !important;
        box-shadow:
          0 0 10px rgba(230,251,255,0.56),
          0 0 24px rgba(0,240,255,0.58),
          0 0 44px rgba(255,43,214,0.34),
          inset 0 0 22px rgba(255,43,214,0.14) !important;
      }

      [data-theme="${THEME_ID}"] button:active {
        transform: translateY(1px) scale(0.99);
      }

      [data-theme="${THEME_ID}"] input:focus,
      [data-theme="${THEME_ID}"] textarea:focus,
      [data-theme="${THEME_ID}"] select:focus {
        outline: 1px solid #ff2bd6 !important;
        outline-offset: 2px;
        box-shadow:
          0 0 12px rgba(255,43,214,0.42),
          0 0 28px rgba(0,240,255,0.2),
          inset 0 0 18px rgba(0,240,255,0.1) !important;
      }

      [data-theme="${THEME_ID}"] aside,
      [data-theme="${THEME_ID}"] [class*="sidebar" i] {
        background:
          linear-gradient(90deg, rgba(0,240,255,0.12), transparent 28%),
          linear-gradient(180deg, rgba(255,43,214,0.12), transparent 34%),
          linear-gradient(90deg, rgba(0,240,255,0.09) 1px, transparent 1px) 0 0 / 24px 24px,
          #06101f !important;
        border-right: 1px solid rgba(0,240,255,0.54) !important;
        box-shadow:
          8px 0 28px rgba(0,240,255,0.14),
          inset -1px 0 0 rgba(255,43,214,0.42) !important;
      }

      [data-theme="${THEME_ID}"] aside::before,
      [data-theme="${THEME_ID}"] [class*="sidebar" i]::before {
        content: "新宿";
        display: block;
        width: fit-content;
        margin: 10px 10px 14px;
        padding: 5px 8px;
        color: #050915;
        background: #00f0ff;
        border: 1px solid #e6fbff;
        box-shadow:
          0 0 10px rgba(0,240,255,0.84),
          0 0 24px rgba(0,240,255,0.42);
        font-weight: 900;
        letter-spacing: 0.12em;
      }

      [data-theme="${THEME_ID}"] [style*="var(--color-bg-card)"],
      [data-theme="${THEME_ID}"] [style*="var(--color-bg-secondary)"],
      [data-theme="${THEME_ID}"] [class*="card" i],
      [data-theme="${THEME_ID}"] dialog {
        background:
          linear-gradient(135deg, rgba(0,240,255,0.08), transparent 34%),
          linear-gradient(315deg, rgba(255,43,214,0.08), transparent 28%),
          rgba(8, 17, 31, 0.9) !important;
        border: 1px solid rgba(0,240,255,0.46) !important;
        box-shadow:
          0 0 18px rgba(0,240,255,0.2),
          0 0 40px rgba(255,43,214,0.1),
          inset 0 0 26px rgba(0,240,255,0.06) !important;
      }

      [data-theme="${THEME_ID}"] h1,
      [data-theme="${THEME_ID}"] h2,
      [data-theme="${THEME_ID}"] h3,
      [data-theme="${THEME_ID}"] h4 {
        color: #e6fbff !important;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-shadow:
          0 0 5px rgba(230,251,255,0.9),
          0 0 16px rgba(0,240,255,0.8),
          0 0 28px rgba(255,43,214,0.34) !important;
      }

      [data-theme="${THEME_ID}"] h1::before,
      [data-theme="${THEME_ID}"] h2::before,
      [data-theme="${THEME_ID}"] h3::before {
        content: "ネオン ";
        color: #00f0ff;
        text-shadow:
          0 0 8px #00f0ff,
          0 0 18px rgba(0,240,255,0.8);
      }

      [data-theme="${THEME_ID}"] a {
        color: #00f0ff !important;
        text-decoration-color: rgba(255,43,214,0.8);
        text-decoration-thickness: 1px;
        text-underline-offset: 0.24em;
        text-shadow: 0 0 10px rgba(0,240,255,0.55);
      }

      [data-theme="${THEME_ID}"] [role="tab"],
      [data-theme="${THEME_ID}"] [class*="tag" i],
      [data-theme="${THEME_ID}"] [class*="badge" i],
      [data-theme="${THEME_ID}"] [class*="node" i] {
        border: 1px solid rgba(0,240,255,0.62) !important;
        background:
          linear-gradient(135deg, rgba(0,240,255,0.14), rgba(255,43,214,0.08)),
          rgba(5,9,21,0.72) !important;
        color: #e6fbff !important;
        box-shadow:
          0 0 8px rgba(0,240,255,0.38),
          inset 0 0 14px rgba(0,240,255,0.08) !important;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-shadow: 0 0 8px rgba(230,251,255,0.6);
      }

      [data-theme="${THEME_ID}"] [class*="node" i]::before,
      [data-theme="${THEME_ID}"] [class*="tag" i]::before {
        content: "◇";
        color: #ff2bd6;
        margin-right: 0.35em;
        text-shadow: 0 0 8px rgba(255,43,214,0.8);
      }

      [data-theme="${THEME_ID}"] table,
      [data-theme="${THEME_ID}"] [role="grid"] {
        border: 1px solid rgba(0,240,255,0.38) !important;
        box-shadow:
          0 0 16px rgba(0,240,255,0.16),
          inset 0 0 20px rgba(0,240,255,0.05);
      }

      [data-theme="${THEME_ID}"] ::selection {
        background: #00f0ff;
        color: #050915;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar {
        width: 14px;
        height: 14px;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-track {
        background: #050915;
        border: 1px solid rgba(0,240,255,0.28);
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-thumb {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.18), transparent),
          linear-gradient(135deg, #00f0ff, #6f7bff 52%, #ff2bd6);
        border: 2px solid #050915;
        box-shadow:
          0 0 10px rgba(0,240,255,0.62),
          0 0 18px rgba(255,43,214,0.28);
      }
    `,
  });
}

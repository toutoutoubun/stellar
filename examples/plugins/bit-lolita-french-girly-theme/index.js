// 16-bit Lolita French Girly Theme for Stellar
// Visual-first add-on: patisserie pastels, pixel lace, ribbon UI, and sweet serif accents.

const THEME_ID = "bit-lolita-french-girly-theme.sugar-chateau";

export function register({ registerTheme }) {
  registerTheme({
    id: THEME_ID,
    label: "Sugar Chateau 16",
    description: "16-bit lolita meets sweet French girly: lace pixels, rose cream, ribbons, and patisserie gloss.",
    preview: {
      bg: "#fff2f6",
      text: "#604052",
      accent: "#e86b9d",
      sidebar: "#f8d5e6",
    },
    cssVariables: {
      "--color-bg-primary": "#fff2f6",
      "--color-bg-secondary": "#ffe4ee",
      "--color-bg-tertiary": "#fff8dc",
      "--color-bg-sidebar": "#f8d5e6",
      "--color-bg-card": "rgba(255, 251, 246, 0.94)",
      "--color-bg-hover": "rgba(232, 107, 157, 0.16)",

      "--color-text-primary": "#604052",
      "--color-text-secondary": "#8f5c73",
      "--color-text-tertiary": "#bd7f96",
      "--color-text-inverse": "#fffaf6",

      "--color-accent-primary": "#e86b9d",
      "--color-accent-secondary": "#b88ad8",
      "--color-accent-warning": "#e8b64f",
      "--color-accent-danger": "#c94f7c",
      "--color-accent-info": "#79a9d8",

      "--color-border-primary": "#d88aa8",
      "--color-border-secondary": "#b88ad8",

      "--radius-sm": "0px",
      "--radius-md": "0px",
      "--radius-lg": "0px",
      "--radius-input": "0px",
      "--radius-button": "0px",
      "--radius-tag": "0px",

      "--shadow-sm": "3px 3px 0 #f0b4c9, 6px 6px 0 rgba(96, 64, 82, 0.16)",
      "--shadow-md": "4px 4px 0 #f0b4c9, 8px 8px 0 rgba(96, 64, 82, 0.18)",
      "--shadow-lg": "6px 6px 0 #f0b4c9, 12px 12px 0 rgba(96, 64, 82, 0.2)",
      "--transition-fast": "80ms steps(2, end)",
      "--transition-normal": "140ms steps(3, end)",
    },
    extraCss: `
      [data-theme="${THEME_ID}"] {
        color-scheme: light;
        font-family:
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "Hiragino Maru Gothic ProN",
          "Yu Gothic",
          Georgia,
          serif;
        image-rendering: pixelated;
        background:
          linear-gradient(45deg, rgba(255,255,255,0.64) 25%, transparent 25% 75%, rgba(255,255,255,0.64) 75%) 0 0 / 18px 18px,
          linear-gradient(45deg, rgba(255,255,255,0.64) 25%, transparent 25% 75%, rgba(255,255,255,0.64) 75%) 9px 9px / 18px 18px,
          repeating-linear-gradient(90deg, rgba(232,107,157,0.08) 0 4px, transparent 4px 12px),
          linear-gradient(180deg, #fff2f6 0%, #ffe4ee 42%, #fff8dc 100%);
      }

      [data-theme="${THEME_ID}"] body {
        background:
          radial-gradient(circle at 14% 18%, rgba(255,255,255,0.95) 0 2px, transparent 3px) 0 0 / 24px 24px,
          radial-gradient(circle at 82% 14%, rgba(232,107,157,0.24), transparent 24%),
          radial-gradient(circle at 18% 86%, rgba(184,138,216,0.2), transparent 24%),
          linear-gradient(180deg, rgba(255,255,255,0.54), transparent 34%);
      }

      [data-theme="${THEME_ID}"] body::before {
        content: "◇ ＊ ｡ ribbon mode ｡ ＊ ◇";
        position: fixed;
        top: 56px;
        left: 50%;
        z-index: 2147483640;
        pointer-events: none;
        transform: translateX(-50%);
        padding: 6px 14px 7px;
        color: #8f5c73;
        background:
          linear-gradient(90deg, transparent 0 8px, rgba(255,250,246,0.92) 8px calc(100% - 8px), transparent calc(100% - 8px)),
          linear-gradient(180deg, #fffaf6, #ffe4ee);
        border: 2px solid #d88aa8;
        box-shadow:
          3px 3px 0 #f0b4c9,
          0 0 0 4px rgba(255,255,255,0.52);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-shadow: 1px 1px 0 #ffffff;
      }

      [data-theme="${THEME_ID}"] body::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483639;
        pointer-events: none;
        background:
          linear-gradient(90deg, rgba(96,64,82,0.05) 0 2px, transparent 2px 100%) 0 0 / 16px 16px,
          linear-gradient(0deg, rgba(96,64,82,0.04) 0 2px, transparent 2px 100%) 0 0 / 16px 16px,
          repeating-linear-gradient(180deg, transparent 0 6px, rgba(255,255,255,0.2) 6px 8px);
        mix-blend-mode: multiply;
      }

      [data-theme="${THEME_ID}"] *,
      [data-theme="${THEME_ID}"] *::before,
      [data-theme="${THEME_ID}"] *::after {
        border-radius: 0 !important;
      }

      [data-theme="${THEME_ID}"] button,
      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] select,
      [data-theme="${THEME_ID}"] textarea {
        border: 2px solid #d88aa8 !important;
        background-color: #fffaf6 !important;
        box-shadow:
          3px 3px 0 #f0b4c9,
          inset 2px 2px 0 rgba(255,255,255,0.92),
          inset -2px -2px 0 rgba(232,107,157,0.12) !important;
      }

      [data-theme="${THEME_ID}"] button {
        color: #604052 !important;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-shadow: 1px 1px 0 #ffffff;
        background:
          linear-gradient(90deg, transparent 0 7px, rgba(255,250,246,0.98) 7px calc(100% - 7px), transparent calc(100% - 7px)),
          repeating-linear-gradient(90deg, #ffe4ee 0 6px, #fffaf6 6px 12px) !important;
      }

      [data-theme="${THEME_ID}"] button::first-letter {
        color: #e86b9d;
      }

      [data-theme="${THEME_ID}"] button:hover {
        transform: translate(-2px, -2px);
        background:
          linear-gradient(90deg, transparent 0 7px, rgba(255,250,246,1) 7px calc(100% - 7px), transparent calc(100% - 7px)),
          repeating-linear-gradient(90deg, #ffd4e4 0 6px, #fff8dc 6px 12px) !important;
        box-shadow:
          5px 5px 0 #f0b4c9,
          8px 8px 0 rgba(96,64,82,0.18),
          inset 2px 2px 0 rgba(255,255,255,1) !important;
      }

      [data-theme="${THEME_ID}"] button:active {
        transform: translate(2px, 2px);
        box-shadow:
          1px 1px 0 #f0b4c9,
          inset -2px -2px 0 rgba(232,107,157,0.18) !important;
      }

      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] textarea,
      [data-theme="${THEME_ID}"] select {
        color: #604052 !important;
        font-family:
          "Hiragino Maru Gothic ProN",
          "Yu Gothic",
          system-ui,
          sans-serif;
      }

      [data-theme="${THEME_ID}"] aside,
      [data-theme="${THEME_ID}"] [class*="sidebar" i] {
        background:
          linear-gradient(90deg, rgba(255,255,255,0.8), transparent 22%),
          radial-gradient(circle at 22% 10%, rgba(255,255,255,0.86) 0 3px, transparent 4px) 0 0 / 22px 22px,
          repeating-linear-gradient(180deg, #f8d5e6 0 18px, #ffeef4 18px 36px) !important;
        border-right: 4px double #d88aa8 !important;
        box-shadow: 6px 0 0 #f0b4c9, 14px 0 0 rgba(96,64,82,0.08);
      }

      [data-theme="${THEME_ID}"] [style*="var(--color-bg-card)"],
      [data-theme="${THEME_ID}"] [style*="var(--color-bg-secondary)"],
      [data-theme="${THEME_ID}"] [class*="card" i],
      [data-theme="${THEME_ID}"] dialog {
        border: 2px solid #d88aa8 !important;
        outline: 2px solid rgba(255,255,255,0.8);
        outline-offset: -6px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0.16)),
          repeating-linear-gradient(90deg, rgba(255,228,238,0.74) 0 8px, rgba(255,250,246,0.88) 8px 16px) !important;
        box-shadow:
          4px 4px 0 #f0b4c9,
          8px 8px 0 rgba(96,64,82,0.16) !important;
      }

      [data-theme="${THEME_ID}"] h1,
      [data-theme="${THEME_ID}"] h2,
      [data-theme="${THEME_ID}"] h3,
      [data-theme="${THEME_ID}"] h4 {
        color: #604052 !important;
        font-family:
          "Hiragino Mincho ProN",
          "Yu Mincho",
          Georgia,
          serif;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-shadow:
          2px 0 0 #fffaf6,
          0 2px 0 #fffaf6,
          2px 2px 0 #f0b4c9,
          4px 4px 0 rgba(232,107,157,0.18);
      }

      [data-theme="${THEME_ID}"] h1::before,
      [data-theme="${THEME_ID}"] h2::before {
        content: "◆ ";
        color: #e86b9d;
      }

      [data-theme="${THEME_ID}"] h1::after,
      [data-theme="${THEME_ID}"] h2::after {
        content: " ◆";
        color: #b88ad8;
      }

      [data-theme="${THEME_ID}"] a,
      [data-theme="${THEME_ID}"] [role="tab"],
      [data-theme="${THEME_ID}"] [class*="tag" i],
      [data-theme="${THEME_ID}"] [class*="badge" i] {
        font-family:
          "Hiragino Maru Gothic ProN",
          "Yu Gothic",
          system-ui,
          sans-serif;
        font-weight: 800;
        text-shadow: 1px 1px 0 #ffffff;
      }

      [data-theme="${THEME_ID}"] [role="tab"],
      [data-theme="${THEME_ID}"] [class*="tag" i],
      [data-theme="${THEME_ID}"] [class*="badge" i] {
        border: 2px solid #d88aa8 !important;
        box-shadow: 2px 2px 0 #f0b4c9;
        background:
          repeating-linear-gradient(90deg, #fffaf6 0 8px, #ffe4ee 8px 16px) !important;
      }

      [data-theme="${THEME_ID}"] table,
      [data-theme="${THEME_ID}"] [role="grid"] {
        border: 2px solid #d88aa8 !important;
        box-shadow: 4px 4px 0 #f0b4c9;
      }

      [data-theme="${THEME_ID}"] ::selection {
        background: #e86b9d;
        color: #fffaf6;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar {
        width: 16px;
        height: 16px;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-track {
        background:
          repeating-linear-gradient(45deg, #fffaf6 0 6px, #ffe4ee 6px 12px);
        border: 2px solid #d88aa8;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-thumb {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.62), transparent),
          repeating-linear-gradient(90deg, #e86b9d 0 6px, #b88ad8 6px 12px);
        border: 2px solid #fffaf6;
        box-shadow: inset -2px -2px 0 rgba(96,64,82,0.18);
      }
    `,
  });
}

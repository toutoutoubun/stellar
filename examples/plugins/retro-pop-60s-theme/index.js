// Retro Pop 60s Theme for Stellar
// Install from Settings > Add-ons/Plugins > Add from folder,
// or package this folder as .zip / .stellar-plugin.

const THEME_ID = "retro-pop-60s-theme.atomic-diner";

export function register({ registerTheme }) {
  registerTheme({
    id: THEME_ID,
    label: "Atomic Diner 1966",
    description: "Candy red, jukebox teal, lemon yellow, and noisy poster-paper swagger.",
    preview: {
      bg: "#fff3c4",
      text: "#27213c",
      accent: "#ef3e36",
      sidebar: "#16a6a3",
    },
    cssVariables: {
      "--color-bg-primary": "#fff3c4",
      "--color-bg-secondary": "#ffe28a",
      "--color-bg-tertiary": "#ffd35a",
      "--color-bg-sidebar": "#16a6a3",
      "--color-bg-card": "#fffaf0",
      "--color-bg-hover": "rgba(239, 62, 54, 0.18)",

      "--color-text-primary": "#27213c",
      "--color-text-secondary": "#4f3f5f",
      "--color-text-tertiary": "#8b3f5f",
      "--color-text-inverse": "#fffaf0",

      "--color-accent-primary": "#ef3e36",
      "--color-accent-secondary": "#16a6a3",
      "--color-accent-warning": "#f8b500",
      "--color-accent-danger": "#d7263d",
      "--color-accent-info": "#2f7df6",

      "--color-border-primary": "#27213c",
      "--color-border-secondary": "#ef3e36",

      "--radius-sm": "2px",
      "--radius-md": "3px",
      "--radius-lg": "4px",
      "--radius-input": "3px",
      "--radius-button": "999px",
      "--radius-tag": "999px",

      "--shadow-sm": "3px 3px 0 #27213c",
      "--shadow-md": "5px 5px 0 #27213c",
      "--shadow-lg": "8px 8px 0 #27213c",
      "--transition-fast": "90ms cubic-bezier(.2,.8,.2,1)",
      "--transition-normal": "150ms cubic-bezier(.2,.8,.2,1)",
    },
    extraCss: `
      [data-theme="${THEME_ID}"] {
        color-scheme: light;
        --retro-dot-color: rgba(239, 62, 54, 0.18);
        --retro-stripe-color: rgba(22, 166, 163, 0.18);
        background:
          radial-gradient(circle at 1px 1px, var(--retro-dot-color) 1.2px, transparent 1.4px) 0 0 / 12px 12px,
          linear-gradient(135deg, transparent 0 44%, var(--retro-stripe-color) 44% 50%, transparent 50% 100%);
      }

      [data-theme="${THEME_ID}"] body {
        background:
          radial-gradient(circle at 20% 10%, rgba(248, 181, 0, 0.22), transparent 28%),
          radial-gradient(circle at 85% 18%, rgba(47, 125, 246, 0.18), transparent 24%),
          linear-gradient(180deg, #fff3c4 0%, #ffe28a 100%);
      }

      [data-theme="${THEME_ID}"] button,
      [data-theme="${THEME_ID}"] input,
      [data-theme="${THEME_ID}"] select,
      [data-theme="${THEME_ID}"] textarea {
        border-width: 2px !important;
      }

      [data-theme="${THEME_ID}"] button {
        text-transform: uppercase;
        letter-spacing: 0.04em;
        box-shadow: 3px 3px 0 #27213c;
      }

      [data-theme="${THEME_ID}"] button:hover {
        transform: translate(-1px, -1px) rotate(-0.4deg);
        box-shadow: 5px 5px 0 #27213c;
      }

      [data-theme="${THEME_ID}"] button:active {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0 #27213c;
      }

      [data-theme="${THEME_ID}"] aside,
      [data-theme="${THEME_ID}"] [class*="sidebar" i] {
        background:
          linear-gradient(90deg, rgba(255,255,255,0.2), transparent),
          repeating-linear-gradient(-12deg, #16a6a3 0 14px, #0f8f8d 14px 28px) !important;
      }

      [data-theme="${THEME_ID}"] [style*="var(--color-bg-card)"],
      [data-theme="${THEME_ID}"] [style*="var(--color-bg-secondary)"] {
        box-shadow: 4px 4px 0 #27213c;
      }

      [data-theme="${THEME_ID}"] h1,
      [data-theme="${THEME_ID}"] h2,
      [data-theme="${THEME_ID}"] h3 {
        text-shadow: 2px 2px 0 #f8b500;
      }

      [data-theme="${THEME_ID}"] ::selection {
        background: #ef3e36;
        color: #fffaf0;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar {
        width: 14px;
        height: 14px;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-track {
        background: #ffe28a;
        border: 2px solid #27213c;
      }

      [data-theme="${THEME_ID}"] ::-webkit-scrollbar-thumb {
        background: repeating-linear-gradient(45deg, #ef3e36 0 8px, #f8b500 8px 16px);
        border: 2px solid #27213c;
      }
    `,
  });
}

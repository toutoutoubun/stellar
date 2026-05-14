// sample-addon-plugin.js
// Stellar Add-on Plugin Example — v0.2 API
//
// This sample demonstrates all 4 addon types introduced in Plugin API v0.2:
//   1. Workspace View  — adds a "Dashboard" page to the sidebar
//   2. Panel / Tab      — adds a custom tab to the qualitative analysis view
//   3. Theme CSS        — registers a "Solarized Light" theme
//   4. Citation Style   — registers a "Vancouver" citation style
//
// Usage:
//   Place this file (with a stellar-plugin.json) in the plugins directory,
//   or package it as a .stellar-plugin / .zip archive.
//
// stellar-plugin.json example:
// {
//   "id": "com.example.sample-addon",
//   "name": "Sample Add-on Plugin",
//   "version": "1.0.0",
//   "description": "Demonstrates all v0.2 addon types",
//   "entry": "sample-addon-plugin.js",
//   "capabilities": ["workspace-view", "panel", "theme", "citation-style"],
//   "minStellarVersion": "0.4.0"
// }

export function register(api) {
  const React = api.React;
  const h = React.createElement;

  // ================================================================
  // 1. Workspace View — Dashboard
  // ================================================================
  api.registerWorkspaceView({
    id: "sample.dashboard",
    label: "Dashboard",
    icon: h(
      "svg",
      {
        width: 20, height: 20, viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth: 1.8,
        strokeLinecap: "round", strokeLinejoin: "round",
      },
      h("rect", { x: 3, y: 3, width: 7, height: 7 }),
      h("rect", { x: 14, y: 3, width: 7, height: 7 }),
      h("rect", { x: 14, y: 14, width: 7, height: 7 }),
      h("rect", { x: 3, y: 14, width: 7, height: 7 }),
    ),
    section: "addons",
    order: 10,
    render: () =>
      h(
        "div",
        {
          style: {
            padding: "32px",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-family-sans)",
          },
        },
        h("h1", { style: { fontSize: "24px", fontWeight: 700, marginBottom: "16px" } }, "Dashboard"),
        h("p", { style: { color: "var(--color-text-secondary)", marginBottom: "24px" } },
          "This is a sample workspace view registered by a plugin. " +
          "You can build any full-page UI here — statistics, charts, task boards, etc."
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            },
          },
          ...[
            { title: "Papers", value: "—", color: "#4285f4" },
            { title: "Notes", value: "—", color: "#34a853" },
            { title: "Tags", value: "—", color: "#fbbc04" },
          ].map((card) =>
            h(
              "div",
              {
                key: card.title,
                style: {
                  padding: "20px",
                  borderRadius: "12px",
                  backgroundColor: "var(--color-bg-card)",
                  border: "1px solid var(--color-border-secondary)",
                },
              },
              h("div", { style: { fontSize: "12px", color: "var(--color-text-tertiary)", marginBottom: "8px" } }, card.title),
              h("div", { style: { fontSize: "28px", fontWeight: 700, color: card.color } }, card.value),
            )
          ),
        ),
      ),
  });

  // ================================================================
  // 2. Panel / Tab — "AI Summary" tab in qualitative view
  // ================================================================
  api.registerPanel({
    id: "sample.ai-summary",
    label: "AI Summary",
    description: "A sample panel addon for qualitative analysis",
    targetView: "qualitative",
    order: 100,
    render: (context) =>
      h(
        "div",
        { style: { padding: "16px", color: "var(--color-text-primary)" } },
        h("h3", { style: { fontWeight: 600, marginBottom: "8px" } }, "AI Summary Panel"),
        h("p", { style: { fontSize: "13px", color: "var(--color-text-secondary)" } },
          "This panel was registered by a plugin. " +
          "It could display AI-generated summaries, topic models, or other analysis results."
        ),
      ),
  });

  // ================================================================
  // 3. Theme CSS — Solarized Light
  // ================================================================
  api.registerTheme({
    id: "sample.solarized-light",
    label: "Solarized Light",
    description: "Ethan Schoonover's Solarized palette (light variant)",
    preview: {
      bg: "#fdf6e3",
      text: "#657b83",
      accent: "#268bd2",
      sidebar: "#eee8d5",
    },
    cssVariables: {
      "--color-bg-primary": "#fdf6e3",
      "--color-bg-secondary": "#eee8d5",
      "--color-bg-tertiary": "#e0dbc8",
      "--color-bg-sidebar": "#eee8d5",
      "--color-bg-card": "#fdf6e3",
      "--color-bg-hover": "rgba(38, 139, 210, 0.08)",
      "--color-text-primary": "#586e75",
      "--color-text-secondary": "#657b83",
      "--color-text-tertiary": "#93a1a1",
      "--color-accent-primary": "#268bd2",
      "--color-accent-secondary": "#2aa198",
      "--color-border-primary": "#d3cbb7",
      "--color-border-secondary": "#e0dbc8",
    },
  });

  // ================================================================
  // 4. Citation Style — Vancouver
  // ================================================================
  api.registerCitationStyle({
    id: "sample.vancouver",
    label: "Vancouver",
    description: "ICMJE Vancouver reference style (numbered, used in biomedical journals)",
    formatInline: (paper, options) => {
      if (options?.citationNumber != null) {
        return `[${options.citationNumber}]`;
      }
      // Fallback: first author + year
      const first = paper.authors[0] || "Unknown";
      const surname = first.includes(",") ? first.split(",")[0].trim() : first.split(" ").pop();
      return `(${surname}, ${paper.year ?? "n.d."})`;
    },
    formatBibliography: (paper) => {
      // Authors
      const authors = paper.authors.map((a) => {
        if (a.includes(",")) {
          const [last, first] = a.split(",").map((s) => s.trim());
          const initials = (first || "")
            .split(/\s+/)
            .map((w) => w[0]?.toUpperCase() || "")
            .join("");
          return `${last} ${initials}`;
        }
        const parts = a.trim().split(/\s+/);
        const last = parts.pop() || "";
        const initials = parts.map((w) => w[0]?.toUpperCase() || "").join("");
        return `${last} ${initials}`;
      });

      let authorStr = "";
      if (authors.length <= 6) {
        authorStr = authors.join(", ");
      } else {
        authorStr = authors.slice(0, 6).join(", ") + ", et al";
      }

      const title = paper.title || "Untitled";
      const journal = paper.journal || "";
      const year = paper.year ?? "n.d.";
      const volume = paper.volume || "";
      const issue = paper.issue ? `(${paper.issue})` : "";
      const pages = paper.pages || "";
      const doi = paper.doi ? ` doi:${paper.doi}` : "";

      let result = `${authorStr}. ${title}. ${journal}. ${year}`;
      if (volume) result += `;${volume}${issue}`;
      if (pages) result += `:${pages}`;
      result += `.${doi}`;

      return result;
    },
  });

  console.log("[SampleAddonPlugin] All 4 addon types registered successfully.");
}

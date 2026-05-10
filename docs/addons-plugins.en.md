# Stellar Add-on and Plugin Guide

Stellar analysis features can be extended with local plugins inside this repository. The entry point is `src/plugins/registerAnalysisAddons.ts`. Import your add-on from that file and it will register when the app starts.

## Terms

- Add-on: a small extension that adds an analysis tab or method to an existing Stellar screen.
- Plugin: a folder that bundles one or more add-ons, helper components, calculation code, and documentation.

## Qualitative Analysis Add-ons

Qualitative add-ons add tabs to the qualitative analysis workspace.

```tsx
// src/plugins/myQualitativeAddon.tsx
import { registerQualitativeAnalysisAddon } from "./analysisAddons";

registerQualitativeAnalysisAddon({
  id: "memo-review",
  label: "Memo Review",
  description: "Review project analysis memos.",
  order: 200,
  render: ({ project }) => (
    <div style={{ padding: 24 }}>
      <h2>{project?.name ?? "Project"}</h2>
      <p>Build your custom qualitative analysis UI here.</p>
    </div>
  ),
});
```

Register it:

```ts
// src/plugins/registerAnalysisAddons.ts
import "./myQualitativeAddon";
```

## Quantitative Analysis Add-ons

Quantitative add-ons add new methods to the analysis wizard.

```tsx
// src/plugins/missingnessAddon.tsx
import { registerQuantitativeAnalysisAddon } from "./analysisAddons";

registerQuantitativeAnalysisAddon({
  id: "missingness-audit",
  label: "Missingness Audit",
  description: "Count missing values and missing rates for selected variables.",
  color: "var(--color-accent-warning)",
  minVariables: 1,
  run: ({ selectedVariables, dataRows }) => {
    const rows = dataRows.length || 1;
    return {
      variables: selectedVariables.map((variable) => {
        const missing = dataRows.filter((row) => {
          const value = row.values[variable.name] ?? row.values[variable.id];
          return value == null || value === "";
        }).length;
        return { name: variable.name, missing, rate: missing / rows };
      }),
    };
  },
  renderResult: ({ analysis }) => (
    <pre style={{ padding: 24 }}>
      {JSON.stringify(analysis.result, null, 2)}
    </pre>
  ),
});
```

Register it:

```ts
// src/plugins/registerAnalysisAddons.ts
import "./missingnessAddon";
```

## Suggested Layout

```text
src/plugins/
  registerAnalysisAddons.ts
  myPlugin/
    qualitative.tsx
    quantitative.tsx
    shared.ts
```

Use stable alphanumeric or hyphenated names for `id`. Re-registering the same `id` replaces the previous add-on, so development hot reloads do not create duplicates.

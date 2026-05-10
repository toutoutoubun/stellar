# Stellar Byvoeging- en Inpropgids

Stellar se analise-funksies kan uitgebrei word met plaaslike inproppe in hierdie bewaarplek. Die ingangspunt is `src/plugins/registerAnalysisAddons.ts`. Voer jou byvoeging uit daardie lêer in, en dit registreer wanneer die program begin.

## Terme

- Byvoeging: 'n klein uitbreiding wat 'n analise-oortjie of metode by 'n bestaande Stellar-skerm voeg.
- Inprop: 'n vouer wat een of meer byvoegings, hulpkomponente, berekeningskode en dokumentasie saamgroepeer.

## Kwalitatiewe analise-byvoegings

'n Kwalitatiewe byvoeging voeg 'n oortjie by die kwalitatiewe analise-werkruimte.

```tsx
// src/plugins/myQualitativeAddon.tsx
import { registerQualitativeAnalysisAddon } from "./analysisAddons";

registerQualitativeAnalysisAddon({
  id: "memo-review",
  label: "Memo-oorsig",
  description: "Hersien projek-analise-memo's.",
  order: 200,
  render: ({ project }) => (
    <div style={{ padding: 24 }}>
      <h2>{project?.name ?? "Projek"}</h2>
      <p>Bou jou eie kwalitatiewe analise-koppelvlak hier.</p>
    </div>
  ),
});
```

Registreer dit:

```ts
// src/plugins/registerAnalysisAddons.ts
import "./myQualitativeAddon";
```

## Kwantitatiewe analise-byvoegings

'n Kwantitatiewe byvoeging voeg 'n metode by die analise-wizard.

```tsx
// src/plugins/missingnessAddon.tsx
import { registerQuantitativeAnalysisAddon } from "./analysisAddons";

registerQuantitativeAnalysisAddon({
  id: "missingness-audit",
  label: "Ontbrekende-waardes-oudit",
  description: "Tel ontbrekende waardes en koerse vir gekose veranderlikes.",
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

Registreer dit:

```ts
// src/plugins/registerAnalysisAddons.ts
import "./missingnessAddon";
```

## Aanbevole uitleg

```text
src/plugins/
  registerAnalysisAddons.ts
  myPlugin/
    qualitative.tsx
    quantitative.tsx
    shared.ts
```

Gebruik stabiele letters, syfers of koppeltekens vir `id`. As dieselfde `id` weer geregistreer word, vervang dit die vorige byvoeging, sodat warm herlaai nie duplikate skep nie.

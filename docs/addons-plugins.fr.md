# Guide des extensions et plugins Stellar

Les fonctions d'analyse de Stellar peuvent etre etendues avec des plugins locaux dans ce depot. Le point d'entree est `src/plugins/registerAnalysisAddons.ts`. Importez votre extension depuis ce fichier pour qu'elle soit enregistree au demarrage de l'application.

## Termes

- Extension: petite extension qui ajoute un onglet d'analyse ou une methode a un ecran Stellar existant.
- Plugin: dossier qui regroupe une ou plusieurs extensions, des composants, du code de calcul et de la documentation.

## Extensions d'analyse qualitative

Une extension qualitative ajoute un onglet a l'espace d'analyse qualitative.

```tsx
// src/plugins/myQualitativeAddon.tsx
import { registerQualitativeAnalysisAddon } from "./analysisAddons";

registerQualitativeAnalysisAddon({
  id: "memo-review",
  label: "Revue des memos",
  description: "Examiner les memos d'analyse du projet.",
  order: 200,
  render: ({ project }) => (
    <div style={{ padding: 24 }}>
      <h2>{project?.name ?? "Projet"}</h2>
      <p>Ajoutez ici votre interface d'analyse qualitative.</p>
    </div>
  ),
});
```

Enregistrez-la:

```ts
// src/plugins/registerAnalysisAddons.ts
import "./myQualitativeAddon";
```

## Extensions d'analyse quantitative

Une extension quantitative ajoute une methode au wizard d'analyse.

```tsx
// src/plugins/missingnessAddon.tsx
import { registerQuantitativeAnalysisAddon } from "./analysisAddons";

registerQuantitativeAnalysisAddon({
  id: "missingness-audit",
  label: "Audit des valeurs manquantes",
  description: "Compter les valeurs manquantes et leurs taux pour les variables choisies.",
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

Enregistrez-la:

```ts
// src/plugins/registerAnalysisAddons.ts
import "./missingnessAddon";
```

## Structure conseillee

```text
src/plugins/
  registerAnalysisAddons.ts
  myPlugin/
    qualitative.tsx
    quantitative.tsx
    shared.ts
```

Utilisez un `id` stable, compose de lettres, chiffres ou traits d'union. Reenregistrer le meme `id` remplace l'extension precedente, ce qui evite les doublons pendant le rechargement a chaud.

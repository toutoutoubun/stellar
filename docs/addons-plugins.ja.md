# Stellar アドオン・プラグイン作成ガイド

Stellar の分析機能は、リポジトリ内のローカルプラグインとして追加できます。入口は `src/plugins/registerAnalysisAddons.ts` です。このファイルから自作アドオンを `import` すると、アプリ起動時に登録されます。

## 用語

- アドオン: Stellar の既存画面に分析タブや分析手法を追加する小さな拡張です。
- プラグイン: 1つ以上のアドオン、補助コンポーネント、計算ロジック、ドキュメントをまとめたフォルダです。

## 質的分析アドオン

質的分析には新しいタブを追加できます。

```tsx
// src/plugins/myQualitativeAddon.tsx
import { registerQualitativeAnalysisAddon } from "./analysisAddons";

registerQualitativeAnalysisAddon({
  id: "memo-review",
  label: "メモレビュー",
  description: "プロジェクト内の分析メモを確認します。",
  order: 200,
  render: ({ project }) => (
    <div style={{ padding: 24 }}>
      <h2>{project?.name ?? "プロジェクト"}</h2>
      <p>ここに独自の質的分析UIを実装します。</p>
    </div>
  ),
});
```

登録します。

```ts
// src/plugins/registerAnalysisAddons.ts
import "./myQualitativeAddon";
```

## 量的分析アドオン

量的分析には、分析ウィザードで選べる新しい手法を追加できます。

```tsx
// src/plugins/missingnessAddon.tsx
import { registerQuantitativeAnalysisAddon } from "./analysisAddons";

registerQuantitativeAnalysisAddon({
  id: "missingness-audit",
  label: "欠損監査",
  description: "選択した変数の欠損数と欠損率を集計します。",
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

登録します。

```ts
// src/plugins/registerAnalysisAddons.ts
import "./missingnessAddon";
```

## 推奨構成

```text
src/plugins/
  registerAnalysisAddons.ts
  myPlugin/
    qualitative.tsx
    quantitative.tsx
    shared.ts
```

`id` は安定した英数字・ハイフンの名前にしてください。同じ `id` を再登録すると差し替えられるため、開発中のホットリロードでも重複しません。

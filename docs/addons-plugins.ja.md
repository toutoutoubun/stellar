# Stellar アドオン・プラグイン作成ガイド

Stellar の分析機能は、リポジトリ内のローカルプラグインとして追加できます。入口は `src/plugins/registerAnalysisAddons.ts` です。このファイルから自作アドオンを `import` すると、アプリ起動時に登録されます。

Stellar デスクトップアプリでは、設定 > アドオン/プラグイン からダウンロード済みのプラグインパッケージも追加できます。配布パッケージは、`stellar-plugin.json` と `index.js` を含むフォルダ、またはそのフォルダを ZIP 化した `.zip` / `.stellar-plugin` ファイルにしてください。

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

## カスタムテーマアドオン

プラグインから `registerTheme` を呼ぶと、設定 > 外観 のテーマ一覧にカスタムテーマを追加できます。テーマは CSS 変数として注入され、選択状態は通常のテーマと同じく保存されます。

`stellar-plugin.json` の `capabilities` には `"theme"` を含めてください。

```json
{
  "id": "my-theme-pack",
  "name": "My Theme Pack",
  "version": "1.0.0",
  "entry": "index.js",
  "capabilities": ["theme"]
}
```

`index.js` の例:

```js
export function register({ registerTheme }) {
  registerTheme({
    id: "my-theme-pack.paper",
    label: "Paper",
    description: "落ち着いた紙面風の研究テーマ",
    preview: {
      bg: "#fbf7ef",
      text: "#2d2720",
      accent: "#7c5c2f",
      sidebar: "#efe5d4",
    },
    cssVariables: {
      "--color-bg-primary": "#fbf7ef",
      "--color-bg-secondary": "#f4ecde",
      "--color-bg-tertiary": "#eadfce",
      "--color-bg-sidebar": "#efe5d4",
      "--color-bg-card": "#fffaf2",
      "--color-bg-hover": "rgba(124, 92, 47, 0.1)",
      "--color-text-primary": "#2d2720",
      "--color-text-secondary": "#5f5348",
      "--color-text-tertiary": "#8a7a68",
      "--color-text-inverse": "#ffffff",
      "--color-accent-primary": "#7c5c2f",
      "--color-accent-secondary": "#3f7f6f",
      "--color-accent-warning": "#b7791f",
      "--color-accent-danger": "#b91c1c",
      "--color-border-primary": "#d8c9b5",
      "--color-border-secondary": "#e7dccc",
    },
  });
}
```

テーマプラグインを有効化すると、その場でテーマ一覧に追加されます。無効化または削除すると、そのプラグインが登録したテーマ CSS は現在のセッションから外されます。

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

## ダウンロード配布用パッケージ

設定画面から追加するプラグインは、実行可能な JavaScript と manifest を同梱します。

```text
myPlugin/
  stellar-plugin.json
  index.js
```

`stellar-plugin.json` の例:

```json
{
  "id": "missingness-audit",
  "name": "欠損監査",
  "version": "1.0.0",
  "description": "量的データの欠損状況を確認します。",
  "author": "Your Name",
  "entry": "index.js",
  "capabilities": ["quantitative"]
}
```

`index.js` は `register(api)` を export します。JSX/TypeScript を使う場合は、配布前に JavaScript へビルドしてください。

```js
export function register({ React, registerQuantitativeAnalysisAddon }) {
  registerQuantitativeAnalysisAddon({
    id: "missingness-audit",
    label: "欠損監査",
    description: "選択した変数の欠損数と欠損率を集計します。",
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
    renderResult: ({ analysis }) =>
      React.createElement("pre", { style: { padding: 24 } }, JSON.stringify(analysis.result, null, 2)),
  });
}
```

追加手順:

1. `myPlugin` フォルダを `.zip` または `.stellar-plugin` に圧縮します。
2. Stellar の 設定 > アドオン/プラグイン を開きます。
3. 「ファイルから追加」または「フォルダから追加」を選択します。
4. 追加後、必要に応じてアプリを再起動します。

<p align="center">
  <img src="assets/stellar-logo.svg" alt="Stellar" width="120" />
</p>

<h1 align="center">Stellar</h1>

<p align="center">
  <strong>文系研究者のための、静かな研究環境。</strong><br>
  ライブラリ · エディタ · 引用ネットワーク · 質的分析 · エクスポート<br>
  ひとつのデスクトップアプリに。ローカル優先。AIなし。サブスクなし。
</p>

<p align="center">
  <a href="https://github.com/toutoutoubun/stellar/releases">
    <img src="https://img.shields.io/github/v/release/toutoutoubun/stellar?style=flat-square&color=2D516E" alt="リリース" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/ライセンス-MIT-D4A535?style=flat-square" alt="MIT ライセンス" />
  </a>
  <img src="https://img.shields.io/badge/対応OS-macOS%20%7C%20Windows%20%7C%20Linux-7AA5B8?style=flat-square" alt="対応OS" />
  <img src="https://img.shields.io/badge/対応言語-JP%20%7C%20EN%20%7C%20FR%20%7C%20AF-6B7F4A?style=flat-square" alt="対応言語" />
  <img src="https://img.shields.io/badge/AI-なし（設計上の判断）-C9532E?style=flat-square" alt="AIなし" />
</p>

<p align="center">
  <a href="https://shiosailearn.com/projects_stellar.html">ウェブサイト</a> ·
  <a href="#ダウンロード">ダウンロード</a> ·
  <a href="#機能">機能</a> ·
  <a href="#思想">思想</a> ·
  <a href="https://github.com/toutoutoubun/stellar/issues">Issues</a>
</p>

---

## なぜ Stellar なのか

多くの研究者は、6〜8個の別々のツールを行き来しています。参考文献用、ノート用、執筆用、分析用、それぞれバラバラ。どのツールもひとつのことは得意ですが、互いに連携しません。

**Stellar は、すべてをひとつにまとめます。** 論文、ノート、引用、分析、エクスポート——あなたのマシンで動く、ひとつのデスクトップアプリに。

クラウドへの依存なし。AIがあなたの代わりに判断することもなし。予算を圧迫するサブスクもなし。

あなたの思考は、あなたのもの。

---

## 機能

### 📚 ライブラリ

論文、書籍、資料を管理。タグ付け、分類、検索。

<details>
<summary>スクリーンショット</summary>
<!-- TODO: スクリーンショットを追加 -->
</details>

### ✍️ エディタ

Markdown + WikiLink 対応のエディタ。書きながらアイデアをつなげる。高速、集中、キーボード駆動。

<details>
<summary>スクリーンショット</summary>
<!-- TODO: スクリーンショットを追加 -->
</details>

### 🔗 引用ネットワーク

資料同士のつながりを可視化。引用関係をインタラクティブなグラフで表示。表計算では見えないパターンを発見。

<details>
<summary>スクリーンショット</summary>
<!-- TODO: スクリーンショットを追加 -->
</details>

### 🔬 質的分析

テキストデータのコーディング。テーマの構築。年間数万円の商用ソフトに頼らず、質的分析を実行。

<details>
<summary>スクリーンショット</summary>
<!-- TODO: スクリーンショットを追加 -->
</details>

### 📤 エクスポート

PDF、Word、HTML で出力。あなたの成果を、どこにでも持ち出せる。

<details>
<summary>スクリーンショット</summary>
<!-- TODO: スクリーンショットを追加 -->
</details>

---

## 思想

Stellar は [Shiosailearn](https://shiosailearn.com) が制作しています——*自律した個人のための、静かな道具群。*

私たちは3つの「しない」に従います：

| | しないこと | 理由 |
|---|----------|------|
| 01 | **伴走しない** | 「一緒に歩きます」はパフォーマンスへの圧力になる。道具を渡して、私たちは引く。 |
| 02 | **支援しない** | 「あなたのために」は、あなたを助けが必要な人と定義する。その定義を使わない。 |
| 03 | **連携しない** | 他のツールとの連携はあなたの時間を奪う。あなたのデータ、あなたのワークフロー。 |

### AIについて

Stellar にはAI機能がありません。これは制約ではなく、設計上の判断です。

研究にはあなた自身の判断が必要です。資料を要約したり、論旨を提案するAIは、あなたの代わりに思考しています。読むこと、コーディングすること、つなげること、書くこと——その摩擦こそが研究だと私たちは考えています。

### データについて

ローカル環境を優先しながら、きちんとクラウドでバックアップ。あなたのデータは SQLite であなたのマシンに存在します。信頼するクラウドサービスにバックアップできます。私たちはあなたのデータを見ることがない。求めることもないから。

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 |
| デスクトップランタイム | Tauri 2.0 |
| バックエンドロジック | Rust |
| データベース | SQLite |
| コード量 | 約65,800行 |

Tauri + Rust で構築。起動は2秒以内、メモリ使用量は200MB以下。

---

## ダウンロード

<table>
<tr>
<td align="center">
<img src="assets/macos-icon.svg" width="48" /><br>
<strong>macOS</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">.dmg をダウンロード</a>
</td>
<td align="center">
<img src="assets/windows-icon.svg" width="48" /><br>
<strong>Windows</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">.msi をダウンロード</a>
</td>
<td align="center">
<img src="assets/linux-icon.svg" width="48" /><br>
<strong>Linux</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">.AppImage をダウンロード</a>
</td>
</tr>
</table>

**動作環境：** macOS 11以降、Windows 10以降、Linux（Ubuntu 20.04以降、Fedora 36以降、Arch）

---

## 対応言語

Stellar は4つの言語に対応しています：

| 言語 | 状態 |
|------|------|
| 🇯🇵 日本語 | ✅ 完全対応 |
| 🇬🇧 English | ✅ 完全対応 |
| 🇫🇷 Français | ✅ 完全対応 |
| 🇿🇦 Afrikaans | ✅ 完全対応 |

新しい言語を追加したい場合は [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

---

## 誰のためのツールか

Stellar は**文系研究者**のために作られました——政治学者、歴史学者、言語学者、社会学者——思考プロセスを尊重する、ひとつの静かなツールを求める人のために。

こんな人に向いています：

- ✅ 複数のツールを行き来する研究ワークフローにうんざりしている
- ✅ データを他人のサーバーではなく、自分のマシンに置きたい
- ✅ AIに自分の分析を書かせたくない
- ✅ 高額な商用質的分析ソフトを購入できない
- ✅ 自分の言語で使えるツールがほしい

こんな人には**向いていません**：

- ❌ リアルタイム共同編集が必要（Stellar は単一ユーザー向け）
- ❌ 高度な組版処理が必要（専用の組版ツールをお使いください）
- ❌ AIに論文を要約させたい

---

## ロードマップ

- [x] v1.0 — コアモジュール（ライブラリ、エディタ、引用ネットワーク、質的分析、エクスポート）
- [x] 4言語対応（JP、EN、FR、AF）
- [ ] 参考文献インポートウィザード
- [ ] モバイルコンパニオンアプリ（読み取り専用）
- [ ] コミュニティ拡張のためのプラグインシステム
- [ ] さらなる言語対応（貢献歓迎）

---

## コントリビュート

Stellar は MIT ライセンスで公開されており、コントリビュートを受け付けています。詳細は [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

```bash
# クローンして実行
git clone https://github.com/toutoutoubun/stellar.git
cd stellar
npm install
npm run tauri dev
```

**前提条件：** Node.js 22以降、Rust 1.75以降、プラットフォーム固有の Tauri 依存関係（[Tauri ドキュメント参照](https://v2.tauri.app/start/prerequisites/)）

---

## 開発者について

Stellar は **tami_tou** が制作しました——日本で南アフリカ政治を研究する17歳の研究者です。自分の代わりに考えようとしない、持っていないお金を要求しない、自分が使う言語で動く研究環境が必要でした。

まず自分のために作ったツールです。あなたにも役に立つなら、それがすべてです。

→ [shiosailearn.com](https://shiosailearn.com) · [GitHub](https://github.com/toutoutoubun) · [shiosaisazanami@gmail.com](mailto:shiosaisazanami@gmail.com)

---

<p align="center">
  <sub>
    <strong>Stellar</strong> — <a href="https://shiosailearn.com">Shiosailearn</a> のプロジェクト。<br>
    自律した個人のための、静かな道具群。<br>
    MIT ライセンス · 2026
  </sub>
</p>

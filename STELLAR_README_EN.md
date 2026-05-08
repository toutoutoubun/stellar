<p align="center">
  <img src="assets/stellar-logo.svg" alt="Stellar" width="120" />
</p>

<h1 align="center">Stellar</h1>

<p align="center">
  <strong>A quiet research environment for humanities scholars.</strong><br>
  Library · Editor · Citation Network · Qualitative Analysis · Export<br>
  All in one desktop app. Local-first. No AI. No subscription.
</p>

<p align="center">
  <a href="https://github.com/toutoutoubun/stellar/releases">
    <img src="https://img.shields.io/github/v/release/toutoutoubun/stellar?style=flat-square&color=2D516E" alt="Release" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-D4A535?style=flat-square" alt="MIT License" />
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-7AA5B8?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/languages-JP%20%7C%20EN%20%7C%20FR%20%7C%20AF-6B7F4A?style=flat-square" alt="Languages" />
  <img src="https://img.shields.io/badge/AI-none%20(by%20design)-C9532E?style=flat-square" alt="No AI" />
</p>

<p align="center">
  <a href="https://shiosailearn.com/en/projects_stellar.html">Website</a> ·
  <a href="#download">Download</a> ·
  <a href="#features">Features</a> ·
  <a href="#philosophy">Philosophy</a> ·
  <a href="https://github.com/toutoutoubun/stellar/issues">Issues</a>
</p>

---

## Why Stellar?

Most researchers juggle 6–8 tools: Zotero for references, Obsidian for notes, Scrivener for writing, NVivo for analysis, Connected Papers for networks, and more. Each tool is good at one thing. None of them talk to each other.

**Stellar puts everything in one place.** Papers, notes, citations, analysis, and export — in a single desktop app that runs on your machine.

No cloud dependency. No AI making decisions for you. No subscription draining your budget.

Your thoughts are your own.

---

## Features

### 📚 Library

Manage papers, books, and sources. Tag, categorize, search. Import from BibTeX.

<details>
<summary>Screenshot</summary>
<!-- TODO: Add screenshot -->
</details>

### ✍️ Editor

Write in Markdown with WikiLink support. Connect ideas as you go. Fast, distraction-free, keyboard-driven.

<details>
<summary>Screenshot</summary>
<!-- TODO: Add screenshot -->
</details>

### 🔗 Citation Network

Visualize how your sources connect. See citation relationships as an interactive graph. Find patterns in your research that spreadsheets can't show.

<details>
<summary>Screenshot</summary>
<!-- TODO: Add screenshot -->
</details>

### 🔬 Qualitative Analysis

Code text data. Build themes. Run qualitative analysis without paying $1,000/year for NVivo or Atlas.ti.

<details>
<summary>Screenshot</summary>
<!-- TODO: Add screenshot -->
</details>

### 📤 Export

Output as PDF, Word, or HTML. Take your work anywhere.

<details>
<summary>Screenshot</summary>
<!-- TODO: Add screenshot -->
</details>

---

## Philosophy

Stellar is built by [Shiosailearn](https://shiosailearn.com) — *quiet tools for autonomous individuals.*

We follow three refusals:

| | Refusal | Why |
|---|---------|-----|
| 01 | **We don't accompany** | "I'll walk with you" creates pressure to perform. We hand you the tool and step back. |
| 02 | **We don't support** | "For your benefit" defines you as someone who needs help. We don't use that definition. |
| 03 | **We don't integrate** | Integration with other tools steals your time. Your data, your workflow. |

### On AI

Stellar has no AI features. This is not a limitation — it's a design decision.

Your research requires your judgment. An AI that summarizes your sources or suggests your arguments is doing your thinking for you. We believe the friction of reading, coding, connecting, and writing *is* the research.

### On Data

Local-first with cloud backup. Your data lives on your machine in SQLite. Back up to any cloud service you trust. We never see your data, because we never ask for it.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 |
| Desktop Runtime | Tauri 2.0 |
| Backend Logic | Rust |
| Database | SQLite |
| Codebase | ~65,800 lines |

Why Tauri + Rust instead of Electron? Because a research tool should start in under 2 seconds and use less than 200MB of RAM. Electron couldn't promise that.

---

## Download

<table>
<tr>
<td align="center">
<img src="assets/macos-icon.svg" width="48" /><br>
<strong>macOS</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">Download .dmg</a>
</td>
<td align="center">
<img src="assets/windows-icon.svg" width="48" /><br>
<strong>Windows</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">Download .msi</a>
</td>
<td align="center">
<img src="assets/linux-icon.svg" width="48" /><br>
<strong>Linux</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">Download .AppImage</a>
</td>
</tr>
</table>

**Requirements:** macOS 11+, Windows 10+, or Linux (Ubuntu 20.04+, Fedora 36+, Arch)

---

## Languages

Stellar speaks four languages:

| Language | Status |
|----------|--------|
| 🇯🇵 日本語 | ✅ Full |
| 🇬🇧 English | ✅ Full |
| 🇫🇷 Français | ✅ Full |
| 🇿🇦 Afrikaans | ✅ Full |

Want to add a language? See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Who Is This For?

Stellar is built for **humanities researchers** — political scientists, historians, linguists, sociologists — who want a single, quiet tool that respects their thinking process.

You might like Stellar if:

- ✅ You're tired of juggling Zotero + Obsidian + Scrivener + NVivo
- ✅ You want your data on your machine, not someone else's server
- ✅ You don't want AI writing your analysis
- ✅ You can't afford $1,000/year for qualitative analysis software
- ✅ You want a tool that works in your language

You might **not** like Stellar if:

- ❌ You need real-time collaboration (Stellar is single-user)
- ❌ You need advanced LaTeX typesetting (use Overleaf for that)
- ❌ You want AI to summarize papers for you

---

## Roadmap

- [x] v1.0 — Core modules (Library, Editor, Citation Network, QA, Export)
- [x] 4-language support (JP, EN, FR, AF)
- [ ] Zotero / BibTeX import wizard
- [ ] Mobile companion app (read-only)
- [ ] Plugin system for community extensions
- [ ] More languages (contributions welcome)

---

## Contributing

Stellar is MIT-licensed and open to contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone and run
git clone https://github.com/toutoutoubun/stellar.git
cd stellar
npm install
npm run tauri dev
```

**Prerequisites:** Node.js 22+, Rust 1.75+, platform-specific Tauri dependencies ([see Tauri docs](https://v2.tauri.app/start/prerequisites/))

---

## About the Developer

Stellar was built by **tami_tou** — a 17-year-old researcher studying South African politics in Japan. I built Stellar because I needed a research environment that didn't try to think for me, didn't cost money I didn't have, and worked in the languages I work in.

This is a tool I built for myself first. If it helps you too, that's the whole point.

→ [shiosailearn.com](https://shiosailearn.com) · [GitHub](https://github.com/toutoutoubun) · [hello@shiosailearn.com](mailto:hello@shiosailearn.com)

---

<p align="center">
  <sub>
    <strong>Stellar</strong> — A <a href="https://shiosailearn.com">Shiosailearn</a> project.<br>
    Quiet tools for autonomous individuals.<br>
    MIT License · 2026
  </sub>
</p>

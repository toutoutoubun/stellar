# Contributing to Stellar

Thank you for considering contributing to Stellar. This document explains how to participate.

> **Translations:** [Français](#contribuer-à-stellar) · [Afrikaans](#bydra-tot-stellar)

---

## Table of Contents

- [Philosophy](#philosophy)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Adding a Language](#adding-a-language)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)
- [Code of Conduct](#code-of-conduct)

---

## Philosophy

Before contributing, please understand what Stellar is — and what it isn't.

**Stellar is:**
- A local-first research environment for humanities scholars
- An opinionated tool with intentional constraints
- MIT-licensed and free forever

**Stellar intentionally does not:**
- Include AI features (summarization, suggestion, generation)
- Require cloud accounts or telemetry
- Integrate with external tools via APIs or plugins (yet)

If your contribution adds AI capabilities, cloud dependencies, or subscription mechanics, it will not be accepted. This isn't personal — it's the project's philosophy.

---

## Ways to Contribute

| Contribution | Difficulty | Impact |
|-------------|-----------|--------|
| Report a bug | Easy | High |
| Fix a typo or improve docs | Easy | Medium |
| Add or improve a translation | Easy–Medium | High |
| Fix a bug | Medium | High |
| Improve UI/accessibility | Medium | High |
| Add a feature from the roadmap | Hard | High |

**First-time contributors:** Look for issues labeled `good first issue` or `help wanted`.

---

## Development Setup

### Prerequisites

- **Node.js** 22+
- **Rust** 1.75+ (via [rustup](https://rustup.rs/))
- **Tauri CLI** (`cargo install tauri-cli`)
- Platform-specific dependencies: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/toutoutoubun/stellar.git
cd stellar

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Verify Your Setup

```bash
# Run tests
npm test                  # Frontend tests
cargo test               # Rust tests

# Lint
npm run lint             # ESLint + Prettier
cargo clippy             # Rust linter
```

---

## Project Structure

```
stellar/
├── src/                    # React 19 frontend
│   ├── components/         # UI components
│   ├── modules/            # Feature modules
│   │   ├── library/        # 📚 Library module
│   │   ├── editor/         # ✍️ Editor module
│   │   ├── citation/       # 🔗 Citation Network
│   │   ├── analysis/       # 🔬 Qualitative Analysis
│   │   └── export/         # 📤 Export module
│   ├── i18n/               # Translations
│   │   ├── ja.json         # 日本語
│   │   ├── en.json         # English
│   │   ├── fr.json         # Français
│   │   └── af.json         # Afrikaans
│   └── styles/             # CSS
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── db/             # SQLite operations
│   │   ├── commands/       # Tauri IPC commands
│   │   └── analysis/       # Analysis engine
│   └── Cargo.toml
├── LICENSE                 # MIT
└── README.md
```

---

## Code Style

### Frontend (TypeScript / React)

- **Formatting:** Prettier (default config)
- **Linting:** ESLint with the project config
- **Components:** Functional components with hooks
- **State:** Project-specific state management (no Redux)
- **CSS:** Module CSS, following the design system (see `src/styles/tokens.css`)

### Backend (Rust)

- **Formatting:** `cargo fmt`
- **Linting:** `cargo clippy` with no warnings
- **Error handling:** Use `Result<T, E>` consistently. No `unwrap()` in production code.
- **Documentation:** Doc comments on public functions

### General

- Commit messages: imperative mood (`Add feature` not `Added feature`)
- One logical change per commit
- PR title should describe the change, not the issue number

---

## Submitting Changes

### For Bug Fixes and Small Changes

1. Fork the repository
2. Create a branch: `git checkout -b fix/description`
3. Make your changes
4. Run tests: `npm test && cargo test`
5. Run linters: `npm run lint && cargo clippy`
6. Commit with a clear message
7. Open a Pull Request

### For Features

1. **Open an issue first** to discuss the feature
2. Wait for approval before starting work
3. Follow the same PR process as above

### PR Checklist

- [ ] Tests pass (`npm test && cargo test`)
- [ ] Linters pass (`npm run lint && cargo clippy`)
- [ ] No new warnings
- [ ] UI changes tested on all 3 platforms (or noted which were tested)
- [ ] Translations updated if user-facing strings changed
- [ ] Screenshots included for UI changes

---

## Adding a Language

Stellar uses JSON-based i18n. To add a new language:

### 1. Create the translation file

```bash
cp src/i18n/en.json src/i18n/xx.json  # xx = ISO 639-1 code
```

### 2. Translate all strings

```json
{
  "app.name": "Stellar",
  "library.title": "Library",
  "editor.title": "Editor",
  ...
}
```

**Guidelines:**
- Translate meaning, not words. Adapt to the target language's conventions.
- Keep technical terms (Markdown, WikiLink, BibTeX, SQLite) untranslated.
- Test every screen — some languages are longer and may break layouts.

### 3. Register the language

Add your language to `src/i18n/index.ts`:

```typescript
import xx from './xx.json';

export const languages = {
  ja, en, fr, af,
  xx,  // Your language
};
```

### 4. Test

```bash
npm run tauri dev
# Switch language in Settings → Language
```

### 5. Submit a PR

Include:
- The translation file (`src/i18n/xx.json`)
- Updated `src/i18n/index.ts`
- A note about your fluency level (native / fluent / intermediate)

**Current languages and maintainers:**

| Language | Code | Maintainer |
|----------|------|-----------|
| 日本語 | `ja` | @toutoutoubun |
| English | `en` | @toutoutoubun |
| Français | `fr` | @toutoutoubun |
| Afrikaans | `af` | @toutoutoubun |

---

## Reporting Bugs

Open an issue with:

1. **Stellar version** (from Settings → About)
2. **Operating system** and version
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Screenshots** if applicable

Use the `bug` issue template if available.

---

## Feature Requests

Open an issue with:

1. **What problem does this solve?**
2. **Who would use this?**
3. **How should it work?**

Remember: features that add AI, cloud dependencies, or subscriptions will not be accepted.

---

## Code of Conduct

### The Short Version

Be respectful. Be constructive. Remember that behind every username is a person.

### The Longer Version

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1. In summary:

- **Be welcoming** to newcomers and experienced contributors alike
- **Be respectful** of differing viewpoints and experiences
- **Accept constructive criticism** gracefully
- **Focus on what is best** for the project and its users

**Unacceptable behavior** includes harassment, trolling, and publishing others' private information.

**Enforcement:** Violations can be reported to [shiosaisazanami@gmail.com](mailto:shiosaisazanami@gmail.com). All reports will be reviewed and handled confidentially.

---

## Questions?

- **GitHub Issues:** [github.com/toutoutoubun/stellar/issues](https://github.com/toutoutoubun/stellar/issues)
- **Email:** [shiosaisazanami@gmail.com](mailto:shiosaisazanami@gmail.com)

Thank you for helping make Stellar better. 🌊

---

---

# Contribuer à Stellar

Merci d'envisager de contribuer à Stellar. Ce document explique comment participer.

## Configuration

```bash
git clone https://github.com/toutoutoubun/stellar.git
cd stellar
npm install
npm run tauri dev
```

**Prérequis :** Node.js 22+, Rust 1.75+, [dépendances Tauri](https://v2.tauri.app/start/prerequisites/)

## Comment contribuer

| Type | Difficulté | Impact |
|------|-----------|--------|
| Signaler un bug | Facile | Élevé |
| Corriger une faute / améliorer la doc | Facile | Moyen |
| Ajouter ou améliorer une traduction | Facile–Moyen | Élevé |
| Corriger un bug | Moyen | Élevé |
| Améliorer l'UI / l'accessibilité | Moyen | Élevé |

## Rappel philosophique

Stellar n'inclut **pas** de fonctionnalités d'IA, de dépendances cloud ou d'abonnement. Les contributions dans ces directions ne seront pas acceptées.

## Ajouter une langue

1. Copiez `src/i18n/en.json` → `src/i18n/xx.json`
2. Traduisez toutes les chaînes
3. Enregistrez dans `src/i18n/index.ts`
4. Testez chaque écran
5. Ouvrez une Pull Request

## Soumettre des modifications

1. Forkez le dépôt
2. Créez une branche : `git checkout -b fix/description`
3. Exécutez les tests : `npm test && cargo test`
4. Exécutez les linters : `npm run lint && cargo clippy`
5. Ouvrez une Pull Request

## Questions ?

[shiosaisazanami@gmail.com](mailto:shiosaisazanami@gmail.com) · [Issues GitHub](https://github.com/toutoutoubun/stellar/issues)

---

---

# Bydra tot Stellar

Dankie dat jy dit oorweeg om tot Stellar by te dra. Hierdie dokument verduidelik hoe om deel te neem.

## Opstelling

```bash
git clone https://github.com/toutoutoubun/stellar.git
cd stellar
npm install
npm run tauri dev
```

**Voorvereistes:** Node.js 22+, Rust 1.75+, [Tauri-afhanklikhede](https://v2.tauri.app/start/prerequisites/)

## Hoe om by te dra

| Tipe | Moeilikheidsgraad | Impak |
|------|-------------------|-------|
| Rapporteer 'n fout | Maklik | Hoog |
| Regmaak 'n tikfout / verbeter dokumentasie | Maklik | Medium |
| Voeg 'n vertaling by of verbeter dit | Maklik–Medium | Hoog |
| Regmaak 'n fout | Medium | Hoog |
| Verbeter UI / toeganklikheid | Medium | Hoog |

## Filosofiese herinnering

Stellar sluit **nie** KI-kenmerke, wolkafhanklikhede of intekenings in nie. Bydraes in hierdie rigtings sal nie aanvaar word nie.

## Voeg 'n taal by

1. Kopieer `src/i18n/en.json` → `src/i18n/xx.json`
2. Vertaal alle stringe
3. Registreer in `src/i18n/index.ts`
4. Toets elke skerm
5. Maak 'n Pull Request oop

## Dien veranderinge in

1. Fork die bewaarplek
2. Skep 'n tak: `git checkout -b fix/beskrywing`
3. Voer toetse uit: `npm test && cargo test`
4. Voer linters uit: `npm run lint && cargo clippy`
5. Maak 'n Pull Request oop

## Vrae?

[shiosaisazanami@gmail.com](mailto:shiosaisazanami@gmail.com) · [GitHub Issues](https://github.com/toutoutoubun/stellar/issues)

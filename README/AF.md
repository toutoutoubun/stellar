<p align="center">
  <img src="assets/stellar-logo.svg" alt="Stellar" width="120" />
</p>

<h1 align="center">Stellar</h1>

<p align="center">
  <strong>'n Stil navorsingsomgewing vir geesteswetenskaplike navorsers.</strong><br>
  Biblioteek · Redigeerder · Verwysingsnetwerk · Kwalitatiewe analise · Uitvoer<br>
  Alles in een rekenaartoepassing. Plaaslik eerste. Geen KI. Geen intekening.
</p>

<p align="center">
  <a href="https://github.com/toutoutoubun/stellar/releases">
    <img src="https://img.shields.io/github/v/release/toutoutoubun/stellar?style=flat-square&color=2D516E" alt="Vrystelling" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/lisensie-MIT-D4A535?style=flat-square" alt="MIT-lisensie" />
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-7AA5B8?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/tale-JP%20%7C%20EN%20%7C%20FR%20%7C%20AF-6B7F4A?style=flat-square" alt="Tale" />
  <img src="https://img.shields.io/badge/KI-geen%20(deur%20ontwerp)-C9532E?style=flat-square" alt="Geen KI" />
</p>

<p align="center">
  <a href="https://shiosailearn.com/af/projects_stellar.html">Webwerf</a> ·
  <a href="#aflaai">Aflaai</a> ·
  <a href="#kenmerke">Kenmerke</a> ·
  <a href="#filosofie">Filosofie</a> ·
  <a href="https://github.com/toutoutoubun/stellar/issues">Issues</a>
</p>

---

## Hoekom Stellar?

Die meeste navorsers jongleer met 6–8 afsonderlike gereedskap: een vir verwysings, 'n ander vir notas, 'n ander vir skryfwerk, nog een vir analise, en so voort. Elke gereedskap is goed in een ding. Nie een van hulle praat met mekaar nie.

**Stellar sit alles op een plek.** Artikels, notas, verwysings, analise en uitvoer — in 'n enkele rekenaartoepassing wat op jou masjien loop.

Geen wolkafhanklikheid. Geen KI wat namens jou besluit. Geen intekening wat jou begroting dreineer.

Jou gedagtes is joune.

---

## Kenmerke

### 📚 Biblioteek

Bestuur artikels, boeke en bronne. Etiketteer, kategoriseer, soek.

<details>
<summary>Skermkiekie</summary>
<!-- TODO: Voeg skermkiekie by -->
</details>

### ✍️ Redigeerder

Skryf in Markdown met WikiLink-ondersteuning. Verbind idees terwyl jy skryf. Vinnig, afleidingvry, sleutelbordgedrewe.

<details>
<summary>Skermkiekie</summary>
<!-- TODO: Voeg skermkiekie by -->
</details>

### 🔗 Verwysingsnetwerk

Visualiseer hoe jou bronne verbind. Sien verwysingsverhoudings as 'n interaktiewe grafiek. Vind patrone in jou navorsing wat sigblaaie nie kan wys nie.

<details>
<summary>Skermkiekie</summary>
<!-- TODO: Voeg skermkiekie by -->
</details>

### 🔬 Kwalitatiewe analise

Kodeer teksdata. Bou temas. Doen kwalitatiewe analise — sonder om honderde dollars per jaar vir kommersiële sagteware te betaal.

<details>
<summary>Skermkiekie</summary>
<!-- TODO: Voeg skermkiekie by -->
</details>

### 📤 Uitvoer

Voer uit as PDF, Word of HTML. Neem jou werk oral saam.

<details>
<summary>Skermkiekie</summary>
<!-- TODO: Voeg skermkiekie by -->
</details>

---

## Filosofie

Stellar word gebou deur [Shiosailearn](https://shiosailearn.com) — *stil gereedskap vir outonome individue.*

Ons volg drie weierings:

| | Weiering | Hoekom |
|---|---------|-------|
| 01 | **Ons vergesel nie** | "Ek loop saam met jou" skep druk om te presteer. Ons gee jou die gereedskap en tree terug. |
| 02 | **Ons ondersteun nie** | "Vir jou beswil" definieer jou as iemand wat hulp nodig het. Ons gebruik nie daardie definisie nie. |
| 03 | **Ons integreer nie** | Integrasie met ander gereedskap steel jou tyd. Jou data, jou werkvloei. |

### Oor KI

Stellar het geen KI-kenmerke nie. Dit is nie 'n beperking nie — dit is 'n ontwerpbesluit.

Jou navorsing vereis jou oordeel. 'n KI wat jou bronne opsom of jou argumente voorstel, dink namens jou. Ons glo die wrywing van lees, kodeer, verbind en skryf *is* die navorsing.

### Oor data

Plaaslik eerste, met wolkrugsteun. Jou data leef op jou masjien in SQLite. Rugsteun na enige wolkdiens wat jy vertrou. Ons sien nooit jou data nie, want ons vra nooit daarvoor nie.

---

## Tegnologiestapel

| Laag | Tegnologie |
|------|-----------|
| Voorkant | React 19 |
| Rekenaar-looptyd | Tauri 2.0 |
| Agterkantlogika | Rust |
| Databasis | SQLite |
| Kodebasis | ~65 800 lyne |

Gebou met Tauri + Rust vir vinnige begin (minder as 2 sekondes) en lae geheuegebruik (minder as 200 MB RAM).

---

## Aflaai

<table>
<tr>
<td align="center">
<img src="assets/macos-icon.svg" width="48" /><br>
<strong>macOS</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">Laai .dmg af</a>
</td>
<td align="center">
<img src="assets/windows-icon.svg" width="48" /><br>
<strong>Windows</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">Laai .msi af</a>
</td>
<td align="center">
<img src="assets/linux-icon.svg" width="48" /><br>
<strong>Linux</strong><br>
<a href="https://github.com/toutoutoubun/stellar/releases">Laai .AppImage af</a>
</td>
</tr>
</table>

**Vereistes:** macOS 11+, Windows 10+, of Linux (Ubuntu 20.04+, Fedora 36+, Arch)

---

## Tale

Stellar praat vier tale:

| Taal | Status |
|------|--------|
| 🇯🇵 日本語 | ✅ Volledig |
| 🇬🇧 English | ✅ Volledig |
| 🇫🇷 Français | ✅ Volledig |
| 🇿🇦 Afrikaans | ✅ Volledig |

Wil jy 'n taal byvoeg? Sien [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Vir wie is dit?

Stellar is gebou vir **geesteswetenskaplike navorsers** — politieke wetenskaplikes, historici, taalkundiges, sosioloë — wat 'n enkele, stil gereedskap wil hê wat hul denkproses respekteer.

Jy sal dalk van Stellar hou as:

- ✅ Jy is moeg vir die gejongleer tussen verskeie afsonderlike gereedskap
- ✅ Jy wil jou data op jou masjien hê, nie op iemand anders se bediener nie
- ✅ Jy wil nie hê KI moet jou analise skryf nie
- ✅ Jy kan nie duur kommersiële kwalitatiewe analise-sagteware bekostig nie
- ✅ Jy wil 'n gereedskap wat in jou taal werk

Stellar is **nie** vir jou as:

- ❌ Jy het intydse samewerking nodig (Stellar is enkelgebruiker)
- ❌ Jy het gevorderde tipografiese verwerking nodig
- ❌ Jy wil hê KI moet jou artikels opsom

---

## Padkaart

- [x] v1.0 — Kernmodules (Biblioteek, Redigeerder, Verwysingsnetwerk, KA, Uitvoer)
- [x] 4-taalondersteuning (JP, EN, FR, AF)
- [ ] Verwysings-invoertowenaar
- [ ] Mobiele metgeseltoepassing (leesalleen)
- [ ] Inpropstelsel vir gemeenskapsuitbreidings
- [ ] Meer tale (bydraes welkom)

---

## Bydra

Stellar is onder MIT-lisensie en oop vir bydraes. Sien [CONTRIBUTING.md](CONTRIBUTING.md) vir riglyne.

```bash
# Kloon en hardloop
git clone https://github.com/toutoutoubun/stellar.git
cd stellar
npm install
npm run tauri dev
```

**Voorvereistes:** Node.js 22+, Rust 1.75+, platformspesifieke Tauri-afhanklikhede ([sien Tauri-dokumentasie](https://v2.tauri.app/start/prerequisites/))

---

## Oor die ontwikkelaar

Stellar is gebou deur **tami_tou** — 'n 17-jarige navorser wat Suid-Afrikaanse politiek in Japan bestudeer. Ek het Stellar gebou omdat ek 'n navorsingsomgewing nodig gehad het wat nie namens my probeer dink nie, wat nie geld kos wat ek nie het nie, en wat in die tale werk waarin ek werk.

Dit is 'n gereedskap wat ek eers vir myself gebou het. As dit jou ook help, is dit presies die doel.

→ [shiosailearn.com](https://shiosailearn.com) · [GitHub](https://github.com/toutoutoubun) · [shiosaisazanami@gmail.com](mailto:shiosaisazanami@gmail.com)

---

<p align="center">
  <sub>
    <strong>Stellar</strong> — 'n <a href="https://shiosailearn.com">Shiosailearn</a>-projek.<br>
    Stil gereedskap vir outonome individue.<br>
    MIT-lisensie · 2026
  </sub>
</p>

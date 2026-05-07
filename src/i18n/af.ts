// src/i18n/af.ts — Afrikaanse vertaalhulpbron

import type { TranslationKeys } from "./ja";

const af: TranslationKeys = {
  common: {
    appName: "Stellar",
    back: "Terug",
    next: "Volgende",
    save: "Stoor",
    cancel: "Kanselleer",
    delete: "Verwyder",
    edit: "Wysig",
    close: "Sluit",
    search: "Soek",
    loading: "Laai...",
    error: "Fout",
    items: "items",
    chars: "kar.",
  },

  sidebar: {
    library: "Biblioteek",
    notes: "Notas",
    graph: "Grafiek",
    qualitative: "Kwalitatief",
    quantitative: "Kwantitatief",
    settings: "Instellings",
    expandSidebar: "Brei sybalk uit",
    collapseSidebar: "Vou sybalk in",
  },

  settings: {
    title: "Instellings",
    tabs: {
      appearance: "Voorkoms",
      data: "Data",
      shortcuts: "Kortpaaie",
      citation: "Verwysing",
      language: "Taal",
    },
    appearance: {
      theme: "Tema",
      themeDesc: "Kies die voorkomstema vir die toepassing",
      fontSize: "Lettergrootte",
      fontSizeDesc: "Basis lettergrootte vir die hele toepassing (13px–16px)",
      lineHeight: "Lynhoogte",
      lineHeightDesc: "Lynspasiëring in die redigeerder (1.5–2.0)",
      editorFont: "Redigeerder-lettertipe",
      editorFontDesc: "Lettertipe wat in die nota-redigeerder gebruik word",
      previewText:
        "Dit is voorskouteks. The quick brown fox jumps over the lazy dog. Bestuur jou navorsingsartikels doeltreffend en verbind jou kennis.",
    },
    data: {
      summary: "Data-opsomming",
      summaryDesc: "Toepassingsdatastatistieke",
      papers: "Artikels",
      notes: "Notas",
      highlights: "Hoogtepunte",
      diskUsage: "Skyfgebruik",
      calculating: "Bereken...",
      storagePath: "Data-ligging",
      storagePathDesc: "Stoorplek vir databasisse en PDF-lêers",
      change: "Verander...",
      storageNote: "* DB- en PDF-vouers sal gekopieer word wanneer dit verander word",
      exportBackup: "Uitvoer & Rugsteun",
      exportBackupDesc: "Voer data uit of skep 'n rugsteun",
      exportData: "Voer data uit",
      exporting: "Uitvoer...",
      createBackup: "Skep rugsteun",
      backingUp: "Rugsteun...",
      exportNote:
        "Uitvoer: JSON + PDF ZIP / Rugsteun: stellar_backup_JJJJMMDD.zip",
    },
    shortcuts: {
      title: "Sleutelbordkortpaaie",
      desc: "Lys van beskikbare sleutelbordkortpaaie",
      customizeNote:
        "* Kortpadaanpassing sal in 'n toekomstige opdatering beskikbaar wees",
      categories: {
        navigation: "Navigasie",
        editor: "Redigeerder",
        graph: "Grafiek",
        pdfReader: "PDF-leser",
      },
      items: {
        openSearch: "Maak voltekssoektog oop",
        newNote: "Skep nuwe nota",
        openSettings: "Maak instellings oop",
        switchLibrary: "Skakel na biblioteek",
        switchNotes: "Skakel na notas",
        switchGraph: "Skakel na grafiekaansig",
        save: "Stoor",
        bold: "Vetdruk",
        italic: "Kursief",
        undo: "Ontdoen",
        redo: "Herdoen",
        insertWikiLink: "Voeg WikiLink in",
        selectAll: "Kies alle nodusse",
        scroll: "Zoom in/uit",
        drag: "Skuif doek",
        doubleClick: "Gaan na nodusdetail",
        zoomIn: "Zoom in",
        zoomOut: "Zoom uit",
        zoomReset: "Stel zoom terug",
      },
      keys: {
        scroll: "Blaai",
        drag: "Sleep",
        doubleClick: "Dubbelklik",
      },
    },
    citation: {
      defaultStyle: "Verstek-verwysingstyl",
      defaultStyleDesc:
        "Kies die verstekformaat wanneer verwysings gegenereer word",
      authorOrder: "Outeurnaamvolgorde",
      authorOrderDesc:
        "Kies die volgorde vir die vertoon van outeurname",
      surnameFirst: "Van eerste",
      surnameFirstExample: "bv. Van der Merwe Jan",
      givenFirst: "Voornaam eerste",
      givenFirstExample: "bv. Jan van der Merwe",
      apa7Hint: "Outeur, (Jaar). Titel. Tydskrif, Vol(Uitgawe), Bladsye.",
      mla9Hint: 'Outeur. "Titel." Tydskrif, Vol.Uitgawe, Jaar, Bladsye.',
      chicago17Hint: "Outeur. Titel. Tydskrif Vol, no. Uitgawe (Jaar): Bladsye.",
      hitotsubashiHint: "Outeur \"Titel\" Tydskrif, Vol Uitgawe, Jaar, Bladsye.",
    },
    language: {
      title: "Vertoontaal",
      desc: "Kies die vertoontaal vir die toepassing",
      current: "Huidige taal",
      restart: "* Sommige veranderinge vereis 'n herbegin",
    },
  },

  themes: {
    white: "Wit",
    whiteDesc: "Skoon suiwer-wit basis",
    ivory: "Ivoor",
    ivoryDesc: "Warm ivoorbasis",
    "dark-blue": "Donkerblou",
    "dark-blueDesc": "Kalm donkerblou",
    black: "Swart",
    blackDesc: "Ware swart basis (OLED-vriendelik)",
  },

  editorFonts: {
    "system-ui": "Stelsellettertipe",
  },

  notes: {
    title: "Notas",
    searchPlaceholder: "Soek notas…",
    clearSearch: "Vee soektog uit",
    createNote: "Skep nuwe nota (Ctrl+N)",
    untitled: "Titelloze nota",
    createFailed: "Kon nie nota skep nie",
    noResults: "Geen ooreenstemmende notas gevind nie",
    empty: "Geen notas nie",
    createFirst: "Skep jou eerste nota",
    sortUpdated: "Gewysig",
    sortCreated: "Geskep",
    sortTitle: "Titel",
    justNow: "sopas",
    minutesAgo: "{n} min gelede",
    hoursAgo: "{n} u gelede",
    daysAgo: "{n} d gelede",
  },

  onboarding: {
    welcome: {
      title: "Welkom by Stellar",
      desc: "Literatuurbestuur, notas en grafiekaansig in een toepassing.\nMaak jou navorsing slimmer.",
      start: "Begin",
    },
    language: {
      title: "Kies taal",
      desc: "Kies jou voorkeur taal. Jy kan dit later in die instellings verander.",
    },
    storage: {
      title: "Data-stoorplek",
      desc: "Kies waar jou literatuur en PDF-lêers gestoor word.\nJy kan dit later in die instellings verander.",
      change: "Verander...",
    },
    theme: {
      title: "Kies 'n tema",
      desc: "Kies jou voorkeur voorkomstema",
    },
    completion: {
      title: "Alles gereed!",
      desc: "Stellar is gereed om te gebruik.\nBegin deur jou eerste artikel by te voeg en begin met jou navorsing.",
      shortcutSearch: "Maak voltekssoektog oop",
      shortcutNote: "Skep nuwe nota",
      startButton: "Begin Stellar gebruik",
    },
  },

  locales: {
    ja: "日本語",
    en: "English",
    fr: "Français",
    af: "Afrikaans",
  },
};

export default af;

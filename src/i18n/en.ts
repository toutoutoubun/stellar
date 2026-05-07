// src/i18n/en.ts — English translation resource

import type { TranslationKeys } from "./ja";

const en: TranslationKeys = {
  common: {
    appName: "Stellar",
    back: "Back",
    next: "Next",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    search: "Search",
    loading: "Loading...",
    error: "Error",
    items: "items",
    chars: "chars",
  },

  sidebar: {
    library: "Library",
    notes: "Notes",
    graph: "Graph",
    qualitative: "Qualitative",
    quantitative: "Quantitative",
    settings: "Settings",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
  },

  settings: {
    title: "Settings",
    tabs: {
      appearance: "Appearance",
      data: "Data",
      shortcuts: "Shortcuts",
      citation: "Citation",
      language: "Language",
    },
    appearance: {
      theme: "Theme",
      themeDesc: "Select the appearance theme for the app",
      fontSize: "Font Size",
      fontSizeDesc: "Base font size for the entire app (13px–16px)",
      lineHeight: "Line Height",
      lineHeightDesc: "Line spacing in the editor (1.5–2.0)",
      editorFont: "Editor Font",
      editorFontDesc: "Font used in the note editor",
      previewText:
        "This is preview text. The quick brown fox jumps over the lazy dog. Manage your research papers efficiently and connect your knowledge.",
    },
    data: {
      summary: "Data Summary",
      summaryDesc: "Application data statistics",
      papers: "Papers",
      notes: "Notes",
      highlights: "Highlights",
      diskUsage: "Disk Usage",
      calculating: "Calculating...",
      storagePath: "Data Location",
      storagePathDesc: "Storage location for databases and PDF files",
      change: "Change...",
      storageNote: "* DB and PDF folders will be copied when changed",
      exportBackup: "Export & Backup",
      exportBackupDesc: "Export data or create a backup",
      exportData: "Export Data",
      exporting: "Exporting...",
      createBackup: "Create Backup",
      backingUp: "Backing up...",
      exportNote:
        "Export: JSON + PDF ZIP / Backup: stellar_backup_YYYYMMDD.zip",
    },
    shortcuts: {
      title: "Keyboard Shortcuts",
      desc: "List of available keyboard shortcuts",
      customizeNote:
        "* Shortcut customisation will be available in a future update",
      categories: {
        navigation: "Navigation",
        editor: "Editor",
        graph: "Graph",
        pdfReader: "PDF Reader",
      },
      items: {
        openSearch: "Open full-text search",
        newNote: "Create new note",
        openSettings: "Open settings",
        switchLibrary: "Switch to library",
        switchNotes: "Switch to notes",
        switchGraph: "Switch to graph view",
        save: "Save",
        bold: "Bold",
        italic: "Italic",
        undo: "Undo",
        redo: "Redo",
        insertWikiLink: "Insert WikiLink",
        selectAll: "Select all nodes",
        scroll: "Zoom in/out",
        drag: "Pan canvas",
        doubleClick: "Go to node detail",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        zoomReset: "Reset zoom",
      },
      keys: {
        scroll: "Scroll",
        drag: "Drag",
        doubleClick: "Double-click",
      },
    },
    citation: {
      defaultStyle: "Default Citation Style",
      defaultStyleDesc:
        "Select the default format when generating citations",
      authorOrder: "Author Name Order",
      authorOrderDesc:
        "Select the order for displaying author names",
      surnameFirst: "Surname first",
      surnameFirstExample: "e.g. Yamada Taro",
      givenFirst: "Given name first",
      givenFirstExample: "e.g. Taro Yamada",
      apa7Hint: "Author, (Year). Title. Journal, Vol(Issue), Pages.",
      mla9Hint: 'Author. "Title." Journal, Vol.Issue, Year, Pages.',
      chicago17Hint: "Author. Title. Journal Vol, no. Issue (Year): Pages.",
      hitotsubashiHint: "Author \"Title\" Journal, Vol Issue, Year, Pages.",
    },
    language: {
      title: "Display Language",
      desc: "Select the display language for the application",
      current: "Current language",
      restart: "* Some changes may require a restart to take effect",
    },
  },

  themes: {
    white: "White",
    whiteDesc: "Clean pure-white base",
    ivory: "Ivory",
    ivoryDesc: "Warm ivory base",
    "dark-blue": "Dark Blue",
    "dark-blueDesc": "Calm dark-blue",
    black: "Black",
    blackDesc: "True black base (OLED-friendly)",
  },

  editorFonts: {
    "system-ui": "System Font",
  },

  notes: {
    title: "Notes",
    searchPlaceholder: "Search notes…",
    clearSearch: "Clear search",
    createNote: "Create new note (Ctrl+N)",
    untitled: "Untitled Note",
    createFailed: "Failed to create note",
    noResults: "No matching notes found",
    empty: "No notes yet",
    createFirst: "Create your first note",
    sortUpdated: "Updated",
    sortCreated: "Created",
    sortTitle: "Title",
    justNow: "just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
  },

  onboarding: {
    welcome: {
      title: "Welcome to Stellar",
      desc: "Literature management, notes, and graph view in one app.\nMake your research smarter.",
      start: "Get Started",
    },
    language: {
      title: "Choose Language",
      desc: "Select your preferred language. You can change this later in settings.",
    },
    storage: {
      title: "Data Storage Location",
      desc: "Choose where to store your literature and PDF files.\nYou can change this later in settings.",
      change: "Change...",
    },
    theme: {
      title: "Choose a Theme",
      desc: "Select your preferred appearance theme",
    },
    completion: {
      title: "All Set!",
      desc: "Stellar is ready to go.\nStart by adding your first paper and begin your research.",
      shortcutSearch: "Open full-text search",
      shortcutNote: "Create new note",
      startButton: "Start Using Stellar",
    },
  },

  locales: {
    ja: "日本語",
    en: "English",
    fr: "Français",
    af: "Afrikaans",
  },
};

export default en;

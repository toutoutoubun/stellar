// src/i18n/ja.ts — 日本語翻訳リソース（デフォルト言語）

const ja = {
  // ============================================================
  // 共通
  // ============================================================
  common: {
    appName: "Stellar",
    back: "戻る",
    next: "次へ",
    save: "保存",
    cancel: "キャンセル",
    delete: "削除",
    edit: "編集",
    close: "閉じる",
    search: "検索",
    loading: "読み込み中...",
    error: "エラー",
    items: "件",
    chars: "字",
  },

  // ============================================================
  // サイドバー
  // ============================================================
  sidebar: {
    library: "文献",
    notes: "ノート",
    graph: "グラフ",
    qualitative: "質的分析",
    quantitative: "量的分析",
    settings: "設定",
    expandSidebar: "サイドバーを展開",
    collapseSidebar: "サイドバーを折りたたむ",
  },

  // ============================================================
  // 設定
  // ============================================================
  settings: {
    title: "設定",
    tabs: {
      appearance: "外観",
      data: "データ",
      shortcuts: "ショートカット",
      citation: "引用スタイル",
      language: "言語",
    },
    appearance: {
      theme: "テーマ",
      themeDesc: "アプリの外観テーマを選択します",
      fontSize: "フォントサイズ",
      fontSizeDesc: "アプリ全体のベースフォントサイズ（13px〜16px）",
      lineHeight: "行の高さ",
      lineHeightDesc: "エディタの行間（1.5〜2.0）",
      editorFont: "エディタフォント",
      editorFontDesc: "ノートエディタで使用するフォント",
      previewText:
        "これはプレビューテキストです。The quick brown fox jumps over the lazy dog. 研究論文を効率的に管理し、知識をつなげましょう。",
    },
    data: {
      summary: "データサマリー",
      summaryDesc: "アプリケーションのデータ統計",
      papers: "論文",
      notes: "ノート",
      highlights: "ハイライト",
      diskUsage: "ディスク使用量",
      calculating: "計算中...",
      storagePath: "データ保存先",
      storagePathDesc: "データベースと PDF ファイルの保存場所",
      change: "変更...",
      storageNote: "※ 変更時に DB と PDF フォルダがコピーされます",
      exportBackup: "エクスポート＆バックアップ",
      exportBackupDesc: "データの書き出しやバックアップを作成します",
      exportData: "データをエクスポート",
      exporting: "エクスポート中...",
      createBackup: "バックアップを作成",
      backingUp: "バックアップ中...",
      exportNote:
        "エクスポート: JSON + PDF ZIP / バックアップ: stellar_backup_YYYYMMDD.zip",
    },
    shortcuts: {
      title: "キーボードショートカット",
      desc: "利用可能なキーボードショートカットの一覧です",
      customizeNote:
        "※ ショートカットのカスタマイズは今後のアップデートで対応予定です",
      categories: {
        navigation: "ナビゲーション",
        editor: "エディタ",
        graph: "グラフ",
        pdfReader: "PDF リーダー",
      },
      items: {
        openSearch: "全文検索を開く",
        newNote: "新しいノートを作成",
        openSettings: "設定を開く",
        switchLibrary: "文献ライブラリに切替",
        switchNotes: "ノートビューに切替",
        switchGraph: "グラフビューに切替",
        save: "保存",
        bold: "太字",
        italic: "斜体",
        undo: "元に戻す",
        redo: "やり直し",
        insertWikiLink: "WikiLink を挿入",
        selectAll: "全ノードを選択",
        scroll: "ズームイン/アウト",
        drag: "キャンバスをパン",
        doubleClick: "ノード詳細へ遷移",
        zoomIn: "ズームイン",
        zoomOut: "ズームアウト",
        zoomReset: "ズームリセット",
      },
      keys: {
        scroll: "スクロール",
        drag: "ドラッグ",
        doubleClick: "ダブルクリック",
      },
    },
    citation: {
      defaultStyle: "デフォルト引用スタイル",
      defaultStyleDesc: "引用を生成する際のデフォルトフォーマットを選択します",
      authorOrder: "日本語著者名の表示順序",
      authorOrderDesc: "日本語の著者名を表示する際の姓名順序を選択します",
      surnameFirst: "姓・名（姓が先）",
      surnameFirstExample: "例: 山田 太郎",
      givenFirst: "名・姓（名が先）",
      givenFirstExample: "例: 太郎 山田",
      apa7Hint: "著者名, (年). タイトル. 雑誌名, 巻(号), ページ.",
      mla9Hint: '著者名. "タイトル." 雑誌名, 巻.号, 年, ページ.',
      chicago17Hint: "著者名. タイトル. 雑誌名 巻, no. 号 (年): ページ.",
      hitotsubashiHint: "著者名『タイトル』雑誌名、第巻号、年、ページ。",
    },
    language: {
      title: "表示言語",
      desc: "アプリケーションの表示言語を選択します",
      current: "現在の言語",
      restart: "※ 一部の変更は再起動後に反映されます",
    },
  },

  // ============================================================
  // テーマ
  // ============================================================
  themes: {
    white: "ホワイト",
    whiteDesc: "清潔感のある純白ベース",
    ivory: "アイボリー",
    ivoryDesc: "温かみのあるアイボリーベース",
    "dark-blue": "ダークブルー",
    "dark-blueDesc": "落ち着いたダークブルー",
    black: "ブラック",
    blackDesc: "真の黒ベース（OLED対応）",
  },

  // ============================================================
  // エディタフォント
  // ============================================================
  editorFonts: {
    "system-ui": "システムフォント",
  },

  // ============================================================
  // ノート
  // ============================================================
  notes: {
    title: "ノート",
    searchPlaceholder: "ノートを検索…",
    clearSearch: "検索をクリア",
    createNote: "新しいノートを作成（Ctrl+N）",
    untitled: "無題のノート",
    createFailed: "ノートの作成に失敗しました",
    noResults: "該当するノートが見つかりません",
    empty: "ノートがありません",
    createFirst: "最初のノートを作成",
    sortUpdated: "更新日",
    sortCreated: "作成日",
    sortTitle: "タイトル",
    justNow: "たった今",
    minutesAgo: "{n}分前",
    hoursAgo: "{n}時間前",
    daysAgo: "{n}日前",
  },

  // ============================================================
  // オンボーディング
  // ============================================================
  onboarding: {
    welcome: {
      title: "Stellar へようこそ",
      desc: "文献管理・ノート・グラフビューを1つのアプリで。\n研究をもっとスマートに。",
      start: "はじめる",
    },
    language: {
      title: "表示言語を選択",
      desc: "お好みの言語を選択してください。あとから設定で変更できます。",
    },
    storage: {
      title: "データの保存先",
      desc: "文献データや PDF の保存先を選択してください。\nあとから設定で変更できます。",
      change: "変更...",
    },
    theme: {
      title: "テーマを選ぶ",
      desc: "お好みの外観テーマを選択してください",
    },
    completion: {
      title: "準備完了!",
      desc: "Stellar の設定が完了しました。\nさっそく文献を追加して、研究を始めましょう。",
      shortcutSearch: "全文検索を開く",
      shortcutNote: "新しいノートを作成",
      startButton: "Stellar を使い始める",
    },
  },

  // ============================================================
  // 言語表示名
  // ============================================================
  locales: {
    ja: "日本語",
    en: "English",
    fr: "Français",
    af: "Afrikaans",
  },
};

/** 翻訳リソースの型（再帰的に string へ拡張） */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type TranslationKeys = DeepStringify<typeof ja>;
export default ja as TranslationKeys;

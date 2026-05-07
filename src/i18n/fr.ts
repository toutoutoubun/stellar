// src/i18n/fr.ts — Ressource de traduction française

import type { TranslationKeys } from "./ja";

const fr: TranslationKeys = {
  common: {
    appName: "Stellar",
    back: "Retour",
    next: "Suivant",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    close: "Fermer",
    search: "Rechercher",
    loading: "Chargement...",
    error: "Erreur",
    items: "éléments",
    chars: "car.",
  },

  sidebar: {
    library: "Bibliothèque",
    notes: "Notes",
    graph: "Graphe",
    qualitative: "Qualitatif",
    quantitative: "Quantitatif",
    settings: "Paramètres",
    expandSidebar: "Développer la barre latérale",
    collapseSidebar: "Réduire la barre latérale",
  },

  settings: {
    title: "Paramètres",
    tabs: {
      appearance: "Apparence",
      data: "Données",
      shortcuts: "Raccourcis",
      citation: "Citation",
      language: "Langue",
    },
    appearance: {
      theme: "Thème",
      themeDesc: "Sélectionnez le thème d'apparence de l'application",
      fontSize: "Taille de police",
      fontSizeDesc: "Taille de base de la police pour l'application (13px–16px)",
      lineHeight: "Hauteur de ligne",
      lineHeightDesc: "Espacement des lignes dans l'éditeur (1.5–2.0)",
      editorFont: "Police de l'éditeur",
      editorFontDesc: "Police utilisée dans l'éditeur de notes",
      previewText:
        "Ceci est un texte de prévisualisation. Le renard brun rapide saute par-dessus le chien paresseux. Gérez efficacement vos articles de recherche et connectez vos connaissances.",
    },
    data: {
      summary: "Résumé des données",
      summaryDesc: "Statistiques des données de l'application",
      papers: "Articles",
      notes: "Notes",
      highlights: "Surlignages",
      diskUsage: "Utilisation du disque",
      calculating: "Calcul en cours...",
      storagePath: "Emplacement des données",
      storagePathDesc: "Emplacement de stockage des bases de données et des fichiers PDF",
      change: "Modifier...",
      storageNote: "* Les dossiers DB et PDF seront copiés lors du changement",
      exportBackup: "Export & Sauvegarde",
      exportBackupDesc: "Exporter les données ou créer une sauvegarde",
      exportData: "Exporter les données",
      exporting: "Exportation...",
      createBackup: "Créer une sauvegarde",
      backingUp: "Sauvegarde en cours...",
      exportNote:
        "Export : JSON + PDF ZIP / Sauvegarde : stellar_backup_AAAAMMJJ.zip",
    },
    shortcuts: {
      title: "Raccourcis clavier",
      desc: "Liste des raccourcis clavier disponibles",
      customizeNote:
        "* La personnalisation des raccourcis sera disponible dans une future mise à jour",
      categories: {
        navigation: "Navigation",
        editor: "Éditeur",
        graph: "Graphe",
        pdfReader: "Lecteur PDF",
      },
      items: {
        openSearch: "Ouvrir la recherche plein texte",
        newNote: "Créer une nouvelle note",
        openSettings: "Ouvrir les paramètres",
        switchLibrary: "Basculer vers la bibliothèque",
        switchNotes: "Basculer vers les notes",
        switchGraph: "Basculer vers le graphe",
        save: "Enregistrer",
        bold: "Gras",
        italic: "Italique",
        undo: "Annuler",
        redo: "Rétablir",
        insertWikiLink: "Insérer un WikiLink",
        selectAll: "Sélectionner tous les nœuds",
        scroll: "Zoom avant/arrière",
        drag: "Déplacer le canevas",
        doubleClick: "Aller aux détails du nœud",
        zoomIn: "Zoom avant",
        zoomOut: "Zoom arrière",
        zoomReset: "Réinitialiser le zoom",
      },
      keys: {
        scroll: "Défilement",
        drag: "Glisser",
        doubleClick: "Double-clic",
      },
    },
    citation: {
      defaultStyle: "Style de citation par défaut",
      defaultStyleDesc:
        "Sélectionnez le format par défaut pour la génération de citations",
      authorOrder: "Ordre des noms d'auteur",
      authorOrderDesc:
        "Sélectionnez l'ordre d'affichage des noms d'auteur",
      surnameFirst: "Nom de famille en premier",
      surnameFirstExample: "ex. Dupont Jean",
      givenFirst: "Prénom en premier",
      givenFirstExample: "ex. Jean Dupont",
      apa7Hint: "Auteur, (Année). Titre. Revue, Vol(Numéro), Pages.",
      mla9Hint: 'Auteur. « Titre. » Revue, Vol.Numéro, Année, Pages.',
      chicago17Hint: "Auteur. Titre. Revue Vol, no. Numéro (Année) : Pages.",
      hitotsubashiHint: "Auteur « Titre » Revue, Vol Numéro, Année, Pages.",
    },
    language: {
      title: "Langue d'affichage",
      desc: "Sélectionnez la langue d'affichage de l'application",
      current: "Langue actuelle",
      restart: "* Certains changements nécessitent un redémarrage",
    },
  },

  themes: {
    white: "Blanc",
    whiteDesc: "Base blanc pur et épuré",
    ivory: "Ivoire",
    ivoryDesc: "Base ivoire chaleureuse",
    "dark-blue": "Bleu foncé",
    "dark-blueDesc": "Bleu foncé apaisant",
    black: "Noir",
    blackDesc: "Base noire vraie (compatible OLED)",
  },

  editorFonts: {
    "system-ui": "Police système",
  },

  notes: {
    title: "Notes",
    searchPlaceholder: "Rechercher des notes…",
    clearSearch: "Effacer la recherche",
    createNote: "Créer une nouvelle note (Ctrl+N)",
    untitled: "Note sans titre",
    createFailed: "Échec de la création de la note",
    noResults: "Aucune note correspondante trouvée",
    empty: "Aucune note",
    createFirst: "Créer votre première note",
    sortUpdated: "Modifié",
    sortCreated: "Créé",
    sortTitle: "Titre",
    justNow: "à l'instant",
    minutesAgo: "il y a {n} min",
    hoursAgo: "il y a {n} h",
    daysAgo: "il y a {n} j",
  },

  onboarding: {
    welcome: {
      title: "Bienvenue sur Stellar",
      desc: "Gestion de bibliographie, notes et vue graphe dans une seule application.\nRendez votre recherche plus intelligente.",
      start: "Commencer",
    },
    language: {
      title: "Choisir la langue",
      desc: "Sélectionnez votre langue préférée. Vous pourrez la changer plus tard dans les paramètres.",
    },
    storage: {
      title: "Emplacement de stockage",
      desc: "Choisissez l'emplacement pour stocker vos données et fichiers PDF.\nVous pourrez le changer plus tard dans les paramètres.",
      change: "Modifier...",
    },
    theme: {
      title: "Choisir un thème",
      desc: "Sélectionnez votre thème d'apparence préféré",
    },
    completion: {
      title: "Tout est prêt !",
      desc: "Stellar est prêt à l'emploi.\nCommencez par ajouter votre premier article et lancez vos recherches.",
      shortcutSearch: "Ouvrir la recherche plein texte",
      shortcutNote: "Créer une nouvelle note",
      startButton: "Commencer à utiliser Stellar",
    },
  },

  locales: {
    ja: "日本語",
    en: "English",
    fr: "Français",
    af: "Afrikaans",
  },
};

export default fr;

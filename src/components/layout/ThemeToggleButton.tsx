// src/components/layout/ThemeToggleButton.tsx
// Stellar — テーマ切替ボタン
// クリックで white → ivory → dark-blue → black → white とローテーション
// ホバーで次テーマ名をツールチップ表示
// 切替時に data-theme-transition クラスを body に 300ms 付与

import type React from "react";
import { useCallback, useState } from "react";
import { useThemeStore, getNextTheme, getThemeMeta } from "../../stores/useThemeStore";

/** テーマアイコン SVG コンポーネント */
const ThemeIcon: React.FC<{ icon: string; size?: number }> = ({
  icon,
  size = 14,
}) => {
  switch (icon) {
    case "sun":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    case "sunrise":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 18a5 5 0 0 0-10 0" />
          <line x1="12" y1="2" x2="12" y2="9" />
          <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
          <line x1="1" y1="18" x2="3" y2="18" />
          <line x1="21" y1="18" x2="23" y2="18" />
          <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
          <line x1="23" y1="22" x2="1" y2="22" />
          <polyline points="8 6 12 2 16 6" />
        </svg>
      );
    case "moon":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "circle":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    default:
      return null;
  }
};

export const ThemeToggleButton: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const [isHovered, setIsHovered] = useState(false);

  const currentMeta = getThemeMeta(theme);
  const nextTheme = getNextTheme(theme);
  const nextMeta = getThemeMeta(nextTheme);

  const handleClick = useCallback(() => {
    // body に data-theme-transition を付与して 300ms 後に除去
    document.body.setAttribute("data-theme-transition", "");
    cycleTheme();
    setTimeout(() => {
      document.body.removeAttribute("data-theme-transition");
    }, 300);
  }, [cycleTheme]);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center justify-center w-8 h-8 relative"
      style={{
        borderRadius: "var(--radius-button)",
        color: "var(--color-text-secondary)",
        backgroundColor: isHovered ? "var(--color-bg-hover)" : "transparent",
        transition: "all var(--transition-fast)",
      }}
      title={t.layout.k_tlq9dl}
    >
      <ThemeIcon icon={currentMeta.icon} size={14} />
    </button>
  );
};

export { ThemeIcon };

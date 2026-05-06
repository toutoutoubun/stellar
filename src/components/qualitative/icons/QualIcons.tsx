// src/components/qualitative/icons/QualIcons.tsx
// 質的分析モジュール — カスタムSVGアイコン集
// 全絵文字を統一的なラインアイコンに置き換え

import type React from "react";

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const defaults = { size: 16, color: "currentColor" };

/** 概要 / ダッシュボード */
export const IconDashboard: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

/** コードブック / タグ */
export const IconCodebook: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5" />
  </svg>
);

/** マトリクス / グリッド */
export const IconMatrix: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

/** ICR / ハンドシェイク */
export const IconIcr: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 11h1a3 3 0 010 6h-1" />
    <path d="M7 11H6a3 3 0 000 6h1" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
    <path d="M10 17l2 2 2-2" />
  </svg>
);

/** 史料批判 / スクロール */
export const IconScroll: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 21h12a2 2 0 002-2v-2H10v2a2 2 0 01-2 2z" />
    <path d="M6 3a2 2 0 00-2 2v14a2 2 0 002 2h2V5a2 2 0 00-2-2z" />
    <path d="M8 3h12a2 2 0 012 2v12H8V3z" />
    <line x1="12" y1="8" x2="18" y2="8" />
    <line x1="12" y1="12" x2="16" y2="12" />
  </svg>
);

/** タイムライン / カレンダー */
export const IconTimeline: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <circle cx="12" cy="6" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="18" r="2" />
    <line x1="14" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="10" y2="12" />
    <line x1="14" y1="18" x2="20" y2="18" />
  </svg>
);

/** アクターマップ / ネットワーク */
export const IconActorMap: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="5" r="3" />
    <circle cx="5" cy="19" r="3" />
    <circle cx="19" cy="19" r="3" />
    <line x1="12" y1="8" x2="5" y2="16" />
    <line x1="12" y1="8" x2="19" y2="16" />
    <line x1="8" y1="19" x2="16" y2="19" />
  </svg>
);

/** プロセストレーシング / 検索 */
export const IconProcessTracing: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 12h4l3-9 4 18 3-9h6" />
  </svg>
);

/** 比較デザイン / 天秤 */
export const IconComparative: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="4" y1="7" x2="20" y2="7" />
    <path d="M4 7l2 8h0a4 4 0 006 0h0l2-8" />
    <path d="M14 7l2 8h0a4 4 0 006 0h0l2-8" />
    <line x1="10" y1="21" x2="14" y2="21" />
  </svg>
);

/** フレーミング / フレーム */
export const IconFraming: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <rect x="7" y="7" width="10" height="10" rx="1" />
    <line x1="3" y1="7" x2="7" y2="7" />
    <line x1="17" y1="7" x2="21" y2="7" />
    <line x1="3" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="21" y2="17" />
  </svg>
);

/** レポート / ドキュメント */
export const IconReport: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
);

/** コメント / 吹き出し */
export const IconComment: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

/** 編集 / ペンシル */
export const IconEdit: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

/** 削除 / ゴミ箱 */
export const IconDelete: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

/** チェック */
export const IconCheck: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/** 閉じる / × */
export const IconClose: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/** プラス / 追加 */
export const IconPlus: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/** シェブロン右（展開） */
export const IconChevronRight: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/** シェブロン下（展開） */
export const IconChevronDown: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** シェブロン左 */
export const IconChevronLeft: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/** インフォ / ヘルプ */
export const IconInfo: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/** クリップボードコピー */
export const IconCopy: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

/** ダウンロード / エクスポート */
export const IconExport: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/** リフレッシュ */
export const IconRefresh: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

/** フィルター */
export const IconFilter: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

/** 近似 / 波線 */
export const IconApproximate: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" className={className}>
    <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
  </svg>
);

/** パネル折りたたみ（サイドバー） */
export const IconPanelLeft: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

/** 影響力ドット (filled circle) */
export const IconDotFilled: React.FC<IconProps> = ({ size = 8, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" className={className}>
    <circle cx="5" cy="5" r="4" fill={color} />
  </svg>
);

/** 影響力ドット (empty circle) */
export const IconDotEmpty: React.FC<IconProps> = ({ size = 8, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" className={className}>
    <circle cx="5" cy="5" r="3.5" fill="none" stroke={color} strokeWidth="1" />
  </svg>
);

/** 本 / ガイド */
export const IconBook: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
);

/** コード付与（タグ＋プラス） */
export const IconAssignCode: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 3l5 5-10 10H6v-5L16 3z" />
    <line x1="19" y1="15" x2="19" y2="21" />
    <line x1="16" y1="18" x2="22" y2="18" />
  </svg>
);

/** コード解除（タグ＋マイナス） */
export const IconRemoveCode: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 3l5 5-10 10H6v-5L16 3z" />
    <line x1="16" y1="18" x2="22" y2="18" />
  </svg>
);

/** 右矢印 → */
export const IconArrowRight: React.FC<IconProps> = ({ size = 12, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/** 双方向矢印 ⟷ */
export const IconArrowBoth: React.FC<IconProps> = ({ size = 12, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
    <polyline points="12 5 5 12 12 19" />
  </svg>
);

/** 検索 */
export const IconSearch: React.FC<IconProps> = ({ size = defaults.size, color = defaults.color, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

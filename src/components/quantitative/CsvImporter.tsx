// src/components/quantitative/CsvImporter.tsx
// Stellar — CSV インポーター
// Step 1: ファイルドロップゾーン → Step 2: プレビューテーブル → Step 3: インポート実行
// 区切り文字自動検出、ヘッダー行トグル、列タイプセレクター

import type React from "react";
import { useState, useCallback, useRef, useMemo } from "react";
import { useQuantitativeStore } from "../../stores/useQuantitativeStore";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import type { VariableType } from "../../types";
import { useI18nStore } from "../../stores/useI18nStore";
import { IconChart, IconTag, IconClipboard, IconNote, IconCalendar, IconWarning } from "../ui/Icons";

// ── 変数タイプアイコン定義 ──
const VARIABLE_TYPE_OPTIONS: {
  type: VariableType;
  icon: React.ReactNode;
  label: string;
}[] = [
  { type: "scale", icon: <IconChart size={14} />, label: useI18nStore.getState().t.quantitative.k_g4muy4 },
  { type: "nominal", icon: <IconTag size={14} />, label: useI18nStore.getState().t.quantitative.k_ii97u4 },
  { type: "ordinal", icon: <IconClipboard size={14} />, label: useI18nStore.getState().t.quantitative.k_u8ggn7 },
  { type: "text", icon: <IconNote size={14} />, label: useI18nStore.getState().t.quantitative.k_6ctu6u },
  { type: "date", icon: <IconCalendar size={14} />, label: useI18nStore.getState().t.quantitative.k_hrir },
];

// ── 区切り文字選択肢 ──
const DELIMITERS = [
  { value: ",", label: useI18nStore.getState().t.quantitative.k_7d7w6 },
  { value: "\t", label: useI18nStore.getState().t.qualitative.k_8k53 },
  { value: ";", label: useI18nStore.getState().t.quantitative.k_g6st4b },
];

// ── CSV パース関数 ──
function parseCsvLine(line: string, delimiter: string): string[] {

  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(
  text: string,
  delimiter: string,
  hasHeader: boolean,
): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const allRows = lines.map((l) => parseCsvLine(l, delimiter));

  if (hasHeader) {
    const headers = allRows[0] ?? [];
    return { headers, rows: allRows.slice(1) };
  }

  const colCount = allRows[0]?.length ?? 0;
  const headers = Array.from({ length: colCount }, (_) => useI18nStore.getState().t.quantitative.k_1xvw56);
  return { headers, rows: allRows };
}

// ── 区切り文字自動検出 ──
function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = {
    ",": (firstLines.match(/,/g) ?? []).length,
    "\t": (firstLines.match(/\t/g) ?? []).length,
    ";": (firstLines.match(/;/g) ?? []).length,
  };

  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

// ── 列タイプ自動検出 ──
function detectColumnType(values: string[]): {
  type: VariableType;
  issues: number;
} {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  if (nonEmpty.length === 0) return { type: "text", issues: 0 };

  // 日付パターン
  const dateRegex =
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/;
  const dateCount = nonEmpty.filter((v) => dateRegex.test(v)).length;
  if (dateCount > nonEmpty.length * 0.8) return { type: "date", issues: 0 };

  // 数値パターン
  const numericCount = nonEmpty.filter(
    (v) => !isNaN(Number(v)) && v.trim() !== "",
  ).length;
  if (numericCount === nonEmpty.length) return { type: "scale", issues: 0 };
  if (numericCount > nonEmpty.length * 0.5)
    return { type: "scale", issues: nonEmpty.length - numericCount };

  // カテゴリ（ユニーク値が少ない場合）
  const uniqueValues = new Set(nonEmpty);
  if (uniqueValues.size <= 10 && nonEmpty.length > 5)
    return { type: "nominal", issues: 0 };

  return { type: "text", issues: 0 };
}

// ── ファイルサイズフォーマット ──
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CsvImporter: React.FC = () => {
  const selectedDataset = useQuantitativeStore((s) => s.selectedDataset);
  const importCsv = useQuantitativeStore((s) => s.importCsv);
  const setTab = useQuantitativeStore((s) => s.setTab);
  const isLoading = useQuantitativeStore((s) => s.isLoading);

  // ── ステート ──
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [columnTypes, setColumnTypes] = useState<VariableType[]>([]);
  const [editingHeaders, setEditingHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── パース結果 ──
  const parsed = useMemo(() => {
    if (!csvText) return null;
    return parseCsv(csvText, delimiter, hasHeader);
  }, [csvText, delimiter, hasHeader]);

  // ── 列の問題検出 ──
  const columnIssues = useMemo(() => {
    if (!parsed) return [];
    return parsed.headers.map((_, colIdx) => {
      const values = parsed.rows.map((r) => r[colIdx] ?? "");
      return detectColumnType(values);
    });
  }, [parsed]);

  // ── ファイル読み込みハンドラー ──
  const handleFileLoad = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvText(text);
        setFileName(file.name);
        setFileSize(file.size);

        // 区切り文字自動検出
        const detected = detectDelimiter(text);
        setDelimiter(detected);

        // パース & タイプ検出
        const result = parseCsv(text, detected, hasHeader);
        setEditingHeaders([...result.headers]);
        const types = result.headers.map((_, colIdx) => {
          const values = result.rows.map((r) => r[colIdx] ?? "");
          return detectColumnType(values).type;
        });
        setColumnTypes(types);
      };
      reader.readAsText(file);
    },
    [hasHeader],
  );

  // ── ドラッグ&ドロップ ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFileLoad(file);
    },
    [handleFileLoad],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileLoad(file);
    },
    [handleFileLoad],
  );

  // ── ヘッダー編集 ──
  const handleHeaderChange = useCallback(
    (colIdx: number, value: string) => {
      setEditingHeaders((prev) => {
        const next = [...prev];
        next[colIdx] = value;
        return next;
      });
    },
    [],
  );

  // ── タイプ変更 ──
  const handleTypeChange = useCallback(
    (colIdx: number, type: VariableType) => {
      setColumnTypes((prev) => {
        const next = [...prev];
        next[colIdx] = type;
        return next;
      });
    },
    [],
  );

  // ── インポート実行 ──
  const handleImport = useCallback(async () => {
    if (!selectedDataset || !csvText) return;

    try {
      await importCsv(selectedDataset.id, csvText, hasHeader, delimiter);
      toast.success(
        useI18nStore.getState().t.quantitative.k_wrktw3,
      );
      setTab("preview");
    } catch {
      // エラーはストアで処理済み
    }
  }, [selectedDataset, csvText, hasHeader, delimiter, importCsv, parsed, setTab]);

  // ── リセット ──
  const handleReset = useCallback(() => {
    setCsvText("");
    setFileName("");
    setFileSize(0);
    setColumnTypes([]);
    setEditingHeaders([]);
  }, []);

  const delimiterLabel =
    DELIMITERS.find((d) => d.value === delimiter)?.label ?? useI18nStore.getState().t.quantitative.k_7d7w6;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* ── Step 1: ファイルドロップゾーン ── */}
      {!csvText && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-12 cursor-pointer select-none"
          style={{
            border: isDragOver
              ? "2px solid var(--color-accent-primary)"
              : "2px dashed var(--color-border-primary)",
            borderRadius: "var(--radius-card)",
            backgroundColor: isDragOver
              ? "var(--color-bg-selection)"
              : "var(--color-bg-secondary)",
            transition: "all var(--transition-fast)",
            minHeight: "280px",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* アイコン */}
          <div
            className="flex items-center justify-center"
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              backgroundColor: "var(--color-bg-tertiary)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-accent-primary)" }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <div className="text-center">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              CSV ファイルをドラッグ＆ドロップ
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              または クリックしてファイルを選択
            </p>
            <p
              className="text-[11px] mt-3"
              style={{ color: "var(--color-text-disabled)" }}
            >
              対応形式: .csv, .tsv, .txt
            </p>
          </div>
        </div>
      )}

      {/* ── ファイル読み込み後 ── */}
      {csvText && parsed && (
        <>
          {/* ファイル情報 + 設定 */}
          <div
            className="flex items-center justify-between p-4"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border-secondary)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-button)",
                  backgroundColor: "rgba(66, 133, 244, 0.12)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "#4285f4" }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {fileName}
                </p>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {formatFileSize(fileSize)} · {parsed.rows.length}行 ·{" "}
                  {parsed.headers.length}列 · 区切り文字: {delimiterLabel}
                </p>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleReset}>
              やり直す
            </Button>
          </div>

          {/* 設定 */}
          <div className="flex items-center gap-6">
            {/* 区切り文字 */}
            <div className="flex items-center gap-2">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                区切り文字:
              </label>
              <div className="flex gap-1">
                {DELIMITERS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDelimiter(d.value)}
                    className="px-2.5 py-1 text-xs font-medium"
                    style={{
                      borderRadius: "var(--radius-button)",
                      backgroundColor:
                        delimiter === d.value
                          ? "var(--color-accent-primary)"
                          : "var(--color-bg-tertiary)",
                      color:
                        delimiter === d.value
                          ? "var(--color-text-inverse)"
                          : "var(--color-text-secondary)",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ヘッダー行 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent-primary)]"
              />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                1行目をヘッダーとして使用
              </span>
            </label>
          </div>

          {/* ── Step 2: プレビューテーブル ── */}
          <div>
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--color-text-primary)" }}
            >
              プレビュー（最初の5行）
            </h3>
            <div
              className="overflow-x-auto"
              style={{
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border-primary)",
              }}
            >
              <table className="w-full text-xs" style={{ minWidth: "600px" }}>
                {/* ヘッダー行 */}
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--color-bg-tertiary)",
                      borderBottom: "1px solid var(--color-border-primary)",
                    }}
                  >
                    <th
                      className="px-3 py-2 text-left font-medium"
                      style={{
                        color: "var(--color-text-tertiary)",
                        width: "40px",
                      }}
                    >
                      #
                    </th>
                    {(editingHeaders.length > 0
                      ? editingHeaders
                      : parsed.headers
                    ).map((header, colIdx) => {
                      const issue = columnIssues[colIdx];
                      const hasIssue = issue && issue.issues > 0;
                      return (
                        <th key={colIdx} className="px-3 py-1.5 text-left">
                          {/* 編集可能ヘッダー */}
                          <input
                            value={header}
                            onChange={(e) =>
                              handleHeaderChange(colIdx, e.target.value)
                            }
                            className="w-full text-xs font-semibold bg-transparent selectable"
                            data-selectable="true"
                            style={{
                              color: hasIssue
                                ? "var(--color-accent-warning)"
                                : "var(--color-text-primary)",
                              border: "none",
                              outline: "none",
                              padding: "2px 0",
                            }}
                          />
                          {/* タイプセレクター */}
                          <div className="mt-1">
                            <VariableTypeSelector
                              value={columnTypes[colIdx] ?? "text"}
                              onChange={(t) => handleTypeChange(colIdx, t)}
                            />
                          </div>
                          {/* 警告 */}
                          {hasIssue && (
                            <p
                              className="mt-1 text-[10px]"
                              style={{
                                color: "var(--color-accent-warning)",
                              }}
                            >
                              <IconWarning size={12} /> {issue.issues}件の値が数値に変換できません
                            </p>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* データ行（最初の5行） */}
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      style={{
                        borderBottom:
                          "1px solid var(--color-border-secondary)",
                      }}
                    >
                      <td
                        className="px-3 py-2 font-mono"
                        style={{
                          color: "var(--color-text-tertiary)",
                          fontSize: "10px",
                        }}
                      >
                        {rowIdx + 1}
                      </td>
                      {row.map((cell, colIdx) => {
                        const colType = columnTypes[colIdx] ?? "text";
                        const isNumeric =
                          colType === "scale" || colType === "ordinal";
                        return (
                          <td
                            key={colIdx}
                            className="px-3 py-2 selectable"
                            data-selectable="true"
                            style={{
                              color: cell
                                ? "var(--color-text-primary)"
                                : "var(--color-text-disabled)",
                              textAlign: isNumeric ? "right" : "left",
                              fontFamily: isNumeric
                                ? "var(--font-family-mono)"
                                : "inherit",
                            }}
                          >
                            {cell || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsed.rows.length > 5 && (
              <p
                className="text-[11px] mt-2"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                他 {parsed.rows.length - 5} 行は省略されています
              </p>
            )}
          </div>

          {/* ── Step 3: インポートボタン ── */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleImport}
              loading={isLoading}
              disabled={!selectedDataset || parsed.rows.length === 0}
            >
              データセットを作成
            </Button>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {parsed.rows.length}行 × {parsed.headers.length}列を読み込みます
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// ── VariableTypeSelector コンポーネント ──
const VariableTypeSelector: React.FC<{
  value: VariableType;
  onChange: (type: VariableType) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = VARIABLE_TYPE_OPTIONS.find((o) => o.type === value);

  // 外クリックで閉じる
  useCallback(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px]"
        style={{
          borderRadius: "4px",
          backgroundColor: "var(--color-bg-hover)",
          color: "var(--color-text-secondary)",
          transition: "all var(--transition-fast)",
        }}
      >
        <span>{current?.icon}</span>
        <span>{current?.label}</span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 py-1 animate-scale-in"
          style={{
            zIndex: "var(--z-dropdown)",
            backgroundColor: "var(--color-bg-card)",
            borderRadius: "var(--radius-button)",
            boxShadow: "var(--shadow-dropdown)",
            border: "1px solid var(--color-border-primary)",
            minWidth: "160px",
          }}
        >
          {VARIABLE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => {
                onChange(opt.type);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2"
              style={{
                color:
                  value === opt.type
                    ? "var(--color-accent-primary)"
                    : "var(--color-text-primary)",
                backgroundColor:
                  value === opt.type
                    ? "var(--color-bg-selection)"
                    : "transparent",
                transition: "background-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (value !== opt.type) {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (value !== opt.type) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

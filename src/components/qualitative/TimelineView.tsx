// src/components/qualitative/TimelineView.tsx
// タイムライン表示 — イベント一覧 + レーン別表示

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TimelineEvent, CreateTimelineEventInput } from "../../types";

interface TimelineViewProps {
  projectId: string;
}

/** 日付をパースしてYYYY-MM-DD形式に正規化 */
function parseDateInput(input: string): { date: string; dateType: string } {
  const trimmed = input.trim();
  // 完全な日付 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { date: trimmed, dateType: "exact" };
  }
  // 年月 YYYY-MM
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return { date: `${trimmed}-01`, dateType: "month" };
  }
  // 年のみ YYYY
  if (/^\d{4}$/.test(trimmed)) {
    return { date: `${trimmed}-01-01`, dateType: "year" };
  }
  // 「頃」「約」「circa」等の近似表現
  const approxMatch = trimmed.match(/(?:circa|c\.|ca\.|頃|約|~)\s*(\d{4})/i);
  if (approxMatch) {
    return { date: `${approxMatch[1]}-01-01`, dateType: "approximate" };
  }
  // フォールバック
  return { date: trimmed, dateType: "exact" };
}

const IMPORTANCE_COLORS = ["#94a3b8", "#60a5fa", "#f59e0b", "#ef4444", "#dc2626"];
const EVENT_TYPES = [
  { value: "political", label: "政治" },
  { value: "economic", label: "経済" },
  { value: "social", label: "社会" },
  { value: "military", label: "軍事" },
  { value: "cultural", label: "文化" },
  { value: "diplomatic", label: "外交" },
  { value: "other", label: "その他" },
];

export const TimelineView: React.FC<TimelineViewProps> = ({ projectId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [lanes, setLanes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterLane, setFilterLane] = useState<string | null>(null);

  // フォーム
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [eventType, setEventType] = useState("political");
  const [importance, setImportance] = useState(3);
  const [lane, setLane] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const [eventList, laneList] = await Promise.all([
        invoke<TimelineEvent[]>("get_timeline_events", { projectId }),
        invoke<string[]>("get_timeline_lanes", { projectId }),
      ]);
      setEvents(eventList);
      setLanes(laneList);
    } catch (err) {
      console.error("タイムライン取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !dateInput.trim()) return;
    const parsed = parseDateInput(dateInput);
    try {
      const input: CreateTimelineEventInput = {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        eventDate: parsed.date,
        dateType: parsed.dateType,
        eventType,
        importance,
        lane: lane.trim() || undefined,
      };
      await invoke("create_timeline_event", { input });
      setTitle("");
      setDescription("");
      setDateInput("");
      setLane("");
      setShowForm(false);
      void loadEvents();
    } catch (err) {
      console.error("イベント作成エラー:", err);
    }
  }, [title, description, dateInput, eventType, importance, lane, projectId, loadEvents]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("このイベントを削除しますか？")) return;
      try {
        await invoke("delete_timeline_event", { id });
        void loadEvents();
      } catch (err) {
        console.error("イベント削除エラー:", err);
      }
    },
    [loadEvents]
  );

  const filteredEvents = filterLane
    ? events.filter((e) => e.lane === filterLane)
    : events;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">読み込み中…</span>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          タイムライン ({events.length}件)
        </h3>
        <div className="flex items-center gap-2">
          {/* レーンフィルタ */}
          {lanes.length > 0 && (
            <select
              value={filterLane ?? ""}
              onChange={(e) => setFilterLane(e.target.value || null)}
              className="text-xs px-2 py-1"
              style={{
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "4px",
              }}
            >
              <option value="">全レーン</option>
              {lanes.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            + イベント追加
          </button>
        </div>
      </div>

      {/* 新規フォーム */}
      {showForm && (
        <div
          className="mb-4 p-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "10px",
            border: "1px solid var(--color-border-primary)",
          }}
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>タイトル *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-2 py-1.5"
                style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>
                日付 * <span style={{ fontSize: "10px" }}>(YYYY, YYYY-MM, YYYY-MM-DD, circa YYYY)</span>
              </label>
              <input
                type="text"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                placeholder="例: 1945, 1945-08, circa 1920"
                className="w-full text-xs px-2 py-1.5"
                style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none" }}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-xs px-2 py-1.5"
              style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none", resize: "vertical" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>種別</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full text-xs px-2 py-1.5"
                style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px" }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>重要度 ({importance})</label>
              <input
                type="range"
                min={1}
                max={5}
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>レーン</label>
              <input
                type="text"
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                placeholder="国内, 国際, …"
                className="w-full text-xs px-2 py-1.5"
                style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "6px", outline: "none" }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="text-xs px-3 py-1.5"
              style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5"
              style={{ backgroundColor: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "6px", cursor: "pointer" }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* タイムライン表示 */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          イベントなし。上のボタンで追加してください。
        </div>
      ) : (
        <div className="relative" style={{ paddingLeft: "24px" }}>
          {/* タイムラインの縦線 */}
          <div
            style={{
              position: "absolute",
              left: "8px",
              top: "8px",
              bottom: "8px",
              width: "2px",
              backgroundColor: "var(--color-border-primary)",
            }}
          />

          {filteredEvents.map((event) => (
            <div key={event.id} className="relative mb-4 group">
              {/* ドット */}
              <div
                style={{
                  position: "absolute",
                  left: "-20px",
                  top: "8px",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: IMPORTANCE_COLORS[event.importance - 1] ?? IMPORTANCE_COLORS[2],
                  border: "2px solid var(--color-bg-primary)",
                }}
              />

              <div
                className="p-3"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-primary)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {event.title}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5"
                        style={{
                          backgroundColor: "var(--color-bg-tertiary)",
                          color: "var(--color-text-tertiary)",
                          borderRadius: "999px",
                          fontSize: "10px",
                        }}
                      >
                        {EVENT_TYPES.find((t) => t.value === event.eventType)?.label ?? event.eventType}
                      </span>
                      {event.dateType !== "exact" && (
                        <span
                          className="text-xs px-1 py-0.5"
                          style={{
                            backgroundColor: "#f59e0b20",
                            color: "#f59e0b",
                            borderRadius: "3px",
                            fontSize: "9px",
                          }}
                        >
                          {event.dateType === "approximate" ? "≈推定" : event.dateType === "year" ? "年のみ" : "月まで"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                      {event.eventDate}
                      {event.lane && <span> · {event.lane}</span>}
                    </div>
                    {event.description && (
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(event.id)}
                    className="text-xs opacity-0 group-hover:opacity-100"
                    style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

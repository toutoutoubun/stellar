// src/components/qualitative/TimelineView.tsx
// タイムライン表示 — イベント一覧 + レーン別表示
// ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type { TimelineEvent, CreateTimelineEventInput } from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import { IconPlus, IconDelete, IconClose, IconFilter, IconApproximate, IconTimeline } from "./icons/QualIcons";
import { useT, useI18nStore } from "../../stores/useI18nStore";

interface TimelineViewProps {
  projectId: string;
}

/** 日付をパースしてYYYY-MM-DD形式に正規化 */
function parseDateInput(input: string): { date: string; dateType: string } {

  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { date: trimmed, dateType: "exact" };
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return { date: `${trimmed}-01`, dateType: "month" };
  }
  if (/^\d{4}$/.test(trimmed)) {
    return { date: `${trimmed}-01-01`, dateType: "year" };
  }
  const approxMatch = trimmed.match(/(?:circa|c\.|ca\.|頃|約|~)\s*(\d{4})/i);
  if (approxMatch) {
    return { date: `${approxMatch[1]}-01-01`, dateType: "approximate" };
  }
  return { date: trimmed, dateType: "exact" };
}

const IMPORTANCE_COLORS = ["#94a3b8", "#60a5fa", "#f59e0b", "#ef4444", "#dc2626"];
const EVENT_TYPES = [
  { value: "political", label: useI18nStore.getState().t.qualitative.k_htgc },
  { value: "economic", label: useI18nStore.getState().t.qualitative.k_lwzg },
  { value: "social", label: useI18nStore.getState().t.qualitative.k_l21o },
  { value: "military", label: useI18nStore.getState().t.qualitative.k_opy6 },
  { value: "cultural", label: useI18nStore.getState().t.qualitative.k_hq3z },
  { value: "diplomatic", label: useI18nStore.getState().t.qualitative.k_fl1q },
  { value: "other", label: useI18nStore.getState().t.notes.k_7bosl },
];

export const TimelineView: React.FC<TimelineViewProps> = ({ projectId }) => {
  const t = useT();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [lanes, setLanes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterLane, setFilterLane] = useState<string | null>(null);

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
      console.error(t.qualitative.k_cf40rh, err);
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
      console.error(t.qualitative.k_hv8kd, err);
    }
  }, [title, description, dateInput, eventType, importance, lane, projectId, loadEvents]);

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_fl25x8, t.qualitative.k_s63uzj);
      if (!ok) return;
      try {
        await invoke("delete_timeline_event", { id });
        void loadEvents();
      } catch (err) {
        console.error(t.qualitative.k_81kqt9, err);
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
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <HelpTooltip
        storageKey="qual_timeline"
        title={t.qualitative.k_4hz4rn}
        paragraphs={[
          t.qualitative.k_ozqu7r,
          t.qualitative.k_kaa8vx,
        ]}
        steps={[
          t.qualitative.k_bi9eok,
          t.qualitative.k_ck6sbu,
          t.qualitative.k_9s00cq,
        ]}
      />

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          タイムライン ({events.length}件)
        </h3>
        <div className="flex items-center gap-2">
          {lanes.length > 0 && (
            <div className="inline-flex items-center gap-1">
              <IconFilter size={11} color="var(--color-text-tertiary)" />
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
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1 inline-flex items-center gap-1"
            style={{
              backgroundColor: "var(--color-accent-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <IconPlus size={10} />
            イベント追加
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
                placeholder={t.qualitative.k_3wgn3i}
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
                placeholder={t.qualitative.k_g611b4}
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
              className="text-xs px-3 py-1.5 inline-flex items-center gap-1"
              style={{ backgroundColor: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: "6px", cursor: "pointer" }}
            >
              <IconClose size={10} />
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* タイムライン表示 */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: "var(--color-text-tertiary)" }}>
          <IconTimeline size={28} />
          <span className="text-xs">イベントなし。上のボタンで追加してください。</span>
        </div>
      ) : (
        <div className="relative" style={{ paddingLeft: "24px" }}>
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
                          className="text-xs px-1 py-0.5 inline-flex items-center gap-0.5"
                          style={{
                            backgroundColor: "#f59e0b20",
                            color: "#f59e0b",
                            borderRadius: "3px",
                            fontSize: "9px",
                          }}
                        >
                          <IconApproximate size={8} color="#f59e0b" />
                          {event.dateType === "approximate" ? t.qualitative.k_hgc2 : event.dateType === "year" ? t.qualitative.k_e2jwl : t.qualitative.k_fbsmp}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                      {event.eventDate}
                      {event.lane && <span> / {event.lane}</span>}
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
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                    title={t.common.delete}
                    style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
                  >
                    <IconDelete size={12} />
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

// src/components/qualitative/ActorMapView.tsx
// アクターマップ — アクター一覧 + 関係性管理
// 折りたたみパネル / ミニマルUI / カスタムアイコン / ヘルプ付き

import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/tauriShim";
import { swalConfirm } from "../../lib/swal";
import type {
  Actor,
  ActorRelation,
  ActorMapData,
  CreateActorInput,
  CreateActorRelationInput,
} from "../../types";
import { HelpTooltip } from "./HelpTooltip";
import {
  IconPlus,
  IconDelete,
  IconClose,
  IconPanelLeft,
  IconDotFilled,
  IconDotEmpty,
  IconArrowRight,
  IconArrowBoth,
  IconActorMap,
} from "./icons/QualIcons";
import { useT, useI18nStore } from "../../stores/useI18nStore";

interface ActorMapViewProps {
  projectId: string;
}

const ACTOR_TYPES = [
  { value: "state", label: useI18nStore.getState().t.qualitative.k_fas9 },
  { value: "organization", label: useI18nStore.getState().t.qualitative.k_m00g },
  { value: "individual", label: useI18nStore.getState().t.qualitative.k_e1ov },
  { value: "group", label: useI18nStore.getState().t.qualitative.k_q4f1 },
  { value: "institution", label: useI18nStore.getState().t.qualitative.k_ei40 },
  { value: "other", label: useI18nStore.getState().t.notes.k_7bosl },
];

const RELATION_TYPES = [
  { value: "alliance", label: useI18nStore.getState().t.qualitative.k_ey4z },
  { value: "conflict", label: useI18nStore.getState().t.qualitative.k_gbkd },
  { value: "cooperation", label: useI18nStore.getState().t.qualitative.k_emkn },
  { value: "dependency", label: useI18nStore.getState().t.qualitative.k_e1jv },
  { value: "influence", label: useI18nStore.getState().t.qualitative.k_h2ge },
  { value: "negotiation", label: useI18nStore.getState().t.qualitative.k_dzad },
  { value: "other", label: useI18nStore.getState().t.notes.k_7bosl },
];

const RELATION_COLORS: Record<string, string> = {
  alliance: "#22c55e",
  conflict: "#ef4444",
  cooperation: "#3b82f6",
  dependency: "#f59e0b",
  influence: "#8b5cf6",
  negotiation: "#06b6d4",
  other: "#94a3b8",
};

export const ActorMapView: React.FC<ActorMapViewProps> = ({ projectId }) => {
  const t = useT();
  const [actors, setActors] = useState<Actor[]>([]);
  const [relations, setRelations] = useState<ActorRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActorForm, setShowActorForm] = useState(false);
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [actorPanelCollapsed, setActorPanelCollapsed] = useState(false);

  // アクターフォーム
  const [actorName, setActorName] = useState("");
  const [actorType, setActorType] = useState("state");
  const [actorPosition, _setActorPosition] = useState("neutral"); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [actorInfluence, setActorInfluence] = useState(3);
  const [actorDescription, setActorDescription] = useState("");

  // 関係フォーム
  const [relFrom, setRelFrom] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relType, setRelType] = useState("alliance");
  const [relDescription, setRelDescription] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<ActorMapData>("get_actor_map", { projectId });
      setActors(Array.isArray(data?.actors) ? data.actors : []);
      setRelations(Array.isArray(data?.relations) ? data.relations : []);
    } catch (err) {
      console.error(t.qualitative.k_2ssr3c, err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data sync/fetch pattern
    void loadData();
  }, [loadData]);

  const handleCreateActor = useCallback(async () => {
    if (!actorName.trim()) return;
    try {
      const input: CreateActorInput = {
        projectId,
        name: actorName.trim(),
        actorType,
        position: actorPosition,
        influence: actorInfluence,
        description: actorDescription.trim() || undefined,
      };
      await invoke("create_actor", { input });
      setActorName("");
      setActorDescription("");
      setShowActorForm(false);
      void loadData();
    } catch (err) {
      console.error(t.qualitative.k_toxtwd, err);
    }
  }, [actorName, actorType, actorPosition, actorInfluence, actorDescription, projectId, loadData]);

  /** アクターを更新する */
  const handleUpdateActor = useCallback(
    async (id: string, updates: Partial<Pick<Actor, "name" | "actorType" | "position" | "influence" | "description">>) => {
      try {
        await invoke("update_actor", { id, updates });
        void loadData();
      } catch (err) {
        console.error("Failed to update actor:", err);
      }
    },
    [loadData],
  );

  const handleDeleteActor = useCallback(
    async (id: string) => {
      const ok = await swalConfirm(t.qualitative.k_h74we4, t.qualitative.k_sqto2n);
      if (!ok) return;
      try {
        await invoke("delete_actor", { id });
        void loadData();
      } catch (err) {
        console.error(t.qualitative.k_l5huir, err);
      }
    },
    [loadData]
  );

  const handleCreateRelation = useCallback(async () => {
    if (!relFrom || !relTo || relFrom === relTo) return;
    try {
      const input: CreateActorRelationInput = {
        actorFrom: relFrom,
        actorTo: relTo,
        relationType: relType,
        description: relDescription.trim() || undefined,
      };
      await invoke("create_actor_relation", { input });
      setRelFrom("");
      setRelTo("");
      setRelDescription("");
      setShowRelationForm(false);
      void loadData();
    } catch (err) {
      console.error(t.qualitative.k_be3j59, err);
    }
  }, [relFrom, relTo, relType, relDescription, loadData]);

  const handleDeleteRelation = useCallback(
    async (id: string) => {
      try {
        await invoke("delete_actor_relation", { id });
        void loadData();
      } catch (err) {
        console.error(t.qualitative.k_jxjiiv, err);
      }
    },
    [loadData]
  );

  const getActorName = (id: string) => actors.find((a) => a.id === id)?.name ?? id;

  /** 影響力ドットを SVG アイコンで描画 */
  const renderInfluenceDots = (influence: number) => {
    const dots = [];
    for (let i = 0; i < 5; i++) {
      if (i < influence) {
        dots.push(<IconDotFilled key={i} size={7} color="var(--color-accent-primary)" />);
      } else {
        dots.push(<IconDotEmpty key={i} size={7} color="var(--color-text-tertiary)" />);
      }
    }
    return <span className="inline-flex items-center gap-0.5">{dots}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
        <span className="text-sm">{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: アクター一覧 */}
      <div
        className="flex flex-col shrink-0 h-full"
        style={{
          width: actorPanelCollapsed ? "40px" : "300px",
          borderRight: "1px solid var(--color-border-primary)",
          transition: "width 150ms ease-out",
          overflow: "hidden",
        }}
      >
        <header
          className="flex items-center justify-between px-2 shrink-0"
          style={{ height: "40px", borderBottom: "1px solid var(--color-border-primary)" }}
        >
          {!actorPanelCollapsed && (
            <>
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
                アクター ({actors.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowActorForm(!showActorForm)}
                  className="text-xs inline-flex items-center gap-0.5"
                  style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  <IconPlus size={10} />
                  追加
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setActorPanelCollapsed(!actorPanelCollapsed)}
            title={actorPanelCollapsed ? t.qualitative.k_gixi : t.qualitative.k_yczceq}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px", display: "flex" }}
          >
            <IconPanelLeft size={13} />
          </button>
        </header>

        {!actorPanelCollapsed && (
          <div className="flex-1 overflow-y-auto p-2">
            {showActorForm && (
              <div className="mb-3 p-2" style={{ backgroundColor: "var(--color-bg-tertiary)", borderRadius: "8px" }}>
                <input
                  type="text"
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  placeholder={t.qualitative.k_gldv4t}
                  className="w-full text-xs px-2 py-1 mb-1"
                  style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px", outline: "none" }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreateActor(); }}
                  autoFocus
                />
                <select
                  value={actorType}
                  onChange={(e) => setActorType(e.target.value)}
                  className="w-full text-xs px-2 py-1 mb-1"
                  style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px" }}
                >
                  {ACTOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs" style={{ color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>影響力: {actorInfluence}</label>
                  <input type="range" min={1} max={5} value={actorInfluence} onChange={(e) => setActorInfluence(Number(e.target.value))} style={{ flex: 1 }} />
                </div>
                <textarea
                  value={actorDescription}
                  onChange={(e) => setActorDescription(e.target.value)}
                  placeholder={t.qualitative.k_knmvip}
                  rows={2}
                  className="w-full text-xs px-2 py-1 mb-1"
                  style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px", outline: "none", resize: "vertical" }}
                />
                <div className="flex gap-1">
                  <button type="button" onClick={() => void handleCreateActor()} className="flex-1 text-xs py-1" style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>追加</button>
                  <button type="button" onClick={() => setShowActorForm(false)} title={t.common.cancel} style={{ background: "transparent", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px 8px" }}>
                    <IconClose size={10} />
                  </button>
                </div>
              </div>
            )}

            {actors.map((actor) => (
              <div
                key={actor.id}
                className="p-2 mb-1 group"
                style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "6px", border: "1px solid var(--color-border-secondary)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5"
                      style={{ backgroundColor: "var(--color-bg-tertiary)", borderRadius: "4px", color: "var(--color-text-tertiary)", fontSize: "10px" }}
                    >
                      {ACTOR_TYPES.find((t) => t.value === actor.actorType)?.label ?? actor.actorType}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--color-text-primary)", cursor: "pointer" }}
                      title="ダブルクリックで名前を編集"
                      onDoubleClick={() => {
                        const newName = window.prompt("アクター名を編集", actor.name);
                        if (newName && newName.trim() && newName.trim() !== actor.name) {
                          void handleUpdateActor(actor.id, { name: newName.trim() });
                        }
                      }}
                    >{actor.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {renderInfluenceDots(actor.influence)}
                    <button
                      type="button"
                      onClick={() => void handleDeleteActor(actor.id)}
                      className="opacity-0 group-hover:opacity-100"
                      title={t.common.delete}
                      style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
                    >
                      <IconDelete size={11} />
                    </button>
                  </div>
                </div>
                {actor.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>{actor.description}</p>
                )}
              </div>
            ))}

            {actors.length === 0 && !showActorForm && (
              <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: "var(--color-text-tertiary)" }}>
                <IconActorMap size={24} />
                <span className="text-xs">アクターなし</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右: 関係性一覧 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="flex items-center justify-between px-3 shrink-0"
          style={{ height: "40px", borderBottom: "1px solid var(--color-border-primary)" }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
            関係性 ({relations.length})
          </span>
          <button
            type="button"
            onClick={() => setShowRelationForm(!showRelationForm)}
            className="text-xs inline-flex items-center gap-0.5"
            style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
            disabled={actors.length < 2}
          >
            <IconPlus size={10} />
            追加
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          <HelpTooltip
            storageKey="qual_actor_map"
            title={t.qualitative.k_cfq70y}
            paragraphs={[
              t.qualitative.k_q1y7l5,
              t.qualitative.k_l0laf9,
            ]}
            steps={[
              t.qualitative.k_daj0e,
              t.qualitative.k_q66x06,
              t.qualitative.k_ceo538,
            ]}
          />

          {showRelationForm && actors.length >= 2 && (
            <div className="mb-4 p-3" style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "8px", border: "1px solid var(--color-border-primary)" }}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>From</label>
                  <select value={relFrom} onChange={(e) => setRelFrom(e.target.value)} className="w-full text-xs px-2 py-1" style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px" }}>
                    <option value="">{t.qualitative.k_select_placeholder}</option>
                    {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--color-text-tertiary)" }}>To</label>
                  <select value={relTo} onChange={(e) => setRelTo(e.target.value)} className="w-full text-xs px-2 py-1" style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px" }}>
                    <option value="">{t.qualitative.k_select_placeholder}</option>
                    {actors.filter((a) => a.id !== relFrom).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <select value={relType} onChange={(e) => setRelType(e.target.value)} className="w-full text-xs px-2 py-1 mb-2" style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px" }}>
                {RELATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="text" value={relDescription} onChange={(e) => setRelDescription(e.target.value)} placeholder={t.qualitative.k_knmvip} className="w-full text-xs px-2 py-1 mb-2" style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-primary)", borderRadius: "4px", outline: "none" }} />
              <div className="flex gap-1">
                <button type="button" onClick={() => void handleCreateRelation()} className="text-xs px-3 py-1" style={{ backgroundColor: "var(--color-accent-primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>追加</button>
                <button type="button" onClick={() => setShowRelationForm(false)} className="text-xs px-2 py-1 inline-flex items-center gap-1" style={{ background: "transparent", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: "4px", cursor: "pointer" }}>
                  <IconClose size={10} />
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {relations.length === 0 ? (
            <div className="text-center py-12 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              関係性なし。{actors.length < 2 ? t.qualitative.k_gfmofz : t.qualitative.k_ajt591}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {relations.map((rel) => {
                const relColor = RELATION_COLORS[rel.relationType] ?? "#94a3b8";
                return (
                  <div
                    key={rel.id}
                    className="flex items-center gap-3 p-2 group"
                    style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "6px", border: "1px solid var(--color-border-secondary)" }}
                  >
                    <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {getActorName(rel.actorFrom)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 inline-flex items-center gap-1"
                      style={{
                        backgroundColor: relColor + "20",
                        color: relColor,
                        borderRadius: "999px",
                        fontSize: "10px",
                      }}
                    >
                      {RELATION_TYPES.find((t) => t.value === rel.relationType)?.label ?? rel.relationType}
                      {rel.relationType === "conflict" ? (
                        <IconArrowBoth size={10} color={relColor} />
                      ) : (
                        <IconArrowRight size={10} color={relColor} />
                      )}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {getActorName(rel.actorTo)}
                    </span>
                    {rel.description && (
                      <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-tertiary)" }}>
                        {rel.description}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteRelation(rel.id)}
                      className="opacity-0 group-hover:opacity-100 shrink-0"
                      title={t.common.delete}
                      style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: "2px" }}
                    >
                      <IconDelete size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

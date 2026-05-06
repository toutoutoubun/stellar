// src/components/qualitative/ActorMapView.tsx
// アクターマップ — react-force-graph-2d でアクター関係をネットワーク図として表示
// Rust backend: get_actor_map → { actors, relations }, create_actor(input), create_actor_relation(input)

import type React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ForceGraph2D from "react-force-graph-2d";
import type {
  Actor,
  ActorRelation,
  ActorMapData,
  CreateActorInput,
  CreateActorRelationInput,
} from "../../types";
import { toast } from "../ui/Toast";

interface ActorMapViewProps {
  projectId: string;
}

const RELATION_COLORS: Record<string, string> = {
  alliance: "#10b981",
  conflict: "#ef4444",
  hierarchy: "#6366f1",
  information: "#3b82f6",
  influence: "#f59e0b",
  cooperation: "#059669",
  default: "#94a3b8",
};

const RELATION_LABELS: Record<string, string> = {
  alliance: "同盟",
  conflict: "対立",
  hierarchy: "上下",
  information: "情報",
  influence: "影響",
  cooperation: "協力",
};

export const ActorMapView: React.FC<ActorMapViewProps> = ({ projectId }) => {
  const [actors, setActors] = useState<Actor[]>([]);
  const [relations, setRelations] = useState<ActorRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActorForm, setShowActorForm] = useState(false);
  const [showRelForm, setShowRelForm] = useState(false);

  // フォーム
  const [actorForm, setActorForm] = useState({
    name: "",
    actorType: "state",
    position: "neutral",
    influence: 3,
    level: "national",
    description: "",
  });
  const [relForm, setRelForm] = useState({
    actorFrom: "",
    actorTo: "",
    relationType: "alliance",
    description: "",
    startYear: "" as string,
    endYear: "" as string,
  });

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await invoke<ActorMapData>("get_actor_map", { projectId });
      setActors(data.actors);
      setRelations(data.relations);
    } catch (e) {
      console.error("Failed to load actor data:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const graphData = useMemo(() => {
    const nodes = actors.map((a) => ({
      id: a.id,
      name: a.name,
      actorType: a.actorType,
      val: 3 + relations.filter((r) => r.actorFrom === a.id || r.actorTo === a.id).length,
    }));
    const links = relations.map((r) => ({
      source: r.actorFrom,
      target: r.actorTo,
      relationType: r.relationType,
      label: RELATION_LABELS[r.relationType] ?? r.relationType,
      color: RELATION_COLORS[r.relationType] ?? RELATION_COLORS.default,
    }));
    return { nodes, links };
  }, [actors, relations]);

  const handleCreateActor = useCallback(async () => {
    if (!projectId || !actorForm.name.trim()) {
      toast.error("名前を入力してください");
      return;
    }
    try {
      const input: CreateActorInput = {
        projectId,
        name: actorForm.name.trim(),
        actorType: actorForm.actorType,
        position: actorForm.position,
        influence: actorForm.influence,
        level: actorForm.level,
        description: actorForm.description || null,
      };
      await invoke("create_actor", { input });
      setActorForm({ name: "", actorType: "state", position: "neutral", influence: 3, level: "national", description: "" });
      setShowActorForm(false);
      toast.success("アクターを追加しました");
      await loadData();
    } catch (e) {
      toast.error("追加に失敗しました");
    }
  }, [projectId, actorForm, loadData]);

  const handleCreateRelation = useCallback(async () => {
    if (!relForm.actorFrom || !relForm.actorTo) {
      toast.error("起点と終点のアクターを選択してください");
      return;
    }
    try {
      const input: CreateActorRelationInput = {
        actorFrom: relForm.actorFrom,
        actorTo: relForm.actorTo,
        relationType: relForm.relationType,
        description: relForm.description || null,
        startYear: relForm.startYear ? parseInt(relForm.startYear, 10) : null,
        endYear: relForm.endYear ? parseInt(relForm.endYear, 10) : null,
      };
      await invoke("create_actor_relation", { input });
      setRelForm({ actorFrom: "", actorTo: "", relationType: "alliance", description: "", startYear: "", endYear: "" });
      setShowRelForm(false);
      toast.success("関係を追加しました");
      await loadData();
    } catch (e) {
      toast.error("追加に失敗しました");
    }
  }, [relForm, loadData]);

  const handleDeleteActor = async (id: string) => {
    if (!confirm("このアクターを削除しますか？")) return;
    try {
      await invoke("delete_actor", { id });
      toast.success("削除しました");
      await loadData();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  const handleDeleteRelation = async (id: string) => {
    try {
      await invoke("delete_actor_relation", { id });
      toast.success("関係を削除しました");
      await loadData();
    } catch (e) {
      toast.error("削除に失敗しました");
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-bg-tertiary)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border-secondary)",
    borderRadius: "6px",
    padding: "6px 10px",
    outline: "none",
    width: "100%",
    fontSize: "13px",
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左: グラフ */}
      <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: "var(--color-bg-primary)" }}>
        {actors.length > 0 ? (
          <ForceGraph2D
            graphData={graphData}
            nodeLabel={(node: any) => `${node.name} (${node.actorType})`}
            nodeColor={() => "var(--color-accent-primary)"}
            nodeRelSize={5}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = Math.max(10 / globalScale, 3);
              ctx.font = `${fontSize}px sans-serif`;
              ctx.fillStyle = "#6366f1";
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val * 1.5, 0, 2 * Math.PI);
              ctx.fill();
              ctx.fillStyle = "#1e293b";
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillText(label, node.x, node.y + node.val * 1.5 + 2);
            }}
            linkColor={(link: any) => link.color ?? "#94a3b8"}
            linkWidth={1.5}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            linkLabel={(link: any) => link.label}
            backgroundColor="transparent"
            width={800}
            height={500}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: "var(--color-text-tertiary)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }}>
              <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
            </svg>
            <p className="text-sm mt-2">アクターを追加してネットワーク図を作成しましょう</p>
          </div>
        )}
      </div>

      {/* 右: パネル */}
      <div
        className="flex flex-col h-full overflow-y-auto"
        style={{
          width: "300px",
          borderLeft: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <div className="p-3" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            アクターマップ
          </h3>
        </div>

        {/* アクター追加 */}
        <div className="p-3" style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              アクター ({actors.length})
            </span>
            <button
              onClick={() => setShowActorForm(!showActorForm)}
              className="text-xs"
              style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
            >
              {showActorForm ? "閉じる" : "+ 追加"}
            </button>
          </div>

          {showActorForm && (
            <div className="flex flex-col gap-2 mb-2">
              <input type="text" value={actorForm.name} onChange={(e) => setActorForm({ ...actorForm, name: e.target.value })} style={inputStyle} placeholder="名前 *" />
              <select value={actorForm.actorType} onChange={(e) => setActorForm({ ...actorForm, actorType: e.target.value })} style={inputStyle}>
                <option value="state">国家</option>
                <option value="organization">組織</option>
                <option value="individual">個人</option>
                <option value="group">グループ</option>
                <option value="institution">機関</option>
              </select>
              <select value={actorForm.position} onChange={(e) => setActorForm({ ...actorForm, position: e.target.value })} style={inputStyle}>
                <option value="supportive">賛成</option>
                <option value="neutral">中立</option>
                <option value="opposed">反対</option>
              </select>
              <div className="flex gap-1 items-center">
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>影響力:</span>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setActorForm({ ...actorForm, influence: v })} className="text-xs px-1.5 py-0.5" style={{ backgroundColor: actorForm.influence === v ? "var(--color-accent-primary)" : "var(--color-bg-tertiary)", color: actorForm.influence === v ? "white" : "var(--color-text-secondary)", borderRadius: "4px", border: "none", cursor: "pointer" }}>{v}</button>
                ))}
              </div>
              <input type="text" value={actorForm.description} onChange={(e) => setActorForm({ ...actorForm, description: e.target.value })} style={inputStyle} placeholder="説明（任意）" />
              <button onClick={handleCreateActor} className="text-xs py-1 px-3" style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}>追加</button>
            </div>
          )}

          {/* アクター一覧 */}
          <div className="flex flex-col gap-1">
            {actors.map((a) => (
              <div key={a.id} className="flex items-center justify-between group text-xs px-2 py-1" style={{ borderRadius: "4px" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ color: "var(--color-text-primary)" }}>
                  {a.name}
                  <span className="ml-1" style={{ color: "var(--color-text-tertiary)" }}>({a.actorType})</span>
                </span>
                <button onClick={() => handleDeleteActor(a.id)} className="opacity-0 group-hover:opacity-100" style={{ color: "#ef4444", transition: "opacity 0.15s", background: "none", border: "none", cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* 関係追加 */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              関係 ({relations.length})
            </span>
            <button
              onClick={() => setShowRelForm(!showRelForm)}
              className="text-xs"
              style={{ color: "var(--color-accent-primary)", background: "none", border: "none", cursor: "pointer" }}
            >
              {showRelForm ? "閉じる" : "+ 追加"}
            </button>
          </div>

          {showRelForm && (
            <div className="flex flex-col gap-2 mb-2">
              <select value={relForm.actorFrom} onChange={(e) => setRelForm({ ...relForm, actorFrom: e.target.value })} style={inputStyle}>
                <option value="">起点アクター</option>
                {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={relForm.actorTo} onChange={(e) => setRelForm({ ...relForm, actorTo: e.target.value })} style={inputStyle}>
                <option value="">終点アクター</option>
                {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={relForm.relationType} onChange={(e) => setRelForm({ ...relForm, relationType: e.target.value })} style={inputStyle}>
                <option value="alliance">同盟</option>
                <option value="conflict">対立</option>
                <option value="hierarchy">上下</option>
                <option value="information">情報</option>
                <option value="influence">影響</option>
                <option value="cooperation">協力</option>
              </select>
              <input type="text" value={relForm.description} onChange={(e) => setRelForm({ ...relForm, description: e.target.value })} style={inputStyle} placeholder="説明（任意）" />
              <button onClick={handleCreateRelation} className="text-xs py-1 px-3" style={{ backgroundColor: "var(--color-accent-primary)", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}>追加</button>
            </div>
          )}

          {/* 関係一覧 */}
          <div className="flex flex-col gap-1">
            {relations.map((r) => {
              const src = actors.find((a) => a.id === r.actorFrom);
              const tgt = actors.find((a) => a.id === r.actorTo);
              return (
                <div key={r.id} className="flex items-center justify-between group text-xs px-2 py-1" style={{ borderRadius: "4px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {src?.name ?? "?"} → {tgt?.name ?? "?"}{" "}
                    <span style={{ color: RELATION_COLORS[r.relationType] ?? RELATION_COLORS.default }}>
                      [{RELATION_LABELS[r.relationType] ?? r.relationType}]
                    </span>
                  </span>
                  <button onClick={() => handleDeleteRelation(r.id)} className="opacity-0 group-hover:opacity-100" style={{ color: "#ef4444", transition: "opacity 0.15s", background: "none", border: "none", cursor: "pointer" }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActorMapView;

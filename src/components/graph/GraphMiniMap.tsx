// src/components/graph/GraphMiniMap.tsx
// Stellar — グラフミニマップ（右下オーバーレイ）
// 200px × 150px のキャンバスにグラフ全体の縮小表示を描画
// ビューポート矩形を表示し、クリックでパン移動も可能

import type React from "react";
import { useRef, useEffect, useCallback } from "react";
import type { GraphNodeExtended, GraphLink } from "../../types";

interface GraphMiniMapProps {
  /** 表示するノード */
  nodes: GraphNodeExtended[];
  /** 表示するリンク */
  links: GraphLink[];
  /** 選択中ノードID */
  selectedNodeId: string | null;
  /** ミニマップ幅 */
  width?: number;
  /** ミニマップ高さ */
  height?: number;
  /** ビューポートのバウンディングボックス（メイングラフのスクリーン座標系） */
  viewportBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /** ミニマップクリック → グラフ中心をその座標に移動 */
  onCenterAt?: (x: number, y: number) => void;
}

/** CSS変数取得 */
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export const GraphMiniMap: React.FC<GraphMiniMapProps> = ({
  nodes,
  links,
  selectedNodeId,
  width = 200,
  height = 150,
  viewportBounds = null,
  onCenterAt,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** ノードの座標範囲を計算 */
  const getBounds = useCallback(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return { minX: -50, maxX: 50, minY: -50, maxY: 50 };
    }

    // パディング追加
    const padX = (maxX - minX) * 0.15 || 50;
    const padY = (maxY - minY) * 0.15 || 50;

    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [nodes]);

  /** ミニマップ描画 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 背景
    const bgColor = getCSSVar("--color-bg-secondary") || "#f8f9fa";
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    if (nodes.length === 0) return;

    const bounds = getBounds();
    const boundsW = bounds.maxX - bounds.minX;
    const boundsH = bounds.maxY - bounds.minY;

    // スケール計算（アスペクト比維持）
    const scaleX = (width - 16) / boundsW;
    const scaleY = (height - 16) / boundsH;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (width - boundsW * scale) / 2;
    const offsetY = (height - boundsH * scale) / 2;

    /** グラフ座標 → ミニマップ座標 */
    const toMiniX = (gx: number) => (gx - bounds.minX) * scale + offsetX;
    const toMiniY = (gy: number) => (gy - bounds.minY) * scale + offsetY;

    // エッジ描画
    const edgeColor = getCSSVar("--color-graph-edge") || "#dee2e6";
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;

    for (const link of links) {
      const src =
        typeof link.source === "string"
          ? nodes.find((n) => n.id === link.source)
          : (link.source as unknown as GraphNodeExtended);
      const tgt =
        typeof link.target === "string"
          ? nodes.find((n) => n.id === link.target)
          : (link.target as unknown as GraphNodeExtended);

      if (src?.x == null || src.y == null || tgt?.x == null || tgt.y == null) continue;

      ctx.beginPath();
      ctx.moveTo(toMiniX(src.x), toMiniY(src.y));
      ctx.lineTo(toMiniX(tgt.x), toMiniY(tgt.y));
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // ノード描画
    const noteColor = getCSSVar("--color-graph-node-note") || "#34a853";
    const paperColor = getCSSVar("--color-graph-node-paper") || "#4285f4";
    const accentColor = getCSSVar("--color-accent-primary") || "#4285f4";

    for (const node of nodes) {
      const x = toMiniX(node.x ?? 0);
      const y = toMiniY(node.y ?? 0);
      const isSelected = node.id === selectedNodeId;
      const radius = isSelected ? 3 : 2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? accentColor
        : node.type === "note"
          ? noteColor
          : paperColor;
      ctx.fill();

      // 選択中ノードにリング表示
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ビューポート矩形（将来拡張用）
    if (viewportBounds) {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(
        viewportBounds.x,
        viewportBounds.y,
        viewportBounds.width,
        viewportBounds.height,
      );
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }, [nodes, links, selectedNodeId, width, height, getBounds, viewportBounds]);

  /** ミニマップクリック → パン移動 */
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onCenterAt || nodes.length === 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const bounds = getBounds();
      const boundsW = bounds.maxX - bounds.minX;
      const boundsH = bounds.maxY - bounds.minY;
      const scaleX = (width - 16) / boundsW;
      const scaleY = (height - 16) / boundsH;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (width - boundsW * scale) / 2;
      const offsetY = (height - boundsH * scale) / 2;

      // ミニマップ座標 → グラフ座標
      const graphX = (clickX - offsetX) / scale + bounds.minX;
      const graphY = (clickY - offsetY) / scale + bounds.minY;

      onCenterAt(graphX, graphY);
    },
    [onCenterAt, nodes, getBounds, width, height],
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: "12px",
        right: "12px",
        zIndex: 15,
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid var(--color-border-primary)",
        boxShadow: "var(--shadow-card)",
        cursor: onCenterAt ? "crosshair" : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: "block",
        }}
        onClick={handleClick}
      />
    </div>
  );
};

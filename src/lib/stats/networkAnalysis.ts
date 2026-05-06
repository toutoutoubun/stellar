// ============================================================================
// src/lib/stats/networkAnalysis.ts
// Stellar — Network / graph analysis powered by graphology.
// Dependencies: graphology, graphology-metrics, graphology-communities-louvain.
// ============================================================================

import Graph from "graphology";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import { degreeCentrality } from "graphology-metrics/centrality/degree";
import closenessCentrality from "graphology-metrics/centrality/closeness";
import { density } from "graphology-metrics/graph/density";
import louvain from "graphology-communities-louvain";

import type { NetworkAnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// Community colour palette — 12 distinct hues suitable for light & dark themes
// ---------------------------------------------------------------------------

const COMMUNITY_COLORS = [
  "var(--color-community-0, #4e79a7)",
  "var(--color-community-1, #f28e2b)",
  "var(--color-community-2, #e15759)",
  "var(--color-community-3, #76b7b2)",
  "var(--color-community-4, #59a14f)",
  "var(--color-community-5, #edc948)",
  "var(--color-community-6, #b07aa1)",
  "var(--color-community-7, #ff9da7)",
  "var(--color-community-8, #9c755f)",
  "var(--color-community-9, #bab0ac)",
  "var(--color-community-10, #4dc9f6)",
  "var(--color-community-11, #8b5cf6)",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r(v: number, dp = 4): number {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

/**
 * Compute the average local clustering coefficient for an undirected graph.
 *
 * For each node, clustering = 2 * triangles / (deg * (deg - 1)).
 * We iterate all nodes and average.
 */
function averageClustering(graph: Graph): number {
  let total = 0;
  let counted = 0;

  graph.forEachNode((node) => {
    const neighbours = graph.neighbors(node);
    const deg = neighbours.length;
    if (deg < 2) return; // clustering undefined for deg < 2

    let triangles = 0;
    for (let i = 0; i < deg; i++) {
      for (let j = i + 1; j < deg; j++) {
        if (graph.hasEdge(neighbours[i]!, neighbours[j]!) ||
            graph.hasUndirectedEdge(neighbours[i]!, neighbours[j]!)) {
          triangles++;
        }
      }
    }

    total += (2 * triangles) / (deg * (deg - 1));
    counted++;
  });

  return counted > 0 ? total / counted : 0;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyse a network: centralities, community detection, global metrics.
 *
 * @param nodes    - Array of `{ id, label }`.
 * @param edges    - Array of `{ source, target, weight }`.
 * @param directed - Whether the graph is directed.
 */
export function analyzeNetwork(
  nodes: Array<{ id: string; label: string }>,
  edges: Array<{ source: string; target: string; weight: number }>,
  directed: boolean,
): NetworkAnalysisResult {
  // -- 1. Build graph ----------------------------------------------------
  const graph = new Graph({
    type: directed ? "directed" : "undirected",
    multi: false,
    allowSelfLoops: false,
  });

  for (const n of nodes) {
    if (!graph.hasNode(n.id)) {
      graph.addNode(n.id, { label: n.label });
    }
  }

  for (const e of edges) {
    if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) continue;
    if (e.source === e.target) continue; // skip self-loops
    try {
      graph.addEdge(e.source, e.target, { weight: e.weight });
    } catch {
      // edge already exists — merge weights
      const existing = graph.edge(e.source, e.target);
      if (existing) {
        const prev = graph.getEdgeAttribute(existing, "weight") as number;
        graph.setEdgeAttribute(existing, "weight", prev + e.weight);
      }
    }
  }

  // Handle degenerate graphs
  if (graph.order === 0) {
    return emptyResult("ネットワークにノードがありません。");
  }

  // -- 2. Degree centrality -----------------------------------------------
  degreeCentrality.assign(graph);

  // -- 3. Betweenness centrality ------------------------------------------
  const betweennessMap = betweennessCentrality(graph, {
    getEdgeWeight: "weight",
    normalized: true,
  });

  // -- 4. Closeness centrality --------------------------------------------
  const closenessMap = closenessCentrality(graph, {
    wassermanFaust: true,
  });

  // -- 5. Community detection (Louvain) -----------------------------------
  const louvainDetailed = louvain.detailed(graph, {
    getEdgeWeight: "weight",
    resolution: 1,
  });
  const communityMap = louvainDetailed.communities;
  const communityCount = louvainDetailed.count;
  const modularityValue = louvainDetailed.modularity;

  // -- 6. Global metrics --------------------------------------------------
  const graphDensity = r(density(graph));

  let totalDegree = 0;
  graph.forEachNode((node) => {
    totalDegree += graph.degree(node);
  });
  const avgDegree = graph.order > 0 ? r(totalDegree / graph.order) : 0;
  const avgClust = r(averageClustering(graph));

  // -- 7. Assemble node results & size by degree --------------------------
  const degrees: number[] = [];
  graph.forEachNode((node) => {
    degrees.push(graph.degree(node));
  });
  const minDeg = degrees.length > 0 ? Math.min(...degrees) : 0;
  const maxDeg = degrees.length > 0 ? Math.max(...degrees) : 1;
  const degRange = maxDeg - minDeg || 1;

  const MIN_SIZE = 4;
  const MAX_SIZE = 20;

  const resultNodes: NetworkAnalysisResult["nodes"] = [];
  let topBetweennessNode = "";
  let topBetweennessVal = -1;

  graph.forEachNode((nodeId) => {
    const deg = graph.degree(nodeId);
    const btwn = betweennessMap[nodeId] ?? 0;
    const close = closenessMap[nodeId] ?? 0;
    const comm = communityMap[nodeId] ?? 0;
    const label = (graph.getNodeAttribute(nodeId, "label") as string) || nodeId;
    const size = MIN_SIZE + ((deg - minDeg) / degRange) * (MAX_SIZE - MIN_SIZE);

    if (btwn > topBetweennessVal) {
      topBetweennessVal = btwn;
      topBetweennessNode = label;
    }

    resultNodes.push({
      id: nodeId,
      label,
      degree: deg,
      betweenness: r(btwn),
      closeness: r(close),
      community: comm,
      size: r(size, 1),
    });
  });

  // -- 8. Assemble edges --------------------------------------------------
  const resultEdges: NetworkAnalysisResult["edges"] = [];
  graph.forEachEdge((_edge, attr, source, target) => {
    resultEdges.push({
      source,
      target,
      weight: (attr.weight as number) ?? 1,
    });
  });

  // -- 9. Assemble community summaries ------------------------------------
  const communityNodeCounts = new Map<number, number>();
  for (const comm of Object.values(communityMap)) {
    communityNodeCounts.set(comm, (communityNodeCounts.get(comm) ?? 0) + 1);
  }

  const communities: NetworkAnalysisResult["communities"] = [];
  for (let cid = 0; cid < communityCount; cid++) {
    communities.push({
      id: cid,
      label: `コミュニティ ${cid + 1}`,
      nodeCount: communityNodeCounts.get(cid) ?? 0,
      color: COMMUNITY_COLORS[cid % COMMUNITY_COLORS.length]!,
    });
  }
  // Sort by size descending
  communities.sort((a, b) => b.nodeCount - a.nodeCount);

  // -- 10. Japanese interpretation ----------------------------------------
  const interpretation =
    `ネットワークは${graph.order}ノード・${graph.size}エッジで構成されています。` +
    `${communityCount}個のコミュニティが検出されました（モジュラリティ=${r(modularityValue)}）。` +
    (topBetweennessNode
      ? `最も中心的なノードは「${topBetweennessNode}」です。`
      : "") +
    `密度=${graphDensity}、平均次数=${avgDegree}、平均クラスタリング係数=${avgClust}。`;

  return {
    nodes: resultNodes,
    edges: resultEdges,
    communities,
    globalMetrics: {
      density: graphDensity,
      avgDegree,
      avgClustering: avgClust,
      modularity: r(modularityValue),
    },
    interpretation,
  };
}

// ---------------------------------------------------------------------------
// Empty / degenerate helper
// ---------------------------------------------------------------------------

function emptyResult(interpretation: string): NetworkAnalysisResult {
  return {
    nodes: [],
    edges: [],
    communities: [],
    globalMetrics: {
      density: 0,
      avgDegree: 0,
      avgClustering: 0,
      modularity: 0,
    },
    interpretation,
  };
}

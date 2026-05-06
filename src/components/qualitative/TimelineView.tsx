// src/components/qualitative/TimelineView.tsx
// D3タイムスケール + レーン + ズーム対応タイムラインビュー

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as d3 from 'd3';
import type { TimelineEvent, CreateTimelineEventInput } from '../../types';

interface TimelineViewProps {
  projectId: string;
}

/** 日付文字列をパース: "1945" → 1945-01-01, "1945-08" → 1945-08-01 */
function parseEventDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : 0;
  const day = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
  return new Date(year, month, day);
}

function detectDateType(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 1) return 'approximate';
  if (parts.length === 2) return 'month';
  return 'exact';
}

const LANE_COLORS = [
  '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6',
  '#EF4444', '#3B82F6', '#10B981', '#F97316', '#06B6D4',
];

const EVENT_TYPES = [
  { value: 'political', label: '政治' },
  { value: 'economic', label: '経済' },
  { value: 'social', label: '社会' },
  { value: 'military', label: '軍事' },
  { value: 'cultural', label: '文化' },
  { value: 'diplomatic', label: '外交' },
  { value: 'other', label: 'その他' },
];

const TimelineView: React.FC<TimelineViewProps> = ({ projectId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [lanes, setLanes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [newEvent, setNewEvent] = useState<CreateTimelineEventInput>({
    projectId,
    title: '',
    eventDate: '',
    dateType: 'exact',
    eventType: 'political',
    importance: 3,
    lane: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [evts, lns] = await Promise.all([
        invoke<TimelineEvent[]>('get_timeline_events', { projectId }),
        invoke<string[]>('get_timeline_lanes', { projectId }),
      ]);
      setEvents(evts);
      setLanes(lns);
    } catch (e) {
      console.error('タイムラインデータ取得に失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!newEvent.title.trim() || !newEvent.eventDate.trim()) return;
    const input = {
      ...newEvent,
      dateType: detectDateType(newEvent.eventDate),
    };
    try {
      await invoke('create_timeline_event', { input });
      setNewEvent({
        projectId,
        title: '',
        eventDate: '',
        dateType: 'exact',
        eventType: 'political',
        importance: 3,
        lane: '',
      });
      setShowForm(false);
      loadData();
    } catch (e) {
      console.error('イベント作成に失敗:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このイベントを削除しますか？')) return;
    try {
      await invoke('delete_timeline_event', { id });
      if (selectedEvent?.id === id) setSelectedEvent(null);
      loadData();
    } catch (e) {
      console.error('イベント削除に失敗:', e);
    }
  };

  // レーンマップ
  const laneMap = useMemo(() => {
    const allLanes = new Set<string>();
    events.forEach((e) => { if (e.lane) allLanes.add(e.lane); });
    const arr = Array.from(allLanes).sort();
    const map: Record<string, number> = {};
    arr.forEach((l, i) => { map[l] = i; });
    return map;
  }, [events]);

  // D3 描画
  useEffect(() => {
    if (!svgRef.current || events.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth ?? 800;
    const laneCount = Math.max(Object.keys(laneMap).length, 1);
    const laneHeight = 60;
    const margin = { top: 40, right: 20, bottom: 30, left: 20 };
    const height = margin.top + laneCount * laneHeight + margin.bottom + 40;

    svg.attr('width', width).attr('height', height);

    const dates = events.map((e) => parseEventDate(e.eventDate));
    const minDate = d3.min(dates) ?? new Date(1900, 0, 1);
    const maxDate = d3.max(dates) ?? new Date();

    // padding for date range
    const timePad = (maxDate.getTime() - minDate.getTime()) * 0.05 || 86400000 * 365;
    const xScale = d3
      .scaleTime()
      .domain([
        new Date(minDate.getTime() - timePad),
        new Date(maxDate.getTime() + timePad),
      ])
      .range([margin.left, width - margin.right]);

    // 軸
    const xAxis = d3.axisBottom(xScale).ticks(8);
    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '10px');

    // レーン背景
    const laneNames = Object.keys(laneMap).sort();
    laneNames.forEach((lane, i) => {
      const y = margin.top + i * laneHeight;
      svg
        .append('rect')
        .attr('x', margin.left)
        .attr('y', y)
        .attr('width', width - margin.left - margin.right)
        .attr('height', laneHeight)
        .attr('fill', i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.05)')
        .attr('rx', 2);

      svg
        .append('text')
        .attr('x', margin.left + 4)
        .attr('y', y + 14)
        .text(lane)
        .style('font-size', '10px')
        .style('fill', 'var(--text-secondary)')
        .style('font-weight', '600');
    });

    // イベント描画
    const g = svg.append('g');

    events.forEach((evt) => {
      const date = parseEventDate(evt.eventDate);
      const x = xScale(date);
      const laneIdx = evt.lane ? (laneMap[evt.lane] ?? 0) : 0;
      const y = margin.top + laneIdx * laneHeight + laneHeight / 2;
      const r = 4 + evt.importance * 1.5;
      const color = LANE_COLORS[laneIdx % LANE_COLORS.length];

      // 近似日フラグ
      const isApproximate = evt.dateType === 'approximate';

      const circle = g
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', r)
        .attr('fill', color)
        .attr('stroke', isApproximate ? color : 'none')
        .attr('stroke-width', isApproximate ? 2 : 0)
        .attr('stroke-dasharray', isApproximate ? '3 2' : 'none')
        .attr('fill-opacity', isApproximate ? 0.5 : 0.85)
        .style('cursor', 'pointer');

      // ホバーでタイトル表示
      circle.append('title').text(
        `${evt.title}\n${evt.eventDate}${isApproximate ? ' (概算)' : ''}\n重要度: ${evt.importance}/5`
      );

      circle.on('click', () => setSelectedEvent(evt));

      // ラベル
      g.append('text')
        .attr('x', x)
        .attr('y', y - r - 4)
        .attr('text-anchor', 'middle')
        .text(evt.title.length > 12 ? evt.title.slice(0, 12) + '...' : evt.title)
        .style('font-size', '9px')
        .style('fill', 'var(--text-primary)')
        .style('pointer-events', 'none');
    });

    // ズーム
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        const newX = event.transform.rescaleX(xScale);
        svg.select<SVGGElement>('g:last-of-type').selectAll('circle').attr('cx', (_, i) => {
          const date = parseEventDate(events[i]?.eventDate ?? '2000');
          return newX(date);
        });
      });

    svg.call(zoom);
  }, [events, laneMap]);

  if (loading) {
    return <div className="qual-loading">タイムラインを読み込み中...</div>;
  }

  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <h3 className="text-sm font-semibold">タイムライン</h3>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={loadData}>
            更新
          </button>
          <button
            className="btn-primary text-xs"
            onClick={() => setShowForm(!showForm)}
          >
            + イベント追加
          </button>
        </div>
      </div>

      {/* 新規イベントフォーム */}
      {showForm && (
        <div className="timeline-form">
          <div className="field-row">
            <input
              className="input-field text-sm flex-1"
              placeholder="イベント名"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            />
            <input
              className="input-field text-sm"
              placeholder="日付 (例: 1945, 1945-08, 1945-08-15)"
              value={newEvent.eventDate}
              onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
              style={{ width: '220px' }}
            />
          </div>
          <div className="field-row mt-2">
            <select
              className="input-field text-xs"
              value={newEvent.eventType}
              onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              className="input-field text-sm flex-1"
              placeholder="レーン名 (任意)"
              value={newEvent.lane ?? ''}
              onChange={(e) => setNewEvent({ ...newEvent, lane: e.target.value || null })}
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-secondary">重要度:</span>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  className={`importance-btn ${newEvent.importance === v ? 'active' : ''}`}
                  onClick={() => setNewEvent({ ...newEvent, importance: v })}
                >
                  {v}
                </button>
              ))}
            </div>
            <button className="btn-primary text-xs" onClick={handleCreate}>
              追加
            </button>
          </div>
          <div className="mt-2">
            <textarea
              className="input-field text-sm w-full"
              rows={2}
              placeholder="説明 (任意)"
              value={newEvent.description ?? ''}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value || null })}
            />
          </div>
        </div>
      )}

      {/* SVGタイムライン */}
      <div className="timeline-canvas" ref={containerRef}>
        {events.length === 0 ? (
          <div className="qual-empty-state">
            <p className="text-sm text-secondary">
              イベントを追加してタイムラインを構築してください。
            </p>
            <p className="text-xs text-secondary mt-1">
              日付形式: 1945 → 1945-01-01 / 1945-08 → 1945-08-01 / 概算は自動フラグ
            </p>
          </div>
        ) : (
          <svg ref={svgRef} className="timeline-svg" />
        )}
      </div>

      {/* 選択イベント詳細 */}
      {selectedEvent && (
        <div className="timeline-detail">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-semibold">{selectedEvent.title}</h4>
              <p className="text-xs text-secondary">
                {selectedEvent.eventDate}
                {selectedEvent.dateType === 'approximate' && ' (概算)'}
                {selectedEvent.lane && ` — ${selectedEvent.lane}`}
              </p>
            </div>
            <button
              className="btn-ghost text-xs text-red-500"
              onClick={() => handleDelete(selectedEvent.id)}
            >
              削除
            </button>
          </div>
          {selectedEvent.description && (
            <p className="text-xs mt-2">{selectedEvent.description}</p>
          )}
          <div className="flex gap-3 mt-2 text-xs text-secondary">
            <span>種別: {selectedEvent.eventType}</span>
            <span>重要度: {selectedEvent.importance}/5</span>
          </div>
        </div>
      )}

      {/* イベント一覧テーブル */}
      {events.length > 0 && (
        <div className="timeline-table mt-4">
          <h4 className="text-xs font-semibold mb-2">イベント一覧 ({events.length}件)</h4>
          <div className="timeline-event-list">
            {events.map((evt) => (
              <div
                key={evt.id}
                className={`timeline-event-row ${selectedEvent?.id === evt.id ? 'selected' : ''}`}
                onClick={() => setSelectedEvent(evt)}
              >
                <span className="text-xs font-mono w-24">{evt.eventDate}</span>
                <span className="text-xs flex-1">{evt.title}</span>
                <span className="text-xs text-secondary">{evt.eventType}</span>
                <span className="text-xs text-secondary">
                  {'●'.repeat(evt.importance)}{'○'.repeat(5 - evt.importance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineView;

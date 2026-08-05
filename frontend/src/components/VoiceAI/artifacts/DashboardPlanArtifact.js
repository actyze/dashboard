// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import DashboardService from '../../../services/DashboardService';

// ── Tile grid position helper ───────────────────────────────────────────

const tilePosition = (index) => ({
  x: (index % 2) * 6,
  y: Math.floor(index / 2) * 3,
  width: 6,
  height: 3,
});

const titleFromNl = (nl) =>
  nl.split(/\s+/).slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// ── Single tile row ─────────────────────────────────────────────────────

const TileRow = ({ tile, selected, onToggle, isDark }) => {
  const [expanded, setExpanded] = useState(false);
  const chartLabel = tile.chartRecommendation?.chart_type || 'auto';

  return (
    <div className={`rounded-lg border ${selected
      ? (isDark ? 'border-[#5d6ad3]/40 bg-[#5d6ad3]/5' : 'border-[#5d6ad3]/40 bg-[#5d6ad3]/5')
      : (isDark ? 'border-white/10' : 'border-gray-200')}`}>
      <div className="flex items-start gap-2.5 px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5 accent-[#5d6ad3] w-3.5 h-3.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {titleFromNl(tile.nl)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              {chartLabel}
            </span>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className={`mt-0.5 text-[10px] ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
            {expanded ? 'Hide SQL' : 'Show SQL'}
          </button>
          {expanded && (
            <pre className={`mt-1.5 text-[11px] font-mono leading-relaxed p-2 rounded overflow-x-auto whitespace-pre-wrap break-words ${isDark ? 'bg-[#0f1012] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
              {tile.sql}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Dashboard plan card ────────────────────────────────────────────────

const DashboardPlanArtifact = ({ plan, onCreated, onCancel }) => {
  const { isDark } = useTheme();
  const [selectedIds, setSelectedIds] = useState(new Set(plan.tiles.map(t => t.id)));
  const [title, setTitle] = useState(plan.title);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const [error, setError] = useState(null);

  const toggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const chosen = plan.tiles.filter(t => selectedIds.has(t.id));
    if (chosen.length === 0) { setError('Select at least one tile.'); return; }

    setCreating(true);
    setError(null);
    try {
      const dashResp = await DashboardService.createDashboard({
        title: title.trim() || plan.title,
        description: 'Created from Actyze AI',
      });
      if (!dashResp.success || !dashResp.dashboard?.id) {
        throw new Error(dashResp.error || 'Could not create dashboard.');
      }
      const dashboardId = dashResp.dashboard.id;

      // Create tiles sequentially so positions are deterministic.
      for (let i = 0; i < chosen.length; i++) {
        const tile = chosen[i];
        // eslint-disable-next-line no-await-in-loop
        await DashboardService.createTile(dashboardId, {
          title: titleFromNl(tile.nl),
          description: tile.nl,
          sql_query: tile.sql,
          nl_query: tile.nl,
          chart_type: tile.chartRecommendation?.chart_type || 'bar',
          chart_config: tile.chartRecommendation || {},
          position: tilePosition(i),
        });
      }
      setCreatedId(dashboardId);
      onCreated?.(dashboardId);
    } catch (e) {
      setError(e?.message || 'Failed to create dashboard.');
    } finally {
      setCreating(false);
    }
  };

  // Post-create success state
  if (createdId) {
    return (
      <div className={`mt-2 rounded-lg border p-3 ${isDark ? 'border-[#5d6ad3]/40 bg-[#5d6ad3]/10 text-gray-200' : 'border-[#5d6ad3]/30 bg-[#5d6ad3]/5 text-gray-800'}`}>
        <div className="text-[12px]">
          Dashboard created with {selectedIds.size} tile{selectedIds.size === 1 ? '' : 's'}. Opening…
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-2 rounded-lg border overflow-hidden ${isDark ? 'border-white/10 bg-[#0f1012]' : 'border-gray-200 bg-white'}`}>
      {/* Header with editable title */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Dashboard plan</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`flex-1 text-[13px] font-medium bg-transparent outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
          placeholder="Dashboard title"
        />
      </div>

      {/* Tile list */}
      <div className="p-3 space-y-2">
        {plan.tiles.map(tile => (
          <TileRow
            key={tile.id}
            tile={tile}
            selected={selectedIds.has(tile.id)}
            onToggle={() => toggle(tile.id)}
            isDark={isDark}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className={`px-3 py-2 text-[11px] ${isDark ? 'text-red-400 border-t border-red-900/30' : 'text-red-600 border-t border-red-200'}`}>
          {error}
        </div>
      )}

      {/* Footer actions */}
      <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          {selectedIds.size} of {plan.tiles.length} selected
        </span>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button onClick={onCancel}
              className={`px-2.5 py-1 text-[11px] rounded-md ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}>
              Dismiss
            </button>
          )}
          <button onClick={handleCreate} disabled={creating || selectedIds.size === 0}
            className="px-3 py-1 text-[11px] font-medium rounded-md bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] disabled:opacity-50 transition-colors">
            {creating ? 'Creating…' : 'Create dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPlanArtifact;

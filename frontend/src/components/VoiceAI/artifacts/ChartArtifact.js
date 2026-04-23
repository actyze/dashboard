// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '../../../contexts/ThemeContext';

const CHART_HEIGHT = 220;
const ACCENT = '#5d6ad3';

/**
 * Thin inline chart for the chat widget. Uses the LLM's chart recommendation
 * when available, otherwise falls back to a minimal auto-selection
 * (first string column → x, first numeric column → y).
 */
const ChartArtifact = ({ queryResults, chartRecommendation }) => {
  const { isDark } = useTheme();

  const { data, layout, title } = useMemo(() => {
    if (!queryResults?.columns || !queryResults?.rows?.length) {
      return { data: null, layout: null, title: null };
    }

    const columns = queryResults.columns.map(c => typeof c === 'string' ? c : c.name);
    const rows = queryResults.rows;
    const rec = chartRecommendation || {};

    // Pick axes — LLM recommendation wins
    let xField = rec.x_axis || rec.x || null;
    let yField = rec.y_axis || rec.y || null;
    const chartType = (rec.chart_type || rec.type || 'bar').toLowerCase();

    if (!xField || !columns.includes(xField)) {
      xField = columns.find(c => typeof rows[0]?.[columns.indexOf(c)] === 'string') || columns[0];
    }
    if (!yField || !columns.includes(yField) || yField === xField) {
      yField = columns.find(c => c !== xField && typeof rows[0]?.[columns.indexOf(c)] === 'number') || columns[1] || columns[0];
    }

    const xIdx = columns.indexOf(xField);
    const yIdx = columns.indexOf(yField);
    const xs = rows.map(r => (Array.isArray(r) ? r[xIdx] : r[xField]));
    const ys = rows.map(r => (Array.isArray(r) ? r[yIdx] : r[yField]));

    let trace;
    if (chartType === 'pie' || chartType === 'donut') {
      trace = {
        type: 'pie',
        labels: xs, values: ys,
        marker: { colors: [ACCENT, '#7a85db', '#98a0e4', '#b6bbed', '#d3d7f6'] },
        textinfo: 'label+percent', hoverinfo: 'label+value',
        hole: chartType === 'donut' ? 0.55 : 0,
      };
    } else if (chartType === 'line' || chartType === 'area') {
      trace = {
        type: 'scatter', mode: 'lines+markers',
        x: xs, y: ys,
        line: { color: ACCENT, width: 2 },
        marker: { color: ACCENT, size: 5 },
        fill: chartType === 'area' ? 'tozeroy' : undefined,
        fillcolor: chartType === 'area' ? 'rgba(93,106,211,0.15)' : undefined,
      };
    } else if (chartType === 'scatter') {
      trace = {
        type: 'scatter', mode: 'markers',
        x: xs, y: ys,
        marker: { color: ACCENT, size: 6 },
      };
    } else {
      // bar, horizontalBar, default
      trace = {
        type: 'bar',
        x: chartType === 'horizontalbar' ? ys : xs,
        y: chartType === 'horizontalbar' ? xs : ys,
        orientation: chartType === 'horizontalbar' ? 'h' : 'v',
        marker: { color: ACCENT },
      };
    }

    const fg = isDark ? '#e5e5e5' : '#171717';
    const muted = isDark ? '#6b7280' : '#9ca3af';
    const gridline = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const layout = {
      autosize: true, height: CHART_HEIGHT,
      margin: { l: 40, r: 12, t: 8, b: 32 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: fg, size: 11, family: 'system-ui, -apple-system, sans-serif' },
      xaxis: {
        gridcolor: gridline, linecolor: gridline, tickfont: { color: muted },
        automargin: true, fixedrange: true,
      },
      yaxis: {
        gridcolor: gridline, linecolor: gridline, tickfont: { color: muted },
        automargin: true, fixedrange: true,
      },
      showlegend: false,
    };
    if (trace.type === 'pie') { delete layout.xaxis; delete layout.yaxis; }

    return {
      data: [trace],
      layout,
      title: rec.title || `${yField} by ${xField}`,
    };
  }, [queryResults, chartRecommendation, isDark]);

  if (!data) return null;

  return (
    <div className={`mt-2 rounded-lg border overflow-hidden ${isDark ? 'border-white/10 bg-[#0f1012]' : 'border-gray-200 bg-white'}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Chart</span>
        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{title}</span>
      </div>
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, responsive: true, staticPlot: false }}
        style={{ width: '100%', height: CHART_HEIGHT }}
        useResizeHandler
      />
    </div>
  );
};

export default ChartArtifact;

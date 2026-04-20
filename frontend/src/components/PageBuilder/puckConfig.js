// SPDX-License-Identifier: AGPL-3.0-only
// Puck component config — defines all draggable blocks for the page builder.
// Each component has fields (editable props) and a render function.

import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { RestService } from '../../services';
import { transformQueryResults } from '../../utils/dataTransformers';
import { QueryResults } from '../QueryExplorer';
import { Chart } from '../Charts';
import { useTheme, ThemeProvider } from '../../contexts/ThemeContext';

// ─── Theme helper ──────────────────────────────────────────────────
const useDark = () => {
  try { return useTheme().isDark; } catch { return false; }
};

// ─── SQL result cache ──────────────────────────────────────────────
// Module-level cache: survives edit↔view toggles, clears on page reload.
// Keyed by SQL + maxRows, stores raw API response with timestamp.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sqlCache = new Map();

const cacheKey = (sql, maxRows) => `${sql}::${maxRows}`;

const executeCached = async (sql, maxRows = 500, forceRefresh = false) => {
  const key = cacheKey(sql, maxRows);
  const cached = sqlCache.get(key);
  if (!forceRefresh && cached && (Date.now() - cached.ts < CACHE_TTL_MS)) {
    return cached.res;
  }
  const res = await RestService.executeSql(sql, maxRows);
  sqlCache.set(key, { res, ts: Date.now() });
  return res;
};

// ─── Content blocks ────────────────────────────────────────────────

const Heading = ({ text, level, align }) => {
  const dark = useDark();
  const Tag = `h${level || 1}`;
  const sizes = { 1: '2em', 2: '1.5em', 3: '1.25em' };
  return (
    <Tag style={{ fontSize: sizes[level] || sizes[1], fontWeight: 700, margin: '0.4em 0', textAlign: align || 'left', color: dark ? '#f3f4f6' : undefined }}>
      {text || 'Heading'}
    </Tag>
  );
};

const Text = ({ content, align }) => {
  const dark = useDark();
  return (
    <p style={{ margin: '0.4em 0', lineHeight: 1.7, textAlign: align || 'left', color: dark ? '#d1d5db' : undefined }}>
      {content || 'Enter text here...'}
    </p>
  );
};

const RichText = ({ html }) => {
  const dark = useDark();
  return (
    <div style={{ color: dark ? '#d1d5db' : undefined }} dangerouslySetInnerHTML={{ __html: html || '<p>Enter rich text content...</p>' }} />
  );
};

const Divider = ({ color, thickness }) => (
  <hr style={{ border: 'none', borderTop: `${thickness || 1}px solid ${color || '#e5e7eb'}`, margin: '1.5em 0' }} />
);

const ImageBlock = ({ src, alt, width, borderRadius }) => {
  const dark = useDark();
  return src
    ? <img src={src} alt={alt || ''} style={{ maxWidth: width || '100%', borderRadius: borderRadius || '0px', display: 'block' }} />
    : <div style={{ background: dark ? '#1f2937' : '#f3f4f6', borderRadius: 8, padding: 40, textAlign: 'center', color: dark ? '#6b7280' : '#9ca3af', border: `2px dashed ${dark ? '#374151' : '#d1d5db'}` }}>
        Drop an image URL in the settings panel
      </div>;
};

// ─── Layout blocks ─────────────────────────────────────────────────

const Section = ({ children, padding, background, maxWidth }) => (
  <section style={{ padding: padding || '32px 24px', background: background || 'transparent', maxWidth: maxWidth || 'none', margin: maxWidth ? '0 auto' : undefined }}>
    {children}
  </section>
);

const Card = ({ title, children, padding, borderRadius, shadow }) => {
  const dark = useDark();
  return (
    <div style={{ background: dark ? '#1f2937' : '#fff', borderRadius: borderRadius || '12px', padding: padding || '24px', boxShadow: shadow ? `0 1px 3px rgba(0,0,0,${dark ? '0.4' : '0.12'})` : 'none', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}` }}>
      {title && <h3 style={{ margin: '0 0 8px', fontSize: '1.1em', fontWeight: 600, color: dark ? '#f3f4f6' : undefined }}>{title}</h3>}
      {children}
    </div>
  );
};

const Columns = ({ children }) => (
  <div style={{ display: 'flex', gap: 16 }}>
    {children}
  </div>
);

const Column = ({ children, width }) => (
  <div style={{ flex: width || 1, minHeight: 60 }}>
    {children}
  </div>
);

// ─── Data blocks ───────────────────────────────────────────────────
// Puck's <Render> does NOT re-render children when their state changes.
// We use useRef + imperative DOM writes for the value, and createRoot
// for complex React sub-trees (Chart, QueryResults).

const fmtValue = (v, format, fallback) => {
  if (v === null || v === undefined) return fallback || '--';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (format === 'currency') return `$${n.toLocaleString()}`;
  if (format === 'percent') return `${n.toFixed(1)}%`;
  return n.toLocaleString();
};

const MetricCard = ({ label, value, format, prefix, suffix, sql, background, color }) => {
  const dark = useDark();
  const valueRef = useRef(null);
  const labelRef = useRef(null);

  const defaultBg = dark ? '#1f2937' : '#f9fafb';
  const defaultColor = dark ? '#f3f4f6' : '#111827';
  const borderColor = dark ? '#374151' : '#e5e7eb';
  const labelColor = dark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    if (!sql || !valueRef.current) return;
    let cancelled = false;

    valueRef.current.textContent = '...';
    valueRef.current.style.color = color || defaultColor;

    executeCached(sql, 1)
      .then(res => {
        if (cancelled || !valueRef.current) return;
        const qr = res?.query_results;
        const raw = qr?.rows?.[0]?.[0] ?? null;
        valueRef.current.textContent = `${prefix || ''}${fmtValue(raw, format, value)}${suffix || ''}`;
      })
      .catch(e => {
        if (cancelled || !valueRef.current) return;
        valueRef.current.textContent = 'Error';
        valueRef.current.style.color = '#dc2626';
        if (labelRef.current) {
          labelRef.current.textContent = e?.message || 'Query failed';
          labelRef.current.style.color = '#dc2626';
        }
      });

    return () => { cancelled = true; };
  }, [sql, format, prefix, suffix, value, color, defaultColor]);

  // Set initial content via ref callback (not JSX children, which React would reconcile over)
  const valueInitRef = useRef(false);
  useEffect(() => {
    if (valueRef.current && !valueInitRef.current) {
      valueInitRef.current = true;
      if (!sql) {
        valueRef.current.textContent = `${prefix || ''}${fmtValue(value, format, '--')}${suffix || ''}`;
      }
    }
  });

  return (
    <div style={{ textAlign: 'center', padding: 24, background: background || defaultBg, borderRadius: 12, border: `1px solid ${borderColor}` }}>
      <div ref={valueRef} style={{ fontSize: '2.5em', fontWeight: 700, color: color || defaultColor }} />
      <div ref={labelRef} style={{ fontSize: '0.875em', color: labelColor, marginTop: 4 }}>
        {label || 'Metric'}
      </div>
    </div>
  );
};

const QueryChart = ({ sql, chartType, title, height }) => {
  const dark = useDark();
  const containerRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!sql || !containerRef.current) return;
    let cancelled = false;

    containerRef.current.innerHTML = `<div style="text-align:center;padding:40px;color:${dark ? '#9ca3af' : '#6b7280'}">Running query...</div>`;

    executeCached(sql, 500)
      .then(res => {
        if (cancelled || !containerRef.current) return;
        const qr = res?.query_results;
        if (!qr?.columns || !qr?.rows) {
          containerRef.current.innerHTML = `<div style="padding:16px;background:${dark ? '#7f1d1d' : '#fef2f2'};border-radius:8px;color:${dark ? '#fca5a5' : '#dc2626'};font-size:13px">Error: No data returned</div>`;
          return;
        }
        const transformed = transformQueryResults(qr);
        if (!transformed) {
          containerRef.current.innerHTML = `<div style="text-align:center;padding:40px;color:${dark ? '#9ca3af' : '#6b7280'}">No data</div>`;
          return;
        }
        const cols = transformed.columns || [];
        const autoConfig = cols.length >= 2
          ? { xField: cols[0].name, yField: cols[1].name }
          : {};
        const chartData = { chart: { type: chartType || 'bar', config: autoConfig }, data: transformed };
        if (!rootRef.current) rootRef.current = createRoot(containerRef.current);
        rootRef.current.render(<ThemeProvider><Chart chartData={chartData} loading={false} error={null} embedded={true} /></ThemeProvider>);
      })
      .catch(e => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = `<div style="padding:16px;background:${dark ? '#7f1d1d' : '#fef2f2'};border-radius:8px;color:${dark ? '#fca5a5' : '#dc2626'};font-size:13px">Error: ${e?.message || 'Query failed'}</div>`;
      });

    return () => { cancelled = true; };
  }, [sql, chartType, dark]);

  if (!sql) return (
    <div style={{ padding: 24, background: dark ? '#1e2a4a' : '#f0f4ff', borderRadius: 12, border: '2px dashed #5d6ad3', textAlign: 'center', minHeight: height || 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ fontSize: 36 }}>📊</div>
      <div style={{ color: '#5d6ad3', fontWeight: 600, marginTop: 8 }}>Chart Block</div>
      <div style={{ color: dark ? '#7c8ac8' : '#93a0e8', fontSize: 12, marginTop: 4 }}>Enter a SQL query in the settings panel</div>
    </div>
  );

  return (
    <div>
      {title && <h3 style={{ margin: '0 0 8px', fontSize: '1em', fontWeight: 600, color: dark ? '#f3f4f6' : undefined }}>{title}</h3>}
      <div ref={containerRef} style={{ minHeight: height || 250 }} />
    </div>
  );
};

const DataTable = ({ sql, title, maxRows }) => {
  const dark = useDark();
  const containerRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!sql || !containerRef.current) return;
    let cancelled = false;

    containerRef.current.innerHTML = `<div style="text-align:center;padding:40px;color:${dark ? '#9ca3af' : '#6b7280'}">Running query...</div>`;

    executeCached(sql, maxRows || 100)
      .then(res => {
        if (cancelled || !containerRef.current) return;
        const qr = res?.query_results;
        if (!qr?.columns || !qr?.rows) {
          containerRef.current.innerHTML = `<div style="padding:16px;background:${dark ? '#7f1d1d' : '#fef2f2'};border-radius:8px;color:${dark ? '#fca5a5' : '#dc2626'};font-size:13px">Error: No data returned</div>`;
          return;
        }
        const queryData = transformQueryResults(qr);
        if (!queryData) {
          containerRef.current.innerHTML = `<div style="text-align:center;padding:40px;color:${dark ? '#9ca3af' : '#6b7280'}">No data</div>`;
          return;
        }
        if (!rootRef.current) rootRef.current = createRoot(containerRef.current);
        rootRef.current.render(<ThemeProvider><QueryResults queryData={queryData} loading={false} error={null} /></ThemeProvider>);
      })
      .catch(e => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = `<div style="padding:16px;background:${dark ? '#7f1d1d' : '#fef2f2'};border-radius:8px;color:${dark ? '#fca5a5' : '#dc2626'};font-size:13px">Error: ${e?.message || 'Query failed'}</div>`;
      });

    return () => { cancelled = true; };
  }, [sql, maxRows, dark]);

  if (!sql) return (
    <div style={{ padding: 24, background: dark ? '#0f2a1a' : '#f0fdf4', borderRadius: 12, border: '2px dashed #22c55e', textAlign: 'center', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ fontSize: 36 }}>📋</div>
      <div style={{ color: '#16a34a', fontWeight: 600, marginTop: 8 }}>Data Table</div>
      <div style={{ color: dark ? '#4ade80' : '#86efac', fontSize: 12, marginTop: 4 }}>Enter a SQL query in the settings panel</div>
    </div>
  );

  return (
    <div>
      {title && <h3 style={{ margin: '0 0 8px', fontSize: '1em', fontWeight: 600, color: dark ? '#f3f4f6' : undefined }}>{title}</h3>}
      <div ref={containerRef} style={{ maxHeight: 400, overflow: 'auto' }} />
    </div>
  );
};

// ─── Puck config ───────────────────────────────────────────────────

const puckConfig = {
  categories: {
    content: { title: 'Content' },
    layout: { title: 'Layout' },
    data: { title: 'Data' },
  },
  components: {
    Heading: {
      label: 'Heading',
      defaultProps: { text: 'Heading', level: 1, align: 'left' },
      fields: {
        text: { type: 'text', label: 'Text' },
        level: { type: 'select', label: 'Level', options: [{ label: 'H1', value: 1 }, { label: 'H2', value: 2 }, { label: 'H3', value: 3 }] },
        align: { type: 'select', label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
      },
      render: Heading,
    },
    Text: {
      label: 'Text',
      defaultProps: { content: 'Enter text here...', align: 'left' },
      fields: {
        content: { type: 'textarea', label: 'Content' },
        align: { type: 'select', label: 'Align', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
      },
      render: Text,
    },
    RichText: {
      label: 'Rich Text (HTML)',
      defaultProps: { html: '<p>Enter rich content here. You can use <b>bold</b>, <em>italic</em>, lists, etc.</p>' },
      fields: {
        html: { type: 'textarea', label: 'HTML Content' },
      },
      render: RichText,
    },
    Image: {
      label: 'Image',
      defaultProps: { src: '', alt: '', width: '100%', borderRadius: '0px' },
      fields: {
        src: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt text' },
        width: { type: 'text', label: 'Max width (e.g. 100%, 500px)' },
        borderRadius: { type: 'text', label: 'Border radius (e.g. 8px, 50%)' },
      },
      render: ImageBlock,
    },
    Divider: {
      label: 'Divider',
      defaultProps: { color: '#e5e7eb', thickness: 1 },
      fields: {
        color: { type: 'text', label: 'Color' },
        thickness: { type: 'number', label: 'Thickness (px)' },
      },
      render: Divider,
    },
    Section: {
      label: 'Section',
      defaultProps: { padding: '32px 24px', background: 'transparent', maxWidth: '' },
      fields: {
        padding: { type: 'text', label: 'Padding (CSS)' },
        background: { type: 'text', label: 'Background (color or gradient)' },
        maxWidth: { type: 'text', label: 'Max width (e.g. 960px)' },
      },
      render: ({ children, puck, ...props }) => <Section {...props}>{children}</Section>,
      resolveData: async (data) => data,
    },
    Card: {
      label: 'Card',
      defaultProps: { title: 'Card Title', padding: '24px', borderRadius: '12px', shadow: true },
      fields: {
        title: { type: 'text', label: 'Title' },
        padding: { type: 'text', label: 'Padding' },
        borderRadius: { type: 'text', label: 'Border radius' },
        shadow: { type: 'radio', label: 'Shadow', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
      },
      render: ({ children, puck, ...props }) => <Card {...props}>{children}</Card>,
    },
    Columns: {
      label: 'Columns',
      defaultProps: {},
      render: ({ children, puck }) => <Columns>{children}</Columns>,
    },
    Column: {
      label: 'Column',
      defaultProps: { width: 1 },
      fields: {
        width: { type: 'number', label: 'Flex width' },
      },
      render: ({ children, puck, ...props }) => <Column {...props}>{children}</Column>,
    },
    MetricCard: {
      label: 'Metric Card',
      defaultProps: { label: 'Total Revenue', value: '$0', format: 'number', prefix: '', suffix: '', sql: '', background: '#f9fafb', color: '#111827' },
      fields: {
        label: { type: 'text', label: 'Label' },
        value: { type: 'text', label: 'Static value (if no SQL)' },
        format: { type: 'select', label: 'Format', options: [{ label: 'Number', value: 'number' }, { label: 'Currency ($)', value: 'currency' }, { label: 'Percent (%)', value: 'percent' }] },
        prefix: { type: 'text', label: 'Prefix' },
        suffix: { type: 'text', label: 'Suffix' },
        sql: { type: 'textarea', label: 'SQL Query (single value)' },
        background: { type: 'text', label: 'Background color' },
        color: { type: 'text', label: 'Value color' },
      },
      render: MetricCard,
    },
    QueryChart: {
      label: 'Chart',
      defaultProps: { sql: '', chartType: 'bar', title: '', height: 300 },
      fields: {
        title: { type: 'text', label: 'Title' },
        sql: { type: 'textarea', label: 'SQL Query' },
        chartType: { type: 'select', label: 'Chart type', options: [{ label: 'Bar', value: 'bar' }, { label: 'Line', value: 'line' }, { label: 'Pie', value: 'pie' }, { label: 'Scatter', value: 'scatter' }, { label: 'Area', value: 'area' }] },
        height: { type: 'number', label: 'Height (px)' },
      },
      render: QueryChart,
    },
    DataTable: {
      label: 'Data Table',
      defaultProps: { sql: '', title: '', maxRows: 100 },
      fields: {
        title: { type: 'text', label: 'Title' },
        sql: { type: 'textarea', label: 'SQL Query' },
        maxRows: { type: 'number', label: 'Max rows' },
      },
      render: DataTable,
    },
  },
};

export default puckConfig;

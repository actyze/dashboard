// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import MarkdownBody from './artifacts/MarkdownBody';
import SqlArtifact from './artifacts/SqlArtifact';
import TableArtifact from './artifacts/TableArtifact';
import ChartArtifact from './artifacts/ChartArtifact';

// ── Tiny icon set (inline to keep the component self-contained) ─────────

const Icon = ({ path, className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);
const ICONS = {
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  regen: 'M4 4v5h5M20 20v-5h-5M5 9a8 8 0 0113.5-3M19 15a8 8 0 01-13.5 3',
  stop: 'M6 6h12v12H6z',
  external: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  dashboard: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z',
};

// ── Stage pill (Generating / Executing) ─────────────────────────────────

const StagePill = ({ stage }) => {
  const { isDark } = useTheme();
  const label = stage === 'generating' ? 'Generating query'
              : stage === 'executing'  ? 'Running query'
              : stage;
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
      <span className="w-1 h-1 rounded-full bg-[#5d6ad3] animate-pulse" />
      {label}
      <span className="inline-block w-[2px] h-[1em] bg-[#5d6ad3] animate-pulse" />
    </div>
  );
};

// ── Ghost action chip ───────────────────────────────────────────────────

const Chip = ({ icon, children, onClick, title }) => {
  const { isDark } = useTheme();
  return (
    <button onClick={onClick} title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
        isDark
          ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-white/10'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
      }`}>
      {icon && <Icon path={icon} className="w-3 h-3" />}
      {children}
    </button>
  );
};

// ── Message block ───────────────────────────────────────────────────────

const MessageBlock = ({ msg, onStop, onRegenerate, onOpenInQueryPage, onAddToDashboard }) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isError = msg.status === 'error' || msg.status === 'exec_error';
  const isStreaming = msg.status === 'generating' || msg.status === 'executing';
  const hasSql = Boolean(msg.sql);
  const hasResults = Boolean(msg.queryResults?.rows?.length);

  const handleCopyMessage = async () => {
    const parts = [];
    if (msg.content) parts.push(msg.content);
    if (msg.sql) parts.push('\n\n```sql\n' + msg.sql + '\n```');
    try {
      await navigator.clipboard.writeText(parts.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };

  // ── User turn ───────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className={`max-w-[85%] pl-2 border-l-2 border-[#5d6ad3] ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          <div className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        </div>
      </div>
    );
  }

  // ── Assistant turn ──────────────────────────────────────────
  return (
    <div className="group">
      {/* Text body */}
      {msg.content && !isError && <MarkdownBody>{msg.content}</MarkdownBody>}

      {/* Error */}
      {isError && (
        <div className={`rounded-lg border p-2.5 ${isDark ? 'border-red-900/40 bg-red-900/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <div className="text-[11px] uppercase tracking-wider mb-1 opacity-70">
            {msg.status === 'exec_error' ? 'Execution failed' : 'Error'}
          </div>
          <div className="text-[13px] break-words whitespace-pre-wrap">{msg.errorMessage || msg.content}</div>
        </div>
      )}

      {/* SQL */}
      {hasSql && <SqlArtifact sql={msg.sql} streaming={msg.status === 'generating'} />}

      {/* Stage indicator */}
      {isStreaming && (
        <div className="mt-2"><StagePill stage={msg.status} /></div>
      )}

      {/* Results */}
      {hasResults && (
        <>
          <ChartArtifact queryResults={msg.queryResults} chartRecommendation={msg.chartRecommendation} />
          <TableArtifact queryResults={msg.queryResults} rowCount={msg.queryResults?.row_count} isLimited={msg.isLimited} />
        </>
      )}

      {/* Action chips */}
      {hasSql && !isStreaming && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {onOpenInQueryPage && (
            <Chip icon={ICONS.external} onClick={() => onOpenInQueryPage(msg)} title="Open in query editor">
              Open in editor
            </Chip>
          )}
          {onAddToDashboard && (
            <Chip icon={ICONS.dashboard} onClick={() => onAddToDashboard(msg)} title="Save as a new dashboard">
              Save to dashboard
            </Chip>
          )}
        </div>
      )}

      {/* Hover controls (bottom row) */}
      <div className={`mt-2 flex items-center gap-1 transition-opacity ${isStreaming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {isStreaming && onStop && (
          <button onClick={onStop}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            title="Stop generation">
            <Icon path={ICONS.stop} className="w-3 h-3" />
            Stop
          </button>
        )}
        {!isStreaming && onRegenerate && (
          <button onClick={() => onRegenerate(msg)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            title="Regenerate response">
            <Icon path={ICONS.regen} className="w-3 h-3" />
            Regenerate
          </button>
        )}
        {!isStreaming && (
          <button onClick={handleCopyMessage}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            title="Copy message">
            <Icon path={ICONS.copy} className="w-3 h-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageBlock;

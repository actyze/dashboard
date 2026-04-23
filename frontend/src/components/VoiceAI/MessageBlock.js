// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import MarkdownBody from './artifacts/MarkdownBody';
import SqlArtifact from './artifacts/SqlArtifact';
import DashboardPlanArtifact from './artifacts/DashboardPlanArtifact';

const Icon = ({ path, className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);
const ICONS = {
  copy:       'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  regen:      'M4 4v5h5M20 20v-5h-5M5 9a8 8 0 0113.5-3M19 15a8 8 0 01-13.5 3',
  external:   'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  dashboard:  'M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z',
};

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

const MessageBlock = ({ msg, onRegenerate, onOpenInQueryPage, onAddToDashboard, onDashboardCreated }) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isError = msg.status === 'error';
  const hasSql = Boolean(msg.sql);
  const hasPlan = Boolean(msg.dashboardPlan);

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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className={`max-w-[85%] pl-2 border-l-2 border-[#5d6ad3] ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          <div className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      {/* Markdown body (reasoning / intro) */}
      {msg.content && !isError && <MarkdownBody>{msg.content}</MarkdownBody>}

      {/* Error */}
      {isError && (
        <div className={`rounded-lg border p-2.5 ${isDark ? 'border-red-900/40 bg-red-900/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <div className="text-[11px] uppercase tracking-wider mb-1 opacity-70">Error</div>
          <div className="text-[13px] break-words whitespace-pre-wrap">{msg.errorMessage || msg.content}</div>
        </div>
      )}

      {/* Dashboard plan */}
      {hasPlan && (
        <DashboardPlanArtifact
          plan={msg.dashboardPlan}
          onCreated={onDashboardCreated}
        />
      )}

      {/* Single SQL result */}
      {hasSql && !hasPlan && <SqlArtifact sql={msg.sql} />}

      {/* Action chips for single SQL */}
      {hasSql && !hasPlan && (
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

      {/* Hover controls */}
      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onRegenerate && (
          <button onClick={() => onRegenerate(msg)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            title="Regenerate response">
            <Icon path={ICONS.regen} className="w-3 h-3" />
            Regenerate
          </button>
        )}
        <button onClick={handleCopyMessage}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          title="Copy message">
          <Icon path={ICONS.copy} className="w-3 h-3" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

export default MessageBlock;

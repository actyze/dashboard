// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';

const SqlArtifact = ({ sql, streaming = false }) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };

  return (
    <div className={`mt-2 rounded-lg border overflow-hidden ${isDark ? 'border-white/10 bg-[#0f1012]' : 'border-gray-200 bg-gray-50'}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          SQL{streaming ? ' · generating' : ''}
        </span>
        <button
          onClick={handleCopy}
          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
          title="Copy SQL"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={`text-[12px] font-mono leading-relaxed px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
        {sql}
        {streaming && <span className="inline-block w-[2px] h-[1em] bg-[#5d6ad3] ml-0.5 align-middle animate-pulse" />}
      </pre>
    </div>
  );
};

export default SqlArtifact;

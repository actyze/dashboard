import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { useTheme } from '../../contexts/ThemeContext';

const SqlEditor = ({ 
  value, 
  onChange, 
  height = '180px',
  placeholder = 'Enter your SQL query here...',
  showHint = true,
  readOnly = false 
}) => {
  const { isDark } = useTheme();

  // Custom dark theme matching app colors
  // Key fix: selection needs rgba format with proper transparency
  const customDarkTheme = useMemo(() => createTheme({
    theme: 'dark',
    settings: {
      background: '#17181a',
      foreground: '#e5e7eb',
      caret: '#5d6ad3',
      selection: 'rgba(93, 106, 211, 0.4)',
      selectionMatch: 'rgba(93, 106, 211, 0.2)',
      lineHighlight: 'rgba(28, 29, 31, 0.8)',
      gutterBackground: '#17181a',
      gutterForeground: '#6b7280',
    },
    styles: [
      { tag: t.keyword, color: '#c084fc' }, // purple-400
      { tag: t.string, color: '#86efac' }, // green-300
      { tag: t.number, color: '#fcd34d' }, // amber-300
      { tag: t.comment, color: '#6b7280', fontStyle: 'italic' },
      { tag: t.function(t.variableName), color: '#60a5fa' }, // blue-400
      { tag: t.operator, color: '#f472b6' }, // pink-400
      { tag: t.typeName, color: '#22d3ee' }, // cyan-400
      { tag: t.propertyName, color: '#e5e7eb' },
    ],
  }), []);

  // Custom light theme
  const customLightTheme = useMemo(() => createTheme({
    theme: 'light',
    settings: {
      background: '#ffffff',
      foreground: '#1f2937',
      caret: '#2563eb',
      selection: 'rgba(56, 139, 253, 0.3)', // blue with 30% opacity
      selectionMatch: 'rgba(56, 139, 253, 0.15)', // lighter for matches
      lineHighlight: 'rgba(243, 244, 246, 0.8)', // gray-100 with opacity
      gutterBackground: '#ffffff',
      gutterForeground: '#9ca3af',
    },
    styles: [
      { tag: t.keyword, color: '#7c3aed' }, // violet-600
      { tag: t.string, color: '#059669' }, // emerald-600
      { tag: t.number, color: '#d97706' }, // amber-600
      { tag: t.comment, color: '#9ca3af', fontStyle: 'italic' },
      { tag: t.function(t.variableName), color: '#2563eb' },
      { tag: t.operator, color: '#db2777' },
      { tag: t.typeName, color: '#0891b2' },
      { tag: t.propertyName, color: '#1f2937' },
    ],
  }), []);

  return (
    <div className="w-full">
      <div className={`
        rounded-lg overflow-hidden border
        ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}
      `}>
        <CodeMirror
          value={value}
          height={height}
          extensions={[sql()]}
          onChange={onChange}
          theme={isDark ? customDarkTheme : customLightTheme}
          placeholder={placeholder}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: false,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: false,
            crosshairCursor: false,
            highlightActiveLine: true,
            highlightSelectionMatches: false,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          style={{
            fontSize: '13px',
          }}
        />
      </div>
      {showHint && (
        <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Press Ctrl+Space for autocomplete suggestions
        </p>
      )}
    </div>
  );
};

export default SqlEditor;

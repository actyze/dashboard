// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';

const MAX_VISIBLE_COLS = 6;
const MAX_VISIBLE_ROWS = 5;

const formatCell = (value) => {
  if (value === null || value === undefined) return <span className="opacity-40">null</span>;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value.toString();
  const str = String(value);
  return str.length > 80 ? str.slice(0, 80) + '…' : str;
};

const TableArtifact = ({ queryResults, rowCount, isLimited }) => {
  const { isDark } = useTheme();
  if (!queryResults?.columns || !queryResults?.rows) return null;

  const columns = queryResults.columns.map(c => typeof c === 'string' ? c : c.name);
  const visibleCols = columns.slice(0, MAX_VISIBLE_COLS);
  const hiddenColCount = Math.max(0, columns.length - MAX_VISIBLE_COLS);
  const visibleRows = queryResults.rows.slice(0, MAX_VISIBLE_ROWS);
  const total = rowCount ?? queryResults.row_count ?? queryResults.rows.length;
  const extraRows = total - visibleRows.length;

  return (
    <div className={`mt-2 rounded-lg border overflow-hidden ${isDark ? 'border-white/10 bg-[#0f1012]' : 'border-gray-200 bg-white'}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Result{isLimited ? ' · truncated' : ''}
        </span>
        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          {total.toLocaleString()} row{total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
              {visibleCols.map(col => (
                <th key={col}
                  className={`text-left px-3 py-1.5 font-medium whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {col}
                </th>
              ))}
              {hiddenColCount > 0 && (
                <th className={`text-left px-3 py-1.5 font-medium whitespace-nowrap ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  +{hiddenColCount}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                {visibleCols.map((col, j) => {
                  const rowVal = Array.isArray(row) ? row[j] : row[col];
                  return (
                    <td key={col} className={`px-3 py-1.5 font-mono text-[11px] whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {formatCell(rowVal)}
                    </td>
                  );
                })}
                {hiddenColCount > 0 && (
                  <td className={`px-3 py-1.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>…</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extraRows > 0 && (
        <div className={`px-3 py-1.5 text-[10px] border-t ${isDark ? 'text-gray-500 border-white/5' : 'text-gray-500 border-gray-100'}`}>
          Showing first {visibleRows.length} of {total.toLocaleString()} rows
        </div>
      )}
    </div>
  );
};

export default TableArtifact;

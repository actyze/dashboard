// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const SavedQuerySidebar = ({ queries, visible, onSelect }) => {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
        ${isDark ? 'bg-[#101012] border-r border-[#2a2b2e]' : 'bg-gray-50 border-r border-gray-200'}
      `}
      style={{ width: visible ? '240px' : '0px' }}
    >
      <div className="w-[240px] h-full flex flex-col">
        <div className={`px-4 py-3 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Saved Queries
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {queries.map((query) => (
            <button
              key={query.id}
              type="button"
              onClick={() => onSelect(query)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg transition-colors
                ${isDark
                  ? 'hover:bg-[#1c1d1f] text-gray-300'
                  : 'hover:bg-white text-gray-700 hover:shadow-sm'
                }
              `}
            >
              <div className="font-medium truncate text-sm">
                {query.query_name || `Query ${query.id}`}
              </div>
              {query.generated_sql && (
                <div className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {query.generated_sql.substring(0, 50)}...
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SavedQueryToggle = ({ show, onToggle, hasQueries, isDark }) => {
  if (!hasQueries) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
        ${show
          ? 'bg-[#5d6ad3] text-white'
          : isDark
            ? 'bg-[#1c1d1f] text-gray-300 hover:bg-[#2a2b2e]'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
      `}
    >
      Use saved queries
    </button>
  );
};

export default SavedQuerySidebar;

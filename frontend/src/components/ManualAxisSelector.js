import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Manual axis selector component for chart configuration.
 * 
 * Shown when:
 * 1. User executed SQL directly (no NL query / no LLM recommendation)
 * 2. User clicks "Configure" to override LLM recommendation
 * 
 * Uses cached query results from last execution - no re-fetch needed.
 */
const ManualAxisSelector = ({ 
  columns = [], 
  xAxis, 
  yAxis, 
  onXAxisChange, 
  onYAxisChange,
  onApply,
  chartType = 'bar',
  onChartTypeChange
}) => {
  const { isDark } = useTheme();

  const selectClass = `
    w-full px-3 py-2 rounded-lg border transition-colors
    ${isDark 
      ? 'bg-gray-800 border-gray-600 text-gray-200 focus:border-blue-500' 
      : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'
    }
    focus:outline-none focus:ring-2 focus:ring-blue-500/20
  `;

  const labelClass = `text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  const basicChartTypes = [
    { id: 'bar', label: 'Bar', icon: '📊' },
    { id: 'line', label: 'Line', icon: '📈' },
    { id: 'pie', label: 'Pie', icon: '🥧' },
    { id: 'scatter', label: 'Scatter', icon: '⚫' },
    { id: 'area', label: 'Area', icon: '📉' },
  ];

  return (
    <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚙️</span>
        <h3 className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          Configure Chart
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>
          Manual Mode
        </span>
      </div>
      
      <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        Select columns from your query results to visualize:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Chart Type */}
        <div>
          <label className={labelClass}>Chart Type</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {basicChartTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => onChartTypeChange?.(type.id)}
                className={`
                  px-2 py-1 rounded text-sm transition-colors
                  ${chartType === type.id
                    ? 'bg-blue-600 text-white'
                    : isDark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                `}
                title={type.label}
              >
                {type.icon}
              </button>
            ))}
          </div>
        </div>

        {/* X-Axis */}
        <div>
          <label className={labelClass}>X-Axis (Category/Dimension)</label>
          <select 
            value={xAxis || ''} 
            onChange={(e) => onXAxisChange?.(e.target.value)}
            className={selectClass}
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col.name || col} value={col.name || col}>
                {col.label || col.name || col}
              </option>
            ))}
          </select>
        </div>

        {/* Y-Axis */}
        <div>
          <label className={labelClass}>Y-Axis (Value/Measure)</label>
          <select 
            value={yAxis || ''} 
            onChange={(e) => onYAxisChange?.(e.target.value)}
            className={selectClass}
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col.name || col} value={col.name || col}>
                {col.label || col.name || col}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Apply Button */}
      <div className="flex justify-end">
        <button
          onClick={onApply}
          disabled={!xAxis || !yAxis}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${xAxis && yAxis
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : isDark
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Generate Chart
        </button>
      </div>
    </div>
  );
};

export default ManualAxisSelector;


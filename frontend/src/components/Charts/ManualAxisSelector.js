import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChartIcons } from './ChartTypeSelector';

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

  const basicChartTypes = [
    { id: 'bar', label: 'Bar' },
    { id: 'line', label: 'Line' },
    { id: 'pie', label: 'Pie' },
    { id: 'scatter', label: 'Scatter' },
    { id: 'area', label: 'Area' },
  ];

  const canGenerate = xAxis && yAxis;

  return (
    <div className={`
      rounded-xl border overflow-hidden
      ${isDark ? 'bg-gray-800/30 border-gray-700/50' : 'bg-white border-gray-200'}
    `}>
      {/* Header */}
      <div className={`
        px-4 py-3 flex items-center justify-between border-b
        ${isDark ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-50 border-gray-100'}
      `}>
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center
            ${isDark ? 'bg-gray-700' : 'bg-gray-200'}
          `}>
            <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className={`font-semibold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Configure Chart
            </h3>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Select columns to visualize
            </p>
          </div>
        </div>
        
        <span className={`
          inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full
          ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'}
        `}>
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Custom
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Chart Type */}
          <div className="flex-shrink-0">
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Chart Type
            </label>
            <div className={`
              flex items-center gap-1 p-1 rounded-lg
              ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}
            `}>
              {basicChartTypes.map((type) => {
                const Icon = ChartIcons[type.id];
                const isSelected = chartType === type.id;
                
                return (
                  <div key={type.id} className="relative group">
                    <button
                      onClick={() => onChartTypeChange?.(type.id)}
                      className={`
                        w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150
                        ${isSelected
                          ? (isDark 
                              ? 'bg-blue-500/20 text-blue-400 shadow-sm' 
                              : 'bg-white text-blue-600 shadow-sm')
                          : (isDark
                              ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-white/50')
                        }
                      `}
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                    </button>
                    {/* Tooltip */}
                    <div className={`
                      absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-xs font-medium
                      whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible
                      transition-all duration-150 pointer-events-none z-50
                      ${isDark 
                        ? 'bg-gray-900 text-gray-200 shadow-lg border border-gray-700' 
                        : 'bg-gray-800 text-white shadow-lg'}
                    `}>
                      {type.label}
                      <div className={`
                        absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent
                        ${isDark ? 'border-t-gray-900' : 'border-t-gray-800'}
                      `} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className={`hidden md:block w-px h-12 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

          {/* X-Axis */}
          <div className="flex-1 min-w-[180px]">
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              X-Axis
              <span className={`ml-1 font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                (Category)
              </span>
            </label>
            <select 
              value={xAxis || ''} 
              onChange={(e) => onXAxisChange?.(e.target.value)}
              className={`
                w-full h-10 px-3 rounded-lg border text-sm transition-all
                ${isDark 
                  ? 'bg-gray-900/50 border-gray-700 text-gray-200 focus:border-blue-500 focus:bg-gray-900' 
                  : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
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
          <div className="flex-1 min-w-[180px]">
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Y-Axis
              <span className={`ml-1 font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                (Value)
              </span>
            </label>
            <select 
              value={yAxis || ''} 
              onChange={(e) => onYAxisChange?.(e.target.value)}
              className={`
                w-full h-10 px-3 rounded-lg border text-sm transition-all
                ${isDark 
                  ? 'bg-gray-900/50 border-gray-700 text-gray-200 focus:border-blue-500 focus:bg-gray-900' 
                  : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
            >
              <option value="">Select column...</option>
              {columns.map((col) => (
                <option key={col.name || col} value={col.name || col}>
                  {col.label || col.name || col}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={onApply}
            disabled={!canGenerate}
            className={`
              h-10 px-5 rounded-lg font-medium text-sm transition-all duration-150 flex items-center gap-2
              ${canGenerate
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                : (isDark
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed')
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualAxisSelector;


import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Chart type definitions with metadata
const CHART_TYPES = {
  // Basic Charts - Always shown
  basic: [
    { id: 'bar', label: 'Bar', icon: '📊', description: 'Compare categories', requiresNumeric: true, requiresCategory: true },
    { id: 'line', label: 'Line', icon: '📈', description: 'Show trends over time', requiresNumeric: true, requiresCategory: true },
    { id: 'pie', label: 'Pie', icon: '🥧', description: 'Show parts of whole', requiresNumeric: true, requiresCategory: true },
    { id: 'scatter', label: 'Scatter', icon: '⚫', description: 'Show correlations', requiresNumeric: true, minNumericCols: 2 },
    { id: 'area', label: 'Area', icon: '📉', description: 'Show cumulative values', requiresNumeric: true, requiresCategory: true },
  ],
  // Statistical Charts
  statistical: [
    { id: 'histogram', label: 'Histogram', icon: '📶', description: 'Show distribution', requiresNumeric: true },
    { id: 'box', label: 'Box Plot', icon: '📦', description: 'Show statistical summary', requiresNumeric: true },
    { id: 'violin', label: 'Violin', icon: '🎻', description: 'Show distribution shape', requiresNumeric: true },
  ],
  // Hierarchical Charts
  hierarchical: [
    { id: 'treemap', label: 'Treemap', icon: '🗺️', description: 'Show hierarchical data', requiresNumeric: true, requiresCategory: true },
    { id: 'sunburst', label: 'Sunburst', icon: '☀️', description: 'Show hierarchical levels', requiresNumeric: true, requiresCategory: true },
    { id: 'funnel', label: 'Funnel', icon: '🔻', description: 'Show conversion stages', requiresNumeric: true, requiresCategory: true },
  ],
  // Scientific Charts
  scientific: [
    { id: 'heatmap', label: 'Heatmap', icon: '🌡️', description: 'Show intensity matrix', requiresNumeric: true, minNumericCols: 3 },
    { id: 'contour', label: 'Contour', icon: '🌊', description: 'Show density contours', requiresNumeric: true, minNumericCols: 3 },
  ],
  // Financial Charts
  financial: [
    { id: 'candlestick', label: 'Candlestick', icon: '🕯️', description: 'Show OHLC data', requiresNumeric: true, minNumericCols: 4 },
    { id: 'waterfall', label: 'Waterfall', icon: '💧', description: 'Show incremental changes', requiresNumeric: true, requiresCategory: true },
  ],
  // Flow Charts
  flow: [
    { id: 'sankey', label: 'Sankey', icon: '🔀', description: 'Show flow between nodes', requiresNumeric: true, minCols: 3 },
  ],
};

// Flatten all chart types for lookup
const ALL_CHART_TYPES = Object.values(CHART_TYPES).flat();

const ChartTypeSelector = ({ 
  selectedType = 'bar', 
  onTypeChange, 
  dataColumns = [],
  disabled = false,
  compact = false 
}) => {
  const { isDark } = useTheme();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Simplified chart compatibility check
  // LLM handles intelligent column selection, we just check basic requirements
  const isChartCompatible = (chartType) => {
    // If no data columns info, allow all
    if (!dataColumns || dataColumns.length === 0) return true;
    
    const totalCols = dataColumns.length;
    const chartId = chartType.id;

    // Most charts need at least 2 columns
    if (['bar', 'line', 'area', 'pie', 'scatter', 'box', 'violin', 'treemap', 'sunburst', 'funnel', 'waterfall'].includes(chartId)) {
      return totalCols >= 2;
    }

    // Histogram only needs 1 column
    if (chartId === 'histogram') {
      return totalCols >= 1;
    }

    // Heatmap/Contour/Sankey need 3 columns
    if (['heatmap', 'contour', 'sankey'].includes(chartId)) {
      return totalCols >= 3;
    }

    // Candlestick needs 5 columns (date + OHLC)
    if (chartId === 'candlestick') {
      return totalCols >= 5;
    }

    // Default: allow if we have at least 2 columns
    return totalCols >= 2;
  };

  const handleTypeSelect = (typeId) => {
    if (!disabled && onTypeChange) {
      onTypeChange(typeId);
      setShowAdvanced(false);
    }
  };

  const selectedChartInfo = ALL_CHART_TYPES.find(t => t.id === selectedType) || CHART_TYPES.basic[0];

  // Button styles
  const baseButtonClass = `
    flex items-center justify-center p-2 rounded-lg transition-all duration-200
    border focus:outline-none focus:ring-2 focus:ring-blue-500/50
  `;

  const getButtonClass = (typeId, isCompatible) => {
    const isSelected = selectedType === typeId;
    
    if (!isCompatible) {
      return `${baseButtonClass} opacity-40 cursor-not-allowed
        ${isDark ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`;
    }
    
    if (isSelected) {
      return `${baseButtonClass} 
        ${isDark 
          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25' 
          : 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/25'}`;
    }
    
    return `${baseButtonClass} cursor-pointer
      ${isDark 
        ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-blue-500' 
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-400'}`;
  };

  return (
    <div className="chart-type-selector">
      {/* Quick Access Icons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHART_TYPES.basic.map((chartType) => {
          const isCompatible = isChartCompatible(chartType);
          return (
            <button
              key={chartType.id}
              onClick={() => isCompatible && handleTypeSelect(chartType.id)}
              disabled={disabled || !isCompatible}
              className={getButtonClass(chartType.id, isCompatible)}
              title={`${chartType.label}: ${chartType.description}${!isCompatible ? ' (incompatible with current data)' : ''}`}
            >
              <span className="text-lg">{chartType.icon}</span>
              {!compact && (
                <span className="ml-1.5 text-xs font-medium hidden sm:inline">{chartType.label}</span>
              )}
            </button>
          );
        })}

        {/* More Charts Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={disabled}
            className={`${baseButtonClass} cursor-pointer
              ${isDark 
                ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
              ${showAdvanced ? (isDark ? 'border-blue-500' : 'border-blue-400') : ''}`}
            title="More chart types"
          >
            <span className="text-sm">More</span>
            <svg 
              className={`w-4 h-4 ml-1 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showAdvanced && (
            <div 
              className={`absolute top-full right-0 mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden
                ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}
            >
              {Object.entries(CHART_TYPES).filter(([key]) => key !== 'basic').map(([category, types]) => (
                <div key={category} className={`${isDark ? 'border-gray-700' : 'border-gray-100'} border-b last:border-b-0`}>
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider
                    ${isDark ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                    {category}
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5">
                    {types.map((chartType) => {
                      const isCompatible = isChartCompatible(chartType);
                      const isSelected = selectedType === chartType.id;
                      
                      return (
                        <button
                          key={chartType.id}
                          onClick={() => isCompatible && handleTypeSelect(chartType.id)}
                          disabled={!isCompatible}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all
                            ${!isCompatible 
                              ? `opacity-40 cursor-not-allowed ${isDark ? 'text-gray-500' : 'text-gray-400'}`
                              : isSelected
                                ? `${isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`
                                : `${isDark 
                                    ? 'hover:bg-gray-700 text-gray-300' 
                                    : 'hover:bg-gray-100 text-gray-700'} cursor-pointer`
                            }`}
                          title={chartType.description}
                        >
                          <span className="text-lg">{chartType.icon}</span>
                          <span className="text-sm font-medium">{chartType.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Chart Info (optional) */}
      {!compact && selectedChartInfo && (
        <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {selectedChartInfo.icon} {selectedChartInfo.label}: {selectedChartInfo.description}
        </div>
      )}

      {/* Click outside to close */}
      {showAdvanced && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAdvanced(false)}
        />
      )}
    </div>
  );
};

export default ChartTypeSelector;
export { CHART_TYPES, ALL_CHART_TYPES };

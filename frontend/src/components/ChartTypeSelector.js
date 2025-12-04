import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// SVG Mini-Chart Icons - Clear visual representations
const ChartIcons = {
  bar: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="15" rx="1" />
      <rect x="17" y="9" width="4" height="12" rx="1" />
    </svg>
  ),
  line: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,17 8,11 13,14 21,6" />
      <circle cx="8" cy="11" r="1.5" fill="currentColor" />
      <circle cx="13" cy="14" r="1.5" fill="currentColor" />
      <circle cx="21" cy="6" r="1.5" fill="currentColor" />
    </svg>
  ),
  pie: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8v8l6.93 4c-1.46 2.44-4.13 4-6.93 4z" />
      <path d="M12 2v10l8 4.6A10 10 0 0012 2z" opacity="0.6" />
    </svg>
  ),
  scatter: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="16" r="2.5" />
      <circle cx="9" cy="10" r="2.5" />
      <circle cx="14" cy="14" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="11" cy="18" r="2" opacity="0.6" />
      <circle cx="17" cy="12" r="2" opacity="0.6" />
    </svg>
  ),
  area: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21V17L8 12L13 15L21 7V21H3Z" opacity="0.4" />
      <path d="M3 17L8 12L13 15L21 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  histogram: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="14" width="3" height="7" />
      <rect x="6" y="10" width="3" height="11" />
      <rect x="10" y="6" width="3" height="15" />
      <rect x="14" y="9" width="3" height="12" />
      <rect x="18" y="13" width="3" height="8" />
    </svg>
  ),
  box: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="6" width="12" height="10" rx="1" opacity="0.7" />
      <line x1="6" y1="11" x2="18" y2="11" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="16" x2="12" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="2" x2="16" y2="2" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  violin: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C10 2 8 5 8 8C6 9 5 11 5 12C5 13 6 15 8 16C8 19 10 22 12 22C14 22 16 19 16 16C18 15 19 13 19 12C19 11 18 9 16 8C16 5 14 2 12 2Z" opacity="0.6" />
      <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  treemap: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="2" width="10" height="10" rx="1" />
      <rect x="14" y="2" width="8" height="6" rx="1" opacity="0.7" />
      <rect x="14" y="10" width="8" height="6" rx="1" opacity="0.5" />
      <rect x="2" y="14" width="6" height="8" rx="1" opacity="0.6" />
      <rect x="10" y="14" width="4" height="8" rx="1" opacity="0.4" />
      <rect x="16" y="18" width="6" height="4" rx="1" opacity="0.3" />
    </svg>
  ),
  sunburst: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2A10 10 0 0112 22A10 10 0 0112 2M12 6A6 6 0 0112 18A6 6 0 0112 6" opacity="0.4" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" opacity="0.6" />
    </svg>
  ),
  funnel: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 4H22L18 9H6L2 4Z" />
      <path d="M6 10H18L15 14H9L6 10Z" opacity="0.7" />
      <path d="M9 15H15L13 20H11L9 15Z" opacity="0.5" />
    </svg>
  ),
  heatmap: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="2" width="6" height="6" rx="1" opacity="0.3" />
      <rect x="9" y="2" width="6" height="6" rx="1" opacity="0.7" />
      <rect x="16" y="2" width="6" height="6" rx="1" opacity="0.5" />
      <rect x="2" y="9" width="6" height="6" rx="1" opacity="0.9" />
      <rect x="9" y="9" width="6" height="6" rx="1" opacity="0.4" />
      <rect x="16" y="9" width="6" height="6" rx="1" opacity="0.8" />
      <rect x="2" y="16" width="6" height="6" rx="1" opacity="0.6" />
      <rect x="9" y="16" width="6" height="6" rx="1" opacity="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" opacity="0.2" />
    </svg>
  ),
  contour: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="9" ry="7" />
      <ellipse cx="12" cy="12" rx="6" ry="4.5" />
      <ellipse cx="12" cy="12" rx="3" ry="2" />
    </svg>
  ),
  candlestick: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="8" width="4" height="6" rx="0.5" />
      <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="10" width="4" height="5" rx="0.5" opacity="0.6" />
      <line x1="18" y1="3" x2="18" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <rect x="16" y="6" width="4" height="8" rx="0.5" />
    </svg>
  ),
  waterfall: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="14" width="4" height="6" rx="0.5" />
      <rect x="7" y="10" width="4" height="4" rx="0.5" opacity="0.7" />
      <rect x="12" y="6" width="4" height="4" rx="0.5" />
      <rect x="17" y="8" width="4" height="6" rx="0.5" opacity="0.7" />
      <line x1="4" y1="14" x2="9" y2="14" stroke="currentColor" strokeWidth="1" strokeDasharray="2" opacity="0.5" />
      <line x1="9" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2" opacity="0.5" />
    </svg>
  ),
  sankey: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="3" width="3" height="8" rx="1" />
      <rect x="2" y="13" width="3" height="8" rx="1" />
      <rect x="19" y="2" width="3" height="6" rx="1" />
      <rect x="19" y="10" width="3" height="6" rx="1" />
      <rect x="19" y="18" width="3" height="4" rx="1" />
      <path d="M5 7 Q12 7 19 5" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      <path d="M5 17 Q12 14 19 13" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      <path d="M5 19 Q12 20 19 20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
  ),
};

// Chart type definitions with metadata
const CHART_TYPES = {
  // Basic Charts - Always shown
  basic: [
    { id: 'bar', label: 'Bar', description: 'Compare categories', requiresNumeric: true, requiresCategory: true },
    { id: 'line', label: 'Line', description: 'Trends over time', requiresNumeric: true, requiresCategory: true },
    { id: 'pie', label: 'Pie', description: 'Parts of whole', requiresNumeric: true, requiresCategory: true },
    { id: 'scatter', label: 'Scatter', description: 'Correlations', requiresNumeric: true, minNumericCols: 2 },
    { id: 'area', label: 'Area', description: 'Cumulative values', requiresNumeric: true, requiresCategory: true },
  ],
  // Statistical Charts
  statistical: [
    { id: 'histogram', label: 'Histogram', description: 'Distribution', requiresNumeric: true },
    { id: 'box', label: 'Box Plot', description: 'Statistical summary', requiresNumeric: true },
    { id: 'violin', label: 'Violin', description: 'Distribution shape', requiresNumeric: true },
  ],
  // Hierarchical Charts
  hierarchical: [
    { id: 'treemap', label: 'Treemap', description: 'Hierarchical data', requiresNumeric: true, requiresCategory: true },
    { id: 'sunburst', label: 'Sunburst', description: 'Hierarchical levels', requiresNumeric: true, requiresCategory: true },
    { id: 'funnel', label: 'Funnel', description: 'Conversion stages', requiresNumeric: true, requiresCategory: true },
  ],
  // Advanced Charts
  advanced: [
    { id: 'heatmap', label: 'Heatmap', description: 'Intensity matrix', requiresNumeric: true, minNumericCols: 3 },
    { id: 'contour', label: 'Contour', description: 'Density contours', requiresNumeric: true, minNumericCols: 3 },
    { id: 'waterfall', label: 'Waterfall', description: 'Incremental changes', requiresNumeric: true, requiresCategory: true },
    { id: 'candlestick', label: 'Candlestick', description: 'OHLC data', requiresNumeric: true, minNumericCols: 4 },
    { id: 'sankey', label: 'Sankey', description: 'Flow between nodes', requiresNumeric: true, minCols: 3 },
  ],
};

// Flatten all chart types for lookup
const ALL_CHART_TYPES = Object.values(CHART_TYPES).flat();

// Category labels for display
const CATEGORY_LABELS = {
  basic: 'Basic',
  statistical: 'Statistical',
  hierarchical: 'Hierarchical',
  advanced: 'Advanced',
};

const ChartTypeSelector = ({ 
  selectedType = 'bar', 
  onTypeChange, 
  dataColumns = [],
  disabled = false,
  compact = false 
}) => {
  const { isDark } = useTheme();
  const [showPanel, setShowPanel] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(['basic', 'statistical', 'hierarchical', 'advanced']);

  // Simplified chart compatibility check
  const isChartCompatible = (chartType) => {
    if (!dataColumns || dataColumns.length === 0) return true;
    
    const totalCols = dataColumns.length;
    const chartId = chartType.id;

    if (['bar', 'line', 'area', 'pie', 'scatter', 'box', 'violin', 'treemap', 'sunburst', 'funnel', 'waterfall'].includes(chartId)) {
      return totalCols >= 2;
    }
    if (chartId === 'histogram') return totalCols >= 1;
    if (['heatmap', 'contour', 'sankey'].includes(chartId)) return totalCols >= 3;
    if (chartId === 'candlestick') return totalCols >= 5;
    return totalCols >= 2;
  };

  const handleTypeSelect = (typeId) => {
    if (!disabled && onTypeChange) {
      onTypeChange(typeId);
      setShowPanel(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const selectedChartInfo = ALL_CHART_TYPES.find(t => t.id === selectedType) || CHART_TYPES.basic[0];
  const IconComponent = ChartIcons[selectedType] || ChartIcons.bar;

  // Render chart button with SVG icon
  const renderChartButton = (chartType, size = 'normal') => {
    const isCompatible = isChartCompatible(chartType);
    const isSelected = selectedType === chartType.id;
    const Icon = ChartIcons[chartType.id];

    const sizeClasses = size === 'small' 
      ? 'w-8 h-8 p-1.5' 
      : 'h-9 px-2.5 py-1.5';

    return (
      <button
        key={chartType.id}
        onClick={() => isCompatible && handleTypeSelect(chartType.id)}
        disabled={disabled || !isCompatible}
        title={`${chartType.label}: ${chartType.description}${!isCompatible ? ' (needs more columns)' : ''}`}
        className={`
          flex items-center gap-1.5 rounded-md transition-all duration-150
          ${sizeClasses}
          ${!isCompatible 
            ? `opacity-30 cursor-not-allowed ${isDark ? 'text-gray-600' : 'text-gray-400'}`
            : isSelected
              ? `${isDark 
                  ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' 
                  : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'}`
              : `cursor-pointer ${isDark 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
          }
        `}
      >
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        {size !== 'small' && (
          <span className="text-xs font-medium whitespace-nowrap">{chartType.label}</span>
        )}
      </button>
    );
  };

  return (
    <div className="chart-type-selector relative">
      {/* Main Bar - Selected Chart + Quick Options + Expand */}
      <div className={`
        flex items-center gap-1 p-1 rounded-lg
        ${isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'}
      `}>
        {/* Currently Selected (always visible) */}
        <div className="relative group">
          <div className={`
            flex items-center gap-1.5 px-2 py-1 rounded-md cursor-default
            ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-700 shadow-sm'}
          `}>
            <IconComponent className="w-4 h-4" />
            <span className="text-xs font-semibold">{selectedChartInfo.label}</span>
          </div>
          {/* Tooltip showing description */}
          <div className={`
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-xs
            whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible
            transition-all duration-150 pointer-events-none z-50
            ${isDark 
              ? 'bg-gray-900 text-gray-300 shadow-lg border border-gray-700' 
              : 'bg-gray-800 text-white shadow-lg'}
          `}>
            {selectedChartInfo.description}
            <div className={`
              absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent
              ${isDark ? 'border-t-gray-900' : 'border-t-gray-800'}
            `} />
          </div>
        </div>

        {/* Divider */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

        {/* Quick Access - Basic Charts */}
        <div className="flex items-center gap-0.5">
          {CHART_TYPES.basic.map((chartType) => {
            if (chartType.id === selectedType) return null;
            const isCompatible = isChartCompatible(chartType);
            const Icon = ChartIcons[chartType.id];
            
            return (
              <div key={chartType.id} className="relative group">
                <button
                  onClick={() => isCompatible && handleTypeSelect(chartType.id)}
                  disabled={disabled || !isCompatible}
                  className={`
                    w-7 h-7 flex items-center justify-center rounded transition-all duration-150
                    ${!isCompatible 
                      ? `opacity-30 cursor-not-allowed ${isDark ? 'text-gray-600' : 'text-gray-400'}`
                      : `cursor-pointer ${isDark 
                          ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`
                    }
                  `}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                </button>
                {/* Custom Tooltip */}
                <div className={`
                  absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-xs font-medium
                  whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible
                  transition-all duration-150 pointer-events-none z-50
                  ${isDark 
                    ? 'bg-gray-900 text-gray-200 shadow-lg border border-gray-700' 
                    : 'bg-gray-800 text-white shadow-lg'}
                `}>
                  {chartType.label}
                  <div className={`
                    absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent
                    ${isDark ? 'border-t-gray-900' : 'border-t-gray-800'}
                  `} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

        {/* More Button */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          disabled={disabled}
          className={`
            flex items-center gap-1 px-2 py-1 rounded transition-all duration-150
            ${showPanel 
              ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600')
              : (isDark 
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200')
            }
          `}
          title="All chart types"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-xs font-medium">All</span>
          <svg 
            className={`w-3 h-3 transition-transform ${showPanel ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded Panel - Wide Horizontal Layout */}
      {showPanel && (
        <>
          {/* Click outside to close */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPanel(false)}
          />
          
          {/* Panel */}
          <div 
            className={`
              absolute top-full left-0 mt-2 z-50 rounded-xl shadow-2xl overflow-hidden
              min-w-[480px] max-w-[600px]
              ${isDark 
                ? 'bg-gray-800 border border-gray-700' 
                : 'bg-white border border-gray-200'}
            `}
          >
            {/* Header */}
            <div className={`
              px-4 py-2.5 flex items-center justify-between border-b
              ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}
            `}>
              <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                Chart Types
              </span>
              <button
                onClick={() => setShowPanel(false)}
                className={`
                  p-1 rounded transition-colors
                  ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Categories - Horizontal Grid Layout */}
            <div className="p-3 space-y-2">
              {Object.entries(CHART_TYPES).map(([category, types]) => {
                const isExpanded = expandedCategories.includes(category);
                
                return (
                  <div key={category}>
                    {/* Category Header - Clickable */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className={`
                        w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors
                        ${isDark 
                          ? 'hover:bg-gray-700/50 text-gray-400' 
                          : 'hover:bg-gray-100 text-gray-500'}
                      `}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <svg 
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Chart Options - Horizontal Flow */}
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 pl-2">
                        {types.map((chartType) => renderChartButton(chartType))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className={`
              px-4 py-2 text-xs border-t
              ${isDark ? 'bg-gray-900/30 border-gray-700 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'}
            `}>
              Some charts require specific column counts to be available
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChartTypeSelector;
export { CHART_TYPES, ALL_CHART_TYPES, ChartIcons };

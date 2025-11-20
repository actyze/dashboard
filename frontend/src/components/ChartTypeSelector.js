import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ChartTypeSelector = ({ currentType = 'bar', onTypeChange }) => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const chartTypes = [
    {
      type: 'bar',
      label: 'Bar Chart',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      type: 'line',
      label: 'Line Chart',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
        </svg>
      )
    },
    {
      type: 'pie',
      label: 'Pie Chart',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        </svg>
      )
    },
    {
      type: 'scatter',
      label: 'Scatter Plot',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      )
    },
    {
      type: 'area',
      label: 'Area Chart',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-7 4 7H8z" />
        </svg>
      )
    }
  ];

  const currentChart = chartTypes.find(chart => chart.type === currentType) || chartTypes[0];

  const handleSelect = (type) => {
    onTypeChange(type);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border transition-all duration-200 text-xs font-medium
          ${isDark 
            ? 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-600/70 text-gray-300 hover:border-gray-500' 
            : 'bg-white/60 border-gray-200/50 hover:bg-white text-gray-600 hover:border-gray-300'
          }
          hover:shadow-sm backdrop-blur-sm
        `}
      >
        {currentChart.icon}
        <span className="text-xs">{currentChart.label}</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`
          absolute right-0 top-full mt-1 w-40 rounded-md border shadow-lg backdrop-blur-sm z-50
          ${isDark 
            ? 'bg-gray-800/95 border-gray-600/50' 
            : 'bg-white/95 border-gray-200/50'
          }
        `}>
          <div className="py-1">
            {chartTypes.map((chart) => (
              <button
                key={chart.type}
                onClick={() => handleSelect(chart.type)}
                className={`
                  w-full flex items-center space-x-2 px-3 py-2 text-left transition-all duration-150
                  ${currentType === chart.type
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'text-gray-200 hover:bg-gray-700/70'
                      : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <div className={`
                  w-6 h-6 rounded flex items-center justify-center
                  ${currentType === chart.type
                    ? 'bg-blue-600'
                    : isDark
                      ? 'bg-gray-700'
                      : 'bg-gray-100'
                  }
                `}>
                  {chart.icon}
                </div>
                <span className="text-xs font-medium">{chart.label}</span>
                {currentType === chart.type && (
                  <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartTypeSelector;
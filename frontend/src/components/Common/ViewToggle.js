import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const ViewToggle = ({ activeView, onViewChange }) => {
  const { isDark } = useTheme();

  const ResultsIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10V9a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
    </svg>
  );

  const ChartIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );

  const ToggleButton = ({ view, icon, label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`
        flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all duration-200
        ${isActive 
          ? 'bg-[#5d6ad3] text-white shadow-sm' 
          : isDark
            ? 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className={`
      flex items-center space-x-1 p-0.5 rounded-lg border
      ${isDark 
        ? 'bg-[#1c1d1f]/50 border-gray-700/50' 
        : 'bg-gray-50/80 border-gray-200/50'
      }
    `}>
      <ToggleButton
        view="results"
        icon={<ResultsIcon />}
        label="Results"
        isActive={activeView === 'results'}
        onClick={() => onViewChange('results')}
      />
      <ToggleButton
        view="chart"
        icon={<ChartIcon />}
        label="Chart"
        isActive={activeView === 'chart'}
        onClick={() => onViewChange('chart')}
      />
    </div>
  );
};

export default ViewToggle;
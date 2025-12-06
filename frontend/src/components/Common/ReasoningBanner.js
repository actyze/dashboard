import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Text } from '../ui';

const ReasoningBanner = ({ reasoning, className = '' }) => {
  const { isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasoning || reasoning === 'Query generated using AI' || reasoning === 'Query generated based on schema analysis') {
    return null; // Don't show banner for generic/fallback reasoning
  }

  // Truncate reasoning to first 80 characters for collapsed view
  const shortReasoning = reasoning.length > 80 ? reasoning.substring(0, 80) + '...' : reasoning;
  const needsExpansion = reasoning.length > 80;

  return (
    <div 
      className={`
        rounded-md border transition-all duration-200 ease-in-out
        ${isDark 
          ? 'bg-blue-900/20 border-blue-800/40 text-blue-200' 
          : 'bg-blue-50 border-blue-200 text-blue-900'
        }
        ${className}
      `}
    >
      <div className="px-3 py-2 flex items-start gap-2">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <svg 
            className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Text 
                variant="caption" 
                className={`font-medium text-xs ${isDark ? 'text-blue-300' : 'text-blue-800'}`}
              >
                Query Reasoning
              </Text>
              <Text 
                variant="body2" 
                className={`mt-0.5 text-xs leading-relaxed ${isDark ? 'text-blue-100' : 'text-blue-900'}`}
              >
                {isExpanded ? reasoning : shortReasoning}
              </Text>
            </div>

            {/* Expand/Collapse Button */}
            {needsExpansion && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                  flex-shrink-0 p-1 rounded transition-colors text-xs font-medium
                  ${isDark 
                    ? 'text-blue-300 hover:text-blue-100 hover:bg-blue-800/30' 
                    : 'text-blue-700 hover:text-blue-900 hover:bg-blue-100'
                  }
                `}
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 9l-7 7-7-7" 
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReasoningBanner;


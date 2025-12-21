import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * TypingIndicator - Animated typing indicator for chat
 * Shows three bouncing dots to indicate the AI is processing/typing
 */
const TypingIndicator = () => {
  const { isDark } = useTheme();

  return (
    <div className="flex justify-end">
      <div
        className={`
          px-4 py-3 rounded-2xl rounded-tr-sm
          ${isDark
            ? 'bg-gradient-to-r from-violet-600 to-purple-600'
            : 'bg-gradient-to-r from-violet-500 to-purple-500'
          }
        `}
      >
        <div className="flex items-center space-x-1">
          <span 
            className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '600ms' }}
          />
          <span 
            className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '600ms' }}
          />
          <span 
            className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '600ms' }}
          />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;


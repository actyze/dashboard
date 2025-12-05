import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, TextArea } from '../ui';

const AIQueryInput = ({ onSubmit, loading = false }) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textAreaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [query]);

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      onSubmit(query.trim());
      // Keep the input text after processing for reference
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = (e) => {
    // Only collapse if clicking outside the entire input container
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (!query.trim()) {
        setIsExpanded(false);
      }
    }
  };


  const SparkleIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zM4 21V9a2 2 0 012-2h12a2 2 0 012 2v12M8 7V5m8 2V5M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
    </svg>
  );

  const SendIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );

  const LoadingSpinner = () => (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );

  return (
    <div className="w-full mx-auto">
      {/* Main Input Container */}
      <div 
        className={`
          relative rounded-lg border transition-all duration-300 ease-out
          ${isExpanded 
            ? 'shadow-lg ring-1 ring-blue-500/20 border-blue-400/40 dark:border-blue-500/40' 
            : 'shadow-sm border-gray-200/60 dark:border-gray-700/60 hover:shadow-md hover:border-gray-300/70 dark:hover:border-gray-600/70'
          }
          ${isDark ? 'bg-gray-800/60 backdrop-blur-sm' : 'bg-white/60 backdrop-blur-sm'}
        `}
        onFocus={handleFocus}
        onBlur={handleBlur}
        tabIndex={-1}
      >
        {/* Input Area */}
        <div className="p-3">
          <textarea
            ref={textAreaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="✨ Ask me anything about your data... (e.g., 'Show sales by region')"
            className={`
              w-full resize-none border-none outline-none text-sm leading-relaxed
              ${isDark ? 'bg-gray-800/60 text-white placeholder-gray-400' : 'bg-white/60 text-gray-900 placeholder-gray-500'}
              min-h-[40px] max-h-[120px] overflow-y-auto
            `}
            rows={isExpanded ? 2 : 1}
          />
          
          {/* Action Bar */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span>⏎ Send</span>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={!query.trim() || loading}
              className={`
                px-2 py-1 text-xs font-medium rounded transition-all duration-200 flex items-center space-x-1
                ${!query.trim() || loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white'
                }
              `}
            >
              {loading ? <LoadingSpinner /> : <SendIcon />}
              <span>{loading ? 'Processing...' : 'Send'}</span>
            </button>
          </div>
        </div>
      </div>


      {/* Status Indicators */}
      {loading && (
        <div className="mt-3 p-2 rounded-md bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200/40 dark:border-blue-800/40 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-xs text-blue-700 dark:text-blue-300">
            <LoadingSpinner />
            <div>
              <div className="font-medium">Processing...</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Generating SQL query</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIQueryInput;
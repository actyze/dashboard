import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button, TextArea } from './ui';

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
      setQuery('');
      setIsExpanded(false);
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

  // Sample suggestions
  const suggestions = [
    "Show me sales data from the last quarter",
    "Create a chart of customer demographics", 
    "Find all orders over $1000 this month",
    "Compare revenue by region",
  ];

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
    <div className="w-full max-w-2xl mx-auto">
      {/* Main Input Container */}
      <div 
        className={`
          relative rounded-2xl border transition-all duration-300 ease-out
          ${isExpanded 
            ? 'shadow-xl ring-2 ring-blue-500/20 border-blue-300 dark:border-blue-600' 
            : 'shadow-lg border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600'
          }
          ${isDark ? 'bg-gray-800' : 'bg-white'}
        `}
        onFocus={handleFocus}
        onBlur={handleBlur}
        tabIndex={-1}
      >
        {/* AI Badge */}
        <div className="absolute -top-3 left-4">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold shadow-lg">
            <SparkleIcon />
            <span>AI SQL Assistant</span>
          </div>
        </div>

        {/* Input Area */}
        <div className="pt-6 p-4">
          <textarea
            ref={textAreaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your data... (e.g., 'Show sales by region')"
            className={`
              w-full resize-none border-none outline-none text-base leading-relaxed
              ${isDark ? 'bg-gray-800 text-white placeholder-gray-400' : 'bg-white text-gray-900 placeholder-gray-500'}
              min-h-[60px] max-h-[200px] overflow-y-auto
            `}
            rows={isExpanded ? 3 : 1}
          />
          
          {/* Action Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={!query.trim() || loading}
              variant="primary"
              size="sm"
              className="ml-3"
              leftIcon={loading ? <LoadingSpinner /> : <SendIcon />}
            >
              {loading ? 'Processing...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {isExpanded && !query && (
        <div className="mt-4 space-y-2 animate-fade-in">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">
            Try asking:
          </p>
          <div className="grid gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setQuery(suggestion)}
                className={`
                  text-left p-3 rounded-lg border transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                  }
                  hover:shadow-md hover:scale-[1.01]
                `}
              >
                <span className="text-sm">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Indicators */}
      {loading && (
        <div className="mt-4 flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
          <LoadingSpinner />
          <span>Analyzing your query and generating SQL...</span>
        </div>
      )}
    </div>
  );
};

export default AIQueryInput;
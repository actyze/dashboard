import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const AIQueryModal = ({ isOpen, onClose, onSubmit, loading = false }) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const textAreaRef = useRef(null);
  const modalRef = useRef(null);

  // Sample suggestions
  const suggestions = [
    "Show me sales data from the last quarter",
    "Create a chart of customer demographics", 
    "Find all orders over $1000 this month",
    "Compare revenue by region",
    "What are the top performing products?",
    "Show customer acquisition trends"
  ];

  useEffect(() => {
    if (isOpen && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      onSubmit(query.trim());
      setQuery('');
      onClose();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className={`
          relative w-full max-w-2xl mx-4 rounded-xl border shadow-2xl
          ${isDark 
            ? 'bg-gray-800/95 border-gray-600/50' 
            : 'bg-white/95 border-gray-200/50'
          }
          backdrop-blur-md animate-in zoom-in-95 duration-200
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Ask AI</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Describe what you want to analyze in natural language</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`
              p-1 rounded-md transition-colors
              ${isDark 
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Input Area */}
          <div className="mb-6">
            <textarea
              ref={textAreaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 'Show me monthly sales trends for the past year' or 'Which customers have the highest lifetime value?'"
              className={`
                w-full h-24 px-4 py-3 rounded-lg border resize-none
                ${isDark 
                  ? 'bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 focus:border-violet-500' 
                  : 'bg-gray-50/50 border-gray-200/50 text-gray-900 placeholder-gray-500 focus:border-violet-500'
                }
                focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all
              `}
            />
          </div>

          {/* Suggestions */}
          {!query && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Try these examples:</h3>
              <div className="grid grid-cols-1 gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`
                      text-left p-3 rounded-lg border transition-all duration-200 text-sm
                      ${isDark 
                        ? 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-600/50 text-gray-200 hover:border-gray-500/50' 
                        : 'bg-gray-50/50 border-gray-200/30 hover:bg-white text-gray-700 hover:border-gray-300'
                      }
                      hover:shadow-sm
                    `}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400"></div>
                      <span>{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Press Enter to submit, Shift+Enter for new line
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${isDark 
                    ? 'text-gray-300 hover:bg-gray-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || loading}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                  ${!query.trim() || loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white hover:shadow-lg'
                  }
                  disabled:opacity-50 flex items-center space-x-2
                `}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Generate Query</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIQueryModal;
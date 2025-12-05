import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// CSS for animated gradient border
const animatedBorderStyles = `
  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  .ai-input-wrapper {
    position: relative;
    border-radius: 10px;
    padding: 1px;
    background: linear-gradient(
      90deg,
      #3b82f6,
      #8b5cf6,
      #ec4899,
      #8b5cf6,
      #3b82f6
    );
    background-size: 200% 100%;
    animation: shimmer 4s ease-in-out infinite;
  }
  
  .ai-input-inner {
    border-radius: 9px;
    width: 100%;
    height: 100%;
  }
`;

const AIQueryInput = ({ onSubmit, loading = false }) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const textAreaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 120)}px`;
    }
  }, [query]);

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      onSubmit(query.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const SendIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );

  const LoadingSpinner = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );

  return (
    <div className="w-full mx-auto">
      <style>{animatedBorderStyles}</style>
      
      {/* Animated Border Wrapper */}
      <div className="ai-input-wrapper">
        {/* Inner Container */}
        <div className={`ai-input-inner ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <div className="px-4 py-3">
            {/* Input Row */}
            <div className="flex items-end gap-3">
              {/* Textarea */}
              <textarea
                ref={textAreaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your data... e.g., Show sales by region"
                className={`
                  flex-1 resize-none border-none outline-none text-sm leading-relaxed
                  ${isDark ? 'bg-transparent text-white placeholder-gray-500' : 'bg-transparent text-gray-900 placeholder-gray-400'}
                  min-h-[48px] max-h-[120px]
                `}
                rows={2}
              />
              
              {/* Send Button */}
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || loading}
                className={`
                  flex-shrink-0 w-8 h-8 mb-0.5 rounded-lg flex items-center justify-center
                  transition-all duration-200
                  ${!query.trim() || loading
                    ? `${isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'} cursor-not-allowed`
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white'
                  }
                `}
              >
                {loading ? <LoadingSpinner /> : <SendIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIQueryInput;
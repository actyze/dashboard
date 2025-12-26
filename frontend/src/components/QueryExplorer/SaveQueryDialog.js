import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const SaveQueryDialog = ({ 
  isOpen, 
  onClose, 
  onSave, 
  mode = 'new', // 'new' or 'update'
  currentName = '',
  loading = false
}) => {
  const { isDark } = useTheme();
  const [queryName, setQueryName] = useState(currentName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQueryName(currentName);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = queryName.trim();
    if (trimmedName && !loading) {
      onSave(trimmedName);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop, not on the dialog
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        className={`
          w-full max-w-md mx-4 rounded-lg shadow-xl
          ${isDark ? 'bg-[#1c1d1f] border border-gray-700' : 'bg-white'}
        `}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {mode === 'new' ? 'Save Query' : 'Update Query'}
          </h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {mode === 'new' 
              ? 'Give your query a name to save it for later'
              : 'Update the query name'}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <label 
              htmlFor="query-name" 
              className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Query Name
            </label>
            <input
              ref={inputRef}
              id="query-name"
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Monthly Sales Report"
              className={`
                w-full px-3 py-2 rounded-md border text-sm
                ${isDark 
                  ? 'bg-[#2a2b2e] border-gray-600 text-white placeholder-gray-500 focus:border-blue-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 flex justify-end gap-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`
                px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${isDark 
                  ? 'text-gray-300 hover:bg-gray-700 disabled:text-gray-600' 
                  : 'text-gray-700 hover:bg-gray-100 disabled:text-gray-400'
                }
                disabled:cursor-not-allowed
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !queryName.trim()}
              className={`
                px-4 py-2 text-sm font-medium rounded-md transition-colors
                bg-[#5d6ad3] text-white
                ${!loading && queryName.trim()
                  ? 'hover:bg-[#4f5bc4]' 
                  : 'opacity-50 cursor-not-allowed'
                }
                disabled:cursor-not-allowed
                flex items-center gap-2
              `}
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              )}
              {mode === 'new' ? 'Save Query' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveQueryDialog;


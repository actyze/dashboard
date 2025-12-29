import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const UnsavedChangesDialog = ({ 
  isOpen, 
  onSave, 
  onDiscard,
  onCancel,
  loading = false 
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className={`
          w-full max-w-md mx-4 rounded-xl shadow-2xl
          ${isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-start justify-between px-5 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
              <svg 
                className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Unsaved Changes
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                You have unsaved work in this query
              </p>
            </div>
          </div>
          
          {/* Close Button */}
          <button
            onClick={onCancel}
            disabled={loading}
            className={`
              p-1.5 rounded-lg transition-colors mt-0.5
              ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Would you like to save your changes before leaving? Any unsaved changes will be lost.
          </p>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={onDiscard}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${isDark 
                ? 'text-red-400 hover:bg-red-900/30 disabled:text-gray-600' 
                : 'text-red-600 hover:bg-red-50 disabled:text-gray-400'
              }
              disabled:cursor-not-allowed
            `}
          >
            Don't Save
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              bg-[#5d6ad3] text-white
              ${!loading ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesDialog;


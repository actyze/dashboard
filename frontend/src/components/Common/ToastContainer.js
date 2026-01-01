/**
 * Toast Container
 * Fixed position container for toast notifications
 * Renders in top-right corner, doesn't affect layout
 */

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';

const Toast = ({ toast, onRemove }) => {
  const { isDark } = useTheme();
  
  const icons = {
    success: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  const styles = {
    success: isDark 
      ? 'bg-green-900/90 border-green-700 text-green-200' 
      : 'bg-green-50 border-green-200 text-green-800',
    error: isDark 
      ? 'bg-red-900/90 border-red-700 text-red-200' 
      : 'bg-red-50 border-red-200 text-red-800',
    warning: isDark 
      ? 'bg-yellow-900/90 border-yellow-700 text-yellow-200' 
      : 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: isDark 
      ? 'bg-blue-900/90 border-blue-700 text-blue-200' 
      : 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const iconColors = {
    success: isDark ? 'text-green-400' : 'text-green-500',
    error: isDark ? 'text-red-400' : 'text-red-500',
    warning: isDark ? 'text-yellow-400' : 'text-yellow-500',
    info: isDark ? 'text-blue-400' : 'text-blue-500'
  };

  return (
    <div 
      className={`
        flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
        animate-slide-in min-w-[280px] max-w-[400px]
        ${styles[toast.type] || styles.info}
      `}
      role="alert"
    >
      <span className={`flex-shrink-0 ${iconColors[toast.type] || iconColors.info}`}>
        {icons[toast.type] || icons.info}
      </span>
      <span className="text-sm flex-1">{toast.message}</span>
      <button 
        onClick={() => onRemove(toast.id)} 
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

export default ToastContainer;


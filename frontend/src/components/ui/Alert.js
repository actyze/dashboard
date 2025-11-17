import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Alert = ({ 
  children,
  variant = 'info',
  title,
  dismissible = false,
  onClose,
  icon,
  className = '',
  ...props 
}) => {
  const { isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };
  
  if (!isVisible) return null;
  
  const variantClasses = {
    success: `
      bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800
      text-green-800 dark:text-green-200
    `,
    error: `
      bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800
      text-red-800 dark:text-red-200
    `,
    warning: `
      bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800
      text-yellow-800 dark:text-yellow-200
    `,
    info: `
      bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800
      text-blue-800 dark:text-blue-200
    `,
    neutral: `
      bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700
      text-gray-800 dark:text-gray-200
    `,
  };
  
  const iconClasses = {
    success: 'text-green-400 dark:text-green-300',
    error: 'text-red-400 dark:text-red-300',
    warning: 'text-yellow-400 dark:text-yellow-300',
    info: 'text-blue-400 dark:text-blue-300',
    neutral: 'text-gray-400 dark:text-gray-300',
  };
  
  const defaultIcons = {
    success: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    info: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    neutral: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
  };
  
  const CloseIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
  
  return (
    <div 
      className={`
        rounded-lg border p-4 animate-fade-in
        ${variantClasses[variant]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${iconClasses[variant]}`}>
          {icon || defaultIcons[variant]}
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>
        
        {dismissible && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={handleClose}
                className={`
                  inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                  hover:bg-black/5 dark:hover:bg-white/5
                  ${iconClasses[variant]}
                `.trim().replace(/\s+/g, ' ')}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;
import React, { forwardRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Button = forwardRef(({ 
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onClick,
  className = '',
  type = 'button',
  ...props 
}, ref) => {
  const { isDark } = useTheme();
  
  const sizeClasses = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };
  
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
  `;
  
  const variantClasses = {
    primary: `
      bg-primary-600 hover:bg-primary-700 text-white
      focus:ring-primary-500 dark:focus:ring-offset-gray-900
      shadow-sm hover:shadow-md
    `,
    secondary: `
      bg-gray-100 hover:bg-gray-200 text-gray-900
      dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white
      focus:ring-gray-500 dark:focus:ring-offset-gray-900
      shadow-sm hover:shadow-md
    `,
    outline: `
      bg-transparent border border-gray-300 dark:border-gray-600
      text-gray-700 dark:text-gray-300
      hover:bg-gray-50 dark:hover:bg-gray-800
      focus:ring-gray-500 dark:focus:ring-offset-gray-900
    `,
    ghost: `
      bg-transparent text-gray-700 dark:text-gray-300
      hover:bg-gray-100 dark:hover:bg-gray-800
      focus:ring-gray-500 dark:focus:ring-offset-gray-900
    `,
    danger: `
      bg-red-600 hover:bg-red-700 text-white
      focus:ring-red-500 dark:focus:ring-offset-gray-900
      shadow-sm hover:shadow-md
    `,
    success: `
      bg-green-600 hover:bg-green-700 text-white
      focus:ring-green-500 dark:focus:ring-offset-gray-900
      shadow-sm hover:shadow-md
    `,
    warning: `
      bg-yellow-500 hover:bg-yellow-600 text-white
      focus:ring-yellow-500 dark:focus:ring-offset-gray-900
      shadow-sm hover:shadow-md
    `,
  };
  
  const LoadingSpinner = () => (
    <svg 
      className="animate-spin -ml-1 mr-2 h-4 w-4" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
  
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner />
          Loading...
        </>
      ) : (
        <>
          {leftIcon && (
            <span className="mr-2 flex-shrink-0">
              {leftIcon}
            </span>
          )}
          {children}
          {rightIcon && (
            <span className="ml-2 flex-shrink-0">
              {rightIcon}
            </span>
          )}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
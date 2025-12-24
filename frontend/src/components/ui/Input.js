import React, { forwardRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Input = forwardRef(({ 
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  error = false,
  errorMessage = '',
  label = '',
  required = false,
  size = 'md',
  variant = 'outline',
  className = '',
  icon,
  ...props 
}, ref) => {
  const { isDark } = useTheme();
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg'
  };
  
  const baseClasses = `
    w-full rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2
    ${sizeClasses[size]}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
  `;
  
  const variantClasses = {
    outline: `
      bg-white dark:bg-[#1c1d1f] 
      border-gray-300 dark:border-gray-600
      text-gray-900 dark:text-white
      placeholder-gray-500 dark:placeholder-gray-400
      focus:border-primary-500 focus:ring-primary-500/20
      ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
    `,
    filled: `
      bg-gray-100 dark:bg-gray-700
      border-transparent
      text-gray-900 dark:text-white
      placeholder-gray-500 dark:placeholder-gray-400
      focus:bg-white dark:focus:bg-[#1c1d1f]
      focus:border-primary-500 focus:ring-primary-500/20
      ${error ? 'bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20' : ''}
    `,
    ghost: `
      bg-transparent
      border-transparent
      text-gray-900 dark:text-white
      placeholder-gray-500 dark:placeholder-gray-400
      hover:bg-gray-100 dark:hover:bg-[#1c1d1f]
      focus:bg-white dark:focus:bg-[#1c1d1f]
      focus:border-primary-500 focus:ring-primary-500/20
      ${error ? 'focus:border-red-500 focus:ring-red-500/20' : ''}
    `
  };
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400 dark:text-gray-500">
              {icon}
            </div>
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            ${baseClasses}
            ${variantClasses[variant]}
            ${icon ? 'pl-10' : ''}
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          {...props}
        />
      </div>
      
      {error && errorMessage && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 animate-fade-in">
          {errorMessage}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
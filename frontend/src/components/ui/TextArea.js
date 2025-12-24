import React, { forwardRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const TextArea = forwardRef(({ 
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
  rows = 4,
  resize = 'vertical',
  variant = 'outline',
  className = '',
  maxLength,
  showCharCount = false,
  ...props 
}, ref) => {
  const { isDark } = useTheme();
  
  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize',
  };
  
  const baseClasses = `
    w-full rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2
    px-4 py-3 text-base
    ${resizeClasses[resize]}
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
  
  const currentLength = value?.length || 0;
  const isNearLimit = maxLength && currentLength > maxLength * 0.8;
  const isOverLimit = maxLength && currentLength > maxLength;
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          className={`
            ${baseClasses}
            ${variantClasses[variant]}
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          {...props}
        />
      </div>
      
      <div className="flex justify-between items-start mt-2">
        {error && errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400 animate-fade-in">
            {errorMessage}
          </p>
        )}
        
        {showCharCount && maxLength && (
          <p className={`
            text-xs ml-auto
            ${isOverLimit ? 'text-red-600 dark:text-red-400' : 
              isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 
              'text-gray-500 dark:text-gray-400'}
          `.trim().replace(/\s+/g, ' ')}>
            {currentLength}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Card = ({ 
  children,
  variant = 'default',
  padding = 'md',
  shadow = 'md',
  bordered = false,
  hoverable = false,
  className = '',
  onClick,
  ...props 
}) => {
  const { isDark } = useTheme();
  
  const paddingClasses = {
    none: 'p-0',
    xs: 'p-2',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };
  
  const shadowClasses = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  };
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-800',
    primary: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800',
    secondary: 'bg-gray-50 dark:bg-gray-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    gradient: 'bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20',
  };
  
  const baseClasses = `
    rounded-lg transition-all duration-200
    ${paddingClasses[padding]}
    ${shadowClasses[shadow]}
    ${variantClasses[variant]}
    ${bordered ? 'border border-gray-200 dark:border-gray-700' : ''}
    ${hoverable ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer' : ''}
    ${onClick ? 'cursor-pointer' : ''}
  `;
  
  return (
    <div 
      className={`${baseClasses} ${className}`.trim().replace(/\s+/g, ' ')}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

// Card Header component
Card.Header = ({ 
  children, 
  className = '', 
  divider = true,
  ...props 
}) => (
  <div 
    className={`
      ${divider ? 'pb-4 mb-4 border-b border-gray-200 dark:border-gray-700' : ''}
      ${className}
    `.trim().replace(/\s+/g, ' ')} 
    {...props}
  >
    {children}
  </div>
);

// Card Body component
Card.Body = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <div className={`${className}`.trim()} {...props}>
    {children}
  </div>
);

// Card Footer component
Card.Footer = ({ 
  children, 
  className = '', 
  divider = true,
  ...props 
}) => (
  <div 
    className={`
      ${divider ? 'pt-4 mt-4 border-t border-gray-200 dark:border-gray-700' : ''}
      ${className}
    `.trim().replace(/\s+/g, ' ')} 
    {...props}
  >
    {children}
  </div>
);

// Card Title component
Card.Title = ({ 
  children, 
  size = 'lg',
  className = '', 
  ...props 
}) => {
  const sizeClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-lg font-semibold',
    xl: 'text-xl font-bold',
    '2xl': 'text-2xl font-bold',
  };
  
  return (
    <h3 
      className={`
        text-gray-900 dark:text-white
        ${sizeClasses[size]}
        ${className}
      `.trim().replace(/\s+/g, ' ')} 
      {...props}
    >
      {children}
    </h3>
  );
};

// Card Description component
Card.Description = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <p 
    className={`
      text-gray-600 dark:text-gray-300 text-sm
      ${className}
    `.trim().replace(/\s+/g, ' ')} 
    {...props}
  >
    {children}
  </p>
);

// Card Image component
Card.Image = ({ 
  src, 
  alt, 
  className = '',
  rounded = true,
  ...props 
}) => (
  <img 
    src={src}
    alt={alt}
    className={`
      w-full h-auto object-cover
      ${rounded ? 'rounded-t-lg' : ''}
      ${className}
    `.trim().replace(/\s+/g, ' ')}
    {...props}
  />
);

// Card Actions component
Card.Actions = ({ 
  children, 
  className = '',
  justify = 'end',
  ...props 
}) => {
  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };
  
  return (
    <div 
      className={`
        flex items-center space-x-2
        ${justifyClasses[justify]}
        ${className}
      `.trim().replace(/\s+/g, ' ')} 
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
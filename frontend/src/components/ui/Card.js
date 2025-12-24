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
    default: isDark ? 'bg-[#1c1d1f]' : 'bg-white',
    primary: isDark ? 'bg-[#1c1d1f] border-[#2a2b2e]' : 'bg-primary-50 border-primary-200',
    secondary: isDark ? 'bg-[#18181a]' : 'bg-gray-50',
    success: isDark ? 'bg-[#1c1d1f] border-green-800' : 'bg-green-50 border-green-200',
    warning: isDark ? 'bg-[#1c1d1f] border-yellow-800' : 'bg-yellow-50 border-yellow-200',
    error: isDark ? 'bg-[#1c1d1f] border-red-800' : 'bg-red-50 border-red-200',
    gradient: isDark ? 'bg-[#1c1d1f]' : 'bg-gradient-to-br from-primary-50 to-primary-100',
  };
  
  const baseClasses = `
    rounded-lg transition-all duration-200
    ${paddingClasses[padding]}
    ${shadowClasses[shadow]}
    ${variantClasses[variant]}
    ${bordered ? (isDark ? 'border border-[#2a2b2e]' : 'border border-gray-200') : ''}
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

// Card Header component - using Tailwind dark: prefix for border colors
const CardHeader = ({ 
  children, 
  className = '', 
  divider = true,
  ...props 
}) => (
  <div 
    className={`
      ${divider ? 'pb-4 mb-4 border-b border-gray-200 dark:border-[#2a2b2e]' : ''}
      ${className}
    `.trim().replace(/\s+/g, ' ')} 
    {...props}
  >
    {children}
  </div>
);

// Card Body component
const CardBody = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <div className={`${className}`.trim()} {...props}>
    {children}
  </div>
);

// Card Footer component - using Tailwind dark: prefix for border colors
const CardFooter = ({ 
  children, 
  className = '', 
  divider = true,
  ...props 
}) => (
  <div 
    className={`
      ${divider ? 'pt-4 mt-4 border-t border-gray-200 dark:border-[#2a2b2e]' : ''}
      ${className}
    `.trim().replace(/\s+/g, ' ')} 
    {...props}
  >
    {children}
  </div>
);

// Card Title component
const CardTitle = ({ 
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
const CardDescription = ({ 
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
const CardImage = ({ 
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
const CardActions = ({ 
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

// Attach subcomponents
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Image = CardImage;
Card.Actions = CardActions;

export default Card;

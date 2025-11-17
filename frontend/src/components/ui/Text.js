import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Text = ({ 
  children,
  variant = 'body',
  size = 'md',
  weight = 'normal',
  color = 'default',
  align = 'left',
  truncate = false,
  className = '',
  as: Component = 'p',
  ...props 
}) => {
  const { isDark } = useTheme();
  
  const variantClasses = {
    h1: 'text-4xl font-bold tracking-tight',
    h2: 'text-3xl font-bold tracking-tight', 
    h3: 'text-2xl font-semibold tracking-tight',
    h4: 'text-xl font-semibold tracking-tight',
    h5: 'text-lg font-semibold',
    h6: 'text-base font-semibold',
    subtitle1: 'text-lg font-medium',
    subtitle2: 'text-base font-medium',
    body: 'text-base',
    caption: 'text-sm',
    overline: 'text-xs uppercase tracking-wide',
  };
  
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
  };
  
  const weightClasses = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
  };
  
  const colorClasses = {
    default: 'text-gray-900 dark:text-white',
    secondary: 'text-gray-600 dark:text-gray-300',
    muted: 'text-gray-500 dark:text-gray-400',
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    white: 'text-white',
    black: 'text-black',
  };
  
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  };
  
  // Use variant size if size prop is not explicitly set and variant is heading
  const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(variant);
  const finalSizeClass = isHeading && size === 'md' ? '' : sizeClasses[size];
  
  const classes = `
    ${variantClasses[variant] || ''}
    ${finalSizeClass || ''}
    ${weightClasses[weight]}
    ${colorClasses[color]}
    ${alignClasses[align]}
    ${truncate ? 'truncate' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');
  
  // Auto-select component based on variant
  const getComponent = () => {
    if (Component !== 'p') return Component;
    
    switch (variant) {
      case 'h1': return 'h1';
      case 'h2': return 'h2';
      case 'h3': return 'h3';
      case 'h4': return 'h4';
      case 'h5': return 'h5';
      case 'h6': return 'h6';
      case 'caption': return 'span';
      case 'overline': return 'span';
      default: return 'p';
    }
  };
  
  const FinalComponent = getComponent();
  
  return (
    <FinalComponent className={classes} {...props}>
      {children}
    </FinalComponent>
  );
};

export default Text;
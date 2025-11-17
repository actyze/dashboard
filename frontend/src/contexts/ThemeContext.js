import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    
    // Update document class for Tailwind dark mode
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const theme = {
    isDark,
    toggleTheme,
    colors: {
      // Light theme colors
      light: {
        bg: 'bg-white',
        bgSecondary: 'bg-gray-50',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        border: 'border-gray-200',
        hover: 'hover:bg-gray-50',
        primary: 'bg-blue-500',
        primaryHover: 'hover:bg-blue-600',
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
      },
      // Dark theme colors
      dark: {
        bg: 'dark:bg-gray-900',
        bgSecondary: 'dark:bg-gray-800',
        text: 'dark:text-white',
        textSecondary: 'dark:text-gray-300',
        border: 'dark:border-gray-700',
        hover: 'dark:hover:bg-gray-800',
        primary: 'dark:bg-blue-600',
        primaryHover: 'dark:hover:bg-blue-700',
        success: 'dark:bg-green-600',
        error: 'dark:bg-red-600',
        warning: 'dark:bg-yellow-600',
      }
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
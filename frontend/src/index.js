import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider, useTheme } from './contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QUERY_CONFIG } from './config/queryConfig';

// Create QueryClient with default configuration (no caching)
// Different services can have different cache settings via QUERY_CONFIG
const queryClient = new QueryClient({
  defaultOptions: {
    queries: QUERY_CONFIG.rest, // Default to REST config
    mutations: {
      retry: 1,
    },
  },
});

const AppWithTheme = () => {
  const { isDark } = useTheme();
  
  const muiTheme = createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
      background: {
        default: isDark ? '#111827' : '#ffffff',
        paper: isDark ? '#1f2937' : '#ffffff',
      },
    },
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <AppWithTheme />
      </CustomThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

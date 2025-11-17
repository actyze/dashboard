import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider, useTheme } from './contexts/ThemeContext';

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
    <CustomThemeProvider>
      <AppWithTheme />
    </CustomThemeProvider>
  </React.StrictMode>
);

import React, { useState, useEffect } from 'react';
import { 
  AppBar,
  Toolbar,
  Typography,
  CircularProgress,
  Box
} from '@mui/material';
import axios from 'axios';
import ModernDashboard from './components/ModernDashboard';
import { Alert } from './components/ui';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  
  // Check backend API status on component mount - DISABLED FOR FRONTEND-ONLY DEVELOPMENT
  useEffect(() => {
    // Mock successful API status for frontend-only development
    setApiStatus({ status: 'Frontend-only mode' });
    setError(null);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <CircularProgress />
          <Typography className="mt-4" color="textSecondary">
            Loading dashboard...
          </Typography>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-md w-full px-6">
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
          <div className="text-center">
            <button 
              onClick={() => window.location.reload()} 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      {/* Global header with theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      
      <ModernDashboard />
    </div>
  );
}

export default App;

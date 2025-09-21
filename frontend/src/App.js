import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Grid,
  Paper,
  TextField,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  AppBar,
  Toolbar,
  Container,
  CircularProgress,
  Alert
} from '@mui/material';
import axios from 'axios';
import Dashboard from './components/Dashboard';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  
  // Check backend API status on component mount
  useEffect(() => {
    const checkApiStatus = async () => {
      setLoading(true);
      try {
        const apiBase = "/api";  // Using relative URL with React proxy configuration
        const response = await axios.get(`${apiBase}/status`);
        setApiStatus(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching API status:', err);
        setError('Unable to connect to backend API. Please ensure the server is running.');
      } finally {
        setLoading(false);
      }
    };
    
    checkApiStatus();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Dashboard Application
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        ) : (
          <>
            {apiStatus && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Backend API Status: {apiStatus.status}
              </Alert>
            )}
            <Dashboard />
          </>
        )}
      </Container>
    </Box>
  );
}

export default App;

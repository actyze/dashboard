import React, { useState } from 'react';
import { 
  Box, 
  Grid, 
  Typography, 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  Divider, 
  Chip 
} from '@mui/material';
import ChatInput from './ChatInput';
import SqlQuery from './SqlQuery';
import Chart from './Chart';
import QueryResults from './QueryResults';
import { useTheme } from '../contexts/ThemeContext';
import { useProcessNaturalLanguage } from '../hooks';
import { formatSuccessMessage, formatErrorMessage } from '../utils/dataTransformers';

const Dashboard = () => {
  const { isDark } = useTheme();
  const [sqlQuery, setSqlQuery] = useState("SELECT column1,column3\nFROM table_name\nWHERE column1='example'\nORDER BY column2;");
  const [backendResponse, setBackendResponse] = useState('');
  const [queryError, setQueryError] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [chartData, setChartData] = useState(null);

  const { 
    mutate: processNaturalLanguage, 
    isPending: queryLoading 
  } = useProcessNaturalLanguage({
    onSuccess: (response) => {
      if (response.success && response.generatedSql) {
        setSqlQuery(response.generatedSql);
        setQueryResults(response.queryResults);
        setChartData(response.chartData);
        setBackendResponse(formatSuccessMessage(response));
        setQueryError(null);
      } else {
        const errorMsg = response.error || 'Failed to process query';
        setQueryError(errorMsg);
        setBackendResponse(formatErrorMessage(errorMsg));
      }
    },
    onError: (error) => {
      console.error('Natural language processing failed:', error);
      setQueryError(error.message);
      setBackendResponse(formatErrorMessage(error.message));
    }
  });
  
  // Backend API call function
  const executeQueryWithChart = async (query, chartType = 'bar') => {
    setQueryLoading(true);
    setQueryError(null);
    
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          type: 'sql',
          chartType: chartType,
          includeChart: true
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Set both chart and query results from backend response
      // Transform chartData structure to match Chart component expectations
      if (result.chartData) {
        console.log('Backend chartData:', result.chartData);
        console.log('Backend queryResults:', result.queryResults);
        
        const transformedChartData = {
          chart: {
            type: result.chartData.type,
            config: result.chartData.config,
            fallback: false
          },
          data: result.queryResults, // Use queryResults as the data source
          cached: false
        };
        
        console.log('Transformed chartData:', transformedChartData);
        setChartData(transformedChartData);
      }
      setQueryResults(result.queryResults);
      setBackendResponse(`Query executed successfully. ${result.queryResults?.rowCount || 0} rows returned.`);
      
    } catch (error) {
      console.error('Query execution failed:', error);
      setQueryError(error.message);
      setBackendResponse(`Error: ${error.message}`);
    } finally {
      setQueryLoading(false);
    }
  };

  // FastAPI status state (commented out for now since we're not using FastAPI)
  // const [fastApiStatus, setFastApiStatus] = useState('Unknown');
  // useEffect(() => {
  //   fetch('http://localhost:8000/health')
  //     .then(res => res.ok ? setFastApiStatus('Online') : setFastApiStatus('Offline'))
  //     .catch(() => setFastApiStatus('Offline'));
  // }, []);

  // Handle SQL query execution
  const handleExecuteQuery = () => {
    executeQueryWithChart(sqlQuery);
  };

  // Handle data changes from QueryResults component
  const handleDataChange = (updatedData) => {
    setQueryResults(updatedData);
  };

  // Handle chat input submission with complete NL-to-SQL-to-Chart workflow
  const handleChatSubmit = (message) => {
    setQueryError(null);
    setBackendResponse('Processing natural language query...');
    
    // Use the React Query hook to process the query
    processNaturalLanguage({
      message,
      conversationHistory: []
    });
  };
  
  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 150px)' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: 250,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 250,
            boxSizing: 'border-box',
            position: 'relative',
            borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
            height: '100%',
            backgroundColor: isDark ? '#1f2937' : '#fff',
            color: isDark ? '#fff' : '#000',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', mb: 2 }}>
            Dashboards
          </Typography>
          <List>
            <ListItem button>
              <ListItemText primary="Project Gamma" />
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem button>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Dashboard Name <Chip size="small" label="Draft" />
                  </Box>
                }
              />
            </ListItem>
            <ListItem button>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Dashboard Name <Chip size="small" label="Published" />
                  </Box>
                }
              />
            </ListItem>
            <ListItem button>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Dashboard Name <Chip size="small" label="Published" />
                  </Box>
                }
              />
            </ListItem>
            <ListItem button>
              <ListItemText primary="Dashboard Name" />
            </ListItem>
            <ListItem button>
              <ListItemText primary="Draft" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, p: 0, overflow: 'hidden' }}>
        {/* Chat section */}
        <Box sx={{ 
          p: 2, 
          backgroundColor: isDark ? '#374151' : '#f5f5f5'
        }}>
          <Box 
            sx={{ 
              backgroundColor: isDark ? '#4b5563' : '#e0e0e0', 
              p: 2, 
              borderRadius: 1,
              display: 'inline-block',
              maxWidth: '60%'
            }}
          >
            <Typography sx={{ color: isDark ? '#fff' : 'inherit' }}>
              Hello! How can I assist you today?
            </Typography>
          </Box>
          <ChatInput onSubmit={handleChatSubmit} />
        </Box>

        {/* SQL Query and Chart grid */}
        <Box sx={{ p: 2, display: 'flex', flex: 1 }}>
          <Grid container spacing={2}>
            {/* SQL Query section */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1 }}>SQL Query</Typography>
              <SqlQuery sqlQuery={sqlQuery} setSqlQuery={setSqlQuery} backendResponse={backendResponse} onExecute={handleExecuteQuery} />
            </Grid>
            
            {/* Chart section using new Chart component */}
            <Grid item xs={12} md={6}>
              <Chart 
                chartData={chartData}
                loading={queryLoading}
                error={queryError}
              />
            </Grid>

            {/* Query Results section using new QueryResults component */}
            <Grid item xs={12}>
              <QueryResults 
                queryData={queryResults}
                loading={queryLoading}
                error={queryError}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;

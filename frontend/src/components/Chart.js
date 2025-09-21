import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert, Chip, Stack } from '@mui/material';
import Plot from 'react-plotly.js';

const Chart = ({ chartData, loading = false, error = null }) => {
  const [plotData, setPlotData] = useState([]);
  const [layout, setLayout] = useState({});
  const [chartInfo, setChartInfo] = useState(null);

  useEffect(() => {
    if (chartData && chartData.chart && chartData.data) {
      processChartData(chartData);
    }
  }, [chartData]);

  const processChartData = (data) => {
    try {
      console.log('Chart component received data:', data);
      const { chart, data: queryData } = data;
      
      // Set chart info for display
      setChartInfo({
        type: chart.type || 'table',
        cached: data.cached || false,
        rowCount: queryData.rowCount || 0,
        fallback: chart.fallback || false
      });

      // Process chart configuration from MCP server
      if (chart.config && queryData.data) {
        console.log('Processing chart with config:', chart.config);
        console.log('Query data:', queryData.data);
        const processedData = createPlotlyData(chart, queryData);
        const processedLayout = createPlotlyLayout(chart, queryData);
        
        console.log('Processed plotly data:', processedData);
        setPlotData(processedData);
        setLayout(processedLayout);
      } else {
        console.log('Using fallback chart');
        // Fallback to basic chart
        createFallbackChart(queryData);
      }
    } catch (err) {
      console.error('Error processing chart data:', err);
      setPlotData([]);
      setLayout({});
    }
  };

  const createPlotlyData = (chart, queryData) => {
    const { config } = chart;
    const { data, columns } = queryData;

    if (!data || !columns || data.length === 0) {
      return [];
    }

    const chartType = chart.type || 'bar';
    
    switch (chartType) {
      case 'bar':
      case 'column':
        return [{
          type: 'bar',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          marker: { 
            color: '#1976d2',
            opacity: 0.8
          },
          name: config.yField
        }];

      case 'line':
        return [{
          type: 'scatter',
          mode: 'lines+markers',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          line: { 
            color: '#1976d2',
            width: 2
          },
          marker: { size: 6 },
          name: config.yField
        }];

      case 'scatter':
        return [{
          type: 'scatter',
          mode: 'markers',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          marker: { 
            color: '#1976d2',
            size: 8,
            opacity: 0.7
          },
          name: `${config.xField} vs ${config.yField}`
        }];

      case 'pie':
        const pieData = data.reduce((acc, row) => {
          const key = row[config.xField];
          const value = parseFloat(row[config.yField]) || 0;
          acc[key] = (acc[key] || 0) + value;
          return acc;
        }, {});

        return [{
          type: 'pie',
          labels: Object.keys(pieData),
          values: Object.values(pieData),
          textinfo: 'label+percent',
          textposition: 'outside',
          marker: {
            colors: ['#1976d2', '#dc004e', '#f57c00', '#388e3c', '#7b1fa2', '#d32f2f']
          }
        }];

      case 'area':
        return [{
          type: 'scatter',
          mode: 'lines',
          fill: 'tonexty',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          line: { color: '#1976d2' },
          fillcolor: 'rgba(25, 118, 210, 0.3)',
          name: config.yField
        }];

      default:
        return createFallbackChart(queryData);
    }
  };

  const createPlotlyLayout = (chart, queryData) => {
    const { config } = chart;
    const chartType = chart.type || 'bar';

    const baseLayout = {
      autosize: true,
      margin: { l: 60, r: 30, t: 30, b: 60 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#ffffff',
      font: { family: 'Roboto, sans-serif', size: 12 },
      showlegend: chartType === 'pie' ? false : true,
      legend: {
        orientation: 'h',
        y: -0.2,
        x: 0.5,
        xanchor: 'center'
      }
    };

    if (chartType !== 'pie') {
      baseLayout.xaxis = {
        title: config?.xField || 'X Axis',
        gridcolor: '#f0f0f0',
        zeroline: false
      };
      baseLayout.yaxis = {
        title: config?.yField || 'Y Axis',
        gridcolor: '#f0f0f0',
        zeroline: false
      };
    }

    return baseLayout;
  };

  const createFallbackChart = (queryData) => {
    const { data, columns } = queryData;
    
    if (!data || !columns || data.length === 0) {
      setPlotData([]);
      return;
    }

    // Find first numeric column for Y axis
    const numericColumn = columns.find(col => col.type === 'number');
    const stringColumn = columns.find(col => col.type === 'string');

    if (numericColumn && stringColumn) {
      const fallbackData = [{
        type: 'bar',
        x: data.map(row => row[stringColumn.name]),
        y: data.map(row => row[numericColumn.name]),
        marker: { color: '#1976d2', opacity: 0.8 }
      }];
      
      setPlotData(fallbackData);
      setLayout({
        autosize: true,
        margin: { l: 60, r: 30, t: 30, b: 60 },
        xaxis: { title: stringColumn.label || stringColumn.name },
        yaxis: { title: numericColumn.label || numericColumn.name },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff'
      });
    } else {
      setPlotData([]);
    }
  };

  const renderChartInfo = () => {
    if (!chartInfo) return null;

    return (
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip 
          label={chartInfo.type.toUpperCase()} 
          size="small" 
          color="primary" 
          variant="outlined" 
        />
        {chartInfo.cached && (
          <Chip 
            label="CACHED" 
            size="small" 
            color="success" 
            variant="outlined" 
          />
        )}
        {chartInfo.fallback && (
          <Chip 
            label="FALLBACK" 
            size="small" 
            color="warning" 
            variant="outlined" 
          />
        )}
        <Chip 
          label={`${chartInfo.rowCount} rows`} 
          size="small" 
          variant="outlined" 
        />
      </Stack>
    );
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2, height: 'calc(100% - 40px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Generating chart...
          </Typography>
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2, height: 'calc(100% - 40px)' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Unable to generate chart. Please try again or check your query.
        </Typography>
      </Paper>
    );
  }

  if (!chartData || !plotData || plotData.length === 0) {
    return (
      <Paper sx={{ p: 2, height: 'calc(100% - 40px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Chart Data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execute a query to generate a chart
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, height: 'calc(100% - 40px)' }}>
      {renderChartInfo()}
      <Box sx={{ height: 'calc(100% - 60px)' }}>
        <Plot
          data={plotData}
          layout={layout}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
          config={{ 
            responsive: true, 
            displayModeBar: false,
            doubleClick: 'reset'
          }}
        />
      </Box>
    </Paper>
  );
};

export default Chart;

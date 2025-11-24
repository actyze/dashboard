import React, { useState, useEffect } from 'react';
import { Typography } from '@mui/material';
import Plot from 'react-plotly.js';
import { Alert } from './ui';
import { useTheme } from '../contexts/ThemeContext';

const Chart = ({ chartData, loading = false, error = null }) => {
  const { isDark } = useTheme();
  const [plotData, setPlotData] = useState([]);
  const [layout, setLayout] = useState({});
  const [chartInfo, setChartInfo] = useState(null);

  useEffect(() => {
    if (chartData && chartData.chart && chartData.data) {
      processChartData(chartData);
    } else {
      // Clear chart data when no valid data
      setPlotData([]);
      setLayout({});
      setChartInfo(null);
    }
  }, [chartData, chartData?.chart?.type]); 

  const processChartData = (data) => {
    try {
      console.log('Chart component received data:', data);
      const { chart, data: queryData } = data;

      setPlotData([]);
      setLayout({});
      
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
        setTimeout(() => {
          setPlotData(processedData);
          setLayout(processedLayout);
        }, 10);
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
            color: 'rgba(59, 130, 246, 0.8)',
            line: {
              color: 'rgba(59, 130, 246, 1)',
              width: 1
            }
          },
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
          name: config.yField
        }];

      case 'line':
        return [{
          type: 'scatter',
          mode: 'lines+markers',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          line: { 
            color: 'rgba(16, 185, 129, 0.9)',
            width: 3,
            shape: 'spline'
          },
          marker: { 
            size: 8,
            color: 'rgba(16, 185, 129, 1)',
            line: {
              color: 'rgba(255, 255, 255, 0.8)',
              width: 2
            }
          },
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
          name: config.yField
        }];

      case 'scatter':
        return [{
          type: 'scatter',
          mode: 'markers',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          marker: { 
            color: 'rgba(139, 69, 19, 0.7)',
            size: 10,
            line: {
              color: 'rgba(139, 69, 19, 1)',
              width: 1
            }
          },
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
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
            colors: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(16, 185, 129, 0.8)', 
              'rgba(245, 158, 11, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              'rgba(139, 92, 246, 0.8)',
              'rgba(236, 72, 153, 0.8)'
            ]
          },
          hovertemplate: '<b>%{label}</b><br>%{value} (%{percent})<extra></extra>'
        }];

      case 'area':
        return [{
          type: 'scatter',
          mode: 'lines',
          fill: 'tonexty',
          x: data.map(row => row[config.xField]),
          y: data.map(row => row[config.yField]),
          line: { 
            color: 'rgba(167, 139, 250, 1)',
            width: 2,
            shape: 'spline'
          },
          fillcolor: 'rgba(167, 139, 250, 0.3)',
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
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
      margin: { l: 60, r: 30, t: 40, b: 60 },
      plot_bgcolor: isDark ? 'rgba(17, 24, 39, 0.3)' : 'rgba(249, 250, 251, 0.5)',
      paper_bgcolor: 'transparent',
      font: { 
        family: 'Inter, system-ui, sans-serif', 
        size: 12,
        color: isDark ? '#e5e7eb' : '#374151'
      },
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
        title: {
          text: config?.xField || 'X Axis',
          font: { size: 14, color: isDark ? '#d1d5db' : '#6b7280' }
        },
        gridcolor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
        tickcolor: isDark ? '#4b5563' : '#d1d5db',
        linecolor: isDark ? '#4b5563' : '#d1d5db',
        zeroline: false
      };
      baseLayout.yaxis = {
        title: {
          text: config?.yField || 'Y Axis',
          font: { size: 14, color: isDark ? '#d1d5db' : '#6b7280' }
        },
        gridcolor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
        tickcolor: isDark ? '#4b5563' : '#d1d5db',
        linecolor: isDark ? '#4b5563' : '#d1d5db',
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
        marker: { 
          color: 'rgba(59, 130, 246, 0.8)',
          line: {
            color: 'rgba(59, 130, 246, 1)',
            width: 1
          }
        },
        hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>'
      }];
      
      setTimeout(() => {
        setPlotData(fallbackData);
        setLayout({
        autosize: true,
        margin: { l: 60, r: 30, t: 40, b: 60 },
        xaxis: { 
          title: {
            text: stringColumn.label || stringColumn.name,
            font: { size: 14, color: isDark ? '#d1d5db' : '#6b7280' }
          },
          gridcolor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
          tickcolor: isDark ? '#4b5563' : '#d1d5db',
          linecolor: isDark ? '#4b5563' : '#d1d5db'
        },
        yaxis: { 
          title: {
            text: numericColumn.label || numericColumn.name,
            font: { size: 14, color: isDark ? '#d1d5db' : '#6b7280' }
          },
          gridcolor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
          tickcolor: isDark ? '#4b5563' : '#d1d5db',
          linecolor: isDark ? '#4b5563' : '#d1d5db'
        },
        plot_bgcolor: isDark ? 'rgba(17, 24, 39, 0.3)' : 'rgba(249, 250, 251, 0.5)',
        paper_bgcolor: 'transparent',
        font: { 
          family: 'Inter, system-ui, sans-serif', 
          color: isDark ? '#e5e7eb' : '#374151'
        }
      });
      }, 10);
    } else {
      setPlotData([]);
    }
  };

  const renderChartInfo = () => {
    // Don't render chart info badges
    return null;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 dark:border-blue-800 animate-spin border-t-blue-500 dark:border-t-blue-400"></div>
          </div>
          <Typography variant="body2" color="text.secondary" className="font-medium">
            Generating chart...
          </Typography>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center">
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Unable to generate chart.
          </Typography>
        </div>
      </div>
    );
  }

  if (!chartData || !plotData || plotData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <Typography variant="h6" color="text.secondary" gutterBottom className="font-semibold">
            No Chart Data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execute a query to generate a chart
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Plot
        data={plotData}
        layout={layout}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        config={{ 
          responsive: true, 
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
          doubleClick: 'reset'
        }}
      />
    </div>
  );
};

export default Chart;

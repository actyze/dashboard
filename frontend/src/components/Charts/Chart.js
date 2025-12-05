import React, { useState, useEffect, useCallback } from 'react';
import { Typography } from '@mui/material';
import Plot from 'react-plotly.js';
import { Alert } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';
import ChartTypeSelector from './ChartTypeSelector';
import ManualAxisSelector from './ManualAxisSelector';

// Color palette for charts
const CHART_COLORS = [
  'rgba(59, 130, 246, 0.8)',   // Blue
  'rgba(16, 185, 129, 0.8)',   // Green
  'rgba(245, 158, 11, 0.8)',   // Amber
  'rgba(239, 68, 68, 0.8)',    // Red
  'rgba(139, 92, 246, 0.8)',   // Purple
  'rgba(236, 72, 153, 0.8)',   // Pink
  'rgba(6, 182, 212, 0.8)',    // Cyan
  'rgba(249, 115, 22, 0.8)',   // Orange
  'rgba(34, 197, 94, 0.8)',    // Emerald
  'rgba(168, 85, 247, 0.8)',   // Violet
];

/**
 * Chart component with two modes:
 * 1. LLM Mode: Uses LLM-recommended x/y axes from NL query
 * 2. Manual Mode: User selects axes (for direct SQL execution or override)
 * 
 * Manual mode uses cached queryResults - no re-execution needed.
 */
const Chart = ({ chartData, loading = false, error = null, onChartTypeChange = null }) => {
  const { isDark } = useTheme();
  const [plotData, setPlotData] = useState([]);
  const [layout, setLayout] = useState({});
  const [chartInfo, setChartInfo] = useState(null);
  const [selectedChartType, setSelectedChartType] = useState('bar');
  
  // Manual mode state
  // Triggered when: 1) Direct SQL execution (no LLM), 2) User clicks "Configure" to override
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualXAxis, setManualXAxis] = useState('');
  const [manualYAxis, setManualYAxis] = useState('');
  const [manualChartConfigured, setManualChartConfigured] = useState(false);

  // Create Plotly data based on chart type
  const createPlotlyDataForType = useCallback((chartType, queryData, chartConfig) => {
    if (!queryData || !queryData.data || !queryData.columns) {
      return { plotData: [], layout: {} };
    }

    const config = chartConfig || {
      xField: queryData.columns[0]?.name,
      yField: queryData.columns[1]?.name
    };

    const processedData = createPlotlyData(chartType, config, queryData);
    const processedLayout = createPlotlyLayout(chartType, config, queryData);

    return { plotData: processedData, layout: processedLayout };
  }, [isDark]);

  // Process chart data when chartData changes
  const processChartData = useCallback((data, overrideType = null) => {
    try {
      console.log('Chart component processing data:', data, 'overrideType:', overrideType);
      const { chart, data: queryData } = data;
      const chartType = overrideType || chart?.type || 'bar';

      // Set chart info for display
      setChartInfo({
        type: chartType,
        cached: data.cached || false,
        rowCount: queryData?.rowCount || 0,
        fallback: chart?.fallback || false
      });

      // Process chart configuration
      if (queryData?.data) {
        console.log('Processing chart with type:', chartType);
        const { plotData: newPlotData, layout: newLayout } = createPlotlyDataForType(
          chartType, 
          queryData, 
          chart?.config
        );
        
        console.log('Setting plotData:', newPlotData);
        setPlotData(newPlotData);
        setLayout(newLayout);
      } else {
        console.log('No queryData.data available');
        setPlotData([]);
        setLayout({});
      }
    } catch (err) {
      console.error('Error processing chart data:', err);
      setPlotData([]);
      setLayout({});
    }
  }, [createPlotlyDataForType]);

  useEffect(() => {
    if (chartData && chartData.data) {
      // Check if we have LLM recommendation (config with xField/yField)
      const hasLLMRecommendation = chartData.chart?.config?.xField && chartData.chart?.config?.yField;
      const isFallback = chartData.chart?.fallback === true;
      const isManualRequired = chartData.chart?.source === 'manual-required';
      
      if (hasLLMRecommendation && !isFallback && !isManualRequired) {
        // LLM provided recommendation - use it directly
        // But don't reset if user has manually configured (they may want to keep their config)
        if (!manualChartConfigured) {
          setIsManualMode(false);
          const chartType = chartData.chart.type || 'bar';
          setSelectedChartType(chartType);
          processChartData(chartData, chartType);
        }
      } else if (manualChartConfigured && manualXAxis && manualYAxis) {
        // Manual mode already configured - keep showing chart with user's selection
        // This uses the cached queryResults, no re-execution
      } else {
        // No LLM recommendation (direct SQL execution) - enter manual mode
        console.log('Manual mode: Direct SQL execution or no LLM recommendation');
        setIsManualMode(true);
        setManualChartConfigured(false);
        setPlotData([]);
        setLayout({});
        // Reset manual selections when NEW data comes in
        setManualXAxis('');
        setManualYAxis('');
      }
    } else {
      setPlotData([]);
      setLayout({});
      setChartInfo(null);
      setIsManualMode(false);
      setManualChartConfigured(false);
    }
    // Note: Only depend on chartData changes, not manual state (to avoid loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, processChartData]);

  // Handle chart type change from selector
  const handleChartTypeChange = useCallback((newType) => {
    console.log('Chart type changed to:', newType);
    setSelectedChartType(newType);
    
    // Reprocess chart data with new type
    if (chartData && chartData.data) {
      console.log('Reprocessing chart with new type:', newType);
      
      // Get config from existing chart or use manual selections
      const config = isManualMode 
        ? { xField: manualXAxis, yField: manualYAxis }
        : (chartData.chart?.config || {});
      
      if (config.xField && config.yField) {
        // Create new plot data directly
        const newPlotData = createPlotlyData(newType, config, chartData.data);
        const newLayout = createPlotlyLayout(newType, config, chartData.data);
        
        console.log('New plot data:', newPlotData);
        setPlotData(newPlotData);
        setLayout(newLayout);
      }
    }
    
    if (onChartTypeChange) {
      onChartTypeChange(newType);
    }
  }, [chartData, onChartTypeChange, isDark, isManualMode, manualXAxis, manualYAxis]);

  // Handle manual chart generation
  const handleManualApply = useCallback(() => {
    if (!manualXAxis || !manualYAxis || !chartData?.data) {
      return;
    }

    console.log('Applying manual chart config:', { xAxis: manualXAxis, yAxis: manualYAxis, type: selectedChartType });
    
    const config = {
      xField: manualXAxis,
      yField: manualYAxis
    };

    const newPlotData = createPlotlyData(selectedChartType, config, chartData.data);
    const newLayout = createPlotlyLayout(selectedChartType, config, chartData.data);

    setPlotData(newPlotData);
    setLayout(newLayout);
    setManualChartConfigured(true);
    setChartInfo({
      type: selectedChartType,
      cached: false,
      rowCount: chartData.data?.rowCount || 0,
      fallback: false,
      manual: true
    });
  }, [manualXAxis, manualYAxis, selectedChartType, chartData]);

  const createPlotlyData = (chartType, config, queryData) => {
    const { data, columns } = queryData;

    if (!data || !columns || data.length === 0) {
      return [];
    }

    // Use LLM-provided config, fallback to simple column order
    // LLM recommendation is the source of truth for x/y columns
    const xField = config.xField || columns[0]?.name;
    const yField = config.yField || columns[1]?.name;
    const seriesField = config.series;
    
    console.log('Chart columns:', { xField, yField, seriesField, source: config.xField ? 'LLM' : 'fallback' });
    
    switch (chartType) {
      case 'bar':
      case 'column':
        if (seriesField) {
          // Grouped bar chart
          const groups = [...new Set(data.map(row => row[seriesField]))];
          return groups.map((group, idx) => ({
            type: 'bar',
            name: group,
            x: data.filter(row => row[seriesField] === group).map(row => row[xField]),
            y: data.filter(row => row[seriesField] === group).map(row => row[yField]),
            marker: { color: CHART_COLORS[idx % CHART_COLORS.length] },
            hovertemplate: `<b>%{x}</b><br>${group}: %{y}<extra></extra>`
          }));
        }
        return [{
          type: 'bar',
          x: data.map(row => row[xField]),
          y: data.map(row => row[yField]),
          marker: { 
            color: CHART_COLORS[0],
            line: { color: 'rgba(59, 130, 246, 1)', width: 1 }
          },
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
          name: yField
        }];

      case 'line':
        return [{
          type: 'scatter',
          mode: config.mode || 'lines+markers',
          x: data.map(row => row[xField]),
          y: data.map(row => row[yField]),
          line: { color: CHART_COLORS[1], width: 3, shape: 'spline' },
          marker: { size: 8, color: CHART_COLORS[1], line: { color: 'rgba(255,255,255,0.8)', width: 2 } },
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
          name: yField
        }];

      case 'scatter':
        return [{
          type: 'scatter',
          mode: 'markers',
          x: data.map(row => row[xField]),
          y: data.map(row => row[yField]),
          marker: { color: CHART_COLORS[2], size: 10, opacity: 0.7 },
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
          name: `${xField} vs ${yField}`
        }];

      case 'pie':
        const pieData = data.reduce((acc, row) => {
          const key = row[xField];
          const value = parseFloat(row[yField]) || 0;
          acc[key] = (acc[key] || 0) + value;
          return acc;
        }, {});
        return [{
          type: 'pie',
          labels: Object.keys(pieData),
          values: Object.values(pieData),
          textinfo: 'label+percent',
          textposition: 'outside',
          marker: { colors: CHART_COLORS },
          hovertemplate: '<b>%{label}</b><br>%{value} (%{percent})<extra></extra>'
        }];

      case 'area':
        return [{
          type: 'scatter',
          mode: 'lines',
          fill: 'tozeroy',
          x: data.map(row => row[xField]),
          y: data.map(row => row[yField]),
          line: { color: CHART_COLORS[4], width: 2, shape: 'spline' },
          fillcolor: 'rgba(139, 92, 246, 0.3)',
          hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
          name: yField
        }];

      case 'histogram':
        return [{
          type: 'histogram',
          x: data.map(row => row[yField] || row[xField]),
          marker: { color: CHART_COLORS[0], line: { color: 'rgba(59, 130, 246, 1)', width: 1 } },
          opacity: 0.8,
          name: yField || xField
        }];

      case 'box':
        const boxGroups = xField ? [...new Set(data.map(row => row[xField]))] : ['All'];
        return boxGroups.map((group, idx) => ({
          type: 'box',
          name: group,
          y: data.filter(row => !xField || row[xField] === group).map(row => row[yField]),
          marker: { color: CHART_COLORS[idx % CHART_COLORS.length] },
          boxpoints: 'outliers'
        }));

      case 'violin':
        const violinGroups = xField ? [...new Set(data.map(row => row[xField]))] : ['All'];
        return violinGroups.map((group, idx) => ({
          type: 'violin',
          name: group,
          y: data.filter(row => !xField || row[xField] === group).map(row => row[yField]),
          box: { visible: true },
          meanline: { visible: true },
          marker: { color: CHART_COLORS[idx % CHART_COLORS.length] }
        }));

      case 'heatmap':
        // Assume data is in format: x, y, value
        const zField = columns[2]?.name || yField;
        const xVals = [...new Set(data.map(row => row[xField]))];
        const yVals = [...new Set(data.map(row => row[yField]))];
        const zMatrix = yVals.map(yVal => 
          xVals.map(xVal => {
            const match = data.find(row => row[xField] === xVal && row[yField] === yVal);
            return match ? match[zField] : 0;
          })
        );
        return [{
          type: 'heatmap',
          x: xVals,
          y: yVals,
          z: zMatrix,
          colorscale: 'Viridis',
          hovertemplate: '<b>%{x}, %{y}</b><br>Value: %{z}<extra></extra>'
        }];

      case 'treemap':
        return [{
          type: 'treemap',
          labels: data.map(row => row[xField]),
          parents: data.map(() => ''),
          values: data.map(row => row[yField]),
          textinfo: 'label+value+percent entry',
          marker: { colors: data.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]) }
        }];

      case 'sunburst':
        return [{
          type: 'sunburst',
          labels: data.map(row => row[xField]),
          parents: data.map(() => ''),
          values: data.map(row => row[yField]),
          marker: { colors: data.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]) }
        }];

      case 'funnel':
        return [{
          type: 'funnel',
          y: data.map(row => row[xField]),
          x: data.map(row => row[yField]),
          textinfo: 'value+percent initial',
          marker: { color: CHART_COLORS }
        }];

      case 'waterfall':
        return [{
          type: 'waterfall',
          x: data.map(row => row[xField]),
          y: data.map(row => row[yField]),
          measure: data.map((_, idx) => idx === 0 ? 'absolute' : 'relative'),
          connector: { line: { color: 'rgb(63, 63, 63)' } },
          increasing: { marker: { color: CHART_COLORS[1] } },
          decreasing: { marker: { color: CHART_COLORS[3] } },
          totals: { marker: { color: CHART_COLORS[0] } }
        }];

      case 'contour':
        const contourZField = columns[2]?.name || yField;
        const contourXVals = [...new Set(data.map(row => row[xField]))];
        const contourYVals = [...new Set(data.map(row => row[yField]))];
        const contourZMatrix = contourYVals.map(yVal => 
          contourXVals.map(xVal => {
            const match = data.find(row => row[xField] === xVal && row[yField] === yVal);
            return match ? match[contourZField] : 0;
          })
        );
        return [{
          type: 'contour',
          x: contourXVals,
          y: contourYVals,
          z: contourZMatrix,
          colorscale: 'Jet',
          contours: { coloring: 'heatmap' }
        }];

      case 'sankey':
        // Expects: source, target, value columns
        const sourceField = xField;
        const targetField = yField;
        const valueField = columns[2]?.name || 'value';
        const allNodes = [...new Set([...data.map(row => row[sourceField]), ...data.map(row => row[targetField])])];
        return [{
          type: 'sankey',
          node: {
            label: allNodes,
            color: allNodes.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length])
          },
          link: {
            source: data.map(row => allNodes.indexOf(row[sourceField])),
            target: data.map(row => allNodes.indexOf(row[targetField])),
            value: data.map(row => row[valueField] || 1)
          }
        }];

      case 'candlestick':
        // Expects: date, open, high, low, close
        return [{
          type: 'candlestick',
          x: data.map(row => row[xField]),
          open: data.map(row => row[columns[1]?.name]),
          high: data.map(row => row[columns[2]?.name]),
          low: data.map(row => row[columns[3]?.name]),
          close: data.map(row => row[columns[4]?.name]),
          increasing: { line: { color: CHART_COLORS[1] } },
          decreasing: { line: { color: CHART_COLORS[3] } }
        }];

      case 'table':
        // Return empty - table view handled separately
        return [];

      default:
        // Fallback to bar chart
        return [{
          type: 'bar',
          x: data.map(row => row[xField]),
          y: data.map(row => row[yField]),
          marker: { color: CHART_COLORS[0] },
          name: yField
        }];
    }
  };

  const createPlotlyLayout = (chartType, config, queryData) => {
    const { columns } = queryData;
    const xField = config.xField || columns[0]?.name || 'X Axis';
    const yField = config.yField || columns[1]?.name || 'Y Axis';
    const title = config.title || '';

    const baseLayout = {
      autosize: true,
      margin: { l: 60, r: 30, t: title ? 50 : 30, b: 60 },
      plot_bgcolor: isDark ? 'rgba(17, 24, 39, 0.3)' : 'rgba(249, 250, 251, 0.5)',
      paper_bgcolor: 'transparent',
      font: { 
        family: 'Inter, system-ui, sans-serif', 
        size: 12,
        color: isDark ? '#e5e7eb' : '#374151'
      },
      showlegend: !['pie', 'treemap', 'sunburst', 'funnel', 'sankey'].includes(chartType),
      legend: {
        orientation: 'h',
        y: -0.15,
        x: 0.5,
        xanchor: 'center',
        bgcolor: 'transparent'
      }
    };

    if (title) {
      baseLayout.title = {
        text: title,
        font: { size: 16, color: isDark ? '#f3f4f6' : '#1f2937' }
      };
    }

    // Charts that need axes
    const axisCharts = ['bar', 'column', 'line', 'scatter', 'area', 'histogram', 'box', 'violin', 'waterfall', 'contour', 'heatmap', 'candlestick'];
    
    if (axisCharts.includes(chartType)) {
      baseLayout.xaxis = {
        title: { text: xField, font: { size: 13, color: isDark ? '#d1d5db' : '#6b7280' } },
        gridcolor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
        tickcolor: isDark ? '#4b5563' : '#d1d5db',
        linecolor: isDark ? '#4b5563' : '#d1d5db',
        zeroline: false
      };
      baseLayout.yaxis = {
        title: { text: yField, font: { size: 13, color: isDark ? '#d1d5db' : '#6b7280' } },
        gridcolor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
        tickcolor: isDark ? '#4b5563' : '#d1d5db',
        linecolor: isDark ? '#4b5563' : '#d1d5db',
        zeroline: false
      };
    }

    // Special layout adjustments per chart type
    if (chartType === 'box' || chartType === 'violin') {
      baseLayout.boxmode = 'group';
      baseLayout.violinmode = 'group';
    }

    if (chartType === 'heatmap' || chartType === 'contour') {
      baseLayout.margin = { l: 80, r: 80, t: title ? 50 : 30, b: 80 };
    }

    if (chartType === 'sankey') {
      baseLayout.margin = { l: 20, r: 20, t: title ? 50 : 30, b: 20 };
    }

    if (chartType === 'treemap' || chartType === 'sunburst') {
      baseLayout.margin = { l: 10, r: 10, t: title ? 50 : 30, b: 10 };
    }

    return baseLayout;
  };


  if (loading) {
    return (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-4">
            <svg className="w-10 h-10 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Generating chart...
          </p>
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

  // Get columns for compatibility checking
  const dataColumns = chartData?.data?.columns || [];

  // Show manual mode selector when we have data but no LLM recommendation
  // This happens for: 1) Direct SQL execution, 2) User clicked "Configure" to override
  if (isManualMode && !manualChartConfigured && chartData?.data?.columns) {
    const rowCount = chartData.data?.rowCount || chartData.data?.data?.length || 0;
    
    return (
      <div className="w-full h-full flex flex-col p-4">
        <ManualAxisSelector
          columns={dataColumns}
          xAxis={manualXAxis}
          yAxis={manualYAxis}
          onXAxisChange={setManualXAxis}
          onYAxisChange={setManualYAxis}
          onApply={handleManualApply}
          chartType={selectedChartType}
          onChartTypeChange={setSelectedChartType}
        />
        
        <div className="flex-1 flex items-center justify-center mt-4">
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <span className="text-3xl">📊</span>
            </div>
            <Typography variant="h6" color="text.secondary" gutterBottom className="font-semibold">
              Configure Your Chart
            </Typography>
            <Typography variant="body2" color="text.secondary" className="max-w-md mb-2">
              Select columns from your query results ({rowCount} rows) to create a visualization.
            </Typography>
            <Typography variant="caption" color="text.secondary" className="opacity-70">
              💡 Tip: Use natural language queries for automatic chart recommendations
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  if (!chartData || !plotData || plotData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              No Chart Data
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Execute a query to generate a chart
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Chart Type Selector */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <ChartTypeSelector
            selectedType={selectedChartType}
            onTypeChange={handleChartTypeChange}
            dataColumns={dataColumns}
            compact={true}
          />
          
          {/* Show mode badge and configure button */}
          <div className="flex items-center gap-2">
            {/* Mode Badge - AI Powered or Custom */}
            {chartInfo && (
              chartInfo.manual ? (
                <span className={`
                  inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full
                  ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'}
                `}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Custom
                </span>
              ) : (
                <span className={`
                  inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full
                  ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}
                `}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  AI Powered
                </span>
              )
            )}
            
            <button
              onClick={() => {
                setManualChartConfigured(false);
                setIsManualMode(true);
              }}
              className={`
                inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors
                ${isDark 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
              title="Customize chart configuration"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Customize
            </button>
          </div>
        </div>
      </div>
      
      {/* Chart Area */}
      <div className="flex-1 min-h-0">
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
    </div>
  );
};

export default Chart;


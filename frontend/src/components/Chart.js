import React, { useState, useEffect, useCallback } from 'react';
import { Typography } from '@mui/material';
import Plot from 'react-plotly.js';
import { Alert } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import ChartTypeSelector from './ChartTypeSelector';

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

const Chart = ({ chartData, loading = false, error = null, onChartTypeChange = null }) => {
  const { isDark } = useTheme();
  const [plotData, setPlotData] = useState([]);
  const [layout, setLayout] = useState({});
  const [chartInfo, setChartInfo] = useState(null);
  const [selectedChartType, setSelectedChartType] = useState('bar');

  // Memoized chart processing
  const processChartData = useCallback((data, overrideType = null) => {
    try {
      console.log('Chart component received data:', data);
      const { chart, data: queryData } = data;
      const chartType = overrideType || chart.type || 'bar';

      setPlotData([]);
      setLayout({});
      
      // Set chart info for display
      setChartInfo({
        type: chartType,
        cached: data.cached || false,
        rowCount: queryData.rowCount || 0,
        fallback: chart.fallback || false
      });

      // Process chart configuration
      if (queryData.data) {
        console.log('Processing chart with type:', chartType);
        const config = chart.config || {
          xField: queryData.columns[0]?.name,
          yField: queryData.columns[1]?.name
        };
        const processedData = createPlotlyData(chartType, config, queryData);
        const processedLayout = createPlotlyLayout(chartType, config, queryData);
        
        console.log('Processed plotly data:', processedData);
        setTimeout(() => {
          setPlotData(processedData);
          setLayout(processedLayout);
        }, 10);
      }
    } catch (err) {
      console.error('Error processing chart data:', err);
      setPlotData([]);
      setLayout({});
    }
  }, [isDark]);

  useEffect(() => {
    if (chartData && chartData.chart && chartData.data) {
      const chartType = chartData.chart.type || 'bar';
      setSelectedChartType(chartType);
      processChartData(chartData, chartType);
    } else {
      setPlotData([]);
      setLayout({});
      setChartInfo(null);
    }
  }, [chartData, processChartData]);

  // Handle chart type change from selector
  const handleChartTypeChange = (newType) => {
    setSelectedChartType(newType);
    if (chartData && chartData.data) {
      processChartData(chartData, newType);
    }
    if (onChartTypeChange) {
      onChartTypeChange(newType);
    }
  };

  const createPlotlyData = (chartType, config, queryData) => {
    const { data, columns } = queryData;

    if (!data || !columns || data.length === 0) {
      return [];
    }

    const xField = config.xField || columns[0]?.name;
    const yField = config.yField || columns[1]?.name;
    const seriesField = config.series;
    
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

  // Get columns for compatibility checking
  const dataColumns = chartData?.data?.columns || [];

  if (!chartData || !plotData || plotData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Chart Type Selector - always show if we have data structure */}
        {chartData?.data?.columns && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <ChartTypeSelector
              selectedType={selectedChartType}
              onTypeChange={handleChartTypeChange}
              dataColumns={dataColumns}
              compact={true}
            />
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
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
      </div>
    );
  }

  // Handle table view separately
  if (selectedChartType === 'table') {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <ChartTypeSelector
            selectedType={selectedChartType}
            onTypeChange={handleChartTypeChange}
            dataColumns={dataColumns}
            compact={true}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Typography variant="body1" color="text.secondary">
            Table view - See the data grid panel for tabular data
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Chart Type Selector */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <ChartTypeSelector
          selectedType={selectedChartType}
          onTypeChange={handleChartTypeChange}
          dataColumns={dataColumns}
          compact={true}
        />
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

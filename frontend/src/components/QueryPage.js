import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTheme } from '../contexts/ThemeContext';
import DatabaseSchemaPanel from './DatabaseSchemaPanel';
import AIQueryInput from './AIQueryInput';
import SqlQuery from './SqlQuery';
import QueryResults from './QueryResults';
import Chart from './Chart';
import ViewToggle from './ViewToggle';
import ChartTypeSelector from './ChartTypeSelector';
import { Card, Text, Button } from './ui';
import { useProcessNaturalLanguage } from '../hooks/useGraphQL';

const QueryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [databasePanelCollapsed, setDatabasePanelCollapsed] = useState(true);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeView, setActiveView] = useState('results'); // 'results' or 'chart'
  const [sqlQuery, setSqlQuery] = useState(
    selectedQuery?.query || 
    "SELECT customer_name, order_total, order_date\nFROM orders\nWHERE order_date >= '2024-01-01'\nORDER BY order_total DESC\nLIMIT 10;"
  );
  const [queryError, setQueryError] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [manualQueryLoading, setManualQueryLoading] = useState(false);

  // Load query data based on ID from URL
  useEffect(() => {
    if (id && id !== 'new') {
      // TODO: Load query from API/service based on ID
      // For now, just set a placeholder
      const defaultQuery = "SELECT customer_name, order_total, order_date\nFROM orders\nWHERE order_date >= '2024-01-01'\nORDER BY order_total DESC\nLIMIT 10;";
      setSelectedQuery({ id, title: `Query ${id}`, query: defaultQuery });
    }
  }, [id]);

  const { 
    mutate: processNaturalLanguage, 
    isPending: aiQueryLoading 
  } = useProcessNaturalLanguage({
    onSuccess: (response) => {
      if (response.success && response.generatedSql) {
        const generatedSQL = `-- Generated from natural language query\n${response.generatedSql}`;
        setSqlQuery(generatedSQL);
        setQueryResults(response.queryResults);
        setChartData(response.chartData);
        setQueryError(null);
      } else {
        setQueryError(response.error || 'Failed to process natural language query');
      }
    },
    onError: (error) => {
      console.error('Natural language processing failed:', error);
      setQueryError(error.message || 'Failed to process natural language query');
    }
  });

  // Handle AI query submission
  const handleAIQuery = async (naturalLanguageQuery) => {
    setQueryError(null);
    
    // Use the GraphQL mutation hook
    processNaturalLanguage({
      message: naturalLanguageQuery,
      conversationHistory: []
    });
  };

  const handleExecuteQuery = async () => {
    setManualQueryLoading(true);
    setQueryError(null);
    
    try {
      setTimeout(() => {
        const regions = ['North America', 'Europe', 'Asia Pacific', 'South America', 'Middle East', 'Africa', 'Oceania'];
        const mockData = [];
        
        for (let i = 0; i < 25; i++) {
          mockData.push({
            region: regions[i % regions.length] + (i > 6 ? ` ${Math.floor(i/7) + 1}` : ''),
            total_sales: Math.floor(Math.random() * 200000) + 20000,
            order_count: Math.floor(Math.random() * 500) + 50,
            customer_id: `CUST-${String(i + 1).padStart(4, '0')}`,
            last_order_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          });
        }

        const mockResults = {
          data: mockData,
          columns: [
            { name: 'region', label: 'Region', type: 'string' },
            { name: 'total_sales', label: 'Total Sales', type: 'number' },
            { name: 'order_count', label: 'Order Count', type: 'number' },
            { name: 'customer_id', label: 'Customer ID', type: 'string' },
            { name: 'last_order_date', label: 'Last Order Date', type: 'date' }
          ],
          rowCount: mockData.length
        };

        const mockChartData = {
          chart: {
            type: 'bar',
            config: {
              xField: 'region',
              yField: 'total_sales'
            }
          },
          data: mockResults,
          cached: false
        };
        
        setQueryResults(mockResults);
        setChartData(mockChartData);
        setManualQueryLoading(false);
      }, 1500);
    } catch (error) {
      setQueryError('Failed to execute query');
      setManualQueryLoading(false);
    }
  };

  const queryLoading = aiQueryLoading || manualQueryLoading;


  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-900/95 border-gray-800/60' : 'bg-white/95 border-gray-200/60'} border-b px-4 py-2 backdrop-blur-sm`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              {/* Back Button */}
              <button
                onClick={() => navigate('/queries')}
                  className={`
                    p-2 rounded-lg transition-colors
                    ${isDark 
                      ? 'hover:bg-gray-700 text-gray-300 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }
                  `}
                  title="Back to Queries"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <Text variant="h5" className="font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
                  {selectedQuery ? selectedQuery.title : 'Analytics Dashboard'}
                </Text>
                <Text color="secondary" className="mt-0.5 text-sm">
                  {selectedQuery ? selectedQuery.description : 'Explore your data with AI-powered natural language queries'}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Database Schema Panel */}
        <DatabaseSchemaPanel 
          isCollapsed={databasePanelCollapsed}
          onToggle={() => setDatabasePanelCollapsed(!databasePanelCollapsed)}
          onTableSelect={setSelectedTable}
          selectedTable={selectedTable}
        />
        
        {/* Main Dashboard */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* SQL Query Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Text variant="h6" className="font-medium text-sm text-gray-700 dark:text-gray-300">
                  SQL Query
                </Text>
                
                {/* Control Buttons */}
                <div className="flex items-center space-x-2">
                  {/* Execute Query Button */}
                  <div className="relative group">
                      <button
                        onClick={handleExecuteQuery}
                        disabled={queryLoading}
                        className={`
                          p-2 rounded-md transition-all duration-300 flex items-center justify-center
                          ${queryLoading
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                          }
                          text-white shadow-md hover:shadow-lg
                        `}
                        title="Execute Query"
                      >
                        {queryLoading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                      
                      {/* Hover Tooltip */}
                      <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-30">
                        {queryLoading ? 'Executing...' : 'Execute Query'}
                      </div>
                    </div>

                    {/* Database Panel Toggle Button */}
                    <button
                      onClick={() => setDatabasePanelCollapsed(!databasePanelCollapsed)}
                      className={`
                        p-1.5 rounded-md transition-all duration-300
                        ${isDark 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600' 
                          : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-sm'
                        }
                        hover:shadow-md
                      `}
                      title={databasePanelCollapsed ? 'Show Database Schema' : 'Hide Database Schema'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </button>

                    {/* AI Panel Toggle Button */}
                    <button
                      onClick={() => setAiPanelCollapsed(!aiPanelCollapsed)}
                      className={`
                        p-1.5 rounded-md transition-all duration-300
                        ${isDark 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600' 
                          : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-sm'
                        }
                        hover:shadow-md
                      `}
                      title={aiPanelCollapsed ? 'Show AI Assistant' : 'Hide AI Assistant'}
                    >
                      {aiPanelCollapsed ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
              <SqlQuery 
                sqlQuery={sqlQuery}
                setSqlQuery={setSqlQuery}
              />

              {/* View Toggle and Chart Controls */}
              <div className="flex items-center justify-between">
                <ViewToggle 
                  activeView={activeView}
                  onViewChange={setActiveView}
                />
                
                {/* Chart Type Selector - only show when chart view is active */}
                {activeView === 'chart' && chartData && (
                  <div className="flex items-center space-x-3">
                    <Text color="secondary" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Chart Type
                    </Text>
                    <ChartTypeSelector 
                      currentType={chartData?.chart?.type || 'bar'}
                      onTypeChange={(type) => {
                        if (chartData) {
                          // Create a completely new object to ensure React detects the change
                          const newChartData = {
                            ...chartData,
                            chart: {
                              ...chartData.chart,
                              type: type
                            },
                            // Add a timestamp to force re-render
                            _timestamp: Date.now()
                          };
                          setChartData(newChartData);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Content Area - Results or Chart */}
              <div className="w-full">
                {activeView === 'results' ? (
                  <QueryResults 
                    queryData={queryResults}
                    loading={queryLoading}
                    error={queryError}
                  />
                ) : (
                  <Chart 
                    chartData={chartData}
                    loading={queryLoading}
                    error={queryError}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - AI Query Input */}
        <div className={`${aiPanelCollapsed ? 'w-0' : 'w-80'} transition-all duration-300 overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' : 'bg-white/50 border-gray-200/50 backdrop-blur-sm'} border-l flex flex-col`}>
            <div className={`${aiPanelCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'} transition-opacity duration-300 flex-1 flex flex-col`}>
              <div className="p-3 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <Text variant="h6" className="font-bold text-sm">
                    AI Assistant
                  </Text>
                </div>
                <Text color="secondary" className="text-xs">
                  Ask questions about your data in natural language
                </Text>
              </div>
              
              <div className="flex-1 p-3 overflow-y-auto">
                <AIQueryInput 
                  onSubmit={handleAIQuery}
                  loading={queryLoading}
                />
                
                {/* Recent Queries */}
                <div className="mt-3">
                  <Text variant="subtitle2" className="font-medium mb-2 text-xs text-gray-600 dark:text-gray-400">
                    Recent Queries
                  </Text>
                  <div className="space-y-1">
                    {[
                      "Show me sales data from the last quarter",
                      "Create a chart of customer demographics",
                      "Find all orders over $1000 this month",
                      "Compare revenue by region",
                    ].map((query, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!queryLoading) {
                            handleAIQuery(query);
                          }
                        }}
                        disabled={queryLoading}
                        className={`
                          w-full text-left p-1.5 rounded border transition-all duration-200 cursor-pointer relative z-10
                          ${queryLoading 
                            ? 'opacity-50 cursor-not-allowed pointer-events-none'
                            : isDark
                              ? 'bg-gray-800/60 border-gray-700/60 hover:bg-gray-700/70 text-gray-200 hover:border-gray-600/70' 
                              : 'bg-white/80 border-gray-200/60 hover:bg-white text-gray-700 hover:border-gray-300/80'
                          }
                          hover:shadow-md text-xs pointer-events-auto
                        `}
                        type="button"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryPage;
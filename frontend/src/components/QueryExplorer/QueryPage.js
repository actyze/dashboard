import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { DatabaseSchemaPanel, ViewToggle } from '../Common';
import AIQueryInput from './AIQueryInput';
import SqlQuery from './SqlQuery';
import QueryResults from './QueryResults';
import { Chart } from '../Charts';
import { ReasoningBanner } from '../Common';
import { Text } from '../ui';
import { useProcessNaturalLanguage, useExecuteSql } from '../../hooks';

const QueryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [databasePanelCollapsed, setDatabasePanelCollapsed] = useState(true);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeView, setActiveView] = useState('results'); // 'results' or 'chart'
  const [sqlQuery, setSqlQuery] = useState(
    selectedQuery?.query || 
    "SELECT customer_name, order_total, order_date\nFROM orders\nWHERE order_date >= DATE '2024-01-01'\nORDER BY order_total DESC\nLIMIT 10"
  );
  const [queryError, setQueryError] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [queryReasoning, setQueryReasoning] = useState(null);
  
  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef(null);

  // Load query from navigation state (when coming from QueriesList)
  useEffect(() => {
    if (location.state?.sql) {
      setSqlQuery(location.state.sql);
      if (location.state.nlQuery) {
        // If there's a natural language query, we might want to show it too
        setQueryReasoning(location.state.nlQuery);
      }
      // Clear the location state so it doesn't repopulate on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (id && id !== 'new') {
      const defaultQuery = "SELECT customer_name, order_total, order_date\nFROM orders\nWHERE order_date >= '2024-01-01'\nORDER BY order_total DESC\nLIMIT 10;";
      setSelectedQuery({ id, title: `Query ${id}`, query: defaultQuery });
    }
  }, [id]);
  
  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);
  
  const handleTitleClick = () => {
    const currentTitle = selectedQuery?.title || 'Untitled Query';
    setEditedTitle(currentTitle);
    setIsEditingTitle(true);
  };
  
  const handleTitleSave = () => {
    if (editedTitle.trim()) {
      setSelectedQuery(prev => ({ ...prev, title: editedTitle.trim() }));
    }
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const { mutate: processNaturalLanguage, isPending: aiQueryLoading } = useProcessNaturalLanguage({
    // PROGRESSIVE CALLBACK: SQL generated - show immediately!
    onSqlGenerated: (sql, chartRecommendation, reasoning) => {
      const commentPrefix = `-- Generated from natural language query\n`;
      setSqlQuery(commentPrefix + sql);
      setQueryReasoning(reasoning);
      setQueryError(null);
    },
    // PROGRESSIVE CALLBACK: Results ready - show immediately!
    onResultsReady: (results, chartData) => {
      setQueryResults(results);
      setChartData(chartData);
    },
    // Final success/error handler (react-query's onSuccess)
    onSuccess: (data) => {
      if (!data.success && data.error) {
        setQueryError(data.error);
      }
    },
    // React-query's onError for network/unexpected errors
    onError: (error) => {
      console.error('AI Query failed:', error);
      setQueryError(error.message || 'Failed to process natural language query');
    }
  });

  const { mutate: executeSql, isPending: manualQueryLoading } = useExecuteSql({
    onSuccess: (data) => {
      if (data.success) {
        setQueryResults(data.queryResults);
        setChartData(data.chartData);
        setQueryError(null);
      } else {
        setQueryError(data.error || 'Failed to execute SQL query');
      }
    },
    onError: (error) => {
      console.error('SQL Execution failed:', error);
      setQueryError(error.message || 'Failed to execute SQL query');
    }
  });

  const handleAIQuery = (naturalLanguageQuery) => {
    setQueryError(null);
    processNaturalLanguage({ nlQuery: naturalLanguageQuery });
  };

  const handleExecuteQuery = () => {
    setQueryError(null);
    setQueryReasoning(null); // Clear reasoning for manual queries
    executeSql({ sql: sqlQuery });
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
              
              {/* Editable Title */}
              <div className="flex-1">
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    className={`
                      text-lg font-bold w-full max-w-xs px-1 py-0.5 
                      bg-transparent border-0 border-b-2 border-blue-500 
                      outline-none transition-all
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}
                    placeholder="Enter query name..."
                  />
                ) : (
                  <button
                    onClick={handleTitleClick}
                    className={`
                      text-lg font-bold px-1 py-0.5 transition-all text-left border-b-2 border-transparent
                      ${isDark 
                        ? 'text-white hover:border-gray-600' 
                        : 'text-gray-900 hover:border-gray-300'
                      }
                    `}
                    title="Click to edit title"
                  >
                    {selectedQuery?.title || 'Untitled Query'}
                  </button>
                )}
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
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
              
              {/* Query Reasoning Banner */}
              {queryReasoning && (
                <ReasoningBanner 
                  reasoning={queryReasoning}
                  className="mb-2"
                />
              )}
                
              <SqlQuery 
                sqlQuery={sqlQuery}
                setSqlQuery={setSqlQuery}
              />

              {/* View Toggle */}
              <div className="flex items-center">
                <ViewToggle 
                  activeView={activeView}
                  onViewChange={setActiveView}
                />
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
        <div 
          style={{ width: aiPanelCollapsed ? 0 : 320, minWidth: aiPanelCollapsed ? 0 : 320 }}
          className={`
            transition-all duration-300 flex-shrink-0
            ${isDark ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' : 'bg-white/50 border-gray-200/50 backdrop-blur-sm'} 
            border-l flex flex-col overflow-hidden
          `}
        >
          <div className={`${aiPanelCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 flex-1 flex flex-col`} style={{ width: 320 }}>
            <div className="p-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <Text variant="h6" className="font-bold text-sm whitespace-nowrap">
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
              <div className="mt-4">
                <Text variant="subtitle2" className="font-medium mb-2 text-xs text-gray-600 dark:text-gray-400">
                  Recent Queries
                </Text>
                <div className="space-y-1.5">
                  {[
                    "Show me sales data from the last quarter",
                    "Create a chart of customer demographics",
                    "Find all orders over $1000 this month",
                    "Compare revenue by region",
                  ].map((query, index) => (
                    <button
                      key={index}
                      onClick={() => !queryLoading && handleAIQuery(query)}
                      disabled={queryLoading}
                      className={`
                        w-full text-left p-2 rounded-lg border transition-all duration-200
                        ${queryLoading 
                          ? 'opacity-50 cursor-not-allowed'
                          : isDark
                            ? 'bg-gray-800/60 border-gray-700/60 hover:bg-gray-700/70 text-gray-200 hover:border-gray-600/70' 
                            : 'bg-white/80 border-gray-200/60 hover:bg-white text-gray-700 hover:border-gray-300/80'
                        }
                        text-xs
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
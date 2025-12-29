import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate, useLocation, UNSAFE_NavigationContext } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { DatabaseSchemaPanel, ViewToggle } from '../Common';
import AIQueryInput from './AIQueryInput';
import TypingIndicator from './TypingIndicator';
import SqlQuery from './SqlQuery';
import QueryResults from './QueryResults';
import { Chart } from '../Charts';
import { Text } from '../ui';
import { useProcessNaturalLanguage, useExecuteSql, useConversationHistory } from '../../hooks';
import { QueryManagementService } from '../../services';
import SaveQueryDialog from './SaveQueryDialog';
import UnsavedChangesDialog from './UnsavedChangesDialog';

const QueryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  
  const queryFromState = location.state?.query;
  
  const [queryName, setQueryName] = useState(queryFromState?.query_name || queryFromState?.created_at || 'Untitled Query');
  const [databasePanelCollapsed, setDatabasePanelCollapsed] = useState(true);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeView, setActiveView] = useState('results');
  const [sqlQuery, setSqlQuery] = useState(queryFromState?.generated_sql || "");
  const [queryError, setQueryError] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [chartData, setChartData] = useState(null);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef(null);
  
  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState('new'); // 'new' or 'update'
  const [isSaving, setIsSaving] = useState(false);
  const saveInProgressRef = useRef(false); // Prevent double-save
  const allowNavigationRef = useRef(false); // Bypass navigation guard after save

  // Unsaved changes dialog state
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingNavigationRef = useRef(null); // Store pending navigation action
  
  // Save dropdown state
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const saveDropdownRef = useRef(null);

  // Conversation history scoped to this query ID (NO persistence)
  const { conversationHistory, addUserMessage, addBotMessage, clearHistory } = useConversationHistory(id);

  // Query context for intent-aware schema reuse
  const [queryContext, setQueryContext] = useState({});
  
  // Track when AI is "thinking" (before response arrives)
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  // Track unsaved changes (conversation or SQL changes)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const originalSqlRef = useRef(queryFromState?.generated_sql || "");
  
  const sessionIdRef = useRef(`session-${id || 'new'}-${Date.now()}`);

  // Reset context and clear unsaved flag when query ID changes
  useEffect(() => {
    setQueryContext({});
    setHasUnsavedChanges(false);
    sessionIdRef.current = `session-${id || 'new'}-${Date.now()}`;
    originalSqlRef.current = queryFromState?.generated_sql || "";
  }, [id, queryFromState]);

  // Track unsaved changes: conversation history or SQL changes
  useEffect(() => {
    const hasConversation = conversationHistory.length > 0;
    const hasSqlChanges = sqlQuery !== originalSqlRef.current;
    setHasUnsavedChanges(hasConversation || hasSqlChanges);
  }, [conversationHistory, sqlQuery]);

  // Warn before browser close if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Store blocked navigation location
  const blockedNextLocationRef = useRef(null);
  const navigationContext = useContext(UNSAFE_NavigationContext);

  // Quick save for existing queries (no dialog) - MUST be defined before navigation guard
  const handleQuickSave = useCallback(async () => {
    if (!id || id === 'new') {
      // Not saved yet, open dialog
      setSaveMode('new');
      setSaveDialogOpen(true);
      return;
    }

    // Prevent double-save
    if (saveInProgressRef.current || isSaving) {
      console.log('Save already in progress, ignoring duplicate quick save');
      return;
    }

    saveInProgressRef.current = true;
    setIsSaving(true);
    try {
      const response = await QueryManagementService.updateQuery(id, {
        generated_sql: sqlQuery.replace(/^-- Generated from natural language query\n/, '').trim(),
        query_name: queryName,
        execution_status: queryResults ? 'SUCCESS' : 'NOT_EXECUTED',
        row_count: queryResults?.rowCount || queryResults?.data?.length || null
      });
      
      if (response.success) {
        // Clear state
        setHasUnsavedChanges(false);
        originalSqlRef.current = sqlQuery;
        clearHistory();
        
        // Navigate if user was trying to go somewhere
        if (blockedNextLocationRef.current) {
          const nextPath = blockedNextLocationRef.current;
          blockedNextLocationRef.current = null;
          allowNavigationRef.current = true; // Bypass guard
          navigate(nextPath);
        }
      } else {
        alert(response.error || 'Failed to update query');
      }
    } catch (error) {
      console.error('Error saving query:', error);
      alert('An error occurred while saving the query');
    } finally {
      setIsSaving(false);
      saveInProgressRef.current = false;
    }
  }, [id, sqlQuery, queryName, queryResults, clearHistory, navigate]);

  // Handle unsaved changes dialog actions
  const handleUnsavedSave = useCallback(() => {
    if (id && id !== 'new') {
      handleQuickSave();
    } else {
      setSaveMode('new');
      setSaveDialogOpen(true);
    }
    setUnsavedDialogOpen(false);
  }, [id, handleQuickSave]);

  const handleUnsavedDiscard = useCallback(() => {
    setUnsavedDialogOpen(false);
    allowNavigationRef.current = true;
    clearHistory();
    setHasUnsavedChanges(false);
    
    if (pendingNavigationRef.current) {
      const action = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      action();
    }
  }, [clearHistory]);

  const handleUnsavedCancel = useCallback(() => {
    setUnsavedDialogOpen(false);
    pendingNavigationRef.current = null;
  }, []);

  // Block navigation if unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges || !navigationContext) return;

    const { navigator } = navigationContext;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;

    // Intercept push navigation
    navigator.push = (...args) => {
      // Allow navigation if we just saved
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        originalPush.apply(navigator, args);
        return;
      }

      // Store where user wanted to go
        blockedNextLocationRef.current = typeof args[0] === 'string' ? args[0] : args[0].pathname;
        
      // Store the navigation action
      pendingNavigationRef.current = () => {
        originalPush.apply(navigator, args);
      };
      
      // Open the unsaved changes dialog
      setUnsavedDialogOpen(true);
    };

    // Intercept replace navigation
    navigator.replace = (...args) => {
      // Allow navigation if we just saved
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        originalReplace.apply(navigator, args);
        return;
      }

      // Store where user wanted to go
        blockedNextLocationRef.current = typeof args[0] === 'string' ? args[0] : args[0].pathname;
        
      // Store the navigation action
      pendingNavigationRef.current = () => {
        originalReplace.apply(navigator, args);
      };
      
      // Open the unsaved changes dialog
      setUnsavedDialogOpen(true);
    };

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [hasUnsavedChanges, id, clearHistory, navigationContext, handleQuickSave]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close save dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(event.target)) {
        setSaveDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleTitleClick = () => {
    setEditedTitle(queryName);
    setIsEditingTitle(true);
  };
  
  const handleTitleSave = async () => {
    const newTitle = editedTitle.trim();
    if (!newTitle) {
      setIsEditingTitle(false);
      return;
    }
    
    setQueryName(newTitle);
    setIsEditingTitle(false);
    
    if (id && id !== 'new') {
      try {
        await QueryManagementService.renameQuery(id, newTitle);
      } catch (error) {
        console.error('Error updating query title:', error);
      }
    }
  };
  
  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleSaveQuery = async (queryNameInput) => {
    // Prevent double-save
    if (saveInProgressRef.current || isSaving) {
      console.log('Save already in progress, ignoring duplicate call');
      return;
    }
    
    saveInProgressRef.current = true;
    setIsSaving(true);
    try {
      if (saveMode === 'new') {
        // Save as new query
        const response = await QueryManagementService.saveQuery({
          generated_sql: sqlQuery.replace(/^-- Generated from natural language query\n/, '').trim(),
          query_name: queryNameInput,
          execution_status: queryResults ? 'SUCCESS' : 'NOT_EXECUTED',
          row_count: queryResults?.rowCount || queryResults?.data?.length || null
        });
        
        if (response.success) {
          // Clear state
          setQueryName(queryNameInput);
          setHasUnsavedChanges(false);
          originalSqlRef.current = sqlQuery;
          clearHistory();
          setSaveDialogOpen(false);
          
          // Navigate
          allowNavigationRef.current = true; // Bypass guard
          if (blockedNextLocationRef.current) {
            const nextPath = blockedNextLocationRef.current;
            blockedNextLocationRef.current = null;
            navigate(nextPath);
          } else {
            // Navigate to the new query
            navigate(`/query/${response.query_id}`, { 
              replace: true,
              state: { 
                query: {
                  id: response.query_id,
                  query_name: queryNameInput,
                  generated_sql: sqlQuery
                }
              }
            });
          }
        } else {
          alert(response.error || 'Failed to save query');
        }
      } else {
        // Update existing query
        const response = await QueryManagementService.updateQuery(id, {
          generated_sql: sqlQuery.replace(/^-- Generated from natural language query\n/, '').trim(),
          query_name: queryNameInput,
          execution_status: queryResults ? 'SUCCESS' : 'NOT_EXECUTED',
          row_count: queryResults?.rowCount || queryResults?.data?.length || null
        });
        
        if (response.success) {
          // Clear state
          setQueryName(queryNameInput);
          setHasUnsavedChanges(false);
          originalSqlRef.current = sqlQuery;
          clearHistory();
          setSaveDialogOpen(false);
          
          // Navigate if user was trying to go somewhere
          if (blockedNextLocationRef.current) {
            const nextPath = blockedNextLocationRef.current;
            blockedNextLocationRef.current = null;
            allowNavigationRef.current = true; // Bypass guard
            navigate(nextPath);
          }
        } else {
          alert(response.error || 'Failed to update query');
        }
      }
    } catch (error) {
      console.error('Error saving query:', error);
      alert('An error occurred while saving the query');
    } finally {
      setIsSaving(false);
      saveInProgressRef.current = false;
    }
  };

  const openSaveDialog = (mode) => {
    setSaveMode(mode);
    setSaveDialogOpen(true);
  };

  const { mutate: processNaturalLanguage, isPending: aiQueryLoading } = useProcessNaturalLanguage({
    onSqlGenerated: (sql, chartRecommendation, reasoning) => {
      const commentPrefix = `-- Generated from natural language query\n`;
      setSqlQuery(commentPrefix + sql);
      setQueryError(null);
      
      // AI has responded - stop typing indicator immediately
      setIsAiTyping(false);
      
      // Save the model's reasoning as a bot message
      if (reasoning) {
        addBotMessage(reasoning);
      }
    },
    // PROGRESSIVE CALLBACK: Results ready - show immediately!
    onResultsReady: (results, chartData) => {
      setQueryResults(results);
      setChartData(chartData);
    },
    // Final success/error handler (react-query's onSuccess)
    onSuccess: (data) => {
      if (!data.success && data.error) {
        // Check if this is a "no SQL generated" scenario
        if (data.error_type === 'NO_SQL_GENERATED') {
          setQueryError(null); // Don't show in results area
          setIsAiTyping(false);
          
          // Add bot message for the guidance
          if (data.reasoning) {
            addBotMessage(data.reasoning);
          }
        } else {
          // Regular error - show in results area
          setQueryError(data.error);
        }
      } else if (data.contextForNextQuery) {
        // Save context for intent-aware schema reuse on next query
        setQueryContext(data.contextForNextQuery);
        console.log(`Intent: ${data.intent} (${(data.intentConfidence * 100).toFixed(1)}%) - Context saved for next query`);
      }
    },
    // React-query's onError for network/unexpected errors
    onError: (error) => {
      console.error('AI Query failed:', error);
      setQueryError(error.message || 'Failed to process natural language query');
      setIsAiTyping(false); // Stop typing indicator on error
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
    setIsAiTyping(true); // Start typing indicator
    
    // Add user message to conversation history (scoped to this query ID)
    addUserMessage(naturalLanguageQuery);
    
    // Pass conversation history to LLM (only user messages)
    const historyStrings = conversationHistory
      .filter(m => m.role === 'user')
      .map(m => m.content);
    
    // Build context for intent-aware schema reuse
    // Use SQL from editor if available, otherwise fall back to last generated SQL
    const hasValidSql = sqlQuery && 
                        sqlQuery.trim() !== "" && 
                        sqlQuery.toLowerCase().includes('select');
    const currentSql = hasValidSql ? sqlQuery.replace(/^-- Generated from natural language query\n/, '').trim() : queryContext.lastSql;
    
    const context = {
      sessionId: sessionIdRef.current,
      ...(currentSql && { lastSql: currentSql }),
      ...(queryContext.lastSchemaRecommendations && { lastSchemaRecommendations: queryContext.lastSchemaRecommendations })
    };
    
    processNaturalLanguage({ 
      nlQuery: naturalLanguageQuery,
      conversationHistory: [naturalLanguageQuery, ...historyStrings],
      context
    });
  };

  const handleClearHistory = () => {
    clearHistory();
    setQueryContext({});
    // Generate new session ID for this query
    sessionIdRef.current = `session-${id || 'new'}-${Date.now()}`;
    console.log(`Conversation history cleared for query ${id || 'new'} - starting fresh session`);
  };

  const handleExecuteQuery = () => {
    setQueryError(null);
    executeSql({ sql: sqlQuery });
  };

  const queryLoading = aiQueryLoading || manualQueryLoading;


  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-[#101012] border-gray-800/60' : 'bg-white/95 border-gray-200/60'} border-b px-4 py-2 backdrop-blur-sm relative z-20`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              {/* Back Button */}
              <button
                onClick={() => {
                  if (hasUnsavedChanges) {
                    // Store destination and action
                      blockedNextLocationRef.current = '/queries';
                    pendingNavigationRef.current = () => {
                      clearHistory();
                      navigate('/queries');
                    };
                    setUnsavedDialogOpen(true);
                      return;
                  }
                  // Clear conversation history and navigate
                  clearHistory();
                  navigate('/queries');
                }}
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
                    {queryName}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Save Button(s) in Header */}
          <div className="flex items-center">
            {id && id !== 'new' ? (
              /* Existing query - Split button with dropdown */
              <div className="relative" ref={saveDropdownRef}>
                <div className="flex">
                  {/* Main Save Button */}
                  <button
                    onClick={handleQuickSave}
                    disabled={isSaving}
                    className={`
                      px-2.5 py-1.5 text-xs font-medium rounded-l-md transition-all flex items-center gap-1.5
                      bg-[#5d6ad3] text-white
                      ${!isSaving ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                    `}
                  >
                    {isSaving && (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                    )}
                    Save
                  </button>
                  
                  {/* Dropdown Arrow */}
                  <button
                    onClick={() => setSaveDropdownOpen(!saveDropdownOpen)}
                    disabled={isSaving}
                    className={`
                      px-1.5 py-1.5 rounded-r-md border-l border-[#4f5bc4] transition-all
                      bg-[#5d6ad3] text-white
                      ${!isSaving ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                    `}
                  >
                    <svg className={`w-3 h-3 transition-transform ${saveDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {/* Dropdown Menu */}
                {saveDropdownOpen && (
                  <div className={`
                    absolute right-0 mt-1 w-32 rounded-md shadow-xl border
                    ${isDark ? 'bg-[#1c1d1f] border-gray-700' : 'bg-white border-gray-200'}
                  `}>
                    <button
                      onClick={() => {
                        setSaveDropdownOpen(false);
                        openSaveDialog('new');
                      }}
                      className={`
                        w-full px-2.5 py-1.5 text-xs text-left rounded-md transition-colors
                        ${isDark 
                          ? 'text-gray-300 hover:bg-gray-700' 
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      Save as new
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* New query - Single "Save as new" button */
              <button
                onClick={() => openSaveDialog('new')}
                disabled={isSaving}
                className={`
                  px-2.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5
                  bg-[#5d6ad3] text-white
                  ${!isSaving ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                `}
              >
                {isSaving && (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                )}
                Save as new
              </button>
            )}
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
                            ? 'bg-[#7a84db] cursor-not-allowed'
                            : 'bg-[#5d6ad3] hover:bg-[#4f5bc4]'
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
            ${isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white/50 border-gray-200/50 backdrop-blur-sm'} 
            border-l flex flex-col overflow-hidden
          `}
        >
          <div className={`${aiPanelCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 h-full flex flex-col overflow-hidden`} style={{ width: 320 }}>
            {/* Header - Fixed */}
            <div className="flex-shrink-0 p-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <Text variant="h6" className="font-bold text-sm whitespace-nowrap">
                    Actyze AI
                  </Text>
                </div>
                {conversationHistory.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      isDark 
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title="Clear conversation history"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {/* Conversation History - Scrollable */}
            <div className="flex-1 min-h-0 p-3 overflow-y-auto">
              {conversationHistory.length > 0 || isAiTyping ? (
                <div className="space-y-3">
                  {/* Reverse to show oldest first (like chat) */}
                  {[...conversationHistory].reverse().map((message, index) => {
                    const isBot = message.role === 'assistant';
                    return (
                      <div 
                        key={message.timestamp || index} 
                        className={`flex ${isBot ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`
                            max-w-[85%] text-left px-3 py-2 text-sm
                            ${isBot
                              ? `rounded-2xl rounded-tr-sm ${
                                  isDark
                                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                                    : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
                                }`
                              : `rounded-2xl rounded-tl-sm ${
                                  isDark
                                    ? 'bg-[#2a2b2e] text-gray-100'
                                    : 'bg-gray-200 text-gray-800'
                                }`
                            }
                          `}
                        >
                          {message.content}
                        </div>
                      </div>
                    );
                  })}
                  {/* Typing indicator when AI is thinking */}
                  {isAiTyping && <TypingIndicator />}
                </div>
              ) : (
                <div className="h-full flex flex-col p-2 overflow-y-auto">
                  {/* Welcome Header */}
                  <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    How can I help?
                  </h3>
                  <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    I can assist you with:
                  </p>
                  
                  {/* Capability Cards */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {/* Card 1 */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#1c1d1f] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                      <svg className={`w-4 h-4 mb-1.5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                      <p className={`text-xs leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Generate SQL from natural language
                      </p>
                    </div>
                    
                    {/* Card 2 */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#1c1d1f] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                      <svg className={`w-4 h-4 mb-1.5 ${isDark ? 'text-green-400' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      <p className={`text-xs leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Refine queries through conversation
                      </p>
                    </div>
                    
                  </div>
                  
                  {/* Note */}
                  <div className={`flex items-start gap-2 p-2 rounded-lg ${isDark ? 'bg-[#1c1d1f]' : 'bg-gray-50'}`}>
                    <svg className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <p className={`text-xs leading-snug ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Responses may take a moment and queries should be reviewed before running.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* AI Input - Fixed at Bottom */}
            <div className={`flex-shrink-0 p-3 border-t ${isDark ? 'border-[#2a2b2e] bg-[#131415]' : 'border-gray-200/50 bg-gray-50/50'}`}>
              <AIQueryInput 
                onSubmit={handleAIQuery}
                loading={queryLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Query Dialog */}
      <SaveQueryDialog
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveQuery}
        mode={saveMode}
        currentName={queryName}
        loading={isSaving}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={unsavedDialogOpen}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
        loading={isSaving}
      />
    </div>
  );
};

export default QueryPage;
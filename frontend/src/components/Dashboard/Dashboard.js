import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Grid, IconButton, Typography, Menu, MenuItem, CircularProgress } from '@mui/material';
import { Card, Button } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';
import SqlTileModal from './SqlTileModal';
import ShareModal from './ShareModal';
import { QueryResults } from '../QueryExplorer';
import { Chart } from '../Charts';
import { RestService, DashboardService, QueryManagementService } from '../../services';
import { transformQueryResults } from '../../utils/dataTransformers';

const Dashboard = ({ isPublic = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingTiles, setLoadingTiles] = useState({});
  const [tileData, setTileData] = useState({});
  const [tileErrors, setTileErrors] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [recentQueries, setRecentQueries] = useState([]);
  
  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef(null);
  
  // Ref to prevent duplicate dashboard creation (React StrictMode runs effects twice)
  const isCreatingRef = useRef(false);
  
  // Ref to track in-flight tile query executions (prevents duplicate API calls)
  const executingTilesRef = useRef(new Set());

  // Load dashboard and tiles on mount or when ID changes
  useEffect(() => {
    if (id && id !== 'new') {
      loadDashboard();
    } else if (id === 'new') {
      // Auto-create dashboard with default title
      if (!isCreatingRef.current) {
        isCreatingRef.current = true;
        createNewDashboard();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isPublic]);

  // Load recent queries once for import feature
  useEffect(() => {
    if (!isPublic && recentQueries.length === 0) {
      QueryManagementService.getQueryHistory({ limit: 20 }).then(response => {
        if (response.success) {
          setRecentQueries(response.queries || []);
        }
      });
    }
  }, [isPublic, recentQueries.length]);

  const createNewDashboard = async () => {
    setLoadingDashboard(true);
    const response = await DashboardService.createDashboard({
      title: 'Untitled Dashboard',
      description: '',
      is_public: false,
      is_anonymous_public: false,
      configuration: {}
    });

    if (response.success && response.dashboard?.id) {
      // Reset ref before navigation
      isCreatingRef.current = false;
      // Redirect to the new dashboard
      navigate(`/dashboard/${response.dashboard.id}`, { replace: true });
    } else {
      alert(response.error || 'Failed to create dashboard');
      setLoadingDashboard(false);
      isCreatingRef.current = false; // Reset so user can retry
    }
  };

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      // Load dashboard + tiles in ONE call (optimized)
      let response;
      if (isPublic) {
        // Public dashboards still need separate calls (no auth, different endpoints)
        const dashboardResponse = await DashboardService.getPublicDashboard(id);
      if (!dashboardResponse.success) {
        setDashboardError(dashboardResponse.error);
          setLoadingDashboard(false);
          return;
        }
        const tilesResponse = await DashboardService.getPublicDashboardTiles(id);
        response = {
          success: dashboardResponse.success,
          dashboard: dashboardResponse.dashboard,
          tiles: tilesResponse.success ? tilesResponse.tiles : []
        };
      } else {
        // Authenticated: load dashboard + tiles in ONE call
        response = await DashboardService.getDashboard(id, { includeTiles: true });
      }
      
      if (!response.success) {
        setDashboardError(response.error);
        setLoadingDashboard(false);
        return;
      }

      setDashboard(response.dashboard);
      
      const tilesArray = response.tiles || [];
      setTiles(tilesArray);
        
        // Execute queries for all tiles
      tilesArray.forEach(tile => {
          executeTileQuery(tile);
        });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboardError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const executeTileQuery = async (tile) => {
    // Prevent duplicate execution using synchronous ref check
    if (executingTilesRef.current.has(tile.id)) {
      console.log(`Skipping duplicate execution for tile ${tile.id}`);
      return;
    }
    
    // Mark tile as executing (synchronous, prevents race conditions)
    executingTilesRef.current.add(tile.id);
    
    setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
    setTileErrors(prev => ({ ...prev, [tile.id]: null }));

    try {
      // Execute the SQL query using the real API
      const response = await RestService.executeSql(tile.sql_query, 500, 30);
      
      if (!response.success) {
        throw new Error(response.error || 'Query execution failed');
      }

      // Transform query results using the standard transformer
      // This converts rows from arrays to objects with column names as keys
      const queryData = transformQueryResults(response.query_results);
      
      if (!queryData) {
        throw new Error('No data returned from query');
      }

      // Prepare chart config - auto-detect if empty
      let chartConfig = tile.chart_config || {};
      
      // If chart_config is empty or missing fields, auto-detect from columns
      if (tile.chart_type !== 'table' && (!chartConfig.xField || !chartConfig.yField)) {
        
        // Try to detect column types from actual data values
        const detectColumnType = (colName) => {
          if (!queryData.data || queryData.data.length === 0) return 'string';
          const sampleValue = queryData.data[0][colName];
          if (typeof sampleValue === 'number') return 'number';
          if (!isNaN(parseFloat(sampleValue)) && isFinite(sampleValue)) return 'number';
          return 'string';
        };
        
        // Find first string column for x-axis
        const stringColumn = queryData.columns.find(col => {
          const colType = col.type || detectColumnType(col.name);
          return colType === 'string' || colType === 'varchar' || colType === 'date';
        });
        
        // Find first numeric column for y-axis
        const numericColumn = queryData.columns.find(col => {
          const colType = col.type || detectColumnType(col.name);
          return colType === 'number' || colType === 'integer' || colType === 'bigint' || 
                 colType === 'decimal' || colType === 'double';
        });
        
        if (stringColumn && numericColumn) {
          chartConfig = {
            ...chartConfig,
            xField: stringColumn.name,
            yField: numericColumn.name,
            x_column: stringColumn.name,
            y_column: numericColumn.name
          };
        } else if (queryData.columns.length >= 2) {
          // Fallback to first two columns
          chartConfig = {
            ...chartConfig,
            xField: queryData.columns[0]?.name || 'x',
            yField: queryData.columns[1]?.name || 'y',
            x_column: queryData.columns[0]?.name || 'x',
            y_column: queryData.columns[1]?.name || 'y'
          };
        } else if (queryData.columns.length === 1) {
          // Single column - use column name for both (will show as single value)
          const colName = queryData.columns[0]?.name || 'value';
          chartConfig = {
            ...chartConfig,
            xField: colName,
            yField: colName,
            x_column: colName,
            y_column: colName
          };
        }
      }

      // Validate chart data compatibility
      let chartData = null;
      let validationError = null;
      
      if (tile.chart_type !== 'table') {
        // Check if chart type is compatible with data
        const isIndicatorChart = tile.chart_type === 'indicator' || tile.chart_type === 'metric';
        const hasOnlyOneColumn = queryData.columns.length === 1;
        const hasNumericData = queryData.columns.some(col => 
          col.type && (col.type.toLowerCase().includes('int') || 
                      col.type.toLowerCase().includes('decimal') || 
                      col.type.toLowerCase().includes('float') ||
                      col.type.toLowerCase().includes('double') ||
                      col.type.toLowerCase().includes('numeric'))
        );
        
        // Validate: Non-indicator charts need at least 2 columns or numeric data
        if (!isIndicatorChart && hasOnlyOneColumn && !hasNumericData) {
          validationError = `Chart type "${tile.chart_type}" requires numeric data. Your query returns only categorical data. Try adding a COUNT() or SUM() to your query, or change the chart type to "Table".`;
        } else if (!isIndicatorChart && queryData.columns.length === 0) {
          validationError = 'No data columns returned from query.';
        } else {
          // Prepare chart data if needed
          // For dashboard tiles, charts are always in "manual" mode (pre-configured via tile settings)
          // We set source: 'tile' and ensure xField/yField are always present to avoid the config placeholder
          chartData = {
            chart: {
              type: tile.chart_type,
              config: {
                ...chartConfig,
                // Ensure xField and yField are always set to prevent manual config UI
                xField: chartConfig.xField || chartConfig.x_column,
                yField: chartConfig.yField || chartConfig.y_column,
              },
              fallback: false,
              source: 'tile'
            },
            data: queryData,
            cached: false
          };
        }
      }

      if (validationError) {
        setTileErrors(prev => ({ ...prev, [tile.id]: validationError }));
      } else {
        setTileData(prev => ({
          ...prev,
          [tile.id]: {
            queryResults: queryData,
            chartData
          }
        }));
      }
    } catch (error) {
      console.error('Error executing tile query:', error);
      setTileErrors(prev => ({ ...prev, [tile.id]: error.message }));
    } finally {
      // Remove from in-flight set (synchronous cleanup)
      executingTilesRef.current.delete(tile.id);
      setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
    }
  };

  const handleCreateTile = () => {
    setEditingTile(null);
    setModalOpen(true);
  };

  const handleEditTile = (tile) => {
    setEditingTile(tile);
    setModalOpen(true);
    handleMenuClose();
  };

  const handleDeleteTile = async (tileId) => {
    if (!window.confirm('Are you sure you want to delete this tile?')) {
      return;
    }

    const response = await DashboardService.deleteTile(id, tileId);
    
    if (response.success) {
      setTiles(prev => prev.filter(t => t.id !== tileId));
      setTileData(prev => {
        const newData = { ...prev };
        delete newData[tileId];
        return newData;
      });
      setTileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[tileId];
        return newErrors;
      });
    } else {
      alert(`Failed to delete tile: ${response.error}`);
    }
    
    handleMenuClose();
  };

  const handleSaveTile = async (tileFormData) => {
    let response;
    
    if (editingTile) {
      // Update existing tile
      const updatePayload = {
        title: tileFormData.title,
        description: tileFormData.description || null,
        sql_query: tileFormData.sqlQuery,
        nl_query: tileFormData.nlQuery || null,
        chart_type: tileFormData.chartType,
        chart_config: tileFormData.chartConfig || {},
        position_x: tileFormData.position_x || editingTile.position_x,
        position_y: tileFormData.position_y || editingTile.position_y,
        width: tileFormData.width || editingTile.width,
        height: tileFormData.height || editingTile.height,
        refresh_interval_seconds: tileFormData.refresh_interval_seconds || null
      };
      
      response = await DashboardService.updateTile(id, editingTile.id, updatePayload);

      if (response.success) {
        // Merge response with our payload to ensure we have all fields
        // (API might return partial data)
        const updatedTile = {
          ...editingTile,
          ...response.tile,
          sql_query: updatePayload.sql_query,
          chart_type: updatePayload.chart_type,
          chart_config: updatePayload.chart_config
        };
        
        // Clear old tile data first to force re-render
        setTileData(prev => {
          const newData = { ...prev };
          delete newData[updatedTile.id];
          return newData;
        });
        
        setTileErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[updatedTile.id];
          return newErrors;
        });
        
        // Update tile in list
        setTiles(prev => prev.map(t => t.id === updatedTile.id ? updatedTile : t));
        
        // Re-execute query with updated tile
        executeTileQuery(updatedTile);
      }
    } else {
      // Create new tile
      const nextPosition = calculateNextTilePosition();
      
      response = await DashboardService.createTile(id, {
        title: tileFormData.title,
        description: tileFormData.description || null,
        sql_query: tileFormData.sqlQuery,
        nl_query: tileFormData.nlQuery || null,
        chart_type: tileFormData.chartType,
        chart_config: tileFormData.chartConfig || {},
        position_x: nextPosition.x,
        position_y: nextPosition.y,
        width: 6,
        height: 4,
        refresh_interval_seconds: null
      });

      if (response.success) {
        // Merge response with our payload to ensure sql_query is included
        // (API might not return sql_query in the response)
        const newTile = {
          ...response.tile,
          sql_query: tileFormData.sqlQuery,
          chart_type: tileFormData.chartType,
          chart_config: tileFormData.chartConfig || {}
        };
        setTiles(prev => [...prev, newTile]);
        executeTileQuery(newTile);
      }
    }
    
    if (!response.success) {
      alert(`Failed to save tile: ${response.error}`);
      return;
    }
    
    // Clear editing state and close modal
    setEditingTile(null);
    setModalOpen(false);
  };

  const calculateNextTilePosition = () => {
    if (tiles.length === 0) {
      return { x: 0, y: 0 };
    }
    
    // Find the max Y position and add height
    const maxTile = tiles.reduce((max, tile) => {
      const tileBottom = (tile.position_y || 0) + (tile.height || 4);
      return tileBottom > max.bottom ? { bottom: tileBottom, tile } : max;
    }, { bottom: 0, tile: null });

    return { x: 0, y: maxTile.bottom };
  };

  // Focus title input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    if (isPublic) return; // Don't allow editing in public view
    const currentTitle = dashboard?.title || 'Untitled Dashboard';
    setEditedTitle(currentTitle);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle.trim() !== dashboard?.title) {
      // Save to backend
      const response = await DashboardService.updateDashboard(dashboard.id, {
        title: editedTitle.trim(),
        description: dashboard?.description || '',
        is_public: dashboard?.is_public || false,
        is_anonymous_public: dashboard?.is_anonymous_public || false,
      });

      if (response.success) {
        setDashboard(prev => ({ ...prev, title: editedTitle.trim() }));
      }
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

  const handleSaveShareSettings = async (shareData) => {
    if (!dashboard) return;
    
    setLoadingDashboard(true);
    
    const response = await DashboardService.updateDashboard(dashboard.id, {
      title: dashboard.title,
      description: dashboard.description || '',
      is_public: shareData.is_public || false,
      is_anonymous_public: shareData.is_anonymous_public || false,
    });

    if (response.success) {
      setDashboard(prev => ({
        ...prev,
        is_public: shareData.is_public,
        is_anonymous_public: shareData.is_anonymous_public
      }));
      setShareModalOpen(false);
    } else {
      alert(response.error || 'Failed to update sharing settings');
    }
    setLoadingDashboard(false);
  };

  const handlePublish = async () => {
    if (!dashboard?.id) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to publish this dashboard? This will create a new version and make it visible to others with access.'
    );
    
    if (!confirmed) return;
    
    setLoadingDashboard(true);
    try {
      const response = await DashboardService.publishDashboard(dashboard.id);
      if (response.success) {
        // Reload dashboard to get updated status
        await loadDashboard();
        alert(`Dashboard published successfully! Version ${response.version}`);
      } else {
        alert(response.error || 'Failed to publish dashboard');
      }
    } catch (error) {
      alert('Failed to publish dashboard: ' + error.message);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleRefreshTile = (tile) => {
    executeTileQuery(tile);
    handleMenuClose();
  };

  const handleMenuOpen = (event, tileId) => {
    setAnchorEl(event.currentTarget);
    setSelectedTileId(tileId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTileId(null);
  };

  const renderTile = (tile) => {
    const loading = loadingTiles[tile.id];
    const error = tileErrors[tile.id];
    const data = tileData[tile.id];

    return (
      <Grid item xs={12} md={6} key={tile.id}>
        <Card padding="xs" className={`h-full ${isDark ? 'bg-[#1c1d1f]' : 'bg-white'}`}>
          <Card.Header divider={false} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-2 px-3">
            <Card.Title className="text-sm font-medium">{tile.title}</Card.Title>
            {!isPublic && (
              <IconButton 
                size="small" 
                onClick={(e) => handleMenuOpen(e, tile.id)}
                sx={{ color: isDark ? '#9ca3af' : 'inherit' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </IconButton>
            )}
          </Card.Header>
          
          <Card.Body className="p-0">
            {error ? (
              <div className="text-center py-4 px-3">
                <div className="text-red-500 dark:text-red-400 mb-1">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <Typography variant="body2" color="error" className="text-xs">
                  {error}
                </Typography>
              </div>
            ) : tile.chart_type === 'table' ? (
              <div className="w-full" style={{ maxHeight: '300px', overflow: 'auto' }}>
                <QueryResults 
                  queryData={data?.queryResults}
                  loading={loading}
                  error={error}
                />
              </div>
            ) : (
              <div 
                className="w-full" 
                style={{ 
                  height: '250px',
                  maxHeight: '250px',
                  overflow: 'hidden'
                }}
              >
                <Chart 
                  key={`${tile.id}-${tile.chart_type}`}
                  chartData={data?.chartData}
                  loading={loading}
                  error={error}
                  embedded={true}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      </Grid>
    );
  };

  const selectedTile = tiles.find(t => t.id === selectedTileId);

  if (loadingDashboard) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
        <div className="text-center">
          <CircularProgress size={40} />
          <Typography 
            variant="body1" 
            className="mt-4"
            sx={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            Loading dashboard...
          </Typography>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
        <div className="text-center">
          <div className="text-red-500 dark:text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <Typography variant="h6" className="mb-2" sx={{ color: isDark ? '#fff' : 'inherit' }}>
            Failed to load dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {dashboardError}
          </Typography>
          <Button 
            onClick={() => navigate('/dashboards')}
            className="mt-4"
          >
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-[#101012] border-gray-800/60' : 'bg-white/95 border-gray-200/60'} border-b px-4 py-2 backdrop-blur-sm`}>
        <div className="flex items-center space-x-3 w-full">
          {/* Back Button - Only for authenticated users */}
          {!isPublic && (
            <button
              onClick={() => navigate('/dashboards')}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'}`}
              title="Back to Dashboards"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Editable Title */}
          <div className="flex-1 flex items-center">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className={`
                  text-lg font-bold w-64 px-1 py-0.5 
                  bg-transparent border-0 border-b-2 border-blue-500 
                  outline-none transition-all
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}
                placeholder="Enter dashboard name..."
              />
            ) : (
              <button
                onClick={handleTitleClick}
                disabled={isPublic}
                className={`
                  text-lg font-bold px-1 py-0.5 transition-all text-left border-b-2 border-transparent
                  ${isPublic 
                    ? 'cursor-default' 
                    : isDark 
                      ? 'text-white hover:border-gray-600' 
                      : 'text-gray-900 hover:border-gray-300'
                  }
                `}
                title={isPublic ? undefined : "Click to edit title"}
              >
                {dashboard?.title || 'Untitled Dashboard'}
              </button>
            )}
          </div>
          
          {/* Action Buttons - Only for authenticated users */}
          {!isPublic && dashboard && (
            <div className="flex items-center gap-3">
              {/* Publish Button - Only show for drafts with at least one tile */}
              {dashboard.status === 'draft' && tiles.length > 0 && (
                <button
                  onClick={handlePublish}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  title="Publish Dashboard"
                >
                  Publish
                </button>
              )}
              
              {/* Status badge - show if shared or public */}
              {(dashboard.is_public || dashboard.is_anonymous_public) && (
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  dashboard.is_anonymous_public
                    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                    : isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                }`}>
                  {dashboard.is_anonymous_public ? 'public' : 'shared'}
                </span>
              )}
              
              {/* Share Button - Clean icon style */}
              <button
                onClick={() => setShareModalOpen(true)}
                className={`
                  p-2 rounded-lg transition-colors
                  ${isDark 
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }
                `}
                title="Share Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Action Bar - Only show for authenticated users */}
          {!isPublic && (
            <div className="flex items-center justify-end mb-4">
              <button 
                onClick={handleCreateTile}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Tile
              </button>
            </div>
          )}

          {tiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-96">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                </div>
                <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Add Tiles to get started
                </p>
                <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create SQL queries and visualize your data
                </p>
                {!isPublic && (
                  <div className="flex justify-center">
                    <button 
                      onClick={handleCreateTile}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Tile
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Grid container spacing={3}>
              {tiles.map(tile => renderTile(tile))}
            </Grid>
          )}
        </div>
      </div>

      <SqlTileModal 
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          // If we're on the /new route and closing without creating, go back
          if (id === 'new' && !dashboard) {
            isCreatingRef.current = false; // Reset ref to allow creating again
            navigate('/dashboards');
          }
        }}
        onSave={handleSaveTile}
        initialData={editingTile}
        recentQueries={recentQueries}
      />

      <ShareModal 
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onSave={handleSaveShareSettings}
        dashboard={dashboard}
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: isDark ? '#1f2937' : '#fff',
            color: isDark ? '#fff' : 'inherit',
            minWidth: 120,
            borderRadius: '6px',
            border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
            '& .MuiMenuItem-root': {
              fontSize: '13px',
              padding: '6px 12px',
              minHeight: 'auto'
            }
          }
        }}
      >
        <MenuItem onClick={() => handleRefreshTile(selectedTile)}>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </div>
        </MenuItem>
        <MenuItem onClick={() => handleEditTile(selectedTile)}>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </div>
        </MenuItem>
        <MenuItem onClick={() => handleDeleteTile(selectedTileId)}>
          <div className="flex items-center gap-2 text-red-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </div>
        </MenuItem>
      </Menu>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Grid, IconButton, Typography, Menu, MenuItem, CircularProgress } from '@mui/material';
import { Card, Button } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';
import SqlTileModal from './SqlTileModal';
import { QueryResults } from '../QueryExplorer';
import { Chart } from '../Charts';
import { QueryExecutionService, DashboardService } from '../../services';

const Dashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingTiles, setLoadingTiles] = useState({});
  const [tileData, setTileData] = useState({});
  const [tileErrors, setTileErrors] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  
  // Ref to prevent duplicate dashboard creation (React StrictMode runs effects twice)
  const isCreatingRef = useRef(false);

  // Load dashboard and tiles on mount or when ID changes
  useEffect(() => {
    if (id && id !== 'new') {
      loadDashboard();
    } else if (id === 'new') {
      // Create a new dashboard (with guard against StrictMode double-call)
      if (!isCreatingRef.current) {
        isCreatingRef.current = true;
        createNewDashboard();
      }
    }
  }, [id]);

  const createNewDashboard = async () => {
    setLoadingDashboard(true);
    const response = await DashboardService.createDashboard({
      title: 'New Dashboard',
      description: 'Dashboard created on ' + new Date().toLocaleDateString(),
      is_public: false,
      configuration: {}
    });

    if (response.success && response.dashboard?.id) {
      // Redirect to the new dashboard
      navigate(`/dashboard/${response.dashboard.id}`, { replace: true });
    } else {
      setDashboardError(response.error || 'Failed to create dashboard');
      setLoadingDashboard(false);
      isCreatingRef.current = false; // Reset so user can retry
    }
  };

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      // Load dashboard details
      const dashboardResponse = await DashboardService.getDashboard(id);
      
      if (!dashboardResponse.success) {
        setDashboardError(dashboardResponse.error);
        setLoadingDashboard(false);
        return;
      }

      setDashboard(dashboardResponse.dashboard);

      // Load tiles for this dashboard
      const tilesResponse = await DashboardService.getTiles(id);
      
      if (tilesResponse.success) {
        setTiles(tilesResponse.tiles);
        
        // Execute queries for all tiles
        tilesResponse.tiles.forEach(tile => {
          executeTileQuery(tile);
        });
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboardError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const executeTileQuery = async (tile) => {
    console.log('Executing tile query:', tile.id, tile.title);
    setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
    setTileErrors(prev => ({ ...prev, [tile.id]: null }));

    try {
      // Execute the SQL query
      console.log('SQL Query:', tile.sql_query);
      const response = await QueryExecutionService.executeQuery(tile.sql_query);
      
      console.log('Query response:', response);
      
      if (response.error) {
        throw new Error(response.error);
      }

      // Store the query results
      const responseData = response.data || {};
      const queryData = {
        data: responseData.data || [],
        columns: responseData.columns || [],
        rowCount: responseData.rowCount || 0
      };

      console.log('Query data:', queryData);

      // Prepare chart config - auto-detect if empty
      let chartConfig = tile.chart_config || {};
      
      // If chart_config is empty or missing fields, auto-detect from columns
      if (tile.chart_type !== 'table' && (!chartConfig.xField || !chartConfig.yField)) {
        console.log('Auto-detecting chart config from columns:', queryData.columns);
        
        // Find first string column for x-axis
        const stringColumn = queryData.columns.find(col => 
          col.type === 'string' || col.type === 'varchar' || col.type === 'date'
        );
        
        // Find first numeric column for y-axis
        const numericColumn = queryData.columns.find(col => 
          col.type === 'number' || col.type === 'integer' || col.type === 'bigint' || 
          col.type === 'decimal' || col.type === 'double'
        );
        
        if (stringColumn && numericColumn) {
          chartConfig = {
            ...chartConfig,
            xField: stringColumn.name,
            yField: numericColumn.name,
            x_column: stringColumn.name,  // Backend format
            y_column: numericColumn.name   // Backend format
          };
          console.log('Auto-detected chart config:', chartConfig);
        } else if (queryData.columns.length >= 2) {
          // Fallback to first two columns
          chartConfig = {
            ...chartConfig,
            xField: queryData.columns[0]?.name || 'x',
            yField: queryData.columns[1]?.name || 'y',
            x_column: queryData.columns[0]?.name || 'x',
            y_column: queryData.columns[1]?.name || 'y'
          };
          console.log('Fallback chart config:', chartConfig);
        }
      }

      // Prepare chart data if needed
      const chartData = tile.chart_type !== 'table' ? {
        chart: {
          type: tile.chart_type,
          config: chartConfig,
          fallback: false,
          source: 'tile'
        },
        data: queryData,
        cached: false
      } : null;

      console.log('Setting tile data with chartData:', chartData);

      setTileData(prev => ({
        ...prev,
        [tile.id]: {
          queryResults: queryData,
          chartData
        }
      }));
    } catch (error) {
      console.error('Error executing tile query:', error);
      setTileErrors(prev => ({ ...prev, [tile.id]: error.message }));
    } finally {
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
    console.log('Dashboard - Received tile form data:', tileFormData);
    console.log('Dashboard - Editing tile:', editingTile);
    
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
      
      console.log('Dashboard - Update payload to API:', updatePayload);
      
      response = await DashboardService.updateTile(id, editingTile.id, updatePayload);
      
      console.log('Dashboard - Update response from API:', response);

      if (response.success) {
        console.log('Dashboard - Updated tile from API:', response.tile);
        
        // Clear old tile data first to force re-render
        setTileData(prev => {
          const newData = { ...prev };
          delete newData[response.tile.id];
          return newData;
        });
        
        setTileErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[response.tile.id];
          return newErrors;
        });
        
        // Update tile in list
        setTiles(prev => prev.map(t => t.id === response.tile.id ? response.tile : t));
        
        // Re-execute query with updated tile
        executeTileQuery(response.tile);
      } else {
        console.error('Dashboard - Update failed:', response.error);
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
        setTiles(prev => [...prev, response.tile]);
        executeTileQuery(response.tile);
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
      <Grid item xs={12} md={tile.width || 6} key={tile.id}>
        <Card className={`h-full ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Card.Header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-2 px-3">
            <Card.Title className="text-sm font-medium">{tile.title}</Card.Title>
            <IconButton 
              size="small" 
              onClick={(e) => handleMenuOpen(e, tile.id)}
              sx={{ color: isDark ? '#9ca3af' : 'inherit' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </IconButton>
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
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
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
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
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
    <div className={`h-full flex flex-col ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-900/95 border-gray-800/60' : 'bg-white/95 border-gray-200/60'} border-b px-4 py-2 backdrop-blur-sm`}>
        <div className="flex items-center space-x-3">
          {/* Back Button */}
          <button
            onClick={() => navigate('/dashboards')}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'}`}
            title="Back to Dashboards"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Title */}
          <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {dashboard?.title || 'Dashboard'}
          </span>
          {dashboard?.description && (
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              — {dashboard.description}
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-end">
            <button 
              onClick={handleCreateTile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Tile
            </button>
          </div>

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
                <div className="flex justify-center">
                  <button 
                    onClick={handleCreateTile}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Tile
                  </button>
                </div>
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
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTile}
        initialData={editingTile}
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

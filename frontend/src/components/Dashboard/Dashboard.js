import React, { useState, useEffect } from 'react';
import { Grid, IconButton, Typography, Menu, MenuItem } from '@mui/material';
import { Card, Button } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';
import SqlTileModal from './SqlTileModal';
import { QueryResults } from '../QueryExplorer';
import { Chart } from '../Charts';
import { QueryExecutionService } from '../../services/QueryExecutionService';

const Dashboard = () => {
  const { isDark } = useTheme();
  const [tiles, setTiles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState(null);
  const [loadingTiles, setLoadingTiles] = useState({});
  const [tileData, setTileData] = useState({});
  const [tileErrors, setTileErrors] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null);

  // Load tiles from localStorage on mount
  useEffect(() => {
    const savedTiles = localStorage.getItem('dashboardTiles');
    if (savedTiles) {
      try {
        const parsedTiles = JSON.parse(savedTiles);
        setTiles(parsedTiles);
        // Execute queries for all tiles
        parsedTiles.forEach(tile => {
          executeTileQuery(tile);
        });
      } catch (error) {
        console.error('Error loading tiles:', error);
      }
    }
  }, []);

  // Save tiles to localStorage whenever they change
  useEffect(() => {
    if (tiles.length > 0) {
      localStorage.setItem('dashboardTiles', JSON.stringify(tiles));
    }
  }, [tiles]);

  const executeTileQuery = async (tile) => {
    setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
    setTileErrors(prev => ({ ...prev, [tile.id]: null }));

    try {
      // Execute the SQL query
      const response = await QueryExecutionService.executeQuery(tile.sqlQuery);
      
      if (response.error) {
        throw new Error(response.error);
      }

      // Store the query results - response.data contains the actual data
      const responseData = response.data || {};
      const queryData = {
        data: responseData.data || [],
        columns: responseData.columns || [],
        rowCount: responseData.rowCount || 0
      };

      setTileData(prev => ({
        ...prev,
        [tile.id]: {
          queryResults: queryData,
          chartData: tile.chartType !== 'table' ? {
            chart: {
              type: tile.chartType,
              config: autoDetectChartConfig(queryData, tile.chartType),
              fallback: false
            },
            data: queryData,
            cached: false
          } : null
        }
      }));
    } catch (error) {
      console.error('Error executing tile query:', error);
      setTileErrors(prev => ({ ...prev, [tile.id]: error.message }));
    } finally {
      setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
    }
  };

  const autoDetectChartConfig = (queryData, chartType) => {
    if (!queryData || !queryData.columns || queryData.columns.length === 0) {
      return null;
    }

    const columns = queryData.columns;
    const stringColumn = columns.find(col => col.type === 'string');
    const numericColumn = columns.find(col => col.type === 'number');

    if (!stringColumn || !numericColumn) {
      // Use first two columns as fallback
      return {
        xField: columns[0]?.name || 'x',
        yField: columns[1]?.name || 'y'
      };
    }

    return {
      xField: stringColumn.name,
      yField: numericColumn.name
    };
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

  const handleDeleteTile = (tileId) => {
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
    handleMenuClose();
  };

  const handleSaveTile = (tileData) => {
    if (editingTile) {
      // Update existing tile
      setTiles(prev => prev.map(t => t.id === tileData.id ? tileData : t));
    } else {
      // Add new tile
      setTiles(prev => [...prev, tileData]);
    }
    
    // Execute the query for the new/updated tile
    executeTileQuery(tileData);
    setModalOpen(false);
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
              <div className="text-center py-8 px-4">
                <div className="text-red-500 dark:text-red-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              </div>
            ) : tile.chartType === 'table' ? (
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
                  height: '280px',
                  maxHeight: '280px',
                  overflow: 'hidden'
                }}
              >
                <Chart 
                  chartData={data?.chartData}
                  loading={loading}
                  error={error}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      </Grid>
    );
  };

  const selectedTile = tiles.find(t => t.id === selectedTileId);

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-900/95 border-gray-800/60' : 'bg-white/95 border-gray-200/60'} border-b px-4 py-2 backdrop-blur-sm`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                </svg>
              </div>
              <div>
                <Typography 
                  variant="h5" 
                  className="font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300"
                >
                  Dashboard
                </Typography>
                <Typography 
                  className="mt-0.5 text-sm"
                  sx={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                >
                  Create and manage your SQL query tiles
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <Typography 
              variant="h6" 
              className="font-medium text-sm"
              sx={{ color: isDark ? '#d1d5db' : '#374151' }}
            >
              Your Tiles
            </Typography>
            <Button 
              onClick={handleCreateTile}
              size="sm"
              className="shadow-md hover:shadow-lg"
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              New Tile
            </Button>
          </div>

          {tiles.length === 0 ? (

            <div className="flex flex-col items-center justify-center min-h-96">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-16 h-16 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="w-16 h-16 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div className="w-16 h-16 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                </div>
                <Typography 
                  variant="h5" 
                  className="font-semibold mb-2"
                  sx={{ color: isDark ? '#fff' : 'inherit' }}
                >
                  Add Tiles to get started
                </Typography>
                <Typography 
                  variant="body2" 
                  className="mb-6"
                  sx={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                >
                  Create SQL queries and visualize your data with tables and charts
                </Typography>
                <Button 
                  onClick={handleCreateTile}
                  size="lg"
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  New Tile
                </Button>
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
            backgroundColor: isDark ? '#374151' : '#fff',
            color: isDark ? '#fff' : 'inherit'
          }
        }}
      >
        <MenuItem onClick={() => handleRefreshTile(selectedTile)}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </div>
        </MenuItem>
        <MenuItem onClick={() => handleEditTile(selectedTile)}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </div>
        </MenuItem>
        <MenuItem onClick={() => handleDeleteTile(selectedTileId)}>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { IconButton, Typography, Menu, MenuItem, CircularProgress } from '@mui/material';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Button } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';
import { useDashboardExport } from '../../hooks';
import SqlTileModal from './SqlTileModal';
import ShareModal from './ShareModal';
import { QueryResults } from '../QueryExplorer';
import { Chart } from '../Charts';
import { RestService, QueryManagementService } from '../../services';
import DashboardService from '../../services/DashboardService';
import { transformQueryResults } from '../../utils/dataTransformers';

// Grid configuration constants
const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 80;
const GRID_MARGIN = [12, 12];
const TILE_DEFAULT_W = 6;  // 2 tiles per row (12/6 = 2)
const TILE_DEFAULT_H = 2;  // 2 * 80 = 160px default height
const TILE_MIN_W = 4;      // Max 3 tiles per row (12/4 = 3)
const TILE_MIN_H = 2;      // 2 * 80 = 160px minimum height

const Dashboard = ({ isPublic = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  // Dashboard state
  const [dashboard, setDashboard] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);
  
  // Tile data state
  const [loadingTiles, setLoadingTiles] = useState({});
  const [tileData, setTileData] = useState({});
  const [tileErrors, setTileErrors] = useState({});

  // Cache / refresh state
  const [tileCache, setTileCache] = useState({});           // { [tileId]: { is_fresh, cached_at, ... } }
  const [refreshJob, setRefreshJob] = useState(null);        // active refresh job
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshPollRef = useRef(null);
  
  // UI state
  const [modalOpen, setModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [recentQueries, setRecentQueries] = useState([]);
  
  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef(null);
  
  // Download dropdown state
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
  
  // Export hook
  const { isExportingDashboard, exportingTileId, exportTileAsPNG, exportDashboardAsPDF } = useDashboardExport(isDark);
  
  // Grid container width - simple ref-based measurement
  const gridContainerRef = useRef(null);
  const gridContentRef = useRef(null);
  // Start with a reasonable default width to prevent spinner
  const [gridWidth, setGridWidth] = useState(1200);
  
  // Refs for preventing duplicates
  const isCreatingRef = useRef(false);
  const executingTilesRef = useRef(new Set());

  // Measure container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (gridContainerRef.current) {
        // Use getBoundingClientRect for more accurate measurement
        const rect = gridContainerRef.current.getBoundingClientRect();
        const containerWidth = rect.width;
        if (containerWidth > 0) {
          // Account for p-4 padding (16px on each side = 32px total)
          const newWidth = containerWidth - 32;
          setGridWidth(prevWidth => {
            // Only update if significantly different to prevent unnecessary re-renders
            if (Math.abs(prevWidth - newWidth) > 5) {
              return newWidth;
            }
            return prevWidth;
          });
        }
      }
    };
    
    // Initial measurement - multiple attempts to ensure it works
    updateWidth();
    const initialTimeout = setTimeout(updateWidth, 100);
    const fallbackTimeout = setTimeout(updateWidth, 300);
    
    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to batch updates
      window.requestAnimationFrame(() => {
        updateWidth();
      });
    });
    
    if (gridContainerRef.current) {
      resizeObserver.observe(gridContainerRef.current);
    }
    
    window.addEventListener('resize', updateWidth);
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(fallbackTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Generate layout for react-grid-layout
  const generateLayout = useCallback(() => {
    return tiles.map((tile, index) => {
      // Default position: 2 tiles per row
      const defaultX = (index % 2) * TILE_DEFAULT_W;
      const defaultY = Math.floor(index / 2) * TILE_DEFAULT_H;
      
      // Read from position object (API format)
      const position = tile.position || {};
      
      return {
        i: String(tile.id),
        x: position.x ?? defaultX,
        y: position.y ?? defaultY,
        w: position.width ?? TILE_DEFAULT_W,
        h: position.height ?? TILE_DEFAULT_H,
        minW: TILE_MIN_W,
        minH: TILE_MIN_H,
      };
    });
  }, [tiles]);

  const saveTilePosition = useCallback(async (tileId, newPosition) => {
    if (isPublic) return;
    await DashboardService.updateTilePosition(id, tileId, newPosition);
  }, [id, isPublic]);

  // Update local tile position and save to API
  const updateTilePosition = useCallback((tileId, newPosition) => {
    // Update local state
    setTiles(prevTiles => prevTiles.map(tile => 
      String(tile.id) === String(tileId) 
        ? { ...tile, position: newPosition }
        : tile
    ));
    // Save to API
    saveTilePosition(tileId, newPosition);
  }, [saveTilePosition]);

  const handleDragStop = useCallback((layout, oldItem, newItem) => {
    // Only save if position actually changed (not just a click)
    const positionChanged = oldItem.x !== newItem.x || oldItem.y !== newItem.y;
    const sizeChanged = oldItem.w !== newItem.w || oldItem.h !== newItem.h;
    
    if (positionChanged || sizeChanged) {
      updateTilePosition(newItem.i, {
        x: newItem.x,
        y: newItem.y,
        width: newItem.w,
        height: newItem.h,
      });
    }
  }, [updateTilePosition]);

  const handleResizeStop = useCallback((layout, oldItem, newItem) => {
    // Only save if size actually changed
    const sizeChanged = oldItem.w !== newItem.w || oldItem.h !== newItem.h;
    const positionChanged = oldItem.x !== newItem.x || oldItem.y !== newItem.y;
    
    if (sizeChanged || positionChanged) {
      updateTilePosition(newItem.i, {
        x: newItem.x,
        y: newItem.y,
        width: newItem.w,
        height: newItem.h,
      });
    }
  }, [updateTilePosition]);

  // Load dashboard on mount
  useEffect(() => {
    if (id && id !== 'new') {
      loadDashboard();
    } else if (id === 'new') {
      if (!isCreatingRef.current) {
        isCreatingRef.current = true;
        createNewDashboard();
      }
    }
  }, [id, isPublic]);

  // Load recent queries
  useEffect(() => {
    if (!isPublic && recentQueries.length === 0) {
      QueryManagementService.getQueryHistory({ limit: 20 }).then(response => {
        if (response.success) {
          setRecentQueries(response.queries || []);
        }
      });
    }
  }, [isPublic, recentQueries.length]);

  // Focus title input
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const createNewDashboard = async () => {
    setLoadingDashboard(true);
    
    // Dashboard creation has no limits in open-source edition
    
    const response = await DashboardService.createDashboard({
      title: 'Untitled Dashboard',
      description: '',
      is_public: false,
      is_anonymous_public: false,
      configuration: {}
    });

    if (response.success && response.dashboard?.id) {
      isCreatingRef.current = false;
      navigate(`/dashboard/${response.dashboard.id}`, { replace: true });
    } else {
      alert(response.error || 'Failed to create dashboard');
      setLoadingDashboard(false);
      isCreatingRef.current = false;
    }
  };

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      let response;
      if (isPublic) {
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

      // -----------------------------------------------------------------------
      // CACHE-FIRST STRATEGY
      // Dashboard view NEVER makes live Trino calls.
      // Fresh cache  → render immediately from cache.
      // Stale cache  → render stale data with a "stale" badge, auto-enqueue refresh.
      // No cache yet → render "pending" state, auto-enqueue refresh.
      // Live Trino calls only happen via the refresh service in the background.
      // -----------------------------------------------------------------------
      const cacheStatus = await RestService.getDashboardCacheStatus(id).catch(() => null);
      const cacheMap = {};
      if (cacheStatus?.tiles) {
        cacheStatus.tiles.forEach(t => { cacheMap[t.tile_id] = t; });
      }
      setTileCache(cacheMap);
      if (cacheStatus?.latest_job) setRefreshJob(cacheStatus.latest_job);

      let needsBackgroundRefresh = false;
      const uncachedTiles = [];

      for (const tile of tilesArray) {
        const cached = cacheMap[tile.id];
        if (cached?.refresh_status === 'success') {
          // Render from cache — even stale data is better than blocking on Trino
          await loadTileFromCache(tile);
          if (!cached.is_fresh) needsBackgroundRefresh = true;
        } else {
          // Never-cached tile: run live Trino query so user sees data immediately
          uncachedTiles.push(tile);
        }
      }

      // Execute uncached tiles live (first-time load), then write-through to cache
      if (uncachedTiles.length > 0) {
        await Promise.all(uncachedTiles.map(tile => executeTileLiveAndCache(tile)));
      }

      // Auto-enqueue a background refresh for any stale tiles (uncached ones
      // were already executed live above, so only stale cache needs refresh).
      if (needsBackgroundRefresh && !isPublic) {
        const activeJob = cacheStatus?.latest_job;
        const alreadyRunning = activeJob && ['pending', 'running'].includes(activeJob.status);
        if (!alreadyRunning) {
          RestService.refreshDashboard(id).then(res => {
            if (res?.job_id) {
              setRefreshJob(res);
              pollRefreshJob(res.job_id);
            }
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboardError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  };

  /**
   * Render a tile from its cache entry. Never falls back to live Trino.
   * If the cache payload can't be parsed, the tile stays in "pending" state
   * and the background refresh will populate it.
   */
  const loadTileFromCache = async (tile) => {
    setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
    try {
      const cacheRes = await RestService.getTileCache(tile.id);
      if (!cacheRes?.cache_hit || !cacheRes.data) return; // stays pending

      const queryData = transformQueryResults(cacheRes.data);
      if (!queryData) return; // stays pending

      let chartConfig = tile.chart_config || {};
      if (tile.chart_type !== 'table' && (!chartConfig.xField || !chartConfig.yField)) {
        if (queryData.columns?.length >= 2) {
          chartConfig = {
            ...chartConfig,
            xField: queryData.columns[0]?.name || 'x',
            yField: queryData.columns[1]?.name || 'y',
            x_column: queryData.columns[0]?.name || 'x',
            y_column: queryData.columns[1]?.name || 'y',
          };
        }
      }
      const chartData = tile.chart_type !== 'table' ? {
        chart: {
          type: tile.chart_type,
          config: {
            ...chartConfig,
            xField: chartConfig.xField || chartConfig.x_column,
            yField: chartConfig.yField || chartConfig.y_column,
          },
          fallback: false,
          source: 'cache'
        },
        data: queryData,
        cached: true
      } : null;

      setTileData(prev => ({ ...prev, [tile.id]: { queryResults: queryData, chartData } }));
      setTileCache(prev => ({
        ...prev,
        [tile.id]: {
          ...prev[tile.id],
          is_fresh: cacheRes.is_fresh,
          cached_at: cacheRes.cached_at,
        },
      }));
    } catch {
      // stays pending — background refresh will populate
    } finally {
      setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
    }
  };

  const executeTileQuery = async (tile) => {
    if (executingTilesRef.current.has(tile.id)) return;
    executingTilesRef.current.add(tile.id);
    
    setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
    setTileErrors(prev => ({ ...prev, [tile.id]: null }));

    try {
      const response = await RestService.executeSql(tile.sql_query, 500, parseInt(process.env.REACT_APP_EXECUTE_TIMEOUT_SECONDS) || 900);
      
      if (!response.success) {
        throw new Error(response.error || 'Query execution failed');
      }

      const queryData = transformQueryResults(response.query_results);
      
      if (!queryData) {
        throw new Error('No data returned from query');
      }

      let chartConfig = tile.chart_config || {};
      
      if (tile.chart_type !== 'table' && (!chartConfig.xField || !chartConfig.yField)) {
        const detectColumnType = (colName) => {
          if (!queryData.data || queryData.data.length === 0) return 'string';
          const sampleValue = queryData.data[0][colName];
          if (typeof sampleValue === 'number') return 'number';
          if (!isNaN(parseFloat(sampleValue)) && isFinite(sampleValue)) return 'number';
          return 'string';
        };
        
        const stringColumn = queryData.columns.find(col => {
          const colType = col.type || detectColumnType(col.name);
          return colType === 'string' || colType === 'varchar' || colType === 'date';
        });
        
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
          chartConfig = {
            ...chartConfig,
            xField: queryData.columns[0]?.name || 'x',
            yField: queryData.columns[1]?.name || 'y',
            x_column: queryData.columns[0]?.name || 'x',
            y_column: queryData.columns[1]?.name || 'y'
          };
        }
      }

      let chartData = null;
      if (tile.chart_type !== 'table') {
        chartData = {
          chart: {
            type: tile.chart_type,
            config: {
              ...chartConfig,
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

      setTileData(prev => ({
        ...prev,
        [tile.id]: { queryResults: queryData, chartData }
      }));
    } catch (error) {
      console.error('Error executing tile query:', error);
      setTileErrors(prev => ({ ...prev, [tile.id]: error.message }));
    } finally {
      executingTilesRef.current.delete(tile.id);
      setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
    }
  };

  /**
   * Execute a tile query live via Trino, render the result immediately,
   * then write-through to cache so subsequent loads are instant.
   * Used for first-time / uncached tiles and after tile creation or edit.
   */
  const executeTileLiveAndCache = async (tile) => {
    if (executingTilesRef.current.has(tile.id)) return;
    executingTilesRef.current.add(tile.id);

    setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
    setTileErrors(prev => ({ ...prev, [tile.id]: null }));

    try {
      const response = await RestService.executeSql(
        tile.sql_query, 500,
        parseInt(process.env.REACT_APP_EXECUTE_TIMEOUT_SECONDS) || 900
      );

      if (!response.success) {
        throw new Error(response.error || 'Query execution failed');
      }

      const queryData = transformQueryResults(response.query_results);
      if (!queryData) throw new Error('No data returned from query');

      let chartConfig = tile.chart_config || {};
      if (tile.chart_type !== 'table' && (!chartConfig.xField || !chartConfig.yField)) {
        const detectColumnType = (colName) => {
          if (!queryData.data || queryData.data.length === 0) return 'string';
          const sampleValue = queryData.data[0][colName];
          if (typeof sampleValue === 'number') return 'number';
          if (!isNaN(parseFloat(sampleValue)) && isFinite(sampleValue)) return 'number';
          return 'string';
        };
        const stringColumn = queryData.columns.find(col => {
          const colType = col.type || detectColumnType(col.name);
          return colType === 'string' || colType === 'varchar' || colType === 'date';
        });
        const numericColumn = queryData.columns.find(col => {
          const colType = col.type || detectColumnType(col.name);
          return colType === 'number' || colType === 'integer' || colType === 'bigint' ||
                 colType === 'decimal' || colType === 'double';
        });
        if (stringColumn && numericColumn) {
          chartConfig = { ...chartConfig, xField: stringColumn.name, yField: numericColumn.name, x_column: stringColumn.name, y_column: numericColumn.name };
        } else if (queryData.columns.length >= 2) {
          chartConfig = { ...chartConfig, xField: queryData.columns[0]?.name || 'x', yField: queryData.columns[1]?.name || 'y', x_column: queryData.columns[0]?.name || 'x', y_column: queryData.columns[1]?.name || 'y' };
        }
      }

      let chartData = null;
      if (tile.chart_type !== 'table') {
        chartData = {
          chart: { type: tile.chart_type, config: { ...chartConfig, xField: chartConfig.xField || chartConfig.x_column, yField: chartConfig.yField || chartConfig.y_column }, fallback: false, source: 'live' },
          data: queryData, cached: false
        };
      }

      setTileData(prev => ({ ...prev, [tile.id]: { queryResults: queryData, chartData } }));
      setTileCache(prev => ({ ...prev, [tile.id]: { is_fresh: true, cached_at: new Date().toISOString() } }));

      // Write-through to cache (fire-and-forget, non-fatal)
      const dashboardId = tile.dashboard_id || id;
      RestService.writeTileCache(tile.id, {
        dashboard_id: dashboardId,
        sql_query: tile.sql_query,
        query_results: response.query_results,
        execution_time: response.execution_time || 0,
        refresh_interval_seconds: tile.refresh_interval_seconds || 7200,
      }).catch(() => {});
    } catch (error) {
      console.error('Live tile execution failed:', error);
      setTileErrors(prev => ({ ...prev, [tile.id]: error.message }));
    } finally {
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
    if (!window.confirm('Are you sure you want to delete this tile?')) return;

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
      // Preserve existing position when editing
      const existingPosition = editingTile.position || {
        x: 0, y: 0, width: TILE_DEFAULT_W, height: TILE_DEFAULT_H
      };
      
      const updatePayload = {
        title: tileFormData.title,
        description: tileFormData.description || null,
        sql_query: tileFormData.sqlQuery,
        nl_query: tileFormData.nlQuery || null,
        chart_type: tileFormData.chartType,
        chart_config: tileFormData.chartConfig || {},
        position: existingPosition,
        refresh_interval_seconds: tileFormData.refresh_interval_seconds || null
      };
      
      response = await DashboardService.updateTile(id, editingTile.id, updatePayload);

      if (response.success) {
        const updatedTile = {
          ...editingTile,
          ...response.tile,
          sql_query: updatePayload.sql_query,
          chart_type: updatePayload.chart_type,
          chart_config: updatePayload.chart_config
        };
        
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

        setTiles(prev => prev.map(t => t.id === updatedTile.id ? updatedTile : t));
        // SQL may have changed — invalidate stale cache, execute live, then write-through
        RestService.invalidateTileCache(updatedTile.id).catch(() => {});
        setTileCache(prev => { const n = { ...prev }; delete n[updatedTile.id]; return n; });
        setTileData(prev => { const n = { ...prev }; delete n[updatedTile.id]; return n; });
        executeTileLiveAndCache(updatedTile);
      }
    } else {
      // Calculate next position (2 tiles per row)
      const numTiles = tiles.length;
      const nextPosition = {
        x: (numTiles % 2) * TILE_DEFAULT_W,
        y: Math.floor(numTiles / 2) * TILE_DEFAULT_H,
        width: TILE_DEFAULT_W,
        height: TILE_DEFAULT_H,
      };
      
      response = await DashboardService.createTile(id, {
        title: tileFormData.title,
        description: tileFormData.description || null,
        sql_query: tileFormData.sqlQuery,
        nl_query: tileFormData.nlQuery || null,
        chart_type: tileFormData.chartType,
        chart_config: tileFormData.chartConfig || {},
        position: nextPosition,
        refresh_interval_seconds: tileFormData.refresh_interval_seconds || null
      });

      if (response.success) {
        const newTile = {
          ...response.tile,
          sql_query: tileFormData.sqlQuery,
          chart_type: tileFormData.chartType,
          chart_config: tileFormData.chartConfig || {},
          position: response.tile.position || nextPosition,
        };
        setTiles(prev => [...prev, newTile]);
        // Execute the new tile live so user sees data immediately, then cache it
        executeTileLiveAndCache(newTile);
      }
    }
    
    if (!response.success) {
      alert(`Failed to save tile: ${response.error}`);
      return;
    }
    
    setEditingTile(null);
    setModalOpen(false);
  };

  const handleTitleClick = () => {
    if (isPublic) return;
    setEditedTitle(dashboard?.title || 'Untitled Dashboard');
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle.trim() !== dashboard?.title) {
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
    if (e.key === 'Enter') handleTitleSave();
    else if (e.key === 'Escape') setIsEditingTitle(false);
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

  const handleRefreshTile = async (tile) => {
    handleMenuClose();
    if (!tile) return;
    // Manual single-tile refresh: enqueue a tile job and poll until done
    try {
      setLoadingTiles(prev => ({ ...prev, [tile.id]: true }));
      setTileErrors(prev => ({ ...prev, [tile.id]: null }));
      const res = await RestService.refreshTile(tile.id, tile.dashboard_id || id);
      if (res?.job_id) {
        let tilePollCount = 0;
        const poll = setInterval(async () => {
          tilePollCount++;
          if (tilePollCount > 150) { // 150 × 2s = 5 minutes max
            clearInterval(poll);
            setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
            setTileErrors(prev => ({ ...prev, [tile.id]: 'Refresh timed out — click Refresh to retry' }));
            return;
          }
          try {
            const job = await RestService.getRefreshJobStatus(res.job_id);
            if (['completed', 'failed', 'partial'].includes(job.status)) {
              clearInterval(poll);
              setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
              if (job.status === 'failed') {
                setTileErrors(prev => ({ ...prev, [tile.id]: 'Refresh failed — click Refresh to retry' }));
              } else {
                loadTileFromCache(tile);
              }
            }
          } catch { clearInterval(poll); setLoadingTiles(prev => ({ ...prev, [tile.id]: false })); }
        }, 2000);
      } else {
        setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
      }
    } catch (err) {
      console.error('Single tile refresh failed:', err);
      setLoadingTiles(prev => ({ ...prev, [tile.id]: false }));
      setTileErrors(prev => ({ ...prev, [tile.id]: err.message || 'Refresh failed' }));
    }
  };

  const handleRefreshDashboard = async () => {
    if (isRefreshing || !id) return;
    setIsRefreshing(true);
    try {
      const res = await RestService.refreshDashboard(id);
      if (res?.job_id) {
        setRefreshJob(res);
        pollRefreshJob(res.job_id);
      }
    } catch (err) {
      console.error('Refresh dashboard failed:', err);
      setIsRefreshing(false);
    }
  };

  const pollRefreshJob = (jobId) => {
    if (refreshPollRef.current) clearInterval(refreshPollRef.current);
    let pollCount = 0;
    const MAX_POLLS = 120; // 120 × 2.5s = 5 minutes max
    refreshPollRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        clearInterval(refreshPollRef.current);
        refreshPollRef.current = null;
        setIsRefreshing(false);
        setRefreshJob(prev => prev ? { ...prev, status: 'failed' } : prev);
        return;
      }
      try {
        const job = await RestService.getRefreshJobStatus(jobId);
        setRefreshJob(job);
        if (['completed', 'failed', 'partial'].includes(job.status)) {
          clearInterval(refreshPollRef.current);
          refreshPollRef.current = null;
          setIsRefreshing(false);
          // Reload tile data from fresh cache (even on partial — some tiles succeeded)
          if (job.status !== 'failed') {
            const cacheStatus = await RestService.getDashboardCacheStatus(id).catch(() => null);
            if (cacheStatus?.tiles) {
              const map = {};
              cacheStatus.tiles.forEach(t => { map[t.tile_id] = t; });
              setTileCache(map);
              tiles.forEach(tile => {
                if (map[tile.id]?.is_fresh) loadTileFromCache(tile);
              });
            }
          }
        }
      } catch {
        clearInterval(refreshPollRef.current);
        refreshPollRef.current = null;
        setIsRefreshing(false);
      }
    }, 2500);
  };

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (refreshPollRef.current) clearInterval(refreshPollRef.current);
    };
  }, []);

  const handleMenuOpen = (event, tileId) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTileId(tileId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTileId(null);
  };

  const selectedTile = tiles.find(t => t.id === selectedTileId);

  // Render tile content
  const renderTileContent = (tile) => {
    const loading = loadingTiles[tile.id];
    const error = tileErrors[tile.id];
    const data = tileData[tile.id];
    const cache = tileCache[tile.id];
    const refreshing = isRefreshing || (refreshJob && ['pending','running'].includes(refreshJob.status));

    // Loading cache from API
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <CircularProgress size={24} />
        </div>
      );
    }

    // No cache data yet — tile is pending first population
    if (!data && !error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 gap-2">
          {refreshing ? (
            <>
              <CircularProgress size={20} sx={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
              <Typography variant="body2" className="text-xs text-center" sx={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                Refreshing data…
              </Typography>
            </>
          ) : (
            <>
              <svg className={`w-8 h-8 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <Typography variant="body2" className="text-xs text-center" sx={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                No data yet
              </Typography>
              <Typography variant="body2" className="text-[10px] text-center" sx={{ color: isDark ? '#4b5563' : '#d1d5db' }}>
                Click "Refresh All" to load
              </Typography>
            </>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <svg className="w-8 h-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <Typography variant="body2" color="error" className="text-xs text-center">
            {error}
          </Typography>
        </div>
      );
    }

    if (tile.chart_type === 'table') {
      return (
        <div className="w-full h-full overflow-auto">
          <QueryResults 
            queryData={data?.queryResults}
            loading={loading}
            error={error}
          />
        </div>
      );
    }

    return (
      <div className="w-full h-full">
        <Chart 
          chartData={data?.chartData}
          loading={loading}
          error={error}
          embedded={true}
        />
      </div>
    );
  };

  // Download menu handlers
  const handleDownloadMenuOpen = (event) => {
    setDownloadMenuAnchor(event.currentTarget);
  };

  const handleDownloadMenuClose = () => {
    setDownloadMenuAnchor(null);
  };

  // Export handlers using the hook
  const handleExportPDF = () => {
    handleDownloadMenuClose();
    exportDashboardAsPDF(dashboard?.title, gridContentRef);
  };

  const handleExportTilePNG = (tile) => {
    handleMenuClose();
    exportTileAsPNG(tile.id, tile.title, gridContentRef);
  };

  // Loading state
  if (loadingDashboard) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
        <div className="text-center">
          <CircularProgress size={40} />
          <Typography variant="body1" className="mt-4" sx={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            Loading dashboard...
          </Typography>
        </div>
      </div>
    );
  }

  // Error state
  if (dashboardError) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <Typography variant="h6" className="mb-2" sx={{ color: isDark ? '#fff' : 'inherit' }}>
            Failed to load dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {dashboardError}
          </Typography>
          <Button onClick={() => navigate('/dashboards')} className="mt-4">
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  const layout = generateLayout();

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-[#101012] border-gray-800/60' : 'bg-white/95 border-gray-200/60'} border-b px-4 py-2 backdrop-blur-sm`}>
        <div className="flex items-center space-x-3 w-full">
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
          
          <div className="flex-1 flex items-center">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className={`text-lg font-bold w-64 px-1 py-0.5 bg-transparent border-0 border-b-2 border-blue-500 outline-none transition-all ${isDark ? 'text-white' : 'text-gray-900'}`}
                placeholder="Enter dashboard name..."
              />
            ) : (
              <button
                onClick={handleTitleClick}
                disabled={isPublic}
                className={`text-lg font-bold px-1 py-0.5 transition-all text-left border-b-2 border-transparent ${isPublic ? 'cursor-default' : isDark ? 'text-white hover:border-gray-600' : 'text-gray-900 hover:border-gray-300'}`}
                title={isPublic ? undefined : "Click to edit title"}
              >
                {dashboard?.title || 'Untitled Dashboard'}
              </button>
            )}
          </div>
          
          {!isPublic && dashboard && (
            <div className="flex items-center gap-3">
              {(dashboard.is_public || dashboard.is_anonymous_public) && (
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  dashboard.is_anonymous_public
                    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                    : isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                }`}>
                  {dashboard.is_anonymous_public ? 'public' : 'shared'}
                </span>
              )}
              
              <button
                onClick={handleDownloadMenuOpen}
                disabled={isExportingDashboard}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'} ${isExportingDashboard ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Download Dashboard"
              >
                {isExportingDashboard ? (
                  <CircularProgress size={20} sx={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={() => setShareModalOpen(true)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
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

      {/* Content */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto p-4">
        {/* Action Bar */}
        {!isPublic && (
          <div className="flex items-center justify-between gap-2 mb-4">
            {/* Refresh status */}
            <div className="flex items-center gap-2">
              {refreshJob && ['pending', 'running'].includes(refreshJob.status) && (
                <span className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  <CircularProgress size={12} sx={{ color: 'inherit' }} />
                  Refreshing tiles… {refreshJob.total_items > 0 ? `${refreshJob.completed_items}/${refreshJob.total_items}` : ''}
                </span>
              )}
              {refreshJob?.status === 'completed' && (
                <span className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  ✓ Cache refreshed
                </span>
              )}
              {refreshJob?.status === 'failed' && (
                <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  Refresh failed
                </span>
              )}
              {refreshJob?.status === 'partial' && (
                <span className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  ⚠ Partial refresh ({refreshJob.failed_items} failed)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshDashboard}
                disabled={isRefreshing}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                }`}
                title="Refresh all tile data and update cache"
              >
                <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRefreshing ? 'Refreshing…' : 'Refresh All'}
              </button>
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
          </div>
        )}

        {/* Empty State */}
        {tiles.length === 0 ? (
          <div ref={gridContentRef} className="flex flex-col items-center justify-center min-h-96">
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
                <button 
                  onClick={handleCreateTile}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors mx-auto"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Tile
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Grid Layout */
          <div ref={gridContentRef}>
          <GridLayout
            className="layout"
            layout={layout}
            width={gridWidth}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            margin={GRID_MARGIN}
            containerPadding={[0, 0]}
            compactType={null}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            isDraggable={!isPublic}
            isResizable={!isPublic}
            draggableHandle=".tile-drag-handle"
            resizeHandles={['se', 'e', 's']}
            useCSSTransforms={true}
          >
            {tiles.map(tile => (
              <div key={String(tile.id)}>
                {/* 
                  Grid children receive style prop with width/height/transform.
                  Don't use h-full on this div - let grid control sizing.
                  Inner content uses 100% to fill the grid-controlled container.
                */}
                <div 
                  data-tile-id={tile.id}
                  className={`w-full h-full flex flex-col overflow-hidden rounded-lg border ${isDark ? 'bg-[#1c1d1f] border-gray-700' : 'bg-white border-gray-200'}`}
                >
                  {/* Tile Header - Drag Handle */}
                  <div className={`tile-drag-handle flex items-center justify-between px-3 py-2 border-b cursor-move flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {tile.title}
                      </span>
                      {tileCache[tile.id]?.refresh_status === 'success' && !tileCache[tile.id].is_fresh && (
                        <span
                          title="Cache has expired — data was re-fetched live. Click Refresh All to update cache."
                          className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-yellow-900/40 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}
                        >
                          stale
                        </span>
                      )}
                    </div>
                    {!isPublic && (
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleMenuOpen(e, tile.id)}
                        sx={{ color: isDark ? '#9ca3af' : 'inherit', padding: '4px' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </IconButton>
                    )}
                  </div>
                  
                  {/* Tile Content - flex-1 fills remaining space */}
                  <div className="flex-1 overflow-hidden p-2 min-h-0">
                    {renderTileContent(tile)}
                  </div>
                </div>
              </div>
            ))}
          </GridLayout>
          </div>
        )}
      </div>

      {/* Download Menu - PDF only */}
      <Menu
        anchorEl={downloadMenuAnchor}
        open={Boolean(downloadMenuAnchor)}
        onClose={handleDownloadMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: isDark ? '#fff' : 'inherit',
            minWidth: 180,
            borderRadius: '12px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDark 
              ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)' 
              : '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            '& .MuiList-root': { padding: '6px' },
            '& .MuiMenuItem-root': { 
              fontSize: '14px', 
              padding: '10px 14px',
              borderRadius: '8px',
              margin: '2px 0',
              transition: 'all 0.15s ease',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
              }
            }
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleExportPDF}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <svg className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>PDF Document</span>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Export as PDF</span>
            </div>
          </div>
        </MenuItem>
      </Menu>

      {/* Modals */}
      <SqlTileModal 
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          if (id === 'new' && !dashboard) {
            isCreatingRef.current = false;
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

      {/* Tile Context Menu */}
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
            '& .MuiMenuItem-root': { fontSize: '13px', padding: '6px 12px', minHeight: 'auto' }
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
        <MenuItem onClick={() => handleExportTilePNG(selectedTile)} disabled={exportingTileId !== null}>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Download PNG
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


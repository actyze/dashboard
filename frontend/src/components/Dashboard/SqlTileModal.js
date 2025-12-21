import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SqlEditor } from '../Common';
import { RestService } from '../../services';
import { transformQueryResults } from '../../utils/dataTransformers';
import { ChartTypeSelector } from '../Charts';
import { extractColumnsFromSQL, isValidSQLQuery } from '../../utils/sqlParser';

const SqlTileModal = ({ open, onClose, onSave, initialData = null }) => {
  const { isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [xAxisColumn, setXAxisColumn] = useState('');
  const [yAxisColumn, setYAxisColumn] = useState('');
  const [error, setError] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Query preview state
  const [queryColumns, setQueryColumns] = useState([]);
  const [queryPreviewLoading, setQueryPreviewLoading] = useState(false);
  const [queryPreviewError, setQueryPreviewError] = useState(null);
  const [hasPreviewedQuery, setHasPreviewedQuery] = useState(false);
  
  // Editing mode - when editing, always show config (no empty state)
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      const sqlText = initialData.sql_query || '';
      setSqlQuery(sqlText);
      setChartType(initialData.chart_type || 'bar');
      // Load axis config from chart_config
      const config = initialData.chart_config || {};
      const xCol = config.xField || config.x_column || '';
      const yCol = config.yField || config.y_column || '';
      setXAxisColumn(xCol);
      setYAxisColumn(yCol);
      setQueryPreviewError(null);
      
      // Parse columns from SQL query directly (no execution needed!)
      if (sqlText && isValidSQLQuery(sqlText)) {
        const parsedColumns = extractColumnsFromSQL(sqlText);
        setQueryColumns(parsedColumns.map(col => ({ name: col.name, type: null })));
        setHasPreviewedQuery(true);
      } else {
        // Fallback to saved config if SQL parsing fails
        const savedColumns = [];
        if (xCol) savedColumns.push({ name: xCol, type: null });
        if (yCol && yCol !== xCol) savedColumns.push({ name: yCol, type: null });
        setQueryColumns(savedColumns);
        setHasPreviewedQuery(true);
      }
    } else {
      setTitle('');
      setDescription('');
      setSqlQuery('');
      setChartType('bar');
      setXAxisColumn('');
      setYAxisColumn('');
      setQueryColumns([]);
      setQueryPreviewError(null);
      setHasPreviewedQuery(false);
    }
    setError(null);
    setShowSidebar(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, open]);

  // Auto-parse columns from SQL whenever the query changes
  useEffect(() => {
    if (!sqlQuery || chartType === 'table' || chartType === 'indicator' || chartType === 'metric') {
      return; // Skip for table/indicator charts
    }

    if (isValidSQLQuery(sqlQuery)) {
      const parsedColumns = extractColumnsFromSQL(sqlQuery);
      if (parsedColumns.length > 0) {
        setQueryColumns(parsedColumns.map(col => ({ name: col.name, type: null })));
        setHasPreviewedQuery(true);
        setQueryPreviewError(null);
        
        // Auto-select columns if not already set
        if (!xAxisColumn && parsedColumns.length >= 1) {
          setXAxisColumn(parsedColumns[0].name);
        }
        if (!yAxisColumn && parsedColumns.length >= 2) {
          setYAxisColumn(parsedColumns[1].name);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlQuery, chartType]);

  // Helper to run preview when editing
  const runPreviewForEdit = async (sql, existingConfig) => {
    if (!sql) return;
    
    setQueryPreviewLoading(true);
    try {
      const response = await RestService.executeSql(sql, 10, 30);
      
      if (response.success) {
        const queryData = transformQueryResults(response.query_results);
        if (queryData?.columns) {
          setQueryColumns(queryData.columns);
          setHasPreviewedQuery(true);
          // Keep existing selections
          if (existingConfig?.xField) setXAxisColumn(existingConfig.xField);
          if (existingConfig?.yField) setYAxisColumn(existingConfig.yField);
        }
      }
    } catch (err) {
      console.error('Auto-preview failed:', err);
      // Don't show error for auto-preview, just mark as previewed so user can still save
      setHasPreviewedQuery(true);
    } finally {
      setQueryPreviewLoading(false);
    }
  };

  // Run query to get columns for axis selection
  const handlePreviewQuery = async () => {
    if (!sqlQuery.trim()) {
      setQueryPreviewError('Please enter a SQL query first');
      return;
    }

    setQueryPreviewLoading(true);
    setQueryPreviewError(null);

    try {
      // Execute with limit to just get columns
      const response = await RestService.executeSql(sqlQuery, 10, 30);
      
      if (!response.success) {
        throw new Error(response.error || 'Query execution failed');
      }

      const queryData = transformQueryResults(response.query_results);
      
      if (!queryData || !queryData.columns) {
        throw new Error('No columns returned from query');
      }

      setQueryColumns(queryData.columns);
      setHasPreviewedQuery(true);
      
      // Auto-select first string column for x-axis and first numeric for y-axis
      if (!xAxisColumn) {
        const stringCol = queryData.columns.find(col => 
          col.type === 'string' || col.type === 'varchar' || col.type === 'date'
        );
        if (stringCol) setXAxisColumn(stringCol.name);
        else if (queryData.columns[0]) setXAxisColumn(queryData.columns[0].name);
      }
      
      if (!yAxisColumn) {
        const numericCol = queryData.columns.find(col => 
          col.type === 'number' || col.type === 'integer' || col.type === 'bigint' || 
          col.type === 'decimal' || col.type === 'double'
        );
        if (numericCol) setYAxisColumn(numericCol.name);
        else if (queryData.columns[1]) setYAxisColumn(queryData.columns[1].name);
      }

    } catch (err) {
      console.error('Query preview error:', err);
      setQueryPreviewError(err.message);
    } finally {
      setQueryPreviewLoading(false);
    }
  };

  const handleSelectQuery = (query) => {
    setTitle(query.query_name || `Query ${query.id}`);
    setSqlQuery(query.generated_sql || '');
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!sqlQuery.trim()) {
      setError('SQL query is required');
      return;
    }
    // Require x/y axis for chart types (not table, indicator, or metric)
    const needsAxes = chartType !== 'table' && chartType !== 'indicator' && chartType !== 'metric';
    if (needsAxes) {
      if (!hasPreviewedQuery && queryColumns.length === 0) {
        setError('Please run the query first to configure chart axes');
        return;
      }
      if (!xAxisColumn.trim()) {
        setError('X-Axis column is required for charts');
        return;
      }
      if (!yAxisColumn.trim()) {
        setError('Y-Axis column is required for charts');
        return;
      }
    }

    const formData = {
      title: title.trim(),
      description: description.trim() || null,
      sqlQuery: sqlQuery.trim(),
      chartType,
      chartConfig: chartType !== 'table' ? {
        xField: xAxisColumn.trim(),
        yField: yAxisColumn.trim(),
        x_column: xAxisColumn.trim(),
        y_column: yAxisColumn.trim(),
      } : {}
    };

    onSave(formData);
    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full max-w-2xl mx-4 rounded-xl shadow-2xl
        ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'}
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between px-5 py-4 border-b
          ${isDark ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {initialData ? 'Edit Tile' : 'Create New Tile'}
          </h2>
          <button
            onClick={handleClose}
            className={`
              p-1.5 rounded-lg transition-colors
              ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className={`
              mb-4 px-4 py-3 rounded-lg text-sm
              ${isDark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 text-red-600 border border-red-200'}
            `}>
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Title Input */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Tile Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Monthly Sales Report"
                className={`
                  w-full px-3 py-2 rounded-lg text-sm
                  transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }
                  border outline-none
                `}
              />
            </div>

            {/* Description Input */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Description <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this tile"
                className={`
                  w-full px-3 py-2 rounded-lg text-sm
                  transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }
                  border outline-none
                `}
              />
            </div>

            {/* Chart Type Selector */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Visualization Type
              </label>
              <div className="flex items-center gap-3">
                {/* Table Option */}
                <button
                  type="button"
                  onClick={() => setChartType('table')}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${chartType === 'table'
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }
                  `}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Table</span>
                </button>

                {/* Divider */}
                <div className={`w-px h-8 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

                {/* Chart Type Selector */}
                {chartType !== 'table' ? (
                  <ChartTypeSelector
                    selectedType={chartType}
                    onTypeChange={setChartType}
                    dataColumns={queryColumns}
                    compact={true}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${isDark
                        ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="12" width="4" height="9" rx="1" />
                      <rect x="10" y="6" width="4" height="15" rx="1" />
                      <rect x="17" y="9" width="4" height="12" rx="1" />
                    </svg>
                    <span>Switch to Chart</span>
                  </button>
                )}
              </div>
            </div>

            {/* Info banner for Indicator/Metric charts */}
            {(chartType === 'indicator' || chartType === 'metric') && (
              <div className={`
                p-3 rounded-lg border text-xs
                ${isDark ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}
              `}>
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium mb-0.5">Single-Value Metric</p>
                    <p className="opacity-90">
                      Your query should return a single number (e.g., <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">SELECT COUNT(*) FROM table</code>). 
                      The value will be displayed prominently. No axis configuration needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Axis Configuration - Only show for chart types (not table or indicator) */}
            {chartType !== 'table' && chartType !== 'indicator' && chartType !== 'metric' && (
              <div className={`
                p-4 rounded-lg border
                ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}
              `}>
                <div className="flex items-center gap-2 mb-3">
                  <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Chart Configuration
                  </span>
                </div>

                {/* Query Preview Error */}
                {queryPreviewError && (
                  <div className={`
                    mb-3 px-3 py-2 rounded-lg text-xs
                    ${isDark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 text-red-600 border border-red-200'}
                  `}>
                    {queryPreviewError}
                  </div>
                )}

                {/* Info message - columns are auto-detected from SQL */}
                {queryColumns.length === 0 && sqlQuery.trim() && (
                  <div className={`
                    text-center py-3 rounded-lg text-xs
                    ${isDark ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-50 text-gray-400'}
                  `}>
                    <p>Enter a valid SQL query above. Column names will be auto-detected.</p>
                  </div>
                )}

                {/* Column Selection - Show immediately when editing, or after preview for new tiles */}
                {(isEditing || hasPreviewedQuery || queryColumns.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* X-Axis Column */}
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        X-Axis Column <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={xAxisColumn}
                        onChange={(e) => setXAxisColumn(e.target.value)}
                        className={`
                          w-full px-3 py-2 rounded-lg text-sm
                          transition-all duration-200
                          ${isDark 
                            ? 'bg-gray-900 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }
                          border outline-none
                        `}
                      >
                        <option value="">Select column...</option>
                        {/* Show currently selected value even if columns haven't loaded yet */}
                        {xAxisColumn && !queryColumns.find(col => col.name === xAxisColumn) && (
                          <option value={xAxisColumn}>{xAxisColumn}</option>
                        )}
                        {queryColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} {col.type ? `(${col.type})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        Category or label axis
                      </p>
                    </div>

                    {/* Y-Axis Column */}
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Y-Axis Column <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={yAxisColumn}
                        onChange={(e) => setYAxisColumn(e.target.value)}
                        className={`
                          w-full px-3 py-2 rounded-lg text-sm
                          transition-all duration-200
                          ${isDark 
                            ? 'bg-gray-900 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }
                          border outline-none
                        `}
                      >
                        <option value="">Select column...</option>
                        {/* Show currently selected value even if columns haven't loaded yet */}
                        {yAxisColumn && !queryColumns.find(col => col.name === yAxisColumn) && (
                          <option value={yAxisColumn}>{yAxisColumn}</option>
                        )}
                        {queryColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} {col.type ? `(${col.type})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        Numeric value axis
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SQL Query */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                SQL Query
              </label>
              <SqlEditor
                value={sqlQuery}
                onChange={setSqlQuery}
                height="200px"
                placeholder="SELECT column1, column2 FROM table_name WHERE condition"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          flex items-center justify-end gap-3 px-5 py-4 border-t
          ${isDark ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <button
            onClick={handleClose}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isDark 
                ? 'text-gray-300 hover:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {initialData ? 'Update Tile' : 'Create Tile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SqlTileModal;

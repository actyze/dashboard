import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SqlEditor } from '../Common';
import { ChartTypeSelector } from '../Charts';
import { extractColumnsFromSQL, isValidSQLQuery } from '../../utils/sqlParser';

const SqlTileModal = ({ open, onClose, onSave, initialData = null, recentQueries = [] }) => {
  const { isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [xAxisColumn, setXAxisColumn] = useState('');
  const [yAxisColumn, setYAxisColumn] = useState('');
  const [error, setError] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [queryColumns, setQueryColumns] = useState([]);
  
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      const sqlText = initialData.sql_query || '';
      setSqlQuery(sqlText);
      setChartType(initialData.chart_type || 'bar');
      const config = initialData.chart_config || {};
      setXAxisColumn(config.xField || config.x_column || '');
      setYAxisColumn(config.yField || config.y_column || '');
      
      if (sqlText && isValidSQLQuery(sqlText)) {
        const parsedColumns = extractColumnsFromSQL(sqlText);
        setQueryColumns(parsedColumns.map(col => ({ name: col.name, type: null })));
      }
    } else {
      setTitle('');
      setDescription('');
      setSqlQuery('');
      setChartType('bar');
      setXAxisColumn('');
      setYAxisColumn('');
      setQueryColumns([]);
    }
    setError(null);
    setShowSidebar(false);
  }, [initialData, open]);

  useEffect(() => {
    if (!sqlQuery || chartType === 'table' || chartType === 'indicator' || chartType === 'metric') return;
    if (isValidSQLQuery(sqlQuery)) {
      const parsedColumns = extractColumnsFromSQL(sqlQuery);
      if (parsedColumns.length > 0) {
        setQueryColumns(parsedColumns.map(col => ({ name: col.name, type: null })));
        if (!xAxisColumn && parsedColumns.length >= 1) setXAxisColumn(parsedColumns[0].name);
        if (!yAxisColumn && parsedColumns.length >= 2) setYAxisColumn(parsedColumns[1].name);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlQuery, chartType]);

  const handleSelectQuery = (query) => {
    setTitle(query.query_name || query.natural_language_query || `Query ${query.id}`);
    setSqlQuery(query.generated_sql || '');
    setShowSidebar(false);
  };

  const handleSave = () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!sqlQuery.trim()) { setError('SQL query is required'); return; }
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      sqlQuery: sqlQuery.trim(),
      chartType,
      chartConfig: { xField: xAxisColumn, yField: yAxisColumn, x_column: xAxisColumn, y_column: yAxisColumn }
    });
    onClose();
  };

  const handleClose = () => { setError(null); onClose(); };

  const sidebarVisible = showSidebar && !initialData && recentQueries.length > 0;
  const showAxisConfig = isEditing && chartType !== 'table' && chartType !== 'indicator' && chartType !== 'metric' && queryColumns.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal with animated width */}
      <div 
        className={`relative rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'}`}
        style={{ width: sidebarVisible ? '860px' : '600px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex' }}
      >
        {/* Sidebar with animated width */}
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0 ${isDark ? 'bg-[#101012]' : 'bg-gray-50'}`}
          style={{ width: sidebarVisible ? '260px' : '0px' }}
        >
          <div className={`w-[260px] h-full overflow-y-auto ${sidebarVisible ? 'border-r' : ''} ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Recent Queries</h3>
            </div>
            <div className="p-2 space-y-1">
              {recentQueries.map((query) => (
                <button
                  key={query.id}
                  onClick={() => handleSelectQuery(query)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#1c1d1f] text-gray-300' : 'hover:bg-white text-gray-700 hover:shadow-sm'}`}
                >
                  <div className="font-medium truncate text-sm">{query.query_name || query.natural_language_query || `Query ${query.id}`}</div>
                  {query.generated_sql && <div className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{query.generated_sql.substring(0, 40)}...</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - scrollable if needed */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: '90vh' }}>
          {/* Header */}
          <div className={`px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {initialData ? 'Edit Tile' : 'Create New Tile'}
              </h2>
              <div className="flex items-center gap-2">
                {!initialData && recentQueries.length > 0 && (
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showSidebar ? 'bg-[#5d6ad3] text-white' : isDark ? 'bg-[#1c1d1f] text-gray-300 hover:bg-[#2a2b2e]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Use saved queries
                  </button>
                )}
                <button onClick={handleClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#2a2b2e] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Form Content */}
          <div className="px-5 py-4">
            {error && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tile Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Monthly Sales Report"
                  className={`w-full px-3 py-2 rounded-lg text-sm border outline-none ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this tile"
                  className={`w-full px-3 py-2 rounded-lg text-sm border outline-none ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              {/* Chart Type */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Visualization Type</label>
                <ChartTypeSelector value={chartType} onChange={setChartType} />
              </div>

              {/* Axis Config - only when editing */}
              {showAxisConfig && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-[#1c1d1f]' : 'bg-gray-50'}`}>
                  <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Chart Axes</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>X-Axis</label>
                      <select value={xAxisColumn} onChange={(e) => setXAxisColumn(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm border outline-none ${isDark ? 'bg-[#17181a] border-[#2a2b2e] text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                        <option value="">Select...</option>
                        {queryColumns.map((col) => <option key={col.name} value={col.name}>{col.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Y-Axis</label>
                      <select value={yAxisColumn} onChange={(e) => setYAxisColumn(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm border outline-none ${isDark ? 'bg-[#17181a] border-[#2a2b2e] text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                        <option value="">Select...</option>
                        {queryColumns.map((col) => <option key={col.name} value={col.name}>{col.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* SQL Query */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>SQL Query</label>
                <SqlEditor value={sqlQuery} onChange={setSqlQuery} height="200px" placeholder="SELECT column1, column2 FROM table_name WHERE condition" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`px-5 py-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
            <button onClick={handleClose} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-gray-300 hover:bg-[#2a2b2e]' : 'text-gray-700 hover:bg-gray-100'}`}>
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors">
              {initialData ? 'Update Tile' : 'Create Tile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlTileModal;

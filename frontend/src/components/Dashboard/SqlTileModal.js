import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SqlEditor } from '../Common';

// Chart type options with icons
const CHART_TYPES = [
  { 
    id: 'table', 
    label: 'Table',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    id: 'bar', 
    label: 'Bar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  { 
    id: 'line', 
    label: 'Line',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    )
  },
  { 
    id: 'area', 
    label: 'Area',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 19l4-4 4 4 4-4 4 4V5H3v14z" />
      </svg>
    )
  },
  { 
    id: 'pie', 
    label: 'Pie',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    )
  },
  { 
    id: 'scatter', 
    label: 'Scatter',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="7" cy="17" r="2" strokeWidth={1.5} />
        <circle cx="12" cy="10" r="2" strokeWidth={1.5} />
        <circle cx="17" cy="14" r="2" strokeWidth={1.5} />
        <circle cx="9" cy="7" r="2" strokeWidth={1.5} />
        <circle cx="16" cy="6" r="2" strokeWidth={1.5} />
      </svg>
    )
  }
];

const SqlTileModal = ({ open, onClose, onSave, initialData = null, recentQueries = [] }) => {
  const { isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [error, setError] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setSqlQuery(initialData.sql_query || '');
      setChartType(initialData.chart_type || 'bar');
    } else {
      setTitle('');
      setDescription('');
      setSqlQuery('');
      setChartType('bar');
    }
    setError(null);
    setShowSidebar(false);
  }, [initialData, open]);

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

    const formData = {
      title: title.trim(),
      description: description.trim() || null,
      sqlQuery: sqlQuery.trim(),
      chartType,
      chartConfig: {}
    };

    console.log('SqlTileModal - Sending form data:', formData);
    console.log('SqlTileModal - Current state:', { title, description, sqlQuery, chartType });

    onSave(formData);
    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const sidebarVisible = showSidebar && !initialData && recentQueries.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal with animated width */}
      <div 
        className={`
          relative mx-4 rounded-xl shadow-2xl flex overflow-hidden
          transition-all duration-300 ease-in-out
          ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'}
        `}
        style={{ 
          width: sidebarVisible ? '900px' : '672px',
          maxWidth: '95vw'
        }}
      >
        {/* Sidebar - Query List */}
        <div 
          className={`
            transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
            ${isDark ? 'bg-gray-950 border-r border-gray-800' : 'bg-gray-50 border-r border-gray-200'}
          `}
          style={{ width: sidebarVisible ? '280px' : '0px' }}
        >
          <div className="w-[280px] h-full flex flex-col">
            <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Recent Queries
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {recentQueries.map((query) => (
                <button
                  key={query.id}
                  type="button"
                  onClick={() => handleSelectQuery(query)}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg transition-colors
                    ${isDark 
                      ? 'hover:bg-gray-800 text-gray-300' 
                      : 'hover:bg-white text-gray-700 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="font-medium truncate text-sm">
                    {query.query_name || `Query ${query.id}`}
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {query.generated_sql?.substring(0, 40)}...
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {initialData ? 'Edit Tile' : 'Create New Tile'}
              </h2>
              <div className="flex items-center gap-2">
                {!initialData && recentQueries.length > 0 && (
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${showSidebar
                        ? 'bg-blue-600 text-white'
                        : isDark 
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    Use saved queries
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-5 py-4 max-h-[70vh] overflow-y-auto flex-1">
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
              <div className="flex flex-wrap gap-2">
                {CHART_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setChartType(type.id)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${chartType === type.id
                        ? isDark 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-blue-600 text-white'
                        : isDark
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }
                    `}
                  >
                    {type.icon}
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SQL Query */}
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
    </div>
  );
};

export default SqlTileModal;

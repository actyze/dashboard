import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { QueryManagementService } from '../../services';

const QueriesList = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('recent');
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favoritedIds, setFavoritedIds] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState({ show: false, queryId: null });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    loadQueries();
  }, [activeTab]);

  const loadQueries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (activeTab === 'recent') {
        response = await QueryManagementService.getQueryHistory({
          limit: 100
        });
      } else {
        response = await QueryManagementService.getSavedQueries({
          limit: 100
        });
      }
      
      if (response.success) {
        setQueries(response.queries || []);
      } else {
        setError(response.error || 'Failed to load queries');
      }
    } catch (err) {
      setError('An error occurred while loading queries');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryClick = (query) => {
    navigate(`/query/${query.id}`, { state: { query } });
  };

  const handleDeleteClick = (e, queryId) => {
    e.stopPropagation();
    setDeleteModal({ show: true, queryId });
  };

  const handleDeleteConfirm = async () => {
    const queryId = deleteModal.queryId;
    setDeleteModal({ show: false, queryId: null });
    
    try {
      let response;
      if (activeTab === 'recent') {
        response = await QueryManagementService.deleteQueryFromHistory(queryId);
      } else {
        response = await QueryManagementService.deleteSavedQuery(queryId);
      }
      
      if (response.success) {
        loadQueries();
      } else {
        showToast(response.error || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('An error occurred while deleting', 'error');
      console.error(err);
    }
  };

  const handleAddToFavorites = async (e, query) => {
    e.stopPropagation();
    if (favoritedIds.has(query.id)) return;
    
    try {
      const response = await QueryManagementService.addToFavorites({
        query_name: query.query_name || `Query ${query.id}`,
        natural_language_query: query.natural_language_query || '',
        generated_sql: query.generated_sql || '',
        created_from_history_id: query.id
      });
      
      if (response.success) {
        setFavoritedIds(prev => new Set([...prev, query.id]));
      } else {
        showToast(response.error || 'Failed to add to favorites', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
      console.error(err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Database returns UTC timestamps without 'Z', so add it to ensure proper parsing
    const utcDateString = dateString.includes('Z') ? dateString : dateString + 'Z';
    const date = new Date(utcDateString);
    
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
      return '-';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getQueryType = (query) => {
    return query.query_type === 'natural_language' ? 'AI Query' : 'SQL Query';
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#1a1f2e]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`px-8 pt-4 pb-2 flex items-center justify-between`}>
        <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Queries
        </h1>
        <button
          onClick={() => navigate('/query/new')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Tabs Section */}
      <div className="px-8">
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <nav className="flex space-x-6">
            <button 
              onClick={() => setActiveTab('recent')}
              className={`
                pb-3 text-sm font-medium transition-colors relative
                ${activeTab === 'recent' 
                  ? isDark ? 'text-blue-400' : 'text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              Recent
              {activeTab === 'recent' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('saved')}
              className={`
                pb-3 text-sm font-medium transition-colors relative
                ${activeTab === 'saved' 
                  ? isDark ? 'text-blue-400' : 'text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              Favorites
              {activeTab === 'saved' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 px-8 pt-4 overflow-hidden flex flex-col pb-4">
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Viewed</div>
          <div className="col-span-2">Updated</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Body */}
        <div className={`flex-1 overflow-auto rounded-lg ${isDark ? 'bg-[#232a3b]' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className={`mt-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Loading queries...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <p className="text-red-500 text-sm font-medium">{error}</p>
                <button 
                  onClick={loadQueries}
                  className="mt-2 text-blue-500 hover:text-blue-400 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : queries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <svg className={`w-10 h-10 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No queries yet
              </p>
              <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {activeTab === 'recent' ? 'Your query history will appear here' : 'Save queries to access them later'}
              </p>
              <button
                onClick={() => navigate('/query/new')}
                className="text-blue-500 hover:text-blue-400 text-sm font-medium"
              >
                Create Query
              </button>
            </div>
          ) : (
            <div>
              {queries.map((query) => (
                <div 
                  key={query.id}
                  onClick={() => handleQueryClick(query)}
                  className={`
                    grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-colors
                    border-b last:border-b-0
                    ${isDark 
                      ? 'border-gray-700 hover:bg-[#2a3142]' 
                      : 'border-gray-100 hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Title */}
                  <div className="col-span-5 flex items-center space-x-3 min-w-0">
                    <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className={`truncate text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {query.query_name || 'Unnamed Query'}
                    </span>
                  </div>
                  
                  {/* Type */}
                  <div className="col-span-2 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {getQueryType(query)}
                    </span>
                  </div>
                  
                  {/* Viewed */}
                  <div className="col-span-2 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {formatDate(query.executed_at || query.created_at)}
                    </span>
                  </div>
                  
                  {/* Updated */}
                  <div className="col-span-2 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {formatDate(query.updated_at || query.created_at)}
                    </span>
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end space-x-1">
                    {activeTab === 'recent' && (
                      <button
                        onClick={(e) => handleAddToFavorites(e, query)}
                        disabled={favoritedIds.has(query.id)}
                        className={`
                          p-1.5 rounded transition-colors
                          ${favoritedIds.has(query.id)
                            ? 'text-yellow-500 cursor-default'
                            : isDark 
                              ? 'hover:bg-yellow-900/30 text-gray-500 hover:text-yellow-400' 
                              : 'hover:bg-yellow-50 text-gray-400 hover:text-yellow-500'
                          }
                        `}
                        title={favoritedIds.has(query.id) ? "Added to favorites" : "Add to favorites"}
                      >
                        <svg className="w-4 h-4" fill={favoritedIds.has(query.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteClick(e, query.id)}
                      className={`
                        p-1.5 rounded transition-colors
                        ${isDark 
                          ? 'hover:bg-red-900/30 text-gray-500 hover:text-red-400' 
                          : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                        }
                      `}
                      title="Delete query"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModal({ show: false, queryId: null })} />
          <div className={`relative z-10 w-full max-w-sm mx-4 p-6 rounded-xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Delete Query</h3>
            </div>
            <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to delete this query? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setDeleteModal({ show: false, queryId: null })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-bottom-2 ${
          toast.type === 'error' 
            ? 'bg-red-600 text-white' 
            : 'bg-green-600 text-white'
        }`}>
          {toast.type === 'error' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default QueriesList;

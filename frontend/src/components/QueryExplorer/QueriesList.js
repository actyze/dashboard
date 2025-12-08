import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, Text, Button } from '../ui';
import { QueryManagementService } from '../../services';

const QueriesList = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('recent'); // 'recent' or 'saved'
  
  // Data state
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  
  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  
  // Rename modal state
  const [renamingQueryId, setRenamingQueryId] = useState(null);
  const [newQueryName, setNewQueryName] = useState('');

  useEffect(() => {
    loadQueries();
  }, [activeTab, page]);

  const loadQueries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (activeTab === 'recent') {
        // Load query history
        response = await QueryManagementService.getQueryHistory({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE
        });
      } else {
        // Load saved queries
        response = await QueryManagementService.getSavedQueries({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE
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

  const handleDelete = async (queryId, event) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this query?')) {
      return;
    }
    
    try {
      let response;
      if (activeTab === 'recent') {
        response = await QueryManagementService.deleteQueryFromHistory(queryId);
      } else {
        response = await QueryManagementService.deleteSavedQuery(queryId);
      }
      
      if (response.success) {
        loadQueries(); // Refresh list
      } else {
        alert(`Failed to delete: ${response.error}`);
      }
    } catch (err) {
      alert('An error occurred while deleting the query');
      console.error(err);
    }
  };

  const handleRename = async (queryId, event) => {
    event.stopPropagation();
    setRenamingQueryId(queryId);
    const query = queries.find(q => q.id === queryId);
    setNewQueryName(query?.query_name || '');
  };

  const saveRename = async () => {
    if (!newQueryName.trim()) {
      alert('Query name cannot be empty');
      return;
    }
    
    try {
      let response;
      if (activeTab === 'recent') {
        response = await QueryManagementService.renameQuery(renamingQueryId, newQueryName);
      } else {
        response = await QueryManagementService.updateSavedQuery(renamingQueryId, {
          query_name: newQueryName
        });
      }
      
      if (response.success) {
        setRenamingQueryId(null);
        setNewQueryName('');
        loadQueries(); // Refresh list
      } else {
        alert(`Failed to rename: ${response.error}`);
      }
    } catch (err) {
      alert('An error occurred while renaming the query');
      console.error(err);
    }
  };

  const handleToggleFavorite = async (queryId, currentFavoriteStatus, event) => {
    event.stopPropagation();
    
    try {
      const response = await QueryManagementService.toggleFavorite(queryId, !currentFavoriteStatus);
      
      if (response.success) {
        loadQueries(); // Refresh list
      } else {
        alert(`Failed to toggle favorite: ${response.error}`);
      }
    } catch (err) {
      alert('An error occurred while toggling favorite');
      console.error(err);
    }
  };

  const handleSaveToFavorites = async (queryId, event) => {
    event.stopPropagation();
    
    const query = queries.find(q => q.id === queryId);
    const queryName = prompt('Enter a name for this saved query:', query?.query_name || 'Saved Query');
    
    if (!queryName) return;
    
    try {
      const response = await QueryManagementService.saveQueryFromHistory(queryId, queryName);
      
      if (response.success) {
        alert('Query saved successfully!');
      } else {
        alert(`Failed to save: ${response.error}`);
      }
    } catch (err) {
      alert('An error occurred while saving the query');
      console.error(err);
    }
  };

  const handleQueryClick = (query) => {
    // Navigate to query page with pre-filled SQL
    navigate('/query/new', { 
      state: { 
        sql: query.generated_sql,
        nlQuery: query.natural_language_query
      } 
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    
    // Check for invalid date (like Unix epoch 0)
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
      return 'N/A';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <Text variant="h4" className="font-semibold">
            Queries
          </Text>
          
          <button
            onClick={() => navigate('/query/new')}
            className={`
              flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md
              transition-colors
              ${isDark 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Query</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-4 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav className="flex space-x-8">
            <button 
              onClick={() => { setActiveTab('recent'); setPage(0); }}
              className={`
                border-b-2 pb-2 text-sm font-medium transition-colors
                ${activeTab === 'recent' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              Recent Queries
            </button>
            <button 
              onClick={() => { setActiveTab('saved'); setPage(0); }}
              className={`
                border-b-2 pb-2 text-sm font-medium transition-colors
                ${activeTab === 'saved' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              Saved Queries
            </button>
          </nav>
        </div>


        {/* Queries List */}
        <div className={`flex-1 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden flex flex-col`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <Text color="secondary" className="mt-2 text-sm">
                  Loading queries...
                </Text>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <Text className="text-red-600 dark:text-red-400 font-medium">
                  {error}
                </Text>
                <button 
                  onClick={loadQueries}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : queries.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <Text color="secondary" className="text-lg font-medium mb-1">
                  No queries found
                </Text>
                <Text color="secondary" className="text-sm">
                  {activeTab === 'recent' 
                    ? 'Your query history will appear here' 
                    : 'Save queries to access them quickly later'
                  }
                </Text>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {queries.map((query) => (
                <div 
                  key={query.id}
                  className={`px-6 py-3 border-b cursor-pointer transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-100 hover:bg-gray-50'}`}
                  onClick={() => handleQueryClick(query)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Query Name */}
                      <div className="flex items-center space-x-2">
                        {activeTab === 'saved' && query.is_favorite && (
                          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                        <Text className="font-medium truncate">
                          {query.query_name || 'Unnamed Query'}
                        </Text>
                        <Text color="secondary" className="text-xs">
                          {formatDate(query.executed_at || query.created_at)}
                        </Text>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1 ml-4" onClick={(e) => e.stopPropagation()}>
                      {activeTab === 'saved' && (
                        <button
                          onClick={(e) => handleToggleFavorite(query.id, query.is_favorite, e)}
                          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
                          title={query.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg className={`w-4 h-4 ${query.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} fill={query.is_favorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      
                      {activeTab === 'recent' && (
                        <button
                          onClick={(e) => handleSaveToFavorites(query.id, e)}
                          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          title="Save to favorites"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => handleRename(query.id, e)}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Rename"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => handleDelete(query.id, e)}
                        className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {!loading && !error && queries.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className={`
                px-3 py-1.5 text-sm rounded-md border transition-colors
                ${page === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }
                ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}
              `}
            >
              Previous
            </button>
            
            <Text color="secondary" className="text-sm">
              Page {page + 1}
            </Text>
            
            <button
              onClick={() => setPage(page + 1)}
              disabled={queries.length < PAGE_SIZE}
              className={`
                px-3 py-1.5 text-sm rounded-md border transition-colors
                ${queries.length < PAGE_SIZE
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }
                ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}
              `}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {renamingQueryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setRenamingQueryId(null)}>
          <div 
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 w-96`}
            onClick={(e) => e.stopPropagation()}
          >
            <Text variant="h6" className="mb-4">Rename Query</Text>
            <input
              type="text"
              value={newQueryName}
              onChange={(e) => setNewQueryName(e.target.value)}
              className={`
                w-full px-3 py-2 rounded-md border mb-4
                ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}
                focus:ring-1 focus:ring-blue-500 focus:border-blue-500
              `}
              placeholder="Enter query name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setRenamingQueryId(null)}
                className={`px-4 py-2 rounded-md ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={saveRename}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueriesList;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { QueryManagementService } from '../../services';
import { getQueryDisplayTitle } from '../../utils/queryTitleGenerator';

const QueriesList = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQueries();
  }, []);

  const loadQueries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await QueryManagementService.getQueryHistory({
        limit: 100
      });
      
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
    navigate(`/query/${query.id}`, { 
      state: { query }
    });
  };

  const handleDeleteQuery = async (e, query) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this query?')) {
      return;
    }
    
    try {
      const response = await QueryManagementService.deleteQueryFromHistory(query.id);
      
      if (response.success) {
        setQueries(prev => prev.filter(q => q.id !== query.id));
      } else {
        alert(response.error || 'Failed to delete query');
      }
    } catch (err) {
      alert('An error occurred while deleting the query');
      console.error(err);
    }
  };

  const handleToggleFavorite = async (e, query) => {
    e.stopPropagation();
    
    try {
      const response = await QueryManagementService.toggleFavorite(query.id);
      
      if (response.success) {
        setQueries(prev => prev.map(q => 
          q.id === query.id 
            ? { ...q, is_favorite: response.is_favorite }
            : q
        ));
      } else {
        alert(response.error || 'Failed to update favorite');
      }
    } catch (err) {
      alert('An error occurred');
      console.error(err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Queries
        </h1>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/query/new')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              isDark 
                ? 'text-gray-300 hover:bg-[#1c1d1f]' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
            New query
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-4 px-6 py-2 text-xs font-medium border-b sticky top-0 ${
          isDark 
            ? 'text-gray-500 border-[#2a2b2e] bg-[#101012]' 
            : 'text-gray-500 border-gray-200 bg-gray-50'
        }`}>
          <div className="col-span-6">Name</div>
          <div className="col-span-2">Last updated</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-2 text-right"></div>
        </div>

        {/* Table Body */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3] mx-auto"></div>
              <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Loading...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
              <p className="text-red-500 text-xs">{error}</p>
                <button 
                  onClick={loadQueries}
                className="mt-2 text-[#5d6ad3] hover:text-[#4f5bc4] text-xs"
                >
                Try again
                </button>
              </div>
            </div>
          ) : queries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                No queries yet
              </p>
              <button
                onClick={() => navigate('/query/new')}
              className="text-[#5d6ad3] hover:text-[#4f5bc4] text-xs mt-1"
              >
              Create your first query
              </button>
            </div>
          ) : (
            <div>
              {queries.map((query) => (
                <div 
                  key={query.id}
                  onClick={() => handleQueryClick(query)}
                  className={`
                  grid grid-cols-12 gap-4 px-6 py-2.5 cursor-pointer transition-colors
                  border-b
                    ${isDark 
                    ? 'border-[#1c1d1f] hover:bg-[#1c1d1f]' 
                      : 'border-gray-100 hover:bg-gray-50'
                    }
                  `}
                >
                {/* Name */}
                <div className="col-span-6 flex items-center min-w-0">
                    <span className={`truncate text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {getQueryDisplayTitle(query)}
                    </span>
                  {query.is_favorite && (
                    <svg className="w-3 h-3 text-yellow-500 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    )}
                  </div>
                  
                {/* Last Updated */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {formatDate(query.updated_at || query.created_at)}
                    </span>
                  </div>
                  
                  {/* Created */}
                  <div className="col-span-2 flex items-center">
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {formatDate(query.created_at)}
                    </span>
                  </div>
                
                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end space-x-1">
                  <button
                    onClick={(e) => handleToggleFavorite(e, query)}
                    className={`p-1 rounded transition-colors ${
                      query.is_favorite
                        ? 'text-yellow-500 hover:text-yellow-400'
                        : isDark 
                          ? 'text-gray-600 hover:text-gray-400 hover:bg-[#2a2b2e]' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                    }`}
                    title={query.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg 
                      className="w-3.5 h-3.5" 
                      fill={query.is_favorite ? 'currentColor' : 'none'} 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => handleDeleteQuery(e, query)}
                    className={`p-1 rounded transition-colors ${
                      isDark 
                        ? 'text-gray-600 hover:text-red-400 hover:bg-[#2a2b2e]' 
                        : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
                    }`}
                    title="Delete query"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
};

export default QueriesList;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, Text } from '../ui';
import { QueriesService } from '../../services';

const QueriesList = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadQueries();
  }, []);

  const loadQueries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await QueriesService.getAllQueries({
        search: searchTerm
      });
      
      if (response.success) {
        setQueries(response.data);
      } else {
        setError(response.message || 'Failed to load queries');
      }
    } catch (err) {
      setError('An error occurred while loading queries');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (term.trim()) {
      await loadQueries();
    }
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <Text variant="h4" className="font-semibold">
              Queries
            </Text>
          </div>
          
          {/* Search and New Button */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className={`
                  w-64 pl-10 pr-3 py-1.5 text-sm rounded-md border
                  ${isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                  focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                `}
                placeholder="Search"
              />
            </div>
            
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
              <span>Query</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recently viewed section */}
      <div className="flex-1 px-6 pt-6 overflow-hidden flex flex-col">
        <Text variant="h6" className="mb-4 font-medium">
          Your Queries
        </Text>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            <button className="border-b-2 border-blue-500 pb-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              All queries
            </button>
            <button className="pb-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              Recent
            </button>
          </nav>
        </div>

        {/* Queries Table */}
        <div className={`flex-1 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden flex flex-col`}>
          {/* Table Header */}
          <div className={`px-6 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="col-span-5">Title</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Viewed</div>
              <div className="col-span-2">Updated</div>
              <div className="col-span-1"></div>
            </div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-auto divide-y divide-gray-200 dark:divide-gray-700">
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
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <Text color="secondary">
                    No queries found
                  </Text>
                  <Text color="secondary" className="text-sm mt-1">
                    {searchTerm ? 'Try adjusting your search' : 'Create your first query to get started'}
                  </Text>
                </div>
              </div>
            ) : (
              queries.map((query) => (
                <div 
                  key={query.id}
                  className={`px-6 py-4 cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}
                  onClick={() => navigate(`/query/${query.id}`)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center space-x-3">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <Text className="font-medium">
                          {query.title}
                        </Text>
                        <Text color="secondary" className="text-xs">
                          {query.description}
                        </Text>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Text className="text-sm">
                        SQL Worksheet
                      </Text>
                    </div>
                    <div className="col-span-2">
                      <Text color="secondary" className="text-sm">
                        {query.lastViewed}
                      </Text>
                    </div>
                    <div className="col-span-2">
                      <Text color="secondary" className="text-sm">
                        {query.lastUpdated}
                      </Text>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button className={`p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueriesList;
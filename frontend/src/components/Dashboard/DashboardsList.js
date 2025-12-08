import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, Text } from '../ui';
import { DashboardService } from '../../services';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

const DashboardsList = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'recent'

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setLoading(true);
    
    try {
      const response = await DashboardService.getDashboards();
      
      if (response.success) {
        setDashboards(response.dashboards);
      } else {
        console.error('Failed to load dashboards:', response.error);
        setDashboards([]);
      }
    } catch (error) {
      console.error('Error loading dashboards:', error);
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      if (date.getFullYear() < 2000) return 'N/A';
      return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch {
      return 'N/A';
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleDeleteDashboard = async (e, dashboardId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this dashboard? This action cannot be undone.')) {
      return;
    }
    
    const response = await DashboardService.deleteDashboard(dashboardId);
    if (response.success) {
      loadDashboards();
    } else {
      alert(`Failed to delete dashboard: ${response.error}`);
    }
  };

  const filteredDashboards = dashboards
    .filter(dashboard => {
      // Search filter
      const matchesSearch = !searchTerm || 
        dashboard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dashboard.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Tab filter
      if (activeTab === 'recent') {
        // Show recently accessed dashboards (last 7 days)
        if (!dashboard.last_accessed_at) return false;
        const lastAccessed = parseISO(dashboard.last_accessed_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return matchesSearch && lastAccessed > sevenDaysAgo;
      }
      
      return matchesSearch;
    })
    .sort((a, b) => {
      // Sort by updated_at desc
      if (!a.updated_at) return 1;
      if (!b.updated_at) return -1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <Text variant="h4" className="font-semibold">
            Dashboards
          </Text>
          
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
              onClick={() => navigate('/dashboard/new')}
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
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboards List */}
      <div className="flex-1 px-6 pt-4 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            <button 
              onClick={() => setActiveTab('all')}
              className={`pb-2 text-sm font-medium ${
                activeTab === 'all' 
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              All dashboards
            </button>
            <button 
              onClick={() => setActiveTab('recent')}
              className={`pb-2 text-sm font-medium ${
                activeTab === 'recent' 
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Recent
            </button>
          </nav>
        </div>

        {/* Dashboards Table */}
        <div className={`flex-1 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden flex flex-col`}>
          {/* Table Header */}
          <div className={`px-6 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="col-span-5">Title</div>
              <div className="col-span-2">Tiles</div>
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
                    Loading dashboards...
                  </Text>
                </div>
              </div>
            ) : filteredDashboards.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
                  </svg>
                  <Text color="secondary">
                    No dashboards found
                  </Text>
                  <Text color="secondary" className="text-sm mt-1">
                    {searchTerm ? 'Try adjusting your search' : 'Create your first dashboard to get started'}
                  </Text>
                  {!searchTerm && (
                    <button
                      onClick={() => navigate('/dashboard/new')}
                      className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Create Dashboard
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredDashboards.map((dashboard) => (
                <div 
                  key={dashboard.id}
                  className={`px-6 py-4 cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}
                  onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center space-x-3">
                      {dashboard.is_favorite && (
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                      <svg className={`w-4 h-4 ${dashboard.is_public ? 'text-green-500' : 'text-purple-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {dashboard.is_public ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                        )}
                      </svg>
                      <div>
                        <div className="flex items-center gap-2">
                          <Text className="font-medium">
                            {dashboard.title}
                          </Text>
                          {dashboard.is_public && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Public
                            </span>
                          )}
                        </div>
                        <Text color="secondary" className="text-xs">
                          {dashboard.description || 'No description'}
                        </Text>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Text className="text-sm">
                        {dashboard.tile_count || 0} tiles
                      </Text>
                    </div>
                    <div className="col-span-2">
                      <Text color="secondary" className="text-sm">
                        {formatDate(dashboard.last_accessed_at)}
                      </Text>
                    </div>
                    <div className="col-span-2">
                      <Text color="secondary" className="text-sm">
                        {formatDate(dashboard.updated_at)}
                      </Text>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {dashboard.permissions?.can_delete && (
                        <button 
                          onClick={(e) => handleDeleteDashboard(e, dashboard.id)}
                          className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-100 text-red-600'}`}
                          title="Delete dashboard"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
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

export default DashboardsList;


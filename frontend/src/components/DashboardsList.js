import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Text } from './ui';

const DashboardsList = ({ onDashboardSelect, onNavigate }) => {
  const { isDark } = useTheme();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = () => {
    setLoading(true);
    
    try {
      // Load dashboards from localStorage
      const savedTiles = localStorage.getItem('dashboardTiles');
      const savedDashboards = localStorage.getItem('savedDashboards') || '[]';
      
      let dashboardsList = JSON.parse(savedDashboards);
      
      // If there are tiles but no dashboard list, create a default dashboard
      if (savedTiles && dashboardsList.length === 0) {
        dashboardsList = [{
          id: 'default',
          title: 'My Dashboard',
          description: 'Default dashboard',
          tilesCount: JSON.parse(savedTiles).length,
          lastViewed: new Date().toLocaleDateString(),
          lastUpdated: new Date().toLocaleDateString()
        }];
      }
      
      setDashboards(dashboardsList);
    } catch (error) {
      console.error('Error loading dashboards:', error);
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const filteredDashboards = dashboards.filter(dashboard =>
    dashboard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dashboard.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
          </div>
          <Text variant="h4" className="font-semibold">
            Dashboards
          </Text>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="relative max-w-2xl">
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
              block w-full pl-10 pr-3 py-2 text-sm rounded-md border
              ${isDark 
                ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }
              focus:ring-1 focus:ring-blue-500 focus:border-blue-500
            `}
            placeholder="Search dashboards"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex-shrink-0 px-6 pb-6">
        <Text variant="h6" className="mb-4 font-medium">
          Quick actions
        </Text>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className={`p-4 cursor-pointer transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onDashboardSelect(null)}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded ${isDark ? 'bg-blue-600' : 'bg-blue-500'} flex items-center justify-center`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <Text variant="subtitle1" className="font-medium">
                  New Dashboard
                </Text>
                <Text color="secondary" className="text-xs">
                  Create a new dashboard
                </Text>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-4 cursor-pointer transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onNavigate && onNavigate('queries-list')}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded ${isDark ? 'bg-green-600' : 'bg-green-500'} flex items-center justify-center`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <Text variant="subtitle1" className="font-medium">
                  View Queries
                </Text>
                <Text color="secondary" className="text-xs">
                  Browse SQL queries
                </Text>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Dashboards List */}
      <div className="flex-1 px-6 overflow-hidden flex flex-col">
        <Text variant="h6" className="mb-4 font-medium">
          Your Dashboards
        </Text>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            <button className="border-b-2 border-blue-500 pb-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              All dashboards
            </button>
            <button className="pb-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
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
                      onClick={() => onDashboardSelect(null)}
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
                  onClick={() => onDashboardSelect(dashboard)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center space-x-3">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                      </svg>
                      <div>
                        <Text className="font-medium">
                          {dashboard.title}
                        </Text>
                        <Text color="secondary" className="text-xs">
                          {dashboard.description}
                        </Text>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Text className="text-sm">
                        {dashboard.tilesCount || 0} tiles
                      </Text>
                    </div>
                    <div className="col-span-2">
                      <Text color="secondary" className="text-sm">
                        {dashboard.lastViewed}
                      </Text>
                    </div>
                    <div className="col-span-2">
                      <Text color="secondary" className="text-sm">
                        {dashboard.lastUpdated}
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

export default DashboardsList;


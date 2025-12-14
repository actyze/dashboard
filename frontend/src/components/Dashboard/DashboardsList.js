import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { DashboardService } from '../../services';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

const DashboardsList = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
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
    if (!dateString) return '-';
    try {
      // Database returns UTC timestamps without 'Z', so add it to ensure proper parsing
      const utcDateString = dateString.includes('Z') ? dateString : dateString + 'Z';
      const date = parseISO(utcDateString);
      if (date.getFullYear() < 2000) return '-';
      return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch {
      return '-';
    }
  };

  const handleDelete = async (e, dashboardId) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this dashboard? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await DashboardService.deleteDashboard(dashboardId);
      
      if (response.success) {
        loadDashboards();
      } else {
        alert(`Failed to delete: ${response.error}`);
      }
    } catch (err) {
      alert('An error occurred while deleting the dashboard');
      console.error(err);
    }
  };

  const filteredDashboards = dashboards
    .filter(dashboard => {
      if (activeTab === 'recent') {
        if (!dashboard.last_accessed_at) return false;
        const lastAccessed = parseISO(dashboard.last_accessed_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return lastAccessed > sevenDaysAgo;
      }
      return true;
    })
    .sort((a, b) => {
      if (!a.updated_at) return 1;
      if (!b.updated_at) return -1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#1a1f2e]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`px-8 pt-8 pb-6 flex items-center justify-between`}>
        <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Dashboards
        </h1>
        <button
          onClick={() => navigate('/dashboard/new')}
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
              onClick={() => setActiveTab('all')}
              className={`
                pb-3 text-sm font-medium transition-colors relative
                ${activeTab === 'all' 
                  ? isDark ? 'text-blue-400' : 'text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              All dashboards
              {activeTab === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
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
          </nav>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 px-8 pt-4 overflow-hidden flex flex-col pb-4">
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Tiles</div>
          <div className="col-span-2">Version</div>
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
                  Loading dashboards...
                </p>
              </div>
            </div>
          ) : filteredDashboards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <svg className={`w-10 h-10 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
              </svg>
              <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No dashboards yet
              </p>
              <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Get started by creating one
              </p>
              <button
                onClick={() => navigate('/dashboard/new')}
                className="text-blue-500 hover:text-blue-400 text-sm font-medium"
              >
                Create Dashboard
              </button>
            </div>
          ) : (
            <div>
              {filteredDashboards.map((dashboard) => (
                <div 
                  key={dashboard.id}
                  onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                  className={`
                    grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-colors
                    border-b last:border-b-0
                    ${isDark 
                      ? 'border-gray-700 hover:bg-[#2a3142]' 
                      : 'border-gray-100 hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Title with badges */}
                  <div className="col-span-5 flex items-center space-x-2 min-w-0">
                    {/* Dashboard icon */}
                    <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
                    </svg>
                    {/* Title */}
                    <span className={`truncate text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {dashboard.title}
                    </span>
                    {/* Public badges */}
                    {dashboard.is_anonymous_public && (
                      <span className={`
                        flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded
                        ${isDark 
                          ? 'bg-blue-900/40 text-blue-400' 
                          : 'bg-blue-100 text-blue-700'
                        }
                      `}>
                        🌐 Anonymous
                      </span>
                    )}
                    {dashboard.is_public && !dashboard.is_anonymous_public && (
                      <span className={`
                        flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded
                        ${isDark 
                          ? 'bg-green-900/40 text-green-400' 
                          : 'bg-green-100 text-green-700'
                        }
                      `}>
                        Public
                      </span>
                    )}
                  </div>
                  
                  {/* Tiles */}
                  <div className="col-span-2 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {dashboard.tile_count || 0} tiles
                    </span>
                  </div>
                  
                  {/* Version */}
                  <div className="col-span-2 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      v{dashboard.version || 1}
                      {dashboard.status === 'draft' && (
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-yellow-900/40 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                          Draft
                        </span>
                      )}
                      {dashboard.status === 'published' && (
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`}>
                          Published
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {/* Updated */}
                  <div className="col-span-2 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {formatDate(dashboard.updated_at)}
                    </span>
                  </div>
                  
                  {/* Delete */}
                  <div className="col-span-1 flex items-center justify-end">
                    <button
                      onClick={(e) => handleDelete(e, dashboard.id)}
                      className={`
                        p-1.5 rounded transition-colors
                        ${isDark 
                          ? 'hover:bg-red-900/30 text-gray-500 hover:text-red-400' 
                          : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                        }
                      `}
                      title="Delete dashboard"
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
    </div>
  );
};

export default DashboardsList;

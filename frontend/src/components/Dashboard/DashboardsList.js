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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [filterUpdatedBy, setFilterUpdatedBy] = useState('');
  const [filterUpdatedDate, setFilterUpdatedDate] = useState('all');

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

  const toggleFavorite = async (e, dashboardId, currentState) => {
    e.stopPropagation();
    
    try {
      const response = await DashboardService.updateDashboard(dashboardId, {
        is_favorite: !currentState
      });
      
      if (response.success) {
        loadDashboards();
      } else {
        alert(`Failed to update favorite: ${response.error}`);
      }
    } catch (err) {
      alert('An error occurred while updating favorite');
      console.error(err);
    }
  };

  const getUniqueUpdaters = () => {
    const updaters = new Set();
    dashboards.forEach(d => {
      if (d.updated_by_username) updaters.add(d.updated_by_username);
    });
    return Array.from(updaters).sort();
  };

  const filteredDashboards = dashboards
    .filter(dashboard => {
      if (showFavoritesOnly && !dashboard.is_favorite) return false;
      if (searchTitle && !dashboard.title.toLowerCase().includes(searchTitle.toLowerCase())) return false;
      if (filterUpdatedBy && dashboard.updated_by_username !== filterUpdatedBy) return false;
      
      if (filterUpdatedDate && filterUpdatedDate !== 'all') {
        if (!dashboard.updated_at) return false;
        const updatedDate = new Date(dashboard.updated_at + 'Z');
        const now = new Date();
        
        if (filterUpdatedDate === 'today') {
          const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (updatedDate < dayStart) return false;
        } else if (filterUpdatedDate === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (updatedDate < weekAgo) return false;
        } else if (filterUpdatedDate === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (updatedDate < monthAgo) return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      if (!a.updated_at) return 1;
      if (!b.updated_at) return -1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Loading dashboards...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`px-6 py-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Dashboards
          </h1>
          <button
            onClick={() => navigate('/dashboard/new')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <span>+</span>
            <span>New</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              placeholder="Search title..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          <div>
            <select
              value={filterUpdatedBy}
              onChange={(e) => setFilterUpdatedBy(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">All Users</option>
              {getUniqueUpdaters().map(username => (
                <option key={username} value={username}>{username}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterUpdatedDate}
              onChange={(e) => setFilterUpdatedDate(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          <div className="flex items-center">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFavoritesOnly}
                onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                ⭐ Favorites Only
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filteredDashboards.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {dashboards.length === 0 ? (
              <div>
                <p className="text-lg mb-2">No dashboards yet</p>
                <p className="text-sm">Click "New" to create your first dashboard</p>
              </div>
            ) : (
              <p className="text-lg">No dashboards match your filters</p>
            )}
          </div>
        ) : (
          <div className={`rounded-lg overflow-hidden border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider border-b ${isDark ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              <div className="col-span-4">TITLE</div>
              <div className="col-span-1">TILES</div>
              <div className="col-span-1">VERSION</div>
              <div className="col-span-2">UPDATED BY</div>
              <div className="col-span-2">UPDATED</div>
              <div className="col-span-2"></div>
            </div>

            {filteredDashboards.map((dashboard, index) => (
              <div
                key={dashboard.id}
                onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                className={`grid grid-cols-12 gap-4 px-4 py-4 cursor-pointer transition-colors ${index < filteredDashboards.length - 1 ? `border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}` : ''} ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <div className="col-span-4 flex items-center space-x-2 min-w-0">
                  <button
                    onClick={(e) => toggleFavorite(e, dashboard.id, dashboard.is_favorite)}
                    className={`flex-shrink-0 text-lg transition-colors ${dashboard.is_favorite ? 'text-yellow-500 hover:text-yellow-600' : isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-400'}`}
                    title={dashboard.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {dashboard.is_favorite ? '★' : '☆'}
                  </button>

                  <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
                  </svg>

                  <span className={`truncate text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {dashboard.title}
                  </span>
                  
                  {dashboard.status === 'published' ? (
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`}>
                      ✓
                    </span>
                  ) : dashboard.status === 'draft' ? (
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                      📝
                    </span>
                  ) : null}
                  
                  {dashboard.is_anonymous_public && (
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                      🌐
                    </span>
                  )}
                  {dashboard.is_public && !dashboard.is_anonymous_public && (
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                      Public
                    </span>
                  )}
                </div>

                <div className={`col-span-1 flex items-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {dashboard.tile_count || 0} tiles
                </div>

                <div className={`col-span-1 flex items-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  v{dashboard.version || 1}
                </div>

                <div className={`col-span-2 flex items-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {dashboard.updated_by_username || '-'}
                </div>

                <div className={`col-span-2 flex items-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatDate(dashboard.updated_at)}
                </div>

                <div className="col-span-2 flex items-center justify-end space-x-2">
                  <button
                    onClick={(e) => handleDelete(e, dashboard.id)}
                    className={`p-1.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'}`}
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
  );
};

export default DashboardsList;


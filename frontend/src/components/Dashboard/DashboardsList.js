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
  
  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'private', 'shared', 'public'

  // Helper to determine status from is_public and is_anonymous_public fields
  const getStatus = (dashboard) => {
    if (dashboard.is_public && dashboard.is_anonymous_public) {
      return 'public';
    } else if (dashboard.is_public && !dashboard.is_anonymous_public) {
      return 'shared';
    }
    return 'private';
  };

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

  // Toggle sort for a column
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc for dates, asc for title
      setSortColumn(column);
      setSortDirection(column === 'title' ? 'asc' : 'desc');
    }
  };

  // Filter and sort dashboards
  const getFilteredAndSortedDashboards = () => {
    let filtered = [...dashboards];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dashboard => 
        dashboard.title?.toLowerCase().includes(query) ||
        dashboard.description?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(dashboard => getStatus(dashboard) === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortColumn === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortColumn === 'updated_at') {
        if (!a.updated_at) return 1;
        if (!b.updated_at) return -1;
        comparison = new Date(a.updated_at) - new Date(b.updated_at);
      } else if (sortColumn === 'created_at') {
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        comparison = new Date(a.created_at) - new Date(b.created_at);
      } else if (sortColumn === 'status') {
        comparison = getStatus(a).localeCompare(getStatus(b));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  const sortedDashboards = getFilteredAndSortedDashboards();

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#1a1f2e]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`px-8 pt-4 pb-2`}>
        <div className="flex items-center justify-between mb-4">
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
        
        {/* Filter Controls */}
        {dashboards.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <svg 
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search dashboards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border
                  ${isDark 
                    ? 'bg-[#232a3b] border-gray-700 text-gray-200 placeholder-gray-500 focus:border-blue-500' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors
                `}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Status Filter Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`
                w-auto px-3 py-1.5 text-sm rounded-lg border cursor-pointer
                ${isDark 
                  ? 'bg-[#232a3b] border-gray-700 text-gray-200' 
                  : 'bg-white border-gray-200 text-gray-900'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors
              `}
            >
              <option value="all">All Status</option>
              <option value="private">Private</option>
              <option value="shared">Shared</option>
              <option value="public">Public</option>
            </select>

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className={`
                  flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${isDark 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 px-8 pt-2 overflow-hidden flex flex-col pb-4">
        {/* Table Header - Sortable Columns */}
        <div className={`grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {/* Title - Sortable */}
          <button
            onClick={() => handleSort('title')}
            className={`col-span-9 flex items-center gap-1 hover:text-blue-500 transition-colors text-left`}
          >
            Title
            <svg 
              className={`w-3 h-3 transition-transform ${sortColumn === 'title' ? 'opacity-100' : 'opacity-30'} ${sortColumn === 'title' && sortDirection === 'asc' ? '' : 'rotate-180'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          
          {/* Updated - Sortable */}
          <button
            onClick={() => handleSort('updated_at')}
            className={`col-span-2 flex items-center gap-1 hover:text-blue-500 transition-colors text-left`}
          >
            Updated
            <svg 
              className={`w-3 h-3 transition-transform ${sortColumn === 'updated_at' ? 'opacity-100' : 'opacity-30'} ${sortColumn === 'updated_at' && sortDirection === 'asc' ? '' : 'rotate-180'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          
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
          ) : dashboards.length === 0 ? (
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
          ) : sortedDashboards.length === 0 ? (
            // No dashboards match the search
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <svg className={`w-6 h-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No dashboards found
              </p>
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Try adjusting your filters
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                  ${isDark 
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters
              </button>
            </div>
          ) : (
            <div>
              {sortedDashboards.map((dashboard) => (
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
                  {/* Title */}
                  <div className="col-span-9 flex items-center space-x-2 min-w-0">
                    {/* Dashboard icon */}
                    <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
                    </svg>
                    {/* Title */}
                    <span className={`truncate text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {dashboard.title}
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

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
  const [statusFilter, setStatusFilter] = useState('all');

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

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'title' ? 'asc' : 'desc');
    }
  };

  const getFilteredAndSortedDashboards = () => {
    let filtered = [...dashboards];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dashboard => 
        dashboard.title?.toLowerCase().includes(query) ||
        dashboard.description?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(dashboard => getStatus(dashboard) === statusFilter);
    }
    
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
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Dashboards
          </h1>
          
          {/* Filter Controls - inline with title */}
          {dashboards.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Search Input */}
              <div className="relative">
                <svg 
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`
                    w-44 pl-8 pr-6 py-1 text-xs rounded border
                    ${isDark 
                      ? 'bg-[#1c1d1f] border-[#2a2b2e] text-gray-200 placeholder-gray-500 focus:border-[#5d6ad3]' 
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                    }
                    focus:outline-none transition-colors
                  `}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-100'}`}
                  >
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`
                  px-2 py-1 text-xs rounded border cursor-pointer
                  ${isDark 
                    ? 'bg-[#1c1d1f] border-[#2a2b2e] text-gray-300' 
                    : 'bg-white border-gray-200 text-gray-700'
                  }
                  focus:outline-none transition-colors
                `}
              >
                <option value="all">All</option>
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
                    p-1 rounded transition-colors
                    ${isDark 
                      ? 'text-gray-500 hover:text-gray-300 hover:bg-[#2a2b2e]' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }
                  `}
                  title="Clear filters"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        
        <button
          onClick={() => navigate('/dashboard/new')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            isDark 
              ? 'text-gray-300 hover:bg-[#1c1d1f]' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New dashboard
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-4 px-6 py-2 text-xs font-medium border-b sticky top-0 ${
          isDark 
            ? 'text-gray-500 border-[#2a2b2e] bg-[#101012]' 
            : 'text-gray-500 border-gray-200 bg-gray-50'
        }`}>
          {/* Title - Sortable */}
          <button
            onClick={() => handleSort('title')}
            className="col-span-8 flex items-center gap-1 hover:text-[#5d6ad3] transition-colors text-left"
          >
            Name
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
            className="col-span-2 flex items-center gap-1 hover:text-[#5d6ad3] transition-colors text-left"
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
          
          <div className="col-span-2"></div>
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
        ) : dashboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
            </svg>
            <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              No dashboards yet
            </p>
            <button
              onClick={() => navigate('/dashboard/new')}
              className="text-[#5d6ad3] hover:text-[#4f5bc4] text-xs mt-1"
            >
              Create your first dashboard
            </button>
          </div>
        ) : sortedDashboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              No dashboards found
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-[#5d6ad3] hover:text-[#4f5bc4] text-xs mt-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div>
            {sortedDashboards.map((dashboard) => (
              <div 
                key={dashboard.id}
                onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                className={`
                  grid grid-cols-12 gap-4 px-6 py-2.5 cursor-pointer transition-colors
                  border-b
                  ${isDark 
                    ? 'border-[#1c1d1f] hover:bg-[#1c1d1f]' 
                    : 'border-gray-100 hover:bg-gray-50'
                  }
                `}
              >
                {/* Title */}
                <div className="col-span-8 flex items-center min-w-0">
                  <span className={`truncate text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {dashboard.title}
                  </span>
                  {/* Status badge */}
                  {getStatus(dashboard) !== 'private' && (
                    <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      getStatus(dashboard) === 'public'
                        ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                        : isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getStatus(dashboard)}
                    </span>
                  )}
                </div>
                
                {/* Updated */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {formatDate(dashboard.updated_at)}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end">
                  <button
                    onClick={(e) => handleDelete(e, dashboard.id)}
                    className={`p-1 rounded transition-colors ${
                      isDark 
                        ? 'text-gray-600 hover:text-red-400 hover:bg-[#2a2b2e]' 
                        : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
                    }`}
                    title="Delete dashboard"
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

export default DashboardsList;

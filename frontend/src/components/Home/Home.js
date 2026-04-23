import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { QueryManagementService, DashboardService } from '../../services';
import { getQueryDisplayTitle } from '../../utils/queryTitleGenerator';
import OnboardingChecklist from '../Onboarding/OnboardingChecklist';

const Home = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [recentQueries, setRecentQueries] = useState([]);
  const [recentDashboards, setRecentDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queries');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    try {
      const [queriesRes, dashboardsRes] = await Promise.all([
        QueryManagementService.getQueryHistory({ limit: 10 }),
        DashboardService.getDashboards()
      ]);
      
      if (queriesRes.success) {
        setRecentQueries(queriesRes.queries || []);
      }
      
      if (dashboardsRes.success) {
        const sorted = (dashboardsRes.dashboards || [])
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, 10);
        setRecentDashboards(sorted);
      }
    } catch (err) {
      console.error('Error loading home data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewDashboard = () => {
    navigate('/dashboard/new');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const utcDateString = dateString.includes('Z') ? dateString : dateString + 'Z';
    const date = new Date(utcDateString);
    
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-';
    
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#5d6ad3] mx-auto"></div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {getGreeting()}
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Here's what's happening with your data
          </p>
        </div>

        {/* Onboarding — auto-hides once all three steps are complete */}
        <OnboardingChecklist />

        {/* Quick Action Cards — flat, hairline, consistent with onboarding card */}
        <div className="grid grid-cols-2 gap-2 mb-8 max-w-2xl">
          <button
            onClick={() => navigate('/query/new')}
            className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors ${
              isDark
                ? 'bg-[#101012] border-white/10 hover:bg-white/[0.02]'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isDark
                ? 'bg-white/[0.04] text-gray-400 group-hover:text-[#5d6ad3]'
                : 'bg-gray-100 text-gray-500 group-hover:text-[#5d6ad3] group-hover:bg-[#5d6ad3]/10'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-[13px] font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>New Query</span>
              <span className={`block text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Write SQL or ask in natural language
              </span>
            </span>
            <svg className={`flex-shrink-0 w-3 h-3 transition-all translate-x-0 group-hover:translate-x-0.5 ${
              isDark ? 'text-gray-600 group-hover:text-[#5d6ad3]' : 'text-gray-400 group-hover:text-[#5d6ad3]'
            }`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={handleCreateNewDashboard}
            className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors ${
              isDark
                ? 'bg-[#101012] border-white/10 hover:bg-white/[0.02]'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isDark
                ? 'bg-white/[0.04] text-gray-400 group-hover:text-[#5d6ad3]'
                : 'bg-gray-100 text-gray-500 group-hover:text-[#5d6ad3] group-hover:bg-[#5d6ad3]/10'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-[13px] font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>New Dashboard</span>
              <span className={`block text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Create visualizations and charts
              </span>
            </span>
            <svg className={`flex-shrink-0 w-3 h-3 transition-all translate-x-0 group-hover:translate-x-0.5 ${
              isDark ? 'text-gray-600 group-hover:text-[#5d6ad3]' : 'text-gray-400 group-hover:text-[#5d6ad3]'
            }`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={`border-b mb-4 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <nav className="flex space-x-6">
            <button 
              onClick={() => setActiveTab('queries')}
              className={`
                pb-3 text-sm font-medium transition-colors relative
                ${activeTab === 'queries' 
                  ? isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'
                  : isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-600'
                }
              `}
            >
              Recent Queries
              {activeTab === 'queries' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d6ad3]" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('dashboards')}
              className={`
                pb-3 text-sm font-medium transition-colors relative
                ${activeTab === 'dashboards' 
                  ? isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'
                  : isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-600'
                }
              `}
            >
              Recent Dashboards
              {activeTab === 'dashboards' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d6ad3]" />
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'queries' ? (
          <div>
            {recentQueries.length === 0 ? (
              <div className={`text-center py-12 rounded-lg border ${
                isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-white'
              }`}>
                <svg className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No queries yet
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create your first query to get started
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentQueries.map((query) => (
                  <button
                    key={query.id}
                    onClick={() => navigate(`/query/${query.id}`, { state: { query } })}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors
                      ${isDark 
                        ? 'hover:bg-[#1c1d1f]' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    <span className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {getQueryDisplayTitle(query)}
                    </span>
                    <span className={`text-xs flex-shrink-0 ml-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formatDate(query.last_executed_at || query.created_at)}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => navigate('/queries')}
                  className={`w-full text-center py-2 text-xs ${isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-600'}`}
                >
                  View all queries →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {recentDashboards.length === 0 ? (
              <div className={`text-center py-12 rounded-lg border ${
                isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-white'
              }`}>
                <svg className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                </svg>
                <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No dashboards yet
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create your first dashboard to get started
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentDashboards.map((dashboard) => (
                  <button
                    key={dashboard.id}
                    onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors
                      ${isDark 
                        ? 'hover:bg-[#1c1d1f]' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    <span className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {dashboard.title}
                    </span>
                    <span className={`text-xs flex-shrink-0 ml-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formatDate(dashboard.updated_at)}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => navigate('/dashboards')}
                  className={`w-full text-center py-2 text-xs ${isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-600'}`}
                >
                  View all dashboards →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

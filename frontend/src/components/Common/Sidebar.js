import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const menuRef = useRef(null);

  // Get user display info
  const userEmail = user?.email || user?.username || 'User';
  const userInitials = userEmail
    .split('@')[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'U';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const QueriesIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const DashboardIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
    </svg>
  );

  const DataIntelligenceIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const ScheduledKpiIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const AdminIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );

  const ChevronIcon = () => (
    <svg className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );

  const HomeIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );

  const menuItems = [
    { id: 'home', label: 'Home', icon: <HomeIcon />, path: '/' },
    { id: 'dashboards', label: 'Dashboards', icon: <DashboardIcon />, path: '/dashboards' },
    { id: 'queries', label: 'Queries', icon: <QueriesIcon />, path: '/queries' }
  ];

  const manageItems = [
    { id: 'scheduled-kpis', label: 'Scheduled KPIs', icon: <ScheduledKpiIcon />, path: '/scheduled-kpis' },
    { id: 'data-intelligence', label: 'Data Intelligence', icon: <DataIntelligenceIcon />, path: '/data-intelligence' },
    { id: 'admin', label: 'Admin', icon: <AdminIcon />, path: '/admin' }
  ];

  const MenuItem = ({ item }) => {
    const isActive = 
      (item.path === '/' && (location.pathname === '/' || location.pathname === '/home')) ||
      (item.path !== '/' && (location.pathname === item.path || location.pathname.startsWith(item.path.replace(/s$/, '/'))));
    
    return (
      <button
        onClick={() => item.path && navigate(item.path)}
        className={`
          w-full flex items-center px-2 py-1.5 text-left rounded-md transition-colors
          ${isActive
            ? isDark 
              ? 'bg-[#1c1d1f] text-white' 
              : 'bg-gray-100 text-gray-900'
            : isDark 
              ? 'text-gray-400 hover:bg-[#1c1d1f] hover:text-gray-200'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }
          ${isCollapsed ? 'justify-center' : ''}
        `}
      >
        <span className={`flex-shrink-0 ${!isCollapsed ? 'mr-2.5' : ''} ${isActive ? (isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]') : ''}`}>
          {item.icon}
        </span>
        {!isCollapsed && (
          <span className="text-[13px] font-medium">{item.label}</span>
        )}
      </button>
    );
  };

  return (
    <div className={`
      h-full flex flex-col transition-all duration-200 ease-out
      ${isCollapsed ? 'w-14' : 'w-52'}
      ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50'}
      border-r ${isDark ? 'border-[#1c1d1f]' : 'border-gray-200'}
    `}>
      {/* Header */}
      <div className={`flex flex-col ${isCollapsed ? 'items-center' : ''} px-3 py-3`}>
        {isCollapsed ? (
          <>
            <button 
              onClick={() => navigate('/')}
              className="hover:opacity-80 transition-opacity"
              title="Go to Home"
            >
              <img 
                src={isDark ? "/logo-light.png" : "/logo-dark.png"} 
                alt="Actyze" 
                className="w-5 h-5 object-contain"
              />
            </button>
            {/* Expand button when collapsed */}
            <button
              onClick={onToggle}
              className={`mt-3 p-1.5 rounded transition-colors ${
                isDark 
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1d1f]' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Expand sidebar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <img 
                src={isDark ? "/logo-light.png" : "/logo-dark.png"} 
                alt="Actyze" 
                className="w-5 h-5 object-contain"
              />
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Actyze
              </span>
            </button>
            <button
              onClick={onToggle}
              className={`p-1 rounded transition-colors ${
                isDark 
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1d1f]' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Collapse sidebar"
            >
              <ChevronIcon />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {/* Main Items */}
        <div className="space-y-0.5">
          {menuItems.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </div>

        {/* Manage Section */}
        <div className="mt-6">
          {!isCollapsed && (
            <div className={`px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              Manage
            </div>
          )}
          <div className="space-y-0.5">
            {manageItems.map((item) => (
              <MenuItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* User Section */}
      <div className={`relative px-2 py-3 pb-4 border-t ${isDark ? 'border-[#1c1d1f]' : 'border-gray-100'}`} ref={menuRef}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-1`}>
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-6 h-6 bg-[#5d6ad3] rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
              {userInitials}
            </div>
            {!isCollapsed && (
              <span className={`text-[13px] font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={userEmail}>
                {userEmail}
              </span>
            )}
          </div>
          
          {!isCollapsed && (
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`p-1.5 rounded-md transition-all duration-200 ${
                showSettingsMenu
                  ? isDark
                    ? 'text-white bg-[#1c1d1f]'
                    : 'text-gray-900 bg-gray-100'
                  : isDark 
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1d1f]' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg 
                className={`w-3.5 h-3.5 transition-transform duration-300 ease-out ${showSettingsMenu ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Settings Dropdown Menu */}
        <div 
          className={`
            absolute bottom-full right-1 mb-2 w-40 rounded-lg shadow-xl border overflow-hidden z-50
            transition-all duration-200 ease-out origin-bottom-right
            ${showSettingsMenu && !isCollapsed 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
            }
            ${isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white border-gray-200 shadow-gray-200/50'}
          `}
        >
          <button
            onClick={() => {
              toggleTheme();
              setShowSettingsMenu(false);
            }}
            className={`
              w-full px-3 py-2.5 text-left text-xs flex items-center space-x-2.5 transition-all duration-150
              ${isDark 
                ? 'text-gray-300 hover:bg-[#1c1d1f] hover:text-white' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              {isDark ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              )}
            </svg>
            <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
          </button>
          
          <div className={`h-px ${isDark ? 'bg-[#2a2b2e]' : 'bg-gray-100'}`}></div>
          
          <button
            onClick={() => {
              setShowSettingsMenu(false);
              logout();
              navigate('/login');
            }}
            className={`
              w-full px-3 py-2.5 text-left text-xs flex items-center space-x-2.5 transition-all duration-150
              ${isDark 
                ? 'text-gray-300 hover:bg-[#1c1d1f] hover:text-white' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

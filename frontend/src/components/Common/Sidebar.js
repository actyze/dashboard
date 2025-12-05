import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Text } from '../ui';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const menuRef = useRef(null);

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
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const DashboardIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const AdminIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );

  const ChevronLeftIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );

  const menuItems = [
    {
      section: 'Work with data',
      items: [
        { id: 'dashboards', label: 'Dashboards', icon: <DashboardIcon />, path: '/dashboards' },
        { id: 'queries', label: 'Queries', icon: <QueriesIcon />, path: '/queries' }
      ]
    },
    {
      section: 'Manage',
      items: [
        { id: 'settings', label: 'Preferences', icon: <SettingsIcon />, path: '/settings' },
        { id: 'admin', label: 'Admin', icon: <AdminIcon />, path: '/admin' }
      ]
    }
  ];

  const MenuItem = ({ item }) => {
    const isActive = location.pathname === item.path || 
                     location.pathname.startsWith(item.path.replace(/s$/, '/'));
    
    return (
      <button
        onClick={() => {
          if (item.path) {
            navigate(item.path);
          }
        }}
        className={`
          w-full flex items-center px-3 py-2.5 text-left rounded-lg transition-all duration-200
          ${isActive
            ? 'bg-blue-600 text-white shadow-sm' 
            : isDark 
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }
          ${isCollapsed ? 'justify-center' : 'justify-start'}
          group
        `}
      >
        <span className={`flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`}>
          {item.icon}
        </span>
        {!isCollapsed && (
          <span className="text-sm font-medium">{item.label}</span>
        )}
      </button>
    );
  };

  const SectionHeader = ({ title, isFirst }) => (
    !isCollapsed && (
      <Text 
        variant="caption" 
        className={`tracking-wide font-medium px-3 ${isFirst ? 'mt-0' : 'mt-5'} mb-2 text-xs ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {title}
      </Text>
    )
  );

  return (
    <div className={`
      h-full flex flex-col transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-64'}
      ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      border-r
    `}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <Text variant="h6" className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Dashboard
            </Text>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark 
              ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {menuItems.map((section, sectionIndex) => (
          <div key={section.section}>
            <SectionHeader title={section.section} isFirst={sectionIndex === 0} />
            <div className={`space-y-1 ${isCollapsed && sectionIndex > 0 ? 'mt-4' : ''}`}>
              {section.items.map((item) => (
                <MenuItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* User Section */}
      <div className={`p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} relative`} ref={menuRef}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              UV
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <Text className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Uddish Verma
                </Text>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`
                p-1.5 rounded-lg transition-colors
                ${isDark 
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }
              `}
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Settings Dropdown Menu */}
        {showSettingsMenu && !isCollapsed && (
          <div className={`
            absolute bottom-full left-3 right-3 mb-2 rounded-lg shadow-lg border overflow-hidden
            ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          `}>
            <button
              onClick={() => {
                toggleTheme();
                setShowSettingsMenu(false);
              }}
              className={`
                w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 transition-colors
                ${isDark 
                  ? 'text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isDark ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                )}
              </svg>
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>
            
            <div className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            
            <button
              onClick={() => {
                setShowSettingsMenu(false);
                navigate('/login');
              }}
              className={`
                w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 transition-colors
                ${isDark 
                  ? 'text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
/**
 * Admin Panel - Simplified
 * Users and License Management
 */

import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import UsersManagement from './UsersManagement';

function Admin() {
  const { isDark } = useTheme();
  const location = useLocation();
  const usersRef = useRef(null);

  const tabs = [
    { name: 'Users', href: '/admin', icon: 'users' },
    { name: 'License', href: '/admin/license', icon: 'key' }
  ];

  const isCurrentTab = (href) => {
    if (href === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(href);
  };

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'users':
        return (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        );
      case 'key':
        return (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      {/* Header with Tabs */}
      <div className={`border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Admin Panel
          </h1>
          {location.pathname === '/admin' && (
            <button
              onClick={() => usersRef.current?.openCreateDialog()}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                isDark 
                  ? 'text-gray-300 hover:bg-[#1c1d1f]' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create User
            </button>
          )}
        </div>
        
        {/* Tabs Navigation */}
        <div className="px-6">
          <nav className="flex space-x-4" aria-label="Admin tabs">
            {tabs.map((tab) => {
              const isCurrent = isCurrentTab(tab.href);
              return (
                <Link
                  key={tab.name}
                  to={tab.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isCurrent
                      ? isDark
                        ? 'border-blue-500 text-blue-400'
                        : 'border-blue-600 text-blue-600'
                      : isDark
                        ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {getIcon(tab.icon)}
                  </svg>
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {location.pathname === '/admin' && <UsersManagement ref={usersRef} />}
      </div>
    </div>
  );
}

export default Admin;

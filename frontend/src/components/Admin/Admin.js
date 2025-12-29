/**
 * Admin Panel - Redesigned to match app styling
 * 3 tabs: Users, Groups, Data Access
 */

import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import UsersManagement from './UsersManagement';
import GroupsManagement from './GroupsManagement';
import DataAccessManagement from './DataAccessManagement';

const tabs = [
  { id: 'users', label: 'Users', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )},
  { id: 'groups', label: 'Groups', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )},
  { id: 'data-access', label: 'Data Access', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )}
];

function Admin() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Admin Panel
        </h1>
      </div>

      {/* Tabs */}
      <div className={`px-6 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative
                ${activeTab === tab.id
                  ? isDark 
                    ? 'text-[#5d6ad3]' 
                    : 'text-[#5d6ad3]'
                  : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.icon}
              {tab.label}
              {/* Active indicator */}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d6ad3]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'users' && <UsersManagement />}
        {activeTab === 'groups' && <GroupsManagement />}
        {activeTab === 'data-access' && <DataAccessManagement />}
      </div>
    </div>
  );
}

export default Admin;

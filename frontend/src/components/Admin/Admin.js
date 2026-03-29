/**
 * Admin Panel
 * User Management
 */

import React, { useRef } from 'react';
import { useLocation } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import UsersManagement from './UsersManagement';

function Admin() {
  const { isDark } = useTheme();
  const location = useLocation();
  const usersRef = useRef(null);

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Admin Panel
          </h1>
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <UsersManagement ref={usersRef} />
      </div>
    </div>
  );
}

export default Admin;

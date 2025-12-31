/**
 * Admin Panel - Simplified
 * Single Users page with inline data access management
 */

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import UsersManagement from './UsersManagement';

function Admin() {
  const { isDark } = useTheme();

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Admin Panel
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <UsersManagement />
      </div>
    </div>
  );
}

export default Admin;

/**
 * Users Management Component - Redesigned
 * Create users, set role (ADMIN/USER), assign to groups, deactivate
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import AdminService from '../../services/AdminService';

function UsersManagement() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'USER'
  });
  const inputRef = useRef(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (openDialog && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [openDialog]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await AdminService.listUsers();
      if (response.success) {
        setUsers(response.users);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'USER'
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await AdminService.createUser(formData);
      if (response.success) {
        setSuccess(`User ${formData.username} created successfully`);
        handleCloseDialog();
        loadUsers();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleSetRole = async (userId, newRole) => {
    try {
      const response = await AdminService.setUserRole(userId, newRole);
      if (response.success) {
        setSuccess(`User role updated to ${newRole}`);
        loadUsers();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeactivate = async (userId, username) => {
    if (window.confirm(`Are you sure you want to deactivate ${username}?`)) {
      try {
        const response = await AdminService.deactivateUser(userId);
        if (response.success) {
          setSuccess(`User ${username} deactivated`);
          loadUsers();
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to deactivate user');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3] mx-auto"></div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Loading users...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Alerts */}
      {(error || success) && (
        <div className="px-6 pt-4">
          {error && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-2 ${
              isDark ? 'bg-red-900/20 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm flex-1">{error}</span>
              <button onClick={() => setError(null)} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {success && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-2 ${
              isDark ? 'bg-green-900/20 border border-green-800 text-green-300' : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm flex-1">{success}</span>
              <button onClick={() => setSuccess(null)} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between`}>
        <h2 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Users ({users.length})
        </h2>
        <button
          onClick={handleOpenDialog}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create User
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-4 py-2 text-xs font-medium border-b sticky top-0 ${
          isDark 
            ? 'text-gray-500 border-[#2a2b2e] bg-[#101012]' 
            : 'text-gray-500 border-gray-200 bg-gray-50'
        }`}>
          <div className="col-span-2">Username</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Full Name</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Groups</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Table Body */}
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              No users found
            </p>
          </div>
        ) : (
          <div>
            {users.map((user) => (
              <div 
                key={user.id}
                className={`
                  grid grid-cols-12 gap-4 py-3 border-b
                  ${isDark 
                    ? 'border-[#1c1d1f]' 
                    : 'border-gray-100'
                  }
                `}
              >
                {/* Username */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {user.username}
                  </span>
                </div>
                
                {/* Email */}
                <div className="col-span-3 flex items-center">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {user.email}
                  </span>
                </div>
                
                {/* Full Name */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {user.full_name || '-'}
                  </span>
                </div>
                
                {/* Role */}
                <div className="col-span-2 flex items-center">
                  <select
                    value={user.role}
                    onChange={(e) => handleSetRole(user.id, e.target.value)}
                    disabled={user.username === 'nexus_admin'}
                    className={`
                      px-2 py-1 text-xs rounded border cursor-pointer
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-gray-300' 
                        : 'bg-white border-gray-200 text-gray-700'
                      }
                      ${user.username === 'nexus_admin' ? 'opacity-50 cursor-not-allowed' : ''}
                      focus:outline-none focus:border-[#5d6ad3] transition-colors
                    `}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="USER">USER</option>
                  </select>
                </div>
                
                {/* Groups */}
                <div className="col-span-2 flex items-center flex-wrap gap-1">
                  {user.groups && user.groups.length > 0 ? (
                    user.groups.map((group, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 text-xs rounded ${
                          isDark 
                            ? 'bg-[#2a2b2e] text-gray-300' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {group}
                      </span>
                    ))
                  ) : (
                    <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      No groups
                    </span>
                  )}
                </div>
                
                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end">
                  <button
                    onClick={() => handleDeactivate(user.id, user.username)}
                    disabled={user.username === 'nexus_admin'}
                    className={`p-1 rounded transition-colors ${
                      user.username === 'nexus_admin'
                        ? 'opacity-30 cursor-not-allowed'
                        : isDark 
                          ? 'text-gray-600 hover:text-red-400 hover:bg-[#2a2b2e]' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                    }`}
                    title="Deactivate user"
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

      {/* Create User Dialog */}
      {openDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleCloseDialog()}
        >
          <div 
            className={`
              w-full max-w-md mx-4 rounded-xl shadow-2xl
              ${isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Create New User
              </h3>
              <button
                onClick={handleCloseDialog}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUser}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Username *
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                    placeholder="Enter password"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                    placeholder="Enter full name (optional)"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border cursor-pointer
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.username || !formData.email || !formData.password}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    bg-[#5d6ad3] text-white
                    ${formData.username && formData.email && formData.password
                      ? 'hover:bg-[#4f5bc4]' 
                      : 'opacity-50 cursor-not-allowed'
                    }
                  `}
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManagement;

/**
 * Groups Management Component - Redesigned
 * Create groups, manage members
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import AdminService from '../../services/AdminService';

function GroupsManagement() {
  const { isDark } = useTheme();
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog state
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openMemberDialog, setOpenMemberDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (openCreateDialog && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [openCreateDialog]);

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

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsResp, usersResp] = await Promise.all([
        AdminService.listGroups(),
        AdminService.listUsers()
      ]);
      
      if (groupsResp.success) {
        setGroups(groupsResp.groups);
      }
      if (usersResp.success) {
        setUsers(usersResp.users);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setFormData({ name: '', description: '' });
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const response = await AdminService.createGroup(formData);
      if (response.success) {
        setSuccess(`Group ${formData.name} created successfully`);
        handleCloseCreateDialog();
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create group');
    }
  };

  const handleOpenMemberDialog = (group) => {
    setSelectedGroup(group);
    setSelectedUserId('');
    setOpenMemberDialog(true);
  };

  const handleCloseMemberDialog = () => {
    setOpenMemberDialog(false);
    setSelectedGroup(null);
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedGroup) return;
    
    try {
      const response = await AdminService.addGroupMember(selectedGroup.id, selectedUserId);
      if (response.success) {
        const user = users.find(u => u.id === selectedUserId);
        setSuccess(`Added ${user?.username} to ${selectedGroup.name}`);
        setSelectedUserId('');
        loadData();
        handleCloseMemberDialog();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (groupId, userId, username) => {
    if (window.confirm(`Remove ${username} from this group?`)) {
      try {
        const response = await AdminService.removeGroupMember(groupId, userId);
        if (response.success) {
          setSuccess(`Removed ${username} from group`);
          loadData();
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to remove member');
      }
    }
  };

  // Get members for a group
  const getGroupMembers = (groupName) => {
    return users.filter(user => user.groups && user.groups.includes(groupName));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3] mx-auto"></div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Loading groups...
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
          Groups ({groups.length})
        </h2>
        <button
          onClick={handleOpenCreateDialog}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group
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
          <div className="col-span-3">Group Name</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-4">Members</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Table Body */}
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              No groups found
            </p>
          </div>
        ) : (
          <div>
            {groups.map((group) => {
              const members = getGroupMembers(group.name);
              return (
                <div 
                  key={group.id}
                  className={`
                    grid grid-cols-12 gap-4 py-3 border-b
                    ${isDark 
                      ? 'border-[#1c1d1f]' 
                      : 'border-gray-100'
                    }
                  `}
                >
                  {/* Group Name */}
                  <div className="col-span-3 flex items-center">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {group.name}
                    </span>
                  </div>
                  
                  {/* Description */}
                  <div className="col-span-4 flex items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {group.description || '-'}
                    </span>
                  </div>
                  
                  {/* Members */}
                  <div className="col-span-4 flex items-center flex-wrap gap-1">
                    {members.length > 0 ? (
                      members.map((member) => (
                        <span
                          key={member.id}
                          className={`
                            inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded
                            ${isDark 
                              ? 'bg-[#2a2b2e] text-gray-300' 
                              : 'bg-gray-100 text-gray-600'
                            }
                          `}
                        >
                          {member.username}
                          <button
                            onClick={() => handleRemoveMember(group.id, member.id, member.username)}
                            className={`hover:text-red-400 transition-colors`}
                            title="Remove member"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        No members
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end">
                    <button
                      onClick={() => handleOpenMemberDialog(group)}
                      className={`
                        flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors
                        ${isDark 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2b2e]' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }
                      `}
                      title="Add member"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      {openCreateDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleCloseCreateDialog()}
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
                Create New Group
              </h3>
              <button
                onClick={handleCloseCreateDialog}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateGroup}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Group Name *
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                    placeholder="Enter group name"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className={`
                      w-full px-3 py-2 text-sm rounded-lg border resize-none
                      ${isDark 
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500 focus:border-[#5d6ad3]' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                    `}
                    placeholder="Enter description (optional)"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={handleCloseCreateDialog}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.name}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    bg-[#5d6ad3] text-white
                    ${formData.name ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                  `}
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      {openMemberDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleCloseMemberDialog()}
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
                Add Member to {selectedGroup?.name}
              </h3>
              <button
                onClick={handleCloseMemberDialog}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Select User
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={`
                  w-full px-3 py-2 text-sm rounded-lg border cursor-pointer
                  ${isDark 
                    ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white focus:border-[#5d6ad3]' 
                    : 'bg-white border-gray-200 text-gray-900 focus:border-[#5d6ad3]'
                  }
                  focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]/20 transition-colors
                `}
              >
                <option value="">Select a user...</option>
                {users
                  .filter(user => !user.groups || !user.groups.includes(selectedGroup?.name))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
              </select>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={handleCloseMemberDialog}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!selectedUserId}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  bg-[#5d6ad3] text-white
                  ${selectedUserId ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                `}
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsManagement;

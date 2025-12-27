/**
 * Simplified Admin Service - matches new backend API
 * 2 roles (ADMIN/USER), group-level data access only
 */

import { apiInstance } from './network';

const AdminService = {
  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================
  
  async listUsers(page = 1, pageSize = 50, search = '') {
    try {
      const response = await apiInstance.get(`/api/admin/users`, {
        params: { page, page_size: pageSize, search }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to list users:', error);
      throw error;
    }
  },
  
  async createUser(userData) {
    try {
      const response = await apiInstance.post(`/api/admin/users`, userData);
      return response.data;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  },
  
  async setUserRole(userId, role) {
    try {
      const response = await apiInstance.put(`/api/admin/users/${userId}/role`, { role });
      return response.data;
    } catch (error) {
      console.error('Failed to set user role:', error);
      throw error;
    }
  },
  
  async deactivateUser(userId) {
    try {
      const response = await apiInstance.delete(`/api/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      throw error;
    }
  },
  
  // ============================================================================
  // GROUP MANAGEMENT
  // ============================================================================
  
  async listGroups() {
    try {
      const response = await apiInstance.get(`/api/admin/groups`);
      return response.data;
    } catch (error) {
      console.error('Failed to list groups:', error);
      throw error;
    }
  },
  
  async createGroup(groupData) {
    try {
      const response = await apiInstance.post(`/api/admin/groups`, groupData);
      return response.data;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  },
  
  async addGroupMember(groupId, userId) {
    try {
      const response = await apiInstance.post(`/api/admin/groups/${groupId}/members`, { user_id: userId });
      return response.data;
    } catch (error) {
      console.error('Failed to add group member:', error);
      throw error;
    }
  },
  
  async removeGroupMember(groupId, userId) {
    try {
      const response = await apiInstance.delete(`/api/admin/groups/${groupId}/members/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to remove group member:', error);
      throw error;
    }
  },
  
  // ============================================================================
  // DATA ACCESS MANAGEMENT (GROUP-LEVEL)
  // ============================================================================
  
  async getGroupDataAccess(groupId) {
    try {
      const response = await apiInstance.get(`/api/admin/groups/${groupId}/access`);
      return response.data;
    } catch (error) {
      console.error('Failed to get group data access:', error);
      throw error;
    }
  },
  
  async addGroupDataAccess(groupId, accessRule) {
    try {
      const response = await apiInstance.post(`/api/admin/groups/${groupId}/access`, accessRule);
      return response.data;
    } catch (error) {
      console.error('Failed to add group data access:', error);
      throw error;
    }
  },
  
  async removeGroupDataAccess(ruleId) {
    try {
      const response = await apiInstance.delete(`/api/admin/groups/access/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to remove group data access:', error);
      throw error;
    }
  },
  
  // ============================================================================
  // ROLES
  // ============================================================================
  
  async listRoles() {
    try {
      const response = await apiInstance.get(`/api/admin/roles`);
      return response.data;
    } catch (error) {
      console.error('Failed to list roles:', error);
      throw error;
    }
  }
};

export default AdminService;


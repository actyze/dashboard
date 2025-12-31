/**
 * Simplified Admin Service - matches new backend API
 * 2 roles (ADMIN/USER), direct user-level data access (no groups)
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
  // USER DATA ACCESS MANAGEMENT (DIRECT USER-LEVEL)
  // ============================================================================
  
  async getUserDataAccess(userId) {
    try {
      const response = await apiInstance.get(`/api/admin/users/${userId}/access`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user data access:', error);
      throw error;
    }
  },
  
  async addUserDataAccess(userId, accessRule) {
    try {
      const response = await apiInstance.post(`/api/admin/users/${userId}/access`, accessRule);
      return response.data;
    } catch (error) {
      console.error('Failed to add user data access:', error);
      throw error;
    }
  },
  
  async removeUserDataAccess(userId, ruleId) {
    try {
      const response = await apiInstance.delete(`/api/admin/users/${userId}/access/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to remove user data access:', error);
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

import { apiInstance } from './network';

/**
 * Dashboard Service
 * Handles all dashboard-related API calls including CRUD operations for dashboards,
 * tiles, and permissions.
 */
export const DashboardService = {
  // ==================== Dashboard CRUD ====================
  
  /**
   * Get all dashboards accessible by the current user
   */
  async getDashboards() {
    try {
      const response = await apiInstance.get('/api/dashboards');
      return {
        success: true,
        dashboards: response.data.dashboards || []
      };
    } catch (error) {
      console.error('Failed to fetch dashboards:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Get a specific dashboard by ID
   */
  async getDashboard(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/dashboards/${dashboardId}`);
      // Backend already returns {success: true, dashboard: {...}}
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Create a new dashboard
   */
  async createDashboard(dashboardData) {
    try {
      const payload = {
        title: dashboardData.title,
        description: dashboardData.description || null,
        configuration: dashboardData.configuration || {},
        is_public: dashboardData.is_public || false,
        is_favorite: dashboardData.is_favorite || false,
        tags: dashboardData.tags || []
      };
      
      const response = await apiInstance.post('/api/dashboards', payload);
      // API returns { success: true, dashboard: {...} }
      return {
        success: response.data.success,
        dashboard: response.data.dashboard
      };
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Update an existing dashboard
   */
  async updateDashboard(dashboardId, updates) {
    try {
      const payload = {
        title: updates.title,
        description: updates.description,
        configuration: updates.configuration,
        is_public: updates.is_public,
        is_anonymous_public: updates.is_anonymous_public,
        is_favorite: updates.is_favorite,
        tags: updates.tags
      };
      
      const response = await apiInstance.put(`/api/dashboards/${dashboardId}`, payload);
      // Backend returns {success: true} only, not the updated dashboard
      return response.data;
    } catch (error) {
      console.error('Failed to update dashboard:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Delete a dashboard
   */
  async deleteDashboard(dashboardId) {
    try {
      await apiInstance.delete(`/api/dashboards/${dashboardId}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  // ==================== Tile CRUD ====================
  
  /**
   * Get all tiles for a dashboard
   */
  async getTiles(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/dashboards/${dashboardId}/tiles`);
      return {
        success: true,
        tiles: response.data.tiles || []
      };
    } catch (error) {
      console.error('Failed to fetch tiles:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Create a new tile in a dashboard
   */
  async createTile(dashboardId, tileData) {
    try {
      const payload = {
        title: tileData.title,
        description: tileData.description || null,
        sql_query: tileData.sql_query,
        nl_query: tileData.nl_query || null,
        chart_type: tileData.chart_type,
        chart_config: tileData.chart_config || {},
        position_x: tileData.position_x || 0,
        position_y: tileData.position_y || 0,
        width: tileData.width || 6,
        height: tileData.height || 4,
        refresh_interval_seconds: tileData.refresh_interval_seconds || null
      };
      
      const response = await apiInstance.post(`/api/dashboards/${dashboardId}/tiles`, payload);
      return {
        success: true,
        tile: response.data
      };
    } catch (error) {
      console.error('Failed to create tile:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Update a tile
   */
  async updateTile(dashboardId, tileId, updates) {
    try {
      const payload = {
        title: updates.title,
        description: updates.description,
        sql_query: updates.sql_query,
        nl_query: updates.nl_query,
        chart_type: updates.chart_type,
        chart_config: updates.chart_config,
        position_x: updates.position_x,
        position_y: updates.position_y,
        width: updates.width,
        height: updates.height,
        refresh_interval_seconds: updates.refresh_interval_seconds
      };
      
      const response = await apiInstance.put(
        `/api/dashboards/${dashboardId}/tiles/${tileId}`, 
        payload
      );
      return {
        success: true,
        tile: response.data
      };
    } catch (error) {
      console.error('Failed to update tile:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Delete a tile
   */
  async deleteTile(dashboardId, tileId) {
    try {
      await apiInstance.delete(`/api/dashboards/${dashboardId}/tiles/${tileId}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete tile:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  // ==================== Permissions ====================
  
  /**
   * Grant permission to a user or group
   */
  async grantPermission(dashboardId, permissionData) {
    try {
      const payload = {
        user_id: permissionData.user_id || null,
        group_id: permissionData.group_id || null,
        can_view: permissionData.can_view !== undefined ? permissionData.can_view : true,
        can_edit: permissionData.can_edit || false,
        can_delete: permissionData.can_delete || false,
        can_share: permissionData.can_share || false,
        expires_at: permissionData.expires_at || null
      };
      
      const response = await apiInstance.post(
        `/api/dashboards/${dashboardId}/permissions`, 
        payload
      );
      return {
        success: true,
        permission: response.data
      };
    } catch (error) {
      console.error('Failed to grant permission:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Revoke permission from a user or group
   */
  async revokePermission(dashboardId, userId, groupId) {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (groupId) params.append('group_id', groupId);
      
      await apiInstance.delete(`/api/dashboards/${dashboardId}/permissions?${params.toString()}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  // ==================== Public Dashboards (No Auth) ====================
  
  /**
   * Get all public dashboards (no authentication required)
   */
  async getPublicDashboards() {
    try {
      const response = await apiInstance.get('/api/public/dashboards');
      return {
        success: true,
        dashboards: response.data.dashboards || []
      };
    } catch (error) {
      console.error('Failed to fetch public dashboards:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Get a specific public dashboard (no authentication required)
   */
  async getPublicDashboard(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/public/dashboards/${dashboardId}`);
      // Backend already returns {success: true, dashboard: {...}}
      return response.data;
    } catch (error) {
      console.error('Failed to fetch public dashboard:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  /**
   * Get tiles for a public dashboard (no authentication required)
   */
  async getPublicDashboardTiles(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/public/dashboards/${dashboardId}/tiles`);
      return {
        success: true,
        tiles: response.data.tiles || []
      };
    } catch (error) {
      console.error('Failed to fetch public dashboard tiles:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  }
};

export default DashboardService;


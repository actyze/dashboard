import { apiInstance } from './network';

export const DashboardService = {
  async getDashboards() {
    try {
      const response = await apiInstance.get('/api/dashboards');
      return {
        success: true,
        dashboards: response.data.dashboards || []
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async getDashboard(dashboardId, options = {}) {
    try {
      const { includeTiles = false } = options;
      const params = includeTiles ? '?include_tiles=true' : '';
      const response = await apiInstance.get(`/api/dashboards/${dashboardId}${params}`);
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

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
      return {
        success: response.data.success,
        dashboard: response.data.dashboard
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

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
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async deleteDashboard(dashboardId) {
    try {
      await apiInstance.delete(`/api/dashboards/${dashboardId}`);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async publishDashboard(dashboardId, versionNotes = null) {
    try {
      const payload = versionNotes ? { version_notes: versionNotes } : {};
      const response = await apiInstance.post(`/api/dashboards/${dashboardId}/publish`, payload);
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async getTiles(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/dashboards/${dashboardId}/tiles`);
      return {
        success: true,
        tiles: response.data.tiles || []
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async getTile(dashboardId, tileId) {
    try {
      const response = await apiInstance.get(`/api/dashboards/${dashboardId}/tiles/${tileId}`);
      return {
        success: true,
        tile: response.data.tile
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async createTile(dashboardId, tileData) {
    try {
      const payload = {
        title: tileData.title,
        description: tileData.description || null,
        sql_query: tileData.sql_query,
        nl_query: tileData.nl_query || null,
        chart_type: tileData.chart_type,
        chart_config: tileData.chart_config || {},
        position_x: tileData.position?.x ?? tileData.position_x ?? 0,
        position_y: tileData.position?.y ?? tileData.position_y ?? 0,
        width: tileData.position?.width ?? tileData.width ?? 6,
        height: tileData.position?.height ?? tileData.height ?? 2,
        refresh_interval_seconds: tileData.refresh_interval_seconds || null
      };
      
      const response = await apiInstance.post(`/api/dashboards/${dashboardId}/tiles`, payload);
      return {
        success: true,
        tile: response.data
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async updateTile(dashboardId, tileId, updates) {
    try {
      const payload = {
        title: updates.title,
        description: updates.description,
        sql_query: updates.sql_query,
        nl_query: updates.nl_query || updates.natural_language_query,
        chart_type: updates.chart_type,
        chart_config: updates.chart_config,
        position_x: updates.position?.x ?? updates.position_x,
        position_y: updates.position?.y ?? updates.position_y,
        width: updates.position?.width ?? updates.width,
        height: updates.position?.height ?? updates.height,
        refresh_interval_seconds: updates.refresh_interval_seconds
      };
      
      const response = await apiInstance.put(
        `/api/dashboards/${dashboardId}/tiles/${tileId}`, 
        payload
      );
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async updateTilePosition(dashboardId, tileId, position) {
    try {
      const payload = {
        position_x: position.x ?? 0,
        position_y: position.y ?? 0,
        width: position.width ?? 6,
        height: position.height ?? 2
      };
      
      const response = await apiInstance.put(
        `/api/dashboards/${dashboardId}/tiles/${tileId}`, 
        payload
      );
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async deleteTile(dashboardId, tileId) {
    try {
      await apiInstance.delete(`/api/dashboards/${dashboardId}/tiles/${tileId}`);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

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
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async revokePermission(dashboardId, userId, groupId) {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (groupId) params.append('group_id', groupId);
      
      await apiInstance.delete(`/api/dashboards/${dashboardId}/permissions?${params.toString()}`);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async getPublicDashboards() {
    try {
      const response = await apiInstance.get('/api/public/dashboards');
      return {
        success: true,
        dashboards: response.data.dashboards || []
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async getPublicDashboard(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/public/dashboards/${dashboardId}`);
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  },

  async getPublicDashboardTiles(dashboardId) {
    try {
      const response = await apiInstance.get(`/api/public/dashboards/${dashboardId}/tiles`);
      return {
        success: true,
        tiles: response.data.tiles || []
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message 
      };
    }
  }
};

export default DashboardService;

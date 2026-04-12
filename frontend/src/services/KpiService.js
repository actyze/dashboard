// SPDX-License-Identifier: AGPL-3.0-only
import { apiInstance } from './network';

export const KpiService = {
  async listKpis() {
    try {
      const response = await apiInstance.get('/kpi');
      return { success: true, kpis: response.data.kpis || [], count: response.data.count };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async getKpi(kpiId) {
    try {
      const response = await apiInstance.get(`/kpi/${kpiId}`);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async createKpi(data) {
    try {
      const response = await apiInstance.post('/kpi', data);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async updateKpi(kpiId, data) {
    try {
      const response = await apiInstance.put(`/kpi/${kpiId}`, data);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async deleteKpi(kpiId) {
    try {
      const response = await apiInstance.delete(`/kpi/${kpiId}`);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async collectKpi(kpiId) {
    try {
      const response = await apiInstance.post(`/kpi/${kpiId}/collect`);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async getValues(kpiId, hours = 24, limit = 100) {
    try {
      const response = await apiInstance.get(`/kpi/${kpiId}/values`, {
        params: { hours, limit },
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async getSummary(kpiId, hours = 24) {
    try {
      const response = await apiInstance.get(`/kpi/${kpiId}/summary`, {
        params: { hours },
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },
};

export default KpiService;

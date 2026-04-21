// SPDX-License-Identifier: AGPL-3.0-only
import { apiInstance } from './network';

export const PredictionService = {
  async getCapabilities() {
    try {
      const response = await apiInstance.get('/predictions/capabilities');
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async analyzeData(data) {
    try {
      const response = await apiInstance.post('/predictions/analyze', data);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async listPipelines() {
    try {
      const response = await apiInstance.get('/predictions/pipelines');
      return { success: true, pipelines: response.data.pipelines || [], count: response.data.count };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async getPipeline(pipelineId) {
    try {
      const response = await apiInstance.get(`/predictions/pipelines/${pipelineId}`);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async createPipeline(data) {
    try {
      const response = await apiInstance.post('/predictions/pipelines', data);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async updatePipeline(pipelineId, data) {
    try {
      const response = await apiInstance.put(`/predictions/pipelines/${pipelineId}`, data);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async deletePipeline(pipelineId) {
    try {
      const response = await apiInstance.delete(`/predictions/pipelines/${pipelineId}`);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async trainPipeline(pipelineId) {
    try {
      const response = await apiInstance.post(`/predictions/pipelines/${pipelineId}/train`);
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async getRuns(pipelineId, limit = 20) {
    try {
      const response = await apiInstance.get(`/predictions/pipelines/${pipelineId}/runs`, {
        params: { limit },
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  async getPredictions(pipelineId, limit = 100) {
    try {
      const response = await apiInstance.get(`/predictions/pipelines/${pipelineId}/predictions`, {
        params: { limit },
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },
};

export default PredictionService;

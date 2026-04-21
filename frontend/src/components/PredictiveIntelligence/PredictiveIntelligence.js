// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { PredictionService } from '../../services/PredictionService';
import PipelineWizard from './PipelineWizard';
import PipelineDetail from './PipelineDetail';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

const STATUS_STYLES = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Pending' },
  training: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Training...' },
  ready: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Ready' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Failed' },
};

const TYPE_ICONS = {
  forecast: '📈',
  classify: '🎯',
  estimate: '🔢',
};

const TYPE_LABELS = {
  forecast: 'Forecast',
  classify: 'Classify',
  estimate: 'Estimate',
};

const PredictiveIntelligence = () => {
  const { isDark } = useTheme();
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [trainingId, setTrainingId] = useState(null);

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    const result = await PredictionService.listPipelines();
    if (result.success) {
      setPipelines(result.pipelines);
      setSelectedPipeline((prev) => {
        if (!prev) return null;
        return result.pipelines.find((p) => p.id === prev.id) || null;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  const handleDelete = async (pipelineId) => {
    if (!window.confirm('Delete this prediction pipeline and all its data? This cannot be undone.')) return;
    const result = await PredictionService.deletePipeline(pipelineId);
    if (result.success) {
      setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
      if (selectedPipeline?.id === pipelineId) setSelectedPipeline(null);
    }
  };

  const handleTrain = async (pipelineId) => {
    setTrainingId(pipelineId);
    await PredictionService.trainPipeline(pipelineId);
    setTrainingId(null);
    // Refresh after a short delay for background task
    setTimeout(loadPipelines, 2000);
  };

  const handleCreated = () => {
    setShowWizard(false);
    loadPipelines();
  };

  if (showWizard) {
    return <PipelineWizard onClose={() => setShowWizard(false)} onCreated={handleCreated} />;
  }

  if (selectedPipeline) {
    return (
      <PipelineDetail
        pipeline={selectedPipeline}
        onBack={() => { setSelectedPipeline(null); loadPipelines(); }}
        onTrain={() => handleTrain(selectedPipeline.id)}
        onDelete={() => handleDelete(selectedPipeline.id)}
        training={trainingId === selectedPipeline.id}
      />
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Predictive Intelligence</h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Create predictions from your KPI data — no ML knowledge required
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 bg-[#5d6ad3] text-white rounded-lg hover:bg-[#4c59c2] transition-colors text-sm font-medium"
          >
            + New Prediction
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5d6ad3]" />
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-4xl">🔮</div>
            <p className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              No predictions yet
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Create your first prediction to forecast, classify, or estimate from your KPI data
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 bg-[#5d6ad3] text-white rounded-lg hover:bg-[#4c59c2] transition-colors text-sm"
            >
              + New Prediction
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelines.map((pipeline) => {
              const status = STATUS_STYLES[pipeline.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={pipeline.id}
                  onClick={() => setSelectedPipeline(pipeline)}
                  className={`rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md ${
                    isDark ? 'bg-[#17181a] border-white/10 hover:border-[#5d6ad3]/50' : 'bg-white border-gray-200 hover:border-[#5d6ad3]/50'
                  }`}
                >
                  {/* Type + Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{TYPE_ICONS[pipeline.prediction_type]}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[pipeline.prediction_type]}
                      </span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="font-medium text-sm mb-1 truncate">{pipeline.name}</h3>

                  {/* Accuracy */}
                  {pipeline.accuracy_display && (
                    <p className={`text-xs mb-3 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      {pipeline.accuracy_display}
                    </p>
                  )}

                  {/* Meta */}
                  <div className={`flex items-center justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span>
                      {pipeline.source_type === 'kpi' ? pipeline.kpi_name || 'KPI' : 'Custom SQL'}
                    </span>
                    <span>
                      {pipeline.last_trained_at
                        ? formatDistanceToNowStrict(parseISO(pipeline.last_trained_at), { addSuffix: true })
                        : 'Not trained'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTrain(pipeline.id); }}
                      disabled={trainingId === pipeline.id}
                      className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                        trainingId === pipeline.id
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-[#5d6ad3]/10 text-[#5d6ad3] hover:bg-[#5d6ad3]/20'
                      }`}
                    >
                      {trainingId === pipeline.id ? 'Training...' : 'Retrain'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(pipeline.id); }}
                      className="text-xs py-1.5 px-3 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictiveIntelligence;

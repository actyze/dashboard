// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { PredictionService } from '../../services/PredictionService';
import { formatDistanceToNowStrict, parseISO, format } from 'date-fns';

const STATUS_COLORS = {
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

const TRIGGER_LABELS = {
  after_kpi_collection: 'Every time new data arrives',
  scheduled: 'On a schedule',
  manual: 'Only when I trigger it',
};

const PipelineDetail = ({ pipeline, onBack, onTrain, onDelete, training }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [showRuns, setShowRuns] = useState(false);
  const [refreshPipeline, setRefreshPipeline] = useState(pipeline);
  const [predictions, setPredictions] = useState(null);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    const result = await PredictionService.getRuns(pipeline.id);
    if (result.success) {
      setRuns(result.runs || []);
    }
    setRunsLoading(false);
  }, [pipeline.id]);

  const loadPipeline = useCallback(async () => {
    const result = await PredictionService.getPipeline(pipeline.id);
    if (result.success) {
      setRefreshPipeline(result);
    }
  }, [pipeline.id]);

  const loadPredictions = useCallback(async () => {
    setPredictionsLoading(true);
    const result = await PredictionService.getPredictions(pipeline.id);
    if (result.success) {
      setPredictions(result);
    }
    setPredictionsLoading(false);
  }, [pipeline.id]);

  useEffect(() => {
    loadRuns();
    loadPipeline();
    loadPredictions();
  }, [loadRuns, loadPipeline, loadPredictions]);

  // Auto-refresh while training
  useEffect(() => {
    if (refreshPipeline.status === 'training') {
      const interval = setInterval(() => {
        loadPipeline();
        loadRuns();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [refreshPipeline.status, loadPipeline, loadRuns]);

  const p = refreshPipeline;
  const metrics = p.accuracy_metrics || {};

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className={`text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              ← Back
            </button>
            <div>
              <h1 className="text-lg font-semibold">{p.name}</h1>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {p.prediction_type === 'forecast' ? '📈 Forecast' : p.prediction_type === 'classify' ? '🎯 Classify' : '🔢 Estimate'}
                {' · '}
                {p.source_type === 'kpi' ? p.kpi_name || 'KPI' : 'Custom SQL'}
                {' · '}
                {p.model_name || p.model_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTrain}
              disabled={training}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                training
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#5d6ad3] text-white hover:bg-[#4c59c2]'
              }`}
            >
              {training ? 'Training...' : 'Retrain Now'}
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Status Card */}
          <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#17181a] border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Status */}
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  p.status === 'ready' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : p.status === 'training' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                  : p.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                }`}>
                  {p.status === 'training' ? 'Training...' : p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                </span>
              </div>

              {/* Last trained */}
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Last Trained</p>
                <p className="text-sm">
                  {p.last_trained_at
                    ? formatDistanceToNowStrict(parseISO(p.last_trained_at), { addSuffix: true })
                    : 'Never'}
                </p>
              </div>

              {/* Trigger */}
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Retraining</p>
                <p className="text-sm">{TRIGGER_LABELS[p.trigger_mode] || p.trigger_mode}</p>
              </div>

              {/* Output table */}
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Output Table</p>
                <p className="text-sm font-mono text-xs">{p.output_table}</p>
              </div>
            </div>
          </div>

          {/* Accuracy Card */}
          {p.accuracy_display && (
            <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#17181a] border-white/10' : 'bg-white border-gray-200'}`}>
              <h3 className="text-sm font-semibold mb-3">Accuracy</h3>
              <p className={`text-lg font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {p.accuracy_display}
              </p>

              {/* Raw metrics in smaller text */}
              <div className="flex flex-wrap gap-4 mt-3">
                {metrics.mape !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>MAPE: </span>
                    <span className="text-xs font-medium">{(metrics.mape * 100).toFixed(1)}%</span>
                  </div>
                )}
                {metrics.mae !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>MAE: </span>
                    <span className="text-xs font-medium">{metrics.mae.toFixed(2)}</span>
                  </div>
                )}
                {metrics.rmse !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>RMSE: </span>
                    <span className="text-xs font-medium">{metrics.rmse.toFixed(2)}</span>
                  </div>
                )}
                {metrics.r2 !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>R²: </span>
                    <span className="text-xs font-medium">{metrics.r2.toFixed(3)}</span>
                  </div>
                )}
                {metrics.f1 !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>F1: </span>
                    <span className="text-xs font-medium">{(metrics.f1 * 100).toFixed(1)}%</span>
                  </div>
                )}
                {metrics.precision !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Precision: </span>
                    <span className="text-xs font-medium">{(metrics.precision * 100).toFixed(1)}%</span>
                  </div>
                )}
                {metrics.recall !== undefined && (
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Recall: </span>
                    <span className="text-xs font-medium">{(metrics.recall * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Card */}
          {p.last_error && (
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-red-900/10 border-red-800/30' : 'bg-red-50 border-red-200'}`}>
              <h3 className="text-sm font-semibold text-red-500 mb-1">Last Error</h3>
              <p className="text-xs text-red-400 font-mono">{p.last_error}</p>
            </div>
          )}

          {/* Configuration */}
          <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#17181a] border-white/10' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold mb-3">Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Target Column</span>
                <p className="font-medium mt-0.5">{p.target_column}</p>
              </div>
              {p.feature_columns?.length > 0 && (
                <div>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Feature Columns</span>
                  <p className="font-medium mt-0.5">{p.feature_columns.join(', ')}</p>
                </div>
              )}
              {p.forecast_horizon && (
                <div>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Forecast Horizon</span>
                  <p className="font-medium mt-0.5">{p.forecast_horizon} days</p>
                </div>
              )}
              <div>
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Model</span>
                <p className="font-medium mt-0.5">{p.model_name || 'Auto-selected'}</p>
              </div>
              {p.source_type === 'sql' && p.source_sql && (
                <div className="col-span-2">
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>SQL Query</span>
                  <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto ${isDark ? 'bg-black/30' : 'bg-gray-50'}`}>
                    {p.source_sql}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Predictions */}
          {p.status === 'ready' && (
            <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#17181a] border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  Predictions
                  {predictions?.count > 0 && <span className={`ml-2 font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>({predictions.count} rows)</span>}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/query/new', {
                      state: {
                        query: {
                          generated_sql: `SELECT *\nFROM postgres.prediction_data."${p.output_table}"\nORDER BY predicted_at DESC`,
                          nl_query: `${p.name} predictions`,
                          query_name: p.name,
                        },
                        fromAssistant: true,
                        autoExecute: true,
                      }
                    })}
                    className="text-xs px-3 py-1.5 rounded-md bg-[#5d6ad3]/10 text-[#5d6ad3] hover:bg-[#5d6ad3]/20 transition-colors font-medium"
                  >
                    Explore in Queries
                  </button>
                  <button
                    onClick={() => navigate('/query/new', {
                      state: {
                        query: {
                          nl_query: `Analyze the ${p.prediction_type} predictions in postgres.prediction_data."${p.output_table}". Group results by key dimensions, identify patterns, and suggest actionable next steps.`,
                          query_name: `${p.name} - Recommendations`,
                        },
                        fromAssistant: true,
                        autoExecute: true,
                      }
                    })}
                    className="text-xs px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors font-medium"
                  >
                    Get Recommendations
                  </button>
                </div>
              </div>

              {predictionsLoading ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3]" />
                </div>
              ) : !predictions || predictions.count === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No prediction data yet. Train the pipeline to generate predictions.
                </p>
              ) : (
                <div className={`rounded-lg border overflow-x-auto ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
                        {predictions.columns.map((col) => (
                          <th key={col.name} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.rows.slice(0, 50).map((row, i) => (
                        <tr key={i} className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                          {predictions.columns.map((col) => {
                            let val = row[col.name];
                            // Format numbers nicely
                            if (typeof val === 'number') {
                              val = col.name.includes('probability') ? `${(val * 100).toFixed(1)}%` : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
                            }
                            return (
                              <td key={col.name} className="px-3 py-1.5 whitespace-nowrap">
                                {val === null ? <span className="text-gray-500 italic">null</span> : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {predictions.count > 50 && (
                    <p className={`text-xs text-center py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Showing 50 of {predictions.count} rows
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Run History */}
          <div className={`rounded-xl border ${isDark ? 'bg-[#17181a] border-white/10' : 'bg-white border-gray-200'}`}>
            <button
              onClick={() => setShowRuns(!showRuns)}
              className="w-full p-4 flex items-center justify-between text-sm font-semibold"
            >
              <span>Run History ({runs.length})</span>
              <span className={`transition-transform ${showRuns ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showRuns && (
              <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                {runsLoading ? (
                  <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
                ) : runs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">No runs yet</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Started</th>
                        <th className="px-4 py-2 text-left">Duration</th>
                        <th className="px-4 py-2 text-left">Rows</th>
                        <th className="px-4 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={run.id} className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                          <td className={`px-4 py-2 font-medium ${STATUS_COLORS[run.status] || ''}`}>
                            {run.status}
                          </td>
                          <td className="px-4 py-2">
                            {run.started_at ? format(parseISO(run.started_at), 'MMM d, HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-2">
                            {run.started_at && run.completed_at
                              ? formatDistanceToNowStrict(parseISO(run.started_at), { unit: 'second' }).replace(' seconds', 's').replace(' second', 's')
                              : run.status === 'running' ? '...' : '—'}
                          </td>
                          <td className="px-4 py-2">{run.rows_predicted || '—'}</td>
                          <td className="px-4 py-2 text-red-400 truncate max-w-[200px]">{run.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineDetail;

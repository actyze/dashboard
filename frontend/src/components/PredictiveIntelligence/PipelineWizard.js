// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { PredictionService } from '../../services/PredictionService';
import { KpiService } from '../../services/KpiService';
import SqlEditor from '../Common/SqlEditor';

const PREDICTION_TYPES = [
  {
    id: 'forecast',
    icon: 'F',
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    title: 'Forecast',
    question: 'What will the value be in the future?',
    examples: 'Revenue, demand, costs, traffic',
  },
  {
    id: 'classify',
    icon: 'C',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    title: 'Classify',
    question: 'Which ones will fall into a group?',
    examples: 'Churn, fraud, conversion, lead scoring',
  },
  {
    id: 'estimate',
    icon: 'E',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    title: 'Estimate',
    question: "What's the expected number?",
    examples: 'Customer lifetime value, scoring, pricing',
  },
  {
    id: 'detect',
    icon: 'D',
    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    title: 'Detect',
    question: 'Which data points are unusual?',
    examples: 'Fraud, equipment failures, unusual transactions',
  },
];

const HORIZON_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const TRIGGER_OPTIONS = [
  { value: 'after_kpi_collection', label: 'Every time new data arrives', description: 'Retrains automatically after each KPI collection' },
  { value: 'scheduled', label: 'On a schedule', description: 'Retrains at a fixed interval' },
  { value: 'manual', label: 'Only when I trigger it', description: 'You decide when to retrain' },
];

const PipelineWizard = ({ onClose, onCreated }) => {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [predictionType, setPredictionType] = useState(null);
  const [capabilities, setCapabilities] = useState({});

  // Step 2 state
  const [sourceType, setSourceType] = useState('kpi');
  const [kpis, setKpis] = useState([]);
  const [selectedKpiId, setSelectedKpiId] = useState('');
  const [sourceSql, setSourceSql] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [featureColumns, setFeatureColumns] = useState([]);
  const [outputColumns, setOutputColumns] = useState([]);
  const [forecastHorizon, setForecastHorizon] = useState(30);
  const [customHorizon, setCustomHorizon] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // Step 3 state
  const [name, setName] = useState('');
  const [triggerMode, setTriggerMode] = useState('after_kpi_collection');
  const [scheduleHours, setScheduleHours] = useState(24);
  const [creating, setCreating] = useState(false);

  // Load capabilities and KPIs
  useEffect(() => {
    PredictionService.getCapabilities().then((res) => {
      if (res.success) setCapabilities(res.prediction_types || {});
    });
    KpiService.listKpis().then((res) => {
      if (res.success) setKpis(res.kpis.filter((k) => k.is_active));
    });
  }, []);

  // Auto-analyze when data source changes
  const runAnalysis = useCallback(async () => {
    if (!predictionType) return;
    if (sourceType === 'kpi' && !selectedKpiId) return;
    if (sourceType === 'sql' && !sourceSql.trim()) return;

    setAnalyzing(true);
    setAnalysisError(null);
    const result = await PredictionService.analyzeData({
      prediction_type: predictionType,
      source_type: sourceType,
      source_kpi_id: sourceType === 'kpi' ? selectedKpiId : undefined,
      source_sql: sourceType === 'sql' ? sourceSql : undefined,
      target_column: targetColumn || undefined,
      forecast_horizon: forecastHorizon,
    });

    if (!result.success) {
      setAnalysis(null);
      setAnalysisError(result.error || 'Failed to analyze data');
      setAnalyzing(false);
      return;
    }

    setAnalysis(result);
    // Auto-set target if recommended
    if (!targetColumn && result.recommended_target) {
      setTargetColumn(result.recommended_target);
    }
    // Auto-set features
    if (result.recommended_features) {
      setFeatureColumns(
        result.recommended_features.filter((f) => f.selected).map((f) => f.name)
      );
    }
    // Auto-detect output columns (ID-like and label columns — not features, not target)
    if (result.columns) {
      const featureNames = (result.recommended_features || []).map((f) => f.name);
      const autoOutput = result.columns
        .filter((c) => {
          const name = c.name.toLowerCase();
          const isTarget = c.name === (targetColumn || result.recommended_target);
          const isFeature = featureNames.includes(c.name);
          const isTimestamp = ['collected_at', 'timestamp', 'created_at', 'updated_at'].includes(name);
          const isIdOrLabel = name.includes('id') || name.includes('name') || name.includes('code') || name.includes('email');
          return !isTarget && !isFeature && !isTimestamp && isIdOrLabel;
        })
        .map((c) => c.name);
      setOutputColumns(autoOutput);
    }
    setAnalyzing(false);
  }, [predictionType, sourceType, selectedKpiId, sourceSql, targetColumn, forecastHorizon]);

  // Auto-generate name
  useEffect(() => {
    if (!predictionType) return;
    const kpiName = kpis.find((k) => k.id === selectedKpiId)?.name || 'Custom';
    const typeLabel = predictionType === 'forecast' ? 'Forecast' : predictionType === 'classify' ? 'Classification' : predictionType === 'detect' ? 'Anomaly Detection' : 'Estimate';
    const suffix = predictionType === 'forecast' ? ` - ${forecastHorizon}d` : '';
    setName(`${kpiName} ${typeLabel}${suffix}`);
  }, [predictionType, selectedKpiId, kpis, forecastHorizon]);

  const handleCreate = async () => {
    setCreating(true);
    const result = await PredictionService.createPipeline({
      name,
      prediction_type: predictionType,
      source_type: sourceType,
      source_kpi_id: sourceType === 'kpi' ? selectedKpiId : undefined,
      source_sql: sourceType === 'sql' ? sourceSql : undefined,
      target_column: targetColumn || undefined,
      feature_columns: featureColumns.length > 0 ? featureColumns : undefined,
      output_columns: outputColumns.length > 0 ? outputColumns : undefined,
      forecast_horizon: predictionType === 'forecast' ? forecastHorizon : undefined,
      trigger_mode: triggerMode,
      schedule_hours: triggerMode === 'scheduled' ? scheduleHours : undefined,
      train_now: true,
    });
    setCreating(false);
    if (result.success) {
      onCreated();
    }
  };

  const canProceedStep2 = analysis && analysis.status !== 'error' && (targetColumn || predictionType === 'detect');
  const cardClass = `rounded-xl border p-4 cursor-pointer transition-all ${isDark ? 'border-white/10 hover:border-[#5d6ad3]/50' : 'border-gray-200 hover:border-[#5d6ad3]/50'}`;
  const selectedCardClass = 'border-[#5d6ad3] ring-2 ring-[#5d6ad3]/30';

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className={`text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              ← Back
            </button>
            <h1 className="text-lg font-semibold">New Prediction</h1>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`w-8 h-1 rounded-full ${s <= step ? 'bg-[#5d6ad3]' : isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">

          {/* Step 1: What do you want to predict? */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">What do you want to predict?</h2>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Choose the type of prediction you need
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PREDICTION_TYPES.map((type) => {
                  const available = capabilities[type.id] !== false;
                  return (
                    <div
                      key={type.id}
                      onClick={() => available && setPredictionType(type.id)}
                      className={`${cardClass} ${predictionType === type.id ? selectedCardClass : ''} ${
                        !available ? 'opacity-40 cursor-not-allowed' : ''
                      } ${isDark ? 'bg-[#17181a]' : 'bg-white'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-2 ${type.color}`}>{type.icon}</div>
                      <h3 className="font-semibold text-sm mb-1">{type.title}</h3>
                      <p className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {type.question}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {type.examples}
                      </p>
                      {!available && (
                        <p className="text-xs text-amber-500 mt-2">Worker not deployed</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setStep(2)}
                  disabled={!predictionType}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                    predictionType
                      ? 'bg-[#5d6ad3] text-white hover:bg-[#4c59c2]'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select your data */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">Select your data</h2>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Choose a data source and what you want to predict
              </p>

              {/* Source type toggle */}
              <div className={`flex rounded-lg p-1 mb-4 ${isDark ? 'bg-[#17181a]' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setSourceType('kpi')}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                    sourceType === 'kpi'
                      ? 'bg-[#5d6ad3] text-white'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Use an existing KPI
                </button>
                <button
                  onClick={() => setSourceType('sql')}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                    sourceType === 'sql'
                      ? 'bg-[#5d6ad3] text-white'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Write a custom query
                </button>
              </div>

              {/* KPI selector */}
              {sourceType === 'kpi' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1">KPI Data Source</label>
                  <select
                    value={selectedKpiId}
                    onChange={(e) => { setSelectedKpiId(e.target.value); setAnalysis(null); }}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isDark ? 'bg-[#17181a] border-white/10 text-white' : 'bg-white border-gray-200'
                    }`}
                  >
                    <option value="">Select a KPI...</option>
                    {kpis.map((kpi) => (
                      <option key={kpi.id} value={kpi.id}>
                        {kpi.name} ({kpi.materialized_table})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SQL editor */}
              {sourceType === 'sql' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1">
                    SQL Query <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(Trino — join any tables)</span>
                  </label>
                  <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <SqlEditor
                      value={sourceSql}
                      onChange={setSourceSql}
                      height="120px"
                    />
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <button
                onClick={runAnalysis}
                disabled={analyzing || (sourceType === 'kpi' && !selectedKpiId) || (sourceType === 'sql' && !sourceSql.trim())}
                className={`w-full py-2 rounded-lg text-sm font-medium mb-4 transition-colors ${
                  analyzing ? 'bg-gray-300 text-gray-500' : 'bg-[#5d6ad3]/10 text-[#5d6ad3] hover:bg-[#5d6ad3]/20'
                }`}
              >
                {analyzing ? 'Analyzing...' : 'Analyze Data'}
              </button>

              {/* Analysis error */}
              {analysisError && (
                <div className={`mb-4 p-3 rounded-lg border overflow-hidden ${
                  isDark ? 'bg-red-900/20 border-red-800/30' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold bg-red-100 text-red-600">!</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-red-500">Analysis failed</p>
                      <p className={`text-xs mt-1 break-words whitespace-pre-wrap ${isDark ? 'text-red-300' : 'text-red-600'}`}>{analysisError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis results */}
              {analysis && (
                <div className="space-y-4">
                  {/* Data Health Card */}
                  <div className={`rounded-lg p-4 border ${
                    analysis.status === 'good'
                      ? isDark ? 'bg-green-900/20 border-green-800/30' : 'bg-green-50 border-green-200'
                      : analysis.status === 'warning'
                      ? isDark ? 'bg-amber-900/20 border-amber-800/30' : 'bg-amber-50 border-amber-200'
                      : isDark ? 'bg-red-900/20 border-red-800/30' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                        analysis.status === 'good' ? 'bg-green-100 text-green-600' : analysis.status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                      }`}>{analysis.status === 'good' ? '\u2713' : analysis.status === 'warning' ? '!' : '\u2717'}</span>
                      <span className="font-medium text-sm">
                        {analysis.status === 'good'
                          ? `Your data looks good — ${analysis.row_count?.toLocaleString()} rows`
                          : analysis.status === 'warning'
                          ? `${analysis.warnings?.length} warning(s)`
                          : 'Cannot proceed'}
                      </span>
                    </div>
                    {analysis.blocking?.map((msg, i) => (
                      <p key={i} className="text-xs text-red-500 mt-1">{msg}</p>
                    ))}
                    {analysis.warnings?.map((msg, i) => (
                      <p key={i} className="text-xs text-amber-500 mt-1">{msg}</p>
                    ))}
                  </div>

                  {/* Target column (not needed for anomaly detection) */}
                  {predictionType !== 'detect' && <div>
                    <label className="block text-xs font-medium mb-1">
                      What do you want to predict?
                    </label>
                    <select
                      value={targetColumn}
                      onChange={(e) => {
                        const newTarget = e.target.value;
                        setTargetColumn(newTarget);
                        // Remove target from feature columns if it was selected
                        setFeatureColumns((prev) => prev.filter((f) => f !== newTarget));
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        isDark ? 'bg-[#17181a] border-white/10 text-white' : 'bg-white border-gray-200'
                      }`}
                    >
                      <option value="">Select column...</option>
                      {analysis.columns?.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                          {col.name === analysis.recommended_target ? ' ← recommended' : ''}
                        </option>
                      ))}
                    </select>
                  </div>}

                  {/* Detect mode info */}
                  {predictionType === 'detect' && (
                    <div className={`rounded-lg p-3 ${isDark ? 'bg-[#17181a]' : 'bg-gray-50'}`}>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Anomaly detection analyzes all numeric columns to find unusual data points. No target column is needed — the model identifies outliers automatically.
                      </p>
                    </div>
                  )}

                  {/* Forecast horizon */}
                  {predictionType === 'forecast' && (
                    <div>
                      <label className="block text-xs font-medium mb-1">How far ahead?</label>
                      <div className="flex gap-2">
                        {HORIZON_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setForecastHorizon(opt.value); setCustomHorizon(false); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              forecastHorizon === opt.value && !customHorizon
                                ? 'bg-[#5d6ad3] text-white'
                                : isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setCustomHorizon(true)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            customHorizon
                              ? 'bg-[#5d6ad3] text-white'
                              : isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                      {customHorizon && (
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={forecastHorizon}
                          onChange={(e) => setForecastHorizon(parseInt(e.target.value) || 30)}
                          className={`mt-2 w-24 px-3 py-1.5 rounded-lg text-sm border ${
                            isDark ? 'bg-[#17181a] border-white/10 text-white' : 'bg-white border-gray-200'
                          }`}
                          placeholder="Days"
                        />
                      )}
                    </div>
                  )}

                  {/* Feature columns (classify/estimate) */}
                  {predictionType !== 'forecast' && analysis.recommended_features?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Which columns should influence the prediction?
                      </label>
                      <div className="space-y-1">
                        {analysis.recommended_features.filter((feat) => feat.name !== targetColumn).map((feat) => (
                          <label key={feat.name} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={featureColumns.includes(feat.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFeatureColumns((prev) => [...prev, feat.name]);
                                } else {
                                  setFeatureColumns((prev) => prev.filter((f) => f !== feat.name));
                                }
                              }}
                              className="rounded"
                            />
                            <span>{feat.name}</span>
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>— {feat.reason}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Output columns (classify/estimate) */}
                  {predictionType !== 'forecast' && analysis.columns?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Which columns should appear in your predictions?
                      </label>
                      <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Select ID or label columns so you can identify each prediction. The prediction result and confidence are always included.
                      </p>
                      <div className="space-y-1">
                        {analysis.columns
                          .filter((c) => c.name !== targetColumn && c.name.toLowerCase() !== 'collected_at')
                          .map((col) => (
                            <label key={col.name} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={outputColumns.includes(col.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setOutputColumns((prev) => [...prev, col.name]);
                                  } else {
                                    setOutputColumns((prev) => prev.filter((c) => c !== col.name));
                                  }
                                }}
                                className="rounded"
                              />
                              <span>{col.name}</span>
                              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>({col.type})</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {analysis.preview_rows?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Data preview</label>
                      <div className={`rounded-lg border overflow-x-auto ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
                              {analysis.columns?.map((col) => (
                                <th key={col.name} className="px-3 py-2 text-left font-medium">
                                  {col.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.preview_rows.slice(0, 5).map((row, i) => (
                              <tr key={i} className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                                {row.map((val, j) => (
                                  <td key={j} className="px-3 py-1.5 truncate max-w-[150px]">
                                    {val === null ? <span className="text-gray-500 italic">null</span> : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(1)} className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                    canProceedStep2
                      ? 'bg-[#5d6ad3] text-white hover:bg-[#4c59c2]'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Create */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">Review & create</h2>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Name your prediction and choose when to retrain
              </p>

              {/* Name */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    isDark ? 'bg-[#17181a] border-white/10 text-white' : 'bg-white border-gray-200'
                  }`}
                />
              </div>

              {/* Summary */}
              <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-[#17181a]' : 'bg-gray-50'}`}>
                <p className="text-sm">
                  {predictionType === 'forecast' && `Forecasting "${targetColumn}" ${forecastHorizon} days ahead`}
                  {predictionType === 'classify' && `Classifying "${targetColumn}"`}
                  {predictionType === 'estimate' && `Estimating "${targetColumn}"`}
                  {predictionType === 'detect' && 'Detecting anomalies across all numeric columns'}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Source: {sourceType === 'kpi' ? kpis.find((k) => k.id === selectedKpiId)?.name : 'Custom SQL'}
                  {analysis?.row_count && ` (${analysis.row_count.toLocaleString()} rows)`}
                </p>
              </div>

              {/* Trigger mode */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-2">When should this retrain?</label>
                <div className="space-y-2">
                  {TRIGGER_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        triggerMode === opt.value
                          ? 'border-[#5d6ad3] bg-[#5d6ad3]/5'
                          : isDark ? 'border-white/10 hover:border-white/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="trigger"
                        checked={triggerMode === opt.value}
                        onChange={() => setTriggerMode(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">{opt.label}</span>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {triggerMode === 'scheduled' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs">Every</span>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={scheduleHours}
                      onChange={(e) => setScheduleHours(parseInt(e.target.value) || 24)}
                      className={`w-20 px-2 py-1 rounded text-sm border ${
                        isDark ? 'bg-[#17181a] border-white/10 text-white' : 'bg-white border-gray-200'
                      }`}
                    />
                    <span className="text-xs">hours</span>
                  </div>
                )}
              </div>

              {/* Data quality summary */}
              {analysis && analysis.status !== 'good' && (
                <div className={`rounded-lg p-3 mb-4 ${isDark ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
                  <p className="text-xs text-amber-500">
                    {analysis.warnings?.length} data quality warning(s) — predictions may be less accurate
                  </p>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(2)} className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ← Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                    creating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#5d6ad3] text-white hover:bg-[#4c59c2]'
                  }`}
                >
                  {creating ? 'Creating...' : 'Create & Train Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineWizard;

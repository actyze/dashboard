// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SavedQuerySidebar, SavedQueryToggle } from '../Common';
import { QueryResults } from '../QueryExplorer';
import { KpiService } from '../../services/KpiService';
import { RestService } from '../../services';
import QueryManagementService from '../../services/QueryManagementService';
import { transformQueryResults } from '../../utils/dataTransformers';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

const INTERVAL_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);

const ScheduledKpis = () => {
  const { isDark } = useTheme();
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedKpiId, setSelectedKpiId] = useState(null);
  const [metricValues, setMetricValues] = useState([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesHours, setValuesHours] = useState(24);
  const [collectingId, setCollectingId] = useState(null);

  // Wrap setSelectedKpi to keep id in sync
  const selectKpi = useCallback((kpi) => {
    setSelectedKpi(kpi);
    setSelectedKpiId(kpi?.id || null);
  }, []);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    const result = await KpiService.listKpis();
    if (result.success) {
      setKpis(result.kpis);
      // Keep selectedKpi in sync with refreshed data
      setSelectedKpi((prev) => {
        if (!prev) return null;
        return result.kpis.find((k) => k.id === prev.id) || null;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  const loadValues = useCallback(async (kpiId, hours = 24) => {
    setValuesLoading(true);
    const result = await KpiService.getValues(kpiId, hours);
    if (result.success) {
      setMetricValues(result.values || []);
    }
    setValuesLoading(false);
  }, []);

  // Only re-fetch values when the selected KPI *id* or time range changes
  useEffect(() => {
    if (selectedKpiId) {
      loadValues(selectedKpiId, valuesHours);
    } else {
      setMetricValues([]);
    }
  }, [selectedKpiId, valuesHours, loadValues]);

  const handleDelete = async (kpiId) => {
    if (!window.confirm('Delete this KPI and all its collected data? This cannot be undone.')) return;
    const result = await KpiService.deleteKpi(kpiId);
    if (result.success) {
      setKpis((prev) => prev.filter((k) => k.id !== kpiId));
      if (selectedKpi?.id === kpiId) selectKpi(null);
    }
  };

  const handleCollect = async (kpiId) => {
    setCollectingId(kpiId);
    await KpiService.collectKpi(kpiId);
    setTimeout(() => {
      setCollectingId(null);
      loadKpis();
      // Only reload values if this KPI is currently selected
      if (selectedKpiId === kpiId) loadValues(kpiId, valuesHours);
    }, 2000);
  };

  const handleToggleActive = async (kpi) => {
    await KpiService.updateKpi(kpi.id, { is_active: !kpi.is_active });
    loadKpis();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const utc = dateString.includes('Z') ? dateString : dateString + 'Z';
      return formatDistanceToNowStrict(parseISO(utc), { addSuffix: true });
    } catch {
      return '-';
    }
  };

  // -----------------------------------------------------------------------
  // CREATE / EDIT MODAL
  // -----------------------------------------------------------------------

  const KpiModal = ({ kpi, onClose, onSaved }) => {
    const [form, setForm] = useState({
      name: kpi?.name || '',
      description: kpi?.description || '',
      sql_query: kpi?.sql_query || '',
      interval_hours: kpi?.interval_hours || 1,
      is_active: kpi?.is_active ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [savedQueries, setSavedQueries] = useState([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [testError, setTestError] = useState(null);
    const [testResults, setTestResults] = useState(null);

    useEffect(() => {
      if (!kpi) {
        QueryManagementService.getQueryHistory({ limit: 20 }).then((res) => {
          if (res.success) setSavedQueries(res.queries || []);
        });
      }
    }, [kpi]);

    const handleSelectQuery = (query) => {
      setForm((prev) => ({
        ...prev,
        name: prev.name || query.query_name || '',
        sql_query: query.generated_sql || '',
      }));
      setShowSidebar(false);
      setTestResults(null);
      setTestError(null);
    };

    const handleTestQuery = async () => {
      if (!form.sql_query.trim()) {
        setTestError('Please enter a SQL query first');
        return;
      }
      setTestLoading(true);
      setTestError(null);
      setTestResults(null);
      try {
        const response = await RestService.executeSql(form.sql_query, 10);
        if (!response.success) {
          setTestError(response.error || 'Query execution failed');
        } else {
          setTestResults(transformQueryResults(response.query_results));
        }
      } catch (err) {
        setTestError(err.message || 'Query execution failed');
      } finally {
        setTestLoading(false);
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      setError(null);

      const result = kpi
        ? await KpiService.updateKpi(kpi.id, form)
        : await KpiService.createKpi(form);

      if (result.success) {
        onSaved();
        onClose();
      } else {
        setError(result.error);
      }
      setSaving(false);
    };

    const sidebarVisible = showSidebar && !kpi && savedQueries.length > 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div
          className={`mx-4 rounded-xl shadow-2xl border flex overflow-hidden max-h-[90vh] transition-all duration-300 ${
            isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white border-gray-200'
          }`}
          style={{ width: sidebarVisible ? '860px' : '640px', maxWidth: '100%' }}
        >
          <SavedQuerySidebar
            queries={savedQueries}
            visible={sidebarVisible}
            onSelect={handleSelectQuery}
          />

          {/* Main Form */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {kpi ? 'Edit KPI' : 'New Scheduled KPI'}
              </h2>
              <div className="flex items-center gap-2">
                {!kpi && (
                  <SavedQueryToggle
                    show={showSidebar}
                    onToggle={() => setShowSidebar(!showSidebar)}
                    hasQueries={savedQueries.length > 0}
                    isDark={isDark}
                  />
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark
                      ? 'bg-[#0a0a0a] border-[#2a2b2e] text-white focus:border-[#5d6ad3]'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-[#5d6ad3]'
                  } focus:outline-none focus:ring-1 focus:ring-[#5d6ad3]`}
                  placeholder="e.g. Daily Active Users"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark
                      ? 'bg-[#0a0a0a] border-[#2a2b2e] text-white focus:border-[#5d6ad3]'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-[#5d6ad3]'
                  } focus:outline-none focus:ring-1 focus:ring-[#5d6ad3]`}
                  placeholder="Brief description of what this KPI measures"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  SQL Query
                </label>
                <textarea
                  required
                  rows={6}
                  value={form.sql_query}
                  onChange={(e) => { setForm({ ...form, sql_query: e.target.value }); setTestResults(null); setTestError(null); }}
                  className={`w-full px-3 py-2 rounded-lg border text-sm font-mono ${
                    isDark
                      ? 'bg-[#0a0a0a] border-[#2a2b2e] text-white focus:border-[#5d6ad3]'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-[#5d6ad3]'
                  } focus:outline-none focus:ring-1 focus:ring-[#5d6ad3]`}
                  placeholder="SELECT COUNT(*) AS value FROM ..."
                />
                <button
                  type="button"
                  onClick={handleTestQuery}
                  disabled={testLoading || !form.sql_query.trim()}
                  className={`mt-2 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    isDark
                      ? 'bg-[#1c1d1f] text-gray-300 hover:bg-[#2a2b2e] disabled:text-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:text-gray-400'
                  } disabled:cursor-not-allowed`}
                >
                  {testLoading ? 'Running...' : 'Test Query'}
                </button>
              </div>

              {/* Test Results */}
              {(testResults || testError || testLoading) && (
                <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                  <div className="max-h-48 overflow-auto">
                    <QueryResults queryData={testResults} loading={testLoading} error={testError} />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Collection Interval
                  </label>
                  <select
                    value={form.interval_hours}
                    onChange={(e) => setForm({ ...form, interval_hours: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-[#0a0a0a] border-[#2a2b2e] text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-1 focus:ring-[#5d6ad3]`}
                  >
                    {INTERVAL_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        Every {h} hour{h > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end pb-1">
                  <label className={`flex items-center gap-2 cursor-pointer text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[#5d6ad3] focus:ring-[#5d6ad3]"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className={`flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 text-sm rounded-lg border ${
                    isDark
                      ? 'border-[#2a2b2e] text-gray-300 hover:bg-[#1c1d1f]'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4c59c2] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : kpi ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // DETAIL PANEL (metric values)
  // -----------------------------------------------------------------------

  const DetailPanel = ({ kpi }) => {
    return (
      <div className={`rounded-xl border ${isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white border-gray-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {kpi.name}
            </h3>
            {kpi.description && (
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{kpi.description}</p>
            )}
          </div>
          <button
            onClick={() => selectKpi(null)}
            className={`p-1.5 rounded-md ${isDark ? 'hover:bg-[#1c1d1f] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Time range selector */}
        <div className={`px-5 py-3 border-b flex items-center gap-2 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Show last</span>
          {[6, 12, 24, 48, 168].map((h) => (
            <button
              key={h}
              onClick={() => setValuesHours(h)}
              className={`px-2 py-1 text-xs rounded ${
                valuesHours === h
                  ? 'bg-[#5d6ad3] text-white'
                  : isDark
                    ? 'text-gray-400 hover:bg-[#1c1d1f]'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {h < 24 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>

        {/* Materialized table */}
        {kpi.materialized_table && (
          <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Queryable Table</p>
            <code className={`text-xs px-2 py-1 rounded font-mono ${
              isDark ? 'bg-[#0a0a0a] text-[#5d6ad3]' : 'bg-gray-50 text-[#5d6ad3]'
            }`}>
              postgres.kpi_data.{kpi.materialized_table}
            </code>
          </div>
        )}

        {/* SQL preview */}
        <div className={`px-5 py-3 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-100'}`}>
          <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>SQL Query</p>
          <pre className={`text-xs p-3 rounded-lg overflow-x-auto font-mono ${
            isDark ? 'bg-[#0a0a0a] text-gray-300' : 'bg-gray-50 text-gray-700'
          }`}>
            {kpi.sql_query}
          </pre>
        </div>

        {/* Values table */}
        <div className="px-5 py-3">
          <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Collected Values ({metricValues.length})
          </p>
          {valuesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#5d6ad3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : metricValues.length === 0 ? (
            <p className={`text-sm py-6 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              No data collected yet. Click "Collect Now" to run the first collection.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    <th className="text-left py-2 px-2 font-medium">Collected At</th>
                    <th className="text-left py-2 px-2 font-medium">Rows</th>
                    <th className="text-left py-2 px-2 font-medium">Exec Time</th>
                    <th className="text-left py-2 px-2 font-medium">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {metricValues.map((v) => (
                    <tr key={v.id} className={`border-t ${isDark ? 'border-[#1c1d1f]' : 'border-gray-100'}`}>
                      <td className={`py-2 px-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {formatDate(v.collected_at)}
                      </td>
                      <td className={`py-2 px-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {v.metadata?.row_count ?? '-'}
                      </td>
                      <td className={`py-2 px-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {v.metadata?.execution_time_ms ? `${Math.round(v.metadata.execution_time_ms)}ms` : '-'}
                      </td>
                      <td className={`py-2 px-2 font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {(() => {
                          const rows = v.value?.rows;
                          if (!rows || rows.length === 0) return '-';
                          const first = rows[0];
                          if (Array.isArray(first) && first.length === 1) return String(first[0]);
                          return JSON.stringify(first).slice(0, 60);
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // STATUS BADGE
  // -----------------------------------------------------------------------

  const StatusBadge = ({ kpi }) => {
    if (!kpi.is_active) {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
        }`}>
          Paused
        </span>
      );
    }
    if (kpi.last_error) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
        Active
      </span>
    );
  };

  // -----------------------------------------------------------------------
  // MAIN RENDER
  // -----------------------------------------------------------------------

  return (
    <div className={`h-full ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Scheduled KPIs
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Define SQL-based KPIs that are collected at regular intervals for aggregation and trending.
            </p>
          </div>
          <button
            onClick={() => { setEditingKpi(null); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4c59c2] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New KPI
          </button>
        </div>

        {/* Content */}
        <div className="flex gap-6">
          {/* KPI list */}
          <div className={`flex-1 ${selectedKpi ? 'max-w-md' : ''}`}>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#5d6ad3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : kpis.length === 0 ? (
              <div className={`rounded-xl border p-12 text-center ${
                isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white border-gray-200'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isDark ? 'bg-[#1c1d1f]' : 'bg-gray-100'
                }`}>
                  <svg className="w-6 h-6 text-[#5d6ad3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  No Scheduled KPIs yet
                </h3>
                <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create your first KPI to start collecting pre-aggregated metrics at regular intervals.
                </p>
                <button
                  onClick={() => { setEditingKpi(null); setShowCreateModal(true); }}
                  className="px-4 py-2 text-sm rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4c59c2]"
                >
                  Create your first KPI
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    onClick={() => selectKpi(kpi)}
                    className={`rounded-xl border p-4 cursor-pointer transition-all ${
                      selectedKpi?.id === kpi.id
                        ? isDark
                          ? 'bg-[#17181a] border-[#5d6ad3]/40'
                          : 'bg-white border-[#5d6ad3]/40 shadow-sm'
                        : isDark
                          ? 'bg-[#17181a] border-[#2a2b2e] hover:border-[#3a3b3e]'
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {kpi.name}
                          </h3>
                          <StatusBadge kpi={kpi} />
                        </div>
                        {kpi.description && (
                          <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {kpi.description}
                          </p>
                        )}
                        <div className={`flex items-center gap-3 mt-2 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          <span>Every {kpi.interval_hours}h</span>
                          <span>Last: {kpi.last_collected_at ? formatDate(kpi.last_collected_at) : 'never'}</span>
                          {kpi.owner_username && <span>by {kpi.owner_username}</span>}
                        </div>
                        {kpi.materialized_table && (
                          <div className={`mt-1 text-xs font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            kpi_data.{kpi.materialized_table}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCollect(kpi.id); }}
                          disabled={collectingId === kpi.id}
                          title="Collect Now"
                          className={`p-1.5 rounded-md transition-colors ${
                            collectingId === kpi.id
                              ? 'animate-spin text-[#5d6ad3]'
                              : isDark
                                ? 'text-gray-500 hover:text-[#5d6ad3] hover:bg-[#1c1d1f]'
                                : 'text-gray-400 hover:text-[#5d6ad3] hover:bg-gray-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(kpi); }}
                          title={kpi.is_active ? 'Pause' : 'Resume'}
                          className={`p-1.5 rounded-md transition-colors ${
                            isDark
                              ? 'text-gray-500 hover:text-yellow-400 hover:bg-[#1c1d1f]'
                              : 'text-gray-400 hover:text-yellow-600 hover:bg-gray-100'
                          }`}
                        >
                          {kpi.is_active ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingKpi(kpi); setShowCreateModal(true); }}
                          title="Edit"
                          className={`p-1.5 rounded-md transition-colors ${
                            isDark
                              ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1d1f]'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(kpi.id); }}
                          title="Delete"
                          className={`p-1.5 rounded-md transition-colors ${
                            isDark
                              ? 'text-gray-500 hover:text-red-400 hover:bg-[#1c1d1f]'
                              : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Error display */}
                    {kpi.last_error && (
                      <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400 truncate">{kpi.last_error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedKpi && (
            <div className="flex-1">
              <DetailPanel kpi={selectedKpi} />
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit modal */}
      {showCreateModal && (
        <KpiModal
          kpi={editingKpi}
          onClose={() => { setShowCreateModal(false); setEditingKpi(null); }}
          onSaved={loadKpis}
        />
      )}
    </div>
  );
};

export default ScheduledKpis;

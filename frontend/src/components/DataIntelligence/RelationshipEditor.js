// SPDX-License-Identifier: AGPL-3.0-only
/**
 * RelationshipEditor — admin UI for viewing, verifying, disabling, and creating
 * semantic table relationships (graph edges used by the query generation pipeline).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import RelationshipService from '../../services/RelationshipService';

// ─── Badge helpers ────────────────────────────────────────────────

const MethodBadge = ({ method, isDark }) => {
  const styles = {
    admin:    isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700',
    mined:    isDark ? 'bg-blue-900/30 text-blue-400'     : 'bg-blue-100 text-blue-700',
    inferred: isDark ? 'bg-gray-700 text-gray-300'        : 'bg-gray-200 text-gray-600',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${styles[method] || styles.inferred}`}>
      {method}
    </span>
  );
};

const ConfidenceBar = ({ value, isDark }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
      <div
        className={`h-full rounded-full ${value >= 0.8 ? 'bg-green-500' : value >= 0.5 ? 'bg-yellow-500' : 'bg-red-400'}`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
    <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{(value * 100).toFixed(0)}%</span>
  </div>
);

// ─── Create modal ─────────────────────────────────────────────────

const CreateRelationshipModal = ({ isDark, onClose, onCreate }) => {
  const [form, setForm] = useState({
    source_catalog: '', source_schema: '', source_table: '',
    target_catalog: '', target_schema: '', target_table: '',
    join_condition: '', relationship_type: '1:N',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.source_table || !form.target_table || !form.join_condition) return;
    setSaving(true);
    try { await onCreate(form); onClose(); }
    catch { /* handled by parent */ }
    finally { setSaving(false); }
  };

  const field = (label, key, placeholder) => (
    <div>
      <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className={`w-full mt-1 px-2.5 py-1.5 text-sm rounded-lg border ${
          isDark ? 'bg-[#0a0a0b] border-[#2a2b2e] text-white' : 'bg-white border-gray-300 text-gray-900'
        } focus:outline-none focus:border-[#5d6ad3]`}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`w-full max-w-lg mx-4 rounded-xl shadow-2xl ${isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Relationship</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#2a2b2e] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Source table (the FK side)</p>
          <div className="grid grid-cols-3 gap-2">
            {field('Catalog', 'source_catalog', 'postgres')}
            {field('Schema', 'source_schema', 'public')}
            {field('Table', 'source_table', 'orders')}
          </div>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Target table (the PK side)</p>
          <div className="grid grid-cols-3 gap-2">
            {field('Catalog', 'target_catalog', 'postgres')}
            {field('Schema', 'target_schema', 'public')}
            {field('Table', 'target_table', 'customers')}
          </div>
          {field('Join condition', 'join_condition', 'orders.customer_id = customers.id')}
          <div>
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Type</label>
            <select
              value={form.relationship_type}
              onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}
              className={`w-full mt-1 px-2.5 py-1.5 text-sm rounded-lg border ${
                isDark ? 'bg-[#0a0a0b] border-[#2a2b2e] text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="1:1">1:1 — One to One</option>
              <option value="1:N">1:N — One to Many</option>
              <option value="N:1">N:1 — Many to One</option>
              <option value="M:N">M:N — Many to Many</option>
            </select>
          </div>
        </div>

        <div className={`flex justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`px-3 py-1.5 text-sm rounded-lg ${isDark ? 'text-gray-400 hover:bg-[#2a2b2e]' : 'text-gray-500 hover:bg-gray-100'}`}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.source_table || !form.target_table || !form.join_condition}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] disabled:opacity-50 transition-colors">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────

function RelationshipEditor() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN') || false;

  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ method: '', catalog: '' });
  const [showDisabled, setShowDisabled] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // id being acted on

  // ─── Data loading ─────────────────────────────────────────────

  const loadRelationships = useCallback(async () => {
    setLoading(true);
    try {
      const result = await RelationshipService.getRelationships({
        catalog: filter.catalog || undefined,
        method: filter.method || undefined,
        includeDisabled: showDisabled,
      });
      setRelationships(result.relationships || []);
    } catch (e) {
      showError('Failed to load relationships');
    } finally {
      setLoading(false);
    }
  }, [filter, showDisabled, showError]);

  useEffect(() => { loadRelationships(); }, [loadRelationships]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleVerify = async (id) => {
    setActionLoading(id);
    try {
      await RelationshipService.verifyRelationship(id);
      showSuccess('Relationship verified');
      loadRelationships();
    } catch { showError('Failed to verify'); }
    finally { setActionLoading(null); }
  };

  const handleDisable = async (id) => {
    setActionLoading(id);
    try {
      await RelationshipService.disableRelationship(id);
      showSuccess('Relationship disabled');
      loadRelationships();
    } catch { showError('Failed to disable'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this relationship permanently?')) return;
    setActionLoading(id);
    try {
      await RelationshipService.deleteRelationship(id);
      showSuccess('Relationship deleted');
      loadRelationships();
    } catch { showError('Failed to delete'); }
    finally { setActionLoading(null); }
  };

  const handleCreate = async (data) => {
    try {
      await RelationshipService.createRelationship(data);
      showSuccess('Relationship created');
      loadRelationships();
    } catch (e) {
      showError(e?.response?.data?.detail || 'Failed to create relationship');
      throw e;
    }
  };

  const handleInfer = async () => {
    try {
      await RelationshipService.triggerInference(filter.catalog || 'postgres');
      showSuccess('Inference started in background');
    } catch { showError('Failed to trigger inference'); }
  };

  const handleMine = async () => {
    try {
      await RelationshipService.triggerMining();
      showSuccess('Query mining started in background');
    } catch { showError('Failed to trigger mining'); }
  };

  // ─── Unique catalogs for filter ───────────────────────────────

  const catalogs = [...new Set(relationships.flatMap(r => [r.source_catalog, r.target_catalog]))].sort();

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-2 px-6 py-3 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        {/* Method filter */}
        <div className="flex items-center gap-1">
          {['', 'inferred', 'mined', 'admin'].map(m => (
            <button key={m} onClick={() => setFilter(f => ({ ...f, method: m }))}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter.method === m
                  ? 'bg-[#5d6ad3] text-white'
                  : isDark ? 'text-gray-400 hover:bg-[#2a2b2e]' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {m || 'All'}
            </button>
          ))}
        </div>

        {/* Catalog filter */}
        {catalogs.length > 0 && (
          <select value={filter.catalog} onChange={e => setFilter(f => ({ ...f, catalog: e.target.value }))}
            className={`px-2 py-1 text-xs rounded-md border ${
              isDark ? 'bg-[#0a0a0b] border-[#2a2b2e] text-gray-300' : 'bg-white border-gray-300 text-gray-600'
            }`}>
            <option value="">All catalogs</option>
            {catalogs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Show disabled toggle */}
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)} className="rounded" />
          Show disabled
        </label>

        <div className="flex-1" />

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={handleInfer} className={`px-2.5 py-1 text-xs rounded-md ${isDark ? 'text-gray-300 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-100'}`}>
              Auto-Infer
            </button>
            <button onClick={handleMine} className={`px-2.5 py-1 text-xs rounded-md ${isDark ? 'text-gray-300 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-100'}`}>
              Mine History
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="px-3 py-1 text-xs font-medium rounded-md bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]">
              + Add
            </button>
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className={`px-6 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {loading ? 'Loading...' : `${relationships.length} relationship${relationships.length !== 1 ? 's' : ''}`}
        {!loading && relationships.length > 0 && (
          <span className="ml-2">
            ({relationships.filter(r => r.is_verified).length} verified,{' '}
            {relationships.filter(r => r.source_method === 'mined').length} mined,{' '}
            {relationships.filter(r => r.source_method === 'inferred').length} inferred)
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className={`text-center py-12 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading relationships...</div>
        ) : relationships.length === 0 ? (
          <div className="text-center py-12">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No relationships found</div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              Click "Auto-Infer" to detect relationships from column naming conventions,
              or "Mine History" to extract JOIN patterns from past queries.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                <th className="text-left py-2 font-medium text-xs">Source</th>
                <th className="text-left py-2 font-medium text-xs">Target</th>
                <th className="text-left py-2 font-medium text-xs">Join Condition</th>
                <th className="text-center py-2 font-medium text-xs w-12">Type</th>
                <th className="text-center py-2 font-medium text-xs w-16">Method</th>
                <th className="text-center py-2 font-medium text-xs w-20">Confidence</th>
                <th className="text-center py-2 font-medium text-xs w-10">
                  <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </th>
                {isAdmin && <th className="text-right py-2 font-medium text-xs w-24">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {relationships.map(rel => (
                <tr key={rel.id}
                  className={`border-t ${
                    rel.is_disabled
                      ? isDark ? 'border-[#2a2b2e] opacity-40' : 'border-gray-100 opacity-40'
                      : isDark ? 'border-[#2a2b2e] hover:bg-[#1a1b1d]' : 'border-gray-100 hover:bg-gray-50'
                  }`}>
                  <td className={`py-2.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{rel.source_catalog}.{rel.source_schema}.</span>
                    <span className="font-medium">{rel.source_table}</span>
                  </td>
                  <td className={`py-2.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{rel.target_catalog}.{rel.target_schema}.</span>
                    <span className="font-medium">{rel.target_table}</span>
                  </td>
                  <td className={`py-2.5 font-mono text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {rel.join_condition}
                  </td>
                  <td className={`py-2.5 text-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {rel.relationship_type}
                  </td>
                  <td className="py-2.5 text-center">
                    <MethodBadge method={rel.source_method} isDark={isDark} />
                  </td>
                  <td className="py-2.5">
                    <ConfidenceBar value={rel.confidence} isDark={isDark} />
                  </td>
                  <td className="py-2.5 text-center">
                    {rel.is_verified && (
                      <svg className="w-4 h-4 mx-auto text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!rel.is_verified && !rel.is_disabled && (
                          <button onClick={() => handleVerify(rel.id)} disabled={actionLoading === rel.id}
                            title="Verify"
                            className={`p-1 rounded ${isDark ? 'hover:bg-[#2a2b2e] text-green-400' : 'hover:bg-gray-100 text-green-600'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                        {!rel.is_disabled && (
                          <button onClick={() => handleDisable(rel.id)} disabled={actionLoading === rel.id}
                            title="Disable"
                            className={`p-1 rounded ${isDark ? 'hover:bg-[#2a2b2e] text-yellow-400' : 'hover:bg-gray-100 text-yellow-600'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          </button>
                        )}
                        <button onClick={() => handleDelete(rel.id)} disabled={actionLoading === rel.id}
                          title="Delete"
                          className={`p-1 rounded ${isDark ? 'hover:bg-[#2a2b2e] text-red-400' : 'hover:bg-gray-100 text-red-500'}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <CreateRelationshipModal isDark={isDark} onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

export default RelationshipEditor;

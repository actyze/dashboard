// SPDX-License-Identifier: AGPL-3.0-only
/**
 * RelationshipEditor — admin UI for viewing, verifying, disabling, and creating
 * semantic table relationships (graph edges used by the query generation pipeline).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import RelationshipService from '../../services/RelationshipService';
import { RestService } from '../../services/RestService';

// ─── Labels & badges ──────────────────────────────────────────────

const METHOD_LABELS = {
  admin: 'Manual',
  mined: 'Observed',
  inferred: 'Suggested',
};

const MethodBadge = ({ method, isDark }) => {
  const neutral = isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${neutral}`}>
      {METHOD_LABELS[method] || method}
    </span>
  );
};

const ConfidenceBar = ({ value, isDark }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
      <div
        className="h-full rounded-full bg-[#5d6ad3]"
        style={{ width: `${Math.round(value * 100)}%`, opacity: 0.3 + 0.7 * value }}
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
  const [databases, setDatabases] = useState([]);
  const [schemaCache, setSchemaCache] = useState({});  // { catalog: [{name}, ...] }
  const [tableCache, setTableCache] = useState({});    // { "catalog.schema": [{name}, ...] }

  // Load databases on mount
  useEffect(() => {
    RestService.getDatabases()
      .then(res => setDatabases(res?.databases || []))
      .catch(() => setDatabases([]));
  }, []);

  // Load schemas when either catalog is selected
  useEffect(() => {
    const catalogs = [form.source_catalog, form.target_catalog].filter(Boolean);
    catalogs.forEach(cat => {
      if (schemaCache[cat]) return;
      RestService.getDatabaseSchemas(cat)
        .then(res => setSchemaCache(prev => ({ ...prev, [cat]: res?.schemas || [] })))
        .catch(() => setSchemaCache(prev => ({ ...prev, [cat]: [] })));
    });
  }, [form.source_catalog, form.target_catalog, schemaCache]);

  // Load tables when either schema is selected
  useEffect(() => {
    const pairs = [
      [form.source_catalog, form.source_schema],
      [form.target_catalog, form.target_schema],
    ].filter(([c, s]) => c && s);
    pairs.forEach(([cat, sch]) => {
      const key = `${cat}.${sch}`;
      if (tableCache[key]) return;
      RestService.getSchemaObjects(cat, sch)
        .then(res => {
          const tables = res?.objects?.tables || [];
          const views = res?.objects?.views || [];
          setTableCache(prev => ({ ...prev, [key]: [...tables, ...views] }));
        })
        .catch(() => setTableCache(prev => ({ ...prev, [key]: [] })));
    });
  }, [form.source_catalog, form.source_schema, form.target_catalog, form.target_schema, tableCache]);

  const handleSubmit = async () => {
    if (!form.source_table || !form.target_table || !form.join_condition) return;
    setSaving(true);
    // Admin-authored rows are trusted by default — create them as verified.
    try { await onCreate({ ...form, is_verified: true }); onClose(); }
    catch { /* handled by parent */ }
    finally { setSaving(false); }
  };

  const inputClass = `w-full mt-1 px-2.5 py-1.5 text-sm rounded-lg border ${
    isDark ? 'bg-[#0a0a0b] border-[#2a2b2e] text-white' : 'bg-white border-gray-300 text-gray-900'
  } focus:outline-none focus:border-[#5d6ad3]`;
  const selectClass = `${inputClass} disabled:opacity-40 disabled:cursor-not-allowed appearance-none bg-no-repeat pr-8`;
  // Inline chevron via background-image so it sits cleanly on the right regardless of width
  const chevronStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='${isDark ? '%239ca3af' : '%236b7280'}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
    backgroundPosition: 'right 0.5rem center',
    backgroundSize: '1rem 1rem',
  };

  const selectField = (label, value, options, onChange, disabled = false, placeholder = 'Select...') => (
    <div>
      <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</label>
      <select value={value} onChange={onChange} disabled={disabled || options.length === 0}
        className={selectClass} style={chevronStyle}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const sourceSchemas = (schemaCache[form.source_catalog] || []).map(s => s.name);
  const sourceTables  = (tableCache[`${form.source_catalog}.${form.source_schema}`] || []).map(t => t.name);
  const targetSchemas = (schemaCache[form.target_catalog] || []).map(s => s.name);
  const targetTables  = (tableCache[`${form.target_catalog}.${form.target_schema}`] || []).map(t => t.name);
  const catalogNames  = databases.map(d => d.name);

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
            {selectField('Catalog', form.source_catalog, catalogNames,
              e => setForm(f => ({ ...f, source_catalog: e.target.value, source_schema: '', source_table: '' })))}
            {selectField('Schema', form.source_schema, sourceSchemas,
              e => setForm(f => ({ ...f, source_schema: e.target.value, source_table: '' })), !form.source_catalog)}
            {selectField('Table', form.source_table, sourceTables,
              e => setForm(f => ({ ...f, source_table: e.target.value })), !form.source_schema)}
          </div>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Target table (the PK side)</p>
          <div className="grid grid-cols-3 gap-2">
            {selectField('Catalog', form.target_catalog, catalogNames,
              e => setForm(f => ({ ...f, target_catalog: e.target.value, target_schema: '', target_table: '' })))}
            {selectField('Schema', form.target_schema, targetSchemas,
              e => setForm(f => ({ ...f, target_schema: e.target.value, target_table: '' })), !form.target_catalog)}
            {selectField('Table', form.target_table, targetTables,
              e => setForm(f => ({ ...f, target_table: e.target.value })), !form.target_schema)}
          </div>
          <div>
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Join condition</label>
            <input
              value={form.join_condition}
              onChange={e => setForm(f => ({ ...f, join_condition: e.target.value }))}
              placeholder="orders.customer_id = customers.id"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Type</label>
              <select
                value={form.relationship_type}
                onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}
                className={selectClass} style={chevronStyle}
              >
                <option value="1:1">1:1 — One to One</option>
                <option value="1:N">1:N — One to Many</option>
                <option value="N:1">N:1 — Many to One</option>
                <option value="M:N">M:N — Many to Many</option>
              </select>
            </div>
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
  const [detectOpen, setDetectOpen] = useState(false);

  const visibleRelationships = useMemo(
    () => (filter.method ? relationships.filter(r => r.source_method === filter.method) : relationships),
    [relationships, filter.method],
  );
  const methodCounts = useMemo(() => ({
    '':       relationships.length,
    inferred: relationships.filter(r => r.source_method === 'inferred').length,
    mined:    relationships.filter(r => r.source_method === 'mined').length,
    admin:    relationships.filter(r => r.source_method === 'admin').length,
  }), [relationships]);

  // ─── Data loading ─────────────────────────────────────────────

  const loadRelationships = useCallback(async () => {
    setLoading(true);
    try {
      const result = await RelationshipService.getRelationships({
        catalog: filter.catalog || undefined,
        includeDisabled: showDisabled,
      });
      setRelationships(result.relationships || []);
    } catch (e) {
      showError('Failed to load relationships');
    } finally {
      setLoading(false);
    }
  }, [filter.catalog, showDisabled, showError]);

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
        {/* Method filter with counts */}
        <div className="flex items-center gap-1">
          {['', 'inferred', 'mined', 'admin'].map(m => {
            const selected = filter.method === m;
            const count = methodCounts[m];
            return (
              <button key={m} onClick={() => setFilter(f => ({ ...f, method: m }))}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  selected
                    ? 'bg-[#5d6ad3] text-white'
                    : isDark ? 'text-gray-400 hover:bg-[#2a2b2e]' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {m ? METHOD_LABELS[m] : 'All'}
                <span className={`ml-1.5 ${selected ? 'text-white/70' : isDark ? 'text-gray-600' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
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

        <div className="flex-1" />

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            {/* Detect dropdown */}
            <div className="relative">
              <button onClick={() => setDetectOpen(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md ${isDark ? 'text-gray-300 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-100'}`}>
                Detect
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {detectOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDetectOpen(false)} />
                  <div className={`absolute right-0 mt-1 w-64 rounded-lg border shadow-lg z-20 ${isDark ? 'bg-[#17181a] border-[#2a2b2e]' : 'bg-white border-gray-200'}`}>
                    <button onClick={() => { handleInfer(); setDetectOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-50'}`}>
                      <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Suggest from column names</div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Detect relationships by naming conventions</div>
                    </button>
                    <button onClick={() => { handleMine(); setDetectOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-50'}`}>
                      <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Learn from query history</div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Extract JOIN patterns from past queries</div>
                    </button>
                    <div className={`border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`} />
                    <label className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer ${isDark ? 'text-gray-300 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)} className="rounded" />
                      Show disabled rows
                    </label>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowCreateModal(true)}
              className="px-3 py-1 text-xs font-medium rounded-md bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]">
              + Add
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className={`text-center py-12 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading relationships...</div>
        ) : relationships.length === 0 ? (
          <div className="text-center py-12">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No relationships yet</div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              Use <span className="font-medium">Detect</span> to find relationships from column names or query history,
              or click <span className="font-medium">+ Add</span> to create one manually.
            </p>
          </div>
        ) : visibleRelationships.length === 0 ? (
          <div className="text-center py-12">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No relationships match this filter</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                <th className="text-left py-2 pr-4 font-medium text-xs">Source</th>
                <th className="text-left py-2 pr-4 font-medium text-xs">Target</th>
                <th className="text-left py-2 pr-4 font-medium text-xs">Join Condition</th>
                <th className="text-left py-2 pr-4 font-medium text-xs whitespace-nowrap">Type</th>
                <th className="text-left py-2 pr-4 font-medium text-xs whitespace-nowrap">Confidence</th>
                {isAdmin && <th className="text-right py-2 font-medium text-xs whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRelationships.map(rel => (
                <tr key={rel.id}
                  className={`border-t ${
                    rel.is_disabled
                      ? isDark ? 'border-[#2a2b2e] opacity-40' : 'border-gray-100 opacity-40'
                      : isDark ? 'border-[#2a2b2e] hover:bg-[#1a1b1d]' : 'border-gray-100 hover:bg-gray-50'
                  }`}>
                  <td className={`py-2.5 pr-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rel.source_table}</span>
                      <MethodBadge method={rel.source_method} isDark={isDark} />
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {rel.source_catalog} · {rel.source_schema}
                    </div>
                  </td>
                  <td className={`py-2.5 pr-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="font-medium">{rel.target_table}</div>
                    <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {rel.target_catalog} · {rel.target_schema}
                    </div>
                  </td>
                  <td className={`py-2.5 pr-4 font-mono text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {rel.join_condition}
                  </td>
                  <td className={`py-2.5 pr-4 text-xs whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    title={{
                      '1:1': 'One to one — each row on the left maps to exactly one row on the right',
                      '1:N': 'One to many — one row on the left maps to many on the right',
                      'N:1': 'Many to one — many rows on the left map to one on the right',
                      'M:N': 'Many to many — rows match in both directions',
                    }[rel.relationship_type] || rel.relationship_type}>
                    {rel.relationship_type}
                  </td>
                  <td className="py-2.5 pr-4">
                    {(rel.is_verified || rel.source_method === 'admin') ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#5d6ad3]" title="Trusted — will be used by the query AI without hedging">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <ConfidenceBar value={rel.confidence} isDark={isDark} />
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!rel.is_verified && rel.source_method !== 'admin' && !rel.is_disabled && (
                          <button onClick={() => handleVerify(rel.id)} disabled={actionLoading === rel.id}
                            title="Verify"
                            className={`p-1 rounded text-[#5d6ad3] ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-100'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                        {!rel.is_disabled && (
                          <button onClick={() => handleDisable(rel.id)} disabled={actionLoading === rel.id}
                            title="Hide from query graph"
                            className={`p-1 rounded ${isDark ? 'hover:bg-[#2a2b2e] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
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

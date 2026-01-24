/**
 * Schema Optimise Component
 * Combined functionality for boosting schemas AND adding descriptions
 * Unified interface for optimizing AI recommendations
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import MetadataService from '../../services/MetadataService';
import PreferencesService from '../../services/PreferencesService';
import { ExclusionService } from '../../services';
import { RestService } from '../../services/RestService';
import { useGetDatabases } from '../../hooks/useRestAPI';
import ConnectorBadge from '../Common/ConnectorBadge';

// Icons
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const EyeSlashIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const DatabaseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const SchemaIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const TableIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" />
  </svg>
);

const ColumnIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BoostIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const DescriptionIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 2 0 01-2 2z" />
  </svg>
);

const HiddenIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

// Status indicators component
const StatusIndicators = ({ hasBoost, hasDescription, boostWeight, isDark }) => {
  if (!hasBoost && !hasDescription) return null;
  
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {hasBoost && (
        <span 
          className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
            isDark ? 'bg-[#2a2b2e] text-gray-300' : 'bg-gray-200 text-gray-700'
          }`}
          title={`Boosted ${boostWeight}x - AI will prioritize this in recommendations`}
        >
          <BoostIcon className="w-3 h-3" />
          {boostWeight?.toFixed(1)}x
        </span>
      )}
      {hasDescription && (
        <span 
          className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
            isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
          }`}
          title="Has description"
        >
          <DescriptionIcon className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};

function SchemaOptimise() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  
  // Check if user is admin
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  
  // Tree state
  const [expandedDatabases, setExpandedDatabases] = useState(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [schemaCache, setSchemaCache] = useState({});
  const [objectsCache, setObjectsCache] = useState({});
  const [tableDetailsCache, setTableDetailsCache] = useState({});
  
  // Data state
  const [descriptions, setDescriptions] = useState({});
  const [preferences, setPreferences] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  
  // Edit panel state
  const [editingNode, setEditingNode] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [editBoostEnabled, setEditBoostEnabled] = useState(false);
  const [editBoostWeight, setEditBoostWeight] = useState(1.5);
  const [editExcludeEnabled, setEditExcludeEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Use the same hook as other components
  const { 
    data: databasesData, 
    isLoading: isDatabasesLoading, 
    error: databasesError 
  } = useGetDatabases();

  useEffect(() => {
    loadDescriptions();
    loadPreferences();
    // Only load exclusions for admins
    if (isAdmin) {
      loadExclusions();
    }
  }, [isAdmin]);

  const loadDescriptions = async () => {
    try {
      const response = await MetadataService.getDescriptions();
      if (response.success) {
        const descMap = {};
        response.descriptions.forEach(desc => {
          const key = buildKey(desc.catalog, desc.schema_name, desc.table_name, desc.column_name);
          descMap[key] = desc;
        });
        setDescriptions(descMap);
      }
    } catch (err) {
      console.error('Failed to load descriptions:', err);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await PreferencesService.getUserPreferences();
      setPreferences(prefs || []);
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const loadExclusions = async () => {
    try {
      const excl = await ExclusionService.getExclusions();
      setExclusions(excl || []);
    } catch (err) {
      // Silently fail for 403 (not admin), log other errors
      if (err.response?.status !== 403) {
        console.error('Failed to load exclusions:', err);
      }
      setExclusions([]);
    }
  };

  const buildKey = (catalog, schema, table, column) => {
    let key = catalog;
    if (schema) key += `.${schema}`;
    if (table) key += `.${table}`;
    if (column) key += `.${column}`;
    return key;
  };

  // Find preference for a given path
  const findPreference = (dbName, schemaName, tableName) => {
    return preferences.find(pref => 
      pref.database_name === dbName &&
      (pref.schema_name || null) === (schemaName || null) &&
      (pref.table_name || null) === (tableName || null)
    );
  };

  // Find exclusion for a given path
  const findExclusion = (catalog, schemaName, tableName) => {
    return exclusions.find(exc => 
      exc.catalog === catalog &&
      (exc.schema_name || null) === (schemaName || null) &&
      (exc.table_name || null) === (tableName || null)
    );
  };

  // Check if a resource is excluded (including parent-level exclusions)
  const isExcluded = (catalog, schemaName, tableName) => {
    // Check database-level exclusion
    if (exclusions.some(exc => exc.catalog === catalog && !exc.schema_name)) {
      return true;
    }
    // Check schema-level exclusion
    if (schemaName && exclusions.some(exc => exc.catalog === catalog && exc.schema_name === schemaName && !exc.table_name)) {
      return true;
    }
    // Check table-level exclusion
    if (tableName && exclusions.some(exc => exc.catalog === catalog && exc.schema_name === schemaName && exc.table_name === tableName)) {
      return true;
    }
    return false;
  };

  // Tree expansion handlers
  const toggleDatabase = async (dbName) => {
    const newExpanded = new Set(expandedDatabases);
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName);
    } else {
      newExpanded.add(dbName);
      if (!schemaCache[dbName]) {
        try {
          const response = await RestService.getDatabaseSchemas(dbName);
          if (response && response.schemas) {
            setSchemaCache(prev => ({ ...prev, [dbName]: response.schemas }));
          }
        } catch (error) {
          console.error(`Failed to fetch schemas for ${dbName}:`, error);
          showError(`Failed to load schemas for ${dbName}`);
        }
      }
    }
    setExpandedDatabases(newExpanded);
  };

  const toggleSchema = async (dbName, schemaName) => {
    const schemaKey = `${dbName}.${schemaName}`;
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaKey)) {
      newExpanded.delete(schemaKey);
    } else {
      newExpanded.add(schemaKey);
      if (!objectsCache[schemaKey]) {
        try {
          const response = await RestService.getSchemaObjects(dbName, schemaName);
          if (response && response.objects && response.objects.tables) {
            setObjectsCache(prev => ({ ...prev, [schemaKey]: response.objects.tables }));
          }
        } catch (error) {
          console.error(`Failed to fetch objects for ${schemaKey}:`, error);
          showError(`Failed to load tables for ${schemaName}`);
        }
      }
    }
    setExpandedSchemas(newExpanded);
  };

  const toggleTable = async (dbName, schemaName, tableName) => {
    const tableKey = `${dbName}.${schemaName}.${tableName}`;
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableKey)) {
      newExpanded.delete(tableKey);
    } else {
      newExpanded.add(tableKey);
      if (!tableDetailsCache[tableKey]) {
        try {
          const response = await RestService.getTableDetails(dbName, schemaName, tableName);
          if (response) {
            setTableDetailsCache(prev => ({ ...prev, [tableKey]: response }));
          }
        } catch (error) {
          console.error(`Failed to fetch table details for ${tableKey}:`, error);
          showError(`Failed to load columns for ${tableName}`);
        }
      }
    }
    setExpandedTables(newExpanded);
  };

  // Open edit panel for a node
  const handleOpenEditPanel = (catalog, schema, table, column) => {
    const key = buildKey(catalog, schema, table, column);
    const existingDesc = descriptions[key];
    const existingPref = column ? null : findPreference(catalog, schema, table); // No boost for columns
    const existingExcl = column ? null : findExclusion(catalog, schema, table); // No exclusion for columns
    
    setEditingNode({ 
      catalog, 
      schema, 
      table, 
      column, 
      key,
      exclusion: existingExcl
    });
    setEditDescription(existingDesc?.description || '');
    setEditBoostEnabled(!!existingPref);
    setEditBoostWeight(existingPref?.boost_weight || 1.5);
    setEditExcludeEnabled(!!existingExcl);
  };

  // Save description, boost preference, and exclusion state
  const handleSave = async () => {
    if (!editingNode) return;
    setSaving(true);

    const { catalog, schema, table, column, key, exclusion } = editingNode;
    const existingDesc = descriptions[key];
    const existingPref = column ? null : findPreference(catalog, schema, table);

    try {
      // Handle description
      if (editDescription.trim()) {
        if (existingDesc) {
          await MetadataService.updateDescription(existingDesc.id, editDescription);
        } else {
          await MetadataService.addDescription({
            catalog,
            schema_name: schema || null,
            table_name: table || null,
            column_name: column || null,
            description: editDescription
          });
        }
      } else if (existingDesc) {
        await MetadataService.deleteDescription(existingDesc.id);
      }

      // Handle boost preference (only for non-columns)
      if (!column) {
        if (editBoostEnabled) {
          if (existingPref) {
            // Update existing preference boost weight
            await PreferencesService.updatePreferenceBoost(existingPref.id, editBoostWeight);
          } else {
            // Create new preference
            await PreferencesService.addUserPreference({
              catalog: null,
              database_name: catalog,
              schema_name: schema || null,
              table_name: table || null,
              boost_weight: editBoostWeight
            });
          }
        } else if (existingPref) {
          // Remove boost
          await PreferencesService.deleteUserPreference(existingPref.id);
        }

        // Handle exclusion (visibility) - only for non-columns
        if (editExcludeEnabled && !exclusion) {
          // User wants to hide, and it's not already hidden
          try {
            await ExclusionService.addExclusion({
              catalog,
              schema_name: schema || null,
              table_name: table || null,
              reason: null
            });
          } catch (addErr) {
            // If already excluded, reload exclusions and show info message
            if (addErr.response?.data?.detail?.includes('already excluded')) {
              await loadExclusions();
              showError('This resource is already hidden. The exclusion list has been refreshed.');
              return;
            }
            throw addErr; // Re-throw other errors
          }
        } else if (!editExcludeEnabled && exclusion) {
          // User wants to show, and it's currently hidden
          await ExclusionService.removeExclusion(exclusion.id);
        }
      }

      showSuccess('Changes saved successfully');
      await Promise.all([loadDescriptions(), loadPreferences(), loadExclusions()]);
      setEditingNode(null);
    } catch (err) {
      console.error('Failed to save:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save changes';
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Render functions
  const renderColumn = (column) => {
    return (
      <div key={column.name} className="ml-0">
        <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          <div className="w-4 flex-shrink-0" />
          <span className="flex-shrink-0">
            <ColumnIcon />
          </span>
          <span className="flex-1 min-w-0 text-sm">
            {column.name}
            <span className={`ml-2 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              {column.type}
            </span>
          </span>
        </div>
      </div>
    );
  };

  const renderTable = (table, dbName, schemaName) => {
    const tableKey = `${dbName}.${schemaName}.${table.name}`;
    const isExpanded = expandedTables.has(tableKey);
    const nodeKey = buildKey(dbName, schemaName, table.name, null);
    const hasDescription = descriptions[nodeKey];
    const preference = findPreference(dbName, schemaName, table.name);
    const tableDetails = tableDetailsCache[tableKey];
    const isExcluded = !!findExclusion(dbName, schemaName, table.name);

    // For non-admin users, hide excluded tables entirely
    if (isExcluded && !isAdmin) {
      return null;
    }

    return (
      <div key={table.name} className={`ml-0 ${isExcluded ? 'opacity-50' : ''}`}>
        <div 
          className={`flex items-center gap-2 px-3 py-2 group ${
            isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
          }`}
        >
          <button
            onClick={() => toggleTable(dbName, schemaName, table.name)}
            className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>
            <TableIcon />
          </span>
          <span 
            className={`flex-1 min-w-0 cursor-pointer ${isDark ? 'text-white' : 'text-gray-900'}`}
            onClick={() => handleOpenEditPanel(dbName, schemaName, table.name, null)}
          >
            {table.name}
            {table.column_count > 0 && (
              <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {table.column_count} cols
              </span>
            )}
          </span>
          {isExcluded && isAdmin && (
            <span 
              className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
                isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
              }`}
              title="Hidden from regular users"
            >
              <EyeSlashIcon />
              Hidden
            </span>
          )}
          <StatusIndicators 
            hasBoost={!!preference}
            hasDescription={!!hasDescription}
            boostWeight={preference?.boost_weight}
            isDark={isDark}
          />
          <button
            onClick={() => handleOpenEditPanel(dbName, schemaName, table.name, null)}
            className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity ${
              isDark ? 'text-gray-400 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Edit
          </button>
        </div>

        {isExpanded && tableDetails && tableDetails.columns && (
          <div className="ml-4">
            {tableDetails.columns.map(col => renderColumn(col))}
          </div>
        )}
      </div>
    );
  };

  const renderSchema = (schema, dbName) => {
    const schemaKey = `${dbName}.${schema.name}`;
    const isExpanded = expandedSchemas.has(schemaKey);
    const nodeKey = buildKey(dbName, schema.name, null, null);
    const hasDescription = descriptions[nodeKey];
    const preference = findPreference(dbName, schema.name, null);
    const objects = objectsCache[schemaKey];
    const isExcluded = !!findExclusion(dbName, schema.name, null);

    // For non-admin users, hide excluded schemas entirely
    if (isExcluded && !isAdmin) {
      return null;
    }

    return (
      <div key={schema.name} className={`ml-0 ${isExcluded ? 'opacity-50' : ''}`}>
        <div 
          className={`flex items-center gap-2 px-3 py-2 group ${
            isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
          }`}
        >
          <button
            onClick={() => toggleSchema(dbName, schema.name)}
            className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          <span className={`${isDark ? 'text-purple-400' : 'text-purple-600'} flex-shrink-0`}>
            <SchemaIcon />
          </span>
          <span 
            className={`flex-1 min-w-0 cursor-pointer ${isDark ? 'text-white' : 'text-gray-900'}`}
            onClick={() => handleOpenEditPanel(dbName, schema.name, null, null)}
          >
            {schema.name}
            {schema.table_count > 0 && (
              <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {schema.table_count} tables
              </span>
            )}
          </span>
          {isExcluded && isAdmin && (
            <span 
              className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
                isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
              }`}
              title="Hidden from regular users"
            >
              <EyeSlashIcon />
              Hidden
            </span>
          )}
          <StatusIndicators 
            hasBoost={!!preference}
            hasDescription={!!hasDescription}
            boostWeight={preference?.boost_weight}
            isDark={isDark}
          />
          <button
            onClick={() => handleOpenEditPanel(dbName, schema.name, null, null)}
            className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity ${
              isDark ? 'text-gray-400 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Edit
          </button>
        </div>

        {isExpanded && objects && (
          <div className="ml-4">
            {objects.map(obj => renderTable(obj, dbName, schema.name))}
          </div>
        )}
      </div>
    );
  };

  const renderDatabase = (db) => {
    const isExpanded = expandedDatabases.has(db.name);
    const schemas = schemaCache[db.name];

    return (
      <div key={db.name} className="ml-0">
        <div 
          className={`flex items-center gap-2 px-3 py-2 ${
            isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
          }`}
        >
          <button
            onClick={() => toggleDatabase(db.name)}
            className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          <span className={`${isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'} flex-shrink-0`}>
            <DatabaseIcon />
          </span>
          <span 
            className={`flex-1 font-medium min-w-0 ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}
          >
            <span>{db.name}</span>
            {db.connector_type && db.connector_type !== 'unknown' && (
              <ConnectorBadge connector_type={db.connector_type} size="sm" />
            )}
            {db.schema_count > 0 && (
              <span className={`text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {db.schema_count} schemas
              </span>
            )}
          </span>
        </div>

        {isExpanded && schemas && (
          <div className="ml-4">
            {schemas.map(s => renderSchema(s, db.name))}
          </div>
        )}
      </div>
    );
  };

  const getNodeTypeName = () => {
    if (!editingNode) return '';
    if (editingNode.column) return 'Column';
    if (editingNode.table) return 'Table';
    if (editingNode.schema) return 'Schema';
    return 'Database';
  };

  const getNodePath = () => {
    if (!editingNode) return '';
    const parts = [editingNode.catalog];
    if (editingNode.schema) parts.push(editingNode.schema);
    if (editingNode.table) parts.push(editingNode.table);
    if (editingNode.column) parts.push(editingNode.column);
    return parts.join(' › ');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${
        isDark ? 'border-[#2a2b2e]' : 'border-gray-200'
      }`}>
        <div>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Click on any schema or table to add descriptions, boost priority, or hide from AI
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                Global
              </span>
              = Applies to all users
            </span>
            <span className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                User-level
              </span>
              = Only affects you
            </span>
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isDatabasesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#5d6ad3]"></div>
          </div>
        ) : databasesError ? (
          <div className={`text-center py-8 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            Failed to load databases: {databasesError}
          </div>
        ) : !databasesData?.databases || databasesData.databases.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            No databases found
          </div>
        ) : (
          <div className={`border rounded-lg ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
            {databasesData.databases.map(db => renderDatabase(db))}
          </div>
        )}
      </div>

      {/* Edit Panel Modal */}
      {editingNode && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setEditingNode(null)}
        >
          <div 
            className={`w-full max-w-lg mx-4 rounded-xl shadow-2xl ${
              isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Optimise {getNodeTypeName()}
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {getNodePath()}
                </p>
              </div>
              <button
                onClick={() => setEditingNode(null)}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#2a2b2e] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-5 py-4 space-y-5">
              {/* Description Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </label>
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                    Global
                  </span>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add a description to help AI understand this data better..."
                  rows={3}
                  className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-[#0a0a0b] border-[#2a2b2e] text-white placeholder-gray-600 focus:border-[#5d6ad3]'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#5d6ad3]'
                  } focus:outline-none focus:ring-1 focus:ring-[#5d6ad3]`}
                />
                <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  Descriptions help AI understand what this data represents and when to use it. <strong>Visible to all users.</strong>
                </p>
              </div>

              {/* Boost Section - Only show for non-columns */}
              {!editingNode.column && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-[#0a0a0b] border border-[#2a2b2e]' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BoostIcon className={`w-4 h-4 ${editBoostEnabled ? (isDark ? 'text-white' : 'text-gray-700') : isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Priority Boost
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                        User-level
                      </span>
                    </div>
                    <button
                      onClick={() => setEditBoostEnabled(!editBoostEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                        editBoostEnabled 
                          ? 'bg-[#5d6ad3]' 
                          : isDark ? 'bg-[#3a3b3e]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          editBoostEnabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    When enabled, AI will <strong>prioritize this {getNodeTypeName().toLowerCase()}</strong> when generating SQL queries. 
                    Use this for frequently used or important data sources. <strong>Only affects your recommendations.</strong>
                  </p>

                  {editBoostEnabled && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          Boost strength
                        </span>
                        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {editBoostWeight.toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.1"
                        value={editBoostWeight}
                        onChange={(e) => setEditBoostWeight(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-[#5d6ad3]"
                      />
                      <div className="flex justify-between text-xs mt-1">
                        <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>Low (1.0x)</span>
                        <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>High (3.0x)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hide/Show Section - Only show for non-columns and admins */}
              {!editingNode.column && isAdmin && (
                <div className={`p-4 rounded-lg border ${
                  editExcludeEnabled 
                    ? (isDark ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-200')
                    : (isDark ? 'bg-[#0a0a0b] border-[#2a2b2e]' : 'bg-gray-50 border border-gray-200')
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HiddenIcon className={`w-4 h-4 ${editExcludeEnabled ? 'text-red-500' : (isDark ? 'text-gray-400' : 'text-gray-600')}`} />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Visibility
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                        Global
                      </span>
                    </div>
                    <button
                      onClick={() => setEditExcludeEnabled(!editExcludeEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                        editExcludeEnabled 
                          ? 'bg-red-600' 
                          : isDark ? 'bg-[#2a2b2e]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          editExcludeEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {editExcludeEnabled ? (
                      <>
                        This {getNodeTypeName().toLowerCase()} will be <strong>hidden from all users</strong>. 
                        It won't appear in AI recommendations or schema suggestions.
                      </>
                    ) : (
                      <>
                        Hide this {getNodeTypeName().toLowerCase()} from AI recommendations <strong>for all users</strong>. 
                        Useful for removing test data, deprecated tables, or sensitive information.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <button
                onClick={() => setEditingNode(null)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark ? 'text-gray-400 hover:bg-[#2a2b2e]' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  saving 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#5d6ad3] hover:bg-[#4f5bc4]'
                } text-white`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchemaOptimise;


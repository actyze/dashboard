/**
 * Metadata Catalog Component
 * Organization-level metadata management with drill-down view
 * Follows same pattern as DatabaseSchemaPanel and DataAccessManagement
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import MetadataService from '../../services/MetadataService';
import { RestService } from '../../services/RestService';
import { ExclusionService } from '../../services';
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

const InfoIcon = ({ description, isDark }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      className="relative cursor-help flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg 
        className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      {/* Tooltip - positioned to the left of the icon */}
      {showTooltip && (
        <div className={`absolute right-0 top-full mt-1 z-50 w-72 p-3 rounded-lg shadow-xl border ${
          isDark 
            ? 'bg-gray-800 border-gray-700 text-gray-200' 
            : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Description:</div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{description}</div>
          {/* Arrow pointing up */}
          <div className={`absolute right-2 -top-1 w-2 h-2 rotate-45 ${
            isDark ? 'bg-gray-800 border-l border-t border-gray-700' : 'bg-white border-l border-t border-gray-200'
          }`}></div>
        </div>
      )}
    </div>
  );
};

function MetadataCatalog() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  
  // Check if user is admin
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  
  // State - following DatabaseSchemaPanel pattern
  const [expandedDatabases, setExpandedDatabases] = useState(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [schemaCache, setSchemaCache] = useState({});
  const [objectsCache, setObjectsCache] = useState({});
  const [tableDetailsCache, setTableDetailsCache] = useState({});
  const [descriptions, setDescriptions] = useState({});
  const [exclusions, setExclusions] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [editDescription, setEditDescription] = useState('');

  // Use the same hook as DatabaseSchemaPanel
  const { 
    data: databasesData, 
    isLoading: isDatabasesLoading, 
    error: databasesError 
  } = useGetDatabases();

  useEffect(() => {
    loadDescriptions();
    // Only load exclusions for admins
    if (isAdmin) {
      loadExclusions();
    }
  }, [isAdmin]);

  const loadDescriptions = async () => {
    try {
      const response = await MetadataService.getDescriptions();
      if (response.success) {
        // Build description lookup map
        const descMap = {};
        response.descriptions.forEach(desc => {
          const key = buildDescriptionKey(
            desc.catalog,
            desc.schema_name,
            desc.table_name,
            desc.column_name
          );
          descMap[key] = desc;
        });
        setDescriptions(descMap);
      }
    } catch (err) {
      console.error('Failed to load descriptions:', err);
    }
  };

  const loadExclusions = async () => {
    try {
      const response = await ExclusionService.getExclusions();
      if (response && Array.isArray(response)) {
        setExclusions(response);
      }
    } catch (err) {
      console.error('Failed to load exclusions:', err);
    }
  };

  const findExclusion = (catalog, schema, table) => {
    return exclusions.find(excl => {
      const catalogMatch = excl.catalog === catalog;
      const schemaMatch = !excl.schema_name || excl.schema_name === schema;
      const tableMatch = !excl.table_name || excl.table_name === table;
      return catalogMatch && schemaMatch && tableMatch;
    });
  };

  const buildDescriptionKey = (catalog, schema, table, column) => {
    let key = catalog;
    if (schema) key += `.${schema}`;
    if (table) key += `.${table}`;
    if (column) key += `.${column}`;
    return key;
  };

  // Following DatabaseSchemaPanel pattern for schema loading
  const toggleDatabase = async (dbName) => {
    const newExpanded = new Set(expandedDatabases);
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName);
    } else {
      newExpanded.add(dbName);
      // Fetch schemas for this database if not already cached
      if (!schemaCache[dbName]) {
        try {
          const response = await RestService.getDatabaseSchemas(dbName);
          if (response && response.schemas) {
            setSchemaCache(prev => ({
              ...prev,
              [dbName]: response.schemas
            }));
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
      // Fetch objects for this schema if not already cached
      if (!objectsCache[schemaKey]) {
        try {
          const response = await RestService.getSchemaObjects(dbName, schemaName);
          if (response && response.objects && response.objects.tables) {
            setObjectsCache(prev => ({
              ...prev,
              [schemaKey]: response.objects.tables  // Use tables array, not objects object
            }));
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
      // Fetch table details if not already cached
      if (!tableDetailsCache[tableKey]) {
        try {
          const response = await RestService.getTableDetails(dbName, schemaName, tableName);
          if (response) {
            setTableDetailsCache(prev => ({
              ...prev,
              [tableKey]: response
            }));
          }
        } catch (error) {
          console.error(`Failed to fetch table details for ${tableKey}:`, error);
          showError(`Failed to load columns for ${tableName}`);
        }
      }
    }
    setExpandedTables(newExpanded);
  };

  const handleAddDescription = (catalog, schema, table, column) => {
    const key = buildDescriptionKey(catalog, schema, table, column);
    const existing = descriptions[key];
    
    setEditingNode({ catalog, schema, table, column, key });
    setEditDescription(existing?.description || '');
  };

  const handleSaveDescription = async () => {
    if (!editingNode) return;

    const existing = descriptions[editingNode.key];
    
    // If description is empty and it's an existing description, delete it
    if (!editDescription.trim() && existing) {
      if (!window.confirm('Empty description will delete the existing one. Continue?')) {
        return;
      }
      try {
        await MetadataService.deleteDescription(existing.id);
        showSuccess('Description deleted successfully');
        await loadDescriptions();
        setEditingNode(null);
        setEditDescription('');
      } catch (err) {
        console.error('Failed to delete description:', err);
        showError(err.response?.data?.detail || 'Failed to delete description');
      }
      return;
    }

    // If description is empty and it's a new one, show error
    if (!editDescription.trim()) {
      showError('Please enter a description');
      return;
    }

    try {
      if (existing) {
        // Update existing
        await MetadataService.updateDescription(existing.id, editDescription);
        showSuccess('Description updated successfully');
      } else {
        // Add new
        await MetadataService.addDescription({
          catalog: editingNode.catalog,
          schema_name: editingNode.schema || null,
          table_name: editingNode.table || null,
          column_name: editingNode.column || null,
          description: editDescription
        });
        showSuccess('Description added successfully');
      }

      // Reload descriptions
      await loadDescriptions();
      setEditingNode(null);
      setEditDescription('');
    } catch (err) {
      console.error('Failed to save description:', err);
      showError(err.response?.data?.detail || 'Failed to save description');
    }
  };

  const handleDeleteDescription = async (descriptionKey) => {
    const desc = descriptions[descriptionKey];
    if (!desc) return;

    if (!window.confirm('Are you sure you want to delete this description?')) {
      return;
    }

    try {
      await MetadataService.deleteDescription(desc.id);
      showSuccess('Description deleted successfully');
      await loadDescriptions();
      // Close the dialog after deletion
      setEditingNode(null);
      setEditDescription('');
    } catch (err) {
      console.error('Failed to delete description:', err);
      showError(err.response?.data?.detail || 'Failed to delete description');
    }
  };

  const renderColumn = (column, dbName, schemaName, tableName) => {
    const nodeKey = buildDescriptionKey(dbName, schemaName, tableName, column.name);
    const hasDescription = descriptions[nodeKey];

    return (
      <div key={column.name} className="ml-0">
        <div 
          className={`flex items-center gap-2 px-3 py-2 hover:bg-opacity-50 cursor-pointer group ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        >
          <div className="w-4 flex-shrink-0" />
          <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>
            <ColumnIcon />
          </span>
          <span className={`flex-1 min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {column.name}
            <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {column.type}
            </span>
          </span>

          <div className="flex items-center gap-1 flex-shrink-0">
            {hasDescription && (
              <InfoIcon description={hasDescription.description} isDark={isDark} />
            )}
            <button
              onClick={() => handleAddDescription(dbName, schemaName, tableName, column.name)}
              className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded whitespace-nowrap ${
                hasDescription
                  ? isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'
                  : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {hasDescription ? 'Edit' : '+ Add'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = (table, dbName, schemaName) => {
    const tableKey = `${dbName}.${schemaName}.${table.name}`;
    const isExpanded = expandedTables.has(tableKey);
    const nodeKey = buildDescriptionKey(dbName, schemaName, table.name, null);
    const hasDescription = descriptions[nodeKey];
    const tableDetails = tableDetailsCache[tableKey];
    // Use is_excluded flag directly from the table object (set by schema-service)
    const isExcluded = !!table.is_excluded;

    // For non-admin users, hide excluded tables entirely
    if (isExcluded && !isAdmin) {
      return null;
    }

    return (
      <div key={table.name} className={`ml-0 ${isExcluded ? 'opacity-50' : ''}`}>
        <div 
          className={`flex items-center gap-2 px-3 py-2 hover:bg-opacity-50 cursor-pointer group ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
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
          <span className={`flex-1 min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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

          <div className="flex items-center gap-1 flex-shrink-0">
            {hasDescription && (
              <InfoIcon description={hasDescription.description} isDark={isDark} />
            )}
            <button
              onClick={() => handleAddDescription(dbName, schemaName, table.name, null)}
              className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded whitespace-nowrap ${
                hasDescription
                  ? isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'
                  : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {hasDescription ? 'Edit' : '+ Add'}
            </button>
          </div>
        </div>

        {isExpanded && tableDetails && tableDetails.columns && (
          <div className="ml-4">
            {tableDetails.columns.map(col => renderColumn(col, dbName, schemaName, table.name))}
          </div>
        )}
      </div>
    );
  };

  const renderSchema = (schema, dbName) => {
    const schemaKey = `${dbName}.${schema.name}`;
    const isExpanded = expandedSchemas.has(schemaKey);
    const nodeKey = buildDescriptionKey(dbName, schema.name, null, null);
    const hasDescription = descriptions[nodeKey];
    const objects = objectsCache[schemaKey];
    // Use is_excluded flag directly from the schema object (set by schema-service)
    const isExcluded = !!schema.is_excluded;

    // For non-admin users, hide excluded schemas entirely
    if (isExcluded && !isAdmin) {
      return null;
    }

    return (
      <div key={schema.name} className={`ml-0 ${isExcluded ? 'opacity-50' : ''}`}>
        <div 
          className={`flex items-center gap-2 px-3 py-2 hover:bg-opacity-50 cursor-pointer group ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        >
          <button
            onClick={() => toggleSchema(dbName, schema.name)}
            className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>
            <SchemaIcon />
          </span>
          <span className={`flex-1 min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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

          <div className="flex items-center gap-1 flex-shrink-0">
            {hasDescription && (
              <InfoIcon description={hasDescription.description} isDark={isDark} />
            )}
            <button
              onClick={() => handleAddDescription(dbName, schema.name, null, null)}
              className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded whitespace-nowrap ${
                hasDescription
                  ? isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'
                  : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {hasDescription ? 'Edit' : '+ Add'}
            </button>
          </div>
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
    const nodeKey = buildDescriptionKey(db.name, null, null, null);
    const hasDescription = descriptions[nodeKey];
    const schemas = schemaCache[db.name];

    return (
      <div key={db.name} className="ml-0">
        <div 
          className={`flex items-center gap-2 px-3 py-2 hover:bg-opacity-50 cursor-pointer group ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        >
          <button
            onClick={() => toggleDatabase(db.name)}
            className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>
            <DatabaseIcon />
          </span>
          <span className={`flex-1 font-medium min-w-0 ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
            <span>{db.name}</span>
            {db.connector_type && (
              <ConnectorBadge connector_type={db.connector_type} size="sm" />
            )}
            {db.schema_count > 0 && (
              <span className={`text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {db.schema_count} schemas
              </span>
            )}
          </span>

          <div className="flex items-center gap-1 flex-shrink-0">
            {hasDescription && (
              <InfoIcon description={hasDescription.description} isDark={isDark} />
            )}
            <button
              onClick={() => handleAddDescription(db.name, null, null, null)}
              className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded whitespace-nowrap ${
                hasDescription
                  ? isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'
                  : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {hasDescription ? 'Edit' : '+ Add'}
            </button>
          </div>
        </div>

        {isExpanded && schemas && (
          <div className="ml-4">
            {schemas.map(s => renderSchema(s, db.name))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDark ? 'border-gray-800' : 'border-gray-200'
      }`}>
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Metadata Catalog (Org)
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Add descriptions to improve AI recommendations for everyone
          </p>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-auto p-4">
        {isDatabasesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
          <div className="space-y-1">
            {databasesData.databases.map(db => renderDatabase(db))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 max-w-2xl w-full mx-4 ${
            isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
            <h3 className="text-lg font-semibold mb-4">
              Add Description
            </h3>
            
            <div className="mb-4">
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                {editingNode.catalog}
                {editingNode.schema && ` › ${editingNode.schema}`}
                {editingNode.table && ` › ${editingNode.table}`}
                {editingNode.column && ` › ${editingNode.column}`}
              </div>
              
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter a description that helps users understand this data..."
                rows={4}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
              
              <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Tip: Include business context, data freshness, or common use cases (50-200 characters optimal)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              {descriptions[editingNode.key] && (
                <button
                  onClick={() => handleDeleteDescription(editingNode.key)}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? 'text-red-400 hover:bg-red-900/20'
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  setEditingNode(null);
                  setEditDescription('');
                }}
                className={`px-4 py-2 rounded-lg ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDescription}
                disabled={!editDescription.trim() && !descriptions[editingNode.key]}
                className={`px-4 py-2 rounded-lg ${
                  (editDescription.trim() || descriptions[editingNode.key])
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetadataCatalog;

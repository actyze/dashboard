/**
 * Data Access Management Component - Redesigned
 * Visual schema browser to select databases/schemas/tables for group access
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import AdminService from '../../services/AdminService';
import { RestService } from '../../services/RestService';
import { useGetDatabases } from '../../hooks/useRestAPI';

function DataAccessManagement() {
  const { isDark } = useTheme();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [accessRules, setAccessRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Schema browser state
  const [openBrowserDialog, setOpenBrowserDialog] = useState(false);
  const [schemaCache, setSchemaCache] = useState({});
  const [tablesCache, setTablesCache] = useState({});
  const [tableDetailsCache, setTableDetailsCache] = useState({});
  const [expandedDatabases, setExpandedDatabases] = useState(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [selectedAccess, setSelectedAccess] = useState({
    catalog: null,
    database_name: null,
    schema_name: null,
    table_name: null,
    allowed_columns: []
  });
  
  // Use the same hook as DatabaseSchemaPanel
  const { 
    data: databasesData, 
    isLoading: isDatabasesLoading, 
    error: databasesError 
  } = useGetDatabases();

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadAccessRules();
    }
  }, [selectedGroup]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await AdminService.listGroups();
      if (response.success) {
        setGroups(response.groups);
        if (response.groups.length > 0 && !selectedGroup) {
          setSelectedGroup(response.groups[0].id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessRules = async () => {
    if (!selectedGroup) return;
    
    try {
      const response = await AdminService.getGroupDataAccess(selectedGroup);
      if (response.success) {
        setAccessRules(response.rules);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load access rules');
    }
  };

  const loadSchemasForDatabase = async (dbName) => {
    if (!schemaCache[dbName]) {
      try {
        const response = await RestService.getDatabaseSchemas(dbName);
        if (response && response.schemas) {
          setSchemaCache(prev => ({
            ...prev,
            [dbName]: response.schemas
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch schemas for ${dbName}:`, err);
        setError(`Failed to load schemas for ${dbName}`);
      }
    }
  };

  const loadTablesForSchema = async (dbName, schemaName) => {
    const schemaKey = `${dbName}.${schemaName}`;
    if (!tablesCache[schemaKey]) {
      try {
        const response = await RestService.getSchemaObjects(dbName, schemaName);
        if (response && response.objects) {
          setTablesCache(prev => ({
            ...prev,
            [schemaKey]: response.objects
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch tables for ${schemaKey}:`, err);
      }
    }
  };

  const loadTableColumns = async (dbName, schemaName, tableName) => {
    const tableKey = `${dbName}.${schemaName}.${tableName}`;
    if (!tableDetailsCache[tableKey]) {
      try {
        const response = await RestService.getTableDetails(dbName, schemaName, tableName);
        if (response) {
          setTableDetailsCache(prev => ({
            ...prev,
            [tableKey]: response
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch columns for ${tableKey}:`, err);
      }
    }
  };

  const toggleDatabase = async (dbName) => {
    const newExpanded = new Set(expandedDatabases);
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName);
    } else {
      newExpanded.add(dbName);
      await loadSchemasForDatabase(dbName);
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
      await loadTablesForSchema(dbName, schemaName);
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
      await loadTableColumns(dbName, schemaName, tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleOpenBrowser = () => {
    setSelectedAccess({
      catalog: null,
      database_name: null,
      schema_name: null,
      table_name: null,
      allowed_columns: null
    });
    setOpenBrowserDialog(true);
  };

  const handleCloseBrowser = () => {
    setOpenBrowserDialog(false);
  };

  const handleSelectDatabase = (dbName, checked) => {
    if (checked) {
      setSelectedAccess({
        catalog: null,
        database_name: dbName,
        schema_name: null,
        table_name: null,
        allowed_columns: []
      });
    } else {
      setSelectedAccess({
        catalog: null,
        database_name: null,
        schema_name: null,
        table_name: null,
        allowed_columns: []
      });
    }
  };

  const handleSelectSchema = (dbName, schemaName, checked) => {
    if (checked) {
      setSelectedAccess({
        catalog: null,
        database_name: dbName,
        schema_name: schemaName,
        table_name: null,
        allowed_columns: []
      });
    } else {
      setSelectedAccess({
        catalog: null,
        database_name: null,
        schema_name: null,
        table_name: null,
        allowed_columns: []
      });
    }
  };

  const handleSelectTable = (dbName, schemaName, tableName, checked) => {
    if (checked) {
      setSelectedAccess({
        catalog: null,
        database_name: dbName,
        schema_name: schemaName,
        table_name: tableName,
        allowed_columns: []
      });
    } else {
      setSelectedAccess({
        catalog: null,
        database_name: null,
        schema_name: null,
        table_name: null,
        allowed_columns: []
      });
    }
  };

  const handleSelectColumn = (dbName, schemaName, tableName, columnName, checked) => {
    const currentColumns = selectedAccess.allowed_columns || [];
    if (checked) {
      setSelectedAccess({
        catalog: null,
        database_name: dbName,
        schema_name: schemaName,
        table_name: tableName,
        allowed_columns: [...currentColumns, columnName]
      });
    } else {
      setSelectedAccess({
        ...selectedAccess,
        allowed_columns: currentColumns.filter(col => col !== columnName)
      });
    }
  };

  const isSelected = (dbName, schemaName = null, tableName = null, columnName = null) => {
    if (columnName) {
      return selectedAccess.database_name === dbName &&
             selectedAccess.schema_name === schemaName &&
             selectedAccess.table_name === tableName &&
             selectedAccess.allowed_columns?.includes(columnName);
    }
    if (tableName) {
      return selectedAccess.database_name === dbName &&
             selectedAccess.schema_name === schemaName &&
             selectedAccess.table_name === tableName &&
             (!selectedAccess.allowed_columns || selectedAccess.allowed_columns.length === 0);
    }
    if (schemaName) {
      return selectedAccess.database_name === dbName &&
             selectedAccess.schema_name === schemaName &&
             !selectedAccess.table_name;
    }
    return selectedAccess.database_name === dbName &&
           !selectedAccess.schema_name;
  };

  const handleAddAccessRule = async () => {
    if (!selectedAccess.database_name) {
      setError('Please select at least a database');
      return;
    }

    try {
      const response = await AdminService.addGroupDataAccess(selectedGroup, selectedAccess);
      if (response.success) {
        setSuccess('Access rule added successfully');
        handleCloseBrowser();
        loadAccessRules();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add access rule');
    }
  };

  const handleRemoveAccessRule = async (ruleId) => {
    if (window.confirm('Remove this access rule?')) {
      try {
        const response = await AdminService.removeGroupDataAccess(ruleId);
        if (response.success) {
          setSuccess('Access rule removed');
          loadAccessRules();
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to remove access rule');
      }
    }
  };

  const formatAccessRule = (rule) => {
    const parts = [];
    if (rule.catalog) parts.push(rule.catalog);
    if (rule.database_name) parts.push(rule.database_name);
    if (rule.schema_name) parts.push(rule.schema_name);
    if (rule.table_name) parts.push(rule.table_name);
    
    if (parts.length === 0) return 'None';
    
    let result = parts.join('.');
    if (rule.allowed_columns && rule.allowed_columns.length > 0) {
      result += ` (${rule.allowed_columns.length} columns)`;
    }
    return result;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3] mx-auto"></div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Alerts */}
      {(error || success) && (
        <div className="px-6 pt-4">
      {error && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-2 ${
              isDark ? 'bg-red-900/20 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm flex-1">{error}</span>
              <button onClick={() => setError(null)} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
      )}
      {success && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-2 ${
              isDark ? 'bg-green-900/20 border border-green-800 text-green-300' : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm flex-1">{success}</span>
              <button onClick={() => setSuccess(null)} className="hover:opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <h2 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Data Access Rules
          </h2>

      {/* Group Selector */}
          <select
            value={selectedGroup || ''}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className={`
              px-3 py-1.5 text-sm rounded-lg border cursor-pointer
              ${isDark 
                ? 'bg-[#1c1d1f] border-[#2a2b2e] text-gray-300' 
                : 'bg-white border-gray-200 text-gray-700'
              }
              focus:outline-none focus:border-[#5d6ad3] transition-colors
            `}
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.member_count || 0} members)
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleOpenBrowser}
          disabled={!selectedGroup}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
            ${selectedGroup
              ? 'bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Data Access
        </button>
      </div>

      {/* Access Rules Table */}
      {selectedGroup && (
        <div className="flex-1 overflow-auto px-6">
          {/* Table Header */}
          <div className={`grid grid-cols-12 gap-4 py-2 text-xs font-medium border-b sticky top-0 ${
            isDark 
              ? 'text-gray-500 border-[#2a2b2e] bg-[#101012]' 
              : 'text-gray-500 border-gray-200 bg-gray-50'
          }`}>
            <div className="col-span-4">Resource</div>
            <div className="col-span-2">Database</div>
            <div className="col-span-2">Schema</div>
            <div className="col-span-2">Table</div>
            <div className="col-span-1">Columns</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Table Body */}
                {accessRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                No access rules defined
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                Add one to grant data access to this group
              </p>
            </div>
          ) : (
            <div>
              {accessRules.map((rule) => (
                <div 
                  key={rule.id}
                  className={`
                    grid grid-cols-12 gap-4 py-3 border-b
                    ${isDark 
                      ? 'border-[#1c1d1f]' 
                      : 'border-gray-100'
                    }
                  `}
                >
                  {/* Resource */}
                  <div className="col-span-4 flex items-center">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {formatAccessRule(rule)}
                    </span>
                  </div>
                  
                  {/* Database */}
                  <div className="col-span-2 flex items-center">
                    {rule.database_name ? (
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {rule.database_name}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-xs rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        ALL
                      </span>
                    )}
                  </div>
                  
                  {/* Schema */}
                  <div className="col-span-2 flex items-center">
                    {rule.schema_name ? (
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {rule.schema_name}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-xs rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        ALL
                      </span>
                    )}
                  </div>
                  
                  {/* Table */}
                  <div className="col-span-2 flex items-center">
                    {rule.table_name ? (
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {rule.table_name}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-xs rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        ALL
                      </span>
                    )}
                  </div>
                  
                  {/* Columns */}
                  <div className="col-span-1 flex items-center">
                        {rule.allowed_columns && rule.allowed_columns.length > 0 ? (
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {rule.allowed_columns.length}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-xs rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        ALL
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end">
                    <button
                          onClick={() => handleRemoveAccessRule(rule.id)}
                      className={`p-1 rounded transition-colors ${
                        isDark 
                          ? 'text-gray-600 hover:text-red-400 hover:bg-[#2a2b2e]' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                      }`}
                      title="Remove access rule"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schema Browser Dialog */}
      {openBrowserDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleCloseBrowser()}
        >
          <div 
            className={`
              w-full max-w-2xl mx-4 rounded-xl shadow-2xl max-h-[80vh] flex flex-col
              ${isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Select Database Access
                </h3>
              </div>
              <button
                onClick={handleCloseBrowser}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-5">
            {isDatabasesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3]"></div>
                </div>
            ) : databasesError ? (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
                  isDark ? 'bg-red-900/20 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">Failed to load databases</span>
                </div>
            ) : (
              <>
                  {/* Info */}
                  <div className={`flex items-start gap-2 px-4 py-3 rounded-lg mb-4 ${
                    isDark ? 'bg-blue-900/20 border border-blue-800 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'
                  }`}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs">
                      Select a database, schema, table, or specific columns. Selecting a higher level grants access to all child resources.
                    </span>
                  </div>

                  {/* Selected */}
                  <div className={`px-3 py-2 rounded-lg mb-4 ${isDark ? 'bg-[#1c1d1f]' : 'bg-gray-50'}`}>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Selected: </span>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatAccessRule(selectedAccess) || 'None'}
                    </span>
                  </div>

                  {/* Tree View */}
                  <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                  {databasesData?.databases?.map((db) => (
                      <div key={db.name}>
                      {/* Database Level */}
                        <div 
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                            isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
                          }`}
                        >
                          <button 
                            onClick={() => toggleDatabase(db.name)}
                            className={`p-0.5 rounded ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-200'}`}
                          >
                            <svg 
                              className={`w-4 h-4 transition-transform ${expandedDatabases.has(db.name) ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <input
                            type="checkbox"
                            checked={isSelected(db.name)}
                            onChange={(e) => handleSelectDatabase(db.name, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-[#5d6ad3] focus:ring-[#5d6ad3]"
                          />
                          <svg className={`w-4 h-4 ${isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                          </svg>
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                          {db.name}
                          </span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${isDark ? 'bg-[#2a2b2e] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            {db.schema_count} schemas
                          </span>
                        </div>

                      {/* Schema Level */}
                      {expandedDatabases.has(db.name) && (
                          <div className={`border-l ml-5 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                          {schemaCache[db.name] ? (
                            schemaCache[db.name].map((schema) => {
                              const schemaKey = `${db.name}.${schema.name}`;
                              return (
                                  <div key={schema.name}>
                                    <div 
                                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                        isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <button 
                                        onClick={() => toggleSchema(db.name, schema.name)}
                                        className={`p-0.5 rounded ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-200'}`}
                                      >
                                        <svg 
                                          className={`w-4 h-4 transition-transform ${expandedSchemas.has(schemaKey) ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} 
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </button>
                                      <input
                                        type="checkbox"
                                        checked={isSelected(db.name, schema.name)}
                                        onChange={(e) => handleSelectSchema(db.name, schema.name, e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-[#5d6ad3] focus:ring-[#5d6ad3]"
                                      />
                                      <svg className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                      </svg>
                                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {schema.name}
                                      </span>
                                      <span className={`px-1.5 py-0.5 text-xs rounded ${isDark ? 'bg-[#2a2b2e] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                        {schema.table_count} tables
                                      </span>
                                    </div>

                                  {/* Table Level */}
                                  {expandedSchemas.has(schemaKey) && (
                                      <div className={`border-l ml-5 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                                      {tablesCache[schemaKey] ? (
                                          tablesCache[schemaKey].tables?.map((table) => {
                                            const tableKey = `${db.name}.${schema.name}.${table.name}`;
                                            return (
                                              <div key={table.name}>
                                                <div 
                                                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                                    isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
                                                  }`}
                                                >
                                                  <button 
                                                    onClick={() => toggleTable(db.name, schema.name, table.name)}
                                                    className={`p-0.5 rounded ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-200'}`}
                                                  >
                                                    <svg 
                                                      className={`w-4 h-4 transition-transform ${expandedTables.has(tableKey) ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} 
                                                      fill="none" 
                                                      stroke="currentColor" 
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                  </button>
                                                  <input
                                                    type="checkbox"
                                                    checked={isSelected(db.name, schema.name, table.name)}
                                                    onChange={(e) => handleSelectTable(db.name, schema.name, table.name, e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300 text-[#5d6ad3] focus:ring-[#5d6ad3]"
                                                  />
                                                  <svg className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                  </svg>
                                                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {table.name}
                                                  </span>
                                                  <span className={`px-1.5 py-0.5 text-xs rounded ${isDark ? 'bg-[#2a2b2e] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                                    {table.column_count} cols
                                                  </span>
                                                </div>

                                                {/* Column Level */}
                                                {expandedTables.has(tableKey) && (
                                                  <div className={`border-l ml-5 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                                                    {tableDetailsCache[tableKey] ? (
                                                      tableDetailsCache[tableKey].columns?.map((column) => (
                                                        <div 
                                                          key={column.name}
                                                          className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
                                                            isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'
                                                          }`}
                                                        >
                                                          <div className="w-5" /> {/* Spacer */}
                                                          <input
                                                            type="checkbox"
                                                            checked={isSelected(db.name, schema.name, table.name, column.name)}
                                                            onChange={(e) => handleSelectColumn(db.name, schema.name, table.name, column.name, e.target.checked)}
                                                            className="w-4 h-4 rounded border-gray-300 text-[#5d6ad3] focus:ring-[#5d6ad3]"
                                                          />
                                                          <svg className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                                          </svg>
                                                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {column.name}
                                                          </span>
                                                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                                            {column.type}
                                                          </span>
                                                        </div>
                                                      ))
                                                    ) : (
                                                      <div className={`px-3 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        Loading columns...
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })
                                      ) : (
                                          <div className={`px-3 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                          Loading tables...
                                          </div>
                                      )}
                                      </div>
                                  )}
                                  </div>
                              );
                            })
                          ) : (
                              <div className={`px-3 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              Loading schemas...
                              </div>
                          )}
                          </div>
                      )}
                      </div>
                  ))}
                  </div>
              </>
            )}
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t flex-shrink-0 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <button
                onClick={handleCloseBrowser}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
              <button
            onClick={handleAddAccessRule}
            disabled={!selectedAccess.database_name}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  bg-[#5d6ad3] text-white
                  ${selectedAccess.database_name ? 'hover:bg-[#4f5bc4]' : 'opacity-50 cursor-not-allowed'}
                `}
          >
            Add Access Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataAccessManagement;

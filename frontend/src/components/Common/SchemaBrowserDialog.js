/**
 * Reusable Schema Browser Dialog Component
 * Matches Data Access Management look and feel exactly
 * Used by both Data Access Management and User Preferences
 */

import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RestService } from '../../services/RestService';
import { useGetDatabases } from '../../hooks/useRestAPI';

function SchemaBrowserDialog({ 
  isOpen,
  onClose,
  onConfirm,
  title = "Select Schema or Table",
  description = "Select a schema (entire schema) or specific table",
  confirmButtonText = "Confirm",
  showBoostWeight = false  // Show for preferences
}) {
  const { isDark } = useTheme();
  
  // Schema browser state
  const [schemaCache, setSchemaCache] = useState({});
  const [tablesCache, setTablesCache] = useState({});
  const [tableDetailsCache, setTableDetailsCache] = useState({});
  const [expandedDatabases, setExpandedDatabases] = useState(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());
  const [expandedTables, setExpandedTables] = useState(new Set());
  
  // Selection state - supports multiple selections
  const [selectedItems, setSelectedItems] = useState([]);

  // Boost weight (for preferences) - applies to ALL selected items
  const [boostWeight, setBoostWeight] = useState(1.5);
  
  // Get databases
  const { data: databasesData, isLoading: isDatabasesLoading, error: databasesError } = useGetDatabases();
  const databases = databasesData?.databases || [];

  const loadSchemasForDatabase = async (dbName) => {
    if (!schemaCache[dbName]) {
      try {
        const response = await RestService.getDatabaseSchemas(dbName);
        if (response && response.schemas) {
          setSchemaCache(prev => ({ ...prev, [dbName]: response.schemas }));
        }
      } catch (err) {
        console.error(`Failed to fetch schemas for ${dbName}:`, err);
      }
    }
  };

  const loadTablesForSchema = async (dbName, schemaName) => {
    const schemaKey = `${dbName}.${schemaName}`;
    if (!tablesCache[schemaKey]) {
      try {
        const response = await RestService.getSchemaObjects(dbName, schemaName);
        if (response && response.objects) {
          // Ensure we have the correct structure
          const objects = response.objects;
          setTablesCache(prev => ({ 
            ...prev, 
            [schemaKey]: {
              tables: objects.tables || [],
              views: objects.views || []
            }
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch tables for ${dbName}.${schemaName}:`, err);
        // Set empty array on error
        setTablesCache(prev => ({ ...prev, [schemaKey]: { tables: [], views: [] } }));
      }
    }
  };

  const loadTableDetails = async (dbName, schemaName, tableName) => {
    const tableKey = `${dbName}.${schemaName}.${tableName}`;
    if (!tableDetailsCache[tableKey]) {
      try {
        const response = await RestService.getTableDetails(dbName, schemaName, tableName);
        if (response && response.columns) {
          setTableDetailsCache(prev => ({ ...prev, [tableKey]: response.columns }));
        }
      } catch (err) {
        console.error(`Failed to fetch details for ${dbName}.${schemaName}.${tableName}:`, err);
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
    const key = `${dbName}.${schemaName}`;
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
      await loadTablesForSchema(dbName, schemaName);
    }
    setExpandedSchemas(newExpanded);
  };

  const toggleTable = async (dbName, schemaName, tableName) => {
    const key = `${dbName}.${schemaName}.${tableName}`;
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
      await loadTableDetails(dbName, schemaName, tableName);
    }
    setExpandedTables(newExpanded);
  };

  // Check if an item is selected
  const isSelected = (dbName, schemaName = null, tableName = null) => {
    return selectedItems.some(item => 
      item.database_name === dbName && 
      item.schema_name === schemaName && 
      item.table_name === tableName
    );
  };

  // Handle database selection
  const handleSelectDatabase = (dbName, checked) => {
    console.log('handleSelectDatabase:', dbName, checked);
    if (checked) {
      // Add database-level selection
      setSelectedItems(prev => {
        const newItems = [
          ...prev.filter(item => !(item.database_name === dbName && !item.schema_name)),
          {
            catalog: null,
            database_name: dbName,
            schema_name: null,
            table_name: null,
            columns: []
          }
        ];
        console.log('New selected items (database):', newItems);
        return newItems;
      });
    } else {
      // Remove database-level selection
      setSelectedItems(prev => {
        const newItems = prev.filter(item => 
          !(item.database_name === dbName && !item.schema_name)
        );
        console.log('New selected items (database removed):', newItems);
        return newItems;
      });
    }
  };

  // Handle schema selection
  const handleSelectSchema = (dbName, schemaName, checked) => {
    console.log('handleSelectSchema:', dbName, schemaName, checked);
    if (checked) {
      // Add schema-level selection
      setSelectedItems(prev => {
        const newItems = [
          ...prev.filter(item => !(item.database_name === dbName && item.schema_name === schemaName && !item.table_name)),
          {
            catalog: null,
            database_name: dbName,
            schema_name: schemaName,
            table_name: null,
            columns: []
          }
        ];
        console.log('New selected items (schema):', newItems);
        return newItems;
      });
    } else {
      // Remove schema-level selection
      setSelectedItems(prev => {
        const newItems = prev.filter(item => 
          !(item.database_name === dbName && item.schema_name === schemaName && !item.table_name)
        );
        console.log('New selected items (schema removed):', newItems);
        return newItems;
      });
    }
  };

  // Handle table selection
  const handleSelectTable = (dbName, schemaName, tableName, checked) => {
    if (checked) {
      // Add table-level selection
      setSelectedItems(prev => [
        ...prev.filter(item => !(item.database_name === dbName && item.schema_name === schemaName && item.table_name === tableName)),
        {
          catalog: null,
          database_name: dbName,
          schema_name: schemaName,
          table_name: tableName,
          columns: []
        }
      ]);
    } else {
      // Remove table-level selection
      setSelectedItems(prev => prev.filter(item => 
        !(item.database_name === dbName && item.schema_name === schemaName && item.table_name === tableName)
      ));
    }
  };

  // Handle column toggle (updates columns for table)
  const handleColumnToggle = (dbName, schemaName, tableName, columnName) => {
    setSelectedItems(prev => {
      const itemIndex = prev.findIndex(item => 
        item.database_name === dbName && 
        item.schema_name === schemaName && 
        item.table_name === tableName
      );

      if (itemIndex === -1) {
        // Table not selected, add it with this column
        return [...prev, {
          catalog: null,
          database_name: dbName,
          schema_name: schemaName,
          table_name: tableName,
          columns: [columnName]
        }];
      } else {
        // Table selected, toggle column
        const newItems = [...prev];
        const item = { ...newItems[itemIndex] };
        const currentColumns = item.columns || [];
        
        if (currentColumns.includes(columnName)) {
          item.columns = currentColumns.filter(c => c !== columnName);
        } else {
          item.columns = [...currentColumns, columnName];
        }
        
        newItems[itemIndex] = item;
        return newItems;
      }
    });
  };

  const handleConfirm = () => {
    console.log('SchemaBrowserDialog handleConfirm called');
    console.log('Selected items:', selectedItems);
    console.log('Boost weight:', boostWeight);
    console.log('Show boost weight:', showBoostWeight);
    
    // Pass all selected items with the same boost weight
    const results = selectedItems.map(item => ({
      ...item,
      boost_weight: showBoostWeight ? boostWeight : undefined
    }));
    
    console.log('Results to send:', results);
    
    if (onConfirm) {
      onConfirm(results);
    } else {
      console.error('onConfirm callback is not defined!');
    }
    
    onClose();
    
    // Reset state
    setSelectedItems([]);
    setBoostWeight(1.5);
  };

  const formatSelectedItem = (item) => {
    let path = [];
    if (item.database_name) path.push(item.database_name);
    if (item.schema_name) path.push(item.schema_name);
    if (item.table_name) path.push(item.table_name);
    return path.join('.');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className={`
          w-full max-w-3xl mx-4 rounded-xl shadow-2xl max-h-[85vh] flex flex-col
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
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
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
                  {description}
                </span>
              </div>

              {/* Selected Items */}
              <div className={`px-3 py-2 rounded-lg mb-4 ${isDark ? 'bg-[#1c1d1f]' : 'bg-gray-50'}`}>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Selected: </span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedItems.length > 0 
                    ? selectedItems.map(item => formatSelectedItem(item)).join(', ') 
                    : 'None'}
                </span>
              </div>

              {/* Tree View */}
              <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                {databases.map((db) => (
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
                        checked={isSelected(db.name, null, null)}
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
                                    checked={isSelected(db.name, schema.name, null)}
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
                                    {tablesCache[schemaKey]?.tables ? (
                                      tablesCache[schemaKey].tables.map((table) => {
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
                                              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
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
                                                  <div className={`px-3 py-2 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50/50'}`}>
                                                    <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Columns (optional):</span>
                                                    <div className="mt-1 space-y-1">
                                                      {tableDetailsCache[tableKey].map((col) => {
                                                        const currentItem = selectedItems.find(item => 
                                                          item.database_name === db.name && 
                                                          item.schema_name === schema.name && 
                                                          item.table_name === table.name
                                                        );
                                                        const isColumnSelected = currentItem?.columns?.includes(col.name);
                                                        
                                                        return (
                                                          <label 
                                                            key={col.name} 
                                                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                                                              isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-100'
                                                            }`}
                                                          >
                                                            <input
                                                              type="checkbox"
                                                              checked={isColumnSelected || false}
                                                              onChange={() => handleColumnToggle(db.name, schema.name, table.name, col.name)}
                                                              className="w-3 h-3 rounded border-gray-300 text-[#5d6ad3] focus:ring-[#5d6ad3]"
                                                            />
                                                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                              {col.name}
                                                            </span>
                                                            <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
                                                              ({col.type})
                                                            </span>
                                                          </label>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="px-3 py-2">
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#5d6ad3]"></div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="px-3 py-2">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#5d6ad3]"></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#5d6ad3]"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Boost Weight Selector (for preferences) - applies to ALL selected items */}
              {showBoostWeight && selectedItems.length > 0 && (
                <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-[#1c1d1f] border border-[#2a2b2e]' : 'bg-gray-50 border border-gray-200'}`}>
                  <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Boost Weight (applies to all {selectedItems.length} selected item{selectedItems.length > 1 ? 's' : ''})
                  </label>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    value={boostWeight}
                    onChange={(e) => setBoostWeight(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-[#5d6ad3]"
                  />
                  <div className="flex justify-between text-xs mt-2">
                    <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>1.0x (Low)</span>
                    <span className="font-semibold text-[#5d6ad3]">{boostWeight.toFixed(1)}x</span>
                    <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>3.0x (High)</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex justify-end gap-3 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark 
                ? 'text-gray-400 hover:text-gray-300 hover:bg-[#1c1d1f]' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedItems.length === 0}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedItems.length > 0
                ? 'bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchemaBrowserDialog;

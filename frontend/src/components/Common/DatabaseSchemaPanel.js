import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Text, Button } from '../ui';
import TableSchema from './TableSchema';
import { useGetDatabases } from '../../hooks/useRestAPI';
import { RestService } from '../../services/RestService';
import ConnectorBadge from './ConnectorBadge';

const DatabaseSchemaPanel = ({ 
  isCollapsed, 
  onToggle,
  onTableSelect,
  selectedTable 
}) => {
  const { isDark } = useTheme();
  const [expandedDatabases, setExpandedDatabases] = useState(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());
  const [schemaCache, setSchemaCache] = useState({}); // Cache schemas per database
  const [objectsCache, setObjectsCache] = useState({}); // Cache objects per schema
  const [tableDetailsCache, setTableDetailsCache] = useState({}); // Cache table details
  const [selectedTableInfo, setSelectedTableInfo] = useState(null); // Track full table info (db, schema, table)

  // Fetch all databases
  const { 
    data: databasesData, 
    isLoading: isDatabasesLoading, 
    error: databasesError 
  } = useGetDatabases();

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
          if (response && response.objects) {
            setObjectsCache(prev => ({
              ...prev,
              [schemaKey]: response.objects
            }));
          }
        } catch (error) {
          console.error(`Failed to fetch objects for ${schemaKey}:`, error);
        }
      }
    }
    setExpandedSchemas(newExpanded);
  };

  const handleTableClick = async (dbName, schemaName, tableName) => {
    const tableKey = `${dbName}.${schemaName}.${tableName}`;
    
    // Update selected table info
    setSelectedTableInfo({ database: dbName, schema: schemaName, table: tableName });
    
    if (onTableSelect) {
      onTableSelect(tableName);
    }

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
      }
    }
  };

  const ChevronIcon = ({ isExpanded, className = "" }) => (
    <svg 
      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${className}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const DatabaseIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
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

  const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );


  return (
    <div className={`${isCollapsed ? 'w-0' : 'w-72'} transition-all duration-300 overflow-hidden flex flex-col h-full ${isDark ? 'bg-[#090909] border-gray-800/50' : 'bg-gray-50/50 border-gray-200/50'} border-r`}>

      <div className={`${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'} transition-opacity duration-300 flex-1 flex flex-col min-h-0`}>
        
        {/* Header */}
        <div className="p-3 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-3 mt-3">
            <Text variant="h6" className="font-medium text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Databases
            </Text>
            {!isCollapsed && onToggle && (
              <button
                onClick={onToggle}
                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                title="Hide Database Schema"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Search */}
          <div className={`relative ${isDark ? 'bg-[#1c1d1f]' : 'bg-white/60'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              className={`block w-full pl-8 pr-2 py-1.5 text-xs rounded border-0 ${isDark ? 'bg-[#1c1d1f] text-white placeholder-gray-400' : 'bg-white/60 text-gray-900 placeholder-gray-500'} focus:ring-1 focus:ring-blue-500 focus:outline-none`}
              placeholder="Search objects"
            />
          </div>
        </div>

        {/* Schema Tree with fixed height management */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table List - Scrollable */}
          <div className={`${selectedTable ? 'flex-1 min-h-0' : 'flex-1'} overflow-y-auto p-2`}>
            {/* Loading State */}
            {isDatabasesLoading && (
              <div className={`text-center py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading databases...
              </div>
            )}

            {/* Error State */}
            {databasesError && (
              <div className={`text-center py-4 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                Failed to load databases
              </div>
            )}

            {/* Database List */}
            {databasesData?.databases?.map((database) => (
              <div key={database.name} className="mb-2">
                {/* Database Level */}
                <button
                  onClick={() => toggleDatabase(database.name)}
                  className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors ${isDark ? 'hover:bg-[#1c1d1f] text-gray-200' : 'hover:bg-gray-100/60 text-gray-800'}`}
                >
                  <ChevronIcon isExpanded={expandedDatabases.has(database.name)} />
                  <DatabaseIcon />
                  <Text className="font-medium text-xs">{database.name}</Text>
                  {database.connector_type && database.connector_type !== 'unknown' && (
                    <ConnectorBadge connector_type={database.connector_type} size="sm" showIcon={false} />
                  )}
                  <Text className="text-xs text-gray-400 ml-auto">
                    {database.schema_count} schemas
                  </Text>
                </button>

                {/* Schema Level */}
                {expandedDatabases.has(database.name) && (
                  <div className="ml-4">
                    {schemaCache[database.name] ? (
                      schemaCache[database.name].map((schema) => {
                        const schemaKey = `${database.name}.${schema.name}`;
                        return (
                          <div key={schema.name} className="mb-1">
                            <button
                              onClick={() => toggleSchema(database.name, schema.name)}
                              className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors ${isDark ? 'hover:bg-[#1c1d1f] text-gray-300' : 'hover:bg-gray-100/60 text-gray-700'}`}
                            >
                              <ChevronIcon isExpanded={expandedSchemas.has(schemaKey)} />
                              <SchemaIcon />
                              <Text className="text-xs">{schema.name}</Text>
                              <Text className="text-xs text-gray-400 ml-auto">
                                {schema.table_count} tables
                              </Text>
                            </button>

                            {/* Tables Level */}
                            {expandedSchemas.has(schemaKey) && (
                              <div className="ml-4">
                                {objectsCache[schemaKey] ? (
                                  <>
                                    {/* Tables Section */}
                                    {objectsCache[schemaKey].tables && objectsCache[schemaKey].tables.length > 0 && (
                                      <>
                                        <div className={`mb-1.5 px-1 py-0.5 rounded text-xs ${isDark ? 'bg-[#1c1d1f] text-gray-400' : 'bg-gray-100/40 text-gray-600'} font-medium uppercase tracking-wide`}>
                                          Tables
                                        </div>
                                        {objectsCache[schemaKey].tables.map((table) => (
                                          <button
                                            key={table.name}
                                            onClick={() => handleTableClick(database.name, schema.name, table.name)}
                                            className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors mb-0.5
                                              ${selectedTable === table.name 
                                                ? (isDark ? 'bg-[#5d6ad3] text-white' : 'bg-[#5d6ad3] text-white')
                                                : (isDark ? 'hover:bg-[#1c1d1f] text-gray-300' : 'hover:bg-gray-100/60 text-gray-700')
                                              }
                                            `}
                                          >
                                            <TableIcon />
                                            <Text className="text-xs">{table.name}</Text>
                                            <Text className="text-xs text-gray-400 ml-auto">
                                              {table.column_count} cols
                                            </Text>
                                          </button>
                                        ))}
                                      </>
                                    )}
                                    
                                    {/* Views Section */}
                                    {objectsCache[schemaKey].views && objectsCache[schemaKey].views.length > 0 && (
                                      <>
                                        <div className={`mb-1.5 mt-2 px-1 py-0.5 rounded text-xs ${isDark ? 'bg-[#1c1d1f] text-gray-400' : 'bg-gray-100/40 text-gray-600'} font-medium uppercase tracking-wide`}>
                                          Views
                                        </div>
                                        {objectsCache[schemaKey].views.map((view) => (
                                          <button
                                            key={view.name}
                                            onClick={() => handleTableClick(database.name, schema.name, view.name)}
                                            className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors mb-0.5
                                              ${selectedTable === view.name 
                                                ? (isDark ? 'bg-[#5d6ad3] text-white' : 'bg-[#5d6ad3] text-white')
                                                : (isDark ? 'hover:bg-[#1c1d1f] text-gray-300' : 'hover:bg-gray-100/60 text-gray-700')
                                              }
                                            `}
                                          >
                                            <TableIcon />
                                            <Text className="text-xs">{view.name}</Text>
                                            <Text className="text-xs text-gray-400 ml-auto">
                                              {view.column_count} cols
                                            </Text>
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <div className={`text-xs py-2 px-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Loading objects...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className={`text-xs py-2 px-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Loading schemas...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Table Schema at Bottom - Fixed Height when visible */}
          <div className={`${selectedTable ? 'flex-shrink-0' : 'hidden'} border-t border-gray-200/50 dark:border-gray-700/50 h-48 overflow-y-auto ${isDark ? 'bg-[#0d0d0f]' : 'bg-white'}`}>
            {selectedTable && selectedTableInfo && (
              <TableSchema 
                tableName={selectedTable} 
                tableDetails={tableDetailsCache[`${selectedTableInfo.database}.${selectedTableInfo.schema}.${selectedTableInfo.table}`]}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseSchemaPanel;
import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Text, Button } from './ui';
import TableSchema from './TableSchema';

const DatabaseSchemaPanel = ({ 
  isCollapsed, 
  onToggle,
  onTableSelect,
  selectedTable 
}) => {
  const { isDark } = useTheme();
  const [expandedDatabases, setExpandedDatabases] = useState(new Set(['MAIN_DB']));
  const [expandedSchemas, setExpandedSchemas] = useState(new Set(['SALES']));

  // Mock database schema - in real app this would come from API
  const databaseSchema = {
    'MAIN_DB': {
      'SALES': {
        tables: [
          'CUSTOMERS',
          'ORDERS',
          'ORDER_ITEMS',
          'PRODUCTS',
          'CATEGORIES',
          'PAYMENTS',
          'SHIPPING',
          'PROMOTIONS',
          'REVIEWS',
          'INVENTORY'
        ]
      },
      'USERS': {
        tables: ['USER_PROFILES', 'USER_SESSIONS', 'USER_PREFERENCES']
      },
      'ANALYTICS': {
        tables: ['PAGE_VIEWS', 'EVENTS', 'CONVERSIONS']
      },
      'FINANCE': {
        tables: ['TRANSACTIONS', 'INVOICES', 'BUDGETS']
      },
      'MARKETING': {
        tables: ['CAMPAIGNS', 'EMAIL_LOGS', 'SOCIAL_MEDIA']
      },
      'OPERATIONS': {
        tables: ['SUPPLIERS', 'WAREHOUSES', 'LOGISTICS']
      },
      'SUPPORT': {
        tables: ['TICKETS', 'FAQ', 'KNOWLEDGE_BASE']
      }
    }
  };

  const toggleDatabase = (dbName) => {
    const newExpanded = new Set(expandedDatabases);
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName);
    } else {
      newExpanded.add(dbName);
    }
    setExpandedDatabases(newExpanded);
  };

  const toggleSchema = (schemaName) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaName)) {
      newExpanded.delete(schemaName);
    } else {
      newExpanded.add(schemaName);
    }
    setExpandedSchemas(newExpanded);
  };

  const handleTableClick = (tableName) => {
    if (onTableSelect) {
      onTableSelect(tableName);
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
    <div className={`${isCollapsed ? 'w-0' : 'w-72'} transition-all duration-300 overflow-hidden flex flex-col h-full ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50/50 border-gray-200/50'} border-r`}>

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
          <div className={`relative ${isDark ? 'bg-gray-800/60' : 'bg-white/60'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              className={`block w-full pl-8 pr-2 py-1.5 text-xs rounded border-0 ${isDark ? 'bg-gray-800/60 text-white placeholder-gray-400' : 'bg-white/60 text-gray-900 placeholder-gray-500'} focus:ring-1 focus:ring-blue-500 focus:outline-none`}
              placeholder="Search objects"
            />
          </div>
        </div>

        {/* Schema Tree with fixed height management */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table List - Scrollable */}
          <div className={`${selectedTable ? 'flex-1 min-h-0' : 'flex-1'} overflow-y-auto p-2`}>
            {Object.entries(databaseSchema).map(([dbName, schemas]) => (
              <div key={dbName} className="mb-2">
                {/* Database Level */}
                <button
                  onClick={() => toggleDatabase(dbName)}
                  className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors ${isDark ? 'hover:bg-gray-800/60 text-gray-200' : 'hover:bg-gray-100/60 text-gray-800'}`}
                >
                  <ChevronIcon isExpanded={expandedDatabases.has(dbName)} />
                  <DatabaseIcon />
                  <Text className="font-medium text-xs">{dbName}</Text>
                </button>

                {/* Schema Level */}
                {expandedDatabases.has(dbName) && (
                  <div className="ml-4">
                    {Object.entries(schemas).map(([schemaName, schemaData]) => (
                      <div key={schemaName} className="mb-1">
                        <button
                          onClick={() => toggleSchema(schemaName)}
                          className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors ${isDark ? 'hover:bg-gray-800/60 text-gray-300' : 'hover:bg-gray-100/60 text-gray-700'}`}
                        >
                          <ChevronIcon isExpanded={expandedSchemas.has(schemaName)} />
                          <SchemaIcon />
                          <Text className="text-xs">{schemaName}</Text>
                        </button>

                        {/* Tables Level */}
                        {expandedSchemas.has(schemaName) && (
                          <div className="ml-4">
                            <div className={`mb-1.5 px-1 py-0.5 rounded text-xs ${isDark ? 'bg-gray-800/40 text-gray-400' : 'bg-gray-100/40 text-gray-600'} font-medium uppercase tracking-wide`}>
                              Tables
                            </div>
                            {schemaData.tables.map((tableName, index) => (
                              <button
                                key={index}
                                onClick={() => handleTableClick(tableName)}
                                className={`w-full flex items-center space-x-1.5 p-1.5 text-left rounded transition-colors mb-0.5
                                  ${selectedTable === tableName 
                                    ? (isDark ? 'bg-blue-600/80 text-white' : 'bg-blue-500/80 text-white')
                                    : (isDark ? 'hover:bg-gray-800/60 text-gray-300' : 'hover:bg-gray-100/60 text-gray-700')
                                  }
                                `}
                              >
                                <TableIcon />
                                <Text className="text-xs">{tableName}</Text>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Table Schema at Bottom - Fixed Height when visible */}
          <div className={`${selectedTable ? 'flex-shrink-0' : 'hidden'} border-t border-gray-200/50 dark:border-gray-700/50 h-48 overflow-y-auto bg-gray-800/30`}>
            {selectedTable && <TableSchema tableName={selectedTable} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseSchemaPanel;
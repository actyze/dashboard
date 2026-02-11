import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Text } from '../ui';

const TableSchema = ({ tableName, tableDetails }) => {
  const { isDark } = useTheme();

  // Determine the icon type based on column data type
  const getIconType = (dataType) => {
    const type = (dataType || '').toLowerCase();
    
    if (type.includes('int') || type.includes('number') || type.includes('decimal') || 
        type.includes('float') || type.includes('double') || type.includes('numeric') ||
        type.includes('bigint') || type.includes('smallint') || type.includes('real')) {
      return 'number';
    }
    if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
      return 'date';
    }
    if (type.includes('bool')) {
      return 'boolean';
    }
    return 'text';
  };

  // Get columns from tableDetails or show loading/empty state
  const getColumns = () => {
    if (!tableDetails) {
      return null; // Loading state
    }
    
    if (tableDetails.columns && Array.isArray(tableDetails.columns)) {
      return tableDetails.columns.map(col => ({
        name: col.name || col.column_name,
        type: col.data_type || col.type,
        icon: getIconType(col.data_type || col.type)
      }));
    }
    
    return []; // Empty state
  };

  const columns = getColumns();

  const getFieldIcon = (type) => {
    if (type === 'text') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    if (type === 'date') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (type === 'number') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      );
    }
    if (type === 'boolean') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    // Default icon
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  // Loading state
  if (columns === null) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Text variant="subtitle2" className="font-medium text-xs text-gray-700 dark:text-gray-300">
            {tableName}
          </Text>
        </div>
        <div className={`text-xs py-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Loading columns...
        </div>
      </div>
    );
  }

  // Empty state
  if (columns.length === 0) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Text variant="subtitle2" className="font-medium text-xs text-gray-700 dark:text-gray-300">
            {tableName}
          </Text>
        </div>
        <div className={`text-xs py-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          No columns found
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 max-h-80 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Text variant="subtitle2" className="font-medium text-xs text-gray-700 dark:text-gray-300">
            {tableName}
          </Text>
          <Text color="secondary" className="text-xs">
            {columns.length} columns
          </Text>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-0.5">
        {columns.map((field, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-1.5 rounded transition-colors ${isDark ? 'hover:bg-[#1c1d1f]/60' : 'hover:bg-gray-100/60'}`}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <div className={`flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {getFieldIcon(field.icon)}
              </div>
              <div className="min-w-0 flex-1">
                <Text className="font-medium text-xs truncate">
                  {field.name}
                </Text>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              <Text color="secondary" className="text-xs font-mono">
                {field.type}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableSchema;

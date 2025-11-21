import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Text } from './ui';

const TableSchema = ({ tableName }) => {
  const { isDark } = useTheme();

  // Mock table schema data - in real app this would come from API
  const getTableSchema = (tableName) => {
    const schemas = {
      'CUSTOMERS': [
        { name: 'CUSTOMER_ID', type: 'NUMBER(38,0)', icon: 'number' },
        { name: 'FIRST_NAME', type: 'VARCHAR(100)', icon: 'text' },
        { name: 'LAST_NAME', type: 'VARCHAR(100)', icon: 'text' },
        { name: 'EMAIL', type: 'VARCHAR(255)', icon: 'text' },
        { name: 'PHONE', type: 'VARCHAR(20)', icon: 'text' },
        { name: 'ADDRESS', type: 'VARCHAR(500)', icon: 'text' },
        { name: 'CITY', type: 'VARCHAR(100)', icon: 'text' },
        { name: 'STATE', type: 'VARCHAR(50)', icon: 'text' },
        { name: 'ZIP_CODE', type: 'VARCHAR(10)', icon: 'text' },
        { name: 'CREATED_AT', type: 'TIMESTAMP', icon: 'date' }
      ],
      'ORDERS': [
        { name: 'ORDER_ID', type: 'NUMBER(38,0)', icon: 'number' },
        { name: 'CUSTOMER_ID', type: 'NUMBER(38,0)', icon: 'number' },
        { name: 'ORDER_DATE', type: 'DATE', icon: 'date' },
        { name: 'ORDER_TOTAL', type: 'NUMBER(10,2)', icon: 'number' },
        { name: 'STATUS', type: 'VARCHAR(50)', icon: 'text' },
        { name: 'SHIPPING_ADDRESS', type: 'VARCHAR(500)', icon: 'text' },
        { name: 'PAYMENT_METHOD', type: 'VARCHAR(50)', icon: 'text' }
      ],
      'PRODUCTS': [
        { name: 'PRODUCT_ID', type: 'NUMBER(38,0)', icon: 'number' },
        { name: 'PRODUCT_NAME', type: 'VARCHAR(255)', icon: 'text' },
        { name: 'DESCRIPTION', type: 'TEXT', icon: 'text' },
        { name: 'PRICE', type: 'NUMBER(10,2)', icon: 'number' },
        { name: 'CATEGORY_ID', type: 'NUMBER(38,0)', icon: 'number' },
        { name: 'SKU', type: 'VARCHAR(50)', icon: 'text' },
        { name: 'STOCK_QUANTITY', type: 'NUMBER(10,0)', icon: 'number' },
        { name: 'IS_ACTIVE', type: 'BOOLEAN', icon: 'text' }
      ],
      default: [
        { name: 'ID', type: 'NUMBER(38,0)', icon: 'number' },
        { name: 'NAME', type: 'VARCHAR(255)', icon: 'text' },
        { name: 'CREATED_AT', type: 'TIMESTAMP', icon: 'date' },
        { name: 'UPDATED_AT', type: 'TIMESTAMP', icon: 'date' }
      ]
    };
    
    return schemas[tableName] || schemas.default;
  };

  const fields = getTableSchema(tableName);

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
    // Default icon
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const MoreIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );

  const CopyIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  return (
    <div className="p-3 max-h-80 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Text variant="subtitle2" className="font-medium text-xs text-gray-700 dark:text-gray-300">
            {tableName}
          </Text>
          <Text color="secondary" className="text-xs">
            1.6M Rows
          </Text>
        </div>
        <div className="flex items-center space-x-0.5">
          <button className={`p-0.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}>
            <CopyIcon />
          </button>
          <button className={`p-0.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}>
            <MoreIcon />
          </button>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-0.5">
        {fields.map((field, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-1.5 rounded transition-colors ${isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-100/60'}`}
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
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Table = ({ 
  data = [],
  columns = [],
  striped = false,
  bordered = false,
  hoverable = true,
  size = 'md',
  loading = false,
  emptyMessage = 'No data available',
  className = '',
  ...props 
}) => {
  const { isDark } = useTheme();
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base', 
    lg: 'text-lg',
  };
  
  const cellPaddingClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };
  
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-8">
      <svg 
        className="animate-spin h-8 w-8 text-primary-600" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
  
  const EmptyState = () => (
    <div className="text-center py-8">
      <div className="text-gray-500 dark:text-gray-400 mb-2">
        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {emptyMessage}
      </p>
    </div>
  );
  
  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
        <LoadingSpinner />
      </div>
    );
  }
  
  if (!data.length) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
        <EmptyState />
      </div>
    );
  }
  
  return (
    <div className={`overflow-hidden bg-white dark:bg-gray-800 shadow rounded-lg ${className}`} {...props}>
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${sizeClasses[size]}`}>
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`
                    ${cellPaddingClasses[size]}
                    text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider
                    ${column.width ? `w-${column.width}` : ''}
                    ${column.className || ''}
                  `.trim().replace(/\s+/g, ' ')}
                  style={column.style}
                >
                  {column.title || column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`
            bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700
            ${striped ? 'divide-y-0' : ''}
          `}>
            {data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                className={`
                  ${striped && rowIndex % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                  ${hoverable ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-150' : ''}
                  ${bordered ? 'border-b border-gray-200 dark:border-gray-700' : ''}
                `.trim().replace(/\s+/g, ' ')}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={`${rowIndex}-${column.key || colIndex}`}
                    className={`
                      ${cellPaddingClasses[size]}
                      text-gray-900 dark:text-white
                      ${column.cellClassName || ''}
                    `.trim().replace(/\s+/g, ' ')}
                    style={column.cellStyle}
                  >
                    {column.render ? 
                      column.render(row[column.key || column.dataIndex], row, rowIndex) : 
                      row[column.key || column.dataIndex]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// TableHeader component for custom headers
Table.Header = ({ children, className = '', ...props }) => (
  <thead className={`bg-gray-50 dark:bg-gray-700 ${className}`} {...props}>
    {children}
  </thead>
);

// TableBody component for custom body
Table.Body = ({ children, className = '', ...props }) => (
  <tbody className={`bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 ${className}`} {...props}>
    {children}
  </tbody>
);

// TableRow component
Table.Row = ({ children, className = '', hoverable = true, ...props }) => (
  <tr className={`
    ${hoverable ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-150' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ')} {...props}>
    {children}
  </tr>
);

// TableCell component
Table.Cell = ({ children, className = '', ...props }) => (
  <td className={`px-4 py-3 text-gray-900 dark:text-white ${className}`} {...props}>
    {children}
  </td>
);

// TableHeaderCell component
Table.HeaderCell = ({ children, className = '', ...props }) => (
  <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${className}`} {...props}>
    {children}
  </th>
);

export default Table;
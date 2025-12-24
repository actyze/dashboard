import React, { useState, useEffect } from 'react';
import { TablePagination } from '@mui/material';
import { Card, Table } from '../ui';

const QueryResults = ({ 
  queryData, 
  loading = false, 
  error = null
}) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    if (queryData && queryData.data && queryData.columns) {
      setData(queryData.data);
      setColumns(queryData.columns);
      setTotalRows(queryData.rowCount || queryData.data.length);
      setPage(0);
    }
  }, [queryData]);


  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportToCSV = () => {
    if (!data || !columns) return;

    const csvContent = [
      // Header row
      columns.map(col => col.label || col.name).join(','),
      // Data rows
      ...data.map(row => 
        columns.map(col => {
          const value = row[col.name];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCellContent = (row, column, rowIndex) => {
    const value = row[column.name];
    return formatCellValue(value, column.type);
  };

  const formatCellValue = (value, type) => {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return String(value);
    }
  };

  // Create table structure for our custom Table component
  const tableColumns = columns.map(column => ({
    key: column.name,
    title: column.label || column.name,
    render: (value) => formatCellValue(value, column.type)
  }));

  // Table icon for empty/loading states
  const TableIcon = () => (
    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <svg className="w-10 h-10 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Loading results...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Error Loading Results
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <TableIcon />
            </div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              No Results
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Execute a query to see results here
            </p>
          </div>
        </div>
      </div>
    );
  }

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header outside card */}
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Query Results
        </span>
        
        {/* Export CSV Icon Button with Tooltip */}
        <div className="relative group">
          <button
            onClick={exportToCSV}
            className="p-1.5 rounded-md transition-all duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-50 bg-[#1c1d1f] text-white dark:bg-gray-900 dark:border dark:border-gray-700 shadow-lg">
            Export CSV
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-900" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
        <Card.Body className="p-0 flex-1 flex flex-col overflow-hidden">
          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table
              data={paginatedData}
              columns={tableColumns}
              hoverable
            />
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={totalRows}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ 
                '& .MuiTablePagination-toolbar': { minHeight: '40px' },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.75rem' }
              }}
            />
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default QueryResults;

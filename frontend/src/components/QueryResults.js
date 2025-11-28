import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, TablePagination } from '@mui/material';
import { Card, Table, Alert, Button, Text } from './ui';

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

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="text-center">
            <CircularProgress sx={{ mb: 2 }} />
            <Text variant="caption" color="secondary">
              Loading query results...
            </Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
        <Text color="secondary">
          Unable to load query results. Please try again.
        </Text>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <div className="text-center min-h-[200px] flex flex-col justify-center">
          <Text variant="h6" color="secondary" className="mb-2">
            No Results
          </Text>
          <Text color="secondary">
            Execute a query to see results here
          </Text>
        </div>
      </Card>
    );
  }

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  
  const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-4-4m4 4l4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <Card className="w-full h-full flex flex-col">
      {/* Header with actions */}
      <Card.Header className="flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <Card.Title>Query Results</Card.Title>
            <Text color="secondary">
              {totalRows.toLocaleString()} rows, {columns.length} columns
            </Text>
          </div>
          <Button
            leftIcon={<DownloadIcon />}
            onClick={exportToCSV}
            size="sm"
            variant="outline"
          >
            Export CSV
          </Button>
        </div>
      </Card.Header>

      <Card.Body className="p-0 flex-1 flex flex-col overflow-hidden">
        {/* Custom Table */}
        <div className="flex-1 overflow-auto">
          <Table
            data={paginatedData}
            columns={tableColumns}
            striped
            hoverable
          />
        </div>

        {/* Pagination */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={totalRows}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </div>
      </Card.Body>
    </Card>
  );
};

export default QueryResults;

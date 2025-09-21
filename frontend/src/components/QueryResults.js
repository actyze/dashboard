import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Stack,
  Button,
  TablePagination
} from '@mui/material';
import {
  Download as DownloadIcon
} from '@mui/icons-material';

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
      setPage(0); // Reset to first page when new data arrives
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

    return (
      <Typography variant="body2">
        {formatCellValue(value, column.type)}
      </Typography>
    );
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

  const renderColumnHeader = (column) => (
    <TableCell key={column.name} sx={{ fontWeight: 'bold' }}>
      <Typography variant="subtitle2">
        {column.label || column.name}
      </Typography>
    </TableCell>
  );

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Loading query results...
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Unable to load query results. Please try again.
        </Typography>
      </Paper>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ textAlign: 'center', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execute a query to see results here
          </Typography>
        </Box>
      </Paper>
    );
  }

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper sx={{ width: '100%' }}>
      {/* Header with actions */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">Query Results</Typography>
          <Typography variant="body2" color="text.secondary">
            {totalRows.toLocaleString()} rows, {columns.length} columns
          </Typography>
        </Box>
        <Button
          startIcon={<DownloadIcon />}
          onClick={exportToCSV}
          size="small"
          variant="outlined"
        >
          Export CSV
        </Button>
      </Box>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map(renderColumnHeader)}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow key={page * rowsPerPage + index} hover>
                {columns.map((column) => (
                  <TableCell key={column.name}>
                    {renderCellContent(row, column, page * rowsPerPage + index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={totalRows}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default QueryResults;

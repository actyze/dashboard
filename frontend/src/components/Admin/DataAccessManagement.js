/**
 * Data Access Management Component
 * Visual schema browser to select databases/schemas/tables for group access
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as DatabaseIcon,
  ChevronRight as ChevronRightIcon,
  TableChart as TableIcon,
  ViewColumn as ColumnIcon,
  Schema as SchemaIcon
} from '@mui/icons-material';
import AdminService from '../../services/AdminService';
import { RestService } from '../../services/RestService';
import { useGetDatabases } from '../../hooks/useRestAPI';

function DataAccessManagement() {
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
    // Load schemas for a database if not already cached (same as DatabaseSchemaPanel)
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
    // Databases are already loaded via useGetDatabases hook
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
      result += ` (Columns: ${rule.allowed_columns.join(', ')})`;
    }
    return result;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Group Selector */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel>Select Group</InputLabel>
          <Select
            value={selectedGroup || ''}
            onChange={(e) => setSelectedGroup(e.target.value)}
            label="Select Group"
          >
            {groups.map((group) => (
              <MenuItem key={group.id} value={group.id}>
                {group.name} ({group.member_count} members)
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenBrowser}
          disabled={!selectedGroup}
        >
          Add Data Access
        </Button>
      </Box>

      {/* Access Rules Table */}
      {selectedGroup && (
        <>
          <Typography variant="h6" className="dark:text-gray-200" gutterBottom>
            Access Rules ({accessRules.length})
          </Typography>
          <TableContainer component={Paper} className="dark:bg-gray-800">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell className="dark:text-gray-200">Resource</TableCell>
                  <TableCell className="dark:text-gray-200">Database</TableCell>
                  <TableCell className="dark:text-gray-200">Schema</TableCell>
                  <TableCell className="dark:text-gray-200">Table</TableCell>
                  <TableCell className="dark:text-gray-200">Columns</TableCell>
                  <TableCell align="right" className="dark:text-gray-200">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accessRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" className="dark:text-gray-500">
                      No access rules defined. Add one to grant data access.
                    </TableCell>
                  </TableRow>
                ) : (
                  accessRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="dark:text-gray-300">
                        <strong>{formatAccessRule(rule)}</strong>
                      </TableCell>
                      <TableCell className="dark:text-gray-300">
                        {rule.database_name || <Chip label="ALL" size="small" />}
                      </TableCell>
                      <TableCell className="dark:text-gray-300">
                        {rule.schema_name || <Chip label="ALL" size="small" />}
                      </TableCell>
                      <TableCell className="dark:text-gray-300">
                        {rule.table_name || <Chip label="ALL" size="small" />}
                      </TableCell>
                      <TableCell>
                        {rule.allowed_columns && rule.allowed_columns.length > 0 ? (
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {rule.allowed_columns.map((col, idx) => (
                              <Chip key={idx} label={col} size="small" variant="outlined" />
                            ))}
                          </Box>
                        ) : (
                          <Chip label="ALL" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveAccessRule(rule.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Schema Browser Dialog */}
      <Dialog open={openBrowserDialog} onClose={handleCloseBrowser} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DatabaseIcon />
            Select Database Access
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box mt={2}>
            {isDatabasesLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : databasesError ? (
              <Alert severity="error">Failed to load databases</Alert>
            ) : (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Use checkboxes to select database, schema, table, or specific columns. Selecting a higher level grants access to all child resources.
                </Alert>

                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                  Selected: <strong>{formatAccessRule(selectedAccess) || 'None'}</strong>
                </Typography>

                {/* Tree View with Checkboxes */}
                <Box sx={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                  bgcolor: 'background.default'
                }}>
                  {databasesData?.databases?.map((db) => (
                    <Box key={db.name} sx={{ mb: 0.5 }}>
                      {/* Database Level */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          p: 0.5,
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'action.hover' },
                          cursor: 'pointer'
                        }}
                      >
                        <IconButton 
                          size="small" 
                          onClick={() => toggleDatabase(db.name)}
                          sx={{ mr: 0.5, width: 24, height: 24 }}
                        >
                          <ChevronRightIcon 
                            fontSize="small"
                            sx={{ 
                              transform: expandedDatabases.has(db.name) ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.2s'
                            }}
                          />
                        </IconButton>
                        <Checkbox
                          size="small"
                          checked={isSelected(db.name)}
                          onChange={(e) => handleSelectDatabase(db.name, e.target.checked)}
                          sx={{ mr: 0.5 }}
                        />
                        <DatabaseIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {db.name}
                        </Typography>
                        <Chip 
                          label={`${db.schema_count} schemas`} 
                          size="small" 
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>

                      {/* Schema Level */}
                      {expandedDatabases.has(db.name) && (
                        <Box sx={{ ml: 4 }}>
                          {schemaCache[db.name] ? (
                            schemaCache[db.name].map((schema) => {
                              const schemaKey = `${db.name}.${schema.name}`;
                              return (
                                <Box key={schema.name} sx={{ mb: 0.5 }}>
                                  <Box 
                                    sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      p: 0.5,
                                      borderRadius: 1,
                                      '&:hover': { bgcolor: 'action.hover' },
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <IconButton 
                                      size="small" 
                                      onClick={() => toggleSchema(db.name, schema.name)}
                                      sx={{ mr: 0.5, width: 24, height: 24 }}
                                    >
                                      <ChevronRightIcon 
                                        fontSize="small"
                                        sx={{ 
                                          transform: expandedSchemas.has(schemaKey) ? 'rotate(90deg)' : 'none',
                                          transition: 'transform 0.2s'
                                        }}
                                      />
                                    </IconButton>
                                    <Checkbox
                                      size="small"
                                      checked={isSelected(db.name, schema.name)}
                                      onChange={(e) => handleSelectSchema(db.name, schema.name, e.target.checked)}
                                      sx={{ mr: 0.5 }}
                                    />
                                    <SchemaIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
                                    <Typography variant="body2">
                                      {schema.name}
                                    </Typography>
                                    <Chip 
                                      label={`${schema.table_count} tables`} 
                                      size="small" 
                                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                    />
                                  </Box>

                                  {/* Table Level */}
                                  {expandedSchemas.has(schemaKey) && (
                                    <Box sx={{ ml: 4 }}>
                                      {tablesCache[schemaKey] ? (
                                        <>
                                          {/* Tables */}
                                          {tablesCache[schemaKey].tables?.map((table) => {
                                            const tableKey = `${db.name}.${schema.name}.${table.name}`;
                                            return (
                                              <Box key={table.name} sx={{ mb: 0.5 }}>
                                                <Box 
                                                  sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center',
                                                    p: 0.5,
                                                    borderRadius: 1,
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  <IconButton 
                                                    size="small" 
                                                    onClick={() => toggleTable(db.name, schema.name, table.name)}
                                                    sx={{ mr: 0.5, width: 24, height: 24 }}
                                                  >
                                                    <ChevronRightIcon 
                                                      fontSize="small"
                                                      sx={{ 
                                                        transform: expandedTables.has(tableKey) ? 'rotate(90deg)' : 'none',
                                                        transition: 'transform 0.2s'
                                                      }}
                                                    />
                                                  </IconButton>
                                                  <Checkbox
                                                    size="small"
                                                    checked={isSelected(db.name, schema.name, table.name)}
                                                    onChange={(e) => handleSelectTable(db.name, schema.name, table.name, e.target.checked)}
                                                    sx={{ mr: 0.5 }}
                                                  />
                                                  <TableIcon fontSize="small" sx={{ mr: 1, color: 'info.main' }} />
                                                  <Typography variant="body2">
                                                    {table.name}
                                                  </Typography>
                                                  <Chip 
                                                    label={`${table.column_count} cols`} 
                                                    size="small" 
                                                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                                  />
                                                </Box>

                                                {/* Column Level */}
                                                {expandedTables.has(tableKey) && (
                                                  <Box sx={{ ml: 4 }}>
                                                    {tableDetailsCache[tableKey] ? (
                                                      tableDetailsCache[tableKey].columns?.map((column) => (
                                                        <Box 
                                                          key={column.name}
                                                          sx={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center',
                                                            p: 0.5,
                                                            borderRadius: 1,
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                          }}
                                                        >
                                                          <Box sx={{ width: 24, height: 24, mr: 0.5 }} /> {/* Spacer */}
                                                          <Checkbox
                                                            size="small"
                                                            checked={isSelected(db.name, schema.name, table.name, column.name)}
                                                            onChange={(e) => handleSelectColumn(db.name, schema.name, table.name, column.name, e.target.checked)}
                                                            sx={{ mr: 0.5 }}
                                                          />
                                                          <ColumnIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                                          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                                                            {column.name}
                                                          </Typography>
                                                          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                                            {column.type}
                                                          </Typography>
                                                        </Box>
                                                      ))
                                                    ) : (
                                                      <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                                                        Loading columns...
                                                      </Typography>
                                                    )}
                                                  </Box>
                                                )}
                                              </Box>
                                            );
                                          })}
                                        </>
                                      ) : (
                                        <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                                          Loading tables...
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              );
                            })
                          ) : (
                            <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                              Loading schemas...
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBrowser}>Cancel</Button>
          <Button
            onClick={handleAddAccessRule}
            variant="contained"
            disabled={!selectedAccess.database_name}
          >
            Add Access Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DataAccessManagement;


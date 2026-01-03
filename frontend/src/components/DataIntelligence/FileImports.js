/**
 * File Imports Component
 * Upload CSV and Excel files with validation and column type editing
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import FileUploadService from '../../services/FileUploadService';
import { validateFile, SQL_TYPE_OPTIONS } from '../../utils/fileValidator';

function FileImports() {
  const { isDark } = useTheme();
  const { showSuccess, showError, showWarning } = useToast();
  const fileInputRef = useRef(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Validation results
  const [validationResult, setValidationResult] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Column type editing
  const [columnTypes, setColumnTypes] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  // Table configuration state
  const [tableName, setTableName] = useState('');
  const [isTemporary, setIsTemporary] = useState(true);
  const [retentionDays, setRetentionDays] = useState(1);
  const [insertIntoExisting, setInsertIntoExisting] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');

  // User tables state
  const [userTables, setUserTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [showUploadHistory, setShowUploadHistory] = useState(false);

  useEffect(() => {
    loadUserTables();
  }, []);

  const loadUserTables = async () => {
    try {
      setLoadingTables(true);
      const tables = await FileUploadService.getUserTables();
      setUserTables(tables);
    } catch (err) {
      console.error('Failed to load user tables:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await validateAndSetFile(file);
    }
  };

  const validateAndSetFile = async (file) => {
    setValidating(true);
    setValidationResult(null);
    setValidationErrors([]);
    setColumnTypes({});

    try {
      const result = await validateFile(file);

      if (!result.isValid) {
        setValidationErrors(result.errors);
        showError(`File validation failed: ${result.errors[0]}`);
        setSelectedFile(null);
        return;
      }

      // Validation passed
      setSelectedFile(file);
      setValidationResult(result);
      setColumnTypes(result.data.columnTypes);
      setShowPreview(true);

      // Auto-generate table name from filename
      if (!tableName) {
        const baseName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        setTableName(baseName);
      }

      showSuccess(`File validated successfully! ${result.data.totalRows} rows, ${result.data.headers.length} columns`);

    } catch (error) {
      setValidationErrors([error.message]);
      showError(`Validation error: ${error.message}`);
      setSelectedFile(null);
    } finally {
      setValidating(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await validateAndSetFile(file);
    }
  };

  const handleColumnTypeChange = (columnName, newType) => {
    setColumnTypes(prev => ({
      ...prev,
      [columnName]: newType
    }));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError('Please select a file');
      return;
    }

    if (insertIntoExisting && !selectedTableId) {
      showError('Please select a table to insert into');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('table_name', tableName);
      formData.append('is_temporary', isTemporary);
      formData.append('retention_days', retentionDays);
      formData.append('insert_into_existing', insertIntoExisting);
      if (insertIntoExisting && selectedTableId) {
        formData.append('existing_table_id', selectedTableId);
      }
      // Send column types
      formData.append('column_types', JSON.stringify(columnTypes));

      const result = await FileUploadService.uploadFile(formData);
      
      showSuccess(result.message || 'File uploaded successfully');
      
      // Reset form
      setSelectedFile(null);
      setValidationResult(null);
      setValidationErrors([]);
      setColumnTypes({});
      setShowPreview(false);
      setTableName('');
      setInsertIntoExisting(false);
      setSelectedTableId('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Reload user tables
      await loadUserTables();
      
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTable = async (tableId, tableName) => {
    if (!window.confirm(`Are you sure you want to delete table "${tableName}"? This will remove all data.`)) {
      return;
    }

    try {
      const result = await FileUploadService.deleteTable(tableId);
      showSuccess(result.message || 'Table deleted successfully');
      
      // Reload user tables
      await loadUserTables();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete table');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setValidationErrors([]);
    setColumnTypes({});
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: isDark ? '#2a2b2e' : '#e5e7eb' }}>
        <div>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Upload CSV or Excel files with validation and type detection
          </p>
        </div>
        <button
          onClick={() => setShowUploadHistory(!showUploadHistory)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            isDark 
              ? 'text-gray-300 hover:bg-[#1c1d1f]' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showUploadHistory ? 'Hide' : 'Show'} History
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
              isDragging
                ? isDark ? 'border-[#5d6ad3] bg-[#2a2b2e]' : 'border-[#5d6ad3] bg-blue-50'
                : isDark ? 'border-[#2a2b2e] hover:border-[#3a3b3e]' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {validating ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5d6ad3] mx-auto mb-3"></div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Validating file...
                </p>
              </div>
            ) : selectedFile && validationResult ? (
              <div className="text-center">
                <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-green-400' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedFile.name}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {formatFileSize(selectedFile.size)} • {validationResult.data.totalRows} rows • {validationResult.data.headers.length} columns
                </p>
                <button
                  onClick={removeFile}
                  className={`mt-3 text-xs ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
                >
                  Remove file
                </button>
              </div>
            ) : validationErrors.length > 0 ? (
              <div className="text-center">
                <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  Validation Failed
                </p>
                <div className={`text-xs text-left max-w-lg mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {validationErrors.map((error, idx) => (
                    <div key={idx} className="mb-1">• {error}</div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setValidationErrors([]);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className={`mt-4 text-xs ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
                >
                  Try another file
                </button>
              </div>
            ) : (
              <div className="text-center">
                <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className={`text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Drop your file here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#5d6ad3] hover:underline"
                  >
                    browse
                  </button>
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  CSV or Excel with ONE sheet only (up to 50MB)
                </p>
              </div>
            )}
          </div>

          {/* Validation Rules */}
          {!selectedFile && !validating && validationErrors.length === 0 && (
            <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e]' : 'bg-gray-50 border-gray-200'}`}>
              <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>File Requirements</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className={`font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Excel (.xlsx)</p>
                  <ul className={`space-y-0.5 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    <li>• Exactly ONE worksheet</li>
                    <li>• Header row must be first</li>
                    <li>• All headers non-empty</li>
                    <li>• Rectangular data (no ragged rows)</li>
                    <li>• No merged cells</li>
                    <li>• Max 50MB</li>
                  </ul>
                </div>
                <div>
                  <p className={`font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>CSV</p>
                  <ul className={`space-y-0.5 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    <li>• UTF-8 encoding</li>
                    <li>• Header required</li>
                    <li>• Consistent column count</li>
                    <li>• No empty headers</li>
                    <li>• Max 50MB</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Column Type Editor */}
          {selectedFile && validationResult && showPreview && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Column Types & Preview
                </h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-xs ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>

              {showPreview && (
                <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className={isDark ? 'bg-[#1c1d1f]' : 'bg-gray-50'}>
                        <tr>
                          <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Column Name
                          </th>
                          <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Detected Type
                          </th>
                          <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Sample Data
                          </th>
                        </tr>
                      </thead>
                      <tbody className={isDark ? 'divide-y divide-[#2a2b2e]' : 'divide-y divide-gray-200'}>
                        {validationResult.data.headers.map((header, idx) => (
                          <tr key={idx} className={isDark ? 'hover:bg-[#17181a]' : 'hover:bg-gray-50'}>
                            <td className={`px-3 py-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {header}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={columnTypes[header] || 'text'}
                                onChange={(e) => handleColumnTypeChange(header, e.target.value)}
                                className={`px-2 py-1 text-xs rounded border ${
                                  isDark
                                    ? 'bg-[#17181a] border-[#2a2b2e] text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                } focus:outline-none focus:ring-1 focus:ring-[#5d6ad3]`}
                              >
                                {SQL_TYPE_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className={`px-3 py-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {validationResult.data.rows[0]?.[header]?.toString().substring(0, 50) || '(empty)'}
                              {validationResult.data.rows[0]?.[header]?.toString().length > 50 && '...'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Table Configuration */}
              <div className="space-y-4">
                {/* Table Name */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="Enter table name"
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isDark
                        ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]`}
                  />
                </div>

                {/* Insert into Existing */}
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e]' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={insertIntoExisting}
                      onChange={(e) => setInsertIntoExisting(e.target.checked)}
                      className="w-4 h-4 text-[#5d6ad3] border-gray-300 rounded focus:ring-[#5d6ad3]"
                    />
                    <span className={`ml-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Insert into existing table
                    </span>
                  </label>
                  <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Columns must match exactly
                  </p>
                  {insertIntoExisting && (
                    <select
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className={`mt-2 w-full px-3 py-2 text-sm rounded-lg border ${
                        isDark
                          ? 'bg-[#17181a] border-[#2a2b2e] text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]`}
                    >
                      <option value="">Select table...</option>
                      {userTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.table_name} ({table.row_count} rows, {table.column_count} cols)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Temp vs Permanent */}
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e]' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <label className="flex items-center cursor-pointer flex-1">
                      <input
                        type="radio"
                        checked={isTemporary}
                        onChange={() => setIsTemporary(true)}
                        className="w-4 h-4 text-[#5d6ad3]"
                      />
                      <div className="ml-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Temporary Table
                        </span>
                        <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                          Recommended
                        </span>
                      </div>
                    </label>
                  </div>

                  {isTemporary && (
                    <div className="ml-6 mb-3">
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Retention Period
                      </label>
                      <select
                        value={retentionDays}
                        onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                        className={`w-full px-3 py-2 text-sm rounded-lg border ${
                          isDark
                            ? 'bg-[#17181a] border-[#2a2b2e] text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-[#5d6ad3]`}
                      >
                        <option value="1">1 day</option>
                        <option value="2">2 days</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days (maximum)</option>
                      </select>
                    </div>
                  )}

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={!isTemporary}
                      onChange={() => setIsTemporary(false)}
                      className="w-4 h-4 text-[#5d6ad3]"
                    />
                    <span className={`ml-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Permanent Table
                    </span>
                  </label>

                  {!isTemporary && (
                    <div className={`mt-3 p-2.5 rounded flex items-start gap-2 ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                      <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className={`text-xs ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                        <strong>Warning:</strong> Permanent tables consume database storage.
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile}
                  className={`w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-colors ${
                    uploading || !selectedFile
                      ? isDark
                        ? 'bg-[#2a2b2e] text-gray-500 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-[#5d6ad3] text-white hover:bg-[#4d5ac3]'
                  }`}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </span>
                  ) : (
                    'Create Table'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Upload History */}
          {showUploadHistory && (
            <div className="mt-6">
              <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Your Uploaded Tables
              </h3>
              {loadingTables ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5d6ad3] mx-auto"></div>
                </div>
              ) : userTables.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  <p className="text-sm">No uploaded tables yet</p>
                </div>
              ) : (
                <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={isDark ? 'bg-[#1c1d1f]' : 'bg-gray-50'}>
                        <tr>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Table Name</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Original File</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Rows</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Type</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Expires</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={isDark ? 'divide-y divide-[#2a2b2e]' : 'divide-y divide-gray-200'}>
                        {userTables.map((table) => (
                          <tr key={table.id} className={isDark ? 'hover:bg-[#1c1d1f]' : 'hover:bg-gray-50'}>
                            <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {table.table_name}
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {table.original_filename}
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {table.row_count?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                table.is_temporary
                                  ? isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                                  : isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {table.is_temporary ? 'Temporary' : 'Permanent'}
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {table.is_temporary && table.expires_at ? formatDate(table.expires_at) : 'Never'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteTable(table.id, table.table_name)}
                                className={`p-1.5 rounded transition-colors ${
                                  isDark
                                    ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                                    : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                                }`}
                                title="Delete table (truncate data)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileImports;

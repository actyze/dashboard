/**
 * File Validation Utilities
 * Frontend validation for CSV and Excel files before upload
 */

import * as XLSX from 'xlsx';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validate Excel file according to strict rules
 */
export const validateExcelFile = async (file) => {
  const errors = [];
  
  try {
    // Rule 1: File size check
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        errors: [`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 50MB limit`]
      };
    }

    // Read file
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellStyles: true });

    // Rule 2: Exactly ONE worksheet
    if (workbook.SheetNames.length !== 1) {
      errors.push(`Excel file must have exactly ONE worksheet. Found ${workbook.SheetNames.length}: ${workbook.SheetNames.join(', ')}`);
      return { isValid: false, errors };
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get the range
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Rule 3: Check for merged cells
    if (sheet['!merges'] && sheet['!merges'].length > 0) {
      errors.push(`Merged cells are not allowed. Found ${sheet['!merges'].length} merged cell(s)`);
    }

    // Convert to array of arrays
    const data_array = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (data_array.length === 0) {
      errors.push('File is empty');
      return { isValid: false, errors };
    }

    // Rule 4: Header row must be first row and all cells must be non-empty
    const headers = data_array[0];
    if (!headers || headers.length === 0) {
      errors.push('No header row found');
    } else {
      const emptyHeaders = headers.map((h, i) => ({ header: h, index: i }))
        .filter(({ header }) => !header || header.toString().trim() === '');
      
      if (emptyHeaders.length > 0) {
        errors.push(`All header cells must be non-empty. Found ${emptyHeaders.length} empty header(s) at column(s): ${emptyHeaders.map(h => h.index + 1).join(', ')}`);
      }
      
      // Rule 4b: Detect if first row looks like data instead of headers
      // Check for "Unnamed" pattern which indicates pandas/Excel couldn't find headers
      const unnamedPattern = /^unnamed/i;
      const hasUnnamedColumns = headers.some(h => unnamedPattern.test(h.toString().trim()));
      
      if (hasUnnamedColumns) {
        errors.push('Header row must be the FIRST row. Detected auto-generated column names (Unnamed), which suggests headers are missing or not in the first row.');
      }
      
      // Additional check: If first row is ALL numbers and second row exists with text, headers are likely wrong
      if (data_array.length > 1) {
        const firstRowAllNumbers = headers.every(h => !isNaN(parseFloat(h)) && isFinite(h));
        const secondRow = data_array[1];
        const secondRowHasText = secondRow && secondRow.some(cell => 
          typeof cell === 'string' && cell.trim() !== '' && isNaN(cell)
        );
        
        if (firstRowAllNumbers && secondRowHasText) {
          errors.push('Header row must be the FIRST row. The first row appears to contain numeric data instead of column names.');
        }
      }
    }

    // Rule 5: Rectangular data only (consistent column count)
    if (data_array.length > 1) {
      const headerColCount = headers.length;
      const raggedRows = [];
      
      for (let i = 1; i < data_array.length; i++) {
        const row = data_array[i];
        // Remove trailing empty cells for comparison
        const nonEmptyColCount = row.length;
        
        if (nonEmptyColCount !== headerColCount) {
          raggedRows.push({ row: i + 1, cols: nonEmptyColCount, expected: headerColCount });
        }
      }

      if (raggedRows.length > 0) {
        errors.push(`All rows must have the same number of columns (${headerColCount}). Found ${raggedRows.length} ragged row(s). First issue at row ${raggedRows[0].row}: has ${raggedRows[0].cols} columns, expected ${raggedRows[0].expected}`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Parse data for preview and type detection
    const parsedData = parseExcelData(workbook, sheetName);
    
    return {
      isValid: true,
      errors: [],
      data: parsedData
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to parse Excel file: ${error.message}`]
    };
  }
};

/**
 * Validate CSV file according to strict rules
 */
export const validateCSVFile = async (file) => {
  const errors = [];

  try {
    // Rule 1: File size check
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        errors: [`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 50MB limit`]
      };
    }

    // Rule 2: UTF-8 encoding check
    const text = await file.text();
    
    // Try to detect non-UTF8 characters
    const hasInvalidChars = /[\uFFFD]/.test(text);
    if (hasInvalidChars) {
      errors.push('File must be UTF-8 encoded. Non-UTF8 characters detected.');
    }

    // Parse CSV
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      errors.push('File is empty');
      return { isValid: false, errors };
    }

    // Rule 3: Header required
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);

    if (headers.length === 0) {
      errors.push('No header row found');
    }

    // Rule 4: No empty header names
    const emptyHeaders = headers.map((h, i) => ({ header: h, index: i }))
      .filter(({ header }) => !header || header.trim() === '');
    
    if (emptyHeaders.length > 0) {
      errors.push(`All header names must be non-empty. Found ${emptyHeaders.length} empty header(s) at position(s): ${emptyHeaders.map(h => h.index + 1).join(', ')}`);
    }
    
    // Rule 4b: Detect if first row looks like data instead of headers
    const unnamedPattern = /^unnamed/i;
    const hasUnnamedColumns = headers.some(h => unnamedPattern.test(h.trim()));
    
    if (hasUnnamedColumns) {
      errors.push('Header row must be the FIRST row. Detected auto-generated column names (Unnamed), which suggests headers are missing or not in the first row.');
    }
    
    // Check if first row is ALL numbers (likely data, not headers)
    if (lines.length > 1) {
      const firstRowAllNumbers = headers.every(h => !isNaN(parseFloat(h.trim())) && isFinite(h.trim()));
      const secondLineData = parseCSVLine(lines[1]);
      const secondRowHasText = secondLineData.some(cell => 
        isNaN(cell.trim()) && cell.trim() !== ''
      );
      
      if (firstRowAllNumbers && secondRowHasText) {
        errors.push('Header row must be the FIRST row. The first row appears to contain numeric data instead of column names.');
      }
    }

    // Rule 5: Consistent column count
    const expectedColCount = headers.length;
    const inconsistentRows = [];

    for (let i = 1; i < Math.min(lines.length, 100); i++) { // Check first 100 rows for performance
      const cols = parseCSVLine(lines[i]);
      if (cols.length !== expectedColCount) {
        inconsistentRows.push({ row: i + 1, cols: cols.length, expected: expectedColCount });
      }
    }

    if (inconsistentRows.length > 0) {
      errors.push(`All rows must have ${expectedColCount} columns. Found ${inconsistentRows.length} inconsistent row(s). First issue at row ${inconsistentRows[0].row}: has ${inconsistentRows[0].cols} columns`);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Parse data for preview and type detection
    const parsedData = parseCSVData(text);

    return {
      isValid: true,
      errors: [],
      data: parsedData
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to parse CSV file: ${error.message}`]
    };
  }
};

/**
 * Parse CSV line (handles quoted fields)
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

/**
 * Detect column type from sample data
 */
export const detectColumnType = (values) => {
  // Remove null/empty values
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonEmpty.length === 0) {
    return 'text';
  }

  // Check if all are integers
  const allIntegers = nonEmpty.every(v => {
    const num = Number(v);
    return !isNaN(num) && Number.isInteger(num) && v.toString().trim() === num.toString();
  });
  if (allIntegers) return 'integer';

  // Check if all are floats
  const allFloats = nonEmpty.every(v => {
    const num = Number(v);
    return !isNaN(num);
  });
  if (allFloats) return 'float';

  // Check if all are booleans
  const allBooleans = nonEmpty.every(v => {
    const str = v.toString().toLowerCase();
    return ['true', 'false', '1', '0', 'yes', 'no'].includes(str);
  });
  if (allBooleans) return 'boolean';

  // Check if all are dates
  const allDates = nonEmpty.every(v => {
    const date = new Date(v);
    return !isNaN(date.getTime()) && v.toString().match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  });
  if (allDates) return 'timestamp';

  // Check max length for text vs varchar
  const maxLen = Math.max(...nonEmpty.map(v => v.toString().length));
  return maxLen > 255 ? 'text' : 'varchar';
};

/**
 * Parse Excel data with type detection
 */
const parseExcelData = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [], columnTypes: {} };
  }

  const headers = Object.keys(jsonData[0]);
  const rows = jsonData;

  // Detect types for each column
  const columnTypes = {};
  headers.forEach(header => {
    const values = rows.map(row => row[header]);
    columnTypes[header] = detectColumnType(values);
  });

  return {
    headers,
    rows: rows.slice(0, 10), // First 10 rows for preview
    totalRows: rows.length,
    columnTypes
  };
};

/**
 * Parse CSV data with type detection
 */
const parseCSVData = (text) => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return { headers: [], rows: [], columnTypes: {} };
  }

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || null;
    });
    rows.push(row);
  }

  // Detect types for each column
  const columnTypes = {};
  headers.forEach(header => {
    const values = rows.map(row => row[header]);
    columnTypes[header] = detectColumnType(values);
  });

  return {
    headers,
    rows: rows.slice(0, 10), // First 10 rows for preview
    totalRows: rows.length,
    columnTypes
  };
};

/**
 * Main validation function
 */
export const validateFile = async (file) => {
  const fileExt = file.name.split('.').pop().toLowerCase();
  
  if (fileExt === 'csv') {
    return await validateCSVFile(file);
  } else if (['xlsx', 'xls'].includes(fileExt)) {
    return await validateExcelFile(file);
  } else {
    return {
      isValid: false,
      errors: ['Unsupported file type. Only CSV and Excel (.xlsx, .xls) files are allowed.']
    };
  }
};

/**
 * SQL type options for user selection
 * These map directly to PostgreSQL/SQLAlchemy types
 */
export const SQL_TYPE_OPTIONS = [
  { value: 'varchar', label: 'Text (Short)' },
  { value: 'text', label: 'Text (Long)' },
  { value: 'integer', label: 'Integer' },
  { value: 'bigint', label: 'Big Integer' },
  { value: 'float', label: 'Decimal' },
  { value: 'numeric', label: 'Numeric (Precise)' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'timestamp', label: 'Date/Time' },
];


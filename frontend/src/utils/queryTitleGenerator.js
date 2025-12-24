/**
 * Generate a meaningful display title for a query when no custom name is provided.
 * Extracts key information from the natural language query or SQL to help users recall the query.
 */

/**
 * Extract a meaningful title from natural language query
 * @param {string} nlQuery - Natural language query
 * @returns {string} - Short, meaningful title
 */
export const generateTitleFromNL = (nlQuery) => {
  if (!nlQuery) return null;
  
  // Remove common question words and clean up
  let title = nlQuery
    .replace(/^(show me|get|find|list|display|what are|how many|give me|fetch)\s+/i, '')
    .replace(/^(the\s+)?/i, '')
    .trim();
  
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);
  
  // Truncate if too long
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  return title;
};

/**
 * Extract table names from SQL query
 * @param {string} sql - SQL query
 * @returns {string[]} - Array of table names
 */
const extractTableNames = (sql) => {
  if (!sql) return [];
  
  const tables = [];
  
  // Match FROM clause with table name (handle catalog.schema.table or just table)
  const fromMatches = sql.matchAll(/FROM\s+(?:[\w]+\.)?(?:[\w]+\.)?([\w]+)/gi);
  for (const match of fromMatches) {
    if (match[1] && !tables.includes(match[1])) {
      tables.push(match[1]);
    }
  }
  
  // Match JOIN clauses
  const joinMatches = sql.matchAll(/JOIN\s+(?:[\w]+\.)?(?:[\w]+\.)?([\w]+)/gi);
  for (const match of joinMatches) {
    if (match[1] && !tables.includes(match[1])) {
      tables.push(match[1]);
    }
  }
  
  return tables;
};

/**
 * Determine query operation type from SQL
 * @param {string} sql - SQL query
 * @returns {string} - Operation type (e.g., "SELECT", "COUNT", "SUM", etc.)
 */
const getQueryOperation = (sql) => {
  if (!sql) return 'Query';
  
  const upperSQL = sql.toUpperCase().trim();
  
  if (upperSQL.includes('COUNT(')) return 'Count';
  if (upperSQL.includes('SUM(')) return 'Sum';
  if (upperSQL.includes('AVG(')) return 'Average';
  if (upperSQL.includes('MAX(') || upperSQL.includes('MIN(')) return 'Stats';
  if (upperSQL.includes('GROUP BY')) return 'Group';
  if (upperSQL.startsWith('SELECT DISTINCT')) return 'Distinct';
  if (upperSQL.startsWith('SELECT')) return 'Select';
  
  return 'Query';
};

/**
 * Generate a meaningful title from SQL query
 * @param {string} sql - SQL query
 * @returns {string} - Short, meaningful title
 */
export const generateTitleFromSQL = (sql) => {
  if (!sql) return null;
  
  const operation = getQueryOperation(sql);
  const tables = extractTableNames(sql);
  
  if (tables.length === 0) {
    return `${operation} Query`;
  }
  
  // Format table names (remove common prefixes, capitalize)
  const formattedTables = tables
    .map(t => {
      // Remove common prefixes like demo_, test_, etc.
      let clean = t.replace(/^(demo_|test_|prod_)/, '');
      // Convert snake_case to Title Case
      clean = clean.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return clean;
    })
    .slice(0, 2); // Limit to first 2 tables
  
  let title = `${operation} from ${formattedTables.join(', ')}`;
  
  // Truncate if too long
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  return title;
};

/**
 * Get display title for a query
 * Priority: custom query_name > created_at timestamp > "Query"
 * @param {object} query - Query object with query_name, created_at
 * @returns {string} - Display title
 */
export const getQueryDisplayTitle = (query) => {
  // 1. Use custom name if provided
  if (query.query_name) {
    return query.query_name;
  }
  
  // 2. Use created_at timestamp as-is
  if (query.created_at) {
    return query.created_at;
  }
  
  // 3. Fallback
  return 'Query';
};


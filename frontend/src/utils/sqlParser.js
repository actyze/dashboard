/**
 * SQL Parser Utility
 * Extracts column names from SQL SELECT statements without executing the query
 */

/**
 * Extract column names from a SQL SELECT statement
 * @param {string} sql - The SQL query
 * @returns {Array<{name: string, alias: string|null}>} Array of column objects
 */
export const extractColumnsFromSQL = (sql) => {
  if (!sql || typeof sql !== 'string') {
    return [];
  }

  try {
    // Remove comments
    let cleanSql = sql
      .replace(/--.*$/gm, '') // Single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

    // Extract SELECT clause (between SELECT and FROM)
    const selectMatch = cleanSql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    if (!selectMatch) {
      return [];
    }

    const selectClause = selectMatch[1];

    // Handle SELECT *
    if (selectClause.trim() === '*') {
      return [{ name: '*', alias: null }];
    }

    // Split by commas, but respect parentheses and strings
    const columns = splitByComma(selectClause);

    return columns
      .map(col => {
        const trimmed = col.trim();
        if (!trimmed) return null;

        // Check for alias (AS keyword or implicit alias)
        // Pattern: column_name AS alias OR column_name alias
        const aliasMatch = trimmed.match(/^(.+?)\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)$/i);
        
        if (aliasMatch) {
          const [, expression, alias] = aliasMatch;
          // Extract the last identifier from the expression (e.g., m.year -> year)
          const columnName = extractColumnName(expression.trim());
          return {
            name: alias,
            alias: alias,
            originalExpression: expression.trim()
          };
        }

        // No alias - extract column name
        const columnName = extractColumnName(trimmed);
        return {
          name: columnName,
          alias: null,
          originalExpression: trimmed
        };
      })
      .filter(col => col !== null);

  } catch (error) {
    console.error('Error parsing SQL:', error);
    return [];
  }
};

/**
 * Split string by comma, respecting parentheses, quotes, and nested functions
 */
const splitByComma = (str) => {
  const result = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : null;

    // Handle string literals
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }

    if (!inString) {
      // Track parentheses depth
      if (char === '(') depth++;
      if (char === ')') depth--;

      // Split on comma only at depth 0 (not inside function calls)
      if (char === ',' && depth === 0) {
        result.push(current);
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    result.push(current);
  }

  return result;
};

/**
 * Extract the actual column name from an expression
 * Examples:
 *   m.year -> year
 *   table.column -> column
 *   COUNT(*) -> COUNT
 *   SUM(revenue) -> SUM
 *   CAST(x AS INT) -> CAST
 */
const extractColumnName = (expression) => {
  // Remove leading/trailing whitespace
  expression = expression.trim();

  // If it contains parentheses, it's a function - extract function name
  const funcMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/i);
  if (funcMatch) {
    return funcMatch[1].toLowerCase();
  }

  // If it contains a dot (table.column), take the last part
  if (expression.includes('.')) {
    const parts = expression.split('.');
    return parts[parts.length - 1].trim();
  }

  // Otherwise, return as-is
  return expression;
};

/**
 * Check if SQL query is valid (has SELECT and FROM)
 */
export const isValidSQLQuery = (sql) => {
  if (!sql || typeof sql !== 'string') {
    return false;
  }

  const cleanSql = sql.trim().toLowerCase();
  return cleanSql.includes('select') && cleanSql.includes('from');
};


/**
 * Data transformation utilities
 * Pure functions for transforming API responses to component-ready data
 */

/**
 * Transform GraphQL query results to table format
 * @param {Object} queryResults - Raw GraphQL query results
 * @returns {Object} Transformed results with data, columns, rowCount
 */
export const transformQueryResults = (queryResults) => {
  if (!queryResults || !queryResults.rows || !queryResults.columns) {
    return null;
  }

  const columnObjects = queryResults.columns.map(col => 
    typeof col === 'string' ? { name: col, label: col } : col
  );
  
  const dataObjects = queryResults.rows.map(row => {
    const obj = {};
    queryResults.columns.forEach((col, index) => {
      const colName = typeof col === 'string' ? col : col.name;
      obj[colName] = row[index];
    });
    return obj;
  });
  
  return {
    data: dataObjects,
    columns: columnObjects,
    rowCount: queryResults.rowCount || dataObjects.length
  };
};

/**
 * Transform query results to chart data format
 * @param {Object} transformedResults - Transformed query results
 * @param {string} chartType - Type of chart (bar, line, etc.)
 * @returns {Object} Chart data configuration
 */
export const transformToChartData = (transformedResults, chartType = 'bar') => {
  if (!transformedResults || !transformedResults.columns) {
    return null;
  }

  return {
    chart: {
      type: chartType,
      config: {
        xField: transformedResults.columns[0]?.name || 'x',
        yField: transformedResults.columns[1]?.name || 'y'
      },
      fallback: false
    },
    data: transformedResults,
    cached: false
  };
};

/**
 * Format success response message
 * @param {Object} response - GraphQL response
 * @returns {string} Formatted message
 */
export const formatSuccessMessage = (response) => {
  let message = `✅ Complete workflow executed successfully!\n`;
  message += `📝 SQL: Generated with ${Math.round((response.modelConfidence || 0.9) * 100)}% confidence\n`;
  message += `📊 Data: ${response.queryResults?.rowCount || 0} rows retrieved\n`;
  
  if (response.processingTime) {
    message += `⏱️ Processing: ${response.processingTime}ms\n`;
  }
  if (response.executionTime) {
    message += `⏱️ Execution: ${response.executionTime}ms\n`;
  }
  
  return message;
};

/**
 * Format error message
 * @param {Error|string} error - Error object or message
 * @returns {string} Formatted error message
 */
export const formatErrorMessage = (error) => {
  const errorMsg = typeof error === 'string' ? error : error?.message || 'Unknown error';
  return `❌ Error: ${errorMsg}`;
};


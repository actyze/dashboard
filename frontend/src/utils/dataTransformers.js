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
    rowCount: queryResults.row_count || queryResults.rowCount || dataObjects.length
  };
};

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

export const formatErrorMessage = (error) => {
  const errorMsg = typeof error === 'string' ? error : error?.message || 'Unknown error';
  return `❌ Error: ${errorMsg}`;
};


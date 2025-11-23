import { ApiResponse, mockDelay } from './apiConfig';

/**
 * Service for executing SQL queries and managing query results
 */
export class QueryExecutionService {
  
  /**
   * Execute a SQL query
   * @param {string} sqlQuery - The SQL query to execute
   * @param {Object} options - Execution options (limit, timeout, etc.)
   * @returns {Promise<ApiResponse>}
   */
  static async executeQuery(sqlQuery, options = {}) {
    const { limit = 1000, timeout = 30000 } = options;
    
    await mockDelay(Math.random() * 2000 + 1000); // Simulate 1-3 second execution time

    try {
      // Mock query execution with realistic results
      const mockResults = this.generateMockResults(sqlQuery, limit);
      
      return ApiResponse.success({
        data: mockResults.data,
        columns: mockResults.columns,
        rowCount: mockResults.data.length,
        executionTime: Math.random() * 2000 + 500, // 0.5-2.5 seconds
        queryHash: this.generateQueryHash(sqlQuery),
        cached: false,
        timestamp: new Date().toISOString()
      }, 'Query executed successfully');
    } catch (error) {
      return ApiResponse.error('Query execution failed', error);
    }
  }

  /**
   * Validate SQL query syntax
   * @param {string} sqlQuery 
   * @returns {Promise<ApiResponse>}
   */
  static async validateQuery(sqlQuery) {
    await mockDelay(200);

    try {
      // Basic SQL validation (mock implementation)
      const issues = [];
      
      if (!sqlQuery.trim()) {
        issues.push({ type: 'error', message: 'Query cannot be empty' });
      }
      
      if (!sqlQuery.toLowerCase().includes('select')) {
        issues.push({ type: 'warning', message: 'Query should contain SELECT statement' });
      }
      
      if (sqlQuery.toLowerCase().includes('drop') || 
          sqlQuery.toLowerCase().includes('delete') || 
          sqlQuery.toLowerCase().includes('truncate')) {
        issues.push({ type: 'error', message: 'Destructive operations are not allowed' });
      }

      const isValid = !issues.some(issue => issue.type === 'error');
      
      return ApiResponse.success({
        isValid,
        issues,
        suggestions: this.getQuerySuggestions(sqlQuery)
      });
    } catch (error) {
      return ApiResponse.error('Query validation failed', error);
    }
  }

  /**
   * Get query execution plan
   * @param {string} sqlQuery 
   * @returns {Promise<ApiResponse>}
   */
  static async getExecutionPlan(sqlQuery) {
    await mockDelay(800);

    try {
      const mockPlan = {
        estimatedRows: Math.floor(Math.random() * 10000) + 100,
        estimatedCost: Math.floor(Math.random() * 1000) + 10,
        estimatedTime: Math.floor(Math.random() * 5000) + 500,
        operations: [
          { step: 1, operation: 'Table Scan', table: 'orders', cost: 45.2 },
          { step: 2, operation: 'Hash Join', table: 'customers', cost: 123.5 },
          { step: 3, operation: 'Sort', field: 'total_sales DESC', cost: 67.8 },
          { step: 4, operation: 'Limit', count: 20, cost: 1.2 }
        ],
        indexes: [
          { table: 'orders', column: 'customer_id', used: true },
          { table: 'customers', column: 'id', used: true },
          { table: 'orders', column: 'order_date', used: false, suggestion: 'Consider adding index for better performance' }
        ]
      };

      return ApiResponse.success(mockPlan);
    } catch (error) {
      return ApiResponse.error('Failed to get execution plan', error);
    }
  }

  /**
   * Generate chart data from query results
   * @param {Object} queryResults 
   * @param {string} chartType 
   * @param {Object} chartConfig 
   * @returns {Promise<ApiResponse>}
   */
  static async generateChartData(queryResults, chartType = 'bar', chartConfig = {}) {
    await mockDelay(400);

    try {
      if (!queryResults || !queryResults.data) {
        return ApiResponse.error('No query results provided');
      }

      const chartData = {
        chart: {
          type: chartType,
          config: {
            xField: chartConfig.xField || queryResults.columns[0]?.name,
            yField: chartConfig.yField || queryResults.columns[1]?.name,
            ...chartConfig
          }
        },
        data: queryResults,
        cached: false,
        generatedAt: new Date().toISOString()
      };

      return ApiResponse.success(chartData);
    } catch (error) {
      return ApiResponse.error('Failed to generate chart data', error);
    }
  }

  /**
   * Export query results
   * @param {Object} queryResults 
   * @param {string} format - csv, json, xlsx
   * @returns {Promise<ApiResponse>}
   */
  static async exportResults(queryResults, format = 'csv') {
    await mockDelay(1000);

    try {
      // Mock export - in real implementation, this would generate actual files
      const exportInfo = {
        format,
        fileName: `query_results_${Date.now()}.${format}`,
        size: `${Math.floor(Math.random() * 500) + 100}KB`,
        rowCount: queryResults.data?.length || 0,
        downloadUrl: `/api/exports/download/${Date.now()}`, // Mock URL
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      return ApiResponse.success(exportInfo, `Results exported to ${format.toUpperCase()}`);
    } catch (error) {
      return ApiResponse.error('Export failed', error);
    }
  }

  /**
   * Get query execution history
   * @param {number} limit 
   * @returns {Promise<ApiResponse>}
   */
  static async getExecutionHistory(limit = 50) {
    await mockDelay(300);

    try {
      const history = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
        id: Date.now() - i * 1000,
        query: this.getMockHistoryQuery(i),
        executedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        executionTime: Math.random() * 3000 + 200,
        rowCount: Math.floor(Math.random() * 1000) + 10,
        status: Math.random() > 0.1 ? 'success' : 'error',
        user: 'Uddish Verma'
      }));

      return ApiResponse.success(history);
    } catch (error) {
      return ApiResponse.error('Failed to fetch execution history', error);
    }
  }

  // Helper methods for mock data generation
  static generateMockResults(sqlQuery, limit) {
    // Generate different types of mock data based on query content
    if (sqlQuery.toLowerCase().includes('customer')) {
      return this.generateCustomerResults(limit);
    } else if (sqlQuery.toLowerCase().includes('product')) {
      return this.generateProductResults(limit);
    } else if (sqlQuery.toLowerCase().includes('region')) {
      return this.generateRegionResults(limit);
    } else {
      return this.generateGenericResults(limit);
    }
  }

  static generateCustomerResults(limit) {
    const customers = ['Acme Corp', 'TechFlow Inc', 'Global Systems', 'DataTech Solutions', 'CloudFirst Ltd'];
    const data = Array.from({ length: Math.min(limit, 25) }, (_, i) => ({
      customer_name: customers[i % customers.length] + (i > 4 ? ` ${Math.floor(i/5) + 1}` : ''),
      total_sales: Math.floor(Math.random() * 200000) + 20000,
      order_count: Math.floor(Math.random() * 500) + 50,
      customer_id: `CUST-${String(i + 1).padStart(4, '0')}`,
      last_order_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));

    return {
      data,
      columns: [
        { name: 'customer_name', label: 'Customer Name', type: 'string' },
        { name: 'total_sales', label: 'Total Sales', type: 'number' },
        { name: 'order_count', label: 'Order Count', type: 'number' },
        { name: 'customer_id', label: 'Customer ID', type: 'string' },
        { name: 'last_order_date', label: 'Last Order Date', type: 'date' }
      ]
    };
  }

  static generateProductResults(limit) {
    const products = ['Widget Pro', 'Smart Device', 'Premium Tool', 'Digital Solution', 'Advanced Kit'];
    const data = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      product_name: products[i % products.length] + ` v${Math.floor(i/5) + 1}`,
      total_quantity: Math.floor(Math.random() * 1000) + 100,
      total_revenue: Math.floor(Math.random() * 50000) + 10000,
      avg_price: Math.floor(Math.random() * 500) + 50,
      category: ['Electronics', 'Software', 'Hardware', 'Services'][i % 4]
    }));

    return {
      data,
      columns: [
        { name: 'product_name', label: 'Product Name', type: 'string' },
        { name: 'total_quantity', label: 'Total Quantity', type: 'number' },
        { name: 'total_revenue', label: 'Total Revenue', type: 'number' },
        { name: 'avg_price', label: 'Average Price', type: 'number' },
        { name: 'category', label: 'Category', type: 'string' }
      ]
    };
  }

  static generateRegionResults(limit) {
    const regions = ['North America', 'Europe', 'Asia Pacific', 'South America', 'Middle East', 'Africa'];
    const data = regions.slice(0, Math.min(limit, regions.length)).map((region, i) => ({
      region,
      customers: Math.floor(Math.random() * 500) + 100,
      total_sales: Math.floor(Math.random() * 1000000) + 100000,
      avg_order_value: Math.floor(Math.random() * 1000) + 200,
      growth_rate: (Math.random() * 20 - 5).toFixed(1) + '%'
    }));

    return {
      data,
      columns: [
        { name: 'region', label: 'Region', type: 'string' },
        { name: 'customers', label: 'Customers', type: 'number' },
        { name: 'total_sales', label: 'Total Sales', type: 'number' },
        { name: 'avg_order_value', label: 'Avg Order Value', type: 'number' },
        { name: 'growth_rate', label: 'Growth Rate', type: 'string' }
      ]
    };
  }

  static generateGenericResults(limit) {
    const data = Array.from({ length: Math.min(limit, 15) }, (_, i) => ({
      id: i + 1,
      value: Math.floor(Math.random() * 1000),
      category: `Category ${String.fromCharCode(65 + (i % 5))}`,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));

    return {
      data,
      columns: [
        { name: 'id', label: 'ID', type: 'number' },
        { name: 'value', label: 'Value', type: 'number' },
        { name: 'category', label: 'Category', type: 'string' },
        { name: 'timestamp', label: 'Date', type: 'date' }
      ]
    };
  }

  static generateQueryHash(query) {
    // Simple hash function for mock purposes
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  static getQuerySuggestions(query) {
    const suggestions = [];
    
    if (!query.toLowerCase().includes('limit')) {
      suggestions.push('Consider adding a LIMIT clause for better performance');
    }
    
    if (query.toLowerCase().includes('select *')) {
      suggestions.push('Avoid SELECT * - specify only needed columns');
    }
    
    return suggestions;
  }

  static getMockHistoryQuery(index) {
    const queries = [
      'SELECT customer_name, total_sales FROM orders ORDER BY total_sales DESC',
      'SELECT region, COUNT(*) FROM customers GROUP BY region',
      'SELECT product_name, SUM(quantity) FROM order_items GROUP BY product_name',
      'SELECT DATE(order_date), SUM(order_total) FROM orders GROUP BY DATE(order_date)',
      'SELECT c.customer_name, COUNT(o.id) FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.customer_name'
    ];
    
    return queries[index % queries.length];
  }
}
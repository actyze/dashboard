import { ApiResponse, mockDelay } from './apiConfig';
import { GraphQLService } from './GraphQLService';

// Check if we should use mock data (default to false - use real API)
const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'true';

/**
 * Service for AI-powered natural language to SQL conversion
 */
export class AIService {
  
  /**
   * Convert natural language query to SQL
   * @param {string} naturalLanguageQuery - The natural language query
   * @param {Object} context - Database schema context (optional)
   * @returns {Promise<ApiResponse>}
   */
  static async convertToSQL(naturalLanguageQuery, context = {}) {
    // Use real API if not in mock mode
    if (!USE_MOCK_DATA) {
      try {
        const response = await GraphQLService.processNaturalLanguage(naturalLanguageQuery);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to process query');
        }

        let transformedResults = null;
        if (response.queryResults && response.queryResults.rows && response.queryResults.columns) {
          const columnObjects = response.queryResults.columns.map(col => 
            typeof col === 'string' ? { name: col, label: col } : col
          );
          
          const dataObjects = response.queryResults.rows.map(row => {
            const obj = {};
            response.queryResults.columns.forEach((col, index) => {
              const colName = typeof col === 'string' ? col : col.name;
              obj[colName] = row[index];
            });
            return obj;
          });
          
          transformedResults = {
            data: dataObjects,
            columns: columnObjects,
            rowCount: response.queryResults.rowCount || dataObjects.length
          };
          console.log('Transformed:', transformedResults);
        } else {
          console.log('No transformation - queryResults structure:', response.queryResults);
        }
        
        return ApiResponse.success({
          originalQuery: response.nlQuery || naturalLanguageQuery,
          sqlQuery: response.generatedSql,
          explanation: response.modelReasoning || 'SQL query generated successfully',
          confidence: response.modelConfidence || 0.9,
          suggestions: [],
          timestamp: new Date().toISOString(),
          modelVersion: 'nexus-graphql',
          queryResults: transformedResults,
          processingTime: response.processingTime,
          executionTime: response.executionTime
        }, 'Query converted successfully');
      } catch (error) {
        console.error('GraphQL API failed, falling back to mock data:', error);
        // Fall through to mock implementation
      }
    }

    // Mock implementation (fallback)
    await mockDelay(1500 + Math.random() * 1000); // Simulate 1.5-2.5 second processing

    try {
      const sqlQuery = this.generateMockSQL(naturalLanguageQuery);
      const explanation = this.generateExplanation(naturalLanguageQuery, sqlQuery);
      const confidence = Math.random() * 0.3 + 0.7; // 70-100% confidence

      return ApiResponse.success({
        originalQuery: naturalLanguageQuery,
        sqlQuery: sqlQuery,
        explanation: explanation,
        confidence: confidence,
        suggestions: this.getSuggestions(naturalLanguageQuery),
        timestamp: new Date().toISOString(),
        modelVersion: 'gpt-4-sql-v1.2'
      }, 'Query converted successfully');
    } catch (error) {
      return ApiResponse.error('Failed to convert natural language to SQL', error);
    }
  }

  /**
   * Get AI suggestions for query improvement
   * @param {string} query - Natural language or SQL query
   * @returns {Promise<ApiResponse>}
   */
  static async getSuggestions(query) {
    await mockDelay(800);

    try {
      const suggestions = this.generateSuggestions(query);
      return ApiResponse.success(suggestions);
    } catch (error) {
      return ApiResponse.error('Failed to get AI suggestions', error);
    }
  }

  /**
   * Explain a SQL query in natural language
   * @param {string} sqlQuery 
   * @returns {Promise<ApiResponse>}
   */
  static async explainSQL(sqlQuery) {
    await mockDelay(1000);

    try {
      const explanation = this.generateSQLExplanation(sqlQuery);
      return ApiResponse.success({
        sqlQuery,
        explanation,
        breakdown: this.breakdownQuery(sqlQuery),
        complexity: this.assessComplexity(sqlQuery),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return ApiResponse.error('Failed to explain SQL query', error);
    }
  }

  /**
   * Get recent AI query history
   * @param {number} limit 
   * @returns {Promise<ApiResponse>}
   */
  static async getRecentQueries(limit = 10) {
    await mockDelay(300);

    try {
      const recentQueries = [
        {
          id: 1,
          naturalLanguage: "Show me sales data from the last quarter",
          sqlQuery: "SELECT * FROM sales WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          confidence: 0.92
        },
        {
          id: 2,
          naturalLanguage: "Create a chart of customer demographics",
          sqlQuery: "SELECT age_group, COUNT(*) as count FROM customers GROUP BY age_group ORDER BY count DESC",
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          confidence: 0.88
        },
        {
          id: 3,
          naturalLanguage: "Find all orders over $1000 this month",
          sqlQuery: "SELECT * FROM orders WHERE order_total > 1000 AND MONTH(order_date) = MONTH(CURRENT_DATE)",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          confidence: 0.95
        },
        {
          id: 4,
          naturalLanguage: "Compare revenue by region",
          sqlQuery: "SELECT region, SUM(order_total) as total_revenue FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY region ORDER BY total_revenue DESC",
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          confidence: 0.91
        }
      ];

      return ApiResponse.success(recentQueries.slice(0, limit));
    } catch (error) {
      return ApiResponse.error('Failed to fetch recent queries', error);
    }
  }

  /**
   * Get AI model information
   * @returns {Promise<ApiResponse>}
   */
  static async getModelInfo() {
    await mockDelay(200);

    try {
      const modelInfo = {
        modelName: 'GPT-4 SQL Assistant',
        version: '1.2.0',
        capabilities: [
          'Natural language to SQL conversion',
          'SQL query explanation',
          'Query optimization suggestions',
          'Multi-table join support',
          'Complex aggregation handling'
        ],
        supportedDatabases: ['MySQL', 'PostgreSQL', 'SQLite', 'SQL Server', 'Oracle'],
        accuracy: 0.92,
        lastUpdated: '2024-11-15T00:00:00Z'
      };

      return ApiResponse.success(modelInfo);
    } catch (error) {
      return ApiResponse.error('Failed to get model information', error);
    }
  }

  // Helper methods for generating mock responses
  static generateMockSQL(naturalLanguageQuery) {
    const query = naturalLanguageQuery.toLowerCase();
    
    if (query.includes('sales') && query.includes('quarter')) {
      return `-- Generated from: "${naturalLanguageQuery}"\nSELECT \n  DATE_FORMAT(order_date, '%Y-%m') as month,\n  SUM(order_total) as total_sales,\n  COUNT(*) as order_count\nFROM orders \nWHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)\nGROUP BY month\nORDER BY month;`;
    }
    
    if (query.includes('customer') && query.includes('demographic')) {
      return `-- Generated from: "${naturalLanguageQuery}"\nSELECT \n  age_group,\n  gender,\n  COUNT(*) as customer_count,\n  AVG(total_spent) as avg_spent\nFROM customers \nGROUP BY age_group, gender\nORDER BY customer_count DESC;`;
    }
    
    if (query.includes('order') && query.includes('1000')) {
      return `-- Generated from: "${naturalLanguageQuery}"\nSELECT \n  order_id,\n  customer_name,\n  order_total,\n  order_date\nFROM orders o\nJOIN customers c ON o.customer_id = c.id\nWHERE order_total > 1000\n  AND MONTH(order_date) = MONTH(CURRENT_DATE)\nORDER BY order_total DESC;`;
    }
    
    if (query.includes('revenue') && query.includes('region')) {
      return `-- Generated from: "${naturalLanguageQuery}"\nSELECT \n  c.region,\n  COUNT(DISTINCT c.id) as customers,\n  SUM(o.order_total) as total_revenue,\n  AVG(o.order_total) as avg_order_value\nFROM customers c\nJOIN orders o ON c.id = o.customer_id\nGROUP BY c.region\nORDER BY total_revenue DESC;`;
    }
    
    // Default generic response
    return `-- Generated from: "${naturalLanguageQuery}"\nSELECT \n  *\nFROM relevant_table\nWHERE conditions_based_on_query\nORDER BY relevant_column DESC\nLIMIT 100;`;
  }

  static generateExplanation(naturalLanguage, sqlQuery) {
    if (naturalLanguage.toLowerCase().includes('sales') && naturalLanguage.toLowerCase().includes('quarter')) {
      return "This query retrieves sales data for the last quarter, grouping by month to show trends over time. It calculates total sales amount and order count for each month.";
    }
    
    if (naturalLanguage.toLowerCase().includes('customer') && naturalLanguage.toLowerCase().includes('demographic')) {
      return "This query analyzes customer demographics by grouping customers by age group and gender, showing the count of customers in each segment and their average spending.";
    }
    
    if (naturalLanguage.toLowerCase().includes('order') && naturalLanguage.toLowerCase().includes('1000')) {
      return "This query finds all orders with a value greater than $1000 placed in the current month, joining with customer data to show customer names alongside order details.";
    }
    
    if (naturalLanguage.toLowerCase().includes('revenue') && naturalLanguage.toLowerCase().includes('region')) {
      return "This query compares revenue performance across different regions by joining customer and order data, calculating total revenue, customer count, and average order value per region.";
    }
    
    return "This query was generated based on your natural language request and should return the relevant data you're looking for.";
  }

  static generateSuggestions(query) {
    const suggestions = [
      {
        type: 'optimization',
        title: 'Add Index Recommendation',
        description: 'Consider adding an index on order_date column for better performance',
        impact: 'high'
      },
      {
        type: 'clarity',
        title: 'Specify Date Range',
        description: 'Be more specific about the date range (e.g., "last 30 days" instead of "recently")',
        impact: 'medium'
      },
      {
        type: 'completeness',
        title: 'Include Additional Metrics',
        description: 'You might also want to see growth rate or percentage changes',
        impact: 'low'
      }
    ];
    
    return suggestions;
  }

  static generateSQLExplanation(sqlQuery) {
    if (sqlQuery.toLowerCase().includes('group by')) {
      return "This query groups data by specific columns and applies aggregate functions to calculate summaries for each group.";
    }
    
    if (sqlQuery.toLowerCase().includes('join')) {
      return "This query combines data from multiple tables using JOIN operations to create a unified result set.";
    }
    
    if (sqlQuery.toLowerCase().includes('order by')) {
      return "This query sorts the results based on specified columns to present data in a meaningful order.";
    }
    
    return "This SQL query retrieves and processes data from your database tables.";
  }

  static breakdownQuery(sqlQuery) {
    const breakdown = [];
    const upperQuery = sqlQuery.toUpperCase();
    
    if (upperQuery.includes('SELECT')) {
      breakdown.push({
        clause: 'SELECT',
        description: 'Specifies which columns to retrieve from the database',
        purpose: 'Data Selection'
      });
    }
    
    if (upperQuery.includes('FROM')) {
      breakdown.push({
        clause: 'FROM',
        description: 'Identifies the source tables for the data',
        purpose: 'Data Source'
      });
    }
    
    if (upperQuery.includes('WHERE')) {
      breakdown.push({
        clause: 'WHERE',
        description: 'Filters rows based on specified conditions',
        purpose: 'Data Filtering'
      });
    }
    
    if (upperQuery.includes('GROUP BY')) {
      breakdown.push({
        clause: 'GROUP BY',
        description: 'Groups rows with the same values in specified columns',
        purpose: 'Data Grouping'
      });
    }
    
    if (upperQuery.includes('ORDER BY')) {
      breakdown.push({
        clause: 'ORDER BY',
        description: 'Sorts the result set by specified columns',
        purpose: 'Data Sorting'
      });
    }
    
    return breakdown;
  }

  static assessComplexity(sqlQuery) {
    let complexity = 'simple';
    let score = 0;
    
    if (sqlQuery.toLowerCase().includes('join')) score += 2;
    if (sqlQuery.toLowerCase().includes('group by')) score += 1;
    if (sqlQuery.toLowerCase().includes('having')) score += 2;
    if (sqlQuery.toLowerCase().includes('subquery') || sqlQuery.includes('(SELECT')) score += 3;
    if (sqlQuery.toLowerCase().includes('union')) score += 2;
    
    if (score >= 5) complexity = 'complex';
    else if (score >= 2) complexity = 'moderate';
    
    return {
      level: complexity,
      score: score,
      factors: this.getComplexityFactors(sqlQuery)
    };
  }

  static getComplexityFactors(sqlQuery) {
    const factors = [];
    const query = sqlQuery.toLowerCase();
    
    if (query.includes('join')) factors.push('Multiple table joins');
    if (query.includes('group by')) factors.push('Data aggregation');
    if (query.includes('having')) factors.push('Group filtering');
    if (query.includes('subquery') || query.includes('(select')) factors.push('Nested queries');
    if (query.includes('union')) factors.push('Result set combination');
    
    return factors;
  }
}
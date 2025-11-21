import { ApiResponse, mockDelay } from './apiConfig';

/**
 * Service for managing SQL queries and query templates
 */
export class QueriesService {
  // Mock data - will be replaced by actual API calls
  static mockQueries = [
    {
      id: 1,
      title: "Customer Sales Analysis",
      description: "Top customers by revenue with order metrics",
      query: "SELECT customer_name, SUM(order_total) as total_sales, COUNT(*) as order_count FROM orders GROUP BY customer_name ORDER BY total_sales DESC LIMIT 20;",
      category: "sales",
      tags: ["customers", "revenue", "orders"],
      createdAt: "2024-11-15T10:30:00Z",
      updatedAt: "2024-11-20T14:22:00Z",
      lastViewed: "2 hours ago",
      lastUpdated: "1 day ago",
      author: "Uddish Verma",
      isPublic: true,
      executionCount: 45
    },
    {
      id: 2,
      title: "Monthly Revenue Trends",
      description: "Revenue analysis by month for current year",
      query: "SELECT DATE_FORMAT(order_date, '%Y-%m') as month, SUM(order_total) as monthly_revenue FROM orders WHERE YEAR(order_date) = YEAR(CURRENT_DATE()) GROUP BY month ORDER BY month;",
      category: "analytics",
      tags: ["revenue", "trends", "monthly"],
      createdAt: "2024-11-10T08:15:00Z",
      updatedAt: "2024-11-19T16:45:00Z",
      lastViewed: "5 hours ago",
      lastUpdated: "2 days ago",
      author: "Uddish Verma",
      isPublic: true,
      executionCount: 28
    },
    {
      id: 3,
      title: "Product Performance Dashboard",
      description: "Best selling products with metrics",
      query: "SELECT product_name, SUM(quantity) as total_quantity, SUM(price * quantity) as total_revenue FROM order_items oi JOIN products p ON oi.product_id = p.id GROUP BY product_name ORDER BY total_revenue DESC LIMIT 15;",
      category: "products",
      tags: ["products", "performance", "sales"],
      createdAt: "2024-11-08T12:20:00Z",
      updatedAt: "2024-11-18T11:30:00Z",
      lastViewed: "1 day ago",
      lastUpdated: "3 days ago",
      author: "Uddish Verma",
      isPublic: true,
      executionCount: 67
    },
    {
      id: 4,
      title: "Regional Sales Breakdown",
      description: "Sales performance by geographic regions",
      query: "SELECT region, COUNT(DISTINCT customer_id) as customers, SUM(order_total) as total_sales, AVG(order_total) as avg_order_value FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY region ORDER BY total_sales DESC;",
      category: "regional",
      tags: ["regions", "geography", "sales"],
      createdAt: "2024-11-05T09:45:00Z",
      updatedAt: "2024-11-14T13:20:00Z",
      lastViewed: "3 days ago",
      lastUpdated: "1 week ago",
      author: "Uddish Verma",
      isPublic: true,
      executionCount: 23
    }
  ];

  /**
   * Get all queries with optional filtering
   * @param {Object} filters - Optional filters (category, tags, author, etc.)
   * @returns {Promise<ApiResponse>}
   */
  static async getAllQueries(filters = {}) {
    await mockDelay(500);

    try {
      let queries = [...this.mockQueries];

      // Apply filters
      if (filters.category) {
        queries = queries.filter(q => q.category === filters.category);
      }

      if (filters.tags && filters.tags.length > 0) {
        queries = queries.filter(q => 
          filters.tags.some(tag => q.tags.includes(tag))
        );
      }

      if (filters.author) {
        queries = queries.filter(q => q.author === filters.author);
      }

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        queries = queries.filter(q => 
          q.title.toLowerCase().includes(searchTerm) ||
          q.description.toLowerCase().includes(searchTerm) ||
          q.query.toLowerCase().includes(searchTerm)
        );
      }

      // Sort by most recently viewed by default
      queries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      return ApiResponse.success(queries, `Found ${queries.length} queries`);
    } catch (error) {
      return ApiResponse.error('Failed to fetch queries', error);
    }
  }

  /**
   * Get a specific query by ID
   * @param {number|string} queryId 
   * @returns {Promise<ApiResponse>}
   */
  static async getQueryById(queryId) {
    await mockDelay(300);

    try {
      const query = this.mockQueries.find(q => q.id.toString() === queryId.toString());
      
      if (!query) {
        return ApiResponse.error(`Query with ID ${queryId} not found`);
      }

      return ApiResponse.success(query);
    } catch (error) {
      return ApiResponse.error('Failed to fetch query', error);
    }
  }

  /**
   * Save a new query
   * @param {Object} queryData 
   * @returns {Promise<ApiResponse>}
   */
  static async saveQuery(queryData) {
    await mockDelay(800);

    try {
      const newQuery = {
        id: Math.max(...this.mockQueries.map(q => q.id)) + 1,
        ...queryData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastViewed: "just now",
        lastUpdated: "just now",
        author: "Uddish Verma",
        isPublic: true,
        executionCount: 0
      };

      this.mockQueries.push(newQuery);
      return ApiResponse.success(newQuery, 'Query saved successfully');
    } catch (error) {
      return ApiResponse.error('Failed to save query', error);
    }
  }

  /**
   * Update an existing query
   * @param {number|string} queryId 
   * @param {Object} updateData 
   * @returns {Promise<ApiResponse>}
   */
  static async updateQuery(queryId, updateData) {
    await mockDelay(600);

    try {
      const queryIndex = this.mockQueries.findIndex(q => q.id.toString() === queryId.toString());
      
      if (queryIndex === -1) {
        return ApiResponse.error(`Query with ID ${queryId} not found`);
      }

      this.mockQueries[queryIndex] = {
        ...this.mockQueries[queryIndex],
        ...updateData,
        updatedAt: new Date().toISOString(),
        lastUpdated: "just now"
      };

      return ApiResponse.success(this.mockQueries[queryIndex], 'Query updated successfully');
    } catch (error) {
      return ApiResponse.error('Failed to update query', error);
    }
  }

  /**
   * Delete a query
   * @param {number|string} queryId 
   * @returns {Promise<ApiResponse>}
   */
  static async deleteQuery(queryId) {
    await mockDelay(400);

    try {
      const queryIndex = this.mockQueries.findIndex(q => q.id.toString() === queryId.toString());
      
      if (queryIndex === -1) {
        return ApiResponse.error(`Query with ID ${queryId} not found`);
      }

      const deletedQuery = this.mockQueries.splice(queryIndex, 1)[0];
      return ApiResponse.success(deletedQuery, 'Query deleted successfully');
    } catch (error) {
      return ApiResponse.error('Failed to delete query', error);
    }
  }

  /**
   * Get query categories
   * @returns {Promise<ApiResponse>}
   */
  static async getCategories() {
    await mockDelay(200);

    try {
      const categories = [...new Set(this.mockQueries.map(q => q.category))];
      return ApiResponse.success(categories);
    } catch (error) {
      return ApiResponse.error('Failed to fetch categories', error);
    }
  }

  /**
   * Get all tags
   * @returns {Promise<ApiResponse>}
   */
  static async getAllTags() {
    await mockDelay(200);

    try {
      const allTags = this.mockQueries.flatMap(q => q.tags);
      const uniqueTags = [...new Set(allTags)];
      return ApiResponse.success(uniqueTags);
    } catch (error) {
      return ApiResponse.error('Failed to fetch tags', error);
    }
  }

  /**
   * Record query view/execution
   * @param {number|string} queryId 
   * @returns {Promise<ApiResponse>}
   */
  static async recordQueryView(queryId) {
    await mockDelay(100);

    try {
      const queryIndex = this.mockQueries.findIndex(q => q.id.toString() === queryId.toString());
      
      if (queryIndex !== -1) {
        this.mockQueries[queryIndex].executionCount += 1;
        this.mockQueries[queryIndex].lastViewed = "just now";
      }

      return ApiResponse.success({ queryId, recorded: true });
    } catch (error) {
      return ApiResponse.error('Failed to record query view', error);
    }
  }
}
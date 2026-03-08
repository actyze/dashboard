/**
 * DashboardAgentService - AI Agent for autonomous dashboard creation
 * Handles multi-step dashboard creation from voice/text commands
 */

import RestService from './RestService';

// Chart type recommendations based on data patterns
const CHART_TYPE_RULES = {
  timeSeries: ['line', 'area'],
  comparison: ['bar', 'horizontalBar'],
  distribution: ['pie', 'donut'],
  correlation: ['scatter'],
  ranking: ['bar', 'horizontalBar'],
  proportion: ['pie', 'donut', 'treemap'],
  trend: ['line', 'area'],
};

// Keywords for chart type detection
const CHART_KEYWORDS = {
  line: ['trend', 'over time', 'timeline', 'progression', 'monthly', 'daily', 'weekly', 'yearly'],
  bar: ['compare', 'comparison', 'versus', 'vs', 'by category', 'ranking', 'top'],
  pie: ['distribution', 'proportion', 'percentage', 'share', 'breakdown', 'composition'],
  area: ['volume', 'cumulative', 'stacked over time'],
  scatter: ['correlation', 'relationship', 'versus'],
  table: ['list', 'details', 'all data', 'raw data', 'export'],
};

class DashboardAgentServiceClass {
  constructor() {
    this.conversationHistory = [];
  }

  /**
   * Detect chart type from natural language query
   */
  detectChartType(nlQuery) {
    const lowerQuery = nlQuery.toLowerCase();
    
    for (const [chartType, keywords] of Object.entries(CHART_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          return chartType;
        }
      }
    }
    
    // Default to bar chart
    return 'bar';
  }

  /**
   * Parse user intent from natural language
   */
  parseIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    // Dashboard creation intents
    if (lowerMessage.includes('create') && lowerMessage.includes('dashboard')) {
      return { type: 'create_dashboard', confidence: 0.9 };
    }
    
    // Tile creation intents
    if (lowerMessage.includes('add') && (lowerMessage.includes('tile') || lowerMessage.includes('chart') || lowerMessage.includes('widget'))) {
      return { type: 'add_tile', confidence: 0.9 };
    }
    
    // Query intents
    if (lowerMessage.includes('show') || lowerMessage.includes('get') || lowerMessage.includes('find') || 
        lowerMessage.includes('what') || lowerMessage.includes('how many')) {
      return { type: 'query', confidence: 0.8 };
    }
    
    // Default to query
    return { type: 'query', confidence: 0.5 };
  }

  /**
   * Create a tile from natural language request
   */
  async createTileFromNL(nlQuery, dashboardId = null, existingTilesCount = 0) {
    try {
      // Generate SQL from natural language
      // Transform conversation history to strings (API expects string array)
      const historyStrings = this.conversationHistory.map(m => m.content);
      const sqlResponse = await RestService.generateSql(nlQuery, [nlQuery, ...historyStrings]);
      
      if (!sqlResponse.success || !sqlResponse.generated_sql) {
        return {
          success: false,
          error: sqlResponse.error || sqlResponse.model_reasoning || 'Could not generate SQL for this request',
        };
      }

      // Detect chart type
      const chartType = sqlResponse.chart_recommendation?.chart_type || this.detectChartType(nlQuery);
      
      // Generate title from query
      const title = this.generateTitleFromQuery(nlQuery);
      
      // Calculate position for new tile
      const position = {
        x: (existingTilesCount % 2) * 6,
        y: Math.floor(existingTilesCount / 2) * 2,
        width: 6,
        height: 2,
      };

      const tileData = {
        title,
        description: nlQuery,
        sqlQuery: sqlResponse.generated_sql,
        nlQuery,
        chartType,
        chartConfig: sqlResponse.chart_recommendation || {},
        position,
      };

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: nlQuery,
      });
      this.conversationHistory.push({
        role: 'assistant',
        content: `Created tile: ${title} with ${chartType} chart`,
      });

      return {
        success: true,
        tile: tileData,
        sql: sqlResponse.generated_sql,
        reasoning: sqlResponse.model_reasoning,
      };
    } catch (error) {
      console.error('Error creating tile from NL:', error);
      return {
        success: false,
        error: error.message || 'Failed to create tile',
      };
    }
  }

  /**
   * Generate a readable title from the query
   */
  generateTitleFromQuery(query) {
    // Simple title generation - capitalize first letter of each word
    const words = query.toLowerCase().split(' ').slice(0, 6);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  /**
   * Process a message from the user
   */
  async processMessage(message, context = {}) {
    const intent = this.parseIntent(message);
    
    switch (intent.type) {
      case 'create_dashboard':
        return {
          success: true,
          response: "I can help you create a dashboard! Please tell me what kind of data you'd like to visualize, and I'll create tiles for you.",
          action: 'prompt_for_tiles',
        };
        
      case 'add_tile':
        if (context.dashboardId) {
          const result = await this.createTileFromNL(message, context.dashboardId, context.existingTilesCount || 0);
          return result;
        } else {
          return {
            success: true,
            response: "Please open or create a dashboard first, then I can add tiles to it.",
            action: 'need_dashboard',
          };
        }
        
      case 'query':
      default:
        // For queries, generate SQL only - don't execute yet
        // Execution happens when user clicks "Query" or "Dashboard" button
        try {
          console.log('DashboardAgentService: Generating SQL for:', message);
          
          // Transform conversation history to strings (API expects string array, not objects)
          const historyStrings = this.conversationHistory.map(m => m.content);
          
          const sqlResponse = await RestService.generateSql(message, [message, ...historyStrings]);
          console.log('DashboardAgentService: SQL response:', sqlResponse);
          
          if (!sqlResponse || !sqlResponse.success || !sqlResponse.generated_sql) {
            console.log('DashboardAgentService: SQL generation failed:', sqlResponse);
            return {
              success: false,
              error: sqlResponse?.error || sqlResponse?.model_reasoning || 'Could not understand the request',
              response: sqlResponse?.model_reasoning || "I couldn't generate a query for that. Could you try rephrasing?",
            };
          }

          const sql = sqlResponse.generated_sql;
          const reasoning = sqlResponse.model_reasoning;
          const chartRecommendation = sqlResponse.chart_recommendation;

          // Update conversation history
          this.conversationHistory.push({ role: 'user', content: message });
          this.conversationHistory.push({ 
            role: 'assistant', 
            content: reasoning || 'Query generated' 
          });

          // Build response - show the SQL was generated (not executed)
          const response = reasoning || 'I generated a query for you. Click "Query" to view results or "Dashboard" to create a tile.';

          return {
            success: true,
            sql,
            reasoning,
            chartRecommendation,
            nlQuery: message,
            response,
            // Show buttons to open in Query page or add to Dashboard
            canOpenInQueryPage: true,
          };
        } catch (error) {
          console.error('DashboardAgentService: Error in processMessage:', error);
          console.error('DashboardAgentService: Error stack:', error.stack);
          return {
            success: false,
            error: error.message,
            response: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
          };
        }
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }
}

// Singleton instance
const DashboardAgentService = new DashboardAgentServiceClass();

export default DashboardAgentService;

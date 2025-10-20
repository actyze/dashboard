package com.dashboard.service;

import com.dashboard.repository.TrinoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Callback interface for SQL correction during retry
 */
interface SqlCorrectionCallback {
    Map<String, Object> generateCorrectedSQL(String originalQuery, String failedSQL, 
                                            String sqlError, String errorType, 
                                            List<String> errorHistory);
}

/**
 * Service layer for SQL execution operations
 * Handles business logic for SQL queries and delegates data access to repository
 */
@Service
public class SqlExecutionService {
    
    private static final Logger logger = LoggerFactory.getLogger(SqlExecutionService.class);
    
    @Autowired
    private TrinoRepository trinoRepository;
    
    @Autowired
    private SqlErrorAnalysisService errorAnalysisService;
    
    @Value("${dashboard.cache.enabled:true}")
    private boolean cacheEnabled;
    
    /**
     * Execute SQL query with business logic validation and intelligent caching
     * Cache key includes normalized SQL + maxResults for precise cache hits
     */
    @Cacheable(value = "sqlQueries", 
               key = "#sql.toLowerCase().replaceAll('\\\\s+', ' ').trim() + ':' + #maxResults",
               condition = "@sqlExecutionService.isCacheable(#sql)")
    public Map<String, Object> executeQuery(String sql, Integer maxResults, Integer timeoutSeconds) {
        logger.info("Processing SQL execution request: {}", sql);
        
        // Validate input
        if (sql == null || sql.trim().isEmpty()) {
            return createErrorResponse("SQL query cannot be empty", "VALIDATION_ERROR");
        }
        
        // Apply business rules
        if (maxResults == null || maxResults <= 0) {
            maxResults = 100; // Default limit
        }
        if (maxResults > 1000) {
            maxResults = 1000; // Maximum limit for performance
        }
        
        if (timeoutSeconds == null || timeoutSeconds <= 0) {
            timeoutSeconds = 30; // Default timeout
        }
        if (timeoutSeconds > 300) {
            timeoutSeconds = 300; // Maximum timeout
        }
        
        // Execute query via repository
        TrinoRepository.QueryResult queryResult = trinoRepository.executeQuery(sql, maxResults, timeoutSeconds);
        
        // Transform repository result to service response
        Map<String, Object> response = new HashMap<>();
        response.put("success", queryResult.isSuccess());
        response.put("sql", sql);
        response.put("executionTime", queryResult.getExecutionTimeMs());
        response.put("database", "Trino");
        response.put("requestType", "sql");
        
        if (queryResult.isSuccess()) {
            // Success response
            Map<String, Object> queryResults = new HashMap<>();
            queryResults.put("data", queryResult.getData());
            queryResults.put("rowCount", queryResult.getRowCount());
            queryResults.put("columns", transformColumns(queryResult.getColumns()));
            
            response.put("queryResults", queryResults);
            response.put("limitApplied", queryResult.getLimitApplied());
            
            logger.info("SQL execution successful: {} rows returned", queryResult.getRowCount());
        } else {
            // Error response
            response.put("error", queryResult.getError());
            response.put("errorType", queryResult.getErrorType());
            if (queryResult.getSqlState() != null) {
                response.put("sqlState", queryResult.getSqlState());
            }
            if (queryResult.getErrorCode() != null) {
                response.put("errorCode", queryResult.getErrorCode());
            }
            
            logger.error("SQL execution failed: {}", queryResult.getError());
        }
        
        return response;
    }
    
    /**
     * Test database connectivity
     */
    public Map<String, Object> testConnection() {
        logger.info("Testing database connection");
        
        boolean connected = trinoRepository.testConnection();
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", connected);
        response.put("database", "Trino");
        response.put("timestamp", System.currentTimeMillis());
        
        if (connected) {
            response.put("message", "Database connection successful");
            logger.info("Database connection test successful");
        } else {
            response.put("error", "Database connection failed");
            response.put("errorType", "CONNECTION_ERROR");
            logger.error("Database connection test failed");
        }
        
        return response;
    }
    
    /**
     * Get database metadata (catalogs, schemas, tables) with caching
     * Uses separate metadata cache with shorter TTL
     */
    @Cacheable(value = "metadataQueries", 
               key = "#action + ':' + (#catalog != null ? #catalog : 'null') + ':' + (#schema != null ? #schema : 'null')",
               cacheManager = "metadataCache")
    public Map<String, Object> getDatabaseMetadata(String action, String catalog, String schema) {
        logger.info("Getting database metadata: action={}, catalog={}, schema={}", action, catalog, schema);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        
        try {
            switch (action) {
                case "catalogs":
                    List<String> catalogs = trinoRepository.getCatalogs();
                    response.put("data", catalogs);
                    break;
                    
                case "schemas":
                    if (catalog == null || catalog.trim().isEmpty()) {
                        return createErrorResponse("Catalog name is required for schemas", "VALIDATION_ERROR");
                    }
                    List<String> schemas = trinoRepository.getSchemas(catalog);
                    response.put("data", schemas);
                    response.put("catalog", catalog);
                    break;
                    
                case "tables":
                    if (catalog == null || schema == null || catalog.trim().isEmpty() || schema.trim().isEmpty()) {
                        return createErrorResponse("Catalog and schema names are required for tables", "VALIDATION_ERROR");
                    }
                    List<String> tables = trinoRepository.getTables(catalog, schema);
                    response.put("data", tables);
                    response.put("catalog", catalog);
                    response.put("schema", schema);
                    break;
                    
                default:
                    return createErrorResponse("Invalid action: " + action, "VALIDATION_ERROR");
            }
            
            logger.info("Database metadata retrieved successfully for action: {}", action);
            
        } catch (Exception e) {
            logger.error("Failed to retrieve database metadata: {}", e.getMessage(), e);
            return createErrorResponse("Failed to retrieve metadata: " + e.getMessage(), "METADATA_ERROR");
        }
        
        return response;
    }
    
    /**
     * Transform repository column info to service response format
     */
    private List<Map<String, Object>> transformColumns(List<TrinoRepository.ColumnInfo> columns) {
        if (columns == null) return new ArrayList<>();
        
        return columns.stream()
                .map(col -> {
                    Map<String, Object> column = new HashMap<>();
                    column.put("name", col.getName());
                    column.put("type", col.getType());
                    return column;
                })
                .toList();
    }
    
    /**
     * Create standardized error response
     */
    private Map<String, Object> createErrorResponse(String message, String errorType) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", message);
        response.put("errorType", errorType);
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }
    
    /**
     * Determine if a SQL query should be cached
     * Analytics queries are cached, but not DDL/DML operations
     */
    public boolean isCacheable(String sql) {
        if (!cacheEnabled || sql == null) {
            return false;
        }
        
        String normalizedSql = sql.toLowerCase().trim();
        
        // Cache SELECT queries (analytics)
        if (normalizedSql.startsWith("select")) {
            return true;
        }
        
        // Cache SHOW/DESCRIBE queries (metadata)
        if (normalizedSql.startsWith("show") || normalizedSql.startsWith("describe")) {
            return true;
        }
        
        // Don't cache DDL/DML operations
        if (normalizedSql.startsWith("insert") || normalizedSql.startsWith("update") || 
            normalizedSql.startsWith("delete") || normalizedSql.startsWith("create") ||
            normalizedSql.startsWith("drop") || normalizedSql.startsWith("alter")) {
            return false;
        }
        
        // Default to caching for analytics use case
        return true;
    }
    
    /**
     * Clear all query caches - useful for cache management
     */
    @CacheEvict(value = {"sqlQueries", "metadataQueries"}, allEntries = true)
    public void clearAllCaches() {
        logger.info("Clearing all query caches");
    }
    
    /**
     * Execute SQL with intelligent retry logic - merges retry functionality into main SQL service
     */
    public Map<String, Object> executeQueryWithRetry(String originalQuery, String initialSQL, 
                                                    int maxResults, int timeoutSeconds, int maxRetries, 
                                                    SqlCorrectionCallback sqlCorrectionCallback) {
        Map<String, Object> result = new HashMap<>();
        List<String> errorHistory = new ArrayList<>();
        String currentSQL = initialSQL;
        String lastReasoning = "Initial SQL generation";
        Object lastConfidence = null;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            logger.info("--- RETRY ATTEMPT {}/{} ---", attempt, maxRetries);
            logger.info("Executing SQL: '{}'", currentSQL);
            
            // Clean SQL before execution (remove trailing semicolons, etc.)
            String cleanedSQL = cleanSQL(currentSQL);
            logger.debug("Cleaned SQL: '{}'", cleanedSQL);
            
            // Execute current SQL using the existing executeQuery method
            Map<String, Object> sqlResult = executeQuery(cleanedSQL, maxResults, timeoutSeconds);
            
            if ((Boolean) sqlResult.get("success")) {
                // Success! Return results with retry info
                logger.info("✅ SQL EXECUTION SUCCESSFUL on attempt {}", attempt);
                result.put("success", true);
                result.put("finalSQL", cleanedSQL);
                result.put("queryResults", sqlResult.get("queryResults"));
                result.put("executionTime", sqlResult.get("executionTime"));
                result.put("retryAttempts", attempt);
                result.put("errorHistory", errorHistory);
                result.put("reasoning", lastReasoning + (attempt > 1 ? " (corrected after " + (attempt-1) + " errors)" : ""));
                result.put("confidence", lastConfidence);
                return result;
            }
            
            // Execution failed - analyze and potentially retry
            String sqlError = (String) sqlResult.get("error");
            errorHistory.add("Attempt " + attempt + ": " + sqlError);
            logger.error("❌ SQL EXECUTION FAILED on attempt {}: {}", attempt, sqlError);
            
            String errorType = errorAnalysisService.analyzeErrorType(sqlError);
            logger.info("Error Type Analysis: {}", errorType);
            
            // Check if we should retry
            if (!shouldRetry(errorType, attempt, maxRetries) || attempt >= maxRetries) {
                result.put("success", false);
                result.put("finalSQL", currentSQL);
                result.put("error", sqlError);
                result.put("retryAttempts", attempt);
                result.put("errorHistory", errorHistory);
                result.put("reasoning", lastReasoning);
                result.put("confidence", lastConfidence);
                return result;
            }
            
            // Wait before retry if needed
            waitBeforeRetry(attempt, errorType);
            
            // Generate corrected SQL
            try {
                Map<String, Object> correctedSqlGeneration = sqlCorrectionCallback.generateCorrectedSQL(
                    originalQuery, currentSQL, sqlError, errorType, errorHistory);
                
                if (correctedSqlGeneration != null && (Boolean) correctedSqlGeneration.get("success")) {
                    currentSQL = (String) correctedSqlGeneration.get("sql");
                    lastReasoning = (String) correctedSqlGeneration.get("reasoning");
                    lastConfidence = correctedSqlGeneration.get("confidence");
                } else {
                    result.put("success", false);
                    result.put("error", "Failed to generate corrected SQL");
                    return result;
                }
            } catch (Exception e) {
                logger.error("Error generating corrected SQL: {}", e.getMessage());
                errorHistory.add("Retry " + attempt + " correction failed: " + e.getMessage());
            }
        }
        
        result.put("success", false);
        result.put("error", "Max retries exceeded");
        return result;
    }
    
    private boolean shouldRetry(String errorType, int attempt, int maxRetries) {
        switch (errorType) {
            case "SYNTAX_ERROR":
            case "COLUMN_ERROR":
                return attempt < maxRetries;
            case "SCHEMA_ERROR":
                return attempt < 2;
            case "PERMISSION_ERROR":
                return false;
            case "CONNECTION_ERROR":
                return attempt < maxRetries;
            default:
                return attempt < maxRetries;
        }
    }
    
    private void waitBeforeRetry(int attempt, String errorType) {
        if ("CONNECTION_ERROR".equals(errorType)) {
            try {
                long waitTime = Math.min(1000 * (long) Math.pow(2, attempt - 1), 10000);
                logger.info("Waiting {}ms before retry due to connection error", waitTime);
                Thread.sleep(waitTime);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.warn("Retry wait interrupted");
            }
        }
    }
    
    /**
     * Clean SQL query to remove problematic elements for Trino execution
     * Removes trailing semicolons and other formatting issues
     */
    private String cleanSQL(String sql) {
        if (sql == null || sql.trim().isEmpty()) {
            return sql;
        }
        
        String cleaned = sql.trim();
        
        // Remove trailing semicolon if present (Trino JDBC doesn't need it and can cause issues)
        if (cleaned.endsWith(";")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1).trim();
        }
        
        // Remove any multiple semicolons in the middle (common LLM mistake)
        cleaned = cleaned.replaceAll(";\\s*;", ";");
        
        // Remove semicolons that appear before common SQL clauses (another common LLM mistake)
        cleaned = cleaned.replaceAll(";\\s*(ORDER\\s+BY|GROUP\\s+BY|HAVING|LIMIT|OFFSET)", " $1");
        
        return cleaned;
    }
}

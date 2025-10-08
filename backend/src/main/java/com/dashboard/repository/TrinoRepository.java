package com.dashboard.repository;

import com.dashboard.config.TrinoProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.*;
import java.util.*;

/**
 * Repository layer for Trino database operations
 * Handles all direct database interactions and connection management
 */
@Repository
public class TrinoRepository {
    
    private static final Logger logger = LoggerFactory.getLogger(TrinoRepository.class);
    
    @Autowired
    private TrinoProperties trinoProperties;
    
    /**
     * Execute a SQL query and return results with metadata
     */
    public QueryResult executeQuery(String sql, Integer maxResults, Integer timeoutSeconds) {
        QueryResult result = new QueryResult();
        long startTime = System.currentTimeMillis();
        
        try {
            logger.info("Executing SQL query: {}", sql);
            
            Properties props = new Properties();
            props.setProperty("user", trinoProperties.getUser());
            if (trinoProperties.getPassword() != null && !trinoProperties.getPassword().isEmpty()) {
                props.setProperty("password", trinoProperties.getPassword());
            }
            
            try (Connection connection = DriverManager.getConnection(trinoProperties.getUrl(), props);
                 Statement statement = connection.createStatement()) {
                
                // Set query timeout if specified
                if (timeoutSeconds != null && timeoutSeconds > 0) {
                    statement.setQueryTimeout(timeoutSeconds);
                }
                
                // Apply LIMIT if maxResults specified and not already in query
                // Skip LIMIT for SHOW, DESCRIBE, EXPLAIN statements
                String finalSql = sql;
                String lowerSql = sql.toLowerCase().trim();
                boolean isShowStatement = lowerSql.startsWith("show") || 
                                        lowerSql.startsWith("describe") || 
                                        lowerSql.startsWith("explain");
                
                if (maxResults != null && maxResults > 0 && 
                    !lowerSql.contains("limit") && !isShowStatement) {
                    finalSql = sql + " LIMIT " + maxResults;
                }
                
                logger.debug("Final SQL: {}", finalSql);
                
                try (ResultSet rs = statement.executeQuery(finalSql)) {
                    ResultSetMetaData metaData = rs.getMetaData();
                    int columnCount = metaData.getColumnCount();
                    
                    // Extract column information
                    List<ColumnInfo> columns = new ArrayList<>();
                    for (int i = 1; i <= columnCount; i++) {
                        ColumnInfo column = new ColumnInfo();
                        column.setName(metaData.getColumnName(i));
                        column.setType(mapTrinoTypeToGeneric(metaData.getColumnTypeName(i)));
                        column.setTrinoType(metaData.getColumnTypeName(i));
                        columns.add(column);
                    }
                    
                    // Extract data rows
                    List<Map<String, Object>> data = new ArrayList<>();
                    while (rs.next()) {
                        Map<String, Object> row = new HashMap<>();
                        for (int i = 1; i <= columnCount; i++) {
                            String columnName = metaData.getColumnName(i);
                            Object value = rs.getObject(i);
                            row.put(columnName, value);
                        }
                        data.add(row);
                    }
                    
                    result.setSuccess(true);
                    result.setData(data);
                    result.setColumns(columns);
                    result.setRowCount(data.size());
                    result.setExecutionTimeMs(System.currentTimeMillis() - startTime);
                    result.setLimitApplied(maxResults);
                    
                    logger.info("Query executed successfully: {} rows returned in {}ms", 
                               data.size(), result.getExecutionTimeMs());
                    
                    // Log sample results (first 3 rows)
                    if (!data.isEmpty()) {
                        logger.info("Sample results (first {} rows):", Math.min(3, data.size()));
                        for (int i = 0; i < Math.min(3, data.size()); i++) {
                            logger.info("  Row {}: {}", i + 1, data.get(i));
                        }
                    }
                }
            }
            
        } catch (SQLException e) {
            result.setSuccess(false);
            result.setError("SQL Error: " + e.getMessage());
            result.setErrorType("SQL_ERROR");
            result.setSqlState(e.getSQLState());
            result.setErrorCode(e.getErrorCode());
            result.setExecutionTimeMs(System.currentTimeMillis() - startTime);
            
            logger.error("SQL execution failed: {} (SQLState: {}, ErrorCode: {})", 
                        e.getMessage(), e.getSQLState(), e.getErrorCode(), e);
        } catch (Exception e) {
            result.setSuccess(false);
            result.setError("Database connection error: " + e.getMessage());
            result.setErrorType("CONNECTION_ERROR");
            result.setExecutionTimeMs(System.currentTimeMillis() - startTime);
            
            logger.error("Database connection failed: {}", e.getMessage(), e);
        }
        
        return result;
    }
    
    /**
     * Test database connectivity
     */
    public boolean testConnection() {
        try {
            Properties props = new Properties();
            props.setProperty("user", trinoProperties.getUser());
            if (trinoProperties.getPassword() != null && !trinoProperties.getPassword().isEmpty()) {
                props.setProperty("password", trinoProperties.getPassword());
            }
            
            try (Connection connection = DriverManager.getConnection(trinoProperties.getUrl(), props)) {
                return connection.isValid(5); // 5 second timeout
            }
        } catch (Exception e) {
            logger.error("Connection test failed: {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * Get available catalogs
     */
    public List<String> getCatalogs() {
        QueryResult result = executeQuery("SHOW CATALOGS", null, 30);
        if (result.isSuccess()) {
            return result.getData().stream()
                    .map(row -> (String) row.get("Catalog"))
                    .toList();
        }
        return Arrays.asList("tpch", "memory"); // fallback
    }
    
    /**
     * Get schemas for a catalog
     */
    public List<String> getSchemas(String catalog) {
        String sql = "SHOW SCHEMAS FROM " + catalog;
        QueryResult result = executeQuery(sql, null, 30);
        if (result.isSuccess()) {
            return result.getData().stream()
                    .map(row -> (String) row.get("Schema"))
                    .toList();
        }
        return Arrays.asList("tiny", "sf1"); // fallback for tpch
    }
    
    /**
     * Get tables for a catalog.schema
     */
    public List<String> getTables(String catalog, String schema) {
        String sql = "SHOW TABLES FROM " + catalog + "." + schema;
        QueryResult result = executeQuery(sql, null, 30);
        if (result.isSuccess()) {
            return result.getData().stream()
                    .map(row -> (String) row.get("Table"))
                    .toList();
        }
        return Arrays.asList("nation", "region", "customer", "orders"); // fallback for tpch.tiny
    }
    
    /**
     * Map Trino SQL types to generic types for frontend
     */
    private String mapTrinoTypeToGeneric(String trinoType) {
        if (trinoType == null) return "string";
        
        String lowerType = trinoType.toLowerCase();
        if (lowerType.contains("int") || lowerType.contains("long") || 
            lowerType.contains("decimal") || lowerType.contains("double") || 
            lowerType.contains("real") || lowerType.contains("bigint")) {
            return "number";
        } else if (lowerType.contains("bool")) {
            return "boolean";
        } else if (lowerType.contains("date") || lowerType.contains("time")) {
            return "date";
        } else {
            return "string";
        }
    }
    
    /**
     * Data class for query results
     */
    public static class QueryResult {
        private boolean success;
        private List<Map<String, Object>> data;
        private List<ColumnInfo> columns;
        private int rowCount;
        private long executionTimeMs;
        private Integer limitApplied;
        private String error;
        private String errorType;
        private String sqlState;
        private Integer errorCode;
        
        // Getters and setters
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        
        public List<Map<String, Object>> getData() { return data; }
        public void setData(List<Map<String, Object>> data) { this.data = data; }
        
        public List<ColumnInfo> getColumns() { return columns; }
        public void setColumns(List<ColumnInfo> columns) { this.columns = columns; }
        
        public int getRowCount() { return rowCount; }
        public void setRowCount(int rowCount) { this.rowCount = rowCount; }
        
        public long getExecutionTimeMs() { return executionTimeMs; }
        public void setExecutionTimeMs(long executionTimeMs) { this.executionTimeMs = executionTimeMs; }
        
        public Integer getLimitApplied() { return limitApplied; }
        public void setLimitApplied(Integer limitApplied) { this.limitApplied = limitApplied; }
        
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        
        public String getErrorType() { return errorType; }
        public void setErrorType(String errorType) { this.errorType = errorType; }
        
        public String getSqlState() { return sqlState; }
        public void setSqlState(String sqlState) { this.sqlState = sqlState; }
        
        public Integer getErrorCode() { return errorCode; }
        public void setErrorCode(Integer errorCode) { this.errorCode = errorCode; }
    }
    
    /**
     * Data class for column information
     */
    public static class ColumnInfo {
        private String name;
        private String type;
        private String trinoType;
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public String getTrinoType() { return trinoType; }
        public void setTrinoType(String trinoType) { this.trinoType = trinoType; }
    }
}

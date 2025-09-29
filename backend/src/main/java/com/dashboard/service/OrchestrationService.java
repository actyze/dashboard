package com.dashboard.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;

/**
 * Orchestration service that manages the workflow for natural language query processing.
 * Coordinates between ML models, database queries, and chart generation.
 */
@Service
public class OrchestrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(OrchestrationService.class);
    
    private final RestTemplate restTemplate;
    private static final String ML_SERVICE_URL = "http://localhost:8000"; // FastAPI ML service
    private static final String SCHEMA_SERVICE_URL = "http://dashboard-schema-service:8001"; // FastAPI ML service
    
    public OrchestrationService() {
        this.restTemplate = new RestTemplate();
    }
    
    /**
     * Orchestrates the complete natural language query workflow:
     * 1. Get schema recommendations from FAISS service
     * 2. Send NL query + schema context to ML service for SQL generation
     * 3. Execute generated SQL query
     * 4. Get chart recommendations
     * 5. Return combined results
     */
    public Map<String, Object> processNaturalLanguageWorkflow(String nlQuery, Boolean includeChart, String chartType) {
        return processNaturalLanguageWorkflow(nlQuery, new ArrayList<>(), includeChart, chartType);
    }
    
    /**
     * Orchestrates the complete natural language query workflow with prior context:
     * 1. Get context-aware schema recommendations from FAISS service
     * 2. Send NL query + schema context to ML service for SQL generation
     * 3. Execute generated SQL query
     * 4. Get chart recommendations
     * 5. Return combined results
     */
    public Map<String, Object> processNaturalLanguageWorkflow(String nlQuery, List<String> priorContext, Boolean includeChart, String chartType) {
        logger.info("Starting NL workflow for query: {} with {} context items", nlQuery, priorContext.size());
        
        Map<String, Object> result = new HashMap<>();
        long startTime = System.currentTimeMillis();
        
        try {
            // Step 1: Get context-aware schema recommendations from FAISS service
            Map<String, Object> schemaRecommendations = getSchemaRecommendations(nlQuery, priorContext);
            result.put("schemaRecommendations", schemaRecommendations);
            
            // Step 2: Generate SQL from natural language with schema context
            Map<String, Object> sqlGenerationResult = generateSQLFromNL(nlQuery);
            String generatedSQL = (String) sqlGenerationResult.get("sql");
            Double confidence = (Double) sqlGenerationResult.get("confidence");
            
            result.put("naturalLanguage", nlQuery);
            result.put("generatedSQL", generatedSQL);
            result.put("confidence", confidence);
            result.put("mlServiceUsed", sqlGenerationResult.get("serviceUsed"));
            
            // Step 2: Execute the generated SQL
            Map<String, Object> queryResults = executeSQL(generatedSQL);
            result.put("queryResults", queryResults);
            
            // Step 3: Generate chart recommendations if requested
            if (includeChart) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> data = (List<Map<String, Object>>) queryResults.get("data");
                Map<String, Object> chartData = generateChartRecommendation(
                    data, 
                    nlQuery, 
                    chartType
                );
                result.put("chartData", chartData);
            }
            
            // Step 4: Add workflow metadata
            long processingTime = System.currentTimeMillis() - startTime;
            result.put("processingTime", processingTime);
            result.put("workflow", "complete");
            result.put("success", true);
            
            logger.info("NL workflow completed in {}ms", processingTime);
            
        } catch (Exception e) {
            logger.error("Error in NL workflow: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Workflow failed: " + e.getMessage());
            result.put("workflow", "failed");
        }
        
        return result;
    }
    
    /**
     * Step 1: Generate SQL from natural language using ML service
     */
    private Map<String, Object> generateSQLFromNL(String nlQuery) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // Try to call ML service
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("input", nlQuery);
            requestBody.put("type", "natural");
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            @SuppressWarnings({"rawtypes", "unchecked"})
            ResponseEntity<Map> response = restTemplate.postForEntity(
                ML_SERVICE_URL + "/predict", 
                request, 
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> mlResponse = (Map<String, Object>) response.getBody();
                result.put("sql", mlResponse.get("sql"));
                result.put("confidence", mlResponse.get("confidence"));
                result.put("serviceUsed", "ML");
                logger.info("SQL generated using ML service");
            } else {
                throw new RuntimeException("ML service returned error");
            }
            
        } catch (Exception e) {
            logger.warn("ML service unavailable, using fallback: {}", e.getMessage());
            // Fallback to mock SQL generation
            result.put("sql", generateMockSQL(nlQuery));
            result.put("confidence", 0.75);
            result.put("serviceUsed", "Fallback");
        }
        
        return result;
    }
    
    /**
     * Step 2: Execute SQL query (mock implementation)
     */
    private Map<String, Object> executeSQL(String sql) {
        logger.info("Executing SQL: {}", sql);
        
        // Mock SQL execution - in production this would connect to actual database
        List<Map<String, Object>> queryData = getMockQueryResults(sql);
        
        Map<String, Object> result = new HashMap<>();
        result.put("data", queryData);
        result.put("rowCount", queryData.size());
        result.put("columns", extractColumnInfo(queryData));
        result.put("executionTime", 245);
        
        return result;
    }
    
    /**
     * Step 3: Generate chart recommendations
     */
    private Map<String, Object> generateChartRecommendation(List<Map<String, Object>> data, String nlQuery, String chartType) {
        try {
            // Try to call ML service for chart recommendation
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("data", data);
            requestBody.put("query_context", nlQuery);
            requestBody.put("chart_type", chartType);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                ML_SERVICE_URL + "/chart", 
                request, 
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                logger.info("Chart recommendation generated using ML service");
                return response.getBody();
            } else {
                throw new RuntimeException("Chart ML service returned error");
            }
            
        } catch (Exception e) {
            logger.warn("Chart ML service unavailable, using fallback: {}", e.getMessage());
            // Fallback to basic chart recommendation
            return createFallbackChartResponse(data, chartType);
        }
    }
    
    // Fallback methods (existing mock implementations)
    
    private String generateMockSQL(String nlQuery) {
        String lower = nlQuery.toLowerCase();
        if (lower.contains("sales") || lower.contains("revenue")) {
            return "SELECT month, SUM(revenue) as revenue, COUNT(*) as orders FROM sales GROUP BY month ORDER BY month";
        } else if (lower.contains("customer") || lower.contains("user")) {
            return "SELECT region, COUNT(*) as customers, AVG(satisfaction) as satisfaction FROM customers GROUP BY region";
        } else {
            return "SELECT category, SUM(value) as value, COUNT(*) as count FROM data GROUP BY category ORDER BY value DESC";
        }
    }
    
    private List<Map<String, Object>> getMockQueryResults(String query) {
        List<Map<String, Object>> data = new ArrayList<>();
        
        if (query.toLowerCase().contains("sales") || query.toLowerCase().contains("revenue")) {
            data.add(createRow("month", "January", "revenue", 45000, "orders", 120));
            data.add(createRow("month", "February", "revenue", 52000, "orders", 135));
            data.add(createRow("month", "March", "revenue", 48000, "orders", 128));
            data.add(createRow("month", "April", "revenue", 61000, "orders", 155));
        } else if (query.toLowerCase().contains("customer") || query.toLowerCase().contains("user")) {
            data.add(createRow("region", "North", "customers", 1250, "satisfaction", 4.2));
            data.add(createRow("region", "South", "customers", 980, "satisfaction", 4.5));
            data.add(createRow("region", "East", "customers", 1100, "satisfaction", 4.1));
            data.add(createRow("region", "West", "customers", 1350, "satisfaction", 4.7));
        } else {
            data.add(createRow("category", "A", "value", 100, "count", 25));
            data.add(createRow("category", "B", "value", 200, "count", 40));
            data.add(createRow("category", "C", "value", 150, "count", 30));
            data.add(createRow("category", "D", "value", 300, "count", 60));
        }
        
        return data;
    }
    
    private Map<String, Object> createRow(String key1, Object val1, String key2, Object val2, String key3, Object val3) {
        Map<String, Object> row = new HashMap<>();
        row.put(key1, val1);
        row.put(key2, val2);
        row.put(key3, val3);
        return row;
    }
    
    private List<Map<String, Object>> extractColumnInfo(List<Map<String, Object>> data) {
        List<Map<String, Object>> columns = new ArrayList<>();
        if (!data.isEmpty()) {
            Map<String, Object> firstRow = data.get(0);
            for (Map.Entry<String, Object> entry : firstRow.entrySet()) {
                Map<String, Object> column = new HashMap<>();
                column.put("name", entry.getKey());
                column.put("type", getDataType(entry.getValue()));
                columns.add(column);
            }
        }
        return columns;
    }
    
    private String getDataType(Object value) {
        if (value instanceof Number) return "number";
        if (value instanceof Boolean) return "boolean";
        return "string";
    }
    
    private Map<String, Object> createFallbackChartResponse(List<Map<String, Object>> data, String chartType) {
        if ("auto".equals(chartType)) {
            chartType = recommendChartType(data);
        }
        
        Map<String, Object> chartData = new HashMap<>();
        chartData.put("type", chartType);
        chartData.put("data", data);
        chartData.put("config", createChartConfig(data, chartType));
        chartData.put("fallback", true);
        
        return chartData;
    }
    
    private String recommendChartType(List<Map<String, Object>> data) {
        if (data.isEmpty()) return "table";
        
        Map<String, Object> firstRow = data.get(0);
        int numericColumns = 0;
        int stringColumns = 0;
        
        for (Object value : firstRow.values()) {
            if (value instanceof Number) {
                numericColumns++;
            } else {
                stringColumns++;
            }
        }
        
        if (stringColumns >= 1 && numericColumns >= 1) {
            return data.size() <= 5 ? "pie" : "bar";
        } else if (numericColumns >= 2) {
            return "scatter";
        } else {
            return "line";
        }
    }
    
    private Map<String, Object> createChartConfig(List<Map<String, Object>> data, String chartType) {
        Map<String, Object> config = new HashMap<>();
        config.put("type", chartType);
        config.put("responsive", true);
        config.put("maintainAspectRatio", false);
        
        if (!data.isEmpty()) {
            Map<String, Object> firstRow = data.get(0);
            String[] keys = firstRow.keySet().toArray(new String[0]);
            if (keys.length >= 2) {
                config.put("xField", keys[0]);
                config.put("yField", keys[1]);
            }
        }
        
        return config;
    }
    
    /**
     * Get schema recommendations from FAISS service for natural language query with context
     */
    private Map<String, Object> getSchemaRecommendations(String nlQuery) {
        return getSchemaRecommendations(nlQuery, new ArrayList<>());
    }
    
    /**
     * Get schema recommendations from FAISS service with prior context
     */
    private Map<String, Object> getSchemaRecommendations(String nlQuery, List<String> priorContext) {
        logger.info("Getting schema recommendations for query: {} with {} context items", nlQuery, priorContext.size());
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("natural_language_query", nlQuery);
            requestBody.put("prior_context", priorContext);
            requestBody.put("top_k", 10);
            requestBody.put("confidence_threshold", 0.3);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            @SuppressWarnings({"rawtypes", "unchecked"})
            ResponseEntity<Map> response = restTemplate.postForEntity(
                SCHEMA_SERVICE_URL + "/recommend", 
                request, 
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> schemaResponse = (Map<String, Object>) response.getBody();
                logger.info("Schema service returned {} recommendations", 
                    ((List<?>) schemaResponse.get("recommendations")).size());
                return schemaResponse;
            } else {
                throw new RuntimeException("Schema service returned error");
            }
            
        } catch (Exception e) {
            logger.warn("Schema service unavailable, using fallback: {}", e.getMessage());
            
            // Fallback: return empty recommendations
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("recommendations", new ArrayList<>());
            fallback.put("total_schemas", 0);
            fallback.put("query_embedding_time", 0.0);
            fallback.put("search_time", 0.0);
            fallback.put("service_used", "fallback");
            return fallback;
        }
    }
}

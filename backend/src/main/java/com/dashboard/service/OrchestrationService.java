package com.dashboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Clean OrchestrationService - Pure workflow coordination only
 * All business logic extracted to dedicated services
 */
@Service
public class OrchestrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(OrchestrationService.class);
    
    @Autowired
    private SqlExecutionService sqlExecutionService;
    
    @Autowired
    private SqlErrorAnalysisService errorAnalysisService;
    
    @Autowired
    private LlmCommunicationService llmCommunicationService;
    
    @Autowired
    private SchemaRecommendationService schemaRecommendationService;
    
    @Autowired
    private ServiceHealthService serviceHealthService;
    
    @Value("${dashboard.sql.execution.default-max-results:100}")
    private int defaultMaxResults;
    
    @Value("${dashboard.sql.execution.default-timeout-seconds:30}")
    private int defaultTimeoutSeconds;
    
    /**
     * Main workflow orchestration - coordinates all services
     * Flow: NL Query → Schema Service → LLM Service → SQL Execution Service
     */
    public Map<String, Object> processNaturalLanguageWorkflow(String nlQuery, List<String> userQueryHistory, Boolean includeChart, String chartType) {
        logger.info("Processing natural language workflow: {}", nlQuery);
        
        Map<String, Object> result = new HashMap<>();
        long startTime = System.currentTimeMillis();
        
        try {
            // Step 1: Get schema recommendations from FAISS service
            logger.info("=== STEP 1: FAISS SCHEMA SERVICE ===");
            logger.info("Input NL Query: '{}'", nlQuery);
            logger.info("Input Query History: {}", userQueryHistory != null ? userQueryHistory : "None");
            logger.debug("=== ORCHESTRATION DEBUG - STEP 1 ===");
            logger.debug("Request timestamp: {}", System.currentTimeMillis());
            logger.debug("Query length: {} characters", nlQuery.length());
            logger.debug("History entries: {}", userQueryHistory != null ? userQueryHistory.size() : 0);
            
            Map<String, Object> schemaRecommendations = schemaRecommendationService.getSchemaRecommendations(nlQuery, userQueryHistory);
            
            logger.info("FAISS Output - Success: {}", schemaRecommendations.get("success"));
            if (schemaRecommendations.get("recommendations") != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> recs = (List<Map<String, Object>>) schemaRecommendations.get("recommendations");
                logger.info("FAISS Output - Found {} schema recommendations", recs.size());
                for (int i = 0; i < Math.min(3, recs.size()); i++) {
                    Map<String, Object> rec = recs.get(i);
                    logger.info("  Schema {}: {} (confidence: {})", i+1, rec.get("full_name"), rec.get("confidence"));
                }
            }
            
            // FAISS service returns recommendations directly, not a success field
            if (schemaRecommendations == null || schemaRecommendations.get("recommendations") == null) {
                String errorMsg = schemaRecommendations != null ? 
                    (String) schemaRecommendations.get("error") : "FAISS service returned null";
                logger.error("FAISS validation failed: schemaRecommendations={}, error={}", schemaRecommendations, errorMsg);
                return createWorkflowErrorResponse("Failed to get schema recommendations: " + errorMsg, "SCHEMA_SERVICE_ERROR", startTime);
            }
            
            // Step 2: Send NL query + schema context + history to LLM for SQL generation
            logger.info("=== STEP 2: SQL GENERATION (LLM) ===");
            logger.info("LLM Input - NL Query: '{}'", nlQuery);
            logger.info("LLM Input - Schema Context: {} recommendations", 
                schemaRecommendations.get("recommendations") != null ? 
                ((List<?>) schemaRecommendations.get("recommendations")).size() : 0);
            
            Map<String, Object> sqlGeneration = llmCommunicationService.generateSQL(nlQuery, userQueryHistory, schemaRecommendations);
            
            logger.info("LLM Output - Success: {}", sqlGeneration != null ? sqlGeneration.get("success") : "null response");
            if (sqlGeneration != null) {
                logger.info("LLM Output - SQL: '{}'", sqlGeneration.get("sql"));
                logger.info("LLM Output - Confidence: {}", sqlGeneration.get("confidence"));
                logger.info("LLM Output - Reasoning: '{}'", sqlGeneration.get("reasoning"));
            }
            
            if (sqlGeneration == null || !(Boolean) sqlGeneration.get("success")) {
                String error = sqlGeneration != null ? (String) sqlGeneration.get("error") : "null response";
                String errorType = sqlGeneration != null ? (String) sqlGeneration.get("errorType") : "UNKNOWN_ERROR";
                
                logger.error("SQL Generation Failed - Type: {}, Error: {}", errorType, error);
                
                // Provide specific error messages based on error type
                String userFriendlyError;
                switch (errorType) {
                    case "CONFIGURATION_ERROR":
                        userFriendlyError = "LLM service is not properly configured. Please contact administrator.";
                        break;
                    case "NETWORK_ERROR":
                        userFriendlyError = "Unable to connect to LLM service. Please try again later.";
                        break;
                    case "API_ERROR":
                        userFriendlyError = "LLM service authentication failed. Please contact administrator.";
                        break;
                    default:
                        userFriendlyError = "Failed to generate SQL query. Please try rephrasing your request.";
                }
                
                return createWorkflowErrorResponse(userFriendlyError, errorType, startTime);
            }
            
            String generatedSQL = (String) sqlGeneration.get("sql");
            if (generatedSQL == null || generatedSQL.trim().isEmpty()) {
                logger.error("Generated SQL is empty or null");
                return createWorkflowErrorResponse("Generated SQL is empty", "SQL_GENERATION_ERROR", startTime);
            }
            
            // Step 3: Execute generated SQL with retry logic
            logger.info("=== STEP 3: SQL EXECUTION WITH RETRY ===");
            logger.info("Initial SQL to execute: '{}'", generatedSQL);
            logger.info("Max retry attempts: 3");
            
            // Use the merged SQL service with retry functionality
            Map<String, Object> sqlResult = sqlExecutionService.executeQueryWithRetry(
                nlQuery, 
                generatedSQL, 
                defaultMaxResults,
                defaultTimeoutSeconds,
                3, 
                (originalQuery, failedSQL, sqlError, errorType, errorHistory) -> 
                    generateCorrectedSQLWithEnhancedContext(originalQuery, failedSQL, sqlError, errorType, schemaRecommendations, userQueryHistory, errorHistory)
            );
            
            // Step 4: Combine all results into workflow response
            result.put("success", true);
            result.put("nlQuery", nlQuery);
            result.put("historySize", userQueryHistory != null ? userQueryHistory.size() : 0);
            result.put("generatedSQL", sqlResult.get("finalSQL"));
            result.put("schemaRecommendations", schemaRecommendations.get("recommendations"));
            result.put("modelConfidence", sqlResult.get("confidence"));
            result.put("modelReasoning", sqlResult.get("reasoning"));
            result.put("processingTime", System.currentTimeMillis() - startTime);
            result.put("queryResults", sqlResult.get("queryResults"));
            result.put("executionTime", sqlResult.get("executionTime"));
            result.put("retryAttempts", sqlResult.get("retryAttempts"));
            result.put("errorHistory", sqlResult.get("errorHistory"));
            
            logger.info("Natural language workflow completed successfully after {} attempts: {} -> {}", 
                sqlResult.get("retryAttempts"), nlQuery, sqlResult.get("finalSQL"));
            
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Workflow processing error: " + e.getMessage());
            result.put("errorType", "PROCESSING_ERROR");
            result.put("processingTime", System.currentTimeMillis() - startTime);
            logger.error("Natural language workflow failed: {}", e.getMessage(), e);
        }
        
        return result;
    }
    
    /**
     * Generate corrected SQL with enhanced error context and guidance
     * This is the callback used by the retry mechanism
     */
    private Map<String, Object> generateCorrectedSQLWithEnhancedContext(String originalQuery, String failedSQL, 
                                                                       String sqlError, String errorType,
                                                                       Map<String, Object> schemaRecommendations, 
                                                                       List<String> queryHistory, List<String> errorHistory) {
        
        // Use the error analysis service to build enhanced prompt
        String enhancedPrompt = errorAnalysisService.buildEnhancedErrorPrompt(
            originalQuery, failedSQL, sqlError, errorType, errorHistory);
        
        logger.debug("Sending enhanced correction prompt to LLM: {}", enhancedPrompt);
        
        // Use the LLM communication service with enhanced error correction context
        return llmCommunicationService.generateSQL(enhancedPrompt, queryHistory, schemaRecommendations);
    }
    
    /**
     * Create standardized error response for workflow failures
     */
    private Map<String, Object> createWorkflowErrorResponse(String message, String errorType, long startTime) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("error", message);
        errorResponse.put("errorType", errorType);
        errorResponse.put("processingTime", System.currentTimeMillis() - startTime);
        return errorResponse;
    }
}

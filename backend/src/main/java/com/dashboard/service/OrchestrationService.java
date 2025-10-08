package com.dashboard.service;

import org.springframework.stereotype.Service;
import java.util.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
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
 * Coordinates between ML models and SQL execution services.
 * Follows proper 3-tier architecture: Controller -> Service -> Repository
 */
@Service
public class OrchestrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(OrchestrationService.class);
    
    // System message for external LLM APIs (OpenAI-compatible format)
    private static final String SYSTEM_MESSAGE = 
        "You are an expert Trino 477 SQL developer. Generate optimized SQL queries based on the provided schema context.";
    
    @Autowired
    private SqlExecutionService sqlExecutionService;
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Value("${dashboard.faiss.service.url:http://dashboard-schema-service:8001}")
    private String faissServiceUrl;
    
    @Value("${dashboard.ml.service.url:http://dashboard-ml-service:8000}")
    private String mlServiceUrl;
    
    @Value("${dashboard.ml.service.endpoint:/predict}")
    private String mlServiceEndpoint;
    
    @Value("${dashboard.ml.service.model-type:phi4-lora}")
    private String modelType;
    
    @Value("${dashboard.ml.service.parameters.max-tokens:1000}")
    private Integer maxTokens;
    
    @Value("${dashboard.ml.service.parameters.temperature:0.1}")
    private Double temperature;
    
    // External LLM Configuration - Simplified
    @Value("${dashboard.external-llm.enabled:false}")
    private Boolean externalLlmEnabled;
    
    @Value("${dashboard.external-llm.provider:openai}")
    private String externalLlmProvider;
    
    @Value("${dashboard.external-llm.api-key:}")
    private String externalLlmApiKey;
    
    @Value("${dashboard.external-llm.model:gpt-4o-mini}")
    private String externalLlmModel;
    
    @Value("${dashboard.external-llm.base-url:https://api.openai.com/v1}")
    private String externalLlmBaseUrl;
    
    @Value("${dashboard.external-llm.fallback.enabled:true}")
    private Boolean fallbackEnabled;
    
    @Value("${dashboard.external-llm.fallback.local-model:phi4-lora}")
    private String fallbackLocalModel;
    
    @Value("${dashboard.ml.service.parameters.max-length:512}")
    private Integer maxLength;
    
    @Value("${dashboard.ml.service.parameters.do-sample:false}")
    private Boolean doSample;
    
    @Value("${dashboard.ml.service.parameters.num-beams:1}")
    private Integer numBeams;
    
    @Value("${dashboard.ml.service.request-format.use-standard-format:true}")
    private Boolean useStandardFormat;
    
    @Value("${dashboard.ml.service.request-format.include-schema-context:true}")
    private Boolean includeSchemaContext;
    
    @Value("${dashboard.ml.service.request-format.include-conversation-history:true}")
    private Boolean includeConversationHistory;
    
    @Value("${dashboard.sql.execution.default-max-results:100}")
    private Integer defaultMaxResults;
    
    @Value("${dashboard.sql.execution.default-timeout-seconds:30}")
    private Integer defaultTimeoutSeconds;
    
    /**
     * Natural Language to SQL Workflow:
     * 1. Get schema recommendations from schema service
     * 2. Send NL query + schema context to ML service for SQL generation
     * 3. Execute generated SQL query via SqlExecutionService
     * 4. Return results (chart generation handled by frontend)
     */
    public Map<String, Object> processNaturalLanguageWorkflow(String nlQuery, Boolean includeChart, String chartType) {
        return processNaturalLanguageWorkflow(nlQuery, new ArrayList<>(), includeChart, chartType);
    }
    
    /**
     * Orchestrates the complete natural language query workflow with user query history
     * Flow: NL Query → FAISS Schema Service → Phi-4 LoRA Model → SQL Execution Service
     */
    public Map<String, Object> processNaturalLanguageWorkflow(String nlQuery, List<String> userQueryHistory, Boolean includeChart, String chartType) {
        logger.info("Processing natural language workflow: {}", nlQuery);
        
        Map<String, Object> result = new HashMap<>();
        long startTime = System.currentTimeMillis();
        
        try {
            // Step 1: Get schema recommendations from FAISS service
            logger.debug("Step 1: Getting schema recommendations from FAISS service");
            Map<String, Object> schemaRecommendations = getSchemaRecommendations(nlQuery, userQueryHistory);
            
            logger.info("FAISS response received: {}", schemaRecommendations != null ? "not null" : "null");
            if (schemaRecommendations != null) {
                logger.info("FAISS response keys: {}", schemaRecommendations.keySet());
                logger.info("Has recommendations: {}", schemaRecommendations.containsKey("recommendations"));
            }
            
            // FAISS service returns recommendations directly, not a success field
            if (schemaRecommendations == null || schemaRecommendations.get("recommendations") == null) {
                String errorMsg = schemaRecommendations != null ? 
                    (String) schemaRecommendations.get("error") : "FAISS service returned null";
                logger.error("FAISS validation failed: schemaRecommendations={}, error={}", schemaRecommendations, errorMsg);
                return createWorkflowErrorResponse("Failed to get schema recommendations: " + errorMsg, "SCHEMA_SERVICE_ERROR", startTime);
            }
            
            // Step 2: Send NL query + schema context + history to ML model for SQL generation
            logger.debug("Step 2: Generating SQL using ML model service");
            Map<String, Object> sqlGeneration = generateSQLWithMLModel(nlQuery, userQueryHistory, schemaRecommendations);
            
            if (sqlGeneration == null || !(Boolean) sqlGeneration.get("success")) {
                return createWorkflowErrorResponse("Failed to generate SQL", "ML_MODEL_ERROR", startTime);
            }
            
            String generatedSQL = (String) sqlGeneration.get("sql");
            if (generatedSQL == null || generatedSQL.trim().isEmpty()) {
                return createWorkflowErrorResponse("Generated SQL is empty", "SQL_GENERATION_ERROR", startTime);
            }
            
            // Step 3: Execute generated SQL via SqlExecutionService
            logger.debug("Step 3: Executing generated SQL: {}", generatedSQL);
            Map<String, Object> sqlResult = sqlExecutionService.executeQuery(generatedSQL, defaultMaxResults, defaultTimeoutSeconds);
            
            // Step 4: Combine all results into workflow response
            result.put("success", true);
            result.put("nlQuery", nlQuery);
            result.put("historySize", userQueryHistory != null ? userQueryHistory.size() : 0);
            result.put("generatedSQL", generatedSQL);
            result.put("schemaRecommendations", schemaRecommendations.get("recommendations"));
            result.put("modelConfidence", sqlGeneration.get("confidence"));
            result.put("modelReasoning", sqlGeneration.get("reasoning"));
            result.put("processingTime", System.currentTimeMillis() - startTime);
            
            // Include SQL execution results
            if ((Boolean) sqlResult.get("success")) {
                result.put("queryResults", sqlResult.get("queryResults"));
                result.put("executionTime", sqlResult.get("executionTime"));
                logger.info("Natural language workflow completed successfully: {} -> {}", nlQuery, generatedSQL);
            } else {
                result.put("success", false);
                result.put("error", "SQL execution failed: " + sqlResult.get("error"));
                result.put("errorType", "SQL_EXECUTION_ERROR");
                result.put("sqlError", sqlResult.get("error"));
            }
            
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
     * Get schema recommendations from FAISS service
     */
    private Map<String, Object> getSchemaRecommendations(String nlQuery, List<String> queryHistory) {
        try {
            logger.debug("Calling FAISS service at: {}/recommend", faissServiceUrl);
            
            // Prepare request payload for FAISS schema service
            Map<String, Object> requestPayload = new HashMap<>();
            requestPayload.put("natural_language_query", nlQuery);
            requestPayload.put("conversation_history", queryHistory != null ? queryHistory : new ArrayList<>());
            requestPayload.put("max_recommendations", 5);
            requestPayload.put("confidence_threshold", 0.3);
            
            // Log schema service request
            logger.info("Schema Service Request -> query: '{}', historySize: {}, maxRecs: 5", 
                nlQuery, (queryHistory != null ? queryHistory.size() : 0));
            
            // Set up HTTP headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestPayload, headers);
            
            // Make HTTP call to FAISS service
            String endpoint = faissServiceUrl + "/recommend";
            ResponseEntity<Map> response = restTemplate.exchange(
                endpoint,
                HttpMethod.POST,
                request,
                Map.class
            );
            
            Map<String, Object> responseBody = response.getBody();
            if (responseBody != null) {
                logger.info("FAISS service responded successfully for query: {}", nlQuery);
                
                // Log schema recommendations summary
                List<?> recommendations = (List<?>) responseBody.get("recommendations");
                if (recommendations != null) {
                    logger.info("Schema Service returned {} recommendations", recommendations.size());
                    for (int i = 0; i < Math.min(3, recommendations.size()); i++) {
                        Map<String, Object> rec = (Map<String, Object>) recommendations.get(i);
                        logger.info("  [{}] {} (confidence: {})", 
                            i + 1, rec.get("full_name"), rec.get("confidence"));
                    }
                }
                
                // Full response at debug level for detailed troubleshooting
                if (logger.isDebugEnabled()) {
                    logger.debug("FAISS full response: {}", responseBody);
                }
                return responseBody;
            } else {
                logger.warn("FAISS service returned empty response");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("error", "FAISS service returned empty response");
                return errorResponse;
            }
            
        } catch (ResourceAccessException e) {
            logger.error("Failed to connect to FAISS service at {}: {}", faissServiceUrl, e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "FAISS service unavailable: " + e.getMessage());
            errorResponse.put("service_url", faissServiceUrl);
            return errorResponse;
            
        } catch (Exception e) {
            logger.error("Failed to get schema recommendations: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "FAISS service error: " + e.getMessage());
            return errorResponse;
        }
    }
    
    /**
     * Generate SQL using ML model service (External LLM, CodeT5+, Phi-4, or other available models)
     */
    private Map<String, Object> generateSQLWithMLModel(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        try {
            logger.debug("Calling ML model service for SQL generation");
            
            // Log all decision and config variables to verify Spring is reading correct values
            logger.info("Decision vars -> externalLlmEnabled={}, modelType={}", externalLlmEnabled, modelType);
            logger.info("External LLM Config -> provider={}, model={}, baseUrl={}, apiKeyLength={}, fallbackEnabled={}", 
                externalLlmProvider, 
                externalLlmModel, 
                externalLlmBaseUrl, 
                (externalLlmApiKey != null ? externalLlmApiKey.length() : 0),
                fallbackEnabled);

            // Route based on external LLM enablement only. If enabled, always use external LLM.
            if (Boolean.TRUE.equals(externalLlmEnabled)) {
                logger.info("Routing to external LLM provider: {}", externalLlmProvider);
                return callExternalLLM(nlQuery, queryHistory, schemaContext);
            }

            // Otherwise, use the configured local model (e.g., phi4-lora, codet5, etc.)
            logger.info("Routing to local ML model: {}", modelType);
            return callLocalMLModel(nlQuery, queryHistory, schemaContext);
            
        } catch (Exception e) {
            logger.error("Failed to call ML model service: {}", e.getMessage(), e);
            
            // Try fallback if enabled
            if (fallbackEnabled && Boolean.TRUE.equals(externalLlmEnabled)) {
                logger.warn("External LLM failed, trying fallback local model: {}", fallbackLocalModel);
                try {
                    return callLocalMLModel(nlQuery, queryHistory, schemaContext);
                } catch (Exception fallbackException) {
                    logger.error("Fallback local model also failed: {}", fallbackException.getMessage());
                }
            }
            
            return createMLServiceErrorResponse("ML service connection failed: " + e.getMessage());
        }
    }
    
    /**
     * Call external LLM API using OpenAI-compatible format
     * Works with: OpenAI, Perplexity, Groq, Together.ai, and most modern LLM APIs
     */
    private Map<String, Object> callExternalLLM(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        try {
            // Log all external LLM config values to verify Spring is reading them correctly
            logger.info("External LLM Config -> provider={}, model={}, baseUrl={}, apiKeySet={}, fallbackEnabled={}", 
                externalLlmProvider, 
                externalLlmModel, 
                externalLlmBaseUrl, 
                (externalLlmApiKey != null && !externalLlmApiKey.isEmpty()), 
                fallbackEnabled);
            
            // Validate API key
            if (externalLlmApiKey == null || externalLlmApiKey.trim().isEmpty()) {
                throw new IllegalStateException("External LLM API key is not configured");
            }
            
            String prompt = buildUserPrompt(nlQuery, queryHistory, schemaContext);
            
            // Log external LLM request
            logger.info("External LLM Request -> prompt length: {} chars, model: {}", prompt.length(), externalLlmModel);
            logger.info("Prompt preview (first 500 chars): {}", 
                prompt.length() > 500 ? prompt.substring(0, 500) + "..." : prompt);
            
            // Log API key status for debugging
            String apiKeyStatus = "set(" + externalLlmApiKey.substring(0, Math.min(4, externalLlmApiKey.length())) + "...)";
            logger.info("Calling external LLM -> endpoint={}/chat/completions, apiKey={}", externalLlmBaseUrl, apiKeyStatus);
            
            // Call using OpenAI-compatible format (works for most modern LLM providers)
            return callOpenAICompatibleAPI(prompt);
            
        } catch (Exception e) {
            logger.error("External LLM call failed: {}", e.getMessage(), e);
            throw e;
        }
    }
    
    /**
     * Call local ML model (existing implementation)
     */
    private Map<String, Object> callLocalMLModel(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        // Prepare request payload based on model type and format preferences
        Map<String, Object> requestPayload = createMLRequestPayload(nlQuery, queryHistory, schemaContext);
        
        // Set up HTTP headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestPayload, headers);
        
        // Call ML model service (configurable endpoint)
        String fullEndpoint = mlServiceUrl + mlServiceEndpoint;
        logger.debug("Calling local ML service ({}) at: {}", modelType, fullEndpoint);
        ResponseEntity<Map> response = restTemplate.postForEntity(
            fullEndpoint, 
            request, 
            Map.class
        );
        
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            Map<String, Object> responseBody = response.getBody();
            logger.info("Local ML model service responded successfully");
            return responseBody;
        } else {
            logger.warn("Local ML model service returned non-success status: {}", response.getStatusCode());
            return createMLServiceErrorResponse("ML service returned error status: " + response.getStatusCode());
        }
    }
    
    /**
     * Create ML request payload based on model type and configuration
     * Supports both standard format and Phi-4-LoRA specific format
     */
    private Map<String, Object> createMLRequestPayload(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        Map<String, Object> requestPayload = new HashMap<>();
        
        if (useStandardFormat) {
            // Standard format for most models (CodeT5+, FLAN-T5, etc.)
            requestPayload.put("natural_language_query", nlQuery);
            
            if (includeConversationHistory && queryHistory != null && !queryHistory.isEmpty()) {
                requestPayload.put("conversation_history", queryHistory);
            }
            
            if (includeSchemaContext && schemaContext != null) {
                requestPayload.put("schema_context", schemaContext);
            }
            
            // Standard generation parameters
            requestPayload.put("max_tokens", maxTokens);
            requestPayload.put("temperature", temperature);
            requestPayload.put("max_length", maxLength);
            requestPayload.put("do_sample", doSample);
            requestPayload.put("num_beams", numBeams);
            
        } else {
            // Custom format for specific models (like Phi-4-LoRA)
            if ("phi4-lora".equals(modelType)) {
                // Phi-SQL-LoRA expects 'prompt' field, not 'messages'
                requestPayload.put("prompt", buildPhi4LoRAPrompt(nlQuery, queryHistory, schemaContext));
                requestPayload.put("max_new_tokens", maxTokens);
                requestPayload.put("temperature", temperature);
                requestPayload.put("do_sample", doSample);
                requestPayload.put("return_full_text", false); // Standard for SQL generation
                requestPayload.put("pad_token_id", 50256); // Phi model standard
            } else {
                // Fallback to standard format
                requestPayload.put("natural_language_query", nlQuery);
                requestPayload.put("max_tokens", maxTokens);
                requestPayload.put("temperature", temperature);
            }
        }
        
        // Add model type for service routing
        requestPayload.put("model_type", modelType);
        
        return requestPayload;
    }
    
    /**
     * Build Phi-4-LoRA prompt format for the /predict endpoint
     */
    private String buildPhi4LoRAPrompt(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        StringBuilder prompt = new StringBuilder();
        
        // System instruction
        prompt.append("You are an expert Trino 477 SQL developer. Generate optimized SQL queries and provide a brief dataset summary.\n\n");
        
        // Previous Query section
        if (includeConversationHistory && queryHistory != null && !queryHistory.isEmpty()) {
            prompt.append("Previous Query: ").append(queryHistory.get(queryHistory.size() - 1)).append("\n\n");
        } else {
            prompt.append("Previous Query: None\n\n");
        }
        
        // Database and Schema information from FAISS
        if (includeSchemaContext && schemaContext != null && schemaContext.get("recommendations") != null) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> recommendations = (List<Map<String, Object>>) schemaContext.get("recommendations");
            
            // Extract unique databases and schemas
            Set<String> databases = new HashSet<>();
            Set<String> schemas = new HashSet<>();
            List<String> tableDescriptions = new ArrayList<>();
            
            for (Map<String, Object> rec : recommendations) {
                String fullName = (String) rec.get("full_name");
                @SuppressWarnings("unchecked")
                List<String> columns = (List<String>) rec.get("columns");
                
                if (fullName != null && columns != null) {
                    String[] parts = fullName.split("\\.");
                    if (parts.length >= 2) {
                        databases.add(parts[0]);
                        schemas.add(parts[0] + "." + parts[1]);
                    }
                    
                    // Format columns as column|type
                    tableDescriptions.add("- " + fullName + ": " + String.join(", ", columns));
                }
            }
            
            prompt.append("Database: ").append(String.join(", ", databases)).append("\n");
            prompt.append("Schema: ").append(String.join(", ", schemas)).append("\n");
            prompt.append("Tables and Columns:\n");
            for (String tableDesc : tableDescriptions) {
                prompt.append(tableDesc).append("\n");
            }
            prompt.append("\n");
        }
        
        // Natural Language Query
        prompt.append("Natural Language Query: ").append(nlQuery).append("\n\n");
        prompt.append("SQL:");
        
        return prompt.toString();
    }

    /**
     * Build Phi-4-LoRA messages format matching your production examples (UNUSED - keeping for reference)
     */
    private List<Map<String, Object>> buildPhi4LoRAMessages(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        List<Map<String, Object>> messages = new ArrayList<>();
        
        // System message - matches your production format
        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", "You are an expert Trino 477 SQL developer. Generate optimized SQL queries and provide a brief dataset summary.");
        messages.add(systemMessage);
        
        // User message with schema context and query
        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", buildUserContent(nlQuery, queryHistory, schemaContext));
        messages.add(userMessage);
        
        return messages;
    }
    
    /**
     * Build user content matching your production format structure
     */
    private String buildUserContent(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        StringBuilder content = new StringBuilder();
        
        // Previous Query section
        if (includeConversationHistory && queryHistory != null && !queryHistory.isEmpty()) {
            content.append("Previous Query: ").append(queryHistory.get(queryHistory.size() - 1)).append("\n\n");
        } else {
            content.append("Previous Query: None\n\n");
        }
        
        // Database and Schema information from FAISS
        if (includeSchemaContext && schemaContext != null && schemaContext.get("recommendations") != null) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> recommendations = (List<Map<String, Object>>) schemaContext.get("recommendations");
            
            // Extract unique databases and schemas
            Set<String> databases = new HashSet<>();
            Set<String> schemas = new HashSet<>();
            List<String> tableDescriptions = new ArrayList<>();
            
            for (Map<String, Object> rec : recommendations) {
                String fullName = (String) rec.get("full_name");
                @SuppressWarnings("unchecked")
                List<String> columns = (List<String>) rec.get("columns");
                
                if (fullName != null && columns != null) {
                    String[] parts = fullName.split("\\.");
                    if (parts.length >= 2) {
                        databases.add(parts[0]);
                        schemas.add(parts[0] + "." + parts[1]);
                    }
                    
                    // Format columns as column|type
                    tableDescriptions.add("- " + fullName + ": " + String.join(", ", columns));
                }
            }
            
            content.append("Database: ").append(String.join(", ", databases)).append("\n");
            content.append("Schema: ").append(String.join(", ", schemas)).append("\n");
            content.append("Tables and Columns:\n");
            for (String tableDesc : tableDescriptions) {
                content.append(tableDesc).append("\n");
            }
            content.append("\n");
        }
        
        // Natural Language Query
        content.append("Natural Language Query: ").append(nlQuery);
        
        return content.toString();
    }
    
    /**
     * Create error response for ML service failures
     */
    private Map<String, Object> createMLServiceErrorResponse(String errorMessage) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", errorMessage);
        response.put("service", "ml-model-service");
        response.put("model_type", modelType);
        response.put("fallback_available", true);
        return response;
    }
    
    /**
     * Create standardized workflow error response
     */
    private Map<String, Object> createWorkflowErrorResponse(String message, String errorType, long startTime) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", message);
        response.put("errorType", errorType);
        response.put("processingTime", System.currentTimeMillis() - startTime);
        return response;
    }
    
    /**
     * Execute SQL query using proper service layer
     */
    public Map<String, Object> executeTrinoSQL(String sql, Integer maxResults, Integer timeout) {
        logger.info("Delegating SQL execution to service layer: {}", sql);
        return sqlExecutionService.executeQuery(sql, maxResults, timeout);
    }
    
    /**
     * Test database connectivity via service layer
     */
    public Map<String, Object> testDatabaseConnection() {
        return sqlExecutionService.testConnection();
    }
    
    /**
     * Get database metadata via service layer
     */
    public Map<String, Object> getDatabaseMetadata(String action, String catalog, String schema) {
        return sqlExecutionService.getDatabaseMetadata(action, catalog, schema);
    }
    
    /**
     * Build user prompt for external LLM APIs (without system instruction)
     */
    private String buildUserPrompt(String nlQuery, List<String> queryHistory, Map<String, Object> schemaContext) {
        StringBuilder prompt = new StringBuilder();
        
        // Previous Query section
        if (includeConversationHistory && queryHistory != null && !queryHistory.isEmpty()) {
            prompt.append("Previous Query: ").append(queryHistory.get(queryHistory.size() - 1)).append("\n\n");
        } else {
            prompt.append("Previous Query: None\n\n");
        }
        
        // Database and Schema information from FAISS
        if (includeSchemaContext && schemaContext != null && schemaContext.get("recommendations") != null) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> recommendations = (List<Map<String, Object>>) schemaContext.get("recommendations");
            
            // Extract unique databases and schemas
            Set<String> databases = new HashSet<>();
            Set<String> schemas = new HashSet<>();
            List<String> tableDescriptions = new ArrayList<>();
            
            for (Map<String, Object> rec : recommendations) {
                String fullName = (String) rec.get("full_name");
                @SuppressWarnings("unchecked")
                List<String> columns = (List<String>) rec.get("columns");
                
                if (fullName != null && columns != null) {
                    String[] parts = fullName.split("\\.");
                    if (parts.length >= 2) {
                        databases.add(parts[0]);
                        schemas.add(parts[0] + "." + parts[1]);
                    }
                    
                    // Format columns as column|type
                    tableDescriptions.add("- " + fullName + ": " + String.join(", ", columns));
                }
            }
            
            prompt.append("Database: ").append(String.join(", ", databases)).append("\n");
            prompt.append("Schema: ").append(String.join(", ", schemas)).append("\n");
            prompt.append("Tables and Columns:\n");
            for (String tableDesc : tableDescriptions) {
                prompt.append(tableDesc).append("\n");
            }
            prompt.append("\n");
        }
        
        // Natural Language Query
        prompt.append("Natural Language Query: ").append(nlQuery).append("\n\n");
        prompt.append("Please generate a valid Trino SQL query. Return only the SQL query without any explanation or formatting.");
        
        return prompt.toString();
    }
    
    /**
     * Generic OpenAI-compatible API call
     * Supports: OpenAI, Perplexity, Groq, Together.ai, Anthropic (with OpenAI SDK), and most modern LLMs
     */
    private Map<String, Object> callOpenAICompatibleAPI(String prompt) {
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(externalLlmApiKey);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", externalLlmModel);
            requestBody.put("max_tokens", maxTokens);
            requestBody.put("temperature", temperature);
            
            // Build messages array with system and user messages (OpenAI-compatible format)
            List<Map<String, Object>> messages = new ArrayList<>();
            
            // Add system message
            Map<String, Object> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", SYSTEM_MESSAGE);
            messages.add(systemMessage);
            
            // Add user message (condensed context)
            Map<String, Object> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", prompt);
            messages.add(userMessage);
            requestBody.put("messages", messages);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                externalLlmBaseUrl + "/chat/completions",
                request,
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return parseOpenAIResponse(response.getBody());
            } else {
                throw new RuntimeException("External LLM API returned error status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            logger.error("External LLM API call failed: {}", e.getMessage(), e);
            throw e;
        }
    }
    
    /**
     * Parse OpenAI/Perplexity API response
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseOpenAIResponse(Map<String, Object> response) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices != null && !choices.isEmpty()) {
                Map<String, Object> choice = choices.get(0);
                Map<String, Object> message = (Map<String, Object>) choice.get("message");
                String content = (String) message.get("content");
                
                // Log raw LLM response
                logger.info("External LLM raw response (first 300 chars): {}", 
                    content.length() > 300 ? content.substring(0, 300) + "..." : content);
                
                // Extract SQL from content
                String sql = extractSQL(content);
                logger.info("Extracted SQL (length={}): {}", sql.length(), 
                    sql.length() > 200 ? sql.substring(0, 200) + "..." : sql);
                
                result.put("success", true);
                result.put("sql", sql);
                result.put("confidence", 0.9); // High confidence for external LLMs
                result.put("reasoning", "Generated by external LLM: " + externalLlmProvider);
                result.put("raw_response", content);
            } else {
                result.put("success", false);
                result.put("error", "No choices in API response");
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to parse API response: " + e.getMessage());
        }
        
        return result;
    }
    
    /**
     * Extract SQL from LLM response text
     */
    private String extractSQL(String text) {
        if (text == null || text.trim().isEmpty()) {
            return "";
        }
        
        // Remove markdown code blocks if present
        text = text.replaceAll("```sql\\s*", "").replaceAll("```\\s*", "");
        
        // Look for SQL keywords to extract the query
        String[] lines = text.split("\n");
        StringBuilder sql = new StringBuilder();
        boolean inSQL = false;
        
        for (String line : lines) {
            String trimmed = line.trim();
            String upperTrimmed = trimmed.toUpperCase();
            
            // Start of SQL detected
            if (upperTrimmed.startsWith("SELECT") || upperTrimmed.startsWith("WITH") || 
                upperTrimmed.startsWith("INSERT") || upperTrimmed.startsWith("UPDATE") || 
                upperTrimmed.startsWith("DELETE")) {
                inSQL = true;
            }
            
            if (inSQL) {
                // Stop if we hit explanatory text (common LLM patterns)
                if (upperTrimmed.startsWith("BUT ") || upperTrimmed.startsWith("HOWEVER") ||
                    upperTrimmed.startsWith("NOTE:") || upperTrimmed.startsWith("EXPLANATION:") ||
                    upperTrimmed.startsWith("THIS QUERY") || upperTrimmed.startsWith("THE ABOVE") ||
                    (upperTrimmed.startsWith("IF ") && sql.length() > 50)) {
                    break;
                }
                
                sql.append(line).append("\n");
                
                // Stop at semicolon or after common SQL ending clauses
                if (upperTrimmed.endsWith(";")) {
                    break;
                }
                
                // Stop after LIMIT clause if next line doesn't look like SQL continuation
                if (upperTrimmed.matches(".*LIMIT\\s+\\d+\\s*$")) {
                    // Peek at next line to see if SQL continues
                    int currentIndex = java.util.Arrays.asList(lines).indexOf(line);
                    if (currentIndex + 1 < lines.length) {
                        String nextLine = lines[currentIndex + 1].trim().toUpperCase();
                        // If next line doesn't start with SQL keywords or punctuation, stop
                        if (!nextLine.isEmpty() && 
                            !nextLine.matches("^[);,].*") &&
                            !nextLine.startsWith("UNION") && 
                            !nextLine.startsWith("INTERSECT") &&
                            !nextLine.startsWith("EXCEPT")) {
                            break;
                        }
                    }
                }
            }
        }
        
        String result = sql.toString().trim();
        
        // Remove trailing semicolon if present (Trino doesn't always need it)
        if (result.endsWith(";")) {
            result = result.substring(0, result.length() - 1).trim();
        }
        
        if (result.isEmpty()) {
            // If no SQL found, return the original text cleaned up
            result = text.trim();
        }
        
        return result;
    }
    
    // Removed unused createErrorResponse - using createWorkflowErrorResponse instead
}

package com.dashboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for communicating with LLM services (External LLM and T4 Phi)
 * Extracted from OrchestrationService for better separation of concerns
 */
@Service
public class LlmCommunicationService {
    
    private static final Logger logger = LoggerFactory.getLogger(LlmCommunicationService.class);
    
    // System message for external LLM APIs (OpenAI-compatible format)
    private static final String SYSTEM_MESSAGE = 
        "Expert Trino SQL developer. Generate optimized queries.\n\n" +
        "RULES:\n" +
        "1. Use highest confidence table (>0.8) first\n" +
        "2. Same query = same SQL structure\n" +
        "3. Prefer first table if confidence similar (<0.05 diff)\n" +
        "4. Be deterministic, avoid random variations";
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Value("${dashboard.ml.service.url:http://dashboard-ml-service:8000}")
    private String mlServiceUrl;
    
    @Value("${dashboard.ml.service.endpoint:/predict}")
    private String mlServiceEndpoint;
    
    @Value("${dashboard.ml.service.model-type:external-llm}")
    private String modelType;
    
    // External LLM Configuration
    @Value("${dashboard.external-llm.enabled:false}")
    private boolean externalLlmEnabled;
    
    @Value("${dashboard.external-llm.provider:perplexity}")
    private String externalLlmProvider;
    
    @Value("${dashboard.external-llm.api-key:}")
    private String externalLlmApiKey;
    
    @Value("${dashboard.external-llm.model:sonar-reasoning-pro}")
    private String externalLlmModel;
    
    @Value("${dashboard.external-llm.base-url:https://api.perplexity.ai}")
    private String externalLlmBaseUrl;
    
    @Value("${dashboard.external-llm.max-tokens:4096}")
    private int externalLlmMaxTokens;
    
    @Value("${dashboard.ml-service.parameters.max-length:4096}")
    private int mlServiceMaxLength;
    
    @Value("${dashboard.conversation.history-size:5}")
    private int conversationHistorySize;
    
    @Value("${dashboard.external-llm.temperature:0.1}")
    private double externalLlmTemperature;
    
    @Value("${dashboard.external-llm.timeout:30s}")
    private String externalLlmTimeout;
    
    /**
     * Generate SQL using the configured ML model (External LLM or T4 Phi)
     */
    public Map<String, Object> generateSQL(String nlQuery, List<String> userQueryHistory, 
                                          Map<String, Object> schemaRecommendations) {
        
        logger.info("Generating SQL using model type: {}", modelType);
        
        // Route to appropriate LLM service
        if (externalLlmEnabled && "external-llm".equals(modelType)) {
            logger.info("Using External LLM: {} ({})", externalLlmProvider, externalLlmModel);
            return callExternalLLM(nlQuery, userQueryHistory, schemaRecommendations);
        } else if ("t4-phi4-lora".equals(modelType)) {
            logger.info("Using T4 Phi-4 LoRA model");
            return callT4PhiService(nlQuery, userQueryHistory, schemaRecommendations);
        } else {
            logger.error("Unknown model type: {}", modelType);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Unknown model type: " + modelType);
            return errorResponse;
        }
    }
    
    /**
     * Call External LLM API (OpenAI-compatible format)
     */
    private Map<String, Object> callExternalLLM(String nlQuery, List<String> userQueryHistory, 
                                               Map<String, Object> schemaRecommendations) {
        
        // Validate API key first
        if (externalLlmApiKey == null || externalLlmApiKey.trim().isEmpty() || "test-key-placeholder".equals(externalLlmApiKey)) {
            logger.error("External LLM API key is missing or invalid. Please configure a valid API key.");
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "External LLM API key not configured. Please set EXTERNAL_LLM_API_KEY environment variable.");
            errorResponse.put("errorType", "CONFIGURATION_ERROR");
            return errorResponse;
        }
        
        try {
            String userPrompt = buildUserPrompt(nlQuery, userQueryHistory, schemaRecommendations);
            
            // Build OpenAI-compatible request
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", externalLlmModel);
            requestBody.put("max_tokens", externalLlmMaxTokens);
            requestBody.put("temperature", externalLlmTemperature);
            
            // Messages array with system and user roles
            List<Map<String, Object>> messages = new ArrayList<>();
            
            // System message
            Map<String, Object> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", SYSTEM_MESSAGE);
            messages.add(systemMessage);
            
            // User message with context
            Map<String, Object> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", userPrompt);
            messages.add(userMessage);
            
            requestBody.put("messages", messages);
            
            // Set up headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(externalLlmApiKey);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            // Make API call
            String endpoint = externalLlmBaseUrl + "/chat/completions";
            logger.debug("Calling External LLM at: {}", endpoint);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, request, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return parseExternalLLMResponse(response.getBody());
            } else {
                logger.error("External LLM API call failed with status: {}", response.getStatusCode());
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("error", "External LLM API call failed: " + response.getStatusCode());
                return errorResponse;
            }
            
        } catch (org.springframework.web.client.ResourceAccessException e) {
            logger.error("External LLM API connection timeout or network error: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "External LLM API connection failed. Please check network connectivity and API endpoint.");
            errorResponse.put("errorType", "NETWORK_ERROR");
            return errorResponse;
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            logger.error("External LLM API client error ({}): {}", e.getStatusCode(), e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "External LLM API authentication or request error: " + e.getStatusCode());
            errorResponse.put("errorType", "API_ERROR");
            return errorResponse;
        } catch (Exception e) {
            logger.error("Unexpected error calling External LLM: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Unexpected error occurred while calling External LLM: " + e.getMessage());
            errorResponse.put("errorType", "UNKNOWN_ERROR");
            return errorResponse;
        }
    }
    
    /**
     * Call T4 Phi-4 LoRA service
     */
    private Map<String, Object> callT4PhiService(String nlQuery, List<String> userQueryHistory, 
                                                Map<String, Object> schemaRecommendations) {
        try {
            Map<String, Object> requestBody = buildPhi4LoRAMessages(nlQuery, userQueryHistory, schemaRecommendations);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            String endpoint = mlServiceUrl + mlServiceEndpoint;
            logger.debug("Calling T4 Phi service at: {}", endpoint);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, request, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return parseT4PhiResponse(response.getBody());
            } else {
                logger.error("T4 Phi service call failed with status: {}", response.getStatusCode());
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("error", "T4 Phi service call failed: " + response.getStatusCode());
                return errorResponse;
            }
            
        } catch (Exception e) {
            logger.error("Error calling T4 Phi service: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "T4 Phi service error: " + e.getMessage());
            return errorResponse;
        }
    }
    
    /**
     * Build user prompt with schema context and history
     */
    private String buildUserPrompt(String nlQuery, List<String> userQueryHistory, 
                                  Map<String, Object> schemaRecommendations) {
        StringBuilder prompt = new StringBuilder();
        
        // Add Trino-specific context first
        prompt.append("TARGET DATABASE: Trino/Presto SQL Engine\n");
        addTrinoRules(prompt);
        
        // Add schema context with confidence-based prioritization
        if (schemaRecommendations != null && schemaRecommendations.get("recommendations") != null) {
            prompt.append("Schema (ordered by relevance confidence):\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> recommendations = (List<Map<String, Object>>) schemaRecommendations.get("recommendations");
            
            // Add concise confidence guidance
            double topConfidence = recommendations.isEmpty() ? 0.0 : 
                ((Number) recommendations.get(0).get("confidence")).doubleValue();
            
            String confidenceLevel = topConfidence > 0.8 ? "HIGH" : topConfidence > 0.6 ? "MED" : "LOW";
            prompt.append(String.format("Top confidence: %.3f (%s) - Use first table\n\n", topConfidence, confidenceLevel));
            
            for (int i = 0; i < recommendations.size(); i++) {
                Map<String, Object> rec = recommendations.get(i);
                double confidence = rec.get("confidence") != null ? ((Number) rec.get("confidence")).doubleValue() : 0.0;
                
                // Add concise priority indicators
                String priority = confidence > 0.8 ? " [H]" : confidence > 0.6 ? " [M]" : " [L]";
                
                prompt.append(String.format("%d. %s (%.3f)%s\n", 
                    i + 1, rec.get("full_name"), confidence, priority));
                
                if (rec.get("columns") != null) {
                    prompt.append("   Columns: ").append(rec.get("columns")).append("\n");
                }
            }
            prompt.append("\n");
        }
        
        // Add conversation history - configurable size (default: last 3 queries)
        if (userQueryHistory != null && !userQueryHistory.isEmpty()) {
            // Include last N queries based on configuration - let LLM handle relevance
            int historySize = Math.min(conversationHistorySize, userQueryHistory.size());
            int startIndex = userQueryHistory.size() - historySize;
            
            prompt.append("History: ");
            for (int i = startIndex; i < userQueryHistory.size(); i++) {
                if (i > startIndex) prompt.append(", ");
                prompt.append(userQueryHistory.get(i));
            }
            prompt.append("\n\n");
        }
        
        // Natural Language Query
        prompt.append("Query: ").append(nlQuery);
        
        return prompt.toString();
    }
    
    
    /**
     * Parse External LLM response (OpenAI format)
     */
    private Map<String, Object> parseExternalLLMResponse(Map<String, Object> apiResponse) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) apiResponse.get("choices");
            
            if (choices != null && !choices.isEmpty()) {
                Map<String, Object> firstChoice = choices.get(0);
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) firstChoice.get("message");
                
                if (message != null) {
                    String content = (String) message.get("content");
                    
                    // Extract SQL from content (assuming it's in the response)
                    String sql = extractSQLFromContent(content);
                    
                    result.put("success", true);
                    result.put("sql", sql);
                    result.put("reasoning", content);
                    result.put("confidence", 0.9); // Default confidence for external LLM
                    
                    return result;
                }
            }
            
            result.put("success", false);
            result.put("error", "Invalid response format from External LLM");
            return result;
            
        } catch (Exception e) {
            logger.error("Error parsing External LLM response: {}", e.getMessage());
            result.put("success", false);
            result.put("error", "Failed to parse External LLM response: " + e.getMessage());
            return result;
        }
    }
    
    /**
     * Parse T4 Phi service response
     */
    private Map<String, Object> parseT4PhiResponse(Map<String, Object> apiResponse) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            if (apiResponse.containsKey("sql") && apiResponse.containsKey("confidence")) {
                result.put("success", true);
                result.put("sql", apiResponse.get("sql"));
                result.put("confidence", apiResponse.get("confidence"));
                result.put("reasoning", apiResponse.get("reasoning"));
                return result;
            } else {
                result.put("success", false);
                result.put("error", "Invalid response format from T4 Phi service");
                return result;
            }
            
        } catch (Exception e) {
            logger.error("Error parsing T4 Phi response: {}", e.getMessage());
            result.put("success", false);
            result.put("error", "Failed to parse T4 Phi response: " + e.getMessage());
            return result;
        }
    }
    
    /**
     * Extract SQL from LLM content (simple extraction)
     */
    private String extractSQLFromContent(String content) {
        if (content == null) return "";
        
        // Look for SQL code blocks
        if (content.contains("```sql")) {
            int start = content.indexOf("```sql") + 6;
            int end = content.indexOf("```", start);
            if (end > start) {
                return content.substring(start, end).trim();
            }
        }
        
        // Look for SELECT statements
        if (content.toUpperCase().contains("SELECT")) {
            // Simple extraction - could be improved
            return content.trim();
        }
        
        return content.trim();
    }
    
    /**
     * Build Phi-4 LoRA request format (OpenAI-compatible role-based)
     */
    private Map<String, Object> buildPhi4LoRAMessages(String nlQuery, List<String> userQueryHistory, 
                                                     Map<String, Object> schemaRecommendations) {
        Map<String, Object> requestBody = new HashMap<>();
        
        // Build user prompt content
        String userPrompt = buildUserPrompt(nlQuery, userQueryHistory, schemaRecommendations);
        
        // Messages array with system and user roles (same as External LLM)
        List<Map<String, Object>> messages = new ArrayList<>();
        
        // System message
        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", SYSTEM_MESSAGE);
        messages.add(systemMessage);
        
        // User message with context
        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", userPrompt);
        messages.add(userMessage);
        
        requestBody.put("messages", messages);
        requestBody.put("max_length", mlServiceMaxLength);
        requestBody.put("temperature", 0.1);
        requestBody.put("do_sample", false);
        requestBody.put("num_beams", 1);
        
        return requestBody;
    }
    
    
    /**
     * Add optimized Trino rules to prompts (shared with SqlErrorAnalysisService)
     */
    private void addTrinoRules(StringBuilder prompt) {
        prompt.append("RULES: NO semicolons (;), use catalog.schema.table format, Trino/Presto syntax only\n\n");
    }
}

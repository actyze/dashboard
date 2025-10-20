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

import java.util.*;

/**
 * Service for getting schema recommendations from FAISS service
 * Extracted from OrchestrationService for better separation of concerns
 */
@Service
public class SchemaRecommendationService {
    
    private static final Logger logger = LoggerFactory.getLogger(SchemaRecommendationService.class);
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Value("${dashboard.faiss.service.url:http://dashboard-schema-service:8001}")
    private String faissServiceUrl;
    
    @Value("${dashboard.faiss.service.retries:3}")
    private int faissServiceRetries;
    
    /**
     * Get schema recommendations from FAISS service
     */
    public Map<String, Object> getSchemaRecommendations(String nlQuery, List<String> userQueryHistory) {
        logger.info("Getting schema recommendations for query: '{}'", nlQuery);
        
        for (int attempt = 1; attempt <= faissServiceRetries; attempt++) {
            try {
                Map<String, Object> requestBody = buildFaissRequest(nlQuery, userQueryHistory);
                
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
                
                String endpoint = faissServiceUrl + "/recommend";
                logger.debug("Calling FAISS service at: {} (attempt {}/{})", endpoint, attempt, faissServiceRetries);
                
                ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, request, Map.class);
                
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Map<String, Object> result = response.getBody();
                    logger.info("FAISS service returned {} recommendations", 
                        result.get("recommendations") != null ? 
                        ((List<?>) result.get("recommendations")).size() : 0);
                    return result;
                } else {
                    logger.warn("FAISS service call failed with status: {} (attempt {}/{})", 
                        response.getStatusCode(), attempt, faissServiceRetries);
                }
                
            } catch (Exception e) {
                logger.error("Error calling FAISS service (attempt {}/{}): {}", attempt, faissServiceRetries, e.getMessage());
                
                if (attempt >= faissServiceRetries) {
                    // Last attempt failed, return error
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("success", false);
                    errorResponse.put("error", "FAISS service unavailable after " + faissServiceRetries + " attempts: " + e.getMessage());
                    errorResponse.put("recommendations", new ArrayList<>());
                    return errorResponse;
                }
                
                // Wait before retry
                try {
                    Thread.sleep(1000 * attempt); // Exponential backoff
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        
        // Fallback response
        Map<String, Object> fallbackResponse = new HashMap<>();
        fallbackResponse.put("success", false);
        fallbackResponse.put("error", "FAISS service unavailable");
        fallbackResponse.put("recommendations", new ArrayList<>());
        return fallbackResponse;
    }
    
    /**
     * Build FAISS service request payload
     */
    private Map<String, Object> buildFaissRequest(String nlQuery, List<String> userQueryHistory) {
        Map<String, Object> requestBody = new HashMap<>();
        
        requestBody.put("natural_language_query", nlQuery);
        requestBody.put("conversation_history", userQueryHistory != null ? userQueryHistory : new ArrayList<>());
        requestBody.put("max_recommendations", 5);
        requestBody.put("confidence_threshold", 0.3);
        
        return requestBody;
    }
    
    /**
     * Check FAISS service health
     */
    public Map<String, Object> checkFaissServiceHealth() {
        Map<String, Object> healthResponse = new HashMap<>();
        
        try {
            String healthEndpoint = faissServiceUrl + "/health";
            logger.debug("Checking FAISS service health at: {}", healthEndpoint);
            
            ResponseEntity<Map> response = restTemplate.getForEntity(healthEndpoint, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> serviceHealth = response.getBody();
                
                healthResponse.put("healthy", true);
                healthResponse.put("service", "faiss-schema-service");
                healthResponse.put("status", serviceHealth.get("status"));
                healthResponse.put("model_loaded", serviceHealth.get("model_loaded"));
                healthResponse.put("index_size", serviceHealth.get("index_size"));
                healthResponse.put("timestamp", System.currentTimeMillis());
                
                logger.info("FAISS service health check successful");
                return healthResponse;
            } else {
                logger.warn("FAISS service health check failed with status: {}", response.getStatusCode());
                healthResponse.put("healthy", false);
                healthResponse.put("error", "Service returned non-success status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            logger.error("FAISS service health check failed: {}", e.getMessage());
            healthResponse.put("healthy", false);
            healthResponse.put("error", "Service unavailable: " + e.getMessage());
        }
        
        healthResponse.put("service", "faiss-schema-service");
        healthResponse.put("timestamp", System.currentTimeMillis());
        return healthResponse;
    }
}

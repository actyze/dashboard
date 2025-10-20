package com.dashboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Service for checking health of various services
 * Extracted from OrchestrationService for better separation of concerns
 */
@Service
public class ServiceHealthService {
    
    private static final Logger logger = LoggerFactory.getLogger(ServiceHealthService.class);
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Autowired
    private SchemaRecommendationService schemaRecommendationService;
    
    @Value("${dashboard.ml.service.url:http://dashboard-ml-service:8000}")
    private String mlServiceUrl;
    
    @Value("${dashboard.ml.service.model-type:external-llm}")
    private String modelType;
    
    /**
     * Check health of all services
     */
    public Map<String, Object> checkAllServicesHealth() {
        Map<String, Object> healthStatus = new HashMap<>();
        
        // Check FAISS Schema Service
        Map<String, Object> faissHealth = schemaRecommendationService.checkFaissServiceHealth();
        healthStatus.put("faiss_service", faissHealth);
        
        // Check T4 Phi Service (only if enabled)
        Map<String, Object> t4Health = checkT4ServiceHealth();
        healthStatus.put("t4_service", t4Health);
        
        // Overall health
        boolean allHealthy = (Boolean) faissHealth.get("healthy") && 
                           (Boolean) t4Health.get("healthy");
        
        healthStatus.put("overall_healthy", allHealthy);
        healthStatus.put("timestamp", System.currentTimeMillis());
        healthStatus.put("services_checked", Arrays.asList("faiss_service", "t4_service"));
        
        return healthStatus;
    }
    
    /**
     * Check T4 Phi-4 LoRA service health (conditional)
     */
    public Map<String, Object> checkT4ServiceHealth() {
        Map<String, Object> healthResponse = new HashMap<>();
        
        // Only check T4 service if it's actually configured as the model type
        if (!"t4-phi4-lora".equals(modelType)) {
            logger.debug("T4 service health check skipped - model type is: {}", modelType);
            healthResponse.put("healthy", false);
            healthResponse.put("service", "t4-phi4-lora");
            healthResponse.put("status", "disabled");
            healthResponse.put("error", "T4 Phi-4 LoRA service is not enabled (current model: " + modelType + ")");
            healthResponse.put("timestamp", System.currentTimeMillis());
            return healthResponse;
        }
        
        try {
            String healthEndpoint = mlServiceUrl + "/health";
            logger.debug("Checking T4 service health at: {}", healthEndpoint);
            
            ResponseEntity<Map> response = restTemplate.getForEntity(healthEndpoint, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> serviceHealth = response.getBody();
                
                healthResponse.put("healthy", true);
                healthResponse.put("service", "t4-phi4-lora");
                healthResponse.put("status", serviceHealth.get("status"));
                healthResponse.put("model_loaded", serviceHealth.get("model_loaded"));
                healthResponse.put("device", serviceHealth.get("device"));
                healthResponse.put("load_time", serviceHealth.get("load_time"));
                healthResponse.put("inference_count", serviceHealth.get("inference_count"));
                healthResponse.put("timestamp", System.currentTimeMillis());
                
                logger.info("T4 service health check successful");
                return healthResponse;
            } else {
                logger.warn("T4 service health check failed with status: {}", response.getStatusCode());
                healthResponse.put("healthy", false);
                healthResponse.put("error", "Service returned non-success status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            logger.error("T4 service health check failed: {}", e.getMessage());
            healthResponse.put("healthy", false);
            healthResponse.put("error", "Service unavailable: " + e.getMessage());
        }
        
        healthResponse.put("service", "t4-phi4-lora");
        healthResponse.put("timestamp", System.currentTimeMillis());
        return healthResponse;
    }
    
    /**
     * Check specific service health by name
     */
    public Map<String, Object> checkServiceHealth(String serviceName) {
        switch (serviceName.toLowerCase()) {
            case "faiss":
            case "schema":
                return schemaRecommendationService.checkFaissServiceHealth();
            case "t4":
            case "phi4":
            case "ml":
                return checkT4ServiceHealth();
            default:
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("healthy", false);
                errorResponse.put("error", "Unknown service: " + serviceName);
                errorResponse.put("available_services", Arrays.asList("faiss", "t4"));
                return errorResponse;
        }
    }
}

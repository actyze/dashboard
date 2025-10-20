package com.dashboard.controller;

import com.dashboard.service.OrchestrationService;
import com.dashboard.service.ServiceHealthService;
import com.dashboard.service.SqlExecutionService;
import com.dashboard.dto.ConversationRequest;
import com.dashboard.dto.SqlRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
public class DashboardController {

    @Autowired
    private OrchestrationService orchestrationService;
    
    @Autowired
    private ServiceHealthService serviceHealthService;
    
    @Autowired
    private SqlExecutionService sqlExecutionService;

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Dashboard Backend API is running");
        response.put("status", "ok");
        response.put("version", "1.0.0");
        response.put("timestamp", System.currentTimeMillis());
        
        // Add T4 service status
        Map<String, Object> services = new HashMap<>();
        services.put("trino", "connected");
        services.put("schema_service", "connected");
        services.put("t4_phi_service", checkT4ServiceStatus());
        response.put("services", services);
        
        return response;
    }
    
    /**
     * Check T4 Phi-4 service health
     */
    @GetMapping("/services/t4-phi/health")
    public Map<String, Object> getT4ServiceHealth() {
        return serviceHealthService.checkT4ServiceHealth();
    }
    
    /**
     * Helper method to check T4 service status
     */
    private String checkT4ServiceStatus() {
        try {
            Map<String, Object> healthCheck = serviceHealthService.checkT4ServiceHealth();
            Boolean isHealthy = (Boolean) healthCheck.get("healthy");
            return isHealthy != null && isHealthy ? "connected" : "disconnected";
        } catch (Exception e) {
            return "unavailable";
        }
    }

    // Removed unified /query endpoint - using specific endpoints instead

    /**
     * Natural Language endpoint with conversation history support
     */
    @PostMapping("/natural-language")
    public Map<String, Object> processNaturalLanguage(@RequestBody ConversationRequest request) {
        Logger logger = LoggerFactory.getLogger(DashboardController.class);
        try {
            String message = request.getMessage();
            List<String> conversationHistory = request.getConversationHistory();
            
            logger.info("Processing natural language request: {}", message);
            
            if (message == null || message.trim().isEmpty()) {
                return createErrorResponse("Message cannot be empty");
            }
            
            // Process natural language query with history
            logger.debug("Calling orchestrationService.processNaturalLanguageWorkflow");
            Map<String, Object> response = orchestrationService.processNaturalLanguageWorkflow(
                message,
                conversationHistory != null ? conversationHistory : new ArrayList<>(),
                false, // No chart generation in backend
                null
            );
            
            logger.info("OrchestrationService response received: success={}", response.get("success"));
            
            // Add request metadata
            response.put("requestType", "natural-language");
            response.put("messageProcessed", message);
            response.put("historySize", conversationHistory != null ? conversationHistory.size() : 0);
            
            return response;
            
        } catch (Exception e) {
            logger.error("Natural language processing failed", e);
            return createErrorResponse("Natural language processing failed: " + e.getMessage());
        }
    }

    /**
     * Direct SQL execution endpoint
     */
    @PostMapping("/sql")
    public Map<String, Object> executeSql(@RequestBody SqlRequest request) {
        try {
            String sql = request.getSql();
            
            if (sql == null || sql.trim().isEmpty()) {
                return createErrorResponse("SQL cannot be empty");
            }
            
            // Execute SQL directly via service layer
            Map<String, Object> response = sqlExecutionService.executeQuery(sql, 100, 30);
            
            // Add request metadata
            response.put("requestType", "sql");
            response.put("originalSql", sql);
            
            return response;
            
        } catch (Exception e) {
            return createErrorResponse("SQL execution failed: " + e.getMessage());
        }
    }

    // Cache Management Endpoints
    
    /**
     * Clear all query caches
     */
    @PostMapping("/cache/clear")
    public Map<String, Object> clearCache() {
        try {
            sqlExecutionService.clearAllCaches();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "All caches cleared successfully");
            response.put("timestamp", System.currentTimeMillis());
            return response;
            
        } catch (Exception e) {
            return createErrorResponse("Failed to clear cache: " + e.getMessage());
        }
    }
    
    /**
     * Get cache statistics and health
     */
    @GetMapping("/cache/stats")
    public Map<String, Object> getCacheStats() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Cache statistics endpoint - implementation depends on monitoring needs");
        response.put("cacheEnabled", true);
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }

    // Helper Methods - only essential error handling

    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", message);
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }
}

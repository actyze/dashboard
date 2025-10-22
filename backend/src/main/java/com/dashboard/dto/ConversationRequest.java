package com.dashboard.dto;

import java.util.List;

/**
 * Request DTO for conversation endpoint with simplified structure
 */
public class ConversationRequest {
    
    private String message;
    private List<String> conversationHistory;
    private QueryOptions options;
    
    public ConversationRequest() {}
    
    public ConversationRequest(String message, List<String> conversationHistory, QueryOptions options) {
        this.message = message;
        this.conversationHistory = conversationHistory;
        this.options = options;
    }
    
    // Getters and Setters
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public List<String> getConversationHistory() {
        return conversationHistory;
    }
    
    public void setConversationHistory(List<String> conversationHistory) {
        this.conversationHistory = conversationHistory;
    }
    
    public QueryOptions getOptions() {
        return options;
    }
    
    public void setOptions(QueryOptions options) {
        this.options = options;
    }
    
    /**
     * Query options for customizing the response
     */
    public static class QueryOptions {
        private Boolean includeChart = true;
        private String chartType = "auto";
        private Integer maxResults = 1000;
        private Integer timeout = 30;
        private Boolean validate = true;
        private Boolean explain = false;
        
        public QueryOptions() {}
        
        // Getters and Setters
        public Boolean getIncludeChart() {
            return includeChart;
        }
        
        public void setIncludeChart(Boolean includeChart) {
            this.includeChart = includeChart;
        }
        
        public String getChartType() {
            return chartType;
        }
        
        public void setChartType(String chartType) {
            this.chartType = chartType;
        }
        
        public Integer getMaxResults() {
            return maxResults;
        }
        
        public void setMaxResults(Integer maxResults) {
            this.maxResults = maxResults;
        }
        
        public Integer getTimeout() {
            return timeout;
        }
        
        public void setTimeout(Integer timeout) {
            this.timeout = timeout;
        }
        
        public Boolean getValidate() {
            return validate;
        }
        
        public void setValidate(Boolean validate) {
            this.validate = validate;
        }
        
        public Boolean getExplain() {
            return explain;
        }
        
        public void setExplain(Boolean explain) {
            this.explain = explain;
        }
    }
}

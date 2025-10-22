package com.dashboard.dto;

/**
 * Request DTO for direct SQL execution endpoint
 */
public class SqlRequest {
    
    private String sql;
    private String sessionId;
    private ConversationRequest.QueryOptions options;
    
    public SqlRequest() {}
    
    public SqlRequest(String sql, String sessionId, ConversationRequest.QueryOptions options) {
        this.sql = sql;
        this.sessionId = sessionId;
        this.options = options;
    }
    
    // Getters and Setters
    public String getSql() {
        return sql;
    }
    
    public void setSql(String sql) {
        this.sql = sql;
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
    
    public ConversationRequest.QueryOptions getOptions() {
        return options;
    }
    
    public void setOptions(ConversationRequest.QueryOptions options) {
        this.options = options;
    }
}

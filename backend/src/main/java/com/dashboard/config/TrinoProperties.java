package com.dashboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for Trino database connection
 */
@Component
@ConfigurationProperties(prefix = "dashboard.trino.connection")
public class TrinoProperties {
    
    private String url;
    private String user;
    private String password;
    private String catalog;
    private String schema;
    private Integer maxRows;
    private Integer queryTimeoutSeconds;
    
    // Getters and Setters
    public String getUrl() {
        return url;
    }
    
    public void setUrl(String url) {
        this.url = url;
    }
    
    public String getUser() {
        return user;
    }
    
    public void setUser(String user) {
        this.user = user;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getCatalog() {
        return catalog;
    }
    
    public void setCatalog(String catalog) {
        this.catalog = catalog;
    }
    
    public String getSchema() {
        return schema;
    }
    
    public void setSchema(String schema) {
        this.schema = schema;
    }
    
    public Integer getMaxRows() {
        return maxRows;
    }
    
    public void setMaxRows(Integer maxRows) {
        this.maxRows = maxRows;
    }
    
    public Integer getQueryTimeoutSeconds() {
        return queryTimeoutSeconds;
    }
    
    public void setQueryTimeoutSeconds(Integer queryTimeoutSeconds) {
        this.queryTimeoutSeconds = queryTimeoutSeconds;
    }
}

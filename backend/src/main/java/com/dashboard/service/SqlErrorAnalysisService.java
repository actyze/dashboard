package com.dashboard.service;

import org.springframework.stereotype.Service;
import java.util.List;

/**
 * Service for analyzing SQL errors and building enhanced error prompts
 * Extracted from OrchestrationService for better separation of concerns
 */
@Service
public class SqlErrorAnalysisService {
    
    /**
     * Analyze SQL error type to improve retry strategy
     */
    public String analyzeErrorType(String sqlError) {
        if (sqlError == null) return "UNKNOWN";
        
        String error = sqlError.toLowerCase();
        
        // Syntax errors - usually fixable with retry
        if (error.contains("syntax error") || error.contains("mismatched input") || 
            error.contains("expecting") || error.contains("line") && error.contains("column")) {
            
            // Special case: Semicolon errors are very specific and fixable
            if (error.contains("mismatched input ';'") || error.contains("semicolon")) {
                return "SEMICOLON_ERROR";
            }
            
            return "SYNTAX_ERROR";
        }
        
        // Schema/table not found - might need different schema context
        if (error.contains("schema") && error.contains("does not exist") ||
            error.contains("table") && error.contains("not found") ||
            error.contains("relation") && error.contains("does not exist")) {
            return "SCHEMA_ERROR";
        }
        
        // Column not found - might need better column mapping
        if (error.contains("column") && (error.contains("not found") || error.contains("does not exist"))) {
            return "COLUMN_ERROR";
        }
        
        // Permission/access errors - usually not fixable with retry
        if (error.contains("permission") || error.contains("access denied") || error.contains("unauthorized")) {
            return "PERMISSION_ERROR";
        }
        
        // Connection/timeout errors - might be temporary
        if (error.contains("timeout") || error.contains("connection") || error.contains("network")) {
            return "CONNECTION_ERROR";
        }
        
        return "OTHER_ERROR";
    }
    
    /**
     * Build enhanced error prompt with specific guidance based on error type
     */
    public String buildEnhancedErrorPrompt(String originalQuery, String failedSQL, 
                                         String sqlError, String errorType, 
                                         List<String> errorHistory) {
        
        StringBuilder correctionPrompt = new StringBuilder();
        
        // Add Trino context (same as initial prompt)
        correctionPrompt.append("TARGET DATABASE: Trino/Presto SQL Engine\n");
        addTrinoRules(correctionPrompt);
        
        correctionPrompt.append("FIX SQL ERROR\n");
        correctionPrompt.append("Request: ").append(originalQuery).append("\n");
        correctionPrompt.append("Failed: ").append(failedSQL).append("\n");
        correctionPrompt.append("Error: ").append(sqlError).append("\n\n");
        
        // Add specific guidance based on error type
        switch (errorType) {
            case "SYNTAX_ERROR":
                if (sqlError.contains("mismatched input ';'") || sqlError.contains("semicolon")) {
                    addSemicolonErrorGuidance(correctionPrompt);
                } else {
                    addGenericSyntaxGuidance(correctionPrompt);
                }
                break;
            case "SEMICOLON_ERROR":
                addSemicolonErrorGuidance(correctionPrompt);
                break;
            case "SCHEMA_ERROR":
                correctionPrompt.append("Schema/table not found. Use provided schemas, check catalog.schema.table format.\n\n");
                break;
            case "COLUMN_ERROR":
                correctionPrompt.append("Column not found. Check schema recommendations, use exact names (case-sensitive).\n\n");
                break;
            case "CONNECTION_ERROR":
                correctionPrompt.append("Connection issue. Simplify query, reduce complexity.\n\n");
                break;
            default:
                correctionPrompt.append("Review error message, ensure Trino compatibility.\n\n");
        }
        
        if (!errorHistory.isEmpty()) {
            correctionPrompt.append("Previous: ").append(String.join(", ", errorHistory)).append("\n");
        }
        
        correctionPrompt.append("Generate corrected SQL:");
        
        return correctionPrompt.toString();
    }
    
    /**
     * Add optimized Trino rules to prompts (used in both initial and error correction prompts)
     */
    private void addTrinoRules(StringBuilder prompt) {
        prompt.append("RULES: NO semicolons (;), use catalog.schema.table format, Trino/Presto syntax only\n\n");
    }
    
    /**
     * Add optimized guidance for semicolon errors
     */
    private void addSemicolonErrorGuidance(StringBuilder prompt) {
        prompt.append("SEMICOLON ERROR: Remove ALL semicolons (;). Trino JDBC rejects them. Example: 'SELECT * FROM table' not 'SELECT * FROM table;'\n\n");
    }
    
    /**
     * Add optimized generic syntax error guidance
     */
    private void addGenericSyntaxGuidance(StringBuilder prompt) {
        prompt.append("SYNTAX ERROR: Check commas, parentheses, keywords. Ensure Trino/Presto compatibility.\n\n");
    }
}

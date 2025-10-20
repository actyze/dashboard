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
        correctionPrompt.append("TASK: Fix the SQL query based on the error analysis\n\n");
        correctionPrompt.append("ORIGINAL REQUEST: ").append(originalQuery).append("\n\n");
        correctionPrompt.append("FAILED SQL: ").append(failedSQL).append("\n\n");
        correctionPrompt.append("ERROR TYPE: ").append(errorType).append("\n");
        correctionPrompt.append("ERROR MESSAGE: ").append(sqlError).append("\n\n");
        
        // Add specific guidance based on error type
        switch (errorType) {
            case "SYNTAX_ERROR":
                correctionPrompt.append("GUIDANCE: Focus on SQL syntax. Check for:\n");
                correctionPrompt.append("- Missing commas, parentheses, or keywords\n");
                correctionPrompt.append("- Incorrect operator usage\n");
                correctionPrompt.append("- Proper Trino/Presto syntax\n\n");
                break;
            case "SCHEMA_ERROR":
                correctionPrompt.append("GUIDANCE: The schema/table doesn't exist. Please:\n");
                correctionPrompt.append("- Use only schemas from the provided context\n");
                correctionPrompt.append("- Check catalog.schema.table format\n");
                correctionPrompt.append("- Verify table names match exactly\n\n");
                break;
            case "COLUMN_ERROR":
                correctionPrompt.append("GUIDANCE: Column not found. Please:\n");
                correctionPrompt.append("- Check column names in schema recommendations\n");
                correctionPrompt.append("- Use exact column names (case-sensitive)\n");
                correctionPrompt.append("- Consider using table aliases for clarity\n\n");
                break;
            case "CONNECTION_ERROR":
                correctionPrompt.append("GUIDANCE: Connection issue detected. Please:\n");
                correctionPrompt.append("- Simplify the query if possible\n");
                correctionPrompt.append("- Reduce complexity to minimize execution time\n\n");
                break;
            default:
                correctionPrompt.append("GUIDANCE: General error. Please:\n");
                correctionPrompt.append("- Review the error message carefully\n");
                correctionPrompt.append("- Ensure Trino/Presto compatibility\n\n");
        }
        
        if (!errorHistory.isEmpty()) {
            correctionPrompt.append("PREVIOUS ERRORS:\n");
            for (String error : errorHistory) {
                correctionPrompt.append("- ").append(error).append("\n");
            }
            correctionPrompt.append("\n");
        }
        
        correctionPrompt.append("Please generate a corrected SQL query that addresses the specific error type and follows the guidance above.");
        
        return correctionPrompt.toString();
    }
}

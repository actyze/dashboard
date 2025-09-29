package com.dashboard.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import com.dashboard.service.OrchestrationService;
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

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Dashboard Backend API is running");
        response.put("status", "ok");
        response.put("version", "1.0.0");
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }

    /**
     * GraphQL-style unified endpoint that handles:
     * - Natural language queries
     * - Direct SQL queries  
     * - Returns flexible combinations of query results and chart data
     */
    @PostMapping("/query")
    public Map<String, Object> processQuery(@RequestBody Map<String, Object> payload) {
        try {
            String input = (String) payload.get("input");
            String type = (String) payload.getOrDefault("type", "auto"); // auto, sql, natural
            Boolean includeChart = (Boolean) payload.getOrDefault("includeChart", true);
            String chartType = (String) payload.get("chartType");
            
            // Handle null/empty chartType with default
            if (chartType == null || chartType.trim().isEmpty()) {
                chartType = "auto";
            }
            
            if (input == null || input.trim().isEmpty()) {
                return createErrorResponse("Input cannot be empty");
            }
            
            // Determine input type if auto
            if ("auto".equals(type)) {
                type = detectInputType(input);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("inputType", type);
            response.put("originalInput", input);
            
            // Process based on input type
            if ("sql".equals(type)) {
                response.putAll(processSQLQuery(input, includeChart, chartType));
            } else if ("natural".equals(type)) {
                response.putAll(processNaturalLanguageQuery(input, includeChart, chartType));
            }
            
            return response;
            
        } catch (Exception e) {
            return createErrorResponse("Query processing failed: " + e.getMessage());
        }
    }

    /**
     * Metadata endpoint for database exploration
     */
    @PostMapping("/metadata")
    public Map<String, Object> getMetadata(@RequestBody Map<String, Object> payload) {
        try {
            String action = (String) payload.get("action"); // catalogs, schemas, tables, columns
            String catalog = (String) payload.get("catalog");
            String schema = (String) payload.get("schema");
            String table = (String) payload.get("table");
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("action", action);
            
            switch (action) {
                case "catalogs":
                    response.put("data", getMockCatalogs());
                    break;
                case "schemas":
                    response.put("data", getMockSchemas(catalog));
                    response.put("catalog", catalog);
                    break;
                case "tables":
                    response.put("data", getMockTables(catalog, schema));
                    response.put("catalog", catalog);
                    response.put("schema", schema);
                    break;
                case "columns":
                    response.put("data", getMockColumns(catalog, schema, table));
                    response.put("catalog", catalog);
                    response.put("schema", schema);
                    response.put("table", table);
                    break;
                default:
                    return createErrorResponse("Invalid action: " + action);
            }
            
            return response;
            
        } catch (Exception e) {
            return createErrorResponse("Metadata retrieval failed: " + e.getMessage());
        }
    }

    // Helper Methods

    private String detectInputType(String input) {
        String upperInput = input.toUpperCase().trim();
        if (upperInput.startsWith("SELECT") || upperInput.startsWith("WITH") || 
            upperInput.startsWith("SHOW") || upperInput.startsWith("DESCRIBE")) {
            return "sql";
        }
        return "natural";
    }


    private Map<String, Object> processSQLQuery(String sql, Boolean includeChart, String chartType) {
        Map<String, Object> result = new HashMap<>();
        
        // Mock SQL execution
        result.put("sql", sql);
        result.put("executionTime", 245);
        
        // Mock query results
        List<Map<String, Object>> queryData = getMockQueryResults(sql);
        result.put("queryResults", createQueryResultsResponse(queryData));
        
        // Include chart data if requested
        if (includeChart) {
            result.put("chartData", createChartResponse(queryData, chartType));
        }
        
        return result;
    }

    private Map<String, Object> processNaturalLanguageQuery(String nlQuery, Boolean includeChart, String chartType) {
        // Delegate to OrchestrationService for complete workflow management
        return orchestrationService.processNaturalLanguageWorkflow(nlQuery, includeChart, chartType);
    }

    private Map<String, Object> createQueryResultsResponse(List<Map<String, Object>> data) {
        Map<String, Object> queryResults = new HashMap<>();
        queryResults.put("data", data);
        queryResults.put("rowCount", data.size());
        queryResults.put("columns", extractColumnInfo(data));
        return queryResults;
    }

    private Map<String, Object> createChartResponse(List<Map<String, Object>> data, String chartType) {
        if ("auto".equals(chartType)) {
            chartType = recommendChartType(data);
        }
        
        Map<String, Object> chartData = new HashMap<>();
        chartData.put("type", chartType);
        chartData.put("data", data);
        chartData.put("config", createChartConfig(data, chartType));
        chartData.put("recommendations", getChartRecommendations(data));
        
        return chartData;
    }

    private List<Map<String, Object>> getMockQueryResults(String query) {
        List<Map<String, Object>> data = new ArrayList<>();
        
        // Different mock data based on query patterns
        if (query.toLowerCase().contains("sales") || query.toLowerCase().contains("revenue")) {
            // Sales data
            data.add(createRow("month", "January", "revenue", 45000, "orders", 120));
            data.add(createRow("month", "February", "revenue", 52000, "orders", 135));
            data.add(createRow("month", "March", "revenue", 48000, "orders", 128));
            data.add(createRow("month", "April", "revenue", 61000, "orders", 155));
        } else if (query.toLowerCase().contains("customer") || query.toLowerCase().contains("user")) {
            // Customer data
            data.add(createRow("region", "North", "customers", 1250, "satisfaction", 4.2));
            data.add(createRow("region", "South", "customers", 980, "satisfaction", 4.5));
            data.add(createRow("region", "East", "customers", 1100, "satisfaction", 4.1));
            data.add(createRow("region", "West", "customers", 1350, "satisfaction", 4.7));
        } else {
            // Generic data
            data.add(createRow("category", "A", "value", 100, "count", 25));
            data.add(createRow("category", "B", "value", 200, "count", 40));
            data.add(createRow("category", "C", "value", 150, "count", 30));
            data.add(createRow("category", "D", "value", 300, "count", 60));
        }
        
        return data;
    }

    private Map<String, Object> createRow(String key1, Object val1, String key2, Object val2, String key3, Object val3) {
        Map<String, Object> row = new HashMap<>();
        row.put(key1, val1);
        row.put(key2, val2);
        row.put(key3, val3);
        return row;
    }


    private String recommendChartType(List<Map<String, Object>> data) {
        if (data.isEmpty()) return "table";
        
        Map<String, Object> firstRow = data.get(0);
        int numericColumns = 0;
        int stringColumns = 0;
        
        for (Object value : firstRow.values()) {
            if (value instanceof Number) {
                numericColumns++;
            } else {
                stringColumns++;
            }
        }
        
        if (stringColumns >= 1 && numericColumns >= 1) {
            return data.size() <= 5 ? "pie" : "bar";
        } else if (numericColumns >= 2) {
            return "scatter";
        } else {
            return "line";
        }
    }

    private Map<String, Object> createChartConfig(List<Map<String, Object>> data, String chartType) {
        Map<String, Object> config = new HashMap<>();
        config.put("type", chartType);
        config.put("responsive", true);
        config.put("maintainAspectRatio", false);
        
        if (!data.isEmpty()) {
            Map<String, Object> firstRow = data.get(0);
            String[] keys = firstRow.keySet().toArray(new String[0]);
            if (keys.length >= 2) {
                config.put("xField", keys[0]);
                config.put("yField", keys[1]);
            }
        }
        
        return config;
    }

    private List<Map<String, Object>> getChartRecommendations(List<Map<String, Object>> data) {
        List<Map<String, Object>> recommendations = new ArrayList<>();
        
        recommendations.add(createRecommendation("bar", "Bar Chart", 0.9, "Great for categorical comparisons"));
        recommendations.add(createRecommendation("line", "Line Chart", 0.7, "Good for trends over time"));
        recommendations.add(createRecommendation("pie", "Pie Chart", 0.6, "Shows parts of a whole"));
        
        return recommendations;
    }

    private Map<String, Object> createRecommendation(String type, String name, double confidence, String reason) {
        Map<String, Object> rec = new HashMap<>();
        rec.put("type", type);
        rec.put("name", name);
        rec.put("confidence", confidence);
        rec.put("reason", reason);
        return rec;
    }

    private List<Map<String, Object>> extractColumnInfo(List<Map<String, Object>> data) {
        List<Map<String, Object>> columns = new ArrayList<>();
        if (!data.isEmpty()) {
            Map<String, Object> firstRow = data.get(0);
            for (Map.Entry<String, Object> entry : firstRow.entrySet()) {
                Map<String, Object> column = new HashMap<>();
                column.put("name", entry.getKey());
                column.put("type", getDataType(entry.getValue()));
                columns.add(column);
            }
        }
        return columns;
    }

    private String getDataType(Object value) {
        if (value instanceof Number) return "number";
        if (value instanceof Boolean) return "boolean";
        return "string";
    }

    private List<String> getMockCatalogs() {
        List<String> catalogs = new ArrayList<>();
        catalogs.add("hive");
        catalogs.add("iceberg");
        catalogs.add("postgresql");
        catalogs.add("mysql");
        return catalogs;
    }

    private List<String> getMockSchemas(String catalog) {
        List<String> schemas = new ArrayList<>();
        schemas.add("default");
        schemas.add("analytics");
        schemas.add("reporting");
        schemas.add("staging");
        return schemas;
    }

    private List<Map<String, Object>> getMockTables(String catalog, String schema) {
        List<Map<String, Object>> tables = new ArrayList<>();
        
        tables.add(createTable("customers", "TABLE", "Customer information"));
        tables.add(createTable("orders", "TABLE", "Order transactions"));
        tables.add(createTable("products", "TABLE", "Product catalog"));
        tables.add(createTable("sales_summary", "VIEW", "Aggregated sales data"));
        
        return tables;
    }

    private List<Map<String, Object>> getMockColumns(String catalog, String schema, String table) {
        List<Map<String, Object>> columns = new ArrayList<>();
        
        if ("customers".equals(table)) {
            columns.add(createColumn("id", "bigint", false, "Customer ID"));
            columns.add(createColumn("name", "varchar", true, "Customer name"));
            columns.add(createColumn("email", "varchar", true, "Email address"));
            columns.add(createColumn("region", "varchar", true, "Geographic region"));
        } else {
            columns.add(createColumn("id", "bigint", false, "Primary key"));
            columns.add(createColumn("name", "varchar", true, "Name field"));
            columns.add(createColumn("value", "double", true, "Numeric value"));
            columns.add(createColumn("created_at", "timestamp", true, "Creation timestamp"));
        }
        
        return columns;
    }

    private Map<String, Object> createTable(String name, String type, String description) {
        Map<String, Object> table = new HashMap<>();
        table.put("name", name);
        table.put("type", type);
        table.put("description", description);
        return table;
    }

    private Map<String, Object> createColumn(String name, String type, boolean nullable, String description) {
        Map<String, Object> column = new HashMap<>();
        column.put("name", name);
        column.put("type", type);
        column.put("nullable", nullable);
        column.put("description", description);
        return column;
    }

    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", message);
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }
}

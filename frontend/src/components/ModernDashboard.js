import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import AIQueryInput from './AIQueryInput';
import SqlQuery from './SqlQuery';
import QueryResults from './QueryResults';
import Chart from './Chart';
import ViewToggle from './ViewToggle';
import { Card, Text, Button } from './ui';

const ModernDashboard = () => {
  const { isDark } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('results'); // 'results' or 'chart'
  const [sqlQuery, setSqlQuery] = useState("SELECT customer_name, order_total, order_date\nFROM orders\nWHERE order_date >= '2024-01-01'\nORDER BY order_total DESC\nLIMIT 10;");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [chartData, setChartData] = useState(null);

  // Handle AI query submission
  const handleAIQuery = async (naturalLanguageQuery) => {
    setQueryLoading(true);
    setQueryError(null);
    
    try {
      // Simulate API call to convert natural language to SQL
      setTimeout(() => {
        const sampleSQL = `-- Generated from: "${naturalLanguageQuery}"\nSELECT \n  region,\n  SUM(sales_amount) as total_sales,\n  COUNT(*) as order_count\nFROM sales_data \nWHERE order_date >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY region\nORDER BY total_sales DESC;`;
        setSqlQuery(sampleSQL);
        setQueryLoading(false);
      }, 2000);
    } catch (error) {
      setQueryError('Failed to process natural language query');
      setQueryLoading(false);
    }
  };

  // Handle SQL query execution
  const handleExecuteQuery = async () => {
    setQueryLoading(true);
    setQueryError(null);
    
    try {
      // Simulate query execution
      setTimeout(() => {
        // Mock results with more data for testing scroll
        const regions = ['North America', 'Europe', 'Asia Pacific', 'South America', 'Middle East', 'Africa', 'Oceania'];
        const mockData = [];
        
        for (let i = 0; i < 25; i++) {
          mockData.push({
            region: regions[i % regions.length] + (i > 6 ? ` ${Math.floor(i/7) + 1}` : ''),
            total_sales: Math.floor(Math.random() * 200000) + 20000,
            order_count: Math.floor(Math.random() * 500) + 50,
            customer_id: `CUST-${String(i + 1).padStart(4, '0')}`,
            last_order_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          });
        }

        const mockResults = {
          data: mockData,
          columns: [
            { name: 'region', label: 'Region', type: 'string' },
            { name: 'total_sales', label: 'Total Sales', type: 'number' },
            { name: 'order_count', label: 'Order Count', type: 'number' },
            { name: 'customer_id', label: 'Customer ID', type: 'string' },
            { name: 'last_order_date', label: 'Last Order Date', type: 'date' }
          ],
          rowCount: mockData.length
        };

        // Mock chart data
        const mockChartData = {
          chart: {
            type: 'bar',
            config: {
              xField: 'region',
              yField: 'total_sales'
            }
          },
          data: mockResults,
          cached: false
        };
        
        setQueryResults(mockResults);
        setChartData(mockChartData);
        setQueryLoading(false);
      }, 1500);
    } catch (error) {
      setQueryError('Failed to execute query');
      setQueryLoading(false);
    }
  };


  return (
    <div className={`h-screen flex ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <Text variant="h5" className="font-semibold">
                Analytics Dashboard
              </Text>
              <Text color="secondary" className="mt-1">
                Explore your data with natural language queries
              </Text>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Main Dashboard */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* SQL Query Editor */}
              <div className="space-y-4">
                <Text variant="h6" className="font-semibold">
                  SQL Query Editor
                </Text>
                <SqlQuery 
                  sqlQuery={sqlQuery}
                  setSqlQuery={setSqlQuery}
                  onExecute={handleExecuteQuery}
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center justify-between">
                <ViewToggle 
                  activeView={activeView}
                  onViewChange={setActiveView}
                />
                
                {/* Optional: Add export or other action buttons here */}
                <div className="flex items-center space-x-2">
                  {/* Placeholder for future actions */}
                </div>
              </div>

              {/* Dynamic Content Area - Results or Chart */}
              <div className="min-h-[600px]">
                {activeView === 'results' ? (
                  <QueryResults 
                    queryData={queryResults}
                    loading={queryLoading}
                    error={queryError}
                  />
                ) : (
                  <Chart 
                    chartData={chartData}
                    loading={queryLoading}
                    error={queryError}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - AI Query Input */}
          <div className={`w-96 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-l flex flex-col`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <Text variant="h6" className="font-semibold">
                Ask Your Data
              </Text>
              <Text color="secondary" className="mt-1 text-sm">
                Use natural language to query your database
              </Text>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              <AIQueryInput 
                onSubmit={handleAIQuery}
                loading={queryLoading}
              />
              
              {/* Recent Queries */}
              <div className="mt-8">
                <Text variant="subtitle2" className="font-semibold mb-4">
                  Recent Queries
                </Text>
                <div className="space-y-3">
                  {[
                    "Show me top customers by revenue",
                    "What are the sales trends this quarter?",
                    "List products with low inventory",
                  ].map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleAIQuery(query)}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-all duration-200
                        ${isDark 
                          ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                        }
                        hover:shadow-sm
                      `}
                    >
                      <Text className="text-sm">{query}</Text>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernDashboard;
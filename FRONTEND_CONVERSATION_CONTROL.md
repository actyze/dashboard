# Frontend-Controlled Conversation History

## ✅ UPDATED: Default History Size = 5, Frontend Controls Input

### **🎯 How Frontend Controls Conversation History:**

#### **1. Frontend Decides What to Send**
```javascript
// Frontend has FULL control over conversation history
const conversationHistory = [
  "Show me all products",
  "List top customers", 
  "What are sales trends",
  "Display revenue by region",
  "Filter by last quarter"
];

// Frontend can send:
// - Empty array: [] (no history)
// - Last 2 queries: conversationHistory.slice(-2)
// - Last 5 queries: conversationHistory.slice(-5)
// - Full history: conversationHistory (all queries)
// - Filtered history: conversationHistory.filter(query => isRelevant(query))

const request = {
  message: "Now show me customer orders",
  conversationHistory: conversationHistory.slice(-3) // Frontend decides: last 3
};
```

#### **2. Backend Processes What It Receives**
```java
// Backend configuration (fallback limit)
@Value("${dashboard.conversation.history-size:5}")
private int conversationHistorySize; // Default: 5

// Backend processing
int historySize = Math.min(conversationHistorySize, userQueryHistory.size());
// Takes minimum of: (backend limit=5, frontend sent=3) = 3
```

---

## **🔄 Control Flow:**

### **Frontend → Backend → LLM**

```
Frontend Decision:
conversationHistory.slice(-3) → ["sales trends", "revenue by region", "filter by quarter"]
                    ↓
Backend Receives:
userQueryHistory = ["sales trends", "revenue by region", "filter by quarter"]
                    ↓
Backend Processing:
Math.min(5, 3) = 3 → Uses all 3 queries from frontend
                    ↓
LLM Prompt:
"History: sales trends, revenue by region, filter by quarter"
```

---

## **📊 Frontend Control Strategies:**

### **Strategy 1: Simple Recent Window**
```javascript
// Always send last N queries
const historyToSend = conversationHistory.slice(-3);
```

### **Strategy 2: Smart Filtering**
```javascript
// Frontend can implement its own filtering
const relevantHistory = conversationHistory.filter(query => {
  return query.toLowerCase().includes('customer') || 
         query.toLowerCase().includes('order') ||
         query.toLowerCase().includes('sales');
});
```

### **Strategy 3: Context-Aware**
```javascript
// Different history based on query type
const currentQuery = "Show me customer orders";
let historyToSend;

if (currentQuery.includes('customer')) {
  // Send customer-related history
  historyToSend = conversationHistory.filter(q => q.includes('customer'));
} else if (currentQuery.includes('product')) {
  // Send product-related history  
  historyToSend = conversationHistory.filter(q => q.includes('product'));
} else {
  // Default: last 3 queries
  historyToSend = conversationHistory.slice(-3);
}
```

### **Strategy 4: Performance-Based**
```javascript
// Adjust based on performance needs
const isSlowConnection = navigator.connection?.effectiveType === '2g';
const historyToSend = isSlowConnection 
  ? conversationHistory.slice(-1)  // Minimal history for slow connections
  : conversationHistory.slice(-5); // Full history for fast connections
```

---

## **🎯 Configuration Flexibility:**

### **Backend Configuration (Safety Net):**
```yaml
# application.yml - Maximum history backend will process
dashboard:
  conversation:
    history-size: 5  # Backend won't process more than 5, regardless of frontend input
```

### **Environment Override:**
```bash
# Production: Allow more history
CONVERSATION_HISTORY_SIZE=10

# Development: Limit for faster testing
CONVERSATION_HISTORY_SIZE=2
```

---

## **📝 Example Scenarios:**

### **Scenario 1: Frontend Sends 3, Backend Allows 5**
```javascript
// Frontend
conversationHistory: ["query1", "query2", "query3"]

// Backend processes all 3 (3 < 5)
// LLM gets: "History: query1, query2, query3"
```

### **Scenario 2: Frontend Sends 7, Backend Allows 5**
```javascript
// Frontend  
conversationHistory: ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]

// Backend processes last 5 (min(7, 5) = 5)
// LLM gets: "History: q3, q4, q5, q6, q7"
```

### **Scenario 3: Frontend Sends Empty, Backend Allows 5**
```javascript
// Frontend
conversationHistory: []

// Backend processes 0 (no history available)
// LLM gets: No history section
```

---

## **🚀 Benefits of This Approach:**

### **1. Frontend Flexibility**
- ✅ **Full Control**: Frontend decides what history is relevant
- ✅ **Performance Tuning**: Can reduce history for slow connections
- ✅ **Context Filtering**: Can implement domain-specific filtering
- ✅ **User Experience**: Can customize based on user preferences

### **2. Backend Safety**
- ✅ **Resource Protection**: Backend limits prevent excessive token usage
- ✅ **Configurable Limits**: Can adjust based on environment/cost
- ✅ **Graceful Handling**: Always processes what frontend sends (up to limit)

### **3. System Reliability**
- ✅ **No Breaking Changes**: Frontend can send any amount, backend handles gracefully
- ✅ **Backward Compatible**: Works with existing frontend implementations
- ✅ **Future Proof**: Easy to adjust limits as models/costs change

---

## **💡 Recommendations for Frontend:**

### **Default Strategy (Recommended):**
```javascript
// Simple and effective
const historyToSend = conversationHistory.slice(-3);
```

### **Advanced Strategy (Optional):**
```javascript
// Smart filtering based on current query
function getRelevantHistory(currentQuery, fullHistory) {
  // Implement custom logic based on your use case
  return fullHistory.slice(-5); // Or apply filtering
}
```

### **Performance Strategy:**
```javascript
// Adjust based on system performance
const maxHistory = window.performance?.memory?.usedJSHeapSize > 50000000 ? 2 : 5;
const historyToSend = conversationHistory.slice(-maxHistory);
```

The system now gives **complete control to the frontend** while providing **backend safety limits** - best of both worlds! 🎯

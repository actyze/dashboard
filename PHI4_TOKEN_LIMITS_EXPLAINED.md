# Phi-4-mini-flash Token Limits & MAX_MODEL_LEN Explained

## **📊 Token Capacity - Phi-4-mini-flash-reasoning**

### **Model's Native Context:**
- **Maximum Context Length**: **64K tokens** (65,536 tokens)
- **Sufficient for**: 99% of SQL generation tasks
- **Why 64K?**: Flash architecture optimizes for speed over ultra-long context

### **For Comparison:**
| Model | Context Length |
|-------|----------------|
| Phi-4-mini-instruct | 128K tokens |
| **Phi-4-mini-flash-reasoning** | **64K tokens** ✅ |
| GPT-4 | 128K tokens |
| Claude 3 | 200K tokens |

---

## **⚙️ MAX_MODEL_LEN Environment Variable**

### **What is MAX_MODEL_LEN?**

**Definition:** The maximum number of tokens vLLM will allocate in GPU memory for a single sequence.

```bash
MAX_MODEL_LEN=8192  # Allocate memory for 8,192 tokens max
```

### **Why Set It Lower Than Model's Max?**

**1. Memory Efficiency:**
```
Model Max: 64K tokens = ~16 GB VRAM needed
Your Setting: 8K tokens = ~4 GB VRAM needed

Savings: 12 GB VRAM freed for other operations!
```

**2. Practical Limits:**
- **SQL Queries**: Rarely exceed 1K-2K tokens
- **Schema Context**: Usually 500-2K tokens
- **Total Needed**: 2K-4K tokens typically
- **Safe Buffer**: 8K tokens = plenty of headroom

**3. Performance:**
- Lower MAX_MODEL_LEN = Faster KV cache management
- Less memory allocation = More efficient batching
- Better throughput for typical queries

---

## **🎯 Recommended MAX_MODEL_LEN Settings**

### **For SQL Generation (Your Use Case):**

```bash
# Recommended: 8192 tokens (what you have)
MAX_MODEL_LEN=8192

# Why:
# - Schema context: ~1,000 tokens
# - User query: ~100 tokens
# - Generated SQL: ~500 tokens
# - Buffer: 6,400 tokens
# ✅ Perfect for SQL generation!
```

### **Alternative Settings:**

| Use Case | MAX_MODEL_LEN | Memory | Speed |
|----------|---------------|--------|-------|
| **SQL Generation** | **8192** ✅ | 4-6 GB | Fastest |
| Complex schemas | 16384 | 8-10 GB | Fast |
| Very large schemas | 32768 | 12-14 GB | Slower |
| Full model capacity | 65536 | 16-20 GB | Slowest |

---

## **📏 Token Estimation Guide**

### **How to Estimate Tokens:**

**Rule of Thumb:** 1 token ≈ 4 characters (English)

```
Example Schema Context:
-----------------------
Table: postgres.sales.customers
Columns: customer_id|integer, name|varchar, state|varchar, email|varchar
Table: mysql.orders.orders  
Columns: order_id|integer, customer_id|integer, amount|decimal(10,2)

Characters: ~200
Tokens: ~50 tokens
```

### **Typical Token Usage:**

| Component | Tokens | Example |
|-----------|--------|---------|
| **System Prompt** | 50-100 | Trino SQL expert instructions |
| **User Query** | 10-50 | "Get customers from CA with orders > $1000" |
| **Schema Context** | 500-2000 | 5-20 tables with columns |
| **Generated SQL** | 50-500 | Simple to complex queries |
| **Total** | 610-2650 | Typical request |

**Your 8192 setting = 3-13x headroom!** ✅

---

## **🔧 GPU vs CPU Behavior**

### **With GPU (Production):**
```yaml
MAX_MODEL_LEN: 8192
GPU Memory: ~6 GB used
Speed: 0.1-0.2s per query
Flash Attention: ✅ Enabled
```

### **Without GPU (Local/Testing):**
```yaml
MAX_MODEL_LEN: 8192  # Same setting works!
CPU Memory: ~8-10 GB RAM used
Speed: 2-5s per query (10-25x slower)
Flash Attention: ❌ Not available (CPU)
```

**Note:** vLLM automatically detects GPU availability:
- **With GPU**: Uses CUDA, Flash Attention, fast
- **Without GPU**: Falls back to CPU, slower but works

---

## **📊 Memory Requirements**

### **Formula:**
```
Memory = Model Base (7.5 GB) + KV Cache (MAX_MODEL_LEN dependent)

KV Cache ≈ MAX_MODEL_LEN × batch_size × hidden_dim × layers × 2 bytes
```

### **Practical Examples:**

| MAX_MODEL_LEN | Batch=1 | Batch=4 | Batch=8 |
|---------------|---------|---------|---------|
| **8192** ✅ | ~10 GB | ~12 GB | ~16 GB |
| 16384 | ~12 GB | ~16 GB | ~24 GB |
| 32768 | ~16 GB | ~24 GB | ~40 GB |
| 65536 (max) | ~24 GB | ~40 GB | ~80 GB |

**Your Setting (8192):**
- Single query: **~10 GB** (fits A10 with 24 GB)
- 4 concurrent: **~12 GB** (good headroom)
- 8 concurrent: **~16 GB** (still works)

---

## **⚠️ When to Increase MAX_MODEL_LEN**

### **You might need higher if:**

**1. Very Large Schemas:**
```bash
# You have 50+ tables with 20+ columns each
MAX_MODEL_LEN=16384  # Increase to 16K
```

**2. Complex Documentation:**
```bash
# Including table descriptions, examples, comments
MAX_MODEL_LEN=16384  # Increase to 16K
```

**3. Multi-Step Reasoning:**
```bash
# Generating multiple queries with explanations
MAX_MODEL_LEN=16384  # Increase to 16K
```

**For SQL generation: 8192 is perfect!** ✅

---

## **🧪 How to Test Current Setting**

### **1. Check if Token Limit is Hit:**

```python
# In your logs, look for:
# "WARNING: Input truncated to 8192 tokens"
# If you see this often, increase MAX_MODEL_LEN
```

### **2. Test with Large Schema:**

```bash
# Create a test with 1000+ column schema
curl -X POST http://localhost:8000/generate-sql \
  -d '{"prompt": "test", "schema_context": "<1000 columns here>"}'

# If it works = 8192 is enough
# If truncated = increase to 16384
```

### **3. Monitor Memory Usage:**

```bash
# With GPU
nvidia-smi

# Should show:
# Memory-Usage: ~10 GB / 24 GB (good!)
# If near limit: reduce MAX_MODEL_LEN or batch size
```

---

## **🎯 Your Current Configuration**

```yaml
env:
- name: MAX_MODEL_LEN
  value: "8192"  # ✅ Optimal for SQL generation

resources:
  requests:
    memory: "8Gi"   # ✅ Enough for 8K context
    cpu: "2000m"    # ✅ CPU fallback works
  limits:
    nvidia.com/gpu: 1  # ✅ Optional - uses if available
    memory: "16Gi"      # ✅ Headroom for KV cache
```

**This is perfect for:**
- ✅ SQL generation with schema context
- ✅ Works with or without GPU
- ✅ Efficient memory usage
- ✅ Good performance

---

## **💡 Key Takeaways**

### **1. Model's Native Limit:**
- Phi-4-mini-flash: **64K tokens max**
- More than enough for SQL tasks

### **2. Your MAX_MODEL_LEN Setting:**
- **8192 tokens** = Sweet spot
- Balances memory and performance
- Handles 99% of SQL queries

### **3. GPU Optional:**
- **With GPU**: Fast (0.1-0.2s), Flash Attention enabled
- **Without GPU**: Slower (2-5s), but works fine for testing
- Same code, vLLM adapts automatically

### **4. When to Change:**
- **Keep 8192**: For normal SQL generation ✅
- **Increase to 16384**: For very large schemas (50+ tables)
- **Increase to 32768**: For documentation-heavy contexts
- **Never need 65536**: For SQL use cases

---

## **🚀 Bottom Line**

**Your current setting is optimal:**

```bash
MAX_MODEL_LEN=8192  ✅
# - Handles typical SQL schemas (5-20 tables)
# - Efficient memory usage (~10 GB)
# - Fast performance
# - Works with or without GPU
# - Perfect for dashboard use case
```

**No changes needed!** 🎉

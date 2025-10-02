# Model Caching Pattern - Smart Downloads

## 🎯 **Pattern Overview**

**Following the same pattern as Schema Service:**
- ✅ Check if model exists in cache
- ✅ Download only if not cached
- ✅ Persist cache across pod restarts
- ✅ No repeated downloads

---

## 📁 **File Structure**

```
models/phi-sql/
├── phi_server_vllm.py          # Main vLLM server
├── download_model.py           # Smart model downloader ✅ NEW
├── startup.sh                   # Startup orchestrator ✅ NEW
├── Dockerfile.vllm-simple       # Updated with caching
└── requirements_vllm.txt
```

---

## 🔄 **Startup Flow**

### **1. Container Starts:**
```bash
./startup.sh
```

### **2. Check Model Cache:**
```python
# download_model.py
if check_model_cached(model_name, cache_dir):
    logger.info("✅ Model already cached! Skipping download.")
    return True  # Fast startup (seconds)
else:
    logger.info("📥 Model not found in cache. Downloading...")
    download_model()  # Slow first time (5-10 minutes)
```

### **3. Start vLLM Server:**
```bash
python3 phi_server_vllm.py
```

---

## 📊 **Startup Times**

| Scenario | Time | Notes |
|----------|------|-------|
| **First Run** | 5-10 minutes | Downloads model (~7.5 GB) |
| **Subsequent Runs** | 30-60 seconds | Model cached, loads from disk |
| **Pod Restart** | 30-60 seconds | Cache persists, no download |

---

## 🏗️ **Docker Configuration**

### **Dockerfile (Simplified):**
```dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Install dependencies
RUN pip3 install vllm torch transformers fastapi uvicorn

# Copy application
COPY phi_server_vllm.py .
COPY download_model.py .      # ✅ Smart downloader
COPY startup.sh .              # ✅ Startup orchestrator
RUN chmod +x startup.sh

# Run with model caching
CMD ["./startup.sh"]           # ✅ Check cache first
```

### **startup.sh:**
```bash
#!/bin/bash
echo "📥 Step 1: Checking model cache..."
python3 download_model.py      # ✅ Download if needed

echo "🔥 Step 2: Starting vLLM server..."
python3 phi_server_vllm.py
```

---

## 💾 **Cache Persistence**

### **Local Testing (Docker):**
```bash
# Create persistent cache directory
MODEL_CACHE_DIR="$HOME/.cache/phi-models"
mkdir -p "$MODEL_CACHE_DIR"

# Mount as volume
docker run -d \
  -v "$MODEL_CACHE_DIR:/app/model_cache" \  # ✅ Persist cache
  -e TRANSFORMERS_CACHE="/app/model_cache" \
  -e HF_HOME="/app/model_cache" \
  phi-sql-vllm:latest
```

**Result:**
- First run: Downloads model to `$HOME/.cache/phi-models/`
- Subsequent runs: Reuses cached model
- No repeated downloads ✅

### **Kubernetes (Production):**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: phi-model-cache-pvc
spec:
  resources:
    requests:
      storage: 20Gi  # For model cache

---
containers:
- name: phi-sql
  volumeMounts:
  - name: model-cache
    mountPath: /app/model_cache  # ✅ Persistent cache
  env:
  - name: TRANSFORMERS_CACHE
    value: "/app/model_cache"
  - name: HF_HOME
    value: "/app/model_cache"

volumes:
- name: model-cache
  persistentVolumeClaim:
    claimName: phi-model-cache-pvc  # ✅ Persists across restarts
```

**Result:**
- First pod start: Downloads model to PVC
- Pod restarts: Reuses cached model from PVC
- Pod rescheduling: Cache persists on PVC
- No repeated downloads ✅

---

## 🔍 **download_model.py Logic**

### **Check Cache:**
```python
def check_model_cached(model_name: str, cache_dir: str) -> bool:
    """Check if model is already cached."""
    cache_path = Path(cache_dir)
    
    # Check HuggingFace cache structure
    hub_cache = cache_path / "hub"
    if hub_cache.exists():
        model_slug = model_name.replace("/", "--")
        cached_models = list(hub_cache.glob("models--*"))
        for cached_model in cached_models:
            if model_slug in str(cached_model):
                logger.info("✅ Model cache found!")
                return True  # ✅ Skip download
    
    return False  # ❌ Need to download
```

### **Download Only If Needed:**
```python
def download_model(model_name: str, cache_dir: str):
    """Download model if not already cached."""
    
    # Check cache first
    if check_model_cached(model_name, cache_dir):
        logger.info("✅ Model already cached! Skipping download.")
        return True  # ✅ Fast path
    
    # Download if not cached
    logger.info("📥 Downloading model (~7.5 GB)...")
    logger.info("⏳ This will take 5-10 minutes (one-time)...")
    
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        cache_dir=cache_dir,  # ✅ Save to cache
        trust_remote_code=True
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        cache_dir=cache_dir,  # ✅ Save to cache
        trust_remote_code=True
    )
    
    logger.info("✅ Download complete!")
    return True
```

---

## 📈 **Benefits**

### **1. Faster Startup After First Run:**
```
First run:         5-10 minutes (download)
Subsequent runs:   30-60 seconds (cached) ✅
Savings:           4-9 minutes per restart
```

### **2. Bandwidth Savings:**
```
Model size:        7.5 GB
Without caching:   7.5 GB × N restarts
With caching:      7.5 GB × 1 ✅
Savings:           7.5 GB × (N-1)
```

### **3. Reliability:**
```
Without caching:
- Internet required for every startup
- HuggingFace downtime = service down
- Download failures = startup failures

With caching:
- Internet only for first startup ✅
- HuggingFace downtime = no impact ✅
- Cache = reliable startup ✅
```

---

## 🎯 **Same Pattern as Schema Service**

### **Schema Service (Reference):**
```python
# models/schema-service/download_models.py
def download_models():
    # Check if cached
    if model_exists():
        return True
    
    # Download if not cached
    download_sentence_transformer()
    download_spacy_model()
```

### **Phi Service (New):**
```python
# models/phi-sql/download_model.py
def download_model():
    # Check if cached ✅ Same pattern
    if check_model_cached():
        return True
    
    # Download if not cached ✅ Same pattern
    download_phi_model()
```

**Consistency across services!** ✅

---

## 🚀 **Testing Locally**

### **First Run (Download):**
```bash
cd k8s
./test-local-no-gpu.sh

# Output:
# 📥 Model not found in cache. Downloading...
# ⏳ This will take 5-10 minutes (one-time)...
# 1/2 Downloading tokenizer... ✅
# 2/2 Downloading model weights... ✅
# ✅ Download complete!
# 🔥 Starting vLLM server...
```

### **Second Run (Cached):**
```bash
./test-local-no-gpu.sh

# Output:
# 📥 Checking model cache...
# ✅ Model already cached! Skipping download.
# 🚀 Ready to use!
# 🔥 Starting vLLM server...
# (Much faster! 30-60 seconds)
```

---

## 📊 **Cache Directory Structure**

```
$HOME/.cache/phi-models/  (or /app/model_cache in container)
├── hub/
│   └── models--microsoft--Phi-4-mini-flash-reasoning/
│       ├── blobs/
│       │   ├── model-00001-of-00002.safetensors  (~3.8 GB)
│       │   ├── model-00002-of-00002.safetensors  (~3.7 GB)
│       │   ├── tokenizer.json
│       │   └── config.json
│       └── refs/
│           └── main
└── version.txt

Total: ~7.5 GB
```

---

## ✅ **Summary**

**Smart Caching Pattern:**
1. ✅ Check if model cached
2. ✅ Download only if needed
3. ✅ Persist cache across restarts
4. ✅ No repeated downloads
5. ✅ Faster subsequent startups
6. ✅ Bandwidth savings
7. ✅ Offline reliability

**Follows same pattern as Schema Service!** 🎉

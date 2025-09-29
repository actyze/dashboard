# Model Cache Directory

This directory is used for **runtime model caching**. Models are **NOT** committed to the repository.

## 🎯 Purpose

Machine learning models are downloaded at runtime and cached here to:
- **Avoid repository bloat**: No large binary files in git
- **Optimize restarts**: Models persist across pod restarts when using persistent volumes
- **Flexibility**: Different environments can use different model versions

## 📦 Models Cached Here

When the schema service starts, the following models are automatically downloaded if not present:

### 1. **SentenceTransformer Model** (~300 MB)
- **Model**: `sentence-transformers/multi-qa-mpnet-base-dot-v1`
- **Purpose**: Query and schema embedding for semantic similarity
- **Location**: `model_cache/sentence_transformers/`
- **Dimension**: 768-dimensional embeddings

### 2. **spaCy NER Model** (~100 MB)
- **Model**: `en_core_web_md` (medium English model)
- **Purpose**: Named entity recognition (18+ entity types)
- **Location**: Installed via spaCy's download mechanism
- **Features**: PERSON, ORG, GPE, PRODUCT, MONEY, DATE, TIME, PERCENT, etc.

## 🚀 How It Works

### **Development/Local**
```bash
# Models downloaded on first run
python schema_service.py

# Subsequent runs use cached models
python schema_service.py  # Fast startup!
```

### **Docker**
```dockerfile
# Dockerfile creates cache directory
RUN mkdir -p /app/model_cache

# Container downloads models at startup
CMD ["sh", "-c", "python download_models.py && python schema_service.py"]
```

### **Kubernetes with Persistent Volume**
```yaml
# PersistentVolumeClaim for model cache
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: schema-service-model-cache
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi

# Pod mounts the volume
volumeMounts:
- name: model-cache
  mountPath: /app/model_cache
```

**Benefits:**
- ✅ Models download once per persistent volume
- ✅ Pod restarts reuse cached models (fast startup!)
- ✅ No repeated network downloads

## 📁 Directory Structure

```
model_cache/
├── .gitkeep                    # Keeps directory in git
├── README.md                   # This file
└── sentence_transformers/      # Downloaded at runtime
    └── multi-qa-mpnet-base-dot-v1/
        ├── config.json
        ├── modules.json
        ├── pytorch_model.bin   # ~87 MB
        ├── tokenizer.json
        ├── tokenizer_config.json
        └── vocab.txt
```

## 🔧 Manual Model Management

### **Clear Cache** (force re-download)
```bash
rm -rf model_cache/sentence_transformers/
python download_models.py
```

### **Pre-download Models**
```bash
python download_models.py
```

### **Check Cache Status**
```bash
du -sh model_cache/
ls -la model_cache/sentence_transformers/
```

## 🎭 Environment-Specific Behavior

### **Docker Build**
- Cache directory created but empty
- Models NOT baked into image (keeps image lean)

### **Container Startup**
- `download_models.py` checks cache
- Downloads if missing
- Skips if already cached

### **Pod with PVC**
- First pod: Downloads and caches models
- Subsequent pods: Reuses cached models
- Pod restart: Fast startup with cached models

## 💡 Best Practices

1. **Development**: Let models download automatically
2. **Production**: Use persistent volumes for model cache
3. **CI/CD**: Don't commit model files to repository
4. **Monitoring**: Check cache hit rate and download times

## 📊 Storage Requirements

| **Component** | **Size** | **Description** |
|---------------|----------|-----------------|
| SentenceTransformer | ~300 MB | MPNet embedding model |
| spaCy Model | ~100 MB | Medium English NER model |
| **Total** | **~400 MB** | Recommended: 2Gi PVC |

## 🔍 Troubleshooting

**Models not caching?**
- Check persistent volume is mounted correctly
- Verify write permissions on `/app/model_cache`
- Check disk space availability

**Slow startup?**
- First run always downloads models
- Use persistent volume to cache across restarts
- Pre-download models during image build if needed

**Download failures?**
- Check internet connectivity
- Verify Hugging Face Hub accessibility
- Check firewall/proxy settings

---

**Note**: This directory should remain empty in git. Models are downloaded at runtime for optimal repository size and deployment flexibility.

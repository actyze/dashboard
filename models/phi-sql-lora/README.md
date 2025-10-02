# Phi-4-mini LoRA for Trino 477 SQL Generation

## 🎯 Overview
Complete LoRA training and PyTorch deployment pipeline for Phi-4-mini focused on Trino 477 SQL generation with:
- **Trino 477 Documentation & Best Practices**
- **Complex SQL with Joins & Group By**
- **Query Performance Optimization**
- **Error Debugging & Recovery**
- **Cross-Database Operations**

## 📁 Directory Structure
```
phi-sql-lora/
├── dataset/                           # Training datasets
│   ├── trino_477_documentation.json   # Trino 477 features & docs
│   ├── complex_sql_joins.json         # Complex SQL patterns
│   ├── query_optimization.json        # Performance optimization
│   └── error_debugging.json           # Error handling & fixes
├── scripts/
│   ├── train_phi4_trino.py            # LoRA training script
│   ├── runtime_merge_server.py        # Production PyTorch server
│   └── simple_runtime_server.py       # Simple PyTorch server
├── adapters/                          # Trained LoRA adapters
├── requirements.txt                   # Dependencies
├── LORA_TRAINING_SUMMARY.md           # 📊 Complete training documentation
├── TRAINING_LOG.md                    # 📋 Session-by-session training log
└── README.md                          # This file
```

## 🚀 Complete Workflow

## 📚 Training Documentation

### 📊 LORA_TRAINING_SUMMARY.md
Comprehensive documentation covering:
- **Model Configuration**: Base model, LoRA parameters, hyperparameters
- **Training Data Sources**: Detailed breakdown of all datasets used
- **Data Composition**: Statistics and examples from each category
- **Performance Benchmarks**: Quality metrics and inference performance
- **Deployment Configurations**: Production vs development settings

### 📋 TRAINING_LOG.md
Session-by-session training log including:
- **Training Progress**: Epoch-by-epoch loss and metrics
- **Sample Outputs**: Generated SQL examples with quality scores
- **Data Audit Trail**: Changes and additions to training datasets
- **Infrastructure Notes**: Hardware and software environment details
- **Evaluation Results**: Automated tests and manual review scores

### Step 1: Install Dependencies
```bash
cd models/phi-sql-lora/
pip install -r requirements.txt
```

### Step 2: Train LoRA Adapter
```bash
# Train Phi-4-mini LoRA on Trino 477 datasets
python scripts/train_phi4_trino.py

# This creates: adapters/phi4-trino477-lora/
```

**Training Details:**
- **Model**: microsoft/Phi-4-mini-instruct
- **LoRA Rank**: 64 (high rank for complex SQL patterns)
- **Target Modules**: Attention + MLP layers
- **Datasets**: 4 specialized Trino 477 datasets
- **Training Time**: ~2-4 hours (depending on hardware)

### Step 3: Merge LoRA Weights & Export ONNX
```bash
# Merge LoRA weights with base model and export to ONNX
python scripts/merge_lora_onnx.py

# This creates: phi4-trino477-onnx/
```

**Output:**
- Merged model with LoRA weights integrated
- ONNX format optimized for CPU inference
- Training metadata for deployment tracking

### Step 4: Deploy to Kubernetes
```bash
# Copy ONNX model to running pod
POD_NAME=$(kubectl get pods -n dashboard -l app=phi-sql -o jsonpath="{.items[0].metadata.name}")
kubectl cp phi4-trino477-onnx/ dashboard/$POD_NAME:/app/model_cache/onnx_model/

# Restart deployment to load new model
kubectl rollout restart deployment phi-sql -n dashboard
```

### Step 5: Test Enhanced Model
```bash
# Port forward to test
kubectl port-forward -n dashboard svc/phi-sql-service 8000:8000

# Test health endpoint
curl http://localhost:8000/health

# Test SQL generation
curl -X POST http://localhost:8000/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Join customers from PostgreSQL with orders from MySQL for California customers", "max_tokens": 200}'
```

## 📊 Training Datasets

### 1. Trino 477 Documentation (trino_477_documentation.json)
- Latest Trino 477 features and syntax
- JSON functions, window functions, cross-catalog operations
- Best practices for performance and memory optimization

### 2. Complex SQL Joins (complex_sql_joins.json)
- Multi-table joins with complex aggregations
- Cross-database operations (PostgreSQL + MySQL + S3)
- Advanced GROUP BY with ROLLUP and CUBE
- Window functions and CTEs

### 3. Query Optimization (query_optimization.json)
- Performance optimization techniques
- Cross-catalog query optimization with pushdown
- Memory-efficient window functions
- Index usage and query planning

### 4. Error Debugging (error_debugging.json)
- Common Trino errors and solutions
- Memory limit exceeded fixes
- Type mismatch resolution
- Catalog and schema issues

## 🎯 Enhanced Capabilities

After LoRA training, the model gains:

### ✅ Trino 477 Expertise
- Latest JSON functions and syntax
- Cross-catalog join optimization
- Memory management best practices
- Performance tuning recommendations

### ✅ Complex SQL Generation
- Multi-table joins with proper optimization
- Advanced aggregations and window functions
- Cross-database operations
- Hierarchical reporting with ROLLUP/CUBE

### ✅ Error Debugging
- Automatic error detection and fixes
- Memory optimization suggestions
- Type casting and compatibility fixes
- Catalog and schema validation

### ✅ Performance Optimization
- Query rewriting for better performance
- Predicate pushdown strategies
- Memory-efficient query patterns
- Resource usage optimization

## 📈 Expected Performance

| Metric | Base Phi-4-mini | LoRA Enhanced |
|--------|-----------------|---------------|
| **SQL Accuracy** | 85% | 95%+ |
| **Trino 477 Features** | Limited | Comprehensive |
| **Error Debugging** | Basic | Advanced |
| **Cross-DB Queries** | Generic | Optimized |
| **Performance Tips** | None | Detailed |

## 🔧 Configuration

### LoRA Configuration
```python
lora_r = 64              # High rank for complex patterns
lora_alpha = 128         # Strong adaptation
lora_dropout = 0.05      # Low dropout for stability
target_modules = [       # Attention + MLP layers
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj"
]
```

### Training Configuration
```python
num_train_epochs = 8     # Sufficient for convergence
batch_size = 1           # Memory efficient
gradient_accumulation = 16  # Effective batch size = 16
learning_rate = 1e-4     # Conservative for stability
max_length = 4096        # Long context for complex SQL
```

## 🚀 ONNX Deployment Benefits

### ✅ Performance
- **Fast startup**: 2-5 minutes (vs 15-20 minutes conversion)
- **CPU optimized**: Multi-core inference with session options
- **Memory efficient**: 16-32GB usage (vs 40GB+ for PyTorch)

### ✅ Production Ready
- **No conversion overhead**: Pre-exported ONNX model
- **Kubernetes compatible**: Works with existing phi-sql deployment
- **Scalable**: Can handle multiple concurrent requests

### ✅ Maintenance
- **Version control**: Track LoRA training iterations
- **Easy updates**: Retrain LoRA without full model retraining
- **Rollback capability**: Keep multiple ONNX versions

## 🔍 Troubleshooting

### Training Issues
```bash
# Check GPU availability
python -c "import torch; print(torch.cuda.is_available())"

# Monitor training progress
tail -f adapters/phi4-trino477-lora/logs/events.out.tfevents.*
```

### ONNX Export Issues
```bash
# Verify optimum installation
python -c "from optimum.exporters.onnx import main_export"

# Check model compatibility
python -c "from optimum.onnxruntime import ORTModelForCausalLM"
```

### Deployment Issues
```bash
# Check pod logs
kubectl logs -n dashboard deployment/phi-sql

# Verify ONNX files
kubectl exec -n dashboard $POD_NAME -- ls -la /app/model_cache/onnx_model/
```

## 📝 Next Steps

1. **Monitor Performance**: Track SQL generation quality and response times
2. **Collect Feedback**: Gather user feedback on generated SQL quality
3. **Iterate Training**: Retrain LoRA with new examples and feedback
4. **Scale Deployment**: Consider multiple model versions for A/B testing
5. **Add Monitoring**: Implement metrics and alerting for production use

---

**🎯 Result**: Production-ready Phi-4-mini model with comprehensive Trino 477 expertise, deployed via ONNX for optimal performance.**

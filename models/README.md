# Dashboard ML Models

## Overview
This directory contains all machine learning models and related components for the dashboard application, organized by function and deployment requirements.

## Directory Structure
```
models/
├── sql-generation/           # CodeT5+ model for SQL generation
│   ├── codet5-trino/        # Model files and checkpoints
│   ├── training/            # Training scripts and data
│   └── README.md
├── chart-selection/         # Enhanced chart selector model
│   ├── models/              # Trained model files
│   ├── training_data/       # Training datasets
│   ├── enhanced_chart_selector.py
│   ├── train_chart_model.py
│   └── README.md
├── servers/                 # Model serving infrastructure
│   ├── dual_model_server.py
│   ├── local_mcp_servers.py
│   ├── requirements.txt
│   └── README.md
└── configs/                 # Configuration and registry
    └── model_registry.yaml
```

## Models Summary

### SQL Generation Model
- **Name**: CodeT5-Trino
- **Type**: Fine-tuned CodeT5+ (770MB)
- **Purpose**: Convert natural language to Trino SQL
- **Accuracy**: 95% confidence

### Chart Selection Model  
- **Name**: Enhanced Chart Selector
- **Type**: RandomForest Classifier (5MB)
- **Purpose**: Intelligent chart type recommendation
- **Accuracy**: 92% on test data

## Deployment
- **Development**: Local FastAPI server on port 8000
- **Production**: Kubernetes deployment with persistent volumes
- **Storage**: Large model files excluded from git, stored in cloud storage

## Getting Started
1. Install dependencies: `pip install -r servers/requirements.txt`
2. Start model server: `python servers/dual_model_server.py`
3. Access at `http://localhost:8000`

See individual README files for detailed usage instructions.

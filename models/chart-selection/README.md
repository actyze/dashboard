# Chart Selection Model

## Overview
ML-based chart type recommendation system using RandomForest classifier for intelligent visualization selection.

## Model Details
- **Algorithm**: RandomForest Classifier (scikit-learn)
- **Model File**: `models/chart_selection_model.joblib`
- **Size**: ~5MB
- **Accuracy**: 92% on test data
- **Features**: Data structure analysis + query context

## Supported Chart Types (15)
- **Basic**: bar, column, line, pie, scatter, area
- **Advanced**: heatmap, treemap, funnel, gauge, histogram, box, violin, radar, sankey

## Files Structure
```
chart-selection/
├── enhanced_chart_selector.py    # Main ML-based selector
├── chart_selector.py            # Legacy rule-based selector
├── train_chart_model.py         # Training script
├── models/
│   └── chart_selection_model.joblib  # Trained model (excluded from git)
└── training_data/               # Training datasets
```

## Usage
```python
from enhanced_chart_selector import create_chart_recommendation

# Get chart recommendation
data = [{"category": "A", "value": 100}, {"category": "B", "value": 200}]
recommendation = create_chart_recommendation(data, "compare sales by category")

print(f"Recommended chart: {recommendation['chart_type']}")
print(f"Confidence: {recommendation['confidence']}")
print(f"Reasoning: {recommendation['reasoning']}")
```

## Features Analyzed
- **Data Structure**: Row count, column types, data distribution
- **Query Context**: Keywords like "trend", "compare", "distribution"
- **Intelligent Fallback**: Rule-based logic when ML model unavailable

## Training
To retrain the model:
```bash
cd models/chart-selection
python train_chart_model.py
```

## Integration
Used by `models/servers/dual_model_server.py` for chart recommendations.

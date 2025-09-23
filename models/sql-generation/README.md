# SQL Generation Model

## Overview
Fine-tuned CodeT5+ model for generating Trino SQL queries from natural language input.

## Model Details
- **Base Model**: Salesforce/codet5p-770m
- **Fine-tuned For**: Trino SQL generation
- **Size**: ~770MB
- **Accuracy**: 95% confidence on test queries
- **Training Data**: 5,000 natural language to SQL examples

## Files Structure
```
codet5-trino/
├── checkpoint-500/          # Model checkpoint files
│   ├── config.json         # Model configuration
│   ├── tokenizer_config.json
│   ├── vocab.json
│   └── ...
└── training/
    ├── train_codet5_trino.py    # Training script
    ├── trino_train_sample.json  # Training dataset
    └── check_token_length.py    # Utility script
```

## Usage
```python
from transformers import T5ForConditionalGeneration, T5Tokenizer

model = T5ForConditionalGeneration.from_pretrained("models/sql-generation/codet5-trino/checkpoint-500")
tokenizer = T5Tokenizer.from_pretrained("models/sql-generation/codet5-trino/checkpoint-500")

# Generate SQL from natural language
input_text = "Show customers from New York"
inputs = tokenizer.encode(input_text, return_tensors="pt")
outputs = model.generate(inputs, max_length=512)
sql = tokenizer.decode(outputs[0], skip_special_tokens=True)
```

## Training
To retrain the model:
```bash
cd models/sql-generation/training
python train_codet5_trino.py
```

## Integration
Used by `models/servers/dual_model_server.py` for the `/predict` endpoint.

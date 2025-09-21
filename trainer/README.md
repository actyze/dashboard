# Example README for the trainer module

This module contains scripts and requirements to train a small T5 model on Trino queries.

## Setup

1. Create a virtual environment (recommended):
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Training

Prepare your Trino query data in a suitable format (see `train.py` for expected fields: `input_text`, `target_text`).

Run training:
```bash
python train.py --train_file path/to/train.json --val_file path/to/val.json --output_dir ./t5_trino_model
```

## Output

The trained model and tokenizer will be saved in the specified output directory.

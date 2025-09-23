#!/usr/bin/env python3
"""
Fine-tune CodeT5+ for Trino SQL generation using existing training data.
This script loads the trino_train_sample.json and fine-tunes CodeT5+ specifically for your Trino schemas.
"""

import json
import torch
from transformers import (
    T5ForConditionalGeneration, 
    AutoTokenizer, 
    Trainer, 
    TrainingArguments,
    DataCollatorForSeq2Seq
)
from torch.utils.data import Dataset
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrinoSQLDataset(Dataset):
    def __init__(self, data, tokenizer, max_input_length=512, max_target_length=256):
        self.data = data
        self.tokenizer = tokenizer
        self.max_input_length = max_input_length
        self.max_target_length = max_target_length
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        item = self.data[idx]
        
        # Tokenize input
        input_encoding = self.tokenizer(
            item['input_text'],
            max_length=self.max_input_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        # Tokenize target
        target_encoding = self.tokenizer(
            item['target_text'],
            max_length=self.max_target_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': input_encoding['input_ids'].flatten(),
            'attention_mask': input_encoding['attention_mask'].flatten(),
            'labels': target_encoding['input_ids'].flatten()
        }

def load_training_data(file_path):
    """Load the existing Trino training data."""
    with open(file_path, 'r') as f:
        data = json.load(f)
    logger.info(f"Loaded {len(data)} training examples")
    return data

def main():
    # Configuration
    MODEL_NAME = "Salesforce/codet5p-770m"
    OUTPUT_DIR = "./codet5_trino_model"
    TRAINING_DATA_PATH = "trino_train_sample.json"
    
    # Load model and tokenizer
    logger.info(f"Loading {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = T5ForConditionalGeneration.from_pretrained(MODEL_NAME)
    
    # Add special tokens if needed
    special_tokens = ["<NL>", "<SCHEMA>", "<SQL>"]
    tokenizer.add_tokens(special_tokens)
    model.resize_token_embeddings(len(tokenizer))
    
    # Load training data
    training_data = load_training_data(TRAINING_DATA_PATH)
    
    # Split data (80% train, 20% validation)
    split_idx = int(0.8 * len(training_data))
    train_data = training_data[:split_idx]
    val_data = training_data[split_idx:]
    
    # Create datasets
    train_dataset = TrinoSQLDataset(train_data, tokenizer)
    val_dataset = TrinoSQLDataset(val_data, tokenizer)
    
    # Data collator
    data_collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        model=model,
        padding=True
    )
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=2,
        warmup_steps=100,
        logging_steps=50,
        evaluation_strategy="steps",
        eval_steps=250,
        save_steps=500,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        learning_rate=5e-5,
        weight_decay=0.01,
        fp16=torch.cuda.is_available(),
        dataloader_pin_memory=False,
        remove_unused_columns=False,
    )
    
    # Initialize trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
    )
    
    # Train the model
    logger.info("Starting training...")
    trainer.train()
    
    # Save the final model
    logger.info(f"Saving model to {OUTPUT_DIR}")
    trainer.save_model()
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    logger.info("Training completed!")

if __name__ == "__main__":
    main()

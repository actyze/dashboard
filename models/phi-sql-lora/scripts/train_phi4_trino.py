#!/usr/bin/env python3
"""
LoRA Training for Phi-4-mini on Trino 477 SQL Generation
Focused on: Documentation, Best Practices, Complex SQL, Optimization, Debugging
Output: LoRA weights that will be merged before ONNX deployment
"""

import os
import json
import torch
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List
import transformers
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    EarlyStoppingCallback
)
from peft import (
    LoraConfig,
    get_peft_model,
    prepare_model_for_kbit_training,
    TaskType
)
from datasets import Dataset, concatenate_datasets
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ModelConfig:
    """Phi-4-mini model configuration for Trino 477 SQL"""
    model_name: str = "microsoft/Phi-4-mini-instruct"
    lora_r: int = 64  # Higher rank for complex SQL patterns
    lora_alpha: int = 128  # Strong adaptation
    lora_dropout: float = 0.05
    target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj"      # MLP
    ])

@dataclass
class DataConfig:
    """Training data configuration"""
    dataset_dir: str = "dataset"
    max_length: int = 4096
    train_split: float = 0.9
    
    # Dataset files to include (production format)
    datasets: List[str] = field(default_factory=lambda: [
        "actual_production_format.json",
        "production_format_examples.json", 
        "conversational_examples.json"
    ])

@dataclass
class TrainingConfig:
    """Training configuration"""
    output_dir: str = "adapters/phi4-trino477-lora"
    num_train_epochs: int = 8
    per_device_train_batch_size: int = 1
    gradient_accumulation_steps: int = 16
    learning_rate: float = 1e-4
    warmup_ratio: float = 0.1
    save_steps: int = 250
    eval_steps: int = 250
    logging_steps: int = 50

def load_combined_dataset(data_config: DataConfig) -> Dataset:
    """Load and combine all training datasets."""
    
    all_examples = []
    dataset_dir = Path(data_config.dataset_dir)
    
    for dataset_file in data_config.datasets:
        dataset_path = dataset_dir / dataset_file
        
        if not dataset_path.exists():
            logger.warning(f"Dataset {dataset_path} not found, skipping...")
            continue
        
        logger.info(f"Loading {dataset_file}...")
        
        with open(dataset_path, 'r') as f:
            data = json.load(f)
        
        # Add source metadata
        for example in data:
            example['source'] = dataset_file
        
        all_examples.extend(data)
        logger.info(f"  Added {len(data)} examples from {dataset_file}")
    
    # Shuffle combined dataset
    np.random.shuffle(all_examples)
    logger.info(f"Total dataset: {len(all_examples)} examples")
    
    return Dataset.from_dict({
        "messages": [ex["messages"] for ex in all_examples],
        "source": [ex["source"] for ex in all_examples]
    })

def format_chat_messages(example, tokenizer):
    """Format messages using Phi-4-mini chat template."""
    messages = example["messages"]
    
    # Apply chat template
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False
    )
    
    return {"text": text}

def setup_model_and_tokenizer(model_config: ModelConfig):
    """Setup Phi-4-mini model and tokenizer."""
    
    # Prioritize MPS (Apple Silicon GPU) over CPU
    if torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = "cuda"
    else:
        device = "cpu"
    
    logger.info(f"Using device: {device}")
    if device == "mps":
        logger.info("🚀 Apple Silicon GPU acceleration enabled!")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(
        model_config.model_name,
        trust_remote_code=True,
        padding_side="right"
    )
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    
    # Load model with appropriate settings for each device
    if device == "mps":
        # MPS works best with float32 and manual device placement
        model = AutoModelForCausalLM.from_pretrained(
            model_config.model_name,
            torch_dtype=torch.float32,  # MPS works better with float32
            device_map=None,  # Manual placement for MPS
            trust_remote_code=True,
            use_cache=False
        )
        model = model.to(device)  # Move to MPS device
    elif device == "cuda":
        model = AutoModelForCausalLM.from_pretrained(
            model_config.model_name,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
            use_cache=False
        )
    else:
        model = AutoModelForCausalLM.from_pretrained(
            model_config.model_name,
            torch_dtype=torch.float32,
            device_map=None,
            trust_remote_code=True,
            use_cache=False
        )
    
    # Enable gradient checkpointing
    model.gradient_checkpointing_enable()
    
    return model, tokenizer, device

def create_lora_config(model_config: ModelConfig) -> LoraConfig:
    """Create LoRA configuration for Phi-4-mini."""
    
    return LoraConfig(
        r=model_config.lora_r,
        lora_alpha=model_config.lora_alpha,
        target_modules=model_config.target_modules,
        lora_dropout=model_config.lora_dropout,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        inference_mode=False
    )

def prepare_datasets(data_config: DataConfig, tokenizer):
    """Prepare train and eval datasets."""
    
    # Load combined dataset
    dataset = load_combined_dataset(data_config)
    
    # Split dataset
    dataset = dataset.train_test_split(
        test_size=1-data_config.train_split,
        seed=42
    )
    
    train_dataset = dataset['train']
    eval_dataset = dataset['test']
    
    logger.info(f"Train examples: {len(train_dataset)}")
    logger.info(f"Eval examples: {len(eval_dataset)}")
    
    # Format datasets
    train_dataset = train_dataset.map(
        lambda ex: format_chat_messages(ex, tokenizer),
        remove_columns=["messages", "source"]
    )
    
    eval_dataset = eval_dataset.map(
        lambda ex: format_chat_messages(ex, tokenizer),
        remove_columns=["messages", "source"]
    )
    
    # Tokenize
    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=data_config.max_length,
            padding="max_length"
        )
    
    train_dataset = train_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"]
    )
    
    eval_dataset = eval_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"]
    )
    
    return train_dataset, eval_dataset

def main():
    """Main training function."""
    
    print("🚀 Training Phi-4-mini LoRA for Trino 477 SQL Generation")
    print("📚 Datasets: Documentation, Complex SQL, Optimization, Debugging")
    print("🎯 Output: LoRA weights for ONNX deployment")
    print("=" * 70)
    
    # Initialize configurations
    model_config = ModelConfig()
    data_config = DataConfig()
    training_config = TrainingConfig()
    
    # Setup model and tokenizer
    model, tokenizer, device = setup_model_and_tokenizer(model_config)
    
    # Create LoRA configuration
    lora_config = create_lora_config(model_config)
    
    # Prepare model for training (skip for MPS as it doesn't support kbit training)
    if device == "cuda":
        model = prepare_model_for_kbit_training(model)
    
    # Apply LoRA
    model = get_peft_model(model, lora_config)
    
    # Print trainable parameters
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    logger.info(f"Trainable parameters: {trainable_params:,} ({100 * trainable_params / total_params:.2f}%)")
    
    # Prepare datasets
    train_dataset, eval_dataset = prepare_datasets(data_config, tokenizer)
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=training_config.output_dir,
        num_train_epochs=training_config.num_train_epochs,
        per_device_train_batch_size=training_config.per_device_train_batch_size,
        per_device_eval_batch_size=training_config.per_device_train_batch_size,
        gradient_accumulation_steps=training_config.gradient_accumulation_steps,
        learning_rate=training_config.learning_rate,
        warmup_ratio=training_config.warmup_ratio,
        logging_steps=training_config.logging_steps,
        save_steps=training_config.save_steps,
        eval_steps=training_config.eval_steps,
        eval_strategy="steps",
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        fp16=device == "cuda",  # Only use fp16 for CUDA, not MPS
        optim="adamw_torch",
        weight_decay=0.01,
        max_grad_norm=1.0,
        lr_scheduler_type="cosine",
        logging_dir=f"{training_config.output_dir}/logs",
        report_to="none",
        remove_unused_columns=False
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Early stopping
    early_stopping = EarlyStoppingCallback(
        early_stopping_patience=3,
        early_stopping_threshold=0.001
    )
    
    # Initialize trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        callbacks=[early_stopping]
    )
    
    # Start training
    logger.info("Starting LoRA training...")
    trainer.train()
    
    # Save LoRA adapter
    logger.info("Saving LoRA adapter...")
    model.save_pretrained(training_config.output_dir)
    tokenizer.save_pretrained(training_config.output_dir)
    
    # Save training metadata
    training_info = {
        "model_name": model_config.model_name,
        "training_focus": [
            "Trino 477 Documentation & Features",
            "Complex SQL with Joins & Group By",
            "Query Performance Optimization", 
            "Error Debugging & Recovery"
        ],
        "lora_config": {
            "r": model_config.lora_r,
            "alpha": model_config.lora_alpha,
            "dropout": model_config.lora_dropout,
            "target_modules": model_config.target_modules
        },
        "datasets_used": data_config.datasets,
        "training_stats": {
            "train_examples": len(train_dataset),
            "eval_examples": len(eval_dataset),
            "epochs": training_config.num_train_epochs,
            "effective_batch_size": training_config.per_device_train_batch_size * training_config.gradient_accumulation_steps
        },
        "next_steps": [
            "Merge LoRA weights with base model",
            "Export merged model to ONNX",
            "Deploy to Kubernetes with ONNX runtime"
        ]
    }
    
    with open(f"{training_config.output_dir}/training_info.json", "w") as f:
        json.dump(training_info, f, indent=2)
    
    print(f"\n✅ LoRA Training Completed!")
    print(f"📁 LoRA adapter saved to: {training_config.output_dir}")
    print(f"\n🎯 Training Focus Areas:")
    for focus in training_info["training_focus"]:
        print(f"   ✓ {focus}")
    
    print(f"\n🚀 Next Steps:")
    print(f"   1. Run: python scripts/merge_lora_onnx.py")
    print(f"   2. Deploy merged ONNX model to Kubernetes")
    print(f"   3. Test Trino 477 SQL generation capabilities")

if __name__ == "__main__":
    main()

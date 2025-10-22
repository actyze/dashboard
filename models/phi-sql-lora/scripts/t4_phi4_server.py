#!/usr/bin/env python3
"""
T4 GPU Phi-4-mini LoRA Server
NVIDIA T4 GPU optimized deployment for cloud environments.
No CPU fallback - T4 GPU required.

Environment Variables:
- MODEL_NAME: Hugging Face model name (default: microsoft/Phi-4-mini-instruct)
- LORA_ADAPTER_PATH: Path to LoRA adapters (default: adapters/phi4-trino477-lora)
"""

import os
import torch
import logging
import time
from typing import Optional
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
MODEL_NAME = os.getenv("MODEL_NAME", "microsoft/Phi-4-mini-instruct")
LORA_ADAPTER_PATH = os.getenv("LORA_ADAPTER_PATH", "adapters/phi4-trino477-lora")

# Global model cache
MODEL_CACHE = {
    "model": None,
    "tokenizer": None,
    "model_loaded": False,
    "device": "cuda",
    "load_time": 0,
    "inference_count": 0
}

class SQLRequest(BaseModel):
    prompt: str
    schema_context: Optional[str] = None
    max_tokens: int = 500
    temperature: float = 0.1

class T4ModelManager:
    """T4 GPU model manager - no fallbacks"""
    
    @staticmethod
    def load_model():
        """Load model on T4 GPU - fails if CUDA unavailable"""
        logger.info("🚀 Loading Phi-4-mini LoRA on T4 GPU...")
        start_time = time.time()
        
        # Verify T4 GPU availability
        if not torch.cuda.is_available():
            raise RuntimeError("❌ CUDA not available - T4 GPU required")
        
        device = "cuda"
        
        try:
            # Load tokenizer
            logger.info("Loading tokenizer...")
            tokenizer = AutoTokenizer.from_pretrained(
                MODEL_NAME,
                trust_remote_code=True,
                padding_side="right"
            )
            
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
            
            # Load base model with T4 optimizations
            logger.info("Loading base model...")
            base_model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                torch_dtype=torch.float16,  # T4 optimized with FP16
                device_map="auto",
                trust_remote_code=True,
                use_cache=True
            )
            
            # Load and merge LoRA adapter
            logger.info("Loading and merging LoRA adapter...")
            lora_model = PeftModel.from_pretrained(base_model, LORA_ADAPTER_PATH)
            merged_model = lora_model.merge_and_unload()
            
            # Clean up intermediate models
            del base_model, lora_model
            torch.cuda.empty_cache()
            
            # Set to eval mode
            merged_model.eval()
            
            # Cache the model
            MODEL_CACHE["model"] = merged_model
            MODEL_CACHE["tokenizer"] = tokenizer
            MODEL_CACHE["model_loaded"] = True
            MODEL_CACHE["device"] = device
            MODEL_CACHE["load_time"] = time.time() - start_time
            
            logger.info(f"✅ T4 model loaded successfully in {MODEL_CACHE['load_time']:.1f}s")
            logger.info("🎯 Using FP16 precision for optimal T4 performance")
            return True
            
        except Exception as e:
            logger.error(f"❌ T4 model loading failed: {e}")
            import traceback
            traceback.print_exc()
            return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load model on startup"""
    logger.info("🚀 Starting T4 GPU Phi-4-mini LoRA Server...")
    
    # Load model on startup - fail fast if no T4
    success = T4ModelManager.load_model()
    if not success:
        logger.error("Failed to load model on T4 GPU - server will not start")
        raise RuntimeError("T4 GPU model loading failed")
    
    yield  # Server runs here
    
    # Cleanup on shutdown
    logger.info("🛑 Shutting down T4 server...")
    MODEL_CACHE.clear()

# FastAPI app with lifespan management
app = FastAPI(
    title="T4 GPU Phi-4-mini LoRA SQL Server",
    description="NVIDIA T4 GPU optimized Phi-4-mini with LoRA adapters",
    lifespan=lifespan
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": MODEL_CACHE["model_loaded"],
        "model_type": "phi-4-mini + trino-lora",
        "device": MODEL_CACHE["device"],
        "load_time": f"{MODEL_CACHE['load_time']:.1f}s",
        "inference_count": MODEL_CACHE["inference_count"]
    }

@app.post("/predict")
async def generate_sql(request: SQLRequest):
    """Generate SQL from natural language using T4 GPU"""
    
    if not MODEL_CACHE["model_loaded"]:
        raise HTTPException(status_code=503, detail="T4 model not loaded")
    
    start_time = time.time()
    
    try:
        model = MODEL_CACHE["model"]
        tokenizer = MODEL_CACHE["tokenizer"]
        device = MODEL_CACHE["device"]
        
        # Build system prompt with schema context
        system_prompt = "You are an expert Trino 477 SQL developer. Generate optimized SQL queries concisely."
        
        if request.schema_context:
            system_prompt += f"\n\nSchema Context:\n{request.schema_context}"
        
        # Format messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        # Apply chat template
        formatted_prompt = tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        
        # Tokenize and move to GPU
        inputs = tokenizer(formatted_prompt, return_tensors="pt", truncation=True, max_length=4096)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate on T4 GPU
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=request.max_tokens,
                temperature=request.temperature,
                do_sample=True if request.temperature > 0 else False,
                pad_token_id=tokenizer.eos_token_id,
                use_cache=True
            )
        
        # Synchronize GPU and decode response
        torch.cuda.synchronize()
        
        # Decode only the new tokens
        input_length = inputs['input_ids'].shape[1]
        generated_tokens = outputs[0][input_length:]
        sql_response = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
        
        # Update metrics
        MODEL_CACHE["inference_count"] += 1
        total_time = time.time() - start_time
        
        return {
            "sql": sql_response,
            "confidence": 0.95,
            "model": "phi-4-mini-trino-lora-t4",
            "device": "cuda",
            "inference_time": f"{total_time:.2f}s"
        }
        
    except Exception as e:
        logger.error(f"T4 generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"T4 generation failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

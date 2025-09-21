#!/usr/bin/env python3
"""
Dual-model FastAPI server using CodeT5+ for SQL generation and lightweight chart selector.
Replaces the single Qwen2.5-Coder model with specialized models for better performance.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import T5ForConditionalGeneration, AutoTokenizer
import torch
import json
import logging
from typing import List, Dict, Any, Optional
from enhanced_chart_selector import create_chart_recommendation
from local_mcp_servers import create_trino_client, create_chart_client, TrinoConfig
import asyncio
import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Dashboard Dual-Model API", version="2.0.0")

# Global model variables
sql_model = None
sql_tokenizer = None
trino_client = None
chart_client = None

class PredictRequest(BaseModel):
    input: str
    context: Optional[str] = ""

class PredictResponse(BaseModel):
    sql: str
    confidence: float
    reasoning: str

class QueryRequest(BaseModel):
    sql: str

class QueryResponse(BaseModel):
    data: List[Dict[str, Any]]
    row_count: int

class ChartRequest(BaseModel):
    data: List[Dict[str, Any]]
    query_context: Optional[str] = ""

class ChartResponse(BaseModel):
    chart_type: str
    confidence: float
    reasoning: str
    config: Dict[str, Any]

@app.on_event("startup")
async def load_models():
    """Load CodeT5+ model and initialize MCP clients on startup."""
    global sql_model, sql_tokenizer, trino_client, chart_client
    
    try:
        logger.info("Loading CodeT5+ model for SQL generation...")
        MODEL_PATH = "codet5_trino_model"  # Fine-tuned model path (will fallback to base model)
        
        # Try to load fine-tuned model, fallback to base model
        try:
            sql_tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            sql_model = T5ForConditionalGeneration.from_pretrained(MODEL_PATH)
            logger.info("Loaded fine-tuned CodeT5+ model")
        except:
            logger.warning("Fine-tuned model not found, loading base CodeT5+ model")
            sql_tokenizer = AutoTokenizer.from_pretrained("Salesforce/codet5p-770m")
            sql_model = T5ForConditionalGeneration.from_pretrained("Salesforce/codet5p-770m")
        
        # Set to evaluation mode
        sql_model.eval()
        
        # Move to GPU if available
        if torch.cuda.is_available():
            sql_model = sql_model.cuda()
            logger.info("Model loaded on GPU")
        else:
            logger.info("Model loaded on CPU")
        
        # Initialize MCP clients
        trino_config = TrinoConfig(
            host="localhost",
            port=8080,
            catalog="memory",
            schema="default",
            user="admin"
        )
        trino_client = create_trino_client(trino_config)
        chart_client = create_chart_client()
        
        logger.info("Models and MCP clients loaded successfully!")
        
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        raise

def generate_sql(nl_input: str, context: str = "") -> tuple[str, float, str]:
    """Generate SQL using CodeT5+ model."""
    try:
        # Prepare input with context
        if context:
            input_text = f"Context: {context}\nNL: {nl_input}\nSQL:"
        else:
            input_text = f"NL: {nl_input}\nSQL:"
        
        # Tokenize input
        inputs = sql_tokenizer(
            input_text,
            return_tensors="pt",
            max_length=512,
            truncation=True,
            padding=True
        )
        
        # Move to same device as model
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        # Generate SQL
        with torch.no_grad():
            outputs = sql_model.generate(
                **inputs,
                max_length=256,
                num_beams=4,
                temperature=0.7,
                do_sample=True,
                early_stopping=True,
                pad_token_id=sql_tokenizer.pad_token_id
            )
        
        # Decode output
        sql = sql_tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Clean up the SQL (remove input text if it appears in output)
        if "SQL:" in sql:
            sql = sql.split("SQL:")[-1].strip()
        
        # Calculate confidence based on output length and structure
        confidence = min(0.95, 0.6 + (len(sql.split()) * 0.02))
        
        reasoning = f"Generated SQL using CodeT5+ with {confidence:.2f} confidence"
        
        return sql, confidence, reasoning
        
    except Exception as e:
        logger.error(f"SQL generation failed: {e}")
        return "SELECT 1;", 0.1, f"Error in SQL generation: {str(e)}"

async def execute_trino_query(sql: str) -> List[Dict[str, Any]]:
    """Execute SQL query via Trino MCP server."""
    try:
        if trino_client is None:
            logger.warning("Trino client not initialized, using mock data")
            return [
                {"category": "A", "value": 100, "date": "2024-01-01"},
                {"category": "B", "value": 150, "date": "2024-01-02"},
                {"category": "C", "value": 80, "date": "2024-01-03"}
            ]
        
        logger.info(f"Executing SQL via Trino MCP: {sql}")
        
        async with trino_client as client:
            result = await client.execute_query(sql)
            
            if "error" in result:
                logger.error(f"Trino query failed: {result['error']}")
                # Return mock data on error
                return [
                    {"error": result["error"], "status": "failed"},
                    {"category": "Mock", "value": 0, "date": "2024-01-01"}
                ]
            
            # Convert Trino result format to list of dictionaries
            columns = result.get('columns', [])
            data_rows = result.get('data', [])
            
            formatted_data = []
            for row in data_rows:
                row_dict = {}
                for i, col_name in enumerate(columns):
                    row_dict[col_name] = row[i] if i < len(row) else None
                formatted_data.append(row_dict)
            
            logger.info(f"Query returned {len(formatted_data)} rows")
            return formatted_data
            
    except Exception as e:
        logger.error(f"Trino query execution failed: {e}")
        return [{"error": str(e), "status": "failed"}]

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "models_loaded": sql_model is not None,
        "gpu_available": torch.cuda.is_available()
    }

@app.post("/predict", response_model=PredictResponse)
async def predict_sql(request: PredictRequest):
    """Generate SQL from natural language input."""
    if sql_model is None:
        raise HTTPException(status_code=503, detail="SQL model not loaded")
    
    try:
        sql, confidence, reasoning = generate_sql(request.input, request.context)
        
        return PredictResponse(
            sql=sql,
            confidence=confidence,
            reasoning=reasoning
        )
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest):
    """Execute SQL query via Trino MCP server."""
    try:
        data = await execute_trino_query(request.sql)
        
        return QueryResponse(
            data=data,
            row_count=len(data)
        )
    except Exception as e:
        logger.error(f"Query execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chart", response_model=ChartResponse)
async def recommend_chart(request: ChartRequest):
    """Recommend optimal chart type for given data."""
    try:
        recommendation = create_chart_recommendation(
            request.data, 
            request.query_context
        )
        
        return ChartResponse(
            chart_type=recommendation['chart_type'],
            confidence=recommendation['confidence'],
            reasoning=recommendation['reasoning'],
            config=recommendation['config']
        )
    except Exception as e:
        logger.error(f"Chart recommendation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete_workflow")
async def complete_workflow(request: PredictRequest):
    """Complete workflow: NL -> SQL -> Execute -> Chart recommendation."""
    try:
        # Step 1: Generate SQL
        sql, sql_confidence, sql_reasoning = generate_sql(request.input, request.context)
        
        # Step 2: Execute SQL
        data = await execute_trino_query(sql)
        
        # Step 3: Recommend chart
        chart_rec = create_chart_recommendation(data, request.input)
        
        return {
            "sql": {
                "query": sql,
                "confidence": sql_confidence,
                "reasoning": sql_reasoning
            },
            "data": {
                "results": data,
                "row_count": len(data)
            },
            "chart": {
                "type": chart_rec['chart_type'],
                "confidence": chart_rec['confidence'],
                "reasoning": chart_rec['reasoning'],
                "config": chart_rec['config']
            }
        }
    except Exception as e:
        logger.error(f"Complete workflow failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model_info")
def model_info():
    """Get information about loaded models."""
    return {
        "sql_model": "CodeT5+ (770M parameters)",
        "chart_model": "Rule-based with ML enhancement",
        "total_memory": "~1GB",
        "gpu_enabled": torch.cuda.is_available(),
        "model_loaded": sql_model is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "dual_model_server:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=False,
        log_level="info"
    )

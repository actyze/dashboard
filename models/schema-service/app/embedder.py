"""FAISS-based schema embedder for vector search."""

import os
import time
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("embedder")


class FAISSSchemaEmbedder:
    """FAISS-based schema embedder for semantic search."""
    
    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"):
        self.model_name = model_name
        self.model = None
        self.dimension = 768
        self.index: Optional[faiss.Index] = None
        self.schema_metadata: List[Dict[str, Any]] = []
        self.raw_schema_cache: List[Dict[str, Any]] = []
        self.last_updated: Optional[datetime] = None
        
        # Load model with caching support
        try:
            cache_dir = "/app/model_cache/sentence_transformers"
            if os.path.exists(cache_dir) and os.listdir(cache_dir):
                logger.info(f"Loading embedding model from cache: {cache_dir}")
                self.model = SentenceTransformer(model_name, cache_folder=cache_dir)
            else:
                logger.info(f"Cache not found, loading from Hugging Face: {model_name}")
                self.model = SentenceTransformer(model_name, cache_folder=cache_dir)
            
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"Successfully loaded embedding model (dim={self.dimension})")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise RuntimeError(f"Could not load sentence transformer model: {e}")

    @staticmethod
    def _schema_to_text(schema: Dict[str, Any]) -> str:
        """Convert schema dict to text representation for embedding."""
        if schema["columns"] and isinstance(schema["columns"][0], str):
            column_info = [col.split('|') for col in schema["columns"] if '|' in col]
            cols = ", ".join([info[0] for info in column_info])
            types = ", ".join(sorted(set(info[1] for info in column_info if len(info) > 1)))
        else:
            cols = ", ".join([c["name"] for c in schema["columns"]])
            types = ", ".join(sorted(set(c["type"] for c in schema["columns"])))
        
        return (
            f"Database: {schema['catalog']} | "
            f"Schema: {schema['schema']} | "
            f"Type: {schema.get('type', 'TABLE')} | "
            f"Table: {schema['table']} | "
            f"Full name: {schema['full_name']} | "
            f"Columns: {cols} | "
            f"Column types: {types}"
        )

    @staticmethod
    def _build_raw_schema_cache(schemas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build structured raw schema cache from schema data."""
        raw_cache = []
        
        for schema in schemas:
            columns_detail = []
            if schema["columns"] and isinstance(schema["columns"][0], str):
                for col in schema["columns"]:
                    if '|' in col:
                        parts = col.split('|')
                        columns_detail.append({
                            "name": parts[0],
                            "type": parts[1] if len(parts) > 1 else "unknown"
                        })
            else:
                columns_detail = schema["columns"]
            
            raw_cache.append({
                "database": schema["catalog"],
                "schema": schema["schema"],
                "table": schema["table"],
                "type": schema.get("type", "TABLE"),  # Capture table type
                "full_name": schema["full_name"],
                "columns": columns_detail,
                "column_count": len(columns_detail)
            })
        
        return raw_cache

    async def build_embeddings(self, schemas: List[Dict[str, Any]]):
        """Build FAISS index from schemas."""
        logger.info(f"Building embeddings for {len(schemas)} schemas...")
        
        # Store raw schema data
        self.raw_schema_cache = self._build_raw_schema_cache(schemas)
        logger.info(f"Cached {len(self.raw_schema_cache)} raw schema entries")
        
        logger.info("Step 1: Converting schemas to text representations...")
        texts = [self._schema_to_text(s) for s in schemas]
        logger.info(f"Generated {len(texts)} text representations")
        
        if texts:
            sample_text = texts[0][:200] + "..." if len(texts[0]) > 200 else texts[0]
            logger.info(f"Sample text: {sample_text}")

        logger.info("Step 2: Encoding texts with SentenceTransformer model...")
        loop = asyncio.get_event_loop()
        
        def encode_with_progress(texts):
            batch_size = 100
            total_texts = len(texts)
            all_embeddings = []
            
            logger.info(f"Processing {total_texts} schemas in batches of {batch_size}")
            
            for i in range(0, total_texts, batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_embeddings = self.model.encode(batch_texts, show_progress_bar=False)
                all_embeddings.append(batch_embeddings)
                
                processed = min(i + batch_size, total_texts)
                progress_pct = (processed / total_texts) * 100
                logger.info(f"Progress: {processed}/{total_texts} schemas encoded ({progress_pct:.1f}%)")
            
            return np.vstack(all_embeddings)
        
        embeddings = await loop.run_in_executor(None, encode_with_progress, texts)
        logger.info(f"Generated embeddings shape: {embeddings.shape}")
        
        logger.info("Step 3: Converting to float32 for FAISS compatibility...")
        embeddings = np.asarray(embeddings, dtype=np.float32)
        logger.info(f"Converted to float32, memory usage: ~{embeddings.nbytes / 1024 / 1024:.1f} MB")
        
        logger.info("Step 4: Normalizing L2 for cosine similarity...")
        faiss.normalize_L2(embeddings)
        logger.info("L2 normalization complete")

        logger.info("Step 5: Building FAISS index...")
        emb32 = embeddings.astype(np.float32, copy=False)
        new_index = faiss.IndexFlatIP(self.dimension)
        new_index.add(emb32)
        logger.info(f"FAISS index built with {new_index.ntotal} vectors")

        # Atomic swap
        self.index = new_index
        self.schema_metadata = schemas
        self.last_updated = datetime.now()
        logger.info(f"FAISS index ready (ntotal={self.index.ntotal})")

    def search(self, query: str, prior_context: List[str] = None, top_k: int = 5, threshold: float = 0.3) -> Tuple[List[Dict[str, Any]], float, float]:
        """Search for relevant schemas using vector similarity."""
        if self.index is None:
            raise ValueError("FAISS index is not built yet.")

        enhanced_query = self._build_enhanced_query(query, prior_context or [])

        start_time = time.time()
        query_embedding = self.model.encode([enhanced_query])
        query_embedding = np.asarray(query_embedding, dtype=np.float32)
        faiss.normalize_L2(query_embedding)
        embed_time = time.time() - start_time

        start_time = time.time()
        scores, indices = self.index.search(query_embedding, top_k)
        search_time = time.time() - start_time

        results = []
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if score >= threshold:
                schema = self.schema_metadata[idx].copy()
                schema["rank"] = i + 1
                schema["confidence"] = float(score)
                schema["column_count"] = len(schema["columns"])
                results.append(schema)

        return results, embed_time, search_time

    def _build_enhanced_query(self, query: str, prior_context: List[str]) -> str:
        """Combine current query with prior context."""
        if not prior_context:
            return query
        
        context_text = " ".join(prior_context)
        enhanced_query = f"{query} {query} {context_text}"
        
        logger.info(f"Enhanced query with {len(prior_context)} context items: {enhanced_query[:100]}...")
        return enhanced_query


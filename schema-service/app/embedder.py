"""FAISS-based schema embedder for vector search."""

import os
import time
import logging
import asyncio
import httpx
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
        
        # Base schema information
        connector_type = schema.get('connector_type', 'unknown')
        text = (
            f"Connector: {connector_type} | "
            f"Database: {schema['catalog']} | "
            f"Schema: {schema['schema']} | "
            f"Type: {schema.get('type', 'TABLE')} | "
            f"Table: {schema['table']} | "
            f"Full name: {schema['full_name']}"
        )
        
        # Add user-provided table description if available (improves semantic matching)
        if schema.get('description'):
            text += f" | Description: {schema['description']}"
        
        text += f" | Columns: {cols} | Column types: {types}"
        
        # Add column descriptions if available
        if schema.get('column_descriptions'):
            col_desc_text = ", ".join([
                f"{col_name}: {desc}"
                for col_name, desc in schema['column_descriptions'].items()
            ])
            text += f" | Column details: {col_desc_text}"
        
        return text

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
        """
        Build FAISS index from schemas.
        
        Args:
            schemas: List of schema dictionaries
        """
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
        
        # Handle empty schemas case - create empty index
        if len(texts) == 0:
            logger.info("No schemas to encode - creating empty FAISS index")
            new_index = faiss.IndexFlatIP(self.dimension)
            self.index = new_index
            self.schema_metadata = schemas
            self.last_updated = datetime.now()
            logger.info("Empty FAISS index ready (ntotal=0)")
            return
        
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

    async def add_table(self, table_metadata: Dict[str, Any]) -> bool:
        """
        Add a single table to the existing FAISS index.
        
        This is much faster than full refresh as it:
        - Only encodes 1 table (~50-100ms)
        - Adds 1 vector to FAISS index
        - No Trino queries needed
        
        Args:
            table_metadata: Dict with keys: catalog, schema, table, full_name, columns, type
        
        Returns:
            bool: True if successful
        """
        if self.index is None:
            logger.error("Cannot add table: FAISS index not initialized")
            return False
        
        try:
            logger.info(f"Adding table to index: {table_metadata.get('full_name', 'unknown')}")
            
            # Convert table to text and encode
            text = self._schema_to_text(table_metadata)
            
            loop = asyncio.get_event_loop()
            embedding = await loop.run_in_executor(None, self.model.encode, [text])
            
            embedding = np.asarray(embedding, dtype=np.float32)
            faiss.normalize_L2(embedding)
            
            # Add to FAISS index
            self.index.add(embedding)
            
            # Add to metadata
            self.schema_metadata.append(table_metadata)
            
            # Add to raw cache
            raw_cache_entry = self._build_raw_schema_cache([table_metadata])
            if raw_cache_entry:
                self.raw_schema_cache.append(raw_cache_entry[0])
            
            logger.info(f"Successfully added table. Index size: {self.index.ntotal}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add table: {e}")
            return False

    async def remove_table(self, full_table_name: str) -> bool:
        """
        Remove a table from the FAISS index.
        
        Note: FAISS IndexFlatIP doesn't support efficient removal of individual vectors,
        so we need to rebuild the index. However, this is still much faster than a full
        refresh because:
        - No Trino queries
        - Only re-encodes existing in-memory metadata
        - Typically completes in 1-5 seconds
        
        Args:
            full_table_name: Full table name (catalog.schema.table)
        
        Returns:
            bool: True if table was found and removed
        """
        if self.index is None:
            logger.error("Cannot remove table: FAISS index not initialized")
            return False
        
        try:
            logger.info(f"Removing table from index: {full_table_name}")
            
            # Find and remove from metadata
            found_idx = -1
            for idx, meta in enumerate(self.schema_metadata):
                if meta.get('full_name') == full_table_name:
                    found_idx = idx
                    break
            
            if found_idx == -1:
                logger.warning(f"Table not found in index: {full_table_name}")
                return False
            
            # Remove from all caches
            self.schema_metadata.pop(found_idx)
            if found_idx < len(self.raw_schema_cache):
                self.raw_schema_cache.pop(found_idx)
            
            # Rebuild index with remaining tables (no Trino query needed)
            logger.info(f"Rebuilding index with {len(self.schema_metadata)} remaining tables")
            
            texts = [self._schema_to_text(s) for s in self.schema_metadata]
            
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(None, self.model.encode, texts)
            
            embeddings = np.asarray(embeddings, dtype=np.float32)
            faiss.normalize_L2(embeddings)
            
            # Create new index
            new_index = faiss.IndexFlatIP(self.dimension)
            new_index.add(embeddings)
            
            # Atomic swap
            self.index = new_index
            
            logger.info(f"Successfully removed table. Index size: {self.index.ntotal}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove table: {e}")
            return False

    def _build_enhanced_query(self, query: str, prior_context: List[str]) -> str:
        """
        Combine current query with recent context.
        
        Strategy:
        - Simple concatenation (no artificial weighting)
        - Only last 2 queries from history (to avoid dilution)
        - Intent detection in Nexus handles reusing vs. fresh schema search
        
        Note: We don't artificially boost current query (2x) because:
        - For follow-ups like "check for London", it would dilute previous context
        - Intent detection already determines if we need fresh schema search
        - FAISS works best with natural semantic signals, not artificial weighting
        """
        if not prior_context:
            return query  # No context, just use current query
        
        # Take only last 2 queries from history (excluding current query if it's in history)
        recent_context = []
        for ctx in reversed(prior_context):
            if ctx != query and len(recent_context) < 2:
                recent_context.insert(0, ctx)
        
        if not recent_context:
            return query  # No valid context, just use current query
        
        # Simple concatenation: current + last 2 context items
        context_text = " ".join(recent_context)
        enhanced_query = f"{query} {context_text}"
        
        logger.info(f"Enhanced query with {len(recent_context)} context items: {enhanced_query[:100]}...")
        return enhanced_query


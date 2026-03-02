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
                "column_count": len(columns_detail),
                "connector_type": schema.get("connector_type", "unknown"),  # Preserve connector type
                "is_excluded": schema.get("is_excluded", False)  # Preserve exclusion flag for admin filtering
            })
        
        return raw_cache

    async def build_embeddings(self, schemas: List[Dict[str, Any]], all_schemas: Optional[List[Dict[str, Any]]] = None):
        """
        Build FAISS index from non-excluded schemas, but cache ALL schemas (including excluded).
        
        Args:
            schemas: List of NON-EXCLUDED schema dictionaries (for FAISS index and LLM recommendations)
            all_schemas: List of ALL schema dictionaries (for explorer/admins), defaults to schemas if not provided
        """
        # If all_schemas not provided, use schemas (backward compatible)
        if all_schemas is None:
            all_schemas = schemas
        
        logger.info(f"Building embeddings for {len(schemas)} NON-EXCLUDED schemas...")
        logger.info(f"Caching {len(all_schemas)} TOTAL schemas (including excluded for admins)")
        
        # Store ALL raw schema data (including excluded for admins to see)
        self.raw_schema_cache = self._build_raw_schema_cache(all_schemas)
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

    async def batch_add_tables(self, tables: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Add multiple tables to FAISS index in a single operation (for unhide).

        Efficient strategy:
        - Encodes ALL new tables in ONE batch run_in_executor call (not N separate calls)
        - Appends all new vectors to the index in one index.add() call
        - No full rebuild needed — IndexFlatIP supports incremental additions
        - Updates already updates existing tables via update_table

        Two-cache logic:
        1. schema_metadata (FAISS): ADD new tables, delegate duplicates to update_table
        2. raw_schema_cache (UI): UPDATE is_excluded=False for each table

        Returns:
            dict with added_count, updated_count, skipped_count
        """
        if self.index is None:
            logger.error("Cannot add tables: FAISS index not initialized")
            return {"added_count": 0, "updated_count": 0, "skipped_count": 0}

        if not tables:
            return {"added_count": 0, "updated_count": 0, "skipped_count": 0}

        try:
            existing_full_names = {m.get('full_name') for m in self.schema_metadata}

            new_tables = []       # tables not yet in FAISS
            update_tables = []    # tables already in FAISS (need update_table)

            for t in tables:
                fn = t.get('full_name', 'unknown')
                if fn in existing_full_names:
                    update_tables.append(t)
                else:
                    new_tables.append(t)

            # Handle updates (each needs one encode but those are already in-index)
            updated_count = 0
            for t in update_tables:
                if await self.update_table(t):
                    updated_count += 1

            if not new_tables:
                logger.info(f"batch_add_tables: 0 new, {updated_count} updated")
                return {"added_count": 0, "updated_count": updated_count, "skipped_count": 0}

            logger.info(f"batch_add_tables: encoding {len(new_tables)} new tables in one batch")

            # Batch encode all new tables in ONE executor call
            texts = [self._schema_to_text(t) for t in new_tables]
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(None, self.model.encode, texts)
            embeddings = np.asarray(embeddings, dtype=np.float32)
            faiss.normalize_L2(embeddings)

            # Add all new vectors in one call (IndexFlatIP supports incremental add)
            self.index.add(embeddings)
            self.schema_metadata.extend(new_tables)

            # Update raw_schema_cache for all tables (new + updated)
            raw_full_name_map = {e.get('full_name'): i for i, e in enumerate(self.raw_schema_cache)}

            for t in new_tables:
                fn = t.get('full_name', 'unknown')
                if fn in raw_full_name_map:
                    self.raw_schema_cache[raw_full_name_map[fn]]['is_excluded'] = False
                    logger.info(f"Updated is_excluded=False in raw_schema_cache: {fn}")
                else:
                    logger.warning(f"Table {fn} not found in raw_schema_cache — adding new entry")
                    raw_entry = self._build_raw_schema_cache([t])
                    if raw_entry:
                        self.raw_schema_cache.append(raw_entry[0])

            self.last_updated = datetime.now()
            logger.info(f"batch_add_tables complete: {len(new_tables)} added, {updated_count} updated. Index size: {self.index.ntotal}")
            return {"added_count": len(new_tables), "updated_count": updated_count, "skipped_count": 0}

        except Exception as e:
            logger.error(f"Failed to batch add tables: {e}")
            return {"added_count": 0, "updated_count": 0, "skipped_count": 0}

    async def update_table(self, table_metadata: Dict[str, Any]) -> bool:
        """
        Update a table's embedding in FAISS index (for metadata description changes).
        
        Two-cache logic:
        1. schema_metadata (FAISS): UPDATE the table's embedding
        2. raw_schema_cache (UI): UPDATE the table's metadata (including descriptions)
        
        Note: If table not found in FAISS, this means it's excluded/hidden.
        Don't automatically add it - that would unhide it unexpectedly.
        
        Args:
            table_metadata: Updated table metadata with new descriptions
        
        Returns:
            bool: True if successful
        """
        if self.index is None:
            logger.error("Cannot update table: FAISS index not initialized")
            return False
        
        try:
            full_name = table_metadata.get('full_name')
            logger.info(f"Updating table in FAISS index: {full_name}")
            
            # Find the table's position in schema_metadata (FAISS)
            found_idx = -1
            for idx, meta in enumerate(self.schema_metadata):
                if meta.get('full_name') == full_name:
                    found_idx = idx
                    break
            
            if found_idx == -1:
                logger.warning(f"Table not found in FAISS index: {full_name}. Table may be hidden/excluded. Updating raw_schema_cache only.")
                # Update raw_schema_cache but don't add to FAISS (table is hidden)
                raw_cache_idx = -1
                for idx, cache_entry in enumerate(self.raw_schema_cache):
                    if cache_entry.get('full_name') == full_name:
                        raw_cache_idx = idx
                        break
                
                if raw_cache_idx != -1:
                    raw_cache_entry = self._build_raw_schema_cache([table_metadata])
                    if raw_cache_entry:
                        # Preserve is_excluded flag when updating
                        old_is_excluded = self.raw_schema_cache[raw_cache_idx].get('is_excluded', False)
                        self.raw_schema_cache[raw_cache_idx] = raw_cache_entry[0]
                        self.raw_schema_cache[raw_cache_idx]['is_excluded'] = old_is_excluded
                        logger.info(f"Updated raw_schema_cache only (table is hidden)")
                        return True
                
                logger.error(f"Table {full_name} not found in either cache")
                return False
            
            # Update metadata in-place
            self.schema_metadata[found_idx] = table_metadata

            # Update raw cache (find the correct index independently)
            raw_cache_idx = -1
            for idx, cache_entry in enumerate(self.raw_schema_cache):
                if cache_entry.get('full_name') == full_name:
                    raw_cache_idx = idx
                    break

            if raw_cache_idx != -1:
                raw_cache_entry = self._build_raw_schema_cache([table_metadata])
                if raw_cache_entry:
                    self.raw_schema_cache[raw_cache_idx] = raw_cache_entry[0]
                    logger.info(f"Updated raw_schema_cache at index {raw_cache_idx}")
            else:
                logger.warning(f"Table {full_name} not found in raw_schema_cache")

            # Re-encode ONLY the changed table (not all N tables).
            # Retrieve the N existing vectors directly from FAISS (no model.encode),
            # replace the slot at found_idx, rebuild in one shot.
            text = self._schema_to_text(table_metadata)
            loop = asyncio.get_event_loop()
            new_embedding = await loop.run_in_executor(None, self.model.encode, [text])
            new_embedding = np.asarray(new_embedding, dtype=np.float32)
            faiss.normalize_L2(new_embedding)

            # Extract all current vectors from FAISS without re-encoding
            all_vectors = self.index.reconstruct_n(0, self.index.ntotal)  # shape (N, dim)
            all_vectors[found_idx] = new_embedding[0]

            new_index = faiss.IndexFlatIP(self.dimension)
            new_index.add(all_vectors)
            self.index = new_index
            self.last_updated = datetime.now()

            logger.info(f"Successfully updated table (1 encode, no full re-encode). Index size: {self.index.ntotal}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update table: {e}")
            return False

    async def batch_remove_tables(self, full_table_names: List[str]) -> Dict[str, Any]:
        """
        Remove multiple tables from the FAISS index in a single operation.
        
        This is MUCH more efficient than N individual calls:
        - Removes all tables from metadata at once
        - Rebuilds FAISS index ONCE (not N times)
        - 10-100x faster for large batches
        
        Args:
            full_table_names: List of full table names (catalog.schema.table)
        
        Returns:
            dict: {'removed_count': int, 'not_found': List[str], 'index_size': int}
        """
        if self.index is None:
            logger.error("Cannot remove tables: FAISS index not initialized")
            return {'removed_count': 0, 'not_found': full_table_names, 'index_size': 0}
        
        try:
            logger.info(f"Batch removing {len(full_table_names)} tables from FAISS index (hide)")
            
            # Convert to set for fast lookup
            tables_to_remove = set(full_table_names)
            not_found = []
            removed_count = 0
            
            # Step 1: Remove from schema_metadata (FAISS)
            new_schema_metadata = []
            for meta in self.schema_metadata:
                full_name = meta.get('full_name')
                if full_name in tables_to_remove:
                    removed_count += 1
                else:
                    new_schema_metadata.append(meta)
            
            # Step 2: Update is_excluded=True in raw_schema_cache (don't remove entries)
            for cache_entry in self.raw_schema_cache:
                full_name = cache_entry.get('full_name')
                if full_name in tables_to_remove:
                    cache_entry['is_excluded'] = True
            
            # Check for tables not found
            for table_name in full_table_names:
                if table_name not in [m.get('full_name') for m in self.schema_metadata]:
                    not_found.append(table_name)
            
            if removed_count == 0:
                logger.warning(f"No tables found to remove from FAISS index")
                return {
                    'removed_count': 0,
                    'not_found': not_found,
                    'index_size': self.index.ntotal
                }

            # Determine which positions in the OLD index should be kept
            # (before we overwrite self.schema_metadata)
            old_metadata = self.schema_metadata  # still the old list at this point
            kept_positions = [
                i for i, m in enumerate(old_metadata)
                if m.get('full_name') not in tables_to_remove
            ]

            # Update metadata (raw_schema_cache already updated in-place above)
            self.schema_metadata = new_schema_metadata
            logger.info(f"Removed {removed_count} tables from FAISS, updated is_excluded=True in raw_schema_cache")

            # Rebuild index ONCE — extract existing vectors from FAISS, no re-encoding
            logger.info(f"Rebuilding index with {len(self.schema_metadata)} remaining tables (no re-encode)")

            if len(self.schema_metadata) == 0:
                self.index = faiss.IndexFlatIP(self.dimension)
                logger.info("All tables removed — index is now empty")
            else:
                # Retrieve stored vectors directly from FAISS (O(N) copy, no GPU/model needed)
                all_vectors = self.index.reconstruct_n(0, len(old_metadata))  # shape (old_N, dim)
                kept_vectors = all_vectors[kept_positions]                    # shape (new_N, dim)

                new_index = faiss.IndexFlatIP(self.dimension)
                new_index.add(kept_vectors)

                # Atomic swap
                self.index = new_index

            # Update last_updated for health endpoint
            self.last_updated = datetime.now()

            logger.info(f"Successfully removed {removed_count} tables (zero re-encodes). Index size: {self.index.ntotal}")
            return {
                'removed_count': removed_count,
                'not_found': not_found,
                'index_size': self.index.ntotal
            }
            
        except Exception as e:
            logger.error(f"Failed to batch remove tables: {e}")
            return {'removed_count': 0, 'not_found': full_table_names, 'index_size': 0}

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


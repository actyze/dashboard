"""
FAISS-based Schema Service for Intelligent Table Recommendation (Trino JDBC edition)

- Fetches schema via Trino's system.jdbc.columns (catalog-agnostic, JDBC-friendly)
"""

import os
import asyncio
import logging
import os
import time
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

import faiss
import numpy as np
import trino
from sentence_transformers import SentenceTransformer

# Try to import spaCy, fallback gracefully if not available
try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    spacy = None
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

# -------- Setup --------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("faiss-schema-service")

# -------- Domain Labeling Classes --------
class EntityType(Enum):
    # Core entity types (from spaCy)
    PERSON = "PERSON"        # People, including fictional
    NORP = "NORP"            # Nationalities, religious or political groups
    FACILITY = "FAC"         # Buildings, airports, highways, etc.
    ORGANIZATION = "ORG"     # Companies, agencies, institutions, etc.
    GPE = "GPE"              # Countries, cities, states (Geopolitical Entity)
    LOCATION = "LOC"         # Non-GPE locations, mountain ranges, bodies of water
    PRODUCT = "PRODUCT"      # Objects, vehicles, foods, etc.
    EVENT = "EVENT"          # Named hurricanes, battles, sports events, etc.
    WORK_OF_ART = "WORK_OF_ART" # Titles of books, songs, etc.
    LAW = "LAW"              # Named documents made into laws
    LANGUAGE = "LANGUAGE"    # Any named language
    DATE = "DATE"            # Absolute or relative dates or periods
    TIME = "TIME"            # Times smaller than a day
    PERCENT = "PERCENT"      # Percentage, including "%"
    MONEY = "MONEY"          # Monetary values, including unit
    QUANTITY = "QUANTITY"    # Measurements, as of weight or distance
    ORDINAL = "ORDINAL"      # "first", "second", etc.
    CARDINAL = "CARDINAL"    # Numerals that do not fall under another type
    
    # Custom domain-specific types
    CATEGORY = "CATEGORY"    # For product/business categories
    
    @classmethod
    def from_spacy_label(cls, label: str) -> Optional['EntityType']:
        """Convert spaCy label to EntityType, returning None if no match."""
        # Direct mapping for most labels
        mapping = {
            'PERSON': cls.PERSON,
            'NORP': cls.NORP,
            'FAC': cls.FACILITY,
            'ORG': cls.ORGANIZATION,
            'GPE': cls.GPE,
            'LOC': cls.LOCATION,
            'PRODUCT': cls.PRODUCT,
            'EVENT': cls.EVENT,
            'WORK_OF_ART': cls.WORK_OF_ART,
            'LAW': cls.LAW,
            'LANGUAGE': cls.LANGUAGE,
            'DATE': cls.DATE,
            'TIME': cls.TIME,
            'PERCENT': cls.PERCENT,
            'MONEY': cls.MONEY,
            'QUANTITY': cls.QUANTITY,
            'ORDINAL': cls.ORDINAL,
            'CARDINAL': cls.CARDINAL
        }
        return mapping.get(label)

@dataclass
class Entity:
    text: str
    entity_type: EntityType
    confidence: float
    start_pos: int
    end_pos: int


# -------- API Models --------
class SchemaRecommendationRequest(BaseModel):
    natural_language_query: str
    prior_context: List[str] = []
    top_k: int = 10
    confidence_threshold: float = 0.3


class SchemaRecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    query_embedding_time: float
    search_time: float
    total_schemas: int
    index_size: int
    last_updated: Optional[str]
    # Enhanced spaCy fields
    entities_detected: Optional[Dict[str, List[str]]] = None
    entity_count: Optional[int] = None
    enhanced_terms_count: Optional[int] = None


# -------- Trino Schema Loader (via system.jdbc.columns) --------
class TrinoSchemaService:
    def __init__(self, host: str, port: int = 8080, user: str = "admin", catalog: Optional[str] = None):
        self.host = host
        self.port = port
        self.user = user
        self.catalog = catalog
        self.connection = None

    def connect(self):
        try:
            import trino.dbapi
            import trino.auth
            
            # Check for basic auth credentials
            auth_user = os.getenv("TRINO_AUTH_USER")
            auth_password = os.getenv("TRINO_AUTH_PASSWORD")
            
            # Check SSL configuration
            ssl_enabled = os.getenv("TRINO_SSL_ENABLED", "false").lower() == "true"
            ssl_verification = os.getenv("TRINO_SSL_VERIFICATION", "NONE").upper()
            
            # Auto-detect SSL for port 443 if not explicitly configured
            if not ssl_enabled and self.port == 443:
                ssl_enabled = True
                logger.info(f"Port 443 detected, auto-enabling SSL")
            
            # Determine SSL verification setting
            verify_ssl = True
            if ssl_verification == "NONE":
                verify_ssl = False
            elif ssl_verification == "CA":
                verify_ssl = True
            elif ssl_verification == "FULL":
                verify_ssl = True
            
            # Build connection parameters
            connect_params = {
                "host": self.host,
                "port": self.port,
                "catalog": self.catalog
            }
            
            if ssl_enabled:
                connect_params["http_scheme"] = "https"
                connect_params["verify"] = verify_ssl
                logger.info(f"Using HTTPS with SSL verification: {ssl_verification}")
            else:
                logger.info(f"Using HTTP (SSL disabled)")
            
            # Use basic auth if credentials provided
            if auth_user and auth_password:
                logger.info(f"Using basic authentication for user: {auth_user}")
                auth_obj = trino.auth.BasicAuthentication(auth_user, auth_password)
                connect_params["user"] = auth_user
                connect_params["auth"] = auth_obj
            else:
                connect_params["user"] = self.user
            
            self.connection = trino.dbapi.connect(**connect_params)
            logger.info(f"Connected to Trino at {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Trino connect failed: {e}")
            raise

    async def get_all_schemas(self, retries: int = 3, backoff_base: float = 1.0) -> List[Dict[str, Any]]:
        """Fetch catalog/schema/table/columns using system.jdbc.columns (works across JDBC catalogs)."""
        if not self.connection:
            self.connect()

        query = """
            SELECT 
                table_cat   AS catalog,
                table_schem AS schema,
                table_name,
                column_name,
                type_name   AS data_type
            FROM system.jdbc.columns
            WHERE table_cat NOT IN ('system', 'tpcds', 'tpch')
            ORDER BY table_cat, table_schem, table_name
        """

        attempt = 0
        while True:
            try:
                logger.info(f"🔍 Executing schema query (attempt {attempt + 1}/{retries})")
                cursor = self.connection.cursor()
                cursor.execute(query)
                logger.info("📊 Query executed, fetching results...")
                rows = cursor.fetchall()
                logger.info(f"✅ Fetched {len(rows)} raw rows from Trino")
                cursor.close()

                table_map: Dict[str, Dict[str, Any]] = {}
                for catalog, schema, table, col, dtype in rows:
                    key = f"{catalog}.{schema}.{table}"
                    if key not in table_map:
                        table_map[key] = {
                            "catalog": catalog,
                            "schema": schema,
                            "table": table,
                            "full_name": key,
                            "columns": []
                        }
                    table_map[key]["columns"].append(f"{col}|{self._normalize_data_type(dtype)}")

                schemas = list(table_map.values())
                
                # Count catalogs, schemas, and tables
                catalogs = set()
                schema_names = set()
                table_names = set()
                total_columns = 0
                
                for schema_info in schemas:
                    catalogs.add(schema_info['catalog'])
                    schema_names.add(f"{schema_info['catalog']}.{schema_info['schema']}")
                    table_names.add(f"{schema_info['catalog']}.{schema_info['schema']}.{schema_info['table']}")
                    total_columns += len(schema_info['columns'])
                
                logger.info(f"📊 SCHEMA SUMMARY:")
                logger.info(f"  • Catalogs: {len(catalogs)} ({', '.join(sorted(catalogs))})")
                logger.info(f"  • Schemas: {len(schema_names)}")
                logger.info(f"  • Tables: {len(table_names)}")
                logger.info(f"  • Total Columns: {total_columns}")
                logger.info(f"  • Schema Objects: {len(schemas)}")
                
                return schemas

            except Exception as e:
                attempt += 1
                wait = backoff_base * (2 ** (attempt - 1))
                logger.warning(f"Schema fetch failed (attempt {attempt}/{retries}): {e}. Retrying in {wait:.1f}s")
                if attempt >= retries:
                    logger.error("Schema fetch failed after retries.")
                    raise
                await asyncio.sleep(wait)

    def _normalize_data_type(self, trino_type: str) -> str:
        """Normalize Trino data types to simplified categories for token efficiency."""
        trino_type = trino_type.lower()
        
        # Integer types
        if any(t in trino_type for t in ['integer', 'int', 'bigint', 'smallint', 'tinyint']):
            return 'integer'
        
        # Number types (decimal, float, double)
        if any(t in trino_type for t in ['decimal', 'numeric', 'float', 'double', 'real']):
            return 'number'
        
        # Date/time types
        if any(t in trino_type for t in ['date', 'time', 'timestamp']):
            return 'date'
        
        # Boolean types
        if 'boolean' in trino_type:
            return 'boolean'
        
        # Everything else is string (varchar, char, text, etc.)
        return 'string'


# -------- FAISS Embedder --------
class FAISSSchemaEmbedder:
    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"):
        self.model_name = model_name
        self.model = None
        self.dimension = 768  # paraphrase-multilingual-mpnet-base-v2 uses 768 dimensions
        self.index: Optional[faiss.Index] = None
        self.schema_metadata: List[Dict[str, Any]] = []
        self.last_updated: Optional[datetime] = None
        
        # Load model with caching support
        try:
            cache_dir = "/app/model_cache/sentence_transformers"
            if os.path.exists(cache_dir) and os.listdir(cache_dir):
                logger.info(f"Loading embedding model from cache: {cache_dir}")
                self.model = SentenceTransformer(model_name, cache_folder="/app/model_cache/sentence_transformers")
            else:
                logger.info(f"Cache not found, loading from Hugging Face: {model_name}")
                self.model = SentenceTransformer(model_name, cache_folder="/app/model_cache/sentence_transformers")
            
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"Successfully loaded embedding model (dim={self.dimension})")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise RuntimeError(f"Could not load sentence transformer model: {e}")

    @staticmethod
    def _schema_to_text(schema: Dict[str, Any]) -> str:
        # Handle new pipe-separated format: "column_name|data_type"
        if schema["columns"] and isinstance(schema["columns"][0], str):
            # New pipe-separated format
            column_info = [col.split('|') for col in schema["columns"] if '|' in col]
            cols = ", ".join([info[0] for info in column_info])
            types = ", ".join(sorted(set(info[1] for info in column_info if len(info) > 1)))
        else:
            # Legacy format (dict with name/type keys) - fallback
            cols = ", ".join([c["name"] for c in schema["columns"]])
            types = ", ".join(sorted(set(c["type"] for c in schema["columns"])))
        
        return (
            f"Database: {schema['catalog']} | "
            f"Schema: {schema['schema']} | "
            f"Table: {schema['table']} | "
            f"Full name: {schema['full_name']} | "
            f"Columns: {cols} | "
            f"Column types: {types}"
        )

    async def build_embeddings(self, schemas: List[Dict[str, Any]]):
        """Encode schemas -> FP16 embeddings, cosine via IndexFlatIP, atomic swap."""
        logger.info(f"🔨 Building embeddings for {len(schemas)} schemas...")
        
        logger.info("📝 Step 1: Converting schemas to text representations...")
        texts = [self._schema_to_text(s) for s in schemas]
        logger.info(f"✅ Generated {len(texts)} text representations")
        
        # Log sample text to verify format
        if texts:
            sample_text = texts[0][:200] + "..." if len(texts[0]) > 200 else texts[0]
            logger.info(f"📄 Sample text: {sample_text}")

        logger.info("🧠 Step 2: Encoding texts with SentenceTransformer model...")
        loop = asyncio.get_event_loop()
        
        # Encode with progress tracking using batch processing
        def encode_with_progress(texts):
            import numpy as np
            batch_size = 100  # Process in batches for progress updates
            total_texts = len(texts)
            all_embeddings = []
            
            logger.info(f"📊 Processing {total_texts} schemas in batches of {batch_size}")
            
            for i in range(0, total_texts, batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_embeddings = self.model.encode(batch_texts, show_progress_bar=False)
                all_embeddings.append(batch_embeddings)
                
                processed = min(i + batch_size, total_texts)
                progress_pct = (processed / total_texts) * 100
                logger.info(f"🔄 Progress: {processed}/{total_texts} schemas encoded ({progress_pct:.1f}%)")
            
            return np.vstack(all_embeddings)
        
        # Encode in a thread pool so we don't block the event loop
        embeddings = await loop.run_in_executor(None, encode_with_progress, texts)
        logger.info(f"✅ Generated embeddings shape: {embeddings.shape}")
        
        logger.info("🔄 Step 3: Converting to float32 for FAISS compatibility...")
        # Convert to float32 for FAISS compatibility
        embeddings = np.asarray(embeddings, dtype=np.float32)
        logger.info(f"✅ Converted to float32, memory usage: ~{embeddings.nbytes / 1024 / 1024:.1f} MB")
        
        logger.info("📐 Step 4: Normalizing L2 for cosine similarity...")
        # Normalize L2 for cosine with inner product
        faiss.normalize_L2(embeddings)
        logger.info("✅ L2 normalization complete")

        logger.info("🏗️ Step 5: Building FAISS index...")
        # FAISS expects float32 internally for IndexFlatIP; cast after normalization
        emb32 = embeddings.astype(np.float32, copy=False)
        new_index = faiss.IndexFlatIP(self.dimension)
        new_index.add(emb32)
        logger.info(f"✅ FAISS index built with {new_index.ntotal} vectors")

        # Atomic swap
        self.index = new_index
        self.schema_metadata = schemas
        self.last_updated = datetime.now()
        logger.info(f"FAISS index ready (ntotal={self.index.ntotal})")

    def search(self, query: str, prior_context: List[str] = None, top_k: int = 5, threshold: float = 0.3) -> Tuple[List[Dict[str, Any]], float, float]:
        if self.index is None:
            raise ValueError("FAISS index is not built yet.")

        # Combine query with prior context for enhanced semantic matching
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
        """Combine current query with prior context for better semantic matching."""
        if not prior_context:
            return query
        
        # Combine context and current query with appropriate weighting
        context_text = " ".join(prior_context)
        # Weight current query more heavily than context
        enhanced_query = f"{query} {query} {context_text}"
        
        logger.info(f"Enhanced query with {len(prior_context)} context items: {enhanced_query[:100]}...")
        return enhanced_query


# -------- Orchestration --------
class DomainLabeler:
    """Enhanced domain labeling with spaCy NER, domain mapping, and synonym expansion."""
    
    def __init__(self):
        self.nlp = None
        if SPACY_AVAILABLE:
            try:
                # Try to load the medium model first for better accuracy
                try:
                    self.nlp = spacy.load("en_core_web_md")
                    logger.info("Loaded spaCy model: en_core_web_md (medium)")
                except OSError:
                    # Fall back to small model if medium is not available
                    try:
                        self.nlp = spacy.load("en_core_web_sm")
                        logger.warning("Falling back to spaCy small model (en_core_web_sm). For better accuracy, install: python -m spacy download en_core_web_md")
                    except OSError:
                        logger.warning("No spaCy models found. NER will be limited to pattern matching.")
            except Exception as e:
                logger.error(f"Error loading spaCy model: {e}")
        else:
            logger.warning("spaCy not available. Using pattern-based entity extraction only.")
        
        # Domain-specific patterns
        self.product_patterns = [
            r'\b(fritos|doritos|coke|nike|adidas|iphone|macbook|samsung|dell)\b',
            r'\b\w+\s+(chips|soda|shoes|shirt|pants|laptop|phone|tablet)\b'
        ]
        
        self.category_patterns = [
            r'\b(electronics|clothing|food|beverages|sports|automotive)\b',
            r'\b(premium|budget|luxury|economy|basic|standard)\b'
        ]
        
        # Comprehensive synonym mappings for query expansion
        self.synonyms = {
            "PERSON": {
                "person": ["person", "individual", "user", "customer", "employee"],
                "name": ["name", "full_name", "first_name", "last_name"]
            },
            "NORP": {
                "nationality": ["nationality", "ethnicity", "origin", "heritage"],
                "group": ["group", "community", "organization"]
            },
            "FAC": {
                "facility": ["facility", "building", "location", "venue"],
                "address": ["address", "location", "site"]
            },
            "ORG": {
                "organization": ["organization", "company", "business", "corporation"],
                "brand": ["brand", "manufacturer", "vendor", "supplier"]
            },
            "GPE": {
                "city": ["city", "town", "location", "place"],
                "state": ["state", "province", "region"],
                "country": ["country", "nation"]
            },
            "LOC": {
                "location": ["location", "place", "area", "region"],
                "address": ["address", "coordinates"]
            },
            "PRODUCT": {
                "product": ["product", "item", "merchandise", "goods"],
                "name": ["name", "title", "description", "model"]
            },
            "EVENT": {
                "event": ["event", "occasion", "activity", "happening"],
                "date": ["date", "time", "when"]
            },
            "WORK_OF_ART": {
                "title": ["title", "name", "work", "creation"],
                "art": ["art", "media", "content"]
            },
            "LAW": {
                "law": ["law", "regulation", "rule", "policy"],
                "legal": ["legal", "compliance", "regulatory"]
            },
            "LANGUAGE": {
                "language": ["language", "tongue", "dialect"],
                "locale": ["locale", "region", "country"]
            },
            "DATE": {
                "date": ["date", "time", "when", "period"],
                "timestamp": ["timestamp", "created_at", "updated_at"]
            },
            "TIME": {
                "time": ["time", "hour", "minute", "when"],
                "timestamp": ["timestamp", "created_at", "updated_at"]
            },
            "PERCENT": {
                "percentage": ["percentage", "percent", "rate", "ratio"],
                "metric": ["metric", "kpi", "measure"]
            },
            "MONEY": {
                "amount": ["amount", "price", "cost", "value"],
                "currency": ["currency", "dollar", "euro", "yen"]
            },
            "QUANTITY": {
                "quantity": ["quantity", "amount", "count", "number"],
                "measure": ["measure", "size", "weight", "volume"]
            },
            "ORDINAL": {
                "order": ["order", "rank", "position", "sequence"],
                "number": ["number", "index", "rank"]
            },
            "CARDINAL": {
                "number": ["number", "count", "quantity", "amount"],
                "value": ["value", "total", "sum"]
            },
            "CATEGORY": {
                "type": ["type", "kind", "category", "class"],
                "segment": ["segment", "division", "group"]
            }
        }
    
    def extract_entities(self, query: str) -> List[Entity]:
        """Extract entities using spaCy NER + custom patterns."""
        entities = []
        
        # 1. spaCy NER (if available)
        if self.nlp:
            doc = self.nlp(query)
            for ent in doc.ents:
                entity_type = self._map_spacy_label(ent.label_)
                if entity_type:
                    entities.append(Entity(
                        text=ent.text,
                        entity_type=entity_type,
                        confidence=0.9,
                        start_pos=ent.start_char,
                        end_pos=ent.end_char
                    ))
        
        # 2. Custom patterns for products
        for pattern in self.product_patterns:
            for match in re.finditer(pattern, query, re.IGNORECASE):
                entities.append(Entity(
                    text=match.group(),
                    entity_type=EntityType.PRODUCT,
                    confidence=0.8,
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        # 3. Custom patterns for categories
        for pattern in self.category_patterns:
            for match in re.finditer(pattern, query, re.IGNORECASE):
                entities.append(Entity(
                    text=match.group(),
                    entity_type=EntityType.CATEGORY,
                    confidence=0.7,
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return self._deduplicate_entities(entities)
    
    def _map_spacy_label(self, spacy_label: str) -> Optional[EntityType]:
        """Map spaCy labels to our comprehensive EntityType enum."""
        # Use the class method for direct mapping
        entity_type = EntityType.from_spacy_label(spacy_label)
        if entity_type:
            return entity_type
            
        # If no direct mapping found, return None (entity will be ignored)
        logger.debug(f"No mapping found for spaCy label: {spacy_label}")
        return None
    
    def _deduplicate_entities(self, entities: List[Entity]) -> List[Entity]:
        """Remove overlapping entities."""
        entities.sort(key=lambda x: x.confidence, reverse=True)
        filtered = []
        
        for entity in entities:
            overlaps = False
            for existing in filtered:
                if (entity.start_pos < existing.end_pos and 
                    entity.end_pos > existing.start_pos):
                    overlaps = True
                    break
            if not overlaps:
                filtered.append(entity)
        
        return filtered
    
    def expand_with_synonyms(self, entities: List[Entity]) -> List[str]:
        """Expand entities with synonyms."""
        expanded_terms = []
        
        for entity in entities:
            entity_type = entity.entity_type.value
            expanded_terms.append(entity.text)
            
            if entity_type in self.synonyms:
                for concept, synonyms in self.synonyms[entity_type].items():
                    expanded_terms.extend([f"{entity.text} {syn}" for syn in synonyms[:2]])
        
        return list(set(expanded_terms))
    
    def enhance_query_with_entities(self, query: str) -> Dict[str, Any]:
        """Complete pipeline: NER → Domain Mapping → Synonym Expansion."""
        # Step 1: Extract entities
        entities = self.extract_entities(query)
        
        # Step 2: Group by type
        entity_groups = {}
        for entity in entities:
            entity_type = entity.entity_type.value
            if entity_type not in entity_groups:
                entity_groups[entity_type] = []
            entity_groups[entity_type].append(entity.text)
        
        # Step 3: Expand with synonyms
        synonym_terms = self.expand_with_synonyms(entities)
        
        # Step 4: Generate enhanced terms
        enhanced_terms = [query]  # Original query
        enhanced_terms.extend(synonym_terms)
        
        # Add contextual terms
        for entity_type, entity_texts in entity_groups.items():
            for text in entity_texts:
                if entity_type == "LOCATION":
                    enhanced_terms.extend([f"orders {text}", f"customers {text}"])
                elif entity_type == "PRODUCT":
                    enhanced_terms.extend([f"sales {text}", f"inventory {text}"])
        
        # Limit terms to prevent token bloat
        enhanced_terms = list(set(enhanced_terms))[:15]
        
        return {
            "original_query": query,
            "entities": entity_groups,
            "entity_count": len(entities),
            "enhanced_terms": enhanced_terms
        }

class SchemaService:
    def __init__(self):
        self.trino_host = os.getenv("TRINO_HOST", "localhost")
        self.trino_port = int(os.getenv("TRINO_PORT", "8080"))
        self.trino_user = os.getenv("TRINO_USER", "admin")
        self.trino_catalog = os.getenv("TRINO_CATALOG")  # optional
        self.refresh_hours = int(os.getenv("SCHEMA_REFRESH_HOURS", "3"))

        self.trino_service = TrinoSchemaService(
            host=self.trino_host, port=self.trino_port, user=self.trino_user, catalog=self.trino_catalog
        )
        self.embedder = FAISSSchemaEmbedder()
        self.labeler = DomainLabeler()  # Initialize domain labeler
        self.scheduler = AsyncIOScheduler()

    async def initialize(self):
        logger.info("Initializing: first schema load + FAISS build")
        await self.refresh_schemas()
        self.scheduler.add_job(self.refresh_schemas, "interval", hours=self.refresh_hours, id="schema_refresh")
        self.scheduler.start()
        logger.info(f"Scheduled schema refresh every {self.refresh_hours} hour(s)")

    async def refresh_schemas(self):
        logger.info("Refreshing schemas…")
        schemas = await self.trino_service.get_all_schemas()
        await self.embedder.build_embeddings(schemas)
        logger.info(f"Refresh complete: {len(schemas)} schemas embedded")

    def recommend(self, query: str, prior_context: List[str] = None, top_k: int = 10, threshold: float = 0.3) -> Dict[str, Any]:
        """Enhanced recommendation with domain labeling pipeline."""
        try:
            # Step 1: spaCy NER + Domain Mapping + Synonym Expansion
            entity_analysis = self.labeler.enhance_query_with_entities(query)
            logger.info(f"Entity analysis: {entity_analysis['entity_count']} entities, {len(entity_analysis['enhanced_terms'])} terms")
            
            # Step 2: Create enhanced query for embedding
            enhanced_query = " ".join(entity_analysis["enhanced_terms"])
            
            # Step 3: MPNet embedding + FAISS search
            recs, embed_t, search_t = self.embedder.search(enhanced_query, prior_context, top_k, threshold)
            
            # Step 4: Boost recommendations based on detected entities
            boosted_recs = self._boost_by_entities(recs, entity_analysis["entities"])
            
            return {
                "recommendations": boosted_recs,
                "entities_detected": entity_analysis["entities"],
                "entity_count": entity_analysis["entity_count"],
                "enhanced_terms_count": len(entity_analysis["enhanced_terms"]),
                "query_embedding_time": embed_t,
                "search_time": search_t,
                "total_schemas": len(self.embedder.schema_metadata),
                "index_size": self.embedder.index.ntotal if self.embedder.index else 0,
                "last_updated": self.embedder.last_updated.isoformat() if self.embedder.last_updated else None
            }
        
        except Exception as e:
            logger.error(f"Enhanced recommendation failed: {e}. Falling back to simple search.")
            # Fallback to simple search
            recs, embed_t, search_t = self.embedder.search(query, prior_context, top_k, threshold)
            return {
                "recommendations": recs,
                "entities_detected": {},
                "entity_count": 0,
                "enhanced_terms_count": 1,
                "query_embedding_time": embed_t,
                "search_time": search_t,
                "total_schemas": len(self.embedder.schema_metadata),
                "index_size": self.embedder.index.ntotal if self.embedder.index else 0,
                "last_updated": self.embedder.last_updated.isoformat() if self.embedder.last_updated else None
            }
    
    def _boost_by_entities(self, recommendations: List[Dict], entities: Dict[str, List[str]]) -> List[Dict]:
        """Boost schema recommendations based on detected entities."""
        if not entities:
            return recommendations
        
        for rec in recommendations:
            boost_score = 0.0
            column_names = [col.split('|')[0].lower() for col in rec["columns"]]
            
            # Person entity boosting
            if "PERSON" in entities:
                person_columns = [col for col in column_names 
                                if any(term in col for term in 
                                      ['name', 'user', 'customer', 'employee', 'person', 'first_name', 'last_name'])]
                if person_columns:
                    boost_score += 0.25
                    logger.debug(f"Person boost for {rec['full_name']}: {person_columns}")
            
            # Organization entity boosting
            if "ORG" in entities:
                org_columns = [col for col in column_names 
                             if any(term in col for term in 
                                   ['company', 'organization', 'vendor', 'supplier', 'brand'])]
                if org_columns:
                    boost_score += 0.25
                    logger.debug(f"Organization boost for {rec['full_name']}: {org_columns}")
            
            # Location entity boosting (GPE and LOC)
            if "GPE" in entities or "LOC" in entities:
                location_columns = [col for col in column_names 
                                  if any(term in col for term in 
                                        ['city', 'address', 'location', 'state', 'country', 'zip', 'place'])]
                if location_columns:
                    boost_score += 0.25
                    logger.debug(f"Location boost for {rec['full_name']}: {location_columns}")
            
            # Facility entity boosting
            if "FAC" in entities:
                facility_columns = [col for col in column_names 
                                  if any(term in col for term in 
                                        ['building', 'facility', 'venue', 'address', 'location'])]
                if facility_columns:
                    boost_score += 0.20
                    logger.debug(f"Facility boost for {rec['full_name']}: {facility_columns}")
            
            # Product entity boosting
            if "PRODUCT" in entities:
                product_columns = [col for col in column_names 
                                 if any(term in col for term in 
                                       ['product', 'item', 'name', 'description', 'brand', 'model'])]
                if product_columns:
                    boost_score += 0.25
                    logger.debug(f"Product boost for {rec['full_name']}: {product_columns}")
            
            # Date/Time entity boosting
            if "DATE" in entities or "TIME" in entities:
                date_columns = [col for col in column_names 
                              if any(term in col for term in 
                                    ['date', 'time', 'created', 'updated', 'timestamp', 'when'])]
                if date_columns:
                    boost_score += 0.20
                    logger.debug(f"Date/Time boost for {rec['full_name']}: {date_columns}")
            
            # Money entity boosting
            if "MONEY" in entities:
                money_columns = [col for col in column_names 
                               if any(term in col for term in 
                                     ['price', 'cost', 'amount', 'value', 'currency', 'dollar'])]
                if money_columns:
                    boost_score += 0.25
                    logger.debug(f"Money boost for {rec['full_name']}: {money_columns}")
            
            # Quantity/Percent entity boosting
            if "QUANTITY" in entities or "PERCENT" in entities:
                quantity_columns = [col for col in column_names 
                                  if any(term in col for term in 
                                        ['quantity', 'count', 'number', 'amount', 'percent', 'rate'])]
                if quantity_columns:
                    boost_score += 0.20
                    logger.debug(f"Quantity boost for {rec['full_name']}: {quantity_columns}")
            
            # Event entity boosting
            if "EVENT" in entities:
                event_columns = [col for col in column_names 
                               if any(term in col for term in 
                                     ['event', 'activity', 'occasion', 'happening'])]
                if event_columns:
                    boost_score += 0.15
                    logger.debug(f"Event boost for {rec['full_name']}: {event_columns}")
            
            # Category entity boosting
            if "CATEGORY" in entities:
                category_columns = [col for col in column_names 
                                  if any(term in col for term in 
                                        ['category', 'type', 'class', 'segment'])]
                if category_columns:
                    boost_score += 0.20
                    logger.debug(f"Category boost for {rec['full_name']}: {category_columns}")
            
            # Apply boost
            if boost_score > 0:
                rec["confidence"] = min(1.0, rec["confidence"] + boost_score)
                rec["entity_boost"] = boost_score
        
        # Re-sort by boosted confidence
        recommendations.sort(key=lambda x: x["confidence"], reverse=True)
        return recommendations


# -------- FastAPI App --------
schema_service = SchemaService()
app = FastAPI(title="FAISS Schema Service", description="Schema recommender via Trino JDBC metadata", version="1.2.0")


@app.on_event("startup")
async def on_startup():
    await schema_service.initialize()


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "last_updated": schema_service.embedder.last_updated.isoformat() if schema_service.embedder.last_updated else None,
        "total_schemas": len(schema_service.embedder.schema_metadata),
        "index_size": schema_service.embedder.index.ntotal if schema_service.embedder.index else 0
    }


@app.post("/recommend", response_model=SchemaRecommendationResponse)
async def recommend(req: SchemaRecommendationRequest):
    try:
        return schema_service.recommend(
            req.natural_language_query, 
            req.prior_context, 
            req.top_k, 
            req.confidence_threshold
        )
    except Exception as e:
        logger.exception("Recommendation failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/refresh")
async def manual_refresh():
    try:
        await schema_service.refresh_schemas()
        return {"status": "success", "last_updated": schema_service.embedder.last_updated.isoformat()}
    except Exception as e:
        logger.exception("Manual refresh failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/schemas")
async def list_schemas():
    return {
        "schemas": [
            {
                "full_name": s["full_name"],
                "catalog": s["catalog"],
                "schema": s["schema"],
                "table": s["table"],
                "column_count": len(s["columns"])
            } for s in schema_service.embedder.schema_metadata
        ],
        "total_count": len(schema_service.embedder.schema_metadata),
        "last_updated": schema_service.embedder.last_updated.isoformat() if schema_service.embedder.last_updated else None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))

"""
FAISS-based Schema Service for Intelligent Table Recommendation (Trino JDBC edition)

- Fetches schema via Trino's system.jdbc.columns (catalog-agnostic, JDBC-friendly)
"""

import os
import logging
from typing import List, Dict, Any, Optional

# Import Depends
import uvicorn
from fastapi import FastAPI, HTTPException, Depends
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

# Import modular components
from app.models import (
    SchemaRecommendationRequest, 
    SchemaRecommendationResponse,
    IntentDetectionRequest,
    IntentDetectionResponse
)
from app.trino_client import TrinoSchemaService
from app.embedder import FAISSSchemaEmbedder
from app.domain_labeler import DomainLabeler
from app.intent_detector import IntentDetector
from app.explorer import (
    get_databases_list,
    get_database_schemas_list,
    get_schema_objects_list,
    get_table_detail,
    search_database_objects_list
)
# Simple service key authentication for internal service-to-service communication
from fastapi import Header

# -------- Setup --------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("faiss-schema-service")


class SchemaService:
    def __init__(self):
        self.trino_host = os.getenv("TRINO_HOST", "localhost")
        self.trino_port = int(os.getenv("TRINO_PORT", "8080"))
        self.trino_user = os.getenv("TRINO_USER", "admin")
        self.trino_password = os.getenv("TRINO_PASSWORD", "")
        self.trino_catalog = os.getenv("TRINO_CATALOG")  # optional
        self.trino_ssl = os.getenv("TRINO_SSL", "false").lower() == "true"
        self.refresh_hours = int(os.getenv("SCHEMA_REFRESH_HOURS", "3"))
        
        # PostgreSQL connection for intent examples (same as Nexus uses)
        self.postgres_host = os.getenv("POSTGRES_HOST", "dashboard-postgres")
        self.postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
        self.postgres_db = os.getenv("POSTGRES_DB", "dashboard")
        self.postgres_user = os.getenv("POSTGRES_USER", "dashboard_user")
        self.postgres_password = os.getenv("POSTGRES_PASSWORD", "")
        
        # Schema loading configuration
        # In dev/local: Include TPC-H for testing
        # In production: Exclude TPC-H (it's just sample data)
        self.include_tpch = os.getenv("INCLUDE_TPCH", "false").lower() == "true"
        
        # Additional catalogs to exclude (comma-separated)
        # Useful for external Trino with problematic catalogs
        excluded_catalogs_env = os.getenv("EXCLUDED_CATALOGS", "")
        self.extra_excluded_catalogs = [c.strip() for c in excluded_catalogs_env.split(",") if c.strip()]
        if self.extra_excluded_catalogs:
            logger.info(f"Additional excluded catalogs from EXCLUDED_CATALOGS: {self.extra_excluded_catalogs}")

        self.trino_service = TrinoSchemaService(
            host=self.trino_host, 
            port=self.trino_port, 
            user=self.trino_user,
            password=self.trino_password,
            catalog=self.trino_catalog,
            ssl=self.trino_ssl,
            include_tpch=self.include_tpch,
            extra_excluded_catalogs=self.extra_excluded_catalogs
        )
        self.embedder = FAISSSchemaEmbedder()
        self.labeler = DomainLabeler()  # Initialize domain labeler
        self.intent_detector = None  # Will be initialized after embedder loads MPNet
        self.scheduler = AsyncIOScheduler()

    async def initialize(self):
        logger.info("Initializing: first schema load + FAISS build")
        await self.refresh_schemas()
        
        # Initialize intent detector with shared MPNet model and DB connection
        logger.info("Initializing IntentDetector with shared MPNet model and database...")
        self.intent_detector = IntentDetector(
            model=self.embedder.model,
            db_host=self.postgres_host,
            db_port=self.postgres_port,
            db_name=self.postgres_db,
            db_user=self.postgres_user,
            db_password=self.postgres_password
        )
        logger.info("IntentDetector initialized successfully")
        
        # Schedule regular schema refresh (fetches new tables/columns from Trino)
        self.scheduler.add_job(
            self.refresh_schemas, 
            "interval", 
            hours=self.refresh_hours, 
            id="schema_refresh"
        )
        
        self.scheduler.start()
        logger.info(f"Scheduler started: schema refresh every {self.refresh_hours} hours")

    async def refresh_schemas(self):
        """
        Fetch schemas from Trino and rebuild FAISS index.
        Scheduled every N hours (configured by SCHEMA_REFRESH_HOURS).
        """
        logger.info("Refreshing schemas from Trino...")
        schemas = await self.trino_service.get_all_schemas()
        
        # Fetch exclusions from Nexus and filter out excluded resources
        exclusions = await self.fetch_exclusions()
        schemas_filtered = self.apply_exclusions(schemas, exclusions)
        logger.info(f"Filtered {len(schemas) - len(schemas_filtered)} excluded schemas")
        
        # Enrich schemas with user-provided descriptions from Nexus
        schemas_with_descriptions = await self.enrich_with_descriptions(schemas_filtered)
        
        await self.embedder.build_embeddings(schemas_with_descriptions)
        logger.info(f"Refresh complete: {len(schemas_with_descriptions)} schemas embedded")
    
    async def fetch_exclusions(self) -> List[Dict[str, Any]]:
        """
        Fetch schema exclusions from Nexus database.
        
        Returns:
            List of exclusion dicts with catalog, schema_name, table_name
        """
        try:
            import asyncpg
            
            # Connect to Nexus database
            conn = await asyncpg.connect(
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
                user=self.postgres_user,
                password=self.postgres_password
            )
            
            # Fetch all exclusions
            rows = await conn.fetch("""
                SELECT catalog, schema_name, table_name
                FROM nexus.schema_exclusions
                ORDER BY catalog, schema_name, table_name
            """)
            
            await conn.close()
            
            exclusions = [
                {
                    'catalog': row['catalog'],
                    'schema_name': row['schema_name'],
                    'table_name': row['table_name']
                }
                for row in rows
            ]
            
            logger.info(f"Fetched {len(exclusions)} exclusions from Nexus")
            return exclusions
            
        except Exception as e:
            logger.error(f"Failed to fetch exclusions from Nexus: {e}")
            # Return empty list on error - don't block schema refresh
            return []
    
    def apply_exclusions(self, schemas: List[Dict[str, Any]], exclusions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter out excluded schemas based on exclusion rules.
        
        Exclusion hierarchy:
        - Database level: Exclude all schemas from that catalog
        - Schema level: Exclude all tables from that catalog.schema
        - Table level: Exclude specific catalog.schema.table
        
        Args:
            schemas: List of schema dicts from Trino
            exclusions: List of exclusion dicts from Nexus
            
        Returns:
            Filtered list of schemas with excluded items removed
        """
        if not exclusions:
            return schemas
        
        # Build exclusion sets for efficient lookup
        excluded_databases = set()  # {catalog}
        excluded_schemas = set()    # {(catalog, schema)}
        excluded_tables = set()     # {(catalog, schema, table)}
        
        for exc in exclusions:
            catalog = exc['catalog']
            schema_name = exc['schema_name']
            table_name = exc['table_name']
            
            if not schema_name:
                # Database-level exclusion
                excluded_databases.add(catalog)
            elif not table_name:
                # Schema-level exclusion
                excluded_schemas.add((catalog, schema_name))
            else:
                # Table-level exclusion
                excluded_tables.add((catalog, schema_name, table_name))
        
        # Filter schemas
        filtered = []
        for schema in schemas:
            catalog = schema.get('catalog')
            schema_name = schema.get('schema')
            table_name = schema.get('table')
            
            # Check exclusions in order of specificity
            if catalog in excluded_databases:
                continue  # Entire database excluded
            
            if (catalog, schema_name) in excluded_schemas:
                continue  # Entire schema excluded
            
            if (catalog, schema_name, table_name) in excluded_tables:
                continue  # Specific table excluded
            
            # Not excluded - keep it
            filtered.append(schema)
        
        return filtered
    
    async def enrich_with_descriptions(self, schemas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Fetch metadata descriptions from Nexus and enrich schema objects.
        
        Args:
            schemas: List of schema dicts from Trino
            
        Returns:
            Enriched schema dicts with 'description' and 'column_descriptions' fields
        """
        try:
            import asyncpg
            
            # Connect to Nexus database
            conn = await asyncpg.connect(
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
                user=self.postgres_user,
                password=self.postgres_password
            )
            
            # Fetch all descriptions
            rows = await conn.fetch("""
                SELECT catalog, schema_name, table_name, column_name, description
                FROM nexus.metadata_descriptions
                ORDER BY catalog, schema_name, table_name, column_name
            """)
            
            await conn.close()
            
            # Build lookup dictionaries for fast access
            # Table descriptions: {(catalog, schema, table): description}
            table_descriptions = {}
            # Column descriptions: {(catalog, schema, table, column): description}
            column_descriptions = {}
            
            for row in rows:
                catalog = row['catalog']
                schema_name = row['schema_name']
                table_name = row['table_name']
                column_name = row['column_name']
                description = row['description']
                
                if column_name:
                    # Column-level description
                    column_descriptions[(catalog, schema_name, table_name, column_name)] = description
                elif table_name:
                    # Table-level description
                    table_descriptions[(catalog, schema_name, table_name)] = description
                # We don't currently use catalog/schema level descriptions in embeddings
            
            # Enrich schemas with descriptions
            enriched_schemas = []
            for schema in schemas:
                enriched_schema = schema.copy()
                
                catalog = schema.get('catalog')
                schema_name = schema.get('schema')
                table_name = schema.get('table')
                
                # Add table description if available
                table_key = (catalog, schema_name, table_name)
                if table_key in table_descriptions:
                    enriched_schema['description'] = table_descriptions[table_key]
                
                # Add column descriptions if available
                col_descs = {}
                columns = schema.get('columns', [])
                for col in columns:
                    # Columns can be strings "name|type" or dicts
                    if isinstance(col, str) and '|' in col:
                        col_name = col.split('|')[0]
                    elif isinstance(col, dict):
                        col_name = col.get('name')
                    else:
                        continue
                    
                    col_key = (catalog, schema_name, table_name, col_name)
                    if col_key in column_descriptions:
                        col_descs[col_name] = column_descriptions[col_key]
                
                if col_descs:
                    enriched_schema['column_descriptions'] = col_descs
                
                enriched_schemas.append(enriched_schema)
            
            logger.info(f"Enriched {len(enriched_schemas)} schemas with {len(table_descriptions)} table descriptions and {len(column_descriptions)} column descriptions")
            return enriched_schemas
            
        except Exception as e:
            logger.error(f"Failed to fetch descriptions from Nexus: {e}")
            # Return original schemas if description fetching fails
            return schemas

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


# -------- Authentication --------
# Simple service key for internal service-to-service auth
SERVICE_KEY = os.getenv("SCHEMA_SERVICE_KEY", "")

def verify_service_auth(x_service_key: str = Header(None, alias="X-Service-Key")):
    """
    Simple service key authentication for internal services.
    
    Services must provide X-Service-Key header matching SCHEMA_SERVICE_KEY env var.
    This is simpler than JWT for internal service-to-service communication.
    """
    if SERVICE_KEY and x_service_key != SERVICE_KEY:
        key_len = len(x_service_key) if x_service_key else 0
        logger.warning(f"Unauthorized access attempt - provided key length: {key_len}")
        raise HTTPException(status_code=401, detail="Unauthorized - Invalid service key")
    return {"authenticated": True}

# -------- FastAPI App --------
schema_service = SchemaService()
app = FastAPI(title="FAISS Schema Service", description="Schema recommender via Trino JDBC metadata", version="1.3.0")


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
async def recommend(req: SchemaRecommendationRequest, auth: dict = Depends(verify_service_auth)):
    """
    Endpoint for schema recommendations (requires service key)
    
    Security: Simple service key authentication (X-Service-Key header)
    """
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
async def refresh_schemas_endpoint(auth: dict = Depends(verify_service_auth)):
    """
    Endpoint for manual schema refresh (requires service key)
    
    Security: Simple service key authentication (X-Service-Key header)
    Only trusted internal services (Nexus) can call this.
    
    Refreshes:
    - In-memory schema metadata from Trino
    - FAISS vector embeddings
    - Makes newly uploaded tables available for AI queries
    """
    try:
        logger.info("Schema refresh triggered by authenticated service")
        await schema_service.refresh_schemas()
        return {
            "status": "success",
            "message": "Schema metadata and vectors refreshed successfully",
            "last_updated": schema_service.embedder.last_updated.isoformat(),
            "total_schemas": len(schema_service.embedder.schema_metadata)
        }
    except Exception as e:
        logger.exception("Schema refresh failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/table/add")
async def add_table(table: Dict[str, Any], auth: dict = Depends(verify_service_auth)):
    """
    Add a single table to the FAISS index (incremental update)
    
    This is much faster than full refresh:
    - Only encodes 1 table (~50-100ms)
    - No Trino queries
    - Scales independently of total table count
    
    Security: Simple service key authentication (X-Service-Key header)
    
    Request body should include:
    - catalog: string
    - schema: string  
    - table: string
    - full_name: string (catalog.schema.table)
    - columns: list of "column_name|type" strings or dicts
    - type: string (TABLE, VIEW, etc.)
    """
    try:
        logger.info(f"Adding table to index: {table.get('full_name', 'unknown')}")
        success = await schema_service.embedder.add_table(table)
        
        if success:
            return {
                "status": "success",
                "message": f"Table {table.get('full_name')} added successfully",
                "index_size": schema_service.embedder.index.ntotal if schema_service.embedder.index else 0,
                "total_schemas": len(schema_service.embedder.schema_metadata)
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to add table to index")
            
    except Exception as e:
        logger.exception("Failed to add table")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/table/{catalog}/{schema}/{table}")
async def remove_table(catalog: str, schema: str, table: str, auth: dict = Depends(verify_service_auth)):
    """
    Remove a table from the FAISS index (incremental update)
    
    Faster than full refresh:
    - No Trino queries
    - Only rebuilds index from in-memory metadata (~1-5s)
    - Much faster than querying all catalogs/schemas
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    try:
        full_name = f"{catalog}.{schema}.{table}"
        logger.info(f"Removing table from index: {full_name}")
        
        success = await schema_service.embedder.remove_table(full_name)
        
        if success:
            return {
                "status": "success",
                "message": f"Table {full_name} removed successfully",
                "index_size": schema_service.embedder.index.ntotal if schema_service.embedder.index else 0,
                "total_schemas": len(schema_service.embedder.schema_metadata)
            }
        else:
            raise HTTPException(status_code=404, detail=f"Table {full_name} not found in index")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to remove table")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/table/refresh")
async def refresh_table(table_info: Dict[str, Any], auth: dict = Depends(verify_service_auth)):
    """
    Refresh a specific table in the FAISS index (used when metadata description is updated).
    
    This removes the old embedding and adds a fresh one with updated descriptions:
    - Fetches updated descriptions from Nexus
    - Updates the FAISS embedding for the table
    
    Security: Simple service key authentication (X-Service-Key header)
    
    Request body should include:
    - catalog: string
    - schema: string
    - table: string
    """
    try:
        catalog = table_info.get('catalog')
        schema_name = table_info.get('schema')
        table_name = table_info.get('table')
        
        if not catalog or not schema_name or not table_name:
            raise HTTPException(status_code=400, detail="Missing required fields: catalog, schema, table")
        
        full_name = f"{catalog}.{schema_name}.{table_name}"
        logger.info(f"Refreshing table with updated descriptions: {full_name}")
        
        # Step 1: Find the table in current metadata
        table_schema = None
        for schema in schema_service.embedder.schema_metadata:
            if schema.get('full_name') == full_name:
                table_schema = schema.copy()
                break
        
        if not table_schema:
            raise HTTPException(status_code=404, detail=f"Table {full_name} not found in index")
        
        # Step 2: Remove old embedding
        await schema_service.embedder.remove_table(full_name)
        
        # Step 3: Fetch updated descriptions from Nexus and enrich the table
        enriched_schemas = await schema_service.enrich_with_descriptions([table_schema])
        
        # Step 4: Add back to FAISS index with new descriptions
        if enriched_schemas:
            await schema_service.embedder.add_table(enriched_schemas[0])
            logger.info(f"Table {full_name} refreshed successfully with updated descriptions")
        
        return {
            "status": "success",
            "message": f"Table {full_name} refreshed with updated descriptions",
            "index_size": schema_service.embedder.index.ntotal if schema_service.embedder.index else 0,
            "total_schemas": len(schema_service.embedder.schema_metadata)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to refresh table")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/detect", response_model=IntentDetectionResponse)
async def detect_intent(req: IntentDetectionRequest, auth: dict = Depends(verify_service_auth)):
    """
    Detect user intent using MPNet embeddings and cosine similarity.
    
    Security: Simple service key authentication (X-Service-Key header)
    
    Intent Labels:
    - NEW_QUERY: Execute a new query (triggers schema narrowing)
    - REFINE_RESULT: Modify current result (reuse schema)
    - REJECT_RESULT: User unhappy with result (reuse schema)
    - EXPLAIN_RESULT: User wants explanation (reuse schema)
    - FOLLOW_UP_SAME_DOMAIN: Related analysis (reuse schema)
    - AMBIGUOUS: Confidence < 0.70
    """
    try:
        if not schema_service.intent_detector:
            raise HTTPException(status_code=503, detail="IntentDetector not initialized")
        
        result = schema_service.intent_detector.detect_intent(req.text)
        return result
    except Exception as e:
        logger.exception("Intent detection failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/reload")
async def reload_intent_examples(auth: dict = Depends(verify_service_auth)):
    """
    Reload intent examples from database without restarting service.
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    try:
        schema_service.intent_detector.reload_examples()
        total_examples = sum(len(v) for v in schema_service.intent_detector.intent_examples.values())
        return {
            "status": "success",
            "message": "Intent examples reloaded from database",
            "total_examples": total_examples,
            "intents": {
                intent: len(examples) 
                for intent, examples in schema_service.intent_detector.intent_examples.items()
            }
        }
    except Exception as e:
        logger.exception("Intent examples reload failed")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DBeaver-style Database Explorer API Endpoints
# ============================================================================

@app.get("/explorer/databases")
async def get_databases(auth: dict = Depends(verify_service_auth)):
    """
    Get list of all databases/catalogs (Level 1: Database Browser).
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    return get_databases_list(
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/databases/{database}/schemas")
async def get_database_schemas(database: str, auth: dict = Depends(verify_service_auth)):
    """
    Get list of all schemas in a database (Level 2: Schema Browser).
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    return get_database_schemas_list(
        database,
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/databases/{database}/schemas/{schema}/objects")
async def get_schema_objects(database: str, schema: str, auth: dict = Depends(verify_service_auth)):
    """
    Get all database objects in a schema (Level 3: Object Browser).
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    return get_schema_objects_list(
        database,
        schema,
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/databases/{database}/schemas/{schema}/tables/{table}")
async def get_table_details(database: str, schema: str, table: str, auth: dict = Depends(verify_service_auth)):
    """
    Get detailed information about a specific table/view (Level 4: Object Details).
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    return get_table_detail(
        database,
        schema,
        table,
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/search")
async def search_database_objects(
    query: str,
    database: Optional[str] = None,
    schema: Optional[str] = None,
    object_type: Optional[str] = None,
    auth: dict = Depends(verify_service_auth)
):
    """
    Search for database objects across all databases/schemas.
    
    Security: Simple service key authentication (X-Service-Key header)
    """
    return search_database_objects_list(
        query,
        schema_service.embedder.raw_schema_cache,
        database,
        schema,
        object_type
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))

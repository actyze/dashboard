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
from app.auth import require_auth, verify_service_token

# -------- Setup --------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("faiss-schema-service")


class SchemaService:
    def __init__(self):
        self.trino_host = os.getenv("TRINO_HOST", "localhost")
        self.trino_port = int(os.getenv("TRINO_PORT", "8080"))
        self.trino_user = os.getenv("TRINO_USER", "admin")
        self.trino_catalog = os.getenv("TRINO_CATALOG")  # optional
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

        self.trino_service = TrinoSchemaService(
            host=self.trino_host, 
            port=self.trino_port, 
            user=self.trino_user, 
            catalog=self.trino_catalog,
            include_tpch=self.include_tpch
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
async def recommend(req: SchemaRecommendationRequest, user: dict = Depends(verify_service_token)):
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
async def manual_refresh(user: dict = Depends(verify_service_token)):
    try:
        await schema_service.refresh_schemas()
        return {"status": "success", "last_updated": schema_service.embedder.last_updated.isoformat()}
    except Exception as e:
        logger.exception("Manual refresh failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/reload")
async def reload_intent_examples(user: dict = Depends(verify_service_token)):
    """Reload intent examples from database without restarting service."""
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


@app.post("/intent/detect", response_model=IntentDetectionResponse)
async def detect_intent(req: IntentDetectionRequest, user: dict = Depends(verify_service_token)):
    """
    Detect user intent using MPNet embeddings and cosine similarity.
    
    No heuristics. No hosted LLMs. Pure ML-based classification.
    
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


# ============================================================================
# DBeaver-style Database Explorer API Endpoints
# ============================================================================

@app.get("/explorer/databases")
async def get_databases(user: dict = Depends(verify_service_token)):
    """Get list of all databases/catalogs (Level 1: Database Browser)."""
    return get_databases_list(
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/databases/{database}/schemas")
async def get_database_schemas(database: str, user: dict = Depends(verify_service_token)):
    """Get list of all schemas in a database (Level 2: Schema Browser)."""
    return get_database_schemas_list(
        database,
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/databases/{database}/schemas/{schema}/objects")
async def get_schema_objects(database: str, schema: str, user: dict = Depends(verify_service_token)):
    """Get all database objects in a schema (Level 3: Object Browser)."""
    return get_schema_objects_list(
        database,
        schema,
        schema_service.embedder.raw_schema_cache,
        schema_service.embedder.last_updated
    )


@app.get("/explorer/databases/{database}/schemas/{schema}/tables/{table}")
async def get_table_details(database: str, schema: str, table: str, user: dict = Depends(verify_service_token)):
    """Get detailed information about a specific table/view (Level 4: Object Details)."""
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
    user: dict = Depends(verify_service_token)
):
    """Search for database objects across all databases/schemas."""
    return search_database_objects_list(
        query,
        schema_service.embedder.raw_schema_cache,
        database,
        schema,
        object_type
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))

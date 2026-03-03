"""Data models and enums for schema service."""

from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


# ============================================================================
# Domain Labeling Enums and Classes
# ============================================================================

class EntityType(Enum):
    """Entity types for domain labeling."""
    # Core entity types (from spaCy)
    PERSON = "PERSON"
    NORP = "NORP"
    FACILITY = "FAC"
    ORGANIZATION = "ORG"
    GPE = "GPE"
    LOCATION = "LOC"
    PRODUCT = "PRODUCT"
    EVENT = "EVENT"
    WORK_OF_ART = "WORK_OF_ART"
    LAW = "LAW"
    LANGUAGE = "LANGUAGE"
    DATE = "DATE"
    TIME = "TIME"
    PERCENT = "PERCENT"
    MONEY = "MONEY"
    QUANTITY = "QUANTITY"
    ORDINAL = "ORDINAL"
    CARDINAL = "CARDINAL"
    CATEGORY = "CATEGORY"
    
    @classmethod
    def from_spacy_label(cls, label: str) -> Optional['EntityType']:
        """Convert spaCy label to EntityType."""
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
    """Extracted entity with metadata."""
    text: str
    entity_type: EntityType
    confidence: float
    start_pos: int
    end_pos: int


# ============================================================================
# API Request/Response Models
# ============================================================================

class SchemaRecommendationRequest(BaseModel):
    """Request model for schema recommendations."""
    natural_language_query: str
    prior_context: List[str] = []
    top_k: int = 10
    confidence_threshold: float = 0.3


class SchemaRecommendationResponse(BaseModel):
    """Response model for schema recommendations."""
    recommendations: List[Dict[str, Any]]
    query_embedding_time: float
    search_time: float
    total_schemas: int
    index_size: int
    last_updated: Optional[str]
    entities_detected: Optional[Dict[str, List[str]]] = None
    entity_count: Optional[int] = None
    enhanced_terms_count: Optional[int] = None


class IntentDetectionRequest(BaseModel):
    """Request model for intent detection."""
    text: str


class IntentDetectionResponse(BaseModel):
    """Response model for intent detection."""
    intent: str
    confidence: float
    all_scores: Optional[Dict[str, float]] = None


class TableMetadataRequest(BaseModel):
    """Request for fetching complete table metadata."""
    catalog: str
    schema: str
    table: str


class ColumnMetadata(BaseModel):
    """Column metadata with type and description."""
    name: str
    type: str
    description: Optional[str] = None


class TableMetadataResponse(BaseModel):
    """Response with complete table metadata including columns and descriptions."""
    success: bool
    catalog: str
    schema: str
    table: str
    full_name: str
    connector_type: Optional[str] = None
    columns: List[ColumnMetadata] = []
    table_description: Optional[str] = None
    row_count: Optional[int] = None
    error: Optional[str] = None


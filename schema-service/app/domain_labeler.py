"""Enhanced domain labeling with spaCy NER, domain mapping, and synonym expansion."""

import re
import logging
from typing import Dict, List, Optional, Any

# Try to import spaCy, fallback gracefully if not available
try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    spacy = None

from app.models import EntityType, Entity

logger = logging.getLogger("domain-labeler")


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


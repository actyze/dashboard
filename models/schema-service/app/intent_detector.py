"""
Intent Detection using MPNet embeddings and cosine similarity.

Deterministic, ML-based intent classification without heuristics or external LLMs.
Uses the existing paraphrase-multilingual-mpnet-base-v2 model from the schema service.
Intent examples are loaded from database for easy maintenance and expansion.
"""

import logging
import numpy as np
import asyncpg
from typing import Dict, List, Tuple, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("intent-detector")


class IntentDetector:
    """
    Deterministic intent detection using MPNet embeddings.
    
    Intent Labels:
    - NEW_QUERY: User wants to execute a new query
    - REFINE_RESULT: User wants to modify the current result (filter, group, sort, optimize)
    - REJECT_RESULT: User is unhappy with the result
    - EXPLAIN_RESULT: User wants explanation of the result
    - FOLLOW_UP_SAME_DOMAIN: User wants related analysis on same data
    - ACCEPT_RESULT: User is satisfied with the result (no action needed)
    - AMBIGUOUS: Confidence too low (< 0.70)
    
    Intent examples are loaded from database (nexus.intent_examples table) for easy maintenance.
    Fallback examples are provided if database is unavailable.
    """
    
    # Fallback intent examples (used if database load fails - minimal set)
    FALLBACK_INTENT_EXAMPLES = {
        "NEW_QUERY": ["show me total sales", "list top customers", "what were last month's orders"],
        "REFINE_RESULT": ["filter this", "sort by revenue", "optimize this query", "make it faster"],
        "REJECT_RESULT": ["this is wrong", "incorrect", "not what I asked for"],
        "EXPLAIN_RESULT": ["why is this", "explain this", "how was this calculated"],
        "FOLLOW_UP_SAME_DOMAIN": ["break it down", "show trend", "compare with last year"],
        "ACCEPT_RESULT": ["this is good", "perfect", "thank you", "thanks"]
    }
    
    CONFIDENCE_THRESHOLD = 0.70
    
    def __init__(
        self, 
        model: Optional[SentenceTransformer] = None,
        db_host: Optional[str] = None,
        db_port: Optional[int] = None,
        db_name: Optional[str] = None,
        db_user: Optional[str] = None,
        db_password: Optional[str] = None
    ):
        """
        Initialize intent detector.
        
        Args:
            model: Pre-existing SentenceTransformer model (reuses embedder's model)
                   If None, loads its own instance.
            db_host: PostgreSQL host for loading intent examples
            db_port: PostgreSQL port
            db_name: Database name
            db_user: Database user
            db_password: Database password
        """
        self.model = model
        if self.model is None:
            logger.warning("No model provided, loading fresh instance of MPNet")
            self.model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-mpnet-base-v2")
        
        # Store DB connection info
        self.db_config = {
            "host": db_host,
            "port": db_port,
            "database": db_name,
            "user": db_user,
            "password": db_password
        } if db_host else None
        
        # Intent examples (loaded from DB or fallback)
        self.intent_examples: Dict[str, List[str]] = {}
        
        # Cache intent embeddings at initialization
        self.intent_embeddings: Dict[str, np.ndarray] = {}
        
        # Load examples and compute embeddings
        self._load_intent_examples()
        self._precompute_intent_embeddings()
        
        logger.info(f"IntentDetector initialized with {len(self.intent_examples)} intent classes, "
                   f"total examples: {sum(len(v) for v in self.intent_examples.values())}")
    
    def _load_intent_examples(self):
        """Load intent examples from database or use fallback."""
        if self.db_config and all(self.db_config.values()):
            try:
                import asyncio
                # Use asyncio.run to load from DB synchronously during init
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    self.intent_examples = loop.run_until_complete(self._load_from_database())
                    logger.info(f"Loaded intent examples from database: {sum(len(v) for v in self.intent_examples.values())} total examples")
                    return
                finally:
                    loop.close()
            except Exception as e:
                logger.error(f"Failed to load intent examples from database: {e}, using fallback")
        
        # Use fallback examples
        self.intent_examples = self.FALLBACK_INTENT_EXAMPLES.copy()
        logger.warning(f"Using fallback intent examples: {sum(len(v) for v in self.intent_examples.values())} total examples")
    
    async def _load_from_database(self) -> Dict[str, List[str]]:
        """Load intent examples from PostgreSQL database."""
        conn = await asyncpg.connect(**self.db_config)
        try:
            # Query active intent examples
            rows = await conn.fetch("""
                SELECT intent, example_text 
                FROM nexus.intent_examples 
                WHERE is_active = TRUE 
                ORDER BY intent, id
            """)
            
            # Group by intent
            examples_by_intent = {}
            for row in rows:
                intent = row['intent']
                if intent not in examples_by_intent:
                    examples_by_intent[intent] = []
                examples_by_intent[intent].append(row['example_text'])
            
            logger.info(f"Loaded {len(rows)} examples for {len(examples_by_intent)} intents from database")
            return examples_by_intent
        finally:
            await conn.close()
    
    def reload_examples(self):
        """Reload intent examples from database and recompute embeddings."""
        logger.info("Reloading intent examples...")
        self._load_intent_examples()
        self._precompute_intent_embeddings()
        logger.info("Intent examples reloaded successfully")
    
    def _precompute_intent_embeddings(self):
        """Precompute embeddings for all canonical intent examples."""
        logger.info("Precomputing intent embeddings...")
        
        for intent_label, examples in self.intent_examples.items():
            # Encode all examples for this intent
            embeddings = self.model.encode(examples, show_progress_bar=False)
            embeddings = np.asarray(embeddings, dtype=np.float32)
            
            # Store all embeddings (not averaged) for max similarity matching
            self.intent_embeddings[intent_label] = embeddings
            
            logger.info(f"Cached {len(examples)} examples for intent '{intent_label}'")
        
        logger.info("Intent embeddings precomputed successfully")
    
    def detect_intent(self, user_text: str) -> Dict[str, any]:
        """
        Detect user intent using cosine similarity against canonical examples.
        
        Args:
            user_text: Raw user utterance
        
        Returns:
            {
                "intent": str,        # Intent label or "AMBIGUOUS"
                "confidence": float,  # Similarity score [0, 1]
                "all_scores": dict    # Scores for all intents (for debugging)
            }
        """
        if not user_text or not user_text.strip():
            return {
                "intent": "AMBIGUOUS",
                "confidence": 0.0,
                "all_scores": {}
            }
        
        # Encode user text
        user_embedding = self.model.encode([user_text], show_progress_bar=False)
        user_embedding = np.asarray(user_embedding, dtype=np.float32)
        
        # Compute cosine similarity against all intent embeddings
        intent_scores = {}
        
        for intent_label, intent_examples_embeddings in self.intent_embeddings.items():
            # Compute similarity against all examples for this intent
            similarities = cosine_similarity(user_embedding, intent_examples_embeddings)[0]
            
            # Use max similarity (best-matching example)
            max_similarity = float(np.max(similarities))
            intent_scores[intent_label] = max_similarity
        
        # Find best intent
        best_intent = max(intent_scores, key=intent_scores.get)
        best_confidence = intent_scores[best_intent]
        
        # Apply threshold
        if best_confidence < self.CONFIDENCE_THRESHOLD:
            final_intent = "AMBIGUOUS"
            logger.info(f"Intent detection: AMBIGUOUS (best: {best_intent}={best_confidence:.3f} < {self.CONFIDENCE_THRESHOLD})")
        else:
            final_intent = best_intent
            logger.info(f"Intent detected: {final_intent} (confidence={best_confidence:.3f})")
        
        return {
            "intent": final_intent,
            "confidence": best_confidence,
            "all_scores": intent_scores
        }
    
    def detect_intent_batch(self, texts: List[str]) -> List[Dict[str, any]]:
        """Batch intent detection for multiple utterances."""
        return [self.detect_intent(text) for text in texts]


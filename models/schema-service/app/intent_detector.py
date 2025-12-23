"""
Intent Detection using MPNet embeddings and cosine similarity.

Deterministic, ML-based intent classification without heuristics or external LLMs.
Uses the existing paraphrase-multilingual-mpnet-base-v2 model from the schema service.
"""

import logging
import numpy as np
from typing import Dict, List, Tuple, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("intent-detector")


class IntentDetector:
    """
    Deterministic intent detection using MPNet embeddings.
    
    Intent Labels:
    - NEW_QUERY: User wants to execute a new query
    - REFINE_RESULT: User wants to modify the current result (filter, group, sort)
    - REJECT_RESULT: User is unhappy with the result
    - EXPLAIN_RESULT: User wants explanation of the result
    - FOLLOW_UP_SAME_DOMAIN: User wants related analysis on same data
    - ACCEPT_RESULT: User is satisfied with the result (no action needed)
    - AMBIGUOUS: Confidence too low (< 0.70)
    """
    
    # Canonical intent examples (can be moved to config/DB later)
    INTENT_EXAMPLES = {
        "NEW_QUERY": [
            "show me total sales by region",
            "list top customers by revenue",
            "what were last month's orders",
            "get all products in inventory",
            "find customers who purchased in Q4",
            "display revenue trends",
            "how many orders were placed yesterday",
            "show me employee salaries",
            "list all active users",
            "what is the average order value"
        ],
        "REFINE_RESULT": [
            "group this by region",
            "filter this to last 30 days",
            "sort by revenue",
            "limit to top 10",
            "add a column for percentage",
            "exclude inactive customers",
            "show only values above 1000",
            "order by date descending",
            "aggregate by month",
            "remove duplicates",
            "optimize this query",
            "can you improve this query",
            "make this query faster",
            "suggest a better version",
            "optimize this for trino",
            "check the query and improve it",
            "is there a better way to write this",
            "rewrite this query",
            "improve the performance",
            "make this more efficient"
        ],
        "REJECT_RESULT": [
            "this is wrong",
            "I don't like this result",
            "these numbers don't make sense",
            "this doesn't look right",
            "the data is incorrect",
            "something is off here",
            "this can't be correct",
            "I expected different numbers",
            "there's an error in this",
            "this is not what I asked for"
        ],
        "EXPLAIN_RESULT": [
            "why is this number so high",
            "explain this result",
            "how was this calculated",
            "what does this mean",
            "why are there so few results",
            "can you clarify this",
            "how did you get this number",
            "what's the logic behind this",
            "why is customer X on top",
            "where does this data come from"
        ],
        "FOLLOW_UP_SAME_DOMAIN": [
            "now break it down by category",
            "show trend for the same data",
            "compare this with last year",
            "what about last month",
            "how does this look by product",
            "add revenue to this",
            "include customer names",
            "show me the breakdown",
            "what if we group by state",
            "now show me the details"
        ],
        "ACCEPT_RESULT": [
            "this is good",
            "looks perfect",
            "that's correct",
            "exactly what I needed",
            "perfect",
            "great",
            "thank you",
            "thanks",
            "all good",
            "this works"
        ]
    }
    
    CONFIDENCE_THRESHOLD = 0.70
    
    def __init__(self, model: Optional[SentenceTransformer] = None):
        """
        Initialize intent detector.
        
        Args:
            model: Pre-existing SentenceTransformer model (reuses embedder's model)
                   If None, loads its own instance.
        """
        self.model = model
        if self.model is None:
            logger.warning("No model provided, loading fresh instance of MPNet")
            self.model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-mpnet-base-v2")
        
        # Cache intent embeddings at initialization
        self.intent_embeddings: Dict[str, np.ndarray] = {}
        self._precompute_intent_embeddings()
        
        logger.info(f"IntentDetector initialized with {len(self.INTENT_EXAMPLES)} intent classes")
    
    def _precompute_intent_embeddings(self):
        """Precompute embeddings for all canonical intent examples."""
        logger.info("Precomputing intent embeddings...")
        
        for intent_label, examples in self.INTENT_EXAMPLES.items():
            # Encode all examples for this intent
            embeddings = self.model.encode(examples, show_progress_bar=False)
            embeddings = np.asarray(embeddings, dtype=np.float32)
            
            # Store averaged embedding as the intent prototype
            # Alternative: store all and use max similarity
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


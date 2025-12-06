#!/usr/bin/env python3
"""
Model download and caching script for schema service.
Downloads Hugging Face and spaCy models once and caches them locally.
"""

import os
import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("model-downloader")

def download_sentence_transformer_model():
    """Download and cache sentence transformer model."""
    try:
        from sentence_transformers import SentenceTransformer
        
        model_name = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
        cache_dir = "/app/model_cache/sentence_transformers"
        
        logger.info(f"Downloading SentenceTransformer model: {model_name}")
        
        # Create cache directory
        os.makedirs(cache_dir, exist_ok=True)
        
        # Download model with custom cache directory
        model = SentenceTransformer(model_name, cache_folder=cache_dir)
        
        logger.info(f"SentenceTransformer model cached in {cache_dir}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download SentenceTransformer model: {e}")
        return False

def download_spacy_model():
    """Download and cache spaCy model."""
    try:
        import spacy
        from spacy.cli import download
        
        model_name = "en_core_web_md"
        
        logger.info(f"Downloading spaCy model: {model_name}")
        
        # Download spaCy model
        download(model_name)
        
        # Test loading
        nlp = spacy.load(model_name)
        logger.info(f"spaCy model {model_name} downloaded and verified")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download spaCy model: {e}")
        return False

def check_model_cache():
    """Check if models are already cached."""
    cache_dir = Path("/app/model_cache")
    
    # Check sentence transformer cache
    st_cache = cache_dir / "sentence_transformers"
    st_cached = st_cache.exists() and any(st_cache.iterdir())
    
    # Check spaCy model
    try:
        import spacy
        spacy_cached = True
        try:
            spacy.load("en_core_web_md")
        except OSError:
            spacy_cached = False
    except ImportError:
        spacy_cached = False
    
    logger.info(f"Model cache status:")
    logger.info(f"  SentenceTransformer: {'Cached' if st_cached else 'Missing'}")
    logger.info(f"  spaCy en_core_web_md: {'Cached' if spacy_cached else 'Missing'}")
    
    return st_cached and spacy_cached

def main():
    """Main model download function."""
    logger.info("Model Download and Caching Script")
    logger.info("=" * 50)
    
    # Create model cache directory
    cache_dir = Path("/app/model_cache")
    cache_dir.mkdir(exist_ok=True)
    
    # Check if models are already cached
    if check_model_cache():
        logger.info("All models already cached - skipping download")
        return True
    
    success = True
    
    # Download SentenceTransformer model
    if not download_sentence_transformer_model():
        success = False
    
    # Download spaCy model
    if not download_spacy_model():
        success = False
    
    if success:
        logger.info("All models downloaded and cached successfully")
    else:
        logger.error("Some models failed to download")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

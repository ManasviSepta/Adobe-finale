"""
ML Model Management Module
Handles SentenceTransformer model loading at startup for instant use
"""

import time
import os
from typing import Optional
from sentence_transformers import SentenceTransformer

# Global model instance
_MODEL: Optional[SentenceTransformer] = None
_MODEL_LOAD_TIME: Optional[float] = None

def get_model() -> SentenceTransformer:
    """
    Get the loaded SentenceTransformer model instance.
    Loads the model at first call if not already loaded.
    
    Returns:
        SentenceTransformer: The loaded model instance
        
    Raises:
        Exception: If model loading fails
    """
    global _MODEL, _MODEL_LOAD_TIME
    
    if _MODEL is None:
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Loading SentenceTransformer model...")
        start_time = time.time()
        
        try:
            # Load the model - this will download it if not cached
            _MODEL = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
            _MODEL_LOAD_TIME = time.time() - start_time
            
            logger.info(f"Model loaded successfully in {_MODEL_LOAD_TIME:.2f} seconds")
            logger.info(f"Model info: {_MODEL.get_sentence_embedding_dimension()} dimensions")
            
        except Exception as e:
            logger.error(f"Failed to load SentenceTransformer model: {e}")
            raise Exception(f"Model loading failed: {e}")
    
    return _MODEL

def is_model_ready() -> bool:
    """
    Check if the model is loaded and ready for use.
    
    Returns:
        bool: True if model is ready, False otherwise
    """
    return _MODEL is not None

def get_model_status() -> dict:
    """
    Get detailed status information about the model.
    
    Returns:
        dict: Model status information
    """
    if _MODEL is None:
        return {
            "status": "not_loaded",
            "available": False,
            "load_time": None,
            "dimensions": None,
            "message": "Model not loaded"
        }
    
    return {
        "status": "ready",
        "available": True,
        "load_time": _MODEL_LOAD_TIME,
        "dimensions": _MODEL.get_sentence_embedding_dimension(),
        "message": f"Model ready (loaded in {_MODEL_LOAD_TIME:.2f}s)"
    }

def encode_text(text: str) -> list:
    """
    Encode text using the loaded model.
    
    Args:
        text (str): Text to encode
        
    Returns:
        list: Embedding vector as a list of floats
        
    Raises:
        Exception: If model is not loaded
    """
    if not is_model_ready():
        raise Exception("Model not loaded. Call get_model() first.")
    
    try:
        embedding = _MODEL.encode(text)
        return embedding.tolist()  # Convert numpy array to list for JSON serialization
    except Exception as e:
        raise Exception(f"Text encoding failed: {e}")

# Load model at module import time
try:
    get_model()
except Exception as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Model loading failed at import time: {e}")
    logger.info("Model will be loaded on first use.")

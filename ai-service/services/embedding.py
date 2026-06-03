"""
Dense embedding via Sentence-Transformers (replaces SPLADE).
Model: paraphrase-multilingual-MiniLM-L12-v2
- 118MB, supports Chinese + English
- ~50ms per encode on CPU (vs 5300ms for SPLADE)
- Lazy-loaded at first call, pre-warmed at startup
"""

import os
import numpy as np
from numpy.linalg import norm

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_model = None


def _get_model():
    """Lazy-load SentenceTransformer (cached after first call)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def encode(text: str) -> np.ndarray:
    """Encode a single text → normalized 384-dim dense vector."""
    model = _get_model()
    vec = model.encode(text, convert_to_tensor=False, normalize_embeddings=True)
    return vec.astype(np.float32)


def batch_encode(texts: list[str]) -> np.ndarray:
    """Encode multiple texts at once (much faster than N×encode)."""
    model = _get_model()
    vecs = model.encode(texts, convert_to_tensor=False, normalize_embeddings=True)
    return vecs.astype(np.float32)


def cos_sim(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two already-normalized vectors."""
    return float(np.dot(a, b))

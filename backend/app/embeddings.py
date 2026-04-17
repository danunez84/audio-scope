"""
Audio Insight — Shared Embedding Model
Loaded once, shared across segmenter and summarizer.
"""

import os
os.environ["HF_HUB_OFFLINE"] = "1"

from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
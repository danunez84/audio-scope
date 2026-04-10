"""
Audio Insight — Shared Embedding Model
Loaded once, shared across segmenter and summarizer.
"""

from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
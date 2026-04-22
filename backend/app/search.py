"""
Audio Scope — Semantic Search
Searches transcript sentences by meaning using embeddings.
"""

import numpy as np
from dataclasses import dataclass
from sklearn.metrics.pairwise import cosine_similarity

from app.embeddings import model as _embedding_model
from app.segmenter import Sentence


@dataclass
class SearchResult:
    """A single search result with the matching sentence and its score."""
    text: str
    start: float
    end: float
    speaker: int | None
    score: float



def search_sentences(query: str, sentences: list[Sentence], top_k: int = 3) -> list[SearchResult]:
    """
    Searches transcript sentences by meaning.
    
    Args:
        query: The user's search text
        sentences: All sentences from the transcript
        top_k: Number of results to return
        
    Returns:
        Top matching sentences ranked by relevance.
    """
    if not sentences or not query.strip():
        return []

    # Embed the query
    query_embedding = _embedding_model.encode([query])[0].reshape(1, -1)

    # Embed all sentences
    texts = [s.text for s in sentences]
    sentence_embeddings = _embedding_model.encode(texts)

    # Score each sentence against the query
    scored_results = []
    for i, emb in enumerate(sentence_embeddings):
        score = cosine_similarity(query_embedding, emb.reshape(1, -1))[0][0]
        scored_results.append((score, i))

# Sort by score (highest first), filter low matches, take top_k
    scored_results.sort(reverse=True)
    top_results = [(score, idx) for score, idx in scored_results if score >= 0.20][:top_k]

    # Build SearchResult objects
    results = []
    for score, idx in top_results:
        s = sentences[idx]
        results.append(SearchResult(
            text=s.text,
            start=s.start,
            end=s.end,
            speaker=s.speaker,
            score=round(float(score), 3),
        ))

    return results
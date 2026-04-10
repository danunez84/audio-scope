"""
Audio Insight — Summarizer
Generates extractive summaries for each topic using sentence embeddings.
"""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.embeddings import model as _embedding_model
from app.segmenter import Topic


def summarize_topic(sentences: list[str], num_sentences: int = 2, redundancy_threshold: float = 0.8) -> str:
    """
    Picks the most representative sentences from a topic.
    Skips sentences that are too similar to already-selected ones.
    Returns the summary as a single string.
    """
    # If the topic is short enough, return all sentences as the summary
    if len(sentences) <= num_sentences:
        return " ".join(sentences)

    # Embed all sentences
    embeddings = _embedding_model.encode(sentences)

    # Compute centroid (average meaning of the topic)
    centroid = np.mean(embeddings, axis=0).reshape(1, -1)

    # Score each sentence by similarity to centroid
    scores = []
    for emb in embeddings:
        score = cosine_similarity(emb.reshape(1, -1), centroid)[0][0]
        scores.append(score)

    # Sort by score (highest first)
    ranked_indices = np.argsort(scores)[::-1]

    # Pick top sentences, skipping redundant ones
    selected = []
    selected_embeddings = []

    for idx in ranked_indices:
        if len(selected) >= num_sentences:
            break

        # Check if this sentence is too similar to one already selected
        is_redundant = False
        for sel_emb in selected_embeddings:
            sim = cosine_similarity(
                embeddings[idx].reshape(1, -1),
                sel_emb.reshape(1, -1)
            )[0][0]
            if sim > redundancy_threshold:
                is_redundant = True
                break

        if not is_redundant:
            selected.append(idx)
            selected_embeddings.append(embeddings[idx])

    # Return sentences in original order as a single string
    selected.sort()
    return " ".join(sentences[i] for i in selected)


def summarize_topics(topics: list[Topic]) -> list[str]:
    """
    Generates a summary for each topic.
    Returns a list of summary strings, one per topic.
    """
    summaries = []

    for topic in topics:
        # Extract the text from each sentence in the topic
        sentences = [s.text for s in topic.sentences]

        # Generate the summary
        summary = summarize_topic(sentences)
        summaries.append(summary)

    return summaries
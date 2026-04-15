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
            if len(sentences) == 1:
                return sentences[0]
            # For 2 sentences, pick the most representative one
            embeddings = _embedding_model.encode(sentences)
            centroid = np.mean(embeddings, axis=0).reshape(1, -1)
            scores = [
                cosine_similarity(emb.reshape(1, -1), centroid)[0][0]
                for emb in embeddings
            ]
            best_idx = int(np.argmax(scores))
            return sentences[best_idx]

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


def summarize_topics(topics: list[Topic]) -> tuple[list[str], list[str]]:
    """
    Generates a summary and title for each topic.
    Returns (summaries, titles) — two lists in the same order as topics.
    """
    summaries = []
    titles = []

    # Build full text for each topic (needed for TF-IDF comparison)
    all_topics_text = [
        " ".join(s.text for s in topic.sentences)
        for topic in topics
    ]

    for topic in topics:
        sentences = [s.text for s in topic.sentences]
        summary = summarize_topic(sentences)
        title = generate_topic_title(sentences, all_topics_text)
        summaries.append(summary)
        titles.append(title)

    return summaries, titles



def generate_topic_title(sentences: list[str], all_topics_text: list[str], max_words: int = 6) -> str:
    """
    Generates a short title for a topic using TF-IDF to find key terms,
    then extracts a phrase from the most representative sentence.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer

    topic_text = " ".join(sentences)

    # TF-IDF across all topics to find what makes this topic unique
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(all_topics_text)
    feature_names = vectorizer.get_feature_names_out()

    # Find this topic's index
    topic_idx = all_topics_text.index(topic_text)
    scores = tfidf_matrix[topic_idx].toarray()[0]

    # Get top keywords for this topic
    top_indices = scores.argsort()[-5:][::-1]
    keywords = set(feature_names[idx] for idx in top_indices)

    # Score each sentence by how many keywords it contains
    best_sentence = sentences[0]
    best_count = 0
    for sentence in sentences:
        count = sum(1 for word in sentence.lower().split() if word.strip(".,!?") in keywords)
        if count > best_count:
            best_count = count
            best_sentence = sentence

    # Truncate to max_words
    words = best_sentence.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]) + "..."
    return best_sentence
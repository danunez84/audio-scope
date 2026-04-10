"""
Audio Insight — Topic Segmenter
Splits transcripts into topics using sentence embeddings and cosine similarity.
"""

import numpy as np
from dataclasses import dataclass, field
from nltk.tokenize import sent_tokenize
from app.embeddings import model as _embedding_model
from sklearn.metrics.pairwise import cosine_similarity


# --- Data Structures ---

@dataclass
class Sentence:
    """A single sentence extracted from a transcript segment."""
    text: str
    start: float
    end: float
    speaker: int | None


@dataclass
class Topic:
    """A group of related sentences identified by the segmenter."""
    start: float
    end: float
    sentences: list[Sentence] = field(default_factory=list)
    speakers: list[int] = field(default_factory=list)


# --- Functions ---

def split_into_sentences(segments: list) -> list[Sentence]:
    """
    Takes VibeVoice segments (speaker turns) and splits them
    into individual sentences with estimated timestamps.
    """
    sentences = []

    for seg in segments:
        # Skip non-speech segments like [Music] or [Unintelligible Speech]
        if seg.content.startswith("["):
            continue

        # Split the segment's content into individual sentences
        split = sent_tokenize(seg.content)

        # Estimate timestamps — spread evenly across the segment
        seg_duration = seg.end - seg.start
        time_per_sentence = seg_duration / len(split) if split else 0

        for i, text in enumerate(split):
            sentences.append(Sentence(
                text=text,
                start=round(seg.start + (i * time_per_sentence), 2),
                end=round(seg.start + ((i + 1) * time_per_sentence), 2),
                speaker=seg.speaker,
            ))

    return sentences


def find_topic_boundaries(sentences: list[Sentence], percentile: int = 15) -> list[int]:
    """
    Finds where topics change by comparing consecutive sentence embeddings.
    Returns a list of indices where new topics start.
    """
    # Need at least 2 sentences to find boundaries
    if len(sentences) < 2:
        return []

    # Step 2: Embed each sentence into a 384-dim vector
    texts = [s.text for s in sentences]
    embeddings = _embedding_model.encode(texts)

    # Step 3: Cosine similarity between consecutive sentences
    similarities = []
    for i in range(len(embeddings) - 1):
        current = embeddings[i].reshape(1, -1)
        next_one = embeddings[i + 1].reshape(1, -1)
        similarity_matrix = cosine_similarity(current, next_one)
        score = similarity_matrix[0][0]
        similarities.append(score)

    # Step 4: Percentile-based boundary detection
    cutoff = np.percentile(similarities, percentile)
    boundaries = [i + 1 for i, score in enumerate(similarities) if score < cutoff]

    return boundaries


def build_topic(sentences: list[Sentence]) -> Topic:
    """
    Creates a Topic from a list of sentences.
    Extracts the time range and unique speakers.
    """
    speakers = list(set(
        s.speaker for s in sentences if s.speaker is not None
    ))

    return Topic(
        start=sentences[0].start,
        end=sentences[-1].end,
        sentences=sentences,
        speakers=sorted(speakers),
    )


def segment_into_topics(segments: list, percentile: int = 15) -> list[Topic]:
    """
    Main function — takes transcription segments and returns topics.

    1. Split segments into sentences
    2. Find topic boundaries using embeddings
    3. Group sentences into topics
    """
    # Step 1: Split into sentences
    sentences = split_into_sentences(segments)

    if not sentences:
        return []

    # Steps 2-4: Find where topics change
    boundaries = find_topic_boundaries(sentences, percentile)

    # Step 5: Group sentences between boundaries into topics
    topics = []
    start_idx = 0

    for boundary in boundaries:
        topic_sentences = sentences[start_idx:boundary]
        topics.append(build_topic(topic_sentences))
        start_idx = boundary

    # Don't forget the last topic (after the final boundary)
    topic_sentences = sentences[start_idx:]
    topics.append(build_topic(topic_sentences))

    return topics
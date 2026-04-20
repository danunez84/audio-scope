"""
Audio Insight — FastAPI Application
Main entry point for the backend API.
"""

import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.cache import (
    get_cached_result, save_to_cache, save_sentences,
    load_sentences, get_library, get_video_id, CACHE_DIR
)
from app.config import CORS_ORIGINS
from app.models import AnalyzeRequest, DownloadResponse, ErrorResponse, HealthResponse
from app.downloader import download_audio, cleanup_audio
from app.transcriber import transcribe_audio, check_colab_health
from app.segmenter import segment_into_topics, split_into_sentences, Sentence
from app.summarizer import summarize_topics
from app.search import search_sentences


# --- App Setup ---

app = FastAPI(
    title="Audio Insight API",
    description="Transcribe, segment, summarize, and search audio content.",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helper Functions ---

def build_segments_response(segments: list) -> list[dict]:
    """Converts Segment objects into JSON-serializable dictionaries."""
    return [
        {
            "start": seg.start,
            "end": seg.end,
            "speaker": seg.speaker,
            "content": seg.content,
        }
        for seg in segments
    ]


def build_topics_response(topics: list, summaries: list[str] = None, titles: list[str] = None) -> list[dict]:
    """Converts Topic objects into JSON-serializable dictionaries."""
    return [
        {
            "topic_number": i + 1,
            "title": titles[i] if titles else f"Topic {i + 1}",
            "start": topic.start,
            "end": topic.end,
            "speakers": topic.speakers,
            "summary": summaries[i] if summaries else "",
            "sentences": [
                {"text": s.text, "start": s.start, "end": s.end, "speaker": s.speaker}
                for s in topic.sentences
            ],
        }
        for i, topic in enumerate(topics)
    ]


# --- Endpoints ---

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check — also checks if Colab transcription API is reachable."""
    colab_status = "connected" if check_colab_health() else "disconnected"
    return HealthResponse(status="ok", version="0.4.0")


@app.post(
    "/download",
    response_model=DownloadResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def download_audio_endpoint(request: AnalyzeRequest):
    """Downloads audio from the given URL."""
    result = download_audio(request.url)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    file_id = result.file_path.stem if result.file_path else ""

    return DownloadResponse(
        status="downloaded",
        title=result.title,
        duration=result.duration,
        file_id=file_id,
    )


@app.post(
    "/analyze",
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def analyze_audio(request: AnalyzeRequest):
    """Full pipeline: download → transcribe → segment → summarize → index."""
    try:
        global _current_sentences

        # Check cache first
        cached = get_cached_result(request.url)
        if cached:
            print(f"[CACHE] Returning cached result for: {request.url}")
            # Load sentences for search
            video_id = get_video_id(request.url)
            if video_id:
                sentences_data = load_sentences(video_id)
                if sentences_data:
                    _current_sentences = [
                        Sentence(text=s["text"], start=s["start"], end=s["end"], speaker=s["speaker"])
                        for s in sentences_data
                    ]
                    print(f"[CACHE] Loaded {len(_current_sentences)} sentences for search")
            return cached

        # Step 1: Download audio
        print(f"[STEP 1] Downloading audio from: {request.url}")
        download_result = download_audio(request.url)

        if not download_result.success:
            print(f"[STEP 1] Download failed: {download_result.error}")
            raise HTTPException(status_code=400, detail=download_result.error)

        file_id = download_result.file_path.stem if download_result.file_path else ""
        print(f"[STEP 1] Download complete: {download_result.title} ({download_result.duration}s)")

        if download_result.duration > 3600:
            raise HTTPException(
                status_code=400,
                detail=f"Audio is too long ({int(download_result.duration / 60)} minutes). Maximum is 60 minutes."
            )

        # Step 2: Transcribe via Colab API
        print(f"[STEP 2] Sending file to Colab for transcription")
        print(f"[STEP 2] File path: {download_result.file_path}, exists: {download_result.file_path.exists()}")
        transcription_result = transcribe_audio(str(download_result.file_path))
        print(f"[STEP 2] Transcription result — success: {transcription_result.success}, error: {transcription_result.error}")

        if not transcription_result.success:
            if download_result.file_path:
                cleanup_audio(download_result.file_path)
            raise HTTPException(status_code=500, detail=transcription_result.error)

        print(f"[STEP 2] Transcription complete in {transcription_result.processing_time}s")

        # Step 3: Topic segmentation
        print(f"[STEP 3] Segmenting into topics...")
        topics = segment_into_topics(transcription_result.segments)
        print(f"[STEP 3] Found {len(topics)} topics")

        # Step 4: Summarization
        print(f"[STEP 4] Generating summaries...")
        summaries, titles = summarize_topics(topics)
        print(f"[STEP 4] Generated {len(summaries)} summaries")

        # Step 5: Prepare sentences for search
        print(f"[STEP 5] Building search index...")
        all_sentences = split_into_sentences(transcription_result.segments)
        print(f"[STEP 5] Indexed {len(all_sentences)} sentences")

        # Store for current session search
        _current_sentences = all_sentences

        # Build response data
        segments_data = build_segments_response(transcription_result.segments)
        topics_data = build_topics_response(topics, summaries, titles)

        print(f"[DONE] Returning {len(segments_data)} segments, {len(topics_data)} topics")

        result = {
            "status": "completed",
            "file_id": file_id,
            "title": download_result.title,
            "duration": download_result.duration,
            "transcription": {
                "full_text": transcription_result.full_text,
                "segments": segments_data,
                "processing_time": transcription_result.processing_time,
            },
            "topics": topics_data,
            "steps": {
                "download": "done",
                "transcription": "done",
                "segmentation": "done",
                "summarization": "done",
                "indexing": "done",
            },
        }

        # Save to cache
        save_to_cache(request.url, result)
        save_sentences(request.url, all_sentences)
        print(f"[CACHE] Saved result and sentences to cache")

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Unexpected error in /analyze: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Store the latest sentences for search
_current_sentences = []


@app.post("/search")
async def search_audio(request: dict):
    """
    Searches transcripts by meaning.
    Can search current session or across multiple cached audios.
    """
    query = request.get("query", "")
    video_ids = request.get("video_ids", [])

    if not query.strip():
        raise HTTPException(status_code=400, detail="Query is required.")

    all_results = []

    if video_ids:
        # Search across selected cached audios
        for vid in video_ids:
            sentences_data = load_sentences(vid)
            if not sentences_data:
                continue

            sentences = [
                Sentence(text=s["text"], start=s["start"], end=s["end"], speaker=s["speaker"])
                for s in sentences_data
            ]

            results = search_sentences(query, sentences)

            # Load title from cache
            cache_file = CACHE_DIR / f"{vid}.json"
            title = "Unknown"
            if cache_file.exists():
                with open(cache_file) as f:
                    title = json.load(f).get("title", "Unknown")

            for r in results:
                all_results.append({
                    "video_id": vid,
                    "title": title,
                    "text": r.text,
                    "start": r.start,
                    "end": r.end,
                    "speaker": r.speaker,
                    "score": r.score,
                })
    elif _current_sentences:
        # Search current session
        results = search_sentences(query, _current_sentences)
        for r in results:
            all_results.append({
                "text": r.text,
                "start": r.start,
                "end": r.end,
                "speaker": r.speaker,
                "score": r.score,
            })
    else:
        raise HTTPException(status_code=400, detail="No transcript loaded. Run /analyze first.")

    # Sort by score across all audios
    all_results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "query": query,
        "results": all_results[:10],
    }


@app.get("/library")
async def get_audio_library():
    """Returns list of all previously analyzed audios."""
    return {"library": get_library()}
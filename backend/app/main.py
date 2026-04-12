"""
Audio Insight — FastAPI Application
Main entry point for the backend API.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.models import AnalyzeRequest, DownloadResponse, ErrorResponse, HealthResponse
from app.downloader import download_audio, cleanup_audio
from app.transcriber import transcribe_audio, check_colab_health
from app.segmenter import segment_into_topics
from app.summarizer import summarize_topics


# --- App Setup ---

app = FastAPI(
    title="Audio Insight API",
    description="Transcribe, segment, summarize, and search audio content.",
    version="0.3.0",
)

# CORS — allow Chrome extension and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for dev; tighten for production
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
    return HealthResponse(status="ok", version="0.3.0")


@app.post(
    "/download",
    response_model=DownloadResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def download_audio_endpoint(request: AnalyzeRequest):
    """
    Downloads audio from the given URL.
    Returns metadata about the downloaded file.
    """
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
    """
    Full pipeline: download → transcribe → segment → summarize → index.
    """
    try:
        # Step 1: Download audio
        print(f"[STEP 1] Downloading audio from: {request.url}")
        download_result = download_audio(request.url)

        if not download_result.success:
            print(f"[STEP 1] Download failed: {download_result.error}")
            raise HTTPException(status_code=400, detail=download_result.error)

        file_id = download_result.file_path.stem if download_result.file_path else ""
        print(f"[STEP 1] Download complete: {download_result.title} ({download_result.duration}s)")

        # Step 2: Transcribe via Colab API
        print(f"[STEP 2] Sending to Colab for transcription: {request.url}")
        transcription_result = transcribe_audio(request.url)
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

        # Build response data
        segments_data = build_segments_response(transcription_result.segments)
        topics_data = build_topics_response(topics, summaries, titles)

        print(f"[DONE] Returning {len(segments_data)} segments, {len(topics_data)} topics")

        # TODO: Step 5 — Build search index

        return {
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
                "indexing": "pending",
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Unexpected error in /analyze: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
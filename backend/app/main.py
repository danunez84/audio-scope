"""
Audio Insight — FastAPI Application
Main entry point for the backend API.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.models import AnalyzeRequest, DownloadResponse, ErrorResponse, HealthResponse
from app.downloader import download_audio, cleanup_audio


# --- App Setup ---

app = FastAPI(
    title="Audio Insight API",
    description="Transcribe, segment, summarize, and search audio content.",
    version="0.2.0",
)

# CORS — allow Chrome extension and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for dev; tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Endpoints ---

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok", version="0.2.0")


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

    # Extract file ID from the path
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
    Currently only implements the download step.
    """
    # Step 1: Download audio
    result = download_audio(request.url)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    file_id = result.file_path.stem if result.file_path else ""

    # TODO: Step 2 — Transcription (Whisper)
    # TODO: Step 3 — Topic segmentation
    # TODO: Step 4 — Summarization
    # TODO: Step 5 — Build search index

    return {
        "status": "completed",
        "file_id": file_id,
        "title": result.title,
        "duration": result.duration,
        "steps": {
            "download": "done",
            "transcription": "pending",
            "segmentation": "pending",
            "summarization": "pending",
            "indexing": "pending",
        },
    }

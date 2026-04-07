"""
Audio Insight — Transcriber
Calls the VibeVoice-ASR API running on Google Colab for transcription.
"""

import requests
from dataclasses import dataclass, field

from app.config import TRANSCRIPTION_API_URL


@dataclass
class Segment:
    """A single transcribed segment with speaker and timing info."""
    start: float
    end: float
    speaker: int | None
    content: str


@dataclass
class TranscriptionResult:
    """Result of transcribing an audio file."""
    success: bool
    segments: list[Segment] = field(default_factory=list)
    full_text: str = ""
    processing_time: float = 0.0
    error: str = ""


def check_colab_health() -> bool:
    """
    Checks if the Colab transcription API is reachable.
    Returns True if healthy, False otherwise.
    """
    try:
        response = requests.get(
            f"{TRANSCRIPTION_API_URL}/health",
            timeout=10,
        )
        return response.status_code == 200
    except requests.RequestException:
        return False


def transcribe_audio(audio_url: str, context: str = None) -> TranscriptionResult:
    """
    Sends an audio URL to the Colab API for transcription.

    Args:
        audio_url: Public URL of the audio file to transcribe.
        context: Optional context/hints to improve accuracy
                 (e.g. names, technical terms).

    Returns:
        TranscriptionResult with segments, full text, or error info.
    """
    # Build the request body
    payload = {"audio_url": audio_url}
    if context:
        payload["context"] = context

    try:
        # Send to Colab API — long timeout since transcription can take minutes
        response = requests.post(
            f"{TRANSCRIPTION_API_URL}/transcribe",
            json=payload,
            timeout=600,  # 10 minute timeout for long audio
        )

        if response.status_code != 200:
            error_data = response.json()
            return TranscriptionResult(
                success=False,
                error=error_data.get("error", "Transcription failed"),
            )

        data = response.json()

        # Parse segments from the Colab response
        segments = []
        for seg in data.get("segments", []):
            segments.append(Segment(
                start=seg.get("Start", 0.0),
                end=seg.get("End", 0.0),
                speaker=seg.get("Speaker", None),
                content=seg.get("Content", ""),
            ))

        return TranscriptionResult(
            success=True,
            segments=segments,
            full_text=data.get("full_text", ""),
            processing_time=data.get("processing_time", 0.0),
        )

    except requests.Timeout:
        return TranscriptionResult(
            success=False,
            error="Transcription timed out. The audio may be too long.",
        )
    except requests.ConnectionError:
        return TranscriptionResult(
            success=False,
            error="Cannot reach the Colab API. Is the notebook running?",
        )
    except Exception as e:
        return TranscriptionResult(
            success=False,
            error=f"Unexpected error: {str(e)}",
        )
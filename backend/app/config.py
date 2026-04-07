"""
Audio Insight — Configuration
Centralized settings for the backend.
"""

from pathlib import Path


# --- Paths ---
BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = BASE_DIR / "downloads"

# Create downloads directory if it doesn't exist
DOWNLOAD_DIR.mkdir(exist_ok=True)


# --- Audio Download ---
AUDIO_FORMAT = "mp3"
MAX_AUDIO_DURATION = 3600  # 1 hour max (in seconds)


# --- Transcription (Colab) ---
# The ngrok URL from the Colab notebook running VibeVoice-ASR.
# Update this each time you restart the Colab notebook.
TRANSCRIPTION_API_URL = "https://untransported-unfeasibly-dora.ngrok-free.dev"


# --- API ---
API_HOST = "0.0.0.0"
API_PORT = 8000
CORS_ORIGINS = [
    "chrome-extension://*",
    "http://localhost:*",
]
# Audio Insight — Backend

FastAPI backend for the Audio Insight pipeline: audio download, transcription, topic segmentation, summarization, and semantic search.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI app + endpoints
│   ├── config.py          # Centralized settings
│   ├── models.py          # Pydantic request/response schemas
│   └── downloader.py      # Audio download via yt-dlp
├── downloads/             # Temp audio files (git-ignored)
├── requirements.txt
└── README.md
```

## Setup

### Prerequisites
- Python 3.10+
- yt-dlp (`pip install yt-dlp` or `brew install yt-dlp`)
- ffmpeg (`brew install ffmpeg` on macOS)

### Install & Run

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Test the API

```bash
# Health check
curl http://localhost:8000/health

# Download audio from YouTube
curl -X POST http://localhost:8000/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"}'

# Full pipeline (currently download only)
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"}'
```

### API Docs

Once running, visit: http://localhost:8000/docs

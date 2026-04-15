"""
Audio Insight — Cache
Stores analysis results on disk as JSON files.
"""

import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Cache directory
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def get_video_id(url: str) -> str | None:
    """Extracts YouTube video ID from a URL."""
    try:
        parsed = urlparse(url)
        if parsed.hostname in ("www.youtube.com", "youtube.com"):
            return parse_qs(parsed.query).get("v", [None])[0]
        if parsed.hostname == "youtu.be":
            return parsed.path.lstrip("/")
    except Exception:
        pass
    return None


def get_cached_result(url: str) -> dict | None:
    """Returns cached result for a URL, or None if not cached."""
    video_id = get_video_id(url)
    if not video_id:
        return None

    cache_file = CACHE_DIR / f"{video_id}.json"
    if not cache_file.exists():
        return None

    with open(cache_file, "r") as f:
        return json.load(f)


def save_to_cache(url: str, result: dict) -> None:
    """Saves an analysis result to the cache."""
    video_id = get_video_id(url)
    if not video_id:
        return

    cache_file = CACHE_DIR / f"{video_id}.json"
    with open(cache_file, "w") as f:
        json.dump(result, f)
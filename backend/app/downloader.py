"""
Audio Insight — Audio Downloader
Downloads audio from URLs using yt-dlp Python API.
"""
 
import uuid
from pathlib import Path
from dataclasses import dataclass
 
import yt_dlp
 
from app.config import DOWNLOAD_DIR, AUDIO_FORMAT, MAX_AUDIO_DURATION
 
 
@dataclass
class DownloadResult:
    """Result of an audio download operation."""
    success: bool
    file_path: Path | None = None
    title: str = ""
    duration: float = 0.0
    error: str = ""
 
 
def download_audio(url: str) -> DownloadResult:
    """
    Downloads audio from the given URL using yt-dlp.
 
    Args:
        url: The URL to download audio from (YouTube, direct audio, etc.)
 
    Returns:
        DownloadResult with the file path, metadata, or error info.
    """
    file_id = uuid.uuid4().hex[:10]
    output_template = str(DOWNLOAD_DIR / f"{file_id}.%(ext)s")
    expected_path = DOWNLOAD_DIR / f"{file_id}.{AUDIO_FORMAT}"
 
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "continuedl": False,
        "nopart": True,
        "match_filter": yt_dlp.utils.match_filter_func(
            f"duration<={MAX_AUDIO_DURATION}"
        ),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": AUDIO_FORMAT,
            "preferredquality": "192",
        }],
    }
 
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
 
            if info is None:
                return DownloadResult(
                    success=False,
                    error="Could not extract info from URL."
                )
 
            title = info.get("title", "Unknown")
            duration = float(info.get("duration", 0))
 
            # Verify the file was created
            if not expected_path.exists():
                return DownloadResult(
                    success=False,
                    error="Download completed but audio file not found."
                )
 
            return DownloadResult(
                success=True,
                file_path=expected_path,
                title=title,
                duration=duration,
            )
 
    except yt_dlp.utils.DownloadError as e:
        return DownloadResult(
            success=False,
            error=f"Download failed: {str(e)}"
        )
    except Exception as e:
        return DownloadResult(
            success=False,
            error=f"Unexpected error: {str(e)}"
        )
 
 
def cleanup_audio(file_path: Path) -> None:
    """Removes a downloaded audio file."""
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError:
        pass
 
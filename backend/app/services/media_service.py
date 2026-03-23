"""
Media Service — handles video/audio upload, storage, and audio extraction.
Uses local filesystem storage for development.
"""
import os
import uuid
import subprocess
from pathlib import Path
from fastapi import UploadFile

from app.core.config import settings

# Local storage directory
MEDIA_DIR = Path(settings.MEDIA_STORAGE_PATH if hasattr(settings, 'MEDIA_STORAGE_PATH') else "media_uploads")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


async def save_upload(file: UploadFile, session_id: int, media_type: str) -> str:
    """
    Save an uploaded file (video or audio) to local storage.
    Returns the file path.
    """
    ext = ".webm" if media_type == "video" else ".wav"
    filename = f"session_{session_id}_{media_type}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = MEDIA_DIR / filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return str(file_path)


def extract_audio(video_path: str) -> str:
    """
    Extract audio track from a video file using ffmpeg.
    Returns path to the extracted WAV file.
    """
    audio_path = video_path.rsplit(".", 1)[0] + "_audio.wav"

    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vn",                    # no video
                "-acodec", "pcm_s16le",   # PCM 16-bit
                "-ar", "16000",           # 16kHz sample rate (required by Whisper)
                "-ac", "1",               # mono
                audio_path
            ],
            capture_output=True,
            check=True,
            timeout=120
        )
    except FileNotFoundError:
        raise RuntimeError("ffmpeg not found. Install ffmpeg: brew install ffmpeg")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed: {e.stderr.decode()}")

    return audio_path


def get_media_path(session_id: int, media_type: str) -> str | None:
    """Find the media file for a given session."""
    prefix = f"session_{session_id}_{media_type}_"
    for f in MEDIA_DIR.iterdir():
        if f.name.startswith(prefix):
            return str(f)
    return None

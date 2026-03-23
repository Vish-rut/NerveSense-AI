"""
Audio transcription using faster-whisper.
Produces per-segment transcripts with timestamps.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-load the model to avoid heavy startup costs
_model = None


def _get_model():
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            # Use 'tiny' model for speed on CPU; upgrade to 'base' or 'small' for accuracy
            _model = WhisperModel("tiny", device="cpu", compute_type="int8")
            logger.info("Whisper model loaded (tiny, cpu, int8)")
        except ImportError:
            logger.warning("faster-whisper not installed. Transcription will use fallback.")
            _model = "FALLBACK"
    return _model


def transcribe(audio_path: str) -> dict:
    """
    Transcribe an audio file using Whisper.
    Returns:
        {
            "full_text": str,
            "segments": [{"start": float, "end": float, "text": str}, ...],
            "language": str,
            "duration_seconds": float
        }
    """
    model = _get_model()

    if model == "FALLBACK":
        logger.warning("Using fallback (empty) transcription")
        return {
            "full_text": "",
            "segments": [],
            "language": "en",
            "duration_seconds": 0.0
        }

    try:
        segments_gen, info = model.transcribe(
            audio_path,
            beam_size=5,
            language="en",
            vad_filter=True  # filter silent sections
        )

        segments = []
        full_text_parts = []
        for seg in segments_gen:
            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip()
            })
            full_text_parts.append(seg.text.strip())

        return {
            "full_text": " ".join(full_text_parts),
            "segments": segments,
            "language": info.language,
            "duration_seconds": round(info.duration, 2)
        }

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return {
            "full_text": "",
            "segments": [],
            "language": "en",
            "duration_seconds": 0.0
        }

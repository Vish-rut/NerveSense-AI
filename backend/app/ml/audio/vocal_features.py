"""
Vocal feature extraction from transcription segments.
Computes WPM, filler words, pause ratios, and pace timelines.
"""
import re
from typing import Optional

# Common filler words to detect
FILLER_WORDS = {
    "um", "uh", "uhh", "umm", "erm", "err",
    "like", "you know", "basically", "actually",
    "so", "well", "i mean", "right", "okay",
    "sort of", "kind of", "literally"
}

# Single-word fillers for fast token matching
SINGLE_FILLERS = {w for w in FILLER_WORDS if " " not in w}
# Multi-word fillers for phrase matching
MULTI_FILLERS = {w for w in FILLER_WORDS if " " in w}


def extract_vocal_features(transcript: dict) -> dict:
    """
    Extract vocal features from a transcription result.

    Args:
        transcript: Output from transcription.transcribe()

    Returns:
        {
            "avg_wpm": float,
            "total_words": int,
            "total_filler_count": int,
            "filler_details": {"um": 3, "like": 5, ...},
            "filler_frequency": float,    # fillers per minute
            "pause_ratio": float,         # fraction of time in silence
            "pace_timeline": [            # WPM per 30-second window
                {"window_start": 0, "window_end": 30, "wpm": 140},
                ...
            ],
            "duration_seconds": float
        }
    """
    segments = transcript.get("segments", [])
    duration = transcript.get("duration_seconds", 0.0)
    full_text = transcript.get("full_text", "")

    if not segments or duration == 0:
        return _empty_features()

    # --- Word count and WPM ---
    total_words = len(full_text.split())
    duration_minutes = duration / 60.0
    avg_wpm = round(total_words / duration_minutes, 1) if duration_minutes > 0 else 0.0

    # --- Filler word detection ---
    filler_details = {}
    text_lower = full_text.lower()

    # Count multi-word fillers first
    for filler in MULTI_FILLERS:
        count = text_lower.count(filler)
        if count > 0:
            filler_details[filler] = count

    # Count single-word fillers
    words = re.findall(r'\b\w+\b', text_lower)
    for word in words:
        if word in SINGLE_FILLERS:
            filler_details[word] = filler_details.get(word, 0) + 1

    total_filler_count = sum(filler_details.values())
    filler_frequency = round(total_filler_count / duration_minutes, 2) if duration_minutes > 0 else 0.0

    # --- Pause ratio ---
    # Time spent speaking vs total duration
    speaking_time = sum(seg["end"] - seg["start"] for seg in segments)
    pause_ratio = round(1.0 - (speaking_time / duration), 3) if duration > 0 else 0.0
    pause_ratio = max(0.0, min(1.0, pause_ratio))

    # --- Pace timeline (WPM per 30-second window) ---
    window_size = 30  # seconds
    pace_timeline = []
    for window_start in range(0, int(duration), window_size):
        window_end = min(window_start + window_size, duration)
        window_words = 0
        for seg in segments:
            # Check if segment overlaps with this window
            overlap_start = max(seg["start"], window_start)
            overlap_end = min(seg["end"], window_end)
            if overlap_start < overlap_end:
                # Proportional word count based on overlap
                seg_duration = seg["end"] - seg["start"]
                if seg_duration > 0:
                    overlap_fraction = (overlap_end - overlap_start) / seg_duration
                    seg_words = len(seg["text"].split())
                    window_words += int(seg_words * overlap_fraction)

        window_minutes = (window_end - window_start) / 60.0
        window_wpm = round(window_words / window_minutes, 1) if window_minutes > 0 else 0.0
        pace_timeline.append({
            "window_start": window_start,
            "window_end": round(window_end, 1),
            "wpm": window_wpm
        })

    return {
        "avg_wpm": avg_wpm,
        "total_words": total_words,
        "total_filler_count": total_filler_count,
        "filler_details": filler_details,
        "filler_frequency": filler_frequency,
        "pause_ratio": pause_ratio,
        "pace_timeline": pace_timeline,
        "duration_seconds": duration
    }


def _empty_features() -> dict:
    return {
        "avg_wpm": 0.0,
        "total_words": 0,
        "total_filler_count": 0,
        "filler_details": {},
        "filler_frequency": 0.0,
        "pause_ratio": 0.0,
        "pace_timeline": [],
        "duration_seconds": 0.0
    }

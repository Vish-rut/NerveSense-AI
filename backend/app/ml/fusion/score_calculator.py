"""
Score calculator — multimodal fusion engine.
Aggregates facial, vocal, and behavioral nervousness scores
using weighted fusion (facial 35%, vocal 30%, behavioral 35%)
as specified in the NerveSenseAI implementation guide.

Produces normalized scores (0–100) with smoothing.
"""


def calculate_scores(vocal: dict, video: dict) -> dict:
    """
    Compute overall scores from raw vocal and video features using
    the multimodal weighted fusion model.

    Weights: facial 35%, vocal 30%, behavioral 35%
    overall_nervousness = weighted total of category nervousness scores
    confidence_score = inverse (100 - nervousness)

    Returns:
        {
            "overall_confidence_score": float (0-100),
            "overall_nervousness_score": float (0-100),
            "facial_score": float (0-100, higher = better/less nervous),
            "vocal_score": float (0-100, higher = better/less nervous),
            "behavioral_score": float (0-100, higher = better/less nervous),
            "component_details": { ... }
        }
    """
    # === FACIAL NERVOUSNESS (0-100, 0 = calm, 100 = very nervous) ===
    # Inputs: low eye contact, unstable gaze, high blink rate,
    #         high head instability, elevated tension proxies
    eye_contact = video.get("eye_contact_score", 0)  # 0-100
    gaze_stability = video.get("gaze_stability", 0.5) * 100  # 0-1 → 0-100
    head_stability = video.get("head_stability_score", 50)  # 0-100
    smile = video.get("smile_ratio", 0) * 100  # 0-1 → 0-100
    blink_rate = video.get("blink_rate", 18)  # blinks per minute
    brow_tension = video.get("brow_tension", 0) * 100  # 0-1 → 0-100
    jaw_tension = video.get("jaw_tension", 0) * 100   # 0-1 → 0-100

    # Eye contact nervousness: 0% contact → 100 nervousness, 100% → 0
    eye_nerv = max(0, 100 - eye_contact)

    # Gaze instability: low stability → high nervousness
    gaze_nerv = max(0, 100 - gaze_stability)

    # Blink rate nervousness: normal 15-20/min, >25 = nervous, >35 = very nervous
    if blink_rate <= 20:
        blink_nerv = 0.0
    elif blink_rate <= 30:
        blink_nerv = (blink_rate - 20) * 5  # 0-50
    else:
        blink_nerv = min(100, 50 + (blink_rate - 30) * 5)  # 50-100

    # Head instability
    head_nerv = max(0, 100 - head_stability)

    # Tension proxies
    brow_nerv = min(100, brow_tension)
    jaw_nerv = min(100, jaw_tension)

    # Smile reduces nervousness appearance
    smile_calm = min(30, smile * 0.3)  # up to 30 points reduction

    # Weighted facial nervousness
    facial_nervousness = _clamp(
        eye_nerv * 0.25 +
        gaze_nerv * 0.15 +
        blink_nerv * 0.15 +
        head_nerv * 0.20 +
        brow_nerv * 0.10 +
        jaw_nerv * 0.10 +
        5 -  # baseline small amount
        smile_calm * 0.05
    )
    facial_score = _clamp(100 - facial_nervousness)  # higher = better

    # === VOCAL NERVOUSNESS (0-100) ===
    # Inputs: filler words, abnormal speaking pace, long pauses,
    #         hesitation patterns, frequent restarts
    wpm = vocal.get("avg_wpm", 0)
    filler_freq = vocal.get("filler_frequency", 0)
    total_fillers = vocal.get("total_filler_count", 0)
    pause_ratio = vocal.get("pause_ratio", 0)
    speech_ratio = vocal.get("speech_ratio", 0.5)

    # WPM nervousness: normal 120-160, extremes signal nervousness
    if 120 <= wpm <= 160:
        wpm_nerv = 0.0
    elif wpm > 160:
        wpm_nerv = min(60, (wpm - 160) * 1.0)  # speaking too fast
    elif wpm > 0:
        wpm_nerv = min(40, (120 - wpm) * 0.5)  # speaking too slow
    else:
        wpm_nerv = 0.0  # no speech data — no fabricated nervousness

    # Filler word nervousness: 0/min = 0, 5+/min = nervous, 10+ = very nervous
    if filler_freq > 0:
        filler_nerv = min(100, filler_freq * 10)
    else:
        # Fall back to total count as proportion indicator
        filler_nerv = min(60, total_fillers * 3)

    # Pause ratio nervousness: 0.1-0.3 normal, >0.4 = excessive pausing
    if pause_ratio <= 0.3:
        pause_nerv = 0.0
    else:
        pause_nerv = min(60, (pause_ratio - 0.3) * 200)

    # Low speech ratio means lots of silence
    silence_nerv = max(0, (1 - speech_ratio) * 30) if speech_ratio < 0.6 else 0

    vocal_nervousness = _clamp(
        wpm_nerv * 0.30 +
        filler_nerv * 0.35 +
        pause_nerv * 0.20 +
        silence_nerv * 0.15
    )
    vocal_score = _clamp(100 - vocal_nervousness)

    # === BEHAVIORAL NERVOUSNESS (0-100) ===
    # Inputs: posture shifts, self-touch events, fidget level, body instability
    posture_shifts = video.get("posture_shift_count", 0)
    self_touch = video.get("self_touch_count", 0)
    fidget_score_raw = video.get("fidget_score", 0)  # 0-100
    body_motion_var = video.get("body_motion_variance", 0)
    duration_min = max(video.get("duration_seconds", 0) / 60.0, 0.5)

    # Posture shifts per minute: 0-1 = calm, 3+ = nervous, 5+ = very nervous
    shifts_per_min = posture_shifts / duration_min if duration_min > 0 else posture_shifts
    posture_nerv = min(100, shifts_per_min * 15)

    # Self-touch per minute: 0 = calm, 3+ = nervous
    touch_per_min = self_touch / duration_min if duration_min > 0 else self_touch
    touch_nerv = min(100, touch_per_min * 12)

    # Fidget score directly
    fidget_nerv = min(100, fidget_score_raw)

    # Body motion variance
    body_nerv = min(50, body_motion_var * 20000)

    behavioral_nervousness = _clamp(
        posture_nerv * 0.30 +
        touch_nerv * 0.30 +
        fidget_nerv * 0.25 +
        body_nerv * 0.15
    )
    behavioral_score = _clamp(100 - behavioral_nervousness)

    # === OVERALL SCORES via WEIGHTED FUSION ===
    # facial: 35%, vocal: 30%, behavioral: 35%
    overall_nervousness = _clamp(
        facial_nervousness * 0.35 +
        vocal_nervousness * 0.30 +
        behavioral_nervousness * 0.35
    )
    overall_confidence = _clamp(100 - overall_nervousness)

    return {
        "overall_confidence_score": round(overall_confidence, 1),
        "overall_nervousness_score": round(overall_nervousness, 1),
        "facial_score": round(facial_score, 1),
        "vocal_score": round(vocal_score, 1),
        "behavioral_score": round(behavioral_score, 1),
        "component_details": {
            # Facial breakdown
            "eye_contact_score": round(eye_contact, 1),
            "gaze_stability_score": round(gaze_stability, 1),
            "head_stability_score": round(head_stability, 1),
            "smile_score": round(min(smile, 100), 1),
            "blink_rate": round(blink_rate, 1),
            "brow_tension": round(brow_tension, 1),
            "jaw_tension": round(jaw_tension, 1),
            "facial_nervousness": round(facial_nervousness, 1),
            # Vocal breakdown
            "wpm_score": round(100 - wpm_nerv, 1),
            "filler_score": round(100 - filler_nerv, 1),
            "pause_score": round(100 - pause_nerv, 1),
            "vocal_nervousness": round(vocal_nervousness, 1),
            # Behavioral breakdown
            "posture_score": round(100 - posture_nerv, 1),
            "touch_score": round(100 - touch_nerv, 1),
            "fidget_score": round(100 - fidget_nerv, 1),
            "behavioral_nervousness": round(behavioral_nervousness, 1),
        }
    }


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    """Clamp a value between low and high."""
    return max(low, min(high, value))

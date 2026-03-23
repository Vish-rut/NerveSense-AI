"""
Tips generator — produces actionable improvement tips
based on detected metrics. Rule-based, not LLM-dependent.
"""


def generate_tips(vocal: dict, video: dict, scores: dict) -> list[dict]:
    """
    Generate improvement tips based on multimodal analysis results.

    Returns:
        [
            {
                "title": str,
                "description": str,
                "severity": "high" | "medium" | "low",
                "category": "vocal" | "facial" | "behavioral"
            },
            ...
        ]
    """
    tips = []
    details = scores.get("component_details", {})

    # --- Vocal Tips (only when real vocal data exists) ---
    wpm = vocal.get("avg_wpm", 0)
    has_vocal_data = wpm > 0
    if has_vocal_data and wpm > 180:
        tips.append({
            "title": "Slow Down Your Speaking Pace",
            "description": f"Your average speaking speed was {wpm:.0f} words per minute, which is faster than the ideal range of 120-160 WPM. Try pausing briefly between sentences and taking a breath before answering.",
            "severity": "high",
            "category": "vocal"
        })
    elif has_vocal_data and wpm < 100 and wpm > 0:
        tips.append({
            "title": "Increase Your Speaking Pace",
            "description": f"Your average speaking speed was {wpm:.0f} WPM. While it's good not to rush, speaking closer to 130 WPM can help convey confidence and engagement.",
            "severity": "medium",
            "category": "vocal"
        })

    filler_freq = vocal.get("filler_frequency", 0)
    total_fillers = vocal.get("total_filler_count", 0)
    if has_vocal_data and (filler_freq > 8 or total_fillers > 15):
        top_fillers = sorted(vocal.get("filler_details", {}).items(), key=lambda x: -x[1])[:3]
        filler_list = ", ".join(f'"{w}"' for w, _ in top_fillers) if top_fillers else '"um", "uh", "like"'
        tips.append({
            "title": "Reduce Filler Words",
            "description": f"You used {total_fillers} filler words during the interview. Your most common fillers were: {filler_list}. Practice replacing these with short, silent pauses instead.",
            "severity": "high",
            "category": "vocal"
        })
    elif has_vocal_data and (filler_freq > 4 or total_fillers > 6):
        tips.append({
            "title": "Be Mindful of Filler Words",
            "description": f"You used {total_fillers} filler words during the interview. This is moderate — try to pause silently instead of saying 'um' or 'like' before your next thought.",
            "severity": "medium",
            "category": "vocal"
        })

    pause_ratio = vocal.get("pause_ratio", 0)
    if has_vocal_data and pause_ratio > 0.5:
        tips.append({
            "title": "Reduce Long Pauses",
            "description": f"About {pause_ratio*100:.0f}% of your interview time was spent in silence. While thoughtful pauses are good, try to keep them brief and intentional.",
            "severity": "high",
            "category": "vocal"
        })

    # --- Facial Tips ---
    eye_contact = video.get("eye_contact_score", 0)
    if eye_contact < 40:
        tips.append({
            "title": "Improve Eye Contact",
            "description": f"Your eye contact was detected only {eye_contact:.0f}% of the time. Practice looking at or near the camera lens when speaking to create a stronger connection.",
            "severity": "high",
            "category": "facial"
        })
    elif eye_contact < 65:
        tips.append({
            "title": "Maintain More Consistent Eye Contact",
            "description": f"Your eye contact was at {eye_contact:.0f}%. Try placing a small sticker near your camera as a reminder to look at it during responses.",
            "severity": "medium",
            "category": "facial"
        })

    # Gaze stability tip
    gaze_stability = video.get("gaze_stability", 0.5)
    if gaze_stability < 0.4:
        tips.append({
            "title": "Reduce Gaze Shifting",
            "description": "Frequent gaze shifts were detected, which can appear as nervousness or distraction. Try to keep your eyes focused on the camera or a single point when speaking.",
            "severity": "medium",
            "category": "facial"
        })

    # Blink rate tip
    blink_rate = video.get("blink_rate", 18)
    if blink_rate > 30:
        tips.append({
            "title": "Manage Blink Rate",
            "description": f"Your blink rate was elevated at approximately {blink_rate:.0f} blinks per minute (normal is 15-20). This can indicate stress. Try conscious relaxation techniques before your interview.",
            "severity": "medium",
            "category": "facial"
        })

    head_stability = video.get("head_stability_score", 50)
    if head_stability < 50:
        tips.append({
            "title": "Stabilize Head Movement",
            "description": "Excessive head movement was detected during your interview. Try keeping your head relatively still, and use intentional nods rather than constant shifting.",
            "severity": "medium",
            "category": "facial"
        })

    # Brow/jaw tension tip
    brow_tension = video.get("brow_tension", 0)
    jaw_tension = video.get("jaw_tension", 0)
    if brow_tension > 0.4 or jaw_tension > 0.4:
        tips.append({
            "title": "Relax Facial Muscles",
            "description": "Elevated facial tension was detected in your brow or jaw area. Before answering, take a deep breath and consciously relax your face. A relaxed expression conveys confidence.",
            "severity": "medium",
            "category": "facial"
        })

    # --- Behavioral Tips ---
    self_touch = video.get("self_touch_count", 0)
    duration_min = max(video.get("duration_seconds", 1) / 60.0, 0.5)
    touch_per_min = self_touch / duration_min

    if touch_per_min > 5:
        tips.append({
            "title": "Avoid Touching Your Face",
            "description": f"You touched your face approximately {touch_per_min:.0f} times per minute. Keep your hands resting on the desk or clasped together between gestures.",
            "severity": "high",
            "category": "behavioral"
        })
    elif touch_per_min > 2:
        tips.append({
            "title": "Reduce Self-Touch Gestures",
            "description": "Moderate face-touching was observed. This can signal nervousness — try keeping your hands visible and still when not gesturing.",
            "severity": "low",
            "category": "behavioral"
        })

    posture_shifts = video.get("posture_shift_count", 0)
    shifts_per_min = posture_shifts / duration_min
    if shifts_per_min > 3:
        tips.append({
            "title": "Maintain Steady Posture",
            "description": f"Frequent posture shifts were detected (about {shifts_per_min:.0f}/min). Sit back in your chair with both feet on the floor for a more stable, confident posture.",
            "severity": "medium",
            "category": "behavioral"
        })

    # Fidget tip
    fidget_score = video.get("fidget_score", 0)
    if fidget_score > 40:
        tips.append({
            "title": "Reduce Fidgeting",
            "description": "Significant fidgeting was detected in your hand movements. Try clasping your hands together or placing them flat on the desk between responses.",
            "severity": "medium",
            "category": "behavioral"
        })

    # --- Positive Tips (if doing well) ---
    if scores.get("overall_confidence_score", 0) > 75:
        tips.append({
            "title": "Strong Overall Presentation",
            "description": "Your overall confidence score is high. You demonstrated good composure during the interview. Keep up the great work!",
            "severity": "low",
            "category": "vocal"
        })

    return tips

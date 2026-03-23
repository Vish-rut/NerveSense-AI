"""
Analysis Service — orchestrates the full analysis pipeline:
1. Extract audio from video
2. Transcribe audio
3. Compute vocal features
4. Compute video features (MediaPipe)
5. Calculate scores
6. Generate tips
7. Store results in database
"""
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import (
    InterviewSession, QuestionResponse, InterviewQuestion,
    AnalysisResult, QuestionAnalysis, SessionMetric
)
from app.services.media_service import extract_audio, get_media_path
from app.ml.audio.transcription import transcribe
from app.ml.audio.vocal_features import extract_vocal_features
from app.ml.video.facial_features import analyze_video
from app.ml.fusion.score_calculator import calculate_scores
from app.ml.fusion.tips_generator import generate_tips

logger = logging.getLogger(__name__)


async def process_session(session_id: int, db: AsyncSession):
    """
    Full analysis pipeline for a completed interview session.
    Called as a background task after session.finish().
    """
    logger.info(f"Starting analysis for session {session_id}")

    # 1. Get the session and verify it's completed
    session = await db.get(InterviewSession, session_id)
    if not session:
        logger.error(f"Session {session_id} not found")
        return
    if session.session_status != "completed":
        logger.warning(f"Session {session_id} status is '{session.session_status}', expected 'completed'")

    # Update status to processing
    session.session_status = "processing"
    await db.commit()

    try:
        # 2. Find the video file
        video_path = get_media_path(session_id, "video")
        if not video_path:
            logger.warning(f"No video file found for session {session_id}. Running vocal-only analysis with audio file.")

        # 3. Extract audio (if video exists)
        audio_path = get_media_path(session_id, "audio")
        if not audio_path and video_path:
            try:
                audio_path = extract_audio(video_path)
                session.raw_audio_url = audio_path
            except RuntimeError as e:
                logger.error(f"Audio extraction failed: {e}")

        # 4. Transcribe audio
        transcript = {"full_text": "", "segments": [], "language": "en", "duration_seconds": 0.0}
        if audio_path:
            transcript = transcribe(audio_path)
            session.transcript_url = f"transcript_{session_id}.json"
            logger.info(f"Transcription complete: {len(transcript['segments'])} segments, {transcript['duration_seconds']}s")

        # 5. Extract vocal features
        vocal_features = extract_vocal_features(transcript)
        logger.info(f"Vocal features: WPM={vocal_features['avg_wpm']}, fillers={vocal_features['total_filler_count']}")

        # 6. Extract video features (MediaPipe)
        video_features = {"eye_contact_score": 0, "head_stability_score": 0, "smile_ratio": 0,
                          "posture_shift_count": 0, "self_touch_count": 0, "facial_timeline": [],
                          "behavioral_timeline": [], "total_frames_analyzed": 0, "duration_seconds": 0}
        if video_path:
            video_features = analyze_video(video_path)
            logger.info(f"Video features: eye_contact={video_features['eye_contact_score']}%, "
                        f"head_stability={video_features['head_stability_score']}%")

        # 7. Calculate scores
        scores = calculate_scores(vocal_features, video_features)
        logger.info(f"Scores: confidence={scores['overall_confidence_score']}, "
                    f"nervousness={scores['overall_nervousness_score']}")

        # 8. Generate tips
        tips = generate_tips(vocal_features, video_features, scores)
        logger.info(f"Generated {len(tips)} improvement tips")

        # 9. Store in database
        # -- Overall analysis result
        analysis = AnalysisResult(
            session_id=session_id,
            overall_confidence_score=scores["overall_confidence_score"],
            overall_nervousness_score=scores["overall_nervousness_score"],
            facial_score=scores["facial_score"],
            vocal_score=scores["vocal_score"],
            behavioral_score=scores["behavioral_score"],
            component_details=scores.get("component_details", {}),
            summary_text=_build_summary(scores, vocal_features, video_features, tips),
            generated_at=datetime.now(timezone.utc)
        )
        db.add(analysis)

        # -- Update question responses with transcripts
        if transcript["segments"]:
            await _update_question_transcripts(db, session_id, transcript)

        # -- Per-question analysis (if questions exist)
        questions_result = await db.execute(
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == session.interview_id)
            .order_by(InterviewQuestion.order_index)
        )
        questions = questions_result.scalars().all()

        for q in questions:
            qa = QuestionAnalysis(
                session_id=session_id,
                question_id=q.id,
                confidence_score=scores["overall_confidence_score"],  # simplified: same as overall
                nervousness_score=scores["overall_nervousness_score"],
                eye_contact_score=video_features["eye_contact_score"],
                speaking_rate=vocal_features["avg_wpm"],
                filler_word_count=vocal_features["total_filler_count"],
                posture_shift_count=video_features["posture_shift_count"],
                self_touch_count=video_features["self_touch_count"],
                notes_json={
                    "tips": [t for t in tips if t["severity"] in ("high", "medium")],
                    "vocal_details": vocal_features.get("filler_details", {}),
                }
            )
            db.add(qa)

        # 10. Mark session as analyzed
        session.session_status = "analyzed"
        await db.commit()

        logger.info(f"✅ Analysis complete for session {session_id}")

    except Exception as e:
        logger.error(f"Analysis failed for session {session_id}: {e}", exc_info=True)
        session.session_status = "analysis_failed"
        await db.commit()
        raise


async def process_realtime_session(session_id: int, db: AsyncSession):
    """
    Process session using accumulated real-time metrics from the database.
    This replaces the slow video-processing pipeline by instantly aggregating client-side data.
    """
    logger.info(f"Starting real-time analysis aggregation for session {session_id}")

    session = await db.get(InterviewSession, session_id)
    if not session:
        return

    session.session_status = "processing"
    await db.commit()

    try:
        # Fetch all metrics for this session
        metrics_result = await db.execute(
            select(SessionMetric).where(SessionMetric.session_id == session_id)
        )
        metrics = metrics_result.scalars().all()

        # Aggregate metrics with enhanced multimodal fields
        total_frames = max(len(metrics), 1)

        # --- Aggregate facial features ---
        total_smile = 0.0
        total_eye = 0.0
        total_gaze_stability = 0.0
        total_blink_rate = 0.0
        total_head_stability = 0.0
        total_brow_tension = 0.0
        total_jaw_tension = 0.0
        facial_data_count = 0

        # --- Aggregate behavioral features ---
        posture_shifts = 0
        self_touches = 0
        total_fidget_score = 0.0
        total_body_motion_var = 0.0
        behavioral_data_count = 0

        # --- Aggregate vocal features ---
        vocal_wpm_values = []
        total_filler_count = 0
        total_word_count = 0

        # --- Aggregate confidence/nervousness ---
        conf_values = []
        nerv_values = []

        for m in metrics:
            # Confidence & nervousness
            if m.confidence_score is not None:
                conf_values.append(m.confidence_score)
            if m.nervousness_score is not None:
                nerv_values.append(m.nervousness_score)

            # Facial metrics
            fm = m.facial_metrics or {}
            if fm:
                facial_data_count += 1
                total_smile += fm.get("smile_ratio", 0)
                total_eye += fm.get("eye_contact_ratio", 0)
                total_gaze_stability += fm.get("gaze_stability", 0.5)
                total_blink_rate += fm.get("blink_rate", 18)
                total_head_stability += fm.get("head_stability_score", 50)
                total_brow_tension += fm.get("brow_tension", 0)
                total_jaw_tension += fm.get("jaw_tension", 0)

            # Behavioral metrics
            bm = m.behavioral_metrics or {}
            if bm:
                behavioral_data_count += 1
                posture_shifts += bm.get("posture_shifts", 0)
                self_touches += bm.get("self_touches", 0)
                total_fidget_score += bm.get("fidget_score", 0)
                total_body_motion_var += bm.get("body_motion_variance", 0)

            # Vocal metrics
            vm = m.vocal_metrics or {}
            if vm.get("wpm"):
                vocal_wpm_values.append(vm["wpm"])
            total_filler_count += vm.get("filler_count", 0)
            total_word_count += vm.get("word_count", 0)

        fc = max(facial_data_count, 1)
        bc = max(behavioral_data_count, 1)

        # Estimate session duration from metric timestamps
        duration_seconds = 0
        if len(metrics) >= 2 and metrics[0].timestamp and metrics[-1].timestamp:
            duration_seconds = abs((metrics[-1].timestamp - metrics[0].timestamp).total_seconds())
        duration_seconds = max(duration_seconds, 30)  # at least 30s

        video_features = {
            "eye_contact_score": (total_eye / fc) * 100,
            "gaze_stability": total_gaze_stability / fc,
            "head_stability_score": total_head_stability / fc,
            "smile_ratio": total_smile / fc,
            "blink_rate": total_blink_rate / fc,
            "brow_tension": total_brow_tension / fc,
            "jaw_tension": total_jaw_tension / fc,
            "posture_shift_count": posture_shifts,
            "self_touch_count": self_touches,
            "fidget_score": total_fidget_score / bc,
            "body_motion_variance": total_body_motion_var / bc,
            "duration_seconds": duration_seconds,
        }

        avg_wpm = sum(vocal_wpm_values) / max(len(vocal_wpm_values), 1) if vocal_wpm_values else 0.0
        estimated_speaking_seconds = total_word_count * 0.4
        speech_ratio = min(1.0, estimated_speaking_seconds / duration_seconds) if duration_seconds > 0 else 0.0

        duration_minutes = duration_seconds / 60.0
        filler_frequency = round(total_filler_count / duration_minutes, 2) if duration_minutes > 0 else 0.0

        vocal_features = {
            "avg_wpm": avg_wpm,
            "total_filler_count": total_filler_count,
            "filler_frequency": filler_frequency,
            "speech_ratio": speech_ratio,
            "filler_details": {},
            "pause_ratio": max(0, 1 - speech_ratio),
        }

        # Calculate final structured scores via multimodal fusion engine
        scores = calculate_scores(vocal_features, video_features)

        tips = generate_tips(vocal_features, video_features, scores)

        # Build analysis result
        db.add(AnalysisResult(
            session_id=session_id,
            overall_confidence_score=scores["overall_confidence_score"],
            overall_nervousness_score=scores["overall_nervousness_score"],
            facial_score=scores["facial_score"],
            vocal_score=scores["vocal_score"],
            behavioral_score=scores["behavioral_score"],
            component_details=scores.get("component_details", {}),
            summary_text=_build_summary(scores, vocal_features, video_features, tips),
            generated_at=datetime.now(timezone.utc)
        ))

        # Per-question analysis — group metrics by question_id for differentiated scores
        from collections import defaultdict
        question_metrics = defaultdict(list)
        untagged_metrics = []
        for m in metrics:
            q_id = getattr(m, 'question_id', None)
            if q_id:
                question_metrics[q_id].append(m)
            else:
                untagged_metrics.append(m)

        # Also fetch QuestionResponse rows to know which questions were actually attempted
        from app.db.models import QuestionResponse
        qr_res = await db.execute(
            select(QuestionResponse.question_id)
            .where(QuestionResponse.session_id == session_id)
        )
        responded_question_ids = {row[0] for row in qr_res.all()}

        qs_res = await db.execute(select(InterviewQuestion).where(InterviewQuestion.interview_id == session.interview_id))
        for q in qs_res.scalars().all():
            q_own_metrics = question_metrics.get(q.id, [])
            has_own_data = len(q_own_metrics) > 0
            was_attempted = q.id in responded_question_ids or has_own_data

            # Skip unanswered questions entirely — no fake fallback data
            if not was_attempted:
                continue

            q_metrics = q_own_metrics if has_own_data else untagged_metrics
            q_total = max(len(q_metrics), 1)

            if has_own_data:
                # Aggregate enhanced per-question facial metrics
                q_eye = sum((m.facial_metrics or {}).get("eye_contact_ratio", 0) for m in q_metrics) / q_total * 100
                q_gaze_stab = sum((m.facial_metrics or {}).get("gaze_stability", 0.5) for m in q_metrics) / q_total
                q_head_stab = sum((m.facial_metrics or {}).get("head_stability_score", 50) for m in q_metrics) / q_total
                q_smile = sum((m.facial_metrics or {}).get("smile_ratio", 0) for m in q_metrics) / q_total
                q_blink = sum((m.facial_metrics or {}).get("blink_rate", 18) for m in q_metrics) / q_total
                q_brow = sum((m.facial_metrics or {}).get("brow_tension", 0) for m in q_metrics) / q_total
                q_jaw = sum((m.facial_metrics or {}).get("jaw_tension", 0) for m in q_metrics) / q_total

                # Per-question behavioral
                q_posture = sum((m.behavioral_metrics or {}).get("posture_shifts", 0) for m in q_metrics)
                q_touch = sum((m.behavioral_metrics or {}).get("self_touches", 0) for m in q_metrics)
                q_fidget = sum((m.behavioral_metrics or {}).get("fidget_score", 0) for m in q_metrics) / q_total
                q_fidget_count = sum(1 for m in q_metrics if (m.behavioral_metrics or {}).get("fidget_score", 0) > 20)
                q_body_var = sum((m.behavioral_metrics or {}).get("body_motion_variance", 0) for m in q_metrics) / q_total

                # Per-question vocal
                q_wpm_values = [vm.get("wpm", 0) for m in q_metrics if (vm := m.vocal_metrics or {}) and vm.get("wpm")]
                q_filler = sum(vm.get("filler_count", 0) for m in q_metrics if (vm := m.vocal_metrics or {}))
                q_avg_wpm = sum(q_wpm_values) / max(len(q_wpm_values), 1) if q_wpm_values else avg_wpm

                # Build per-question feature dicts and score via fusion engine
                q_video = {
                    "eye_contact_score": q_eye,
                    "gaze_stability": q_gaze_stab,
                    "head_stability_score": q_head_stab,
                    "smile_ratio": q_smile,
                    "blink_rate": q_blink,
                    "brow_tension": q_brow,
                    "jaw_tension": q_jaw,
                    "posture_shift_count": q_posture,
                    "self_touch_count": q_touch,
                    "fidget_score": q_fidget,
                    "body_motion_variance": q_body_var,
                    "duration_seconds": max(q_total * 5, 15),  # estimate from snapshot count
                }
                q_vocal = {
                    "avg_wpm": q_avg_wpm,
                    "total_filler_count": q_filler,
                    "filler_frequency": round(q_filler / max(q_total * 5 / 60.0, 0.25), 2),
                    "speech_ratio": min(1.0, (sum(vm.get("word_count", 0) for m in q_metrics if (vm := m.vocal_metrics or {})) * 0.4) / max(q_total * 5, 15)) if q_avg_wpm > 0 else 0.0,
                    "pause_ratio": 0.2 if q_avg_wpm > 0 else 1.0,
                }
                q_scores = calculate_scores(q_vocal, q_video)

                q_confidence = q_scores["overall_confidence_score"]
                q_nervousness = q_scores["overall_nervousness_score"]
            else:
                # Question was attempted but has no tagged snapshots — use overall scores
                # but zero out behavioral counts to avoid duplicating session totals
                q_confidence = scores["overall_confidence_score"]
                q_nervousness = scores["overall_nervousness_score"]
                q_eye = video_features["eye_contact_score"]
                q_avg_wpm = avg_wpm
                q_filler = 0
                q_posture = 0
                q_touch = 0
                q_fidget_count = 0

            db.add(QuestionAnalysis(
                session_id=session_id,
                question_id=q.id,
                confidence_score=q_confidence,
                nervousness_score=q_nervousness,
                eye_contact_score=q_eye,
                speaking_rate=q_avg_wpm,
                filler_word_count=q_filler,
                posture_shift_count=q_posture,
                self_touch_count=q_touch,
                fidget_count=q_fidget_count,
                notes_json={"tips": [t for t in tips if t["severity"] in ("high", "medium")]}
            ))

        session.session_status = "analyzed"
        await db.commit()
        logger.info(f"✅ Real-time analysis complete for session {session_id}")

    except Exception as e:
        logger.error(f"Real-time analysis failed for session {session_id}: {e}", exc_info=True)
        session.session_status = "analysis_failed"
        await db.commit()
        raise


async def _update_question_transcripts(db: AsyncSession, session_id: int, transcript: dict):
    """Map transcript segments to question responses by timestamp."""
    responses_result = await db.execute(
        select(QuestionResponse)
        .where(QuestionResponse.session_id == session_id)
        .order_by(QuestionResponse.question_start_time)
    )
    responses = responses_result.scalars().all()

    if not responses:
        return

    for resp in responses:
        if resp.question_start_time and resp.answer_end_time:
            # Find segments that fall within this question's time window
            q_start = resp.question_start_time.timestamp()
            q_end = resp.answer_end_time.timestamp()
            matching_text = []
            for seg in transcript["segments"]:
                if seg["start"] >= q_start and seg["end"] <= q_end:
                    matching_text.append(seg["text"])
            if matching_text:
                resp.transcript_text = " ".join(matching_text)
                resp.transcript_confidence = 0.85  # Whisper typical confidence


def _build_summary(scores: dict, vocal: dict, video: dict, tips: list) -> str:
    """Build a human-readable summary paragraph with multimodal analysis context."""
    confidence = scores["overall_confidence_score"]
    nervousness = scores["overall_nervousness_score"]
    details_comp = scores.get("component_details", {})

    if confidence >= 80:
        opening = "The candidate demonstrated strong overall confidence during the interview."
    elif confidence >= 60:
        opening = "The candidate showed moderate confidence with some areas for improvement."
    elif confidence >= 40:
        opening = "The candidate displayed notable nervousness during the interview."
    else:
        opening = "The candidate showed significant signs of nervousness throughout the interview."

    wpm = vocal.get("avg_wpm", 0)
    fillers = vocal.get("total_filler_count", 0)
    eye = video.get("eye_contact_score", 0)

    if wpm > 0:
        details = f"Speaking pace was {wpm:.0f} WPM with {fillers} filler words detected. "
    else:
        details = "No vocal data was captured during this session. "
    details += f"Eye contact was maintained {eye:.0f}% of the time. "

    # Add multimodal breakdown
    facial_n = details_comp.get("facial_nervousness", 0)
    vocal_n = details_comp.get("vocal_nervousness", 0)
    behavioral_n = details_comp.get("behavioral_nervousness", 0)

    # Identify the highest nervousness channel
    channels = [("facial cues", facial_n), ("vocal patterns", vocal_n), ("body language", behavioral_n)]
    channels.sort(key=lambda x: -x[1])
    if channels[0][1] > 30:
        details += f"The primary nervousness indicator was {channels[0][0]} (score: {channels[0][1]:.0f}/100). "

    # Blink rate if notable
    blink_rate = video.get("blink_rate", 18)
    if blink_rate > 25:
        details += f"Elevated blink rate ({blink_rate:.0f}/min) suggests heightened stress. "

    high_tips = [t for t in tips if t["severity"] == "high"]
    if high_tips:
        details += f"Key areas needing attention: {', '.join(t['title'].lower() for t in high_tips[:3])}."
    else:
        details += "No critical issues were identified."

    return f"{opening} {details}"

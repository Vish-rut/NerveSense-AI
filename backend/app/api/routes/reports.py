"""
Report & Export API routes — endpoints for retrieving analysis reports
and exporting them as PDF, CSV, or JSON.
"""
import io
import csv
import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models import (
    InterviewSession, AnalysisResult, QuestionAnalysis,
    InterviewQuestion, Interview, Candidate, QuestionResponse,
    SessionMetric
)
from app.ml.fusion.tips_generator import generate_tips
from app.services.analysis_service import process_realtime_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{session_id}")
async def get_report(session_id: int, db: AsyncSession = Depends(get_db)):
    """
    Get the full analysis report for a completed interview session.
    Returns structured JSON with all metrics, tips, and metadata.
    """
    # Load session with relationships
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get analysis result
    analysis_result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.session_id == session_id)
    )
    analysis = analysis_result.scalar_one_or_none()

    if not analysis:
        # Check if session is still processing
        if session.session_status == "processing":
            return {"status": "processing", "message": "Analysis is currently in progress."}
        elif session.session_status in ("completed", "active"):
            return {"status": "processing", "message": "Analysis is being prepared."}
        elif session.session_status == "analysis_failed":
            return {"status": "failed", "message": "Analysis encountered an issue. You can retry."}
        else:
            return {"status": "not_ready", "message": f"Session status: {session.session_status}"}

    # Get interview details
    interview = await db.get(Interview, session.interview_id)

    # Get candidate
    candidate = None
    if session.candidate_id:
        candidate = await db.get(Candidate, session.candidate_id)

    # Get per-question analysis
    qa_result = await db.execute(
        select(QuestionAnalysis)
        .where(QuestionAnalysis.session_id == session_id)
        .order_by(QuestionAnalysis.question_id)
    )
    question_analyses = qa_result.scalars().all()

    # Get questions
    questions_result = await db.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.interview_id == session.interview_id)
        .order_by(InterviewQuestion.order_index)
    )
    questions = questions_result.scalars().all()

    # Get responses with transcripts
    responses_result = await db.execute(
        select(QuestionResponse)
        .where(QuestionResponse.session_id == session_id)
        .order_by(QuestionResponse.id)
    )
    responses = responses_result.scalars().all()

    # Get all session metrics for timeline data
    metrics_result = await db.execute(
        select(SessionMetric)
        .where(SessionMetric.session_id == session_id)
        .order_by(SessionMetric.timestamp)
    )
    all_metrics = metrics_result.scalars().all()

    # Build report JSON
    report = {
        "status": "ready",
        "session_id": session_id,
        "interview": {
            "id": interview.id if interview else None,
            "job_position": interview.job_position if interview else "Unknown",
            "duration_minutes": interview.duration_minutes if interview else 0,
        },
        "candidate": {
            "name": candidate.name if candidate else "Unknown",
            "email": candidate.email if candidate else None,
            "completed_at": candidate.completed_at.isoformat() if candidate and candidate.completed_at else None,
        },
        "scores": {
            "overall_confidence": analysis.overall_confidence_score,
            "overall_nervousness": analysis.overall_nervousness_score,
            "facial": analysis.facial_score,
            "vocal": analysis.vocal_score,
            "behavioral": analysis.behavioral_score,
            "component_details": analysis.component_details or {},
        },
        "summary": analysis.summary_text,
        "generated_at": analysis.generated_at.isoformat() if analysis.generated_at else None,
        "timeline": _build_timeline(all_metrics, session.started_at),
        "emotion_distribution": _build_emotion_distribution(
            all_metrics,
            analysis.overall_confidence_score or 0,
            analysis.overall_nervousness_score or 0,
        ),
        "questions": [
            {
                "id": q.id,
                "text": q.question_text,
                "type": q.question_type,
                "order": q.order_index,
                "analysis": _get_question_analysis(q.id, question_analyses),
                "response": _get_question_response(q.id, responses),
            }
            for q in questions
        ],
        "tips": _extract_tips(question_analyses),
    }

    return report


@router.get("/{session_id}/export")
async def export_report(
    session_id: int,
    type: str = "json",
    db: AsyncSession = Depends(get_db)
):
    """
    Export report in specified format: json, csv, or pdf.
    """
    # Get the report data first
    report = await get_report(session_id, db)

    if isinstance(report, dict) and report.get("status") != "ready":
        raise HTTPException(status_code=400, detail=report.get("message", "Report not ready"))

    if type == "json":
        return _export_json(report, session_id)
    elif type == "csv":
        return _export_csv(report, session_id)
    elif type == "pdf":
        return await _export_pdf(report, session_id)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export type: {type}. Use json, csv, or pdf.")


@router.post("/{session_id}/reanalyze")
async def reanalyze_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """
    Re-trigger analysis for a session that is stuck in 'processing' or 'completed' state.
    Clears any existing analysis and re-runs.
    """
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Clear existing analysis
    from sqlalchemy import delete
    await db.execute(delete(QuestionAnalysis).where(QuestionAnalysis.session_id == session_id))
    await db.execute(delete(AnalysisResult).where(AnalysisResult.session_id == session_id))
    session.session_status = "completed"
    await db.commit()

    try:
        await process_realtime_session(session_id, db)
        return {"status": "analyzed", "message": "Re-analysis complete."}
    except Exception as e:
        logger.error(f"Re-analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-candidate/{interview_id}/{candidate_id}")
async def get_report_by_candidate(
    interview_id: int,
    candidate_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Look up the session for a given candidate+interview and return the report.
    This is used by the frontend CandidateReportPage which has interviewId + candidateId from the URL.
    """
    stmt = (
        select(InterviewSession)
        .where(
            InterviewSession.interview_id == interview_id,
            InterviewSession.candidate_id == candidate_id,
        )
        .order_by(InterviewSession.started_at.desc())
    )
    result = await db.execute(stmt)
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=404, detail="No session found for this candidate")

    return await get_report(session.id, db)


@router.get("/{session_id}/live")
async def get_live_metrics(session_id: int, db: AsyncSession = Depends(get_db)):
    """
    Return the latest aggregated metrics for a live session.
    Used by the recruiter live dashboard with polling.
    """
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get the last 20 metric snapshots
    metrics_result = await db.execute(
        select(SessionMetric)
        .where(SessionMetric.session_id == session_id)
        .order_by(SessionMetric.timestamp.desc())
        .limit(20)
    )
    metrics = list(metrics_result.scalars().all())
    metrics.reverse()  # chronological order

    total = max(len(metrics), 1)
    avg_confidence = sum((m.confidence_score or 0) for m in metrics) / total
    avg_nervousness = sum((m.nervousness_score or 0) for m in metrics) / total

    # Aggregate facial
    avg_smile = sum((m.facial_metrics or {}).get("smile_ratio", 0) for m in metrics) / total
    avg_eye = sum((m.facial_metrics or {}).get("eye_contact_ratio", 0) for m in metrics) / total
    avg_gaze = sum((m.facial_metrics or {}).get("gaze_stability", 0.5) for m in metrics) / total
    avg_blink = sum((m.facial_metrics or {}).get("blink_rate", 18) for m in metrics) / total
    avg_head_stab = sum((m.facial_metrics or {}).get("head_stability_score", 50) for m in metrics) / total
    avg_brow = sum((m.facial_metrics or {}).get("brow_tension", 0) for m in metrics) / total
    avg_jaw = sum((m.facial_metrics or {}).get("jaw_tension", 0) for m in metrics) / total

    # Aggregate behavioral
    total_posture = sum((m.behavioral_metrics or {}).get("posture_shifts", 0) for m in metrics)
    total_touch = sum((m.behavioral_metrics or {}).get("self_touches", 0) for m in metrics)
    avg_fidget = sum((m.behavioral_metrics or {}).get("fidget_score", 0) for m in metrics) / total
    avg_body_var = sum((m.behavioral_metrics or {}).get("body_motion_variance", 0) for m in metrics) / total

    # Build timeline for charts
    timeline = [
        {
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            "confidence": m.confidence_score,
            "nervousness": m.nervousness_score,
        }
        for m in metrics
    ]

    return {
        "session_id": session_id,
        "session_status": session.session_status,
        "current_question_index": session.current_question_index,
        "total_snapshots": len(metrics),
        "averages": {
            "confidence": round(avg_confidence, 1),
            "nervousness": round(avg_nervousness, 1),
            "smile_ratio": round(avg_smile, 3),
            "eye_contact_ratio": round(avg_eye, 3),
            "gaze_stability": round(avg_gaze, 3),
            "blink_rate": round(avg_blink, 1),
            "head_stability": round(avg_head_stab, 1),
            "brow_tension": round(avg_brow, 3),
            "jaw_tension": round(avg_jaw, 3),
            "posture_shifts": total_posture,
            "self_touches": total_touch,
            "fidget_score": round(avg_fidget, 1),
            "body_motion_variance": round(avg_body_var, 6),
        },
        "timeline": timeline,
    }


def _build_timeline(metrics: list, session_start) -> list:
    """Bucket SessionMetric rows into ~30-second windows for timeline charts."""
    if not metrics:
        return []

    BUCKET_SECONDS = 30

    # Determine reference start time
    start_time = session_start
    if not start_time and metrics[0].timestamp:
        start_time = metrics[0].timestamp
    if not start_time:
        return []

    buckets = {}
    for m in metrics:
        if not m.timestamp:
            continue
        offset = (m.timestamp - start_time).total_seconds()
        if offset < 0:
            offset = 0
        bucket_key = int(offset // BUCKET_SECONDS) * BUCKET_SECONDS
        if bucket_key not in buckets:
            buckets[bucket_key] = []
        buckets[bucket_key].append(m)

    result = []
    for bucket_start in sorted(buckets.keys()):
        bucket_metrics = buckets[bucket_start]
        n = len(bucket_metrics)

        minutes = int(bucket_start) // 60
        seconds = int(bucket_start) % 60
        time_label = f"{minutes}:{seconds:02d}"

        # NOTE: vocal_metrics.filler_count and wpm are per-snapshot DELTA values (not cumulative).
        # Summing filler_count gives total fillers in this bucket. Averaging wpm gives mean pace.
        wpm_values = [vm.get("wpm", 0) for m in bucket_metrics
                      if (vm := m.vocal_metrics or {}) and vm.get("wpm")]
        filler_sum = sum((m.vocal_metrics or {}).get("filler_count", 0)
                         for m in bucket_metrics)
        conf_values = [m.confidence_score for m in bucket_metrics
                       if m.confidence_score is not None]
        nerv_values = [m.nervousness_score for m in bucket_metrics
                       if m.nervousness_score is not None]

        result.append({
            "time": time_label,
            "time_seconds": bucket_start,
            "wpm": round(sum(wpm_values) / max(len(wpm_values), 1), 1) if wpm_values else 0,
            "filler_count": filler_sum,
            "confidence": round(sum(conf_values) / max(len(conf_values), 1), 1) if conf_values else 0,
            "nervousness": round(sum(nerv_values) / max(len(nerv_values), 1), 1) if nerv_values else 0,
        })

    return result


def _build_emotion_distribution(metrics: list, overall_confidence: float, overall_nervousness: float) -> dict:
    """
    Compute emotion distribution for the facial pie chart.
    Categories: Neutral, Focus, Stress, Confidence
    """
    if not metrics:
        # Derive from overall scores when no raw metrics exist
        stress_pct = min(40, overall_nervousness * 0.4)
        confidence_pct = min(40, overall_confidence * 0.4)
        focus_pct = max(10, (100 - stress_pct - confidence_pct) * 0.5)
        neutral_pct = max(10, 100 - confidence_pct - stress_pct - focus_pct)
        total = confidence_pct + stress_pct + focus_pct + neutral_pct
        return {
            "neutral": round(neutral_pct / total * 100),
            "focus": round(focus_pct / total * 100),
            "stress": round(stress_pct / total * 100),
            "confidence": round(confidence_pct / total * 100),
        }

    # Score each snapshot proportionally across all categories
    neutral = focus = stress = confident = 0.0
    for m in metrics:
        conf = m.confidence_score or 0
        nerv = m.nervousness_score or 0
        fm = m.facial_metrics or {}
        eye = fm.get("eye_contact_ratio", 0)

        # Each snapshot contributes to ALL categories proportionally
        conf_signal = max(0, conf - 50) / 50          # 0-1: how confident
        stress_signal = max(0, nerv - 20) / 80         # 0-1: how stressed
        focus_signal = min(1.0, eye * 1.2)             # 0-1: eye engagement
        neutral_signal = max(0.0, 1 - conf_signal - stress_signal - focus_signal * 0.5)

        confident += conf_signal
        stress += stress_signal
        focus += focus_signal
        neutral += neutral_signal

    total = max(neutral + focus + stress + confident, 0.01)
    return {
        "neutral": round(neutral / total * 100),
        "focus": round(focus / total * 100),
        "stress": round(stress / total * 100),
        "confidence": round(confident / total * 100),
    }


def _get_question_analysis(question_id: int, analyses: list) -> dict | None:
    for qa in analyses:
        if qa.question_id == question_id:
            return {
                "confidence_score": qa.confidence_score,
                "nervousness_score": qa.nervousness_score,
                "eye_contact_score": qa.eye_contact_score,
                "speaking_rate": qa.speaking_rate,
                "filler_word_count": qa.filler_word_count,
                "posture_shift_count": qa.posture_shift_count,
                "self_touch_count": qa.self_touch_count,
                "fidget_count": getattr(qa, 'fidget_count', 0) or 0,
            }
    return None


def _get_question_response(question_id: int, responses: list) -> dict | None:
    for r in responses:
        if r.question_id == question_id:
            return {
                "transcript": r.transcript_text,
                "confidence": r.transcript_confidence,
            }
    return None


def _extract_tips(analyses: list) -> list:
    """Extract tips from question analysis notes_json."""
    all_tips = []
    seen_titles = set()
    for qa in analyses:
        if qa.notes_json and isinstance(qa.notes_json, dict):
            for tip in qa.notes_json.get("tips", []):
                title = tip.get("title", "")
                if title not in seen_titles:
                    seen_titles.add(title)
                    all_tips.append(tip)
    return all_tips


def _export_json(report: dict, session_id: int) -> StreamingResponse:
    """Export report as downloadable JSON file."""
    content = json.dumps(report, indent=2, default=str)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=nervesense_report_{session_id}.json"
        }
    )


def _export_csv(report: dict, session_id: int) -> StreamingResponse:
    """Export report as CSV with flattened metrics."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Overview section
    writer.writerow(["NerveSenseAI Interview Report"])
    writer.writerow([])
    writer.writerow(["Candidate", report["candidate"]["name"]])
    writer.writerow(["Position", report["interview"]["job_position"]])
    writer.writerow(["Generated At", report.get("generated_at", "")])
    writer.writerow([])

    # Scores section
    writer.writerow(["Overall Scores"])
    writer.writerow(["Metric", "Score"])
    scores = report["scores"]
    writer.writerow(["Overall Confidence", scores["overall_confidence"]])
    writer.writerow(["Overall Nervousness", scores["overall_nervousness"]])
    writer.writerow(["Facial Score", scores["facial"]])
    writer.writerow(["Vocal Score", scores["vocal"]])
    writer.writerow(["Behavioral Score", scores["behavioral"]])
    writer.writerow([])

    # Per-question section
    writer.writerow(["Question Analysis"])
    writer.writerow([
        "Q#", "Question", "Type", "Confidence", "Nervousness",
        "Eye Contact", "Speaking Rate", "Filler Words",
        "Posture Shifts", "Self-Touch", "Fidgets"
    ])
    for q in report.get("questions", []):
        analysis = q.get("analysis") or {}
        writer.writerow([
            q["order"] + 1,
            q["text"],
            q["type"],
            analysis.get("confidence_score", ""),
            analysis.get("nervousness_score", ""),
            analysis.get("eye_contact_score", ""),
            analysis.get("speaking_rate", ""),
            analysis.get("filler_word_count", ""),
            analysis.get("posture_shift_count", ""),
            analysis.get("self_touch_count", ""),
            analysis.get("fidget_count", ""),
        ])
    writer.writerow([])

    # Tips section
    writer.writerow(["Improvement Tips"])
    writer.writerow(["Severity", "Title", "Description"])
    for tip in report.get("tips", []):
        writer.writerow([tip.get("severity", ""), tip.get("title", ""), tip.get("description", "")])

    content = output.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=nervesense_report_{session_id}.csv"
        }
    )


async def _export_pdf(report: dict, session_id: int) -> StreamingResponse:
    """Generate PDF from HTML template using WeasyPrint."""
    try:
        from weasyprint import HTML
        from jinja2 import Environment, FileSystemLoader
        import os

        template_dir = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template("report.html")

        html_content = template.render(report=report)
        pdf_bytes = HTML(string=html_content).write_pdf()

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=nervesense_report_{session_id}.pdf"
            }
        )

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="WeasyPrint is not installed. Install with: pip install weasyprint"
        )
    except Exception as e:
        logger.error(f"PDF generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

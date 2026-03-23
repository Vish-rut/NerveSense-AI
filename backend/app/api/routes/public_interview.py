"""
Public candidate interview routes — guide Section 10 (Candidate APIs).

These endpoints are accessed by candidates via the secure interview link.
No recruiter authentication required — access is controlled by interview token.

Endpoints:
  GET  /api/public/interview/{token}           — validate link, get interview info
  POST /api/public/interview/{token}/start     — start a session
  GET  /api/public/session/{session_id}/state  — get current session state
  POST /api/public/session/{session_id}/next   — advance to next question
  POST /api/public/session/{session_id}/finish — end the interview
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models import (
    Interview,
    InterviewSession,
    Candidate,
    InterviewQuestion,
    QuestionResponse,
)
from app.services.analysis_service import process_realtime_session
from app.core.security import is_token_expired
from app.schemas.interview import (
    PublicInterviewInfo,
    SessionStartRequest,
    SessionResponse,
    SessionQuestionState,
    QuestionOut,
)

router = APIRouter(prefix="/api/public", tags=["public-interview"])


async def _get_valid_interview(db: AsyncSession, token: str) -> Interview:
    """Shared helper: fetch interview by token and validate it."""
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.interview_types),
            selectinload(Interview.questions),
        )
        .where(Interview.access_token == token)
    )
    interview = result.scalar_one_or_none()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found or link is invalid")

    if is_token_expired(interview.expires_at):
        raise HTTPException(status_code=410, detail="This interview link has expired")

    if interview.status != "active":
        raise HTTPException(status_code=400, detail=f"Interview is {interview.status}")

    return interview


# ── Validate interview link ───────────────────────────────────────────────────

@router.get("/interview/{token}", response_model=PublicInterviewInfo)
async def validate_interview_link(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Candidate opens the interview link — validate token and return basic info.
    This does NOT start the session.
    """
    interview = await _get_valid_interview(db, token)

    return PublicInterviewInfo(
        job_position=interview.job_position,
        duration_minutes=interview.duration_minutes,
        question_count=len(interview.questions),
        interview_types=[t.type_name for t in interview.interview_types],
    )


# ── Start session ─────────────────────────────────────────────────────────────

@router.post("/interview/{token}/start", response_model=SessionResponse)
async def start_interview_session(
    token: str,
    data: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Candidate clicks 'Start Interview' — create candidate record and session.
    Returns session details including all questions.
    """
    interview = await _get_valid_interview(db, token)

    # Create candidate record
    candidate = Candidate(
        interview_id=interview.id,
        name=data.candidate_name,
        email=data.candidate_email,
        status="active",
        joined_at=datetime.now(timezone.utc),
    )
    db.add(candidate)
    await db.flush()

    # Create session
    session = InterviewSession(
        interview_id=interview.id,
        candidate_id=candidate.id,
        session_status="active",
        current_question_index=0,
    )
    db.add(session)
    await db.flush()

    # Create initial question response record (for timestamp tracking)
    sorted_questions = sorted(interview.questions, key=lambda q: q.order_index)
    if sorted_questions:
        db.add(QuestionResponse(
            session_id=session.id,
            question_id=sorted_questions[0].id,
            question_start_time=datetime.now(timezone.utc),
        ))

    await db.commit()

    return SessionResponse(
        session_id=session.id,
        interview_id=interview.id,
        candidate_name=candidate.name,
        job_position=interview.job_position,
        duration_minutes=interview.duration_minutes,
        current_question_index=0,
        total_questions=len(sorted_questions),
        session_status="active",
        questions=[
            QuestionOut(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                order_index=q.order_index,
                expected_time_seconds=q.expected_time_seconds,
            )
            for q in sorted_questions
        ],
    )


# ── Get session state ─────────────────────────────────────────────────────────

@router.get("/session/{session_id}/state", response_model=SessionQuestionState)
async def get_session_state(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get current state of an interview session."""
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.interview).selectinload(Interview.questions))
        .where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    sorted_questions = sorted(session.interview.questions, key=lambda q: q.order_index)
    current_q = None
    if session.current_question_index < len(sorted_questions):
        q = sorted_questions[session.current_question_index]
        current_q = QuestionOut(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type,
            order_index=q.order_index,
            expected_time_seconds=q.expected_time_seconds,
        )

    return SessionQuestionState(
        session_id=session.id,
        current_question_index=session.current_question_index,
        total_questions=len(sorted_questions),
        current_question=current_q,
        session_status=session.session_status,
    )


# ── Next question ─────────────────────────────────────────────────────────────

@router.post("/session/{session_id}/next", response_model=SessionQuestionState)
async def next_question(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Advance to the next question. Stores timestamp for the current answer end."""
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.interview).selectinload(Interview.questions))
        .where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.session_status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    sorted_questions = sorted(session.interview.questions, key=lambda q: q.order_index)
    now = datetime.now(timezone.utc)

    # Mark current question's answer_end_time
    if session.current_question_index < len(sorted_questions):
        current_q = sorted_questions[session.current_question_index]
        # Update existing response or create one
        resp_result = await db.execute(
            select(QuestionResponse).where(
                QuestionResponse.session_id == session.id,
                QuestionResponse.question_id == current_q.id,
            )
        )
        resp = resp_result.scalar_one_or_none()
        if resp:
            resp.answer_end_time = now
        else:
            db.add(QuestionResponse(
                session_id=session.id,
                question_id=current_q.id,
                answer_end_time=now,
            ))

    # Advance
    new_index = session.current_question_index + 1
    session.current_question_index = new_index

    # Create response record for next question
    if new_index < len(sorted_questions):
        next_q = sorted_questions[new_index]
        db.add(QuestionResponse(
            session_id=session.id,
            question_id=next_q.id,
            question_start_time=now,
        ))

    await db.commit()

    # Build response
    current_q_out = None
    if new_index < len(sorted_questions):
        q = sorted_questions[new_index]
        current_q_out = QuestionOut(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type,
            order_index=q.order_index,
            expected_time_seconds=q.expected_time_seconds,
        )

    return SessionQuestionState(
        session_id=session.id,
        current_question_index=new_index,
        total_questions=len(sorted_questions),
        current_question=current_q_out,
        session_status=session.session_status,
    )


# ── Finish interview ──────────────────────────────────────────────────────────

@router.post("/session/{session_id}/finish")
async def finish_interview(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """End the interview session. In production, this triggers background analysis."""
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.candidate))
        .where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    session.session_status = "completed"
    session.ended_at = now

    if session.candidate:
        session.candidate.status = "completed"
        session.candidate.completed_at = now

    await db.commit()
    
    # Process instantly using real-time metrics
    try:
        await process_realtime_session(session_id, db)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error processing real-time session {session_id}: {e}", exc_info=True)

    return {
        "status": "completed",
        "session_id": session.id,
        "message": "Interview completed successfully. Report will be generated shortly.",
    }

"""
Interview service — orchestrates interview creation workflow.

Guide Section 6: create interview → generate questions → save → create token.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.db.models import (
    Interview, InterviewType, InterviewQuestion, Candidate,
    AnalysisResult, InterviewSession, ReportExport, QuestionAnalysis,
    SessionMetric, QuestionResponse,
)
from app.core.security import generate_interview_token, get_token_expiry
from app.services.question_generation_service import generate_questions
from app.schemas.interview import InterviewCreate


async def create_interview(
    db: AsyncSession,
    data: InterviewCreate,
    recruiter_id: int,
    base_url: str = "http://localhost:5173",
) -> Interview:
    """
    Full interview creation workflow:
    1. Generate secure access token
    2. Save interview record
    3. Save interview types
    4. Generate and save questions
    5. Return complete interview object
    """

    # 1. Generate token and expiry
    token = generate_interview_token()
    expires_at = get_token_expiry()

    # 2. Create interview record
    interview = Interview(
        recruiter_id=recruiter_id,
        job_position=data.job_position,
        job_description=data.job_description,
        duration_minutes=data.duration_minutes,
        access_token=token,
        expires_at=expires_at,
        status="active",
    )
    db.add(interview)
    await db.flush()  # get interview.id

    # 3. Save interview types
    for type_name in data.interview_types:
        db.add(InterviewType(interview_id=interview.id, type_name=type_name))

    # 4. Generate and save questions
    generated = generate_questions(
        job_position=data.job_position,
        job_description=data.job_description,
        interview_types=data.interview_types,
        duration_minutes=data.duration_minutes,
        number_of_questions=data.number_of_questions,
    )

    for q in generated:
        db.add(
            InterviewQuestion(
                interview_id=interview.id,
                question_text=q.question_text,
                question_type=q.question_type,
                order_index=q.order_index,
                expected_time_seconds=q.expected_time_seconds,
            )
        )

    await db.commit()

    # 5. Reload with relationships
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.interview_types),
            selectinload(Interview.questions),
        )
        .where(Interview.id == interview.id)
    )
    return result.scalar_one()


async def get_interview_by_id(db: AsyncSession, interview_id: int) -> Interview | None:
    """Get an interview by ID with all relationships loaded."""
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.interview_types),
            selectinload(Interview.questions),
        )
        .where(Interview.id == interview_id)
    )
    return result.scalar_one_or_none()


async def get_interview_by_token(db: AsyncSession, token: str) -> Interview | None:
    """Get an interview by its access token."""
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.interview_types),
            selectinload(Interview.questions),
        )
        .where(Interview.access_token == token)
    )
    return result.scalar_one_or_none()


async def list_interviews(db: AsyncSession, recruiter_id: int) -> list[Interview]:
    """List all interviews for a specific recruiter."""
    result = await db.execute(
        select(Interview)
        .where(Interview.recruiter_id == recruiter_id)
        .options(
            selectinload(Interview.interview_types),
            selectinload(Interview.questions),
        )
        .order_by(Interview.created_at.desc())
    )
    return list(result.scalars().all())


async def get_candidates_for_interview(db: AsyncSession, interview_id: int) -> list[dict]:
    """Fetch all candidates for a specific interview, including their scores if completed."""
    
    # We need Candidate and their completed Session's AnalysisResult
    stmt = (
        select(Candidate, InterviewSession, AnalysisResult)
        .outerjoin(InterviewSession, InterviewSession.candidate_id == Candidate.id)
        .outerjoin(AnalysisResult, AnalysisResult.session_id == InterviewSession.id)
        .where(Candidate.interview_id == interview_id)
        .order_by(Candidate.joined_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    candidates_list = []

    # Use a set to handle duplicate candidate rows if they have multiple sessions
    seen_candidates = set()

    for candidate, session, analysis in rows:
        if candidate.id in seen_candidates:
            continue

        seen_candidates.add(candidate.id)

        overall_score = None
        if analysis and analysis.overall_confidence_score is not None:
             overall_score = f"{int(analysis.overall_confidence_score)}%"

        candidates_list.append({
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "status": candidate.status,
            "completed_at": candidate.completed_at,
            "overall_score": overall_score,
            "report_url": f"/scheduled/{interview_id}/report/{candidate.id}" if candidate.status == "completed" else None,
            "session_id": session.id if session else None,
        })
        
    return candidates_list


async def delete_interview(db: AsyncSession, interview_id: int) -> None:
    """Delete an interview and all related data in correct FK order."""
    # Get all session IDs for this interview
    session_res = await db.execute(
        select(InterviewSession.id).where(InterviewSession.interview_id == interview_id)
    )
    session_ids = [row[0] for row in session_res.all()]

    # Get all question IDs for this interview
    question_res = await db.execute(
        select(InterviewQuestion.id).where(InterviewQuestion.interview_id == interview_id)
    )
    question_ids = [row[0] for row in question_res.all()]

    if session_ids:
        # Delete in bottom-up FK order
        await db.execute(delete(ReportExport).where(ReportExport.session_id.in_(session_ids)))
        await db.execute(delete(QuestionAnalysis).where(QuestionAnalysis.session_id.in_(session_ids)))
        await db.execute(delete(AnalysisResult).where(AnalysisResult.session_id.in_(session_ids)))
        await db.execute(delete(SessionMetric).where(SessionMetric.session_id.in_(session_ids)))
        await db.execute(delete(QuestionResponse).where(QuestionResponse.session_id.in_(session_ids)))
        await db.execute(delete(InterviewSession).where(InterviewSession.interview_id == interview_id))

    # Delete candidates
    await db.execute(delete(Candidate).where(Candidate.interview_id == interview_id))

    # Delete interview (ORM cascades interview_types and interview_questions)
    interview_res = await db.execute(
        select(Interview).where(Interview.id == interview_id)
    )
    interview = interview_res.scalar_one_or_none()
    if interview:
        await db.delete(interview)

    await db.commit()

"""
Recruiter interview API routes — guide Section 10.

Endpoints:
  POST /api/interviews          — create interview + generate questions + create link
  GET  /api/interviews          — list all interviews
  GET  /api/interviews/{id}     — get interview details
  GET  /api/interviews/{id}/questions — get questions for interview
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.interview import (
    InterviewCreate,
    InterviewResponse,
    InterviewListItem,
    QuestionOut,
    CandidateSummaryOut,
)
from app.services.interview_service import (
    create_interview,
    get_interview_by_id,
    list_interviews,
    get_candidates_for_interview,
    delete_interview,
)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


def _build_interview_link(request: Request, token: str) -> str:
    """Build the candidate-facing interview link."""
    # Try to determine the frontend host from the request
    # If the request came from a specific origin, use that.
    # Otherwise fallback to localhost:5173 for local dev.
    origin = request.headers.get("origin") or f"http://{request.url.hostname}:5173"
    if "localhost" in origin and ":5173" not in origin:
        origin = "http://localhost:5173"
        
    return f"{origin}/interview/start?token={token}"


@router.post("", response_model=InterviewResponse)
async def create_interview_endpoint(
    data: InterviewCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new interview with auto-generated questions and secure link."""
    interview = await create_interview(db, data, recruiter_id=current_user.id)

    return InterviewResponse(
        id=interview.id,
        job_position=interview.job_position,
        job_description=interview.job_description,
        duration_minutes=interview.duration_minutes,
        status=interview.status,
        access_token=interview.access_token,
        interview_link=_build_interview_link(request, interview.access_token),
        expires_at=interview.expires_at,
        created_at=interview.created_at,
        interview_types=[
            {"id": t.id, "type_name": t.type_name}
            for t in interview.interview_types
        ],
        questions=[
            {
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "order_index": q.order_index,
                "expected_time_seconds": q.expected_time_seconds,
            }
            for q in sorted(interview.questions, key=lambda x: x.order_index)
        ],
    )


@router.get("", response_model=list[InterviewListItem])
async def list_interviews_endpoint(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all interviews for the recruiter."""
    interviews = await list_interviews(db, recruiter_id=current_user.id)

    return [
        InterviewListItem(
            id=iv.id,
            job_position=iv.job_position,
            duration_minutes=iv.duration_minutes,
            status=iv.status,
            access_token=iv.access_token,
            interview_link=_build_interview_link(request, iv.access_token),
            question_count=len(iv.questions),
            expires_at=iv.expires_at,
            created_at=iv.created_at,
            interview_types=[t.type_name for t in iv.interview_types],
        )
        for iv in interviews
    ]


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview_endpoint(
    interview_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full details for a specific interview."""
    interview = await get_interview_by_id(db, interview_id)
    if not interview or interview.recruiter_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found")

    return InterviewResponse(
        id=interview.id,
        job_position=interview.job_position,
        job_description=interview.job_description,
        duration_minutes=interview.duration_minutes,
        status=interview.status,
        access_token=interview.access_token,
        interview_link=_build_interview_link(request, interview.access_token),
        expires_at=interview.expires_at,
        created_at=interview.created_at,
        interview_types=[
            {"id": t.id, "type_name": t.type_name}
            for t in interview.interview_types
        ],
        questions=[
            {
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "order_index": q.order_index,
                "expected_time_seconds": q.expected_time_seconds,
            }
            for q in sorted(interview.questions, key=lambda x: x.order_index)
        ],
    )


@router.get("/{interview_id}/questions", response_model=list[QuestionOut])
async def get_interview_questions_endpoint(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the question list for an interview."""
    interview = await get_interview_by_id(db, interview_id)
    if not interview or interview.recruiter_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found")

    return [
        QuestionOut(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type,
            order_index=q.order_index,
            expected_time_seconds=q.expected_time_seconds,
        )
        for q in sorted(interview.questions, key=lambda x: x.order_index)
    ]


@router.get("/{interview_id}/candidates", response_model=list[CandidateSummaryOut])
async def get_interview_candidates_endpoint(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the list of candidates and their completion status for an interview."""
    interview = await get_interview_by_id(db, interview_id)
    if not interview or interview.recruiter_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidates = await get_candidates_for_interview(db, interview_id)
    return candidates


@router.delete("/{interview_id}")
async def delete_interview_endpoint(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an interview and all related data."""
    interview = await get_interview_by_id(db, interview_id)
    if not interview or interview.recruiter_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found")

    await delete_interview(db, interview_id)
    return {"status": "deleted"}

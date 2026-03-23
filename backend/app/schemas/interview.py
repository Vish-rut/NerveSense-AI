"""Pydantic schemas for interview-related requests and responses."""

from datetime import datetime
from pydantic import BaseModel, Field


# ─── Interview Creation ────────────────────────────────────────────────────────

class InterviewCreate(BaseModel):
    job_position: str = Field(..., min_length=1, max_length=255)
    job_description: str | None = None
    duration_minutes: int = Field(default=30, ge=5, le=120)
    interview_types: list[str] = Field(default=["technical"])
    number_of_questions: int | None = Field(default=None, ge=1, le=20)


# ─── Interview Update ─────────────────────────────────────────────────────────

class InterviewUpdate(BaseModel):
    job_position: str | None = Field(default=None, min_length=1, max_length=255)
    job_description: str | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=120)


class QuestionOut(BaseModel):
    id: int
    question_text: str
    question_type: str
    order_index: int
    expected_time_seconds: int

    class Config:
        from_attributes = True


class InterviewTypeOut(BaseModel):
    id: int
    type_name: str

    class Config:
        from_attributes = True


class InterviewResponse(BaseModel):
    id: int
    job_position: str
    job_description: str | None = None
    duration_minutes: int
    status: str
    access_token: str
    interview_link: str
    expires_at: datetime
    created_at: datetime
    interview_types: list[InterviewTypeOut] = []
    questions: list[QuestionOut] = []

    class Config:
        from_attributes = True


class InterviewListItem(BaseModel):
    id: int
    job_position: str
    duration_minutes: int
    status: str
    access_token: str
    interview_link: str
    question_count: int
    expires_at: datetime
    created_at: datetime
    interview_types: list[str] = []

    class Config:
        from_attributes = True


class CandidateSummaryOut(BaseModel):
    id: int
    name: str
    email: str | None = None
    status: str
    completed_at: datetime | None = None
    overall_score: str | None = None
    report_url: str | None = None
    session_id: int | None = None

    class Config:
        from_attributes = True

# ─── Public Interview (Candidate-facing) ──────────────────────────────────────

class PublicInterviewInfo(BaseModel):
    """Info shown to candidate before starting the interview."""
    job_position: str
    duration_minutes: int
    question_count: int
    interview_types: list[str] = []


class SessionStartRequest(BaseModel):
    candidate_name: str = Field(..., min_length=1, max_length=255)
    candidate_email: str | None = None


class SessionResponse(BaseModel):
    session_id: int
    interview_id: int
    candidate_name: str
    job_position: str
    duration_minutes: int
    current_question_index: int
    total_questions: int
    session_status: str
    questions: list[QuestionOut] = []

    class Config:
        from_attributes = True


class SessionQuestionState(BaseModel):
    session_id: int
    current_question_index: int
    total_questions: int
    current_question: QuestionOut | None = None
    session_status: str

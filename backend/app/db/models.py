"""SQLAlchemy ORM models — mirrors guide Section 9 database design."""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    JSON,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


# ─── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), default="recruiter")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    interviews = relationship("Interview", back_populates="recruiter")


# ─── Interviews ────────────────────────────────────────────────────────────────

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    job_position = Column(String(255), nullable=False)
    job_description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=30)
    status = Column(String(50), default="active")  # active, completed, expired
    access_token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    recruiter = relationship("User", back_populates="interviews")
    interview_types = relationship(
        "InterviewType", back_populates="interview", cascade="all, delete-orphan"
    )
    questions = relationship(
        "InterviewQuestion", back_populates="interview", cascade="all, delete-orphan"
    )
    candidates = relationship("Candidate", back_populates="interview")
    sessions = relationship("InterviewSession", back_populates="interview")


class InterviewType(Base):
    __tablename__ = "interview_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    type_name = Column(String(100), nullable=False)

    interview = relationship("Interview", back_populates="interview_types")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(100), nullable=False)
    order_index = Column(Integer, nullable=False)
    expected_time_seconds = Column(Integer, default=120)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    interview = relationship("Interview", back_populates="questions")
    responses = relationship("QuestionResponse", back_populates="question")
    analysis = relationship("QuestionAnalysis", back_populates="question")


# ─── Candidates ────────────────────────────────────────────────────────────────

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    status = Column(String(50), default="pending")  # pending, active, completed
    joined_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    interview = relationship("Interview", back_populates="candidates")
    sessions = relationship("InterviewSession", back_populates="candidate")


# ─── Interview Sessions ───────────────────────────────────────────────────────

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    session_status = Column(String(50), default="active")  # active, completed, abandoned
    current_question_index = Column(Integer, default=0)
    raw_video_url = Column(String(500), nullable=True)
    raw_audio_url = Column(String(500), nullable=True)
    transcript_url = Column(String(500), nullable=True)

    interview = relationship("Interview", back_populates="sessions")
    candidate = relationship("Candidate", back_populates="sessions")
    responses = relationship(
        "QuestionResponse", back_populates="session", cascade="all, delete-orphan"
    )
    analysis_result = relationship(
        "AnalysisResult", back_populates="session", uselist=False
    )
    question_analyses = relationship("QuestionAnalysis", back_populates="session")
    metrics = relationship(
        "SessionMetric", back_populates="session", cascade="all, delete-orphan"
    )
    exports = relationship("ReportExport", back_populates="session")


# ─── Live Session Metrics ──────────────────────────────────────────────────────

class SessionMetric(Base):
    __tablename__ = "session_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("interview_questions.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)
    
    # Real-time scores and raw data at this timestamp
    confidence_score = Column(Float, nullable=True)
    nervousness_score = Column(Float, nullable=True)
    
    facial_metrics = Column(JSON, nullable=True)     # e.g. {"smile": 0.5, "eye_contact": 0.9}
    behavioral_metrics = Column(JSON, nullable=True) # e.g. {"posture": "stable", "self_touch": False}
    vocal_metrics = Column(JSON, nullable=True)      # e.g. {"speaking_rate": 120, "pitch_variance": 0.4}

    session = relationship("InterviewSession", back_populates="metrics")


# ─── Question Responses ───────────────────────────────────────────────────────

class QuestionResponse(Base):
    __tablename__ = "question_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("interview_questions.id"), nullable=False)
    question_start_time = Column(DateTime(timezone=True), nullable=True)
    answer_start_time = Column(DateTime(timezone=True), nullable=True)
    answer_end_time = Column(DateTime(timezone=True), nullable=True)
    transcript_text = Column(Text, nullable=True)
    transcript_confidence = Column(Float, nullable=True)

    session = relationship("InterviewSession", back_populates="responses")
    question = relationship("InterviewQuestion", back_populates="responses")


# ─── Analysis Results (overall per session) ────────────────────────────────────

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        Integer, ForeignKey("interview_sessions.id"), unique=True, nullable=False
    )
    overall_confidence_score = Column(Float, nullable=True)
    overall_nervousness_score = Column(Float, nullable=True)
    facial_score = Column(Float, nullable=True)
    vocal_score = Column(Float, nullable=True)
    behavioral_score = Column(Float, nullable=True)
    component_details = Column(JSON, nullable=True)  # detailed breakdown from fusion engine
    summary_text = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("InterviewSession", back_populates="analysis_result")


# ─── Per-Question Analysis ─────────────────────────────────────────────────────

class QuestionAnalysis(Base):
    __tablename__ = "question_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("interview_questions.id"), nullable=False)
    confidence_score = Column(Float, nullable=True)
    nervousness_score = Column(Float, nullable=True)
    eye_contact_score = Column(Float, nullable=True)
    speaking_rate = Column(Float, nullable=True)
    filler_word_count = Column(Integer, nullable=True)
    posture_shift_count = Column(Integer, nullable=True)
    self_touch_count = Column(Integer, nullable=True)
    fidget_count = Column(Integer, nullable=True)
    notes_json = Column(JSON, nullable=True)

    session = relationship("InterviewSession", back_populates="question_analyses")
    question = relationship("InterviewQuestion", back_populates="analysis")


# ─── Report Exports ────────────────────────────────────────────────────────────

class ReportExport(Base):
    __tablename__ = "report_exports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    export_type = Column(String(10), nullable=False)  # pdf, csv, json
    file_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("InterviewSession", back_populates="exports")

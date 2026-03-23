"""
API routes for receiving real-time AI metrics from the client browser.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, Dict, Any

from app.db.session import get_db
from app.db.models import InterviewSession, SessionMetric
from pydantic import BaseModel

router = APIRouter(prefix="/api/public/session", tags=["Real-time Metrics"])

class MetricSnapshot(BaseModel):
    confidence_score: Optional[float] = None
    nervousness_score: Optional[float] = None
    facial_metrics: Optional[Dict[str, Any]] = None
    behavioral_metrics: Optional[Dict[str, Any]] = None
    vocal_metrics: Optional[Dict[str, Any]] = None
    question_id: Optional[int] = None

@router.post("/{session_id}/metrics")
async def receive_metrics(
    session_id: int,
    metrics: MetricSnapshot,
    db: AsyncSession = Depends(get_db)
):
    """
    Receive a snapshot of real-time metrics from the candidate's browser (e.g., every 5s).
    """
    # Verify session exists and is active
    stmt = select(InterviewSession).where(InterviewSession.id == session_id)
    result = await db.execute(stmt)
    db_session = result.scalars().first()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if db_session.session_status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # Store metric snapshot
    metric_record = SessionMetric(
        session_id=session_id,
        question_id=metrics.question_id,
        confidence_score=metrics.confidence_score,
        nervousness_score=metrics.nervousness_score,
        facial_metrics=metrics.facial_metrics,
        behavioral_metrics=metrics.behavioral_metrics,
        vocal_metrics=metrics.vocal_metrics
    )
    
    db.add(metric_record)
    await db.commit()
    
    return {"status": "ok", "recorded": True}

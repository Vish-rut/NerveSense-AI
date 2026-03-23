"""
Media upload API route — allows the frontend to upload video/audio recordings
after interview completion. Triggers background analysis pipeline.
"""
import asyncio
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import InterviewSession
from app.services.media_service import save_upload
from app.services.analysis_service import process_session
from fastapi import Depends

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public", tags=["media"])


@router.post("/session/{session_id}/media")
async def upload_media(
    session_id: int,
    background_tasks: BackgroundTasks,
    video: UploadFile = File(None),
    audio: UploadFile = File(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload video and/or audio recording for a completed interview session.
    After upload, enqueues a background task to run the analysis pipeline.
    """
    # Verify session exists
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.session_status not in ("completed", "analyzed", "analysis_failed"):
        raise HTTPException(
            status_code=400,
            detail=f"Session is in '{session.session_status}' state. Expected 'completed'."
        )

    video_path = None
    audio_path = None

    # Save video file
    if video and video.filename:
        video_path = await save_upload(video, session_id, "video")
        session.raw_video_url = video_path
        logger.info(f"Video saved for session {session_id}: {video_path}")

    # Save audio file
    if audio and audio.filename:
        audio_path = await save_upload(audio, session_id, "audio")
        session.raw_audio_url = audio_path
        logger.info(f"Audio saved for session {session_id}: {audio_path}")

    if not video_path and not audio_path:
        raise HTTPException(status_code=400, detail="At least one media file (video or audio) is required")

    await db.commit()

    # Trigger background analysis
    # Note: Using FastAPI BackgroundTasks for simplicity.
    # For production, replace with Celery + Redis.
    background_tasks.add_task(_run_analysis, session_id)

    return {
        "status": "uploaded",
        "session_id": session_id,
        "video_path": video_path,
        "audio_path": audio_path,
        "message": "Media uploaded successfully. Analysis will begin shortly."
    }


async def _run_analysis(session_id: int):
    """Run the analysis pipeline in a background task with its own DB session."""
    from app.db.session import async_session_factory

    async with async_session_factory() as db:
        try:
            await process_session(session_id, db)
        except Exception as e:
            logger.error(f"Background analysis failed for session {session_id}: {e}", exc_info=True)

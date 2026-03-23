"""SQLAlchemy async session and engine configuration."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Resolve the effective URL (handles password URL-encoding)
_db_url = settings.effective_database_url

# PostgreSQL needs pool settings; SQLite does not
_engine_kwargs = dict(echo=settings.DEBUG, future=True)
if _db_url.startswith("postgresql"):
    _engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=300,
    )

engine = create_async_engine(_db_url, **_engine_kwargs)
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency that yields a database session."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables. Called on app startup."""
    async with engine.begin() as conn:
        from app.db.models import (  # noqa: F401 — ensure models are imported
            User,
            Interview,
            InterviewType,
            InterviewQuestion,
            Candidate,
            InterviewSession,
            QuestionResponse,
            AnalysisResult,
            QuestionAnalysis,
            ReportExport,
        )
        await conn.run_sync(Base.metadata.create_all)

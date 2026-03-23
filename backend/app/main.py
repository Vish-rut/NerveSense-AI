"""
NerveSenseAI — FastAPI Application Entry Point.

Registers all routers, configures CORS, and initializes the database.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import init_db
from app.api.routes.auth import router as auth_router
from app.api.routes.interviews import router as interviews_router
from app.api.routes.public_interview import router as public_router
from app.api.routes.media import router as media_router
from app.api.routes.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup: create database tables
    await init_db()
    print("✅ Database tables created")
    yield
    # Shutdown: cleanup if needed
    print("👋 NerveSenseAI shutting down")


app = FastAPI(
    title="NerveSenseAI API",
    description="AI-powered interview analysis platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(interviews_router)
app.include_router(public_router)
app.include_router(media_router)
app.include_router(reports_router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}

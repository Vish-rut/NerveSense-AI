"""
NerveSenseAI — FastAPI Application Entry Point.

Registers all routers, configures CORS, and initializes the database.
"""

import os
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
    print(f"✅ CORS origins: {ALLOWED_ORIGINS}")
    yield
    # Shutdown: cleanup if needed
    print("👋 NerveSenseAI shutting down")


# ── Build CORS origins directly (bypasses pydantic parsing issues) ────────────
ALLOWED_ORIGINS = [
    "https://nerve-sense-ai.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
# Allow adding extra origins from env (comma-separated)
_extra = os.environ.get("EXTRA_CORS_ORIGINS", "")
if _extra:
    ALLOWED_ORIGINS.extend([o.strip() for o in _extra.split(",") if o.strip()])


app = FastAPI(
    title="NerveSenseAI API",
    description="AI-powered interview analysis platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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

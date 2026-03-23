"""Security utilities: interview tokens + JWT auth for recruiters."""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
import bcrypt

from .config import settings

# ── Password hashing ──────────────────────────────────────────────────────────

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT tokens ─────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


# ── Interview link tokens ─────────────────────────────────────────────────────

def generate_interview_token() -> str:
    """Generate a secure random token for interview links."""
    return secrets.token_urlsafe(32)


def generate_short_id() -> str:
    """Generate a short human-friendly ID (10 chars)."""
    return secrets.token_hex(5)


def hash_token(token: str) -> str:
    """Hash a token for storage (one-way)."""
    return hashlib.sha256(token.encode()).hexdigest()


def get_token_expiry() -> datetime:
    """Get the expiry datetime for a new interview token."""
    return datetime.now(timezone.utc) + timedelta(
        days=settings.INTERVIEW_TOKEN_EXPIRE_DAYS
    )


def is_token_expired(expires_at: datetime) -> bool:
    """Check if a token has expired."""
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return now > expires_at


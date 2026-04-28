"""Password hashing, JWT tokens, cookie helpers and auth dependencies.

Performance notes:
- bcrypt rounds are configurable via `BCRYPT_ROUNDS` env (default 12).
  Hashing is the dominant CPU cost during login/registration; lower rounds
  on burst-heavy hosts (10 = ~4x faster, still industry-acceptable).
- get_current_user is hot-path: it reads from Redis only (token → user_id,
  user_id → cached user dict) and falls back to Mongo only if both miss.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response

from .config import ACCESS_TOKEN_TTL_DAYS, JWT_ALGORITHM
from .db import db
from .redis_client import (
    get_session,
    refresh_session,
    get_cached_user,
    cache_user,
)

BCRYPT_ROUNDS = int(os.getenv("BCRYPT_ROUNDS", "12"))


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=BCRYPT_ROUNDS),
    ).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        # `jti` ensures every token is unique even when issued back-to-back
        # for the same user, so multi-device sessions don't collide.
        "jti": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    secure_cookie = os.environ.get("COOKIE_SECURE", "").lower() in {"1", "true", "yes", "on"}
    same_site = os.environ.get("COOKIE_SAMESITE", "lax").lower()
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite=same_site,
        max_age=ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")


def _extract_token(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


async def get_current_user(request: Request) -> dict:
    """Resolve the authenticated user with minimal DB pressure.

    Path order:
      1. Decode JWT (CPU only).
      2. Look up `session:{token}` in Redis → user_id (proves the session
         hasn't been revoked).
      3. Fetch user from `user:{user_id}` Redis cache.
      4. Fall back to Mongo only if the cache is cold; then warm it.
    """
    token = _extract_token(request)

    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Token must still be a live session in Redis (server-side revocation).
    user_id = await get_session(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired")

    # Sliding TTL refresh on every request so active users stay logged in.
    await refresh_session(token)

    # Hot path: user dict from Redis cache.
    user = await get_cached_user(user_id)
    if user:
        # Stash the resolving token so route handlers (e.g. logout) can revoke it.
        user["_session_token"] = token
        return user

    # Cold path: pull from Mongo and warm the cache for next time.
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0},
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    from .services import sync_user_plan
    user = await sync_user_plan(user)
    await cache_user(user_id, user)
    user["_session_token"] = token
    return user


def require_super_admin(user: dict) -> dict:
    if (user or {}).get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

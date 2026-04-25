"""Password hashing, JWT tokens, cookie helpers and auth dependencies."""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response

from .config import ACCESS_TOKEN_TTL_DAYS, JWT_ALGORITHM
from .db import db


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


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


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_super_admin(user: dict) -> dict:
    if (user or {}).get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

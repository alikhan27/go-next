"""Auth endpoints: register, login, logout, forgot/reset-password, lock-account, me."""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from ..config import (
    ACCOUNT_LOCK_TTL_MINUTES,
    PASSWORD_RESET_PREVIEW_MODE,
    PASSWORD_RESET_TTL_MINUTES,
)
from ..db import db
from ..models import (
    CreateBusinessRequest,
    ForgotPasswordRequest,
    LockAccountRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from ..security import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from ..services import (
    clear_attempts,
    create_business_doc,
    enforce_lockout,
    list_user_businesses,
    public_business,
    record_failed_attempt,
    user_plan,
)

router = APIRouter(prefix="/auth")


@router.post("/register")
async def register(body: RegisterRequest, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.owner_name,
        "role": "owner",
        "plan": "free",
        "created_at": now,
    }
    await db.users.insert_one(user_doc)

    business = await create_business_doc(user_doc, CreateBusinessRequest(
        business_name=body.business_name,
        business_type=body.business_type,
        address=body.address,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
    ))

    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {
        "user": {"id": user_id, "email": email, "name": body.owner_name, "role": "owner", "plan": "free"},
        "businesses": [public_business(business)],
    }


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response):
    email = body.email.lower().strip()
    # Lock the account regardless of source IP — K8s ingress rotates
    # across proxy IPs so keying on client.host under-counts attempts.
    identifier = f"email:{email}"

    await enforce_lockout(identifier)

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("is_locked"):
        raise HTTPException(
            status_code=403,
            detail="This account has been frozen for safety. Contact support to restore access.",
        )

    await clear_attempts(identifier)

    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    businesses = await list_user_businesses(user["id"])
    return {
        "user": {
            "id": user["id"], "email": email,
            "name": user.get("name", ""),
            "role": user.get("role", "owner"),
            "plan": user_plan(user),
        },
        "businesses": businesses,
    }


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


def _origin_from_request(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    origin = request.headers.get("origin") or request.headers.get("referer") or base
    origin = origin.rstrip("/")
    if origin.count("/") > 2:
        origin = "/".join(origin.split("/")[:3])
    return origin


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, request: Request):
    """Generate a short-lived reset token. Preview mode returns the link
    directly; production mode will email it and return only {ok: True}."""
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    preview_link = None
    if user:
        # Invalidate older unused tokens for this user
        await db.password_resets.delete_many({"user_id": user["id"], "used_at": None})
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await db.password_resets.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "created_at": now,
            "expires_at": now + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES),
            "used_at": None,
        })
        preview_link = f"{_origin_from_request(request)}/reset-password?token={token}"

    response_body = {
        "ok": True,
        "message": "If this email is registered, you'll receive a password reset link shortly.",
        "ttl_minutes": PASSWORD_RESET_TTL_MINUTES,
    }
    if PASSWORD_RESET_PREVIEW_MODE and preview_link:
        response_body["preview_reset_link"] = preview_link
    return response_body


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, request: Request):
    record = await db.password_resets.find_one({"token": body.token}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if record.get("used_at"):
        raise HTTPException(status_code=400, detail="This reset link has already been used")

    expires_at = record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link has expired")

    user = await db.users.find_one({"id": record["user_id"]})
    if not user:
        raise HTTPException(status_code=400, detail="Account no longer exists")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    await db.password_resets.update_one(
        {"token": body.token},
        {"$set": {"used_at": datetime.now(timezone.utc)}},
    )
    # Unlock any login attempts for this email
    await clear_attempts(f"email:{user['email']}")

    # Issue a follow-up "lock my account" token for the security-alert flow
    now = datetime.now(timezone.utc)
    lock_token = secrets.token_urlsafe(32)
    await db.account_lock_tokens.insert_one({
        "token": lock_token,
        "user_id": user["id"],
        "email": user["email"],
        "created_at": now,
        "expires_at": now + timedelta(minutes=ACCOUNT_LOCK_TTL_MINUTES),
        "used_at": None,
    })
    lock_link = f"{_origin_from_request(request)}/lock-account?token={lock_token}"

    response_body = {
        "ok": True,
        "email": user["email"],
        "lock_ttl_hours": ACCOUNT_LOCK_TTL_MINUTES // 60,
    }
    if PASSWORD_RESET_PREVIEW_MODE:
        response_body["preview_lock_link"] = lock_link
    return response_body


@router.post("/lock-account")
async def lock_account(body: LockAccountRequest):
    record = await db.account_lock_tokens.find_one({"token": body.token}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired lock link")
    if record.get("used_at"):
        raise HTTPException(status_code=400, detail="This lock link has already been used")
    expires_at = record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This lock link has expired")

    user = await db.users.find_one({"id": record["user_id"]})
    if not user:
        raise HTTPException(status_code=400, detail="Account no longer exists")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "is_locked": True,
            "locked_at": datetime.now(timezone.utc).isoformat(),
            "locked_reason": "user_reported_unauthorized_reset",
        }},
    )
    await db.account_lock_tokens.update_one(
        {"token": body.token},
        {"$set": {"used_at": datetime.now(timezone.utc)}},
    )
    # Invalidate any other outstanding reset tokens + force sign-out everywhere
    await db.password_resets.delete_many({"user_id": user["id"], "used_at": None})
    await db.account_lock_tokens.update_many(
        {"user_id": user["id"], "used_at": None},
        {"$set": {"used_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True, "email": user["email"]}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    businesses = await list_user_businesses(user["id"])
    return {
        "user": {
            "id": user["id"], "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "owner"),
            "plan": user_plan(user),
        },
        "businesses": businesses,
    }

"""Shared domain helpers: plan limits, brute-force throttle, outlet lookups,
and public-response shaping for business + ticket documents."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from .config import LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MINUTES, PLAN_LIMITS
from .db import db
from .models import CreateBusinessRequest


# ----------------- Plans -----------------
def user_plan(user: dict) -> str:
    p = (user or {}).get("plan") or "free"
    return p if p in PLAN_LIMITS else "free"


def plan_limits(user: dict) -> dict:
    return PLAN_LIMITS[user_plan(user)]


# ----------------- Brute-force protection -----------------
async def _recent_attempts(identifier: str) -> list:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
    return (
        await db.login_attempts.find(
            {"identifier": identifier, "attempted_at": {"$gte": cutoff}}
        )
        .sort("attempted_at", 1)
        .to_list(100)
    )


async def record_failed_attempt(identifier: str) -> None:
    await db.login_attempts.insert_one(
        {"identifier": identifier, "attempted_at": datetime.now(timezone.utc)}
    )


async def clear_attempts(identifier: str) -> None:
    await db.login_attempts.delete_many({"identifier": identifier})


async def enforce_lockout(identifier: str) -> None:
    attempts = await _recent_attempts(identifier)
    if len(attempts) < LOCKOUT_THRESHOLD:
        return
    oldest = attempts[0]["attempted_at"]
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=timezone.utc)
    unlock_at = oldest + timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
    remaining_seconds = (unlock_at - datetime.now(timezone.utc)).total_seconds()
    remaining_minutes = max(1, int((remaining_seconds + 59) // 60))
    raise HTTPException(
        status_code=429,
        detail=f"Too many failed attempts. Try again in {remaining_minutes} minute(s).",
    )


# ----------------- Public shape helpers -----------------
def public_business(b: dict) -> dict:
    return {
        "id": b["id"],
        "business_name": b.get("business_name", ""),
        "business_type": b.get("business_type", "salon"),
        "address": b.get("address", ""),
        "city": b.get("city", ""),
        "state": b.get("state", ""),
        "pincode": b.get("pincode", ""),
        "total_chairs": b.get("total_chairs", 1),
        "token_limit": b.get("token_limit", 100),
        "is_online": b.get("is_online", True),
        "station_label": b.get("station_label", "Station"),
    }


def public_ticket(t: dict) -> dict:
    return {
        "id": t["id"],
        "business_id": t["business_id"],
        "customer_name": t["customer_name"],
        "customer_phone": t.get("customer_phone", ""),
        "token_number": t["token_number"],
        "status": t["status"],
        "booking_type": t.get("booking_type", "remote"),
        "chair_number": t.get("chair_number"),
        "created_at": t.get("created_at"),
        "served_at": t.get("served_at"),
        "finished_at": t.get("finished_at"),
    }


# ----------------- Business lookups -----------------
async def next_token_number(business_id: str) -> int:
    last = await db.queue.find(
        {"business_id": business_id}, {"_id": 0, "token_number": 1}
    ).sort("token_number", -1).limit(1).to_list(1)
    return (last[0]["token_number"] + 1) if last else 1


async def owned_business_or_404(user_id: str, business_id: str) -> dict:
    b = await db.businesses.find_one(
        {"id": business_id, "owner_user_id": user_id}, {"_id": 0}
    )
    if not b:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return b


async def list_user_businesses(user_id: str) -> list:
    docs = (
        await db.businesses.find({"owner_user_id": user_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(1000)
    )
    return [public_business(b) for b in docs]


async def create_business_doc(user: dict, body: CreateBusinessRequest) -> dict:
    limits = plan_limits(user)
    existing_count = await db.businesses.count_documents({"owner_user_id": user["id"]})
    if existing_count >= limits["max_outlets"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your {user_plan(user).title()} plan allows up to "
                f"{limits['max_outlets']} outlet(s). Upgrade to add more."
            ),
        )
    now = datetime.now(timezone.utc).isoformat()
    business = {
        "id": str(uuid.uuid4()),
        "owner_user_id": user["id"],
        "business_name": body.business_name,
        "business_type": body.business_type,
        "address": body.address,
        "city": body.city,
        "state": body.state,
        "pincode": body.pincode,
        "total_chairs": 1,
        "token_limit": min(50, limits["max_tokens_per_day"]),
        "is_online": True,
        "station_label": "Station",
        "created_at": now,
    }
    await db.businesses.insert_one(business)
    return business

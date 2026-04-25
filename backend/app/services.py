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


def require_paid_plan(user: dict) -> None:
    """Premium and Premium Plus only — used for service management."""
    if not plan_limits(user).get("can_manage_services"):
        plan = user_plan(user).title()
        raise HTTPException(
            status_code=403,
            detail=f"Custom services require Premium. You're on the {plan} plan.",
        )


async def resolve_service_for_ticket(business_id: str, service_id: str | None) -> dict | None:
    """Fetch the active service belonging to this outlet, or 404 if it
    doesn't exist or belongs to a different outlet. Returns None when no
    service was selected (outlet may not use services at all)."""
    if not service_id:
        return None
    svc = await db.services.find_one(
        {"id": service_id, "business_id": business_id, "is_active": True},
        {"_id": 0},
    )
    if not svc:
        raise HTTPException(status_code=400, detail="Selected service is unavailable")
    return svc


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
        "offline_message": b.get("offline_message", ""),
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
        "service_id": t.get("service_id"),
        "service_name": t.get("service_name"),
        "service_duration_minutes": t.get("service_duration_minutes"),
        "created_at": t.get("created_at"),
        "served_at": t.get("served_at"),
        "finished_at": t.get("finished_at"),
    }


def public_service(s: dict) -> dict:
    return {
        "id": s["id"],
        "business_id": s["business_id"],
        "name": s.get("name", ""),
        "duration_minutes": int(s.get("duration_minutes", 15)),
        "price": float(s.get("price", 0) or 0),
        "sort_order": int(s.get("sort_order", 0)),
        "is_active": bool(s.get("is_active", True)),
        "created_at": s.get("created_at"),
    }


# ---- ETA helpers ----
DEFAULT_SERVICE_MINUTES = 15


def _ticket_minutes(t: dict) -> int:
    d = t.get("service_duration_minutes")
    try:
        return int(d) if d else DEFAULT_SERVICE_MINUTES
    except (TypeError, ValueError):
        return DEFAULT_SERVICE_MINUTES


async def estimate_wait_for_ticket(ticket: dict, business: dict | None) -> int:
    """Minutes the given waiting ticket should expect before being called.

    Sum the service durations of waiting tickets ahead, then divide by the
    number of stations to account for parallel service. A ticket's own
    service duration is the wait it imposes on the next person, not
    itself, so we don't add it.
    """
    if not ticket or ticket.get("status") != "waiting":
        return 0
    business_id = ticket["business_id"]
    chairs = max(int((business or {}).get("total_chairs", 1)), 1)

    ahead = await db.queue.find(
        {
            "business_id": business_id,
            "status": "waiting",
            "token_number": {"$lt": ticket["token_number"]},
        },
        {"_id": 0, "service_duration_minutes": 1},
    ).to_list(1000)
    ahead_minutes = sum(_ticket_minutes(t) for t in ahead)

    serving_count = await db.queue.count_documents(
        {"business_id": business_id, "status": "serving"}
    )
    available_now = max(chairs - serving_count, 0)
    position = len(ahead) + 1

    if position <= available_now:
        return 0

    return int(round(ahead_minutes / chairs))


async def estimate_wait_for_new_join(business: dict) -> int:
    """Wait time a brand-new joiner would see right now (used by the
    public queue-summary preview before the customer fills the form)."""
    business_id = business["id"]
    chairs = max(int(business.get("total_chairs", 1)), 1)

    waiting = await db.queue.find(
        {"business_id": business_id, "status": "waiting"},
        {"_id": 0, "service_duration_minutes": 1},
    ).to_list(1000)
    serving_count = await db.queue.count_documents(
        {"business_id": business_id, "status": "serving"}
    )
    available_now = max(chairs - serving_count, 0)
    if len(waiting) < available_now:
        return 0
    total_minutes = sum(_ticket_minutes(t) for t in waiting)
    return int(round(total_minutes / chairs))


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

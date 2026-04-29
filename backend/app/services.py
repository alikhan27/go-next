"""Shared domain helpers: plan limits, brute-force throttle, outlet lookups,
and public-response shaping for business + ticket documents."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .config import (
    DEFAULT_PLAN_LIMITS,
    LOCKOUT_THRESHOLD,
    LOCKOUT_WINDOW_MINUTES,
    PAID_PLAN_DURATION_DAYS,
    PLAN_LIMITS,
)
from .db import db
from .models import CreateBusinessRequest


# ----------------- Plans -----------------
def user_plan(user: dict) -> str:
    p = (user or {}).get("plan") or "free"
    return p if p in PLAN_LIMITS else "free"


def parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            normalized = value.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(normalized)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def paid_plan_expires_at(start: Optional[datetime] = None) -> datetime:
    return (start or datetime.now(timezone.utc)) + timedelta(days=PAID_PLAN_DURATION_DAYS)


async def sync_user_plan(user: dict) -> dict:
    if not user:
        return user
    plan = user_plan(user)
    expires_at = parse_dt(user.get("plan_expires_at"))
    pending_plan = user.get("pending_plan")
    now = datetime.now(timezone.utc)
    if plan == "free" or not expires_at or expires_at > now:
        return user

    next_plan = pending_plan if pending_plan in PLAN_LIMITS else "free"
    updates = {
        "plan": next_plan,
        "plan_started_at": now.isoformat(),
        "pending_plan": None,
        "pending_plan_requested_at": None,
    }
    if next_plan == "free":
        updates["plan_expires_at"] = None
    else:
        updates["plan_expires_at"] = paid_plan_expires_at(now).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    # Drop cached user dict so the next request sees the new plan.
    from .redis_client import invalidate_user_cache
    await invalidate_user_cache(user["id"])
    return {**user, **updates}


def public_user(user: dict) -> dict:
    expires_at = parse_dt(user.get("plan_expires_at"))
    now = datetime.now(timezone.utc)
    days_remaining = None
    if expires_at:
        seconds = (expires_at - now).total_seconds()
        days_remaining = max(0, int((seconds + 86399) // 86400))
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "owner"),
        "plan": user_plan(user),
        "plan_started_at": user.get("plan_started_at"),
        "plan_expires_at": user.get("plan_expires_at"),
        "plan_days_remaining": days_remaining,
        "pending_plan": user.get("pending_plan"),
        "pending_plan_requested_at": user.get("pending_plan_requested_at"),
    }


def plan_limits(user: dict) -> dict:
    return PLAN_LIMITS[user_plan(user)]


def public_plan(plan_id: str) -> dict:
    labels = {
        "free": "Free",
        "premium": "Premium",
        "premium_plus": "Premium Plus",
    }
    prices = {
        "free": 0,
        "premium": 19,
        "premium_plus": 49,
    }
    limits = PLAN_LIMITS[plan_id]
    return {
        "id": plan_id,
        "name": labels[plan_id],
        "label": labels[plan_id],
        "price_monthly": prices[plan_id],
        **limits,
    }


def apply_plan_catalog(overrides: Optional[dict] = None) -> dict:
    PLAN_LIMITS.clear()
    for plan_id, defaults in DEFAULT_PLAN_LIMITS.items():
        source = overrides.get(plan_id, {}) if isinstance(overrides, dict) else {}
        PLAN_LIMITS[plan_id] = {
            "max_outlets": int(source.get("max_outlets", defaults["max_outlets"])),
            "max_stations": int(source.get("max_stations", defaults["max_stations"])),
            "max_tokens_per_day": int(source.get("max_tokens_per_day", defaults["max_tokens_per_day"])),
            "analytics_days": int(source.get("analytics_days", defaults["analytics_days"])),
            "can_manage_services": bool(source.get("can_manage_services", defaults["can_manage_services"])),
            "max_services": int(source.get("max_services", defaults["max_services"])),
            "features": [
                str(item).strip()
                for item in source.get("features", defaults.get("features", []))
                if str(item).strip()
            ][:20] or list(defaults.get("features", [])),
        }
    return PLAN_LIMITS


def require_paid_plan(user: dict) -> None:
    """Premium and Premium Plus only — used for service management."""
    if not plan_limits(user).get("can_manage_services"):
        plan = user_plan(user).title()
        raise HTTPException(
            status_code=403,
            detail=f"Custom services require Premium. You're on the {plan} plan.",
        )


def requested_service_ids(service_ids: Optional[List[str]], service_id: Optional[str] = None) -> List[str]:
    ids = []
    seen = set()
    for candidate in (service_ids or []) + ([service_id] if service_id else []):
        if candidate and candidate not in seen:
            ids.append(candidate)
            seen.add(candidate)
    return ids


async def resolve_services_for_ticket(
    business_id: str,
    service_ids: Optional[List[str]] = None,
    service_id: Optional[str] = None,
) -> List[dict]:
    """Fetch active services for this outlet in the same order requested."""
    ids = requested_service_ids(service_ids, service_id)
    if not ids:
        return []
    docs = await db.services.find(
        {"id": {"$in": ids}, "business_id": business_id, "is_active": True},
        {"_id": 0},
    ).to_list(len(ids))
    by_id = {svc["id"]: svc for svc in docs}
    services = [by_id[sid] for sid in ids if sid in by_id]
    if len(services) != len(ids):
        raise HTTPException(status_code=400, detail="One or more selected services are unavailable")
    return services


def ticket_service_fields(services: list[dict]) -> dict:
    ids = [svc["id"] for svc in services]
    names = [svc["name"] for svc in services]
    duration = sum(int(svc.get("duration_minutes") or 0) for svc in services)
    price = sum(float(svc.get("price", 0) or 0) for svc in services)
    return {
        "service_ids": ids,
        "service_names": names,
        "service_count": len(ids),
        "service_id": ids[0] if len(ids) == 1 else None,
        "service_name": ", ".join(names) if names else None,
        "service_duration_minutes": duration or None,
        "service_price": price,
    }


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
    phone = t.get("customer_phone", "")
    masked_phone = ""
    if phone:
        # Show last 4 digits, mask the rest
        clean_phone = "".join(filter(str.isdigit, phone))
        if len(clean_phone) > 4:
            masked_phone = "*" * (len(clean_phone) - 4) + clean_phone[-4:]
        else:
            masked_phone = phone # Too short to mask meaningfully

    return {
        "id": t["id"],
        "business_id": t["business_id"],
        "customer_name": t["customer_name"],
        "customer_phone": masked_phone,
        "token_number": t["token_number"],
        "status": t["status"],
        "booking_type": t.get("booking_type", "remote"),
        "chair_number": t.get("chair_number"),
        "service_ids": t.get("service_ids", []),
        "service_names": t.get("service_names", []),
        "service_count": int(t.get("service_count", 0) or 0),
        "service_id": t.get("service_id"),
        "service_name": t.get("service_name"),
        "service_duration_minutes": t.get("service_duration_minutes"),
        "service_price": float(t.get("service_price", 0) or 0),
        "paid": bool(t.get("paid", False)),
        "payment_method": t.get("payment_method"),
        "paid_at": t.get("paid_at"),
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


async def estimate_wait_for_ticket(ticket: dict, business: Optional[dict]) -> int:
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


def utc_day_bounds(now: Optional[datetime] = None) -> tuple[datetime, datetime]:
    ref = now or datetime.now(timezone.utc)
    start = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


async def issued_today_count(business_id: str, now: Optional[datetime] = None) -> int:
    start, end = utc_day_bounds(now)
    return await db.queue.count_documents(
        {
            "business_id": business_id,
            "created_at": {
                "$gte": start.isoformat(),
                "$lt": end.isoformat(),
            },
        }
    )


def _free_chair_number(business: dict, serving_tickets: List[dict]) -> Optional[int]:
    taken = {s.get("chair_number") for s in serving_tickets if s.get("chair_number")}
    total_chairs = max(int(business.get("total_chairs", 1)), 1)
    for i in range(1, total_chairs + 1):
        if i not in taken:
            return i
    return None


async def assign_waiting_ticket_to_chair(
    business: dict,
    ticket_id: Optional[str] = None,
    prefer_next: bool = False,
    chair_number: Optional[int] = None,
) -> dict:
    """Promote a waiting ticket to serving while keeping chair assignment unique.

    The unique partial index on `(business_id, chair_number)` for serving tickets
    prevents duplicate live chair assignments even when two operators click at
    almost the same time. We retry a few times if another request wins the race.
    """
    if not ticket_id and not prefer_next:
        raise ValueError("assign_waiting_ticket_to_chair requires ticket_id or prefer_next")

    business_id = business["id"]
    start, end = utc_day_bounds()
    today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    for _ in range(5):
        # We must look at ALL serving tickets to find a free chair,
        # otherwise yesterday's "ghost" serving tickets will block the unique index.
        serving_tickets = await db.queue.find(
            {"business_id": business_id, "status": "serving"},
            {"_id": 0, "chair_number": 1},
        ).to_list(1000)
        
        if chair_number is not None:
            # Verify the requested chair is within bounds and not taken
            total_chairs = max(int(business.get("total_chairs", 1)), 1)
            if not (1 <= chair_number <= total_chairs):
                raise HTTPException(status_code=400, detail=f"Invalid {business.get('station_label', 'Station')} number")
            taken = {s.get("chair_number") for s in serving_tickets if s.get("chair_number")}
            if chair_number in taken:
                raise HTTPException(status_code=400, detail=f"{business.get('station_label', 'Station')} {chair_number} is already busy")
            chair = chair_number
        else:
            chair = _free_chair_number(business, serving_tickets)
            if chair is None:
                raise HTTPException(status_code=400, detail="All stations are currently busy")

        if ticket_id:
            target = await db.queue.find_one(
                {"id": ticket_id, "business_id": business_id},
                {"_id": 0},
            )
            if not target:
                raise HTTPException(status_code=404, detail="Ticket not found")
            if target.get("status") != "waiting":
                raise HTTPException(status_code=400, detail="Only waiting tickets can be started")
            target_id = target["id"]
        else:
            target = await db.queue.find_one(
                {"business_id": business_id, "status": "waiting", "created_at": today_query},
                {"_id": 0},
                sort=[("created_at", 1), ("token_number", 1)],
            )
            if not target:
                raise HTTPException(status_code=404, detail="No one in the waiting queue")
            target_id = target["id"]

        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            updated = await db.queue.find_one_and_update(
                {"id": target_id, "business_id": business_id, "status": "waiting"},
                {
                    "$set": {
                        "status": "serving",
                        "chair_number": chair,
                        "served_at": target.get("served_at") or now_iso,
                    }
                },
                projection={"_id": 0},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            if chair_number is not None:
                raise HTTPException(status_code=409, detail=f"{business.get('station_label', 'Station')} {chair_number} was just taken")
            continue
        if updated:
            return updated

    raise HTTPException(status_code=409, detail="Queue changed. Please try again.")


# ----------------- Business lookups -----------------
async def next_token_number(business_id: str) -> int:
    start, end = utc_day_bounds()
    last = await db.queue.find(
        {
            "business_id": business_id,
            "created_at": {
                "$gte": start.isoformat(),
                "$lt": end.isoformat(),
            },
        },
        {"_id": 0, "token_number": 1}
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
    """Return outlets owned by this user. Cached for 30 minutes in Redis;
    invalidate via `invalidate_user_businesses(user_id)` when outlets change.
    """
    from .redis_client import cache_get, cache_set
    cache_key = f"businesses:{user_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached
    docs = (
        await db.businesses.find({"owner_user_id": user_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(1000)
    )
    payload = [public_business(b) for b in docs]
    await cache_set(cache_key, payload, ttl=1800)
    return payload


async def invalidate_user_businesses(user_id: str) -> None:
    """Drop the cached business list for a user (call on outlet add/delete/edit)."""
    from .redis_client import cache_delete
    await cache_delete(f"businesses:{user_id}")


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

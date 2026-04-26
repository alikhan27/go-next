"""Public plan catalog."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..db import db
from ..models import PlanChangeRequest
from ..security import get_current_user
from ..services import parse_dt, paid_plan_expires_at, public_plan, public_user, sync_user_plan, user_plan

router = APIRouter()


@router.get("/plans")
async def plans():
    return {
        "plans": [
            public_plan("free"),
            public_plan("premium"),
            public_plan("premium_plus"),
        ],
    }


@router.get("/subscription")
async def subscription(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@router.post("/subscription/change")
async def change_subscription(body: PlanChangeRequest, user: dict = Depends(get_current_user)):
    current = user_plan(user)
    requested = body.plan
    if requested == current and not user.get("pending_plan"):
        return {
            "user": public_user(user),
            "message": "You're already on this plan.",
            "effective": "current",
        }

    now = datetime.now(timezone.utc)
    expires_at = user.get("plan_expires_at")
    active_until = None
    if expires_at:
        active_until = parse_dt(expires_at)

    if current != "free" and active_until and active_until > now:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "pending_plan": requested,
                "pending_plan_requested_at": now.isoformat(),
            }},
        )
        updated = {**user, "pending_plan": requested, "pending_plan_requested_at": now.isoformat()}
        return {
            "user": public_user(updated),
            "message": "Your plan change is scheduled for the end of the current billing period.",
            "effective": "after_expiry",
        }

    updates = {
        "plan": requested,
        "plan_started_at": now.isoformat(),
        "pending_plan": None,
        "pending_plan_requested_at": None,
    }
    if requested == "free":
        updates["plan_expires_at"] = None
    else:
        updates["plan_expires_at"] = paid_plan_expires_at(now).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    updated = await sync_user_plan(updated)
    return {
        "user": public_user(updated),
        "message": "Your plan has been updated.",
        "effective": "now",
    }

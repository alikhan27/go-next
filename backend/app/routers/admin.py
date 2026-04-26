"""Super-admin console endpoints: stats, user management, outlets, lockouts."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..config import LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MINUTES
from ..db import db
from ..models import AdminPlanUpdate, AdminUserUpdate
from ..security import get_current_user, require_super_admin
from ..services import apply_plan_catalog, clear_attempts, public_business, public_plan

router = APIRouter(prefix="/admin")

VALID_THEME_IDS = {"warm-sand", "midnight", "matcha", "arctic", "bloom"}
class ThemePayload(BaseModel):
    theme_id: str

@router.get("/theme")
async def get_theme():
    """Public — anyone can fetch the active theme (needed on app load)."""
    doc = await db.settings.find_one({"key": "theme"})
    theme_id = doc["value"] if doc else "warm-sand"
    return {"theme_id": theme_id}


@router.patch("/theme")
async def update_theme(
    payload: ThemePayload,
    user: dict = Depends(get_current_user),
):
    require_super_admin(user)
    if payload.theme_id not in VALID_THEME_IDS:
        raise HTTPException(status_code=400, detail=f"Invalid theme_id.")
    await db.settings.update_one(
        {"key": "theme"},
        {"$set": {"key": "theme", "value": payload.theme_id}},
        upsert=True,
    )
    return {"theme_id": payload.theme_id}

@router.get("/stats")
async def admin_stats(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    total_users = await db.users.count_documents({"role": "owner"})
    free_users = await db.users.count_documents({"role": "owner", "plan": {"$ne": "premium"}})
    premium_users = await db.users.count_documents({"role": "owner", "plan": "premium"})
    total_businesses = await db.businesses.count_documents({})
    total_tickets = await db.queue.count_documents({})
    today = datetime.now(timezone.utc).date().isoformat()
    completed_today = await db.queue.count_documents({
        "status": "completed", "finished_at": {"$regex": f"^{today}"},
    })
    return {
        "total_users": total_users,
        "free_users": free_users,
        "premium_users": premium_users,
        "total_businesses": total_businesses,
        "total_tickets": total_tickets,
        "completed_today": completed_today,
    }


@router.get("/plans")
async def admin_plans(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    return {
        "plans": [
            public_plan("free"),
            public_plan("premium"),
            public_plan("premium_plus"),
        ],
    }


@router.patch("/plans/{plan_id}")
async def admin_update_plan(
    plan_id: str,
    body: AdminPlanUpdate,
    user: dict = Depends(get_current_user),
):
    require_super_admin(user)
    if plan_id not in {"free", "premium", "premium_plus"}:
        raise HTTPException(status_code=404, detail="Plan not found")
    next_catalog = {
        "free": public_plan("free"),
        "premium": public_plan("premium"),
        "premium_plus": public_plan("premium_plus"),
    }
    payload = body.model_dump()
    payload["features"] = [item.strip() for item in payload.get("features", []) if item.strip()]
    next_catalog[plan_id] = {
        **next_catalog[plan_id],
        **payload,
    }
    sanitized = apply_plan_catalog(next_catalog)
    await db.settings.update_one(
        {"key": "plan_catalog"},
        {"$set": {"key": "plan_catalog", "value": sanitized}},
        upsert=True,
    )
    return public_plan(plan_id)


@router.get("/users")
async def admin_users(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    users = (
        await db.users.find({"role": "owner"}, {"_id": 0, "password_hash": 0})
        .sort("created_at", -1)
        .to_list(2000)
    )
    out = []
    for u in users:
        count = await db.businesses.count_documents({"owner_user_id": u["id"]})
        out.append({
            "id": u["id"],
            "email": u["email"],
            "name": u.get("name", ""),
            "plan": u.get("plan", "free"),
            "created_at": u.get("created_at"),
            "outlet_count": count,
            "is_locked": bool(u.get("is_locked", False)),
            "is_approved": u.get("is_approved", True),
            "locked_at": u.get("locked_at"),
            "locked_reason": u.get("locked_reason"),
        })
    return out


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    body: AdminUserUpdate,
    user: dict = Depends(get_current_user),
):
    require_super_admin(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates.get("is_locked") is False:
        # Unlocking also clears any login throttle on that account
        updates["locked_at"] = None
        updates["locked_reason"] = None
        await clear_attempts(f"email:{target['email']}")
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    updated.pop("password_hash", None)
    return updated


@router.post("/users/{user_id}/approve")
async def admin_approve_user(
    user_id: str,
    user: dict = Depends(get_current_user),
):
    """Approve a pending user - they can then log in."""
    require_super_admin(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_approved": True, "approved_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "message": f"User {target['email']} has been approved"}


@router.post("/users/{user_id}/reject")
async def admin_reject_user(
    user_id: str,
    user: dict = Depends(get_current_user),
):
    """Reject a pending user - they will remain unapproved."""
    require_super_admin(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_approved": False, "rejected_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "message": f"User {target['email']} has been rejected"}


@router.get("/users/pending")
async def admin_pending_users(user: dict = Depends(get_current_user)):
    """List all users pending approval."""
    require_super_admin(user)
    users = (
        await db.users.find(
            {"role": "owner", "is_approved": False},
            {"_id": 0, "password_hash": 0},
        )
        .sort("created_at", -1)
        .to_list(2000)
    )
    out = []
    for u in users:
        count = await db.businesses.count_documents({"owner_user_id": u["id"]})
        out.append({
            "id": u["id"],
            "email": u["email"],
            "name": u.get("name", ""),
            "plan": u.get("plan", "free"),
            "created_at": u.get("created_at"),
            "outlet_count": count,
        })
    return out


@router.get("/businesses")
async def admin_businesses(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    docs = await db.businesses.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    owner_ids = list({d["owner_user_id"] for d in docs if d.get("owner_user_id")})
    owners = {}
    if owner_ids:
        for u in await db.users.find(
            {"id": {"$in": owner_ids}},
            {"_id": 0, "id": 1, "email": 1, "name": 1, "plan": 1},
        ).to_list(2000):
            owners[u["id"]] = u
    out = []
    for b in docs:
        owner = owners.get(b.get("owner_user_id"), {})
        pb = public_business(b)
        pb["owner_email"] = owner.get("email", "")
        pb["owner_name"] = owner.get("name", "")
        pb["owner_plan"] = owner.get("plan", "free")
        out.append(pb)
    return out


@router.delete("/businesses/{business_id}")
async def admin_delete_business(business_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = await db.businesses.delete_one({"id": business_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outlet not found")
    await db.queue.delete_many({"business_id": business_id})
    await db.services.delete_many({"business_id": business_id})
    return {"ok": True}


@router.get("/security/lockouts")
async def admin_list_lockouts(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
    pipeline = [
        {"$match": {"attempted_at": {"$gte": cutoff}}},
        {
            "$group": {
                "_id": "$identifier",
                "count": {"$sum": 1},
                "last_attempt_at": {"$max": "$attempted_at"},
                "first_attempt_at": {"$min": "$attempted_at"},
            }
        },
        {"$sort": {"count": -1, "last_attempt_at": -1}},
    ]
    rows = await db.login_attempts.aggregate(pipeline).to_list(500)
    out = []
    now = datetime.now(timezone.utc)
    for r in rows:
        ident = r.get("_id") or ""
        email = ident.split(":", 1)[1] if ident.startswith("email:") else ident
        first = r.get("first_attempt_at")
        if first and first.tzinfo is None:
            first = first.replace(tzinfo=timezone.utc)
        unlock_at = first + timedelta(minutes=LOCKOUT_WINDOW_MINUTES) if first else None
        is_locked = r["count"] >= LOCKOUT_THRESHOLD
        out.append({
            "email": email,
            "failed_attempts": r["count"],
            "is_locked": is_locked,
            "first_attempt_at": first.isoformat() if first else None,
            "last_attempt_at": r.get("last_attempt_at").isoformat() if r.get("last_attempt_at") else None,
            "unlock_at": unlock_at.isoformat() if unlock_at else None,
            "unlock_in_minutes": (
                max(0, int(((unlock_at - now).total_seconds() + 59) // 60))
                if (unlock_at and is_locked) else 0
            ),
        })
    return out


@router.delete("/security/lockouts/{email}")
async def admin_clear_lockout(email: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    email = email.lower().strip()
    identifier = f"email:{email}"
    res = await db.login_attempts.delete_many({"identifier": identifier})
    return {"ok": True, "cleared": res.deleted_count}

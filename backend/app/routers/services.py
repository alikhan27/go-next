"""Outlet services (premium+) — owners can list/create/update/delete the
services they offer, with a duration in minutes used for ETA math, and
customers can view the active list on the public join page."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..models import CreateServiceRequest, UpdateServiceRequest
from ..security import get_current_user
from ..services import (
    owned_business_or_404,
    plan_limits,
    public_service,
    require_paid_plan,
)

router = APIRouter()


# ---------- Owner endpoints ----------
@router.get("/business/{business_id}/services")
async def list_services(business_id: str, user: dict = Depends(get_current_user)):
    await owned_business_or_404(user["id"], business_id)
    docs = await db.services.find({"business_id": business_id}, {"_id": 0}) \
        .sort([("sort_order", 1), ("created_at", 1)]) \
        .to_list(200)
    return [public_service(s) for s in docs]


@router.post("/business/{business_id}/services")
async def create_service(
    business_id: str,
    body: CreateServiceRequest,
    user: dict = Depends(get_current_user),
):
    await owned_business_or_404(user["id"], business_id)
    require_paid_plan(user)

    limits = plan_limits(user)
    existing = await db.services.count_documents({"business_id": business_id})
    if existing >= limits.get("max_services", 0):
        raise HTTPException(
            status_code=403,
            detail=f"You can have up to {limits['max_services']} services on your current plan.",
        )

    doc = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "name": body.name.strip(),
        "duration_minutes": int(body.duration_minutes),
        "sort_order": int(body.sort_order),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.services.insert_one(doc)
    return public_service(doc)


@router.patch("/business/{business_id}/services/{service_id}")
async def update_service(
    business_id: str,
    service_id: str,
    body: UpdateServiceRequest,
    user: dict = Depends(get_current_user),
):
    await owned_business_or_404(user["id"], business_id)
    require_paid_plan(user)

    svc = await db.services.find_one({"id": service_id, "business_id": business_id}, {"_id": 0})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if updates:
        await db.services.update_one({"id": service_id}, {"$set": updates})
    refreshed = await db.services.find_one({"id": service_id}, {"_id": 0})
    return public_service(refreshed)


@router.delete("/business/{business_id}/services/{service_id}")
async def delete_service(
    business_id: str,
    service_id: str,
    user: dict = Depends(get_current_user),
):
    await owned_business_or_404(user["id"], business_id)
    require_paid_plan(user)
    res = await db.services.delete_one({"id": service_id, "business_id": business_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"ok": True}


# ---------- Public endpoint ----------
public_router = APIRouter()


@public_router.get("/public/business/{business_id}/services")
async def public_list_services(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0, "id": 1})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    docs = await db.services.find(
        {"business_id": business_id, "is_active": True}, {"_id": 0},
    ).sort([("sort_order", 1), ("created_at", 1)]).to_list(200)
    return [public_service(s) for s in docs]

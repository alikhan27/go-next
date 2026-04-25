"""Public customer-facing endpoints: join queue, track ticket, TV display."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..db import db
from ..models import JoinQueueRequest
from ..services import (
    estimate_wait_for_new_join,
    estimate_wait_for_ticket,
    next_token_number,
    public_business,
    public_ticket,
    resolve_service_for_ticket,
)

router = APIRouter(prefix="/public")


@router.get("/business/{business_id}")
async def public_business_endpoint(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    return public_business(b)


@router.get("/business/{business_id}/queue-summary")
async def public_queue_summary(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    waiting = await db.queue.count_documents({"business_id": business_id, "status": "waiting"})
    serving = await db.queue.count_documents({"business_id": business_id, "status": "serving"})
    eta = await estimate_wait_for_new_join(b)
    return {
        "business": public_business(b),
        "waiting_count": waiting,
        "serving_count": serving,
        "total_chairs": b.get("total_chairs", 1),
        "estimated_wait_minutes": eta,
    }


@router.post("/business/{business_id}/join")
async def public_join(business_id: str, body: JoinQueueRequest):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    if not b.get("is_online", True):
        raise HTTPException(status_code=400, detail="This business is currently offline")

    today_waiting = await db.queue.count_documents(
        {"business_id": business_id, "status": {"$in": ["waiting", "serving"]}}
    )
    if today_waiting >= int(b.get("token_limit", 100)):
        raise HTTPException(status_code=400, detail="Queue limit reached. Please try later.")

    service = await resolve_service_for_ticket(business_id, body.service_id)

    # If the outlet has any active services published, force the customer
    # to pick one — keeps ETA math meaningful and avoids blank tickets.
    if not service:
        active_count = await db.services.count_documents(
            {"business_id": business_id, "is_active": True}
        )
        if active_count > 0:
            raise HTTPException(status_code=400, detail="Please choose a service to continue")

    token_number = await next_token_number(business_id)
    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ticket = {
        "id": ticket_id,
        "business_id": business_id,
        "customer_name": body.customer_name.strip(),
        "customer_phone": body.customer_phone.strip(),
        "token_number": token_number,
        "status": "waiting",
        "booking_type": "remote",
        "chair_number": None,
        "service_id": service["id"] if service else None,
        "service_name": service["name"] if service else None,
        "service_duration_minutes": int(service["duration_minutes"]) if service else None,
        "service_price": float(service.get("price", 0) or 0) if service else 0,
        "created_at": now,
        "served_at": None,
        "finished_at": None,
    }
    await db.queue.insert_one(ticket)
    return public_ticket(ticket)


@router.get("/ticket/{ticket_id}")
async def public_ticket_status(ticket_id: str):
    t = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    position = 0
    if t["status"] == "waiting":
        position = await db.queue.count_documents(
            {
                "business_id": t["business_id"],
                "status": "waiting",
                "token_number": {"$lt": t["token_number"]},
            }
        ) + 1
    b = await db.businesses.find_one({"id": t["business_id"]}, {"_id": 0})
    eta = await estimate_wait_for_ticket(t, b)
    return {
        "ticket": public_ticket(t),
        "position": position,
        "estimated_wait_minutes": eta,
        "business": public_business(b) if b else None,
    }


@router.get("/business/{business_id}/display")
async def public_display(business_id: str):
    """Data for the public TV 'Now Serving' screen."""
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    serving = (
        await db.queue.find({"business_id": business_id, "status": "serving"}, {"_id": 0})
        .sort("chair_number", 1)
        .to_list(50)
    )
    waiting = (
        await db.queue.find({"business_id": business_id, "status": "waiting"}, {"_id": 0})
        .sort("token_number", 1)
        .limit(6)
        .to_list(6)
    )
    waiting_count = await db.queue.count_documents(
        {"business_id": business_id, "status": "waiting"}
    )
    return {
        "business": public_business(b),
        "serving": [public_ticket(t) for t in serving],
        "upcoming": [public_ticket(t) for t in waiting],
        "waiting_count": waiting_count,
        "total_chairs": b.get("total_chairs", 1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

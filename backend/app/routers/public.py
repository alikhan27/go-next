"""Public customer-facing endpoints: join queue, track ticket, TV display."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..db import db
from ..models import JoinQueueRequest
from ..services import (
    issued_today_count,
    estimate_wait_for_new_join,
    estimate_wait_for_ticket,
    next_token_number,
    public_business,
    public_ticket,
    resolve_services_for_ticket,
    requested_service_ids,
    ticket_service_fields,
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

    tickets_issued_today = await issued_today_count(business_id)
    if tickets_issued_today >= int(b.get("token_limit", 100)):
        raise HTTPException(status_code=400, detail="Queue limit reached. Please try later.")

    services = await resolve_services_for_ticket(
        business_id,
        service_ids=body.service_ids,
        service_id=body.service_id,
    )

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
        "created_at": now,
        "served_at": None,
        "finished_at": None,
    }
    ticket.update(ticket_service_fields(services))
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

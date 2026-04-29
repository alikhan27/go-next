"""Public customer-facing endpoints: join queue, track ticket, TV display."""
import uuid
import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

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
    utc_day_bounds,
)
from ..redis_client import increment_rate_limit

router = APIRouter(prefix="/public")

# Basic rate limits for public join
IP_JOIN_LIMIT = 5 # max 5 joins per hour per IP
JOIN_LIMIT_TTL = 3600 # 1 hour

@router.get("/business/{business_id}")
async def public_business_endpoint(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    return public_business(b)


@router.get("/business/{business_id}/services")
async def public_business_services(business_id: str):
    docs = await db.services.find(
        {"business_id": business_id, "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return docs


@router.get("/business/{business_id}/queue-summary")
async def public_queue_summary(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    start, end = utc_day_bounds()
    today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    waiting = await db.queue.count_documents({
        "business_id": business_id,
        "status": "waiting",
        "created_at": today_query
    })
    serving = await db.queue.count_documents({
        "business_id": business_id,
        "status": "serving"
    })
    eta = await estimate_wait_for_new_join(b)
    return {
        "business": public_business(b),
        "waiting_count": waiting,
        "serving_count": serving,
        "total_chairs": b.get("total_chairs", 1),
        "estimated_wait_minutes": eta,
    }


@router.post("/business/{business_id}/join")
async def public_join(business_id: str, body: JoinQueueRequest, request: Request):
    # 1. IP-based rate limiting
    ip = request.client.host
    join_count = await increment_rate_limit(f"join_ip:{ip}", ttl=JOIN_LIMIT_TTL)
    if join_count > IP_JOIN_LIMIT:
        raise HTTPException(
            status_code=429, 
            detail="Too many join requests. Please wait before trying again."
        )

    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    if not b.get("is_online", True):
        raise HTTPException(status_code=400, detail="This business is currently offline")

    # 2. Basic phone validation (digits only, 10-15 chars)
    phone = body.customer_phone.strip()
    clean_phone = "".join(filter(str.isdigit, phone))
    if not (10 <= len(clean_phone) <= 15):
        raise HTTPException(status_code=400, detail="Please enter a valid mobile number")

    start, end = utc_day_bounds()
    today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}

    # SPAM PREVENTION: Check if this phone number already has an active ticket today for this business
    if phone:
        active_ticket = await db.queue.find_one({
            "business_id": business_id,
            "customer_phone": phone,
            "status": {"$in": ["waiting", "serving"]},
            "created_at": today_query
        })
        if active_ticket:
            raise HTTPException(
                status_code=400, 
                detail="You already have an active ticket in this queue. Please use your existing ticket."
            )

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
        "customer_phone": phone,
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


async def get_ticket_status_payload(ticket_id: str):
    t = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    if not t:
        return None
    
    business_id = t["business_id"]
    start, end = utc_day_bounds()
    today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    
    position = 0
    if t["status"] == "waiting":
        position = await db.queue.count_documents(
            {
                "business_id": business_id,
                "status": "waiting",
                "created_at": today_query,
                "token_number": {"$lt": t["token_number"]},
            }
        ) + 1
        
    waiting_count = await db.queue.count_documents({
        "business_id": business_id,
        "status": "waiting",
        "created_at": today_query
    })
    serving_count = await db.queue.count_documents({
        "business_id": business_id,
        "status": "serving"
    })
    
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    eta = await estimate_wait_for_ticket(t, b)
    
    return {
        "ticket": public_ticket(t),
        "position": position,
        "estimated_wait_minutes": eta,
        "business": public_business(b) if b else None,
        "waiting_count": waiting_count,
        "serving_count": serving_count,
    }


@router.get("/ticket/{ticket_id}")
async def public_ticket_status(ticket_id: str):
    payload = await get_ticket_status_payload(ticket_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return payload


@router.get("/ticket/{ticket_id}/events")
async def public_ticket_events(ticket_id: str):
    """SSE stream for a specific ticket to provide instant updates on status/position."""
    async def event_generator():
        last_payload = None
        while True:
            payload = await get_ticket_status_payload(ticket_id)
            if not payload:
                break
            
            # Only send if data changed
            if payload != last_payload:
                yield f"data: {json.dumps(payload)}\n\n"
                last_payload = payload
            
            await asyncio.sleep(2) # Poll every 2 seconds for this specific ticket

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/business/{business_id}/display")
async def public_display(business_id: str):
    """Data for the public TV 'Now Serving' screen."""
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    start, end = utc_day_bounds()
    today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    
    serving = (
        await db.queue.find(
            {"business_id": business_id, "status": "serving"},
            {"_id": 0}
        )
        .sort("chair_number", 1)
        .to_list(50)
    )
    waiting = (
        await db.queue.find(
            {"business_id": business_id, "status": "waiting", "created_at": today_query},
            {"_id": 0}
        )
        .sort([("created_at", 1), ("token_number", 1)])
        .limit(6)
        .to_list(6)
    )
    waiting_count = await db.queue.count_documents(
        {"business_id": business_id, "status": "waiting", "created_at": today_query}
    )
    return {
        "business": public_business(b),
        "serving": [public_ticket(t) for t in serving],
        "upcoming": [public_ticket(t) for t in waiting],
        "waiting_count": waiting_count,
        "total_chairs": b.get("total_chairs", 1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

"""Owner queue management + stats + analytics (per-outlet)."""
import uuid
import asyncio
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import StreamingResponse

from ..db import db
from ..models import CompleteTicketRequest, MarkPaidRequest, UpdateStatusRequest, WalkInRequest
from ..security import get_current_user
from ..services import (
    assign_waiting_ticket_to_chair,
    next_token_number,
    owned_business_or_404,
    plan_limits,
    public_ticket,
    resolve_services_for_ticket,
    ticket_service_fields,
    utc_day_bounds,
)

router = APIRouter(prefix="/business/{business_id}")


@router.get("/queue")
async def list_queue(
    business_id: str,
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
):
    await owned_business_or_404(user["id"], business_id)
    start, end = utc_day_bounds()
    today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    
    # We show ALL serving tickets (regardless of when they started)
    # but only TODAY's waiting tickets (to honor the daily reset).
    if status:
        query = {
            "business_id": business_id,
            "status": status,
        }
        if status == "waiting":
            query["created_at"] = today_query
    else:
        query = {
            "business_id": business_id,
            "$or": [
                {"status": "serving"},
                {"status": "waiting", "created_at": today_query}
            ]
        }

    tickets = (
        await db.queue.find(query, {"_id": 0})
        .sort([("created_at", 1), ("token_number", 1)])
        .to_list(1000)
    )
    return [public_ticket(t) for t in tickets]


@router.get("/queue/events")
async def queue_events(business_id: str, user: dict = Depends(get_current_user)):
    await owned_business_or_404(user["id"], business_id)

    async def event_generator():
        while True:
            start, end = utc_day_bounds()
            today_query = {"$gte": start.isoformat(), "$lt": end.isoformat()}
            query = {
                "business_id": business_id,
                "$or": [
                    {"status": "serving"},
                    {"status": "waiting", "created_at": today_query}
                ]
            }
            tickets = (
                await db.queue.find(query, {"_id": 0})
                .sort([("created_at", 1), ("token_number", 1)])
                .to_list(1000)
            )
            payload = json.dumps([public_ticket(t) for t in tickets])
            yield f"data: {payload}\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/queue/walk-in")
async def add_walk_in(
    business_id: str,
    body: WalkInRequest,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    services = await resolve_services_for_ticket(
        business_id,
        service_ids=body.service_ids,
        service_id=body.service_id,
    )
    token_number = await next_token_number(business["id"])
    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ticket = {
        "id": ticket_id,
        "business_id": business["id"],
        "customer_name": body.customer_name.strip(),
        "customer_phone": body.customer_phone.strip(),
        "token_number": token_number,
        "status": "waiting",
        "booking_type": "walk-in",
        "chair_number": None,
        "created_at": now,
        "served_at": None,
        "finished_at": None,
    }
    ticket.update(ticket_service_fields(services))
    await db.queue.insert_one(ticket)
    return public_ticket(ticket)


@router.patch("/queue/{ticket_id}/status")
async def update_ticket_status(
    business_id: str,
    ticket_id: str,
    body: UpdateStatusRequest,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    t = await db.queue.find_one({"id": ticket_id, "business_id": business["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    updates: dict = {"status": body.status}
    if body.status in ("completed", "cancelled", "no_show"):
        updates["finished_at"] = now_iso
    if body.status == "serving":
        updated = await assign_waiting_ticket_to_chair(business, ticket_id=ticket_id)
        return public_ticket(updated)
    await db.queue.update_one({"id": ticket_id}, {"$set": updates})
    updated = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    return public_ticket(updated)


@router.patch("/queue/{ticket_id}/paid")
async def mark_paid(
    business_id: str,
    ticket_id: str,
    body: MarkPaidRequest,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    t = await db.queue.find_one({"id": ticket_id, "business_id": business["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    updates: dict = {"paid": bool(body.paid)}
    updates["paid_at"] = datetime.now(timezone.utc).isoformat() if body.paid else None
    updates["payment_method"] = body.payment_method if body.paid else None
    await db.queue.update_one({"id": ticket_id}, {"$set": updates})
    updated = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    return public_ticket(updated)


@router.patch("/queue/{ticket_id}/amount")
async def update_amount(
    business_id: str,
    ticket_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    t = await db.queue.find_one({"id": ticket_id, "business_id": business["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    service_price = float(body.get("service_price", 0))
    if service_price < 0:
        raise HTTPException(status_code=400, detail="Amount cannot be negative")
    
    await db.queue.update_one({"id": ticket_id}, {"$set": {"service_price": service_price}})
    updated = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    return public_ticket(updated)


@router.post("/queue/{ticket_id}/complete")
async def complete_ticket(
    business_id: str,
    ticket_id: str,
    body: CompleteTicketRequest,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    t = await db.queue.find_one({"id": ticket_id, "business_id": business["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if t.get("status") != "serving":
        raise HTTPException(status_code=400, detail="Only serving tickets can be completed")

    services = await resolve_services_for_ticket(
        business_id,
        service_ids=body.service_ids,
    )
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # If amount is 0, mark as unpaid regardless of payment_method
    final_amount = float(body.final_amount or 0)
    is_paid = bool(body.paid) and final_amount > 0
    
    updates = {
        "status": "completed",
        "finished_at": now_iso,
        "paid": is_paid,
        "payment_method": body.payment_method if is_paid else None,
        "paid_at": now_iso if is_paid else None,
    }
    # Add service fields (but don't include service_price yet)
    updates.update(ticket_service_fields(services))
    # Override with the actual final_amount from user input
    updates["service_price"] = final_amount
    
    await db.queue.update_one({"id": ticket_id}, {"$set": updates})
    updated = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    return public_ticket(updated)


@router.get("/recent-completed")
async def recent_completed(
    business_id: str,
    page: int = 1,
    page_size: int = 10,
    user: dict = Depends(get_current_user),
):
    """Last 10 completed tickets from today — used by the Dashboard so
    owners can flip the paid toggle after the fact (most salons collect
    payment after the service, not before)."""
    await owned_business_or_404(user["id"], business_id)
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 50))
    skip = (page - 1) * page_size
    today = datetime.now(timezone.utc).date().isoformat()
    query = {
        "business_id": business_id,
        "status": "completed",
        "finished_at": {"$regex": f"^{today}"},
    }
    total = await db.queue.count_documents(query)
    docs = (
        await db.queue.find(
            query,
            {"_id": 0},
        )
        .sort("finished_at", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )
    return {
        "items": [public_ticket(t) for t in docs],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.post("/queue/call-next")
async def call_next(business_id: str, user: dict = Depends(get_current_user)):
    business = await owned_business_or_404(user["id"], business_id)
    updated = await assign_waiting_ticket_to_chair(business, prefer_next=True)
    return public_ticket(updated)


@router.get("/stats")
async def queue_stats(business_id: str, user: dict = Depends(get_current_user)):
    await owned_business_or_404(user["id"], business_id)
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
    today_str = start.date().isoformat()
    completed_today = await db.queue.count_documents(
        {
            "business_id": business_id,
            "status": "completed",
            "finished_at": {"$regex": f"^{today_str}"},
        }
    )
    no_show_today = await db.queue.count_documents(
        {
            "business_id": business_id,
            "status": {"$in": ["cancelled", "no_show"]},
            "finished_at": {"$regex": f"^{today_str}"},
        }
    )
    revenue_pipeline = [
        {"$match": {
            "business_id": business_id,
            "paid": True,
            "finished_at": {"$regex": f"^{today_str}"},
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$service_price", 0]}}}},
    ]
    rev_rows = await db.queue.aggregate(revenue_pipeline).to_list(1)
    revenue_today = float(rev_rows[0]["total"]) if rev_rows else 0.0
    return {
        "waiting": waiting,
        "serving": serving,
        "completed_today": completed_today,
        "no_show_today": no_show_today,
        "revenue_today": revenue_today,
    }


@router.get("/analytics")
async def analytics(
    business_id: str,
    days: int = 14,
    user: dict = Depends(get_current_user),
):
    await owned_business_or_404(user["id"], business_id)
    plan_max = plan_limits(user)["analytics_days"]
    days = max(1, min(days, plan_max))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    cursor = db.queue.find(
        {
            "business_id": business_id,
            "status": {"$in": ["completed", "cancelled", "no_show"]},
            "finished_at": {"$gte": since},
        },
        {"_id": 0},
    )
    rows = await cursor.to_list(5000)

    total_completed = 0
    total_cancelled = 0
    total_no_show = 0
    total_revenue = 0.0
    per_day = defaultdict(lambda: {"completed": 0, "no_show": 0, "revenue": 0.0})
    heatmap = defaultdict(int)
    service_minutes = []

    for r in rows:
        finished = r.get("finished_at")
        if not finished:
            continue
        try:
            fdt = datetime.fromisoformat(finished.replace("Z", "+00:00"))
        except Exception:
            continue
        day = fdt.date().isoformat()
        status = r.get("status")
        if status == "completed":
            total_completed += 1
            per_day[day]["completed"] += 1
            if r.get("paid"):
                price = float(r.get("service_price") or 0)
                total_revenue += price
                per_day[day]["revenue"] += price
            ref = r.get("served_at") or finished
            try:
                rdt = datetime.fromisoformat(ref.replace("Z", "+00:00"))
            except Exception:
                rdt = fdt
            heatmap[(rdt.weekday(), rdt.hour)] += 1
            if r.get("served_at"):
                try:
                    sdt = datetime.fromisoformat(r["served_at"].replace("Z", "+00:00"))
                    mins = (fdt - sdt).total_seconds() / 60.0
                    if 0 <= mins <= 480:
                        service_minutes.append(mins)
                except Exception:
                    pass
        elif status == "cancelled":
            total_cancelled += 1
            per_day[day]["no_show"] += 1
        elif status == "no_show":
            total_no_show += 1
            per_day[day]["no_show"] += 1

    series = []
    today = datetime.now(timezone.utc).date()
    for offset in range(days - 1, -1, -1):
        d = (today - timedelta(days=offset)).isoformat()
        series.append({
            "date": d,
            "completed": per_day[d]["completed"],
            "no_show": per_day[d]["no_show"],
            "revenue": round(per_day[d]["revenue"], 2),
        })

    heatmap_out = []
    for wd in range(7):
        for hr in range(24):
            heatmap_out.append({"weekday": wd, "hour": hr, "count": heatmap.get((wd, hr), 0)})

    total_touchpoints = total_completed + total_cancelled + total_no_show
    no_show_rate = (
        round(((total_cancelled + total_no_show) / total_touchpoints) * 100, 1)
        if total_touchpoints
        else 0.0
    )
    avg_service = round(sum(service_minutes) / len(service_minutes), 1) if service_minutes else 0.0

    return {
        "range_days": days,
        "totals": {
            "completed": total_completed,
            "cancelled": total_cancelled,
            "no_show": total_no_show,
            "no_show_rate_pct": no_show_rate,
            "avg_service_minutes": avg_service,
            "revenue": round(total_revenue, 2),
        },
        "series": series,
        "heatmap": heatmap_out,
    }


@router.get("/collections")
async def collections(
    business_id: str,
    days: int = 7,
    paid: str = "all",
    payment_method: str = "all",
    service_id: str = "all",
    user: dict = Depends(get_current_user),
):
    await owned_business_or_404(user["id"], business_id)
    plan_max = plan_limits(user)["analytics_days"]
    days = max(1, min(days, plan_max))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    query: dict = {
        "business_id": business_id,
        "status": "completed",
        "finished_at": {"$gte": since},
    }
    if paid == "paid":
        query["paid"] = True
    elif paid == "unpaid":
        query["paid"] = False
    if payment_method != "all":
        query["payment_method"] = payment_method
    if service_id != "all":
        query["service_ids"] = service_id

    rows = await db.queue.find(query, {"_id": 0}).sort("finished_at", -1).to_list(5000)

    total_amount = 0.0
    paid_amount = 0.0
    unpaid_amount = 0.0
    paid_count = 0
    unpaid_count = 0
    per_day = defaultdict(lambda: {"amount": 0.0, "tickets": 0, "paid": 0.0, "unpaid": 0.0})
    out_rows = []

    for row in rows:
        finished = row.get("finished_at")
        if not finished:
            continue
        try:
            fdt = datetime.fromisoformat(finished.replace("Z", "+00:00"))
        except Exception:
            continue
        amount = float(row.get("service_price") or 0)
        is_paid = bool(row.get("paid"))
        day = fdt.date().isoformat()

        total_amount += amount
        per_day[day]["amount"] += amount
        per_day[day]["tickets"] += 1
        if is_paid:
            paid_amount += amount
            paid_count += 1
            per_day[day]["paid"] += amount
        else:
            unpaid_amount += amount
            unpaid_count += 1
            per_day[day]["unpaid"] += amount

        out_rows.append({
            **public_ticket(row),
            "finished_date": day,
        })

    today = datetime.now(timezone.utc).date()
    series = []
    for offset in range(days - 1, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        series.append({
            "date": day,
            "amount": round(per_day[day]["amount"], 2),
            "tickets": per_day[day]["tickets"],
            "paid": round(per_day[day]["paid"], 2),
            "unpaid": round(per_day[day]["unpaid"], 2),
        })

    return {
        "range_days": days,
        "filters": {
            "paid": paid,
            "payment_method": payment_method,
            "service_id": service_id,
        },
        "totals": {
            "amount": round(total_amount, 2),
            "paid_amount": round(paid_amount, 2),
            "unpaid_amount": round(unpaid_amount, 2),
            "ticket_count": len(out_rows),
            "paid_count": paid_count,
            "unpaid_count": unpaid_count,
        },
        "series": series,
        "rows": out_rows,
    }

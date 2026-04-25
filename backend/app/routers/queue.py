"""Owner queue management + stats + analytics (per-outlet)."""
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..models import UpdateStatusRequest, WalkInRequest
from ..security import get_current_user
from ..services import (
    next_token_number,
    owned_business_or_404,
    plan_limits,
    public_ticket,
    resolve_service_for_ticket,
)

router = APIRouter(prefix="/business/{business_id}")


@router.get("/queue")
async def list_queue(
    business_id: str,
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
):
    await owned_business_or_404(user["id"], business_id)
    query = {"business_id": business_id}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["waiting", "serving"]}
    tickets = (
        await db.queue.find(query, {"_id": 0}).sort("token_number", 1).to_list(1000)
    )
    return [public_ticket(t) for t in tickets]


@router.post("/queue/walk-in")
async def add_walk_in(
    business_id: str,
    body: WalkInRequest,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    service = await resolve_service_for_ticket(business_id, body.service_id)
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
        if not t.get("served_at"):
            updates["served_at"] = now_iso
        if t.get("chair_number") is None:
            serving_tickets = await db.queue.find(
                {"business_id": business["id"], "status": "serving"},
                {"_id": 0, "chair_number": 1},
            ).to_list(1000)
            taken = {s.get("chair_number") for s in serving_tickets if s.get("chair_number")}
            total_chairs = business.get("total_chairs", 1)
            for i in range(1, total_chairs + 1):
                if i not in taken:
                    updates["chair_number"] = i
                    break
    await db.queue.update_one({"id": ticket_id}, {"$set": updates})
    updated = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    return public_ticket(updated)


@router.post("/queue/call-next")
async def call_next(business_id: str, user: dict = Depends(get_current_user)):
    business = await owned_business_or_404(user["id"], business_id)
    next_ticket = await db.queue.find_one(
        {"business_id": business["id"], "status": "waiting"},
        {"_id": 0},
        sort=[("token_number", 1)],
    )
    if not next_ticket:
        raise HTTPException(status_code=404, detail="No one in the waiting queue")

    serving_tickets = await db.queue.find(
        {"business_id": business["id"], "status": "serving"}, {"_id": 0, "chair_number": 1}
    ).to_list(1000)
    taken = {s.get("chair_number") for s in serving_tickets if s.get("chair_number")}
    total_chairs = business.get("total_chairs", 1)
    chair = None
    for i in range(1, total_chairs + 1):
        if i not in taken:
            chair = i
            break
    if chair is None:
        raise HTTPException(status_code=400, detail="All stations are currently busy")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.queue.update_one(
        {"id": next_ticket["id"]},
        {"$set": {"status": "serving", "chair_number": chair, "served_at": now_iso}},
    )
    updated = await db.queue.find_one({"id": next_ticket["id"]}, {"_id": 0})
    return public_ticket(updated)


@router.get("/stats")
async def queue_stats(business_id: str, user: dict = Depends(get_current_user)):
    await owned_business_or_404(user["id"], business_id)
    today = datetime.now(timezone.utc).date().isoformat()
    waiting = await db.queue.count_documents({"business_id": business_id, "status": "waiting"})
    serving = await db.queue.count_documents({"business_id": business_id, "status": "serving"})
    completed_today = await db.queue.count_documents(
        {
            "business_id": business_id,
            "status": "completed",
            "finished_at": {"$regex": f"^{today}"},
        }
    )
    no_show_today = await db.queue.count_documents(
        {
            "business_id": business_id,
            "status": {"$in": ["cancelled", "no_show"]},
            "finished_at": {"$regex": f"^{today}"},
        }
    )
    revenue_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": "completed",
            "finished_at": {"$regex": f"^{today}"},
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

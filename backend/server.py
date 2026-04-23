from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ---- DB ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---- App ----
app = FastAPI(title="Go-Next Salon Queue API")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ----------------- Plans -----------------
PLAN_LIMITS = {
    "free": {
        "max_outlets": 1,
        "max_stations": 2,
        "max_tokens_per_day": 50,
        "analytics_days": 14,
        "features": [
            "1 outlet with up to 2 stations",
            "Up to 50 tokens / day",
            "Live queue board & customer QR",
            "Live ticket tracking",
            "14-day analytics",
        ],
    },
    "premium": {
        "max_outlets": 10,
        "max_stations": 100,
        "max_tokens_per_day": 1000,
        "analytics_days": 90,
        "features": [
            "Up to 10 outlets",
            "Up to 100 stations per outlet",
            "Up to 1000 tokens / day",
            "Public TV \u201cNow Serving\u201d display",
            "Full 90-day analytics & heatmap",
            "Priority support",
        ],
    },
}


def user_plan(user: dict) -> str:
    p = (user or {}).get("plan") or "free"
    return p if p in PLAN_LIMITS else "free"


def plan_limits(user: dict) -> dict:
    return PLAN_LIMITS[user_plan(user)]


def require_super_admin(user: dict) -> dict:
    if (user or {}).get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


# ----------------- Models -----------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    owner_name: str = Field(min_length=1)
    business_name: str = Field(min_length=1)
    business_type: str = "salon"
    address: str = ""
    city: str = ""
    state: str = Field(min_length=1)
    pincode: str = Field(min_length=3, max_length=12)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateBusinessRequest(BaseModel):
    business_name: str = Field(min_length=1)
    business_type: str = "salon"
    address: str = ""
    city: str = ""
    state: str = Field(min_length=1)
    pincode: str = Field(min_length=3, max_length=12)


class UpdateBusinessRequest(BaseModel):
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    total_chairs: Optional[int] = Field(default=None, ge=1, le=100)
    token_limit: Optional[int] = Field(default=None, ge=1, le=1000)
    is_online: Optional[bool] = None
    station_label: Optional[str] = None


class JoinQueueRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=80)
    customer_phone: str = Field(min_length=6, max_length=20)


class WalkInRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=80)
    customer_phone: str = ""


StatusT = Literal["waiting", "serving", "completed", "cancelled", "no_show"]


class UpdateStatusRequest(BaseModel):
    status: StatusT


# ----------------- Helpers -----------------
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
        "created_at": t.get("created_at"),
        "served_at": t.get("served_at"),
        "finished_at": t.get("finished_at"),
    }


async def next_token_number(business_id: str) -> int:
    last = await db.queue.find(
        {"business_id": business_id}, {"_id": 0, "token_number": 1}
    ).sort("token_number", -1).limit(1).to_list(1)
    return (last[0]["token_number"] + 1) if last else 1


async def owned_business_or_404(user_id: str, business_id: str) -> dict:
    b = await db.businesses.find_one({"id": business_id, "owner_user_id": user_id}, {"_id": 0})
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
            detail=f"Your {user_plan(user).title()} plan allows up to {limits['max_outlets']} outlet(s). Upgrade to add more.",
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


# ----------------- Auth Endpoints -----------------
@api.post("/auth/register")
async def register(body: RegisterRequest, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.owner_name,
        "role": "owner",
        "plan": "free",
        "created_at": now,
    }
    await db.users.insert_one(user_doc)

    business = await create_business_doc(user_doc, CreateBusinessRequest(
        business_name=body.business_name,
        business_type=body.business_type,
        address=body.address,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
    ))

    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {
        "user": {"id": user_id, "email": email, "name": body.owner_name, "role": "owner", "plan": "free"},
        "businesses": [public_business(business)],
        "access_token": token,
    }


@api.post("/auth/login")
async def login(body: LoginRequest, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    businesses = await list_user_businesses(user["id"])
    return {
        "user": {
            "id": user["id"], "email": email,
            "name": user.get("name", ""),
            "role": user.get("role", "owner"),
            "plan": user_plan(user),
        },
        "businesses": businesses,
        "access_token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    businesses = await list_user_businesses(user["id"])
    return {
        "user": {
            "id": user["id"], "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "owner"),
            "plan": user_plan(user),
        },
        "businesses": businesses,
    }


# ----------------- Business (owner) -----------------
@api.get("/business")
async def my_businesses(user: dict = Depends(get_current_user)):
    return await list_user_businesses(user["id"])


@api.post("/business")
async def create_outlet(body: CreateBusinessRequest, user: dict = Depends(get_current_user)):
    business = await create_business_doc(user, body)
    return public_business(business)


@api.get("/business/{business_id}")
async def get_outlet(business_id: str, user: dict = Depends(get_current_user)):
    business = await owned_business_or_404(user["id"], business_id)
    return public_business(business)


@api.patch("/business/{business_id}")
async def update_outlet(business_id: str, body: UpdateBusinessRequest, user: dict = Depends(get_current_user)):
    business = await owned_business_or_404(user["id"], business_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    limits = plan_limits(user)
    if "total_chairs" in updates and updates["total_chairs"] > limits["max_stations"]:
        raise HTTPException(
            status_code=403,
            detail=f"Your {user_plan(user).title()} plan allows up to {limits['max_stations']} stations. Upgrade to add more.",
        )
    if "token_limit" in updates and updates["token_limit"] > limits["max_tokens_per_day"]:
        raise HTTPException(
            status_code=403,
            detail=f"Your {user_plan(user).title()} plan allows up to {limits['max_tokens_per_day']} tokens / day. Upgrade for a higher limit.",
        )
    if updates:
        await db.businesses.update_one({"id": business["id"]}, {"$set": updates})
    updated = await db.businesses.find_one({"id": business["id"]}, {"_id": 0})
    return public_business(updated)


@api.delete("/business/{business_id}")
async def delete_outlet(business_id: str, user: dict = Depends(get_current_user)):
    await owned_business_or_404(user["id"], business_id)
    await db.businesses.delete_one({"id": business_id})
    await db.queue.delete_many({"business_id": business_id})
    return {"ok": True}


# ----------------- Public Customer Endpoints -----------------
@api.get("/public/business/{business_id}")
async def public_business_endpoint(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    return public_business(b)


@api.get("/public/business/{business_id}/queue-summary")
async def public_queue_summary(business_id: str):
    b = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    waiting = await db.queue.count_documents({"business_id": business_id, "status": "waiting"})
    serving = await db.queue.count_documents({"business_id": business_id, "status": "serving"})
    return {
        "business": public_business(b),
        "waiting_count": waiting,
        "serving_count": serving,
        "total_chairs": b.get("total_chairs", 1),
    }


@api.post("/public/business/{business_id}/join")
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
    await db.queue.insert_one(ticket)
    return public_ticket(ticket)


@api.get("/public/ticket/{ticket_id}")
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
    serving_count = await db.queue.count_documents(
        {"business_id": t["business_id"], "status": "serving"}
    )
    total_chairs = b.get("total_chairs", 1) if b else 1
    available_chairs = max(total_chairs - serving_count, 0)
    if position <= available_chairs:
        eta = 0
    else:
        eta = ((position - available_chairs) / max(total_chairs, 1)) * 15
    return {
        "ticket": public_ticket(t),
        "position": position,
        "estimated_wait_minutes": int(round(eta)),
        "business": public_business(b) if b else None,
    }


@api.get("/public/business/{business_id}/display")
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


# ----------------- Owner Queue Management (per-outlet) -----------------
@api.get("/business/{business_id}/queue")
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


@api.post("/business/{business_id}/queue/walk-in")
async def add_walk_in(business_id: str, body: WalkInRequest, user: dict = Depends(get_current_user)):
    business = await owned_business_or_404(user["id"], business_id)
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
    await db.queue.insert_one(ticket)
    return public_ticket(ticket)


@api.patch("/business/{business_id}/queue/{ticket_id}/status")
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


@api.post("/business/{business_id}/queue/call-next")
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


@api.get("/business/{business_id}/stats")
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
    return {
        "waiting": waiting,
        "serving": serving,
        "completed_today": completed_today,
        "no_show_today": no_show_today,
    }


@api.get("/business/{business_id}/analytics")
async def analytics(
    business_id: str,
    days: int = 14,
    user: dict = Depends(get_current_user),
):
    await owned_business_or_404(user["id"], business_id)
    days = max(1, min(days, 90))
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
    per_day = defaultdict(lambda: {"completed": 0, "no_show": 0})
    heatmap = defaultdict(int)  # key: (weekday, hour)
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
            # For heatmap, use served_at if present else finished_at
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

    # Fill missing days with zeros
    series = []
    today = datetime.now(timezone.utc).date()
    for offset in range(days - 1, -1, -1):
        d = (today - timedelta(days=offset)).isoformat()
        series.append({
            "date": d,
            "completed": per_day[d]["completed"],
            "no_show": per_day[d]["no_show"],
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
        },
        "series": series,
        "heatmap": heatmap_out,
    }


# ----------------- Plans (public) -----------------
@api.get("/plans")
async def plans():
    return {
        "plans": [
            {"id": "free", "name": "Free", "price_monthly": 0, **PLAN_LIMITS["free"]},
            {"id": "premium", "name": "Premium", "price_monthly": 19, **PLAN_LIMITS["premium"]},
        ],
    }


# ----------------- Super Admin -----------------
class AdminUserUpdate(BaseModel):
    plan: Optional[Literal["free", "premium"]] = None


@api.get("/admin/stats")
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


@api.get("/admin/users")
async def admin_users(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    users = await db.users.find({"role": "owner"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(2000)
    # Attach outlet count per user
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


@api.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    updated.pop("password_hash", None)
    return updated


@api.get("/admin/businesses")
async def admin_businesses(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    docs = await db.businesses.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    # attach owner email
    owner_ids = list({d["owner_user_id"] for d in docs if d.get("owner_user_id")})
    owners = {}
    if owner_ids:
        for u in await db.users.find({"id": {"$in": owner_ids}}, {"_id": 0, "id": 1, "email": 1, "name": 1, "plan": 1}).to_list(2000):
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


@api.delete("/admin/businesses/{business_id}")
async def admin_delete_business(business_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = await db.businesses.delete_one({"id": business_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outlet not found")
    await db.queue.delete_many({"business_id": business_id})
    return {"ok": True}


# ----------------- Startup -----------------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.businesses.create_index("owner_user_id")
    # Drop legacy unique index on owner_user_id if it exists from earlier version
    try:
        info = await db.businesses.index_information()
        for name, spec in list(info.items()):
            if name == "_id_":
                continue
            keys = spec.get("key", [])
            if keys == [("owner_user_id", 1)] and spec.get("unique"):
                await db.businesses.drop_index(name)
    except Exception:
        pass
    await db.queue.create_index([("business_id", 1), ("status", 1)])
    await db.queue.create_index([("business_id", 1), ("token_number", -1)])
    await db.queue.create_index([("business_id", 1), ("finished_at", -1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@go-next.in").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Demo Owner",
            "role": "owner",
            "plan": "premium",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Seed primary outlet
        primary = await db.businesses.find_one({"id": "demo-salon"}, {"_id": 0})
        if not primary:
            await db.businesses.insert_one({
                "id": "demo-salon",
                "owner_user_id": admin_id,
                "business_name": "Amara Studio · Bandra",
                "business_type": "salon",
                "address": "221 Hill Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400050",
                "total_chairs": 4,
                "token_limit": 100,
                "is_online": True,
                "station_label": "Chair",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        # Seed second outlet to showcase multi-outlet
        second = await db.businesses.find_one({"id": "demo-salon-andheri"}, {"_id": 0})
        if not second:
            await db.businesses.insert_one({
                "id": "demo-salon-andheri",
                "owner_user_id": admin_id,
                "business_name": "Amara Studio · Andheri",
                "business_type": "salon",
                "address": "45 Linking Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400058",
                "total_chairs": 3,
                "token_limit": 80,
                "is_online": True,
                "station_label": "Chair",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    # Backfill plan for older seeded users if missing
    await db.users.update_many({"role": "owner", "plan": {"$exists": False}}, {"$set": {"plan": "free"}})
    await db.users.update_one({"email": admin_email, "plan": "free"}, {"$set": {"plan": "premium"}})

    # Seed a super-admin (idempotent)
    super_email = "super@go-next.in"
    if not await db.users.find_one({"email": super_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": super_email,
            "password_hash": hash_password("admin123"),
            "name": "Platform Admin",
            "role": "super_admin",
            "plan": "premium",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"] if os.environ.get("CORS_ORIGINS", "*") == "*" else os.environ["CORS_ORIGINS"].split(","),
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

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


# ----------------- Models -----------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    owner_name: str = Field(min_length=1)
    business_name: str = Field(min_length=1)
    business_type: str = "salon"
    address: str = ""
    city: str = ""
    total_chairs: int = Field(ge=1, le=100, default=3)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateBusinessRequest(BaseModel):
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
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


StatusT = Literal["waiting", "serving", "completed", "cancelled"]


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
        "finished_at": t.get("finished_at"),
    }


async def next_token_number(business_id: str) -> int:
    # Reset token daily? Keep simple: all-time max + 1
    last = await db.queue.find(
        {"business_id": business_id}, {"_id": 0, "token_number": 1}
    ).sort("token_number", -1).limit(1).to_list(1)
    return (last[0]["token_number"] + 1) if last else 1


async def get_owner_business(user_id: str) -> dict:
    b = await db.businesses.find_one({"owner_user_id": user_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="No business found for this user")
    return b


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
        "created_at": now,
    }
    await db.users.insert_one(user_doc)

    business_id = str(uuid.uuid4())
    business = {
        "id": business_id,
        "owner_user_id": user_id,
        "business_name": body.business_name,
        "business_type": body.business_type,
        "address": body.address,
        "city": body.city,
        "total_chairs": body.total_chairs,
        "token_limit": 100,
        "is_online": True,
        "station_label": "Station",
        "created_at": now,
    }
    await db.businesses.insert_one(business)

    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {
        "user": {"id": user_id, "email": email, "name": body.owner_name, "role": "owner"},
        "business": public_business(business),
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
    business = await db.businesses.find_one({"owner_user_id": user["id"]}, {"_id": 0})
    return {
        "user": {"id": user["id"], "email": email, "name": user.get("name", ""), "role": user.get("role", "owner")},
        "business": public_business(business) if business else None,
        "access_token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    business = await db.businesses.find_one({"owner_user_id": user["id"]}, {"_id": 0})
    return {
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "owner")},
        "business": public_business(business) if business else None,
    }


# ----------------- Business (owner) -----------------
@api.get("/business/me")
async def business_me(user: dict = Depends(get_current_user)):
    business = await get_owner_business(user["id"])
    return public_business(business)


@api.patch("/business/me")
async def update_business(body: UpdateBusinessRequest, user: dict = Depends(get_current_user)):
    business = await get_owner_business(user["id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.businesses.update_one({"id": business["id"]}, {"$set": updates})
    updated = await db.businesses.find_one({"id": business["id"]}, {"_id": 0})
    return public_business(updated)


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
        "finished_at": None,
    }
    await db.queue.insert_one(ticket)
    return public_ticket(ticket)


@api.get("/public/ticket/{ticket_id}")
async def public_ticket_status(ticket_id: str):
    t = await db.queue.find_one({"id": ticket_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    # Compute position among waiting tickets (by token_number ascending)
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


# ----------------- Owner Queue Management -----------------
@api.get("/queue/manage")
async def list_queue(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
):
    business = await get_owner_business(user["id"])
    query = {"business_id": business["id"]}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["waiting", "serving"]}
    tickets = (
        await db.queue.find(query, {"_id": 0}).sort("token_number", 1).to_list(1000)
    )
    return [public_ticket(t) for t in tickets]


@api.post("/queue/manage/walk-in")
async def add_walk_in(body: WalkInRequest, user: dict = Depends(get_current_user)):
    business = await get_owner_business(user["id"])
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
        "finished_at": None,
    }
    await db.queue.insert_one(ticket)
    return public_ticket(ticket)


@api.patch("/queue/manage/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    body: UpdateStatusRequest,
    user: dict = Depends(get_current_user),
):
    business = await get_owner_business(user["id"])
    t = await db.queue.find_one({"id": ticket_id, "business_id": business["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updates = {"status": body.status}
    if body.status in ("completed", "cancelled"):
        updates["finished_at"] = datetime.now(timezone.utc).isoformat()
    if body.status == "serving" and t.get("chair_number") is None:
        # assign a free chair
        serving_tickets = await db.queue.find(
            {"business_id": business["id"], "status": "serving"}, {"_id": 0, "chair_number": 1}
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


@api.post("/queue/manage/call-next")
async def call_next(user: dict = Depends(get_current_user)):
    business = await get_owner_business(user["id"])
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

    await db.queue.update_one(
        {"id": next_ticket["id"]},
        {"$set": {"status": "serving", "chair_number": chair}},
    )
    updated = await db.queue.find_one({"id": next_ticket["id"]}, {"_id": 0})
    return public_ticket(updated)


@api.get("/queue/manage/stats")
async def queue_stats(user: dict = Depends(get_current_user)):
    business = await get_owner_business(user["id"])
    today = datetime.now(timezone.utc).date().isoformat()
    waiting = await db.queue.count_documents({"business_id": business["id"], "status": "waiting"})
    serving = await db.queue.count_documents({"business_id": business["id"], "status": "serving"})
    completed_today = await db.queue.count_documents(
        {
            "business_id": business["id"],
            "status": "completed",
            "finished_at": {"$regex": f"^{today}"},
        }
    )
    cancelled_today = await db.queue.count_documents(
        {
            "business_id": business["id"],
            "status": "cancelled",
            "finished_at": {"$regex": f"^{today}"},
        }
    )
    return {
        "waiting": waiting,
        "serving": serving,
        "completed_today": completed_today,
        "cancelled_today": cancelled_today,
    }


# ----------------- Startup -----------------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.businesses.create_index("owner_user_id", unique=True)
    await db.queue.create_index([("business_id", 1), ("status", 1)])
    await db.queue.create_index([("business_id", 1), ("token_number", -1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@gonext.com").lower()
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
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.businesses.insert_one({
            "id": "demo-salon",
            "owner_user_id": admin_id,
            "business_name": "Amara Studio",
            "business_type": "salon",
            "address": "221 Baker Street",
            "city": "London",
            "total_chairs": 4,
            "token_limit": 100,
            "is_online": True,
            "station_label": "Chair",
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

"""App startup tasks: index creation + idempotent demo data seeding."""
import os
import uuid
from datetime import datetime, timezone
from pymongo import ASCENDING

from .config import LOCKOUT_WINDOW_MINUTES
from .db import db
from .security import hash_password


async def ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.businesses.create_index("owner_user_id")

    # Drop legacy unique index on owner_user_id (pre multi-outlet)
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
    await db.queue.create_index(
        [("business_id", ASCENDING), ("chair_number", ASCENDING)],
        unique=True,
        partialFilterExpression={"status": "serving", "chair_number": {"$type": "number"}},
    )

    await db.services.create_index([("business_id", 1), ("sort_order", 1)])

    # Brute-force: auto-expire login attempts after the lockout window
    try:
        await db.login_attempts.create_index(
            "attempted_at", expireAfterSeconds=LOCKOUT_WINDOW_MINUTES * 60
        )
    except Exception:
        try:
            await db.login_attempts.drop_index("attempted_at_1")
            await db.login_attempts.create_index(
                "attempted_at", expireAfterSeconds=LOCKOUT_WINDOW_MINUTES * 60
            )
        except Exception:
            pass
    await db.login_attempts.create_index("identifier")

    # Password reset tokens: TTL auto-expires records at their expires_at
    try:
        await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass
    try:
        await db.password_resets.create_index("token", unique=True)
    except Exception:
        pass
    await db.password_resets.create_index("user_id")

    # Account lock tokens: TTL auto-delete at expires_at
    try:
        await db.account_lock_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass
    try:
        await db.account_lock_tokens.create_index("token", unique=True)
    except Exception:
        pass
    await db.account_lock_tokens.create_index("user_id")


async def seed_demo_data() -> None:
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

    # Backfill plan for older seeded users
    await db.users.update_many(
        {"role": "owner", "plan": {"$exists": False}}, {"$set": {"plan": "free"}}
    )
    await db.users.update_one(
        {"email": admin_email, "plan": "free"}, {"$set": {"plan": "premium"}}
    )

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

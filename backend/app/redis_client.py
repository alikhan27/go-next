"""Redis client for caching, sessions, and rate limiting.

Architecture:
- Single async Redis connection pool used across the application.
- Token-keyed sessions (`session:{token}` → user_id) so multiple devices
  per user are supported and logout only invalidates the current device.
- A reverse index (`user_sessions:{user_id}` Redis SET) tracks all active
  tokens per user, enabling logout-from-all-devices and bulk invalidation
  on user-data changes.
- Per-user cache (`user:{user_id}` → user dict) avoids the Mongo round-trip
  on every authenticated request.
"""
import os
import json
from typing import Any, Optional
from datetime import datetime
from bson import ObjectId
import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_MAX_CONNECTIONS = int(os.getenv("REDIS_MAX_CONNECTIONS", "100"))

# Bounded async connection pool — caps Redis sockets even under burst load.
_pool = redis.ConnectionPool.from_url(
    REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
    max_connections=REDIS_MAX_CONNECTIONS,
    socket_connect_timeout=5,
    socket_timeout=5,
    health_check_interval=30,
)
redis_client = redis.Redis(connection_pool=_pool)


# ---------- JSON helpers ----------
def _json_default(obj):
    """JSON serializer for ObjectId / datetime so cached Mongo docs survive."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


def _dumps(value: Any) -> str:
    return json.dumps(value, default=_json_default)


# ---------- Session Management (token-keyed, multi-device) ----------
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


async def set_session(token: str, user_id: str, ttl: int = SESSION_TTL_SECONDS) -> None:
    """Bind a token to a user_id. Each call creates an independent session,
    so the same user can be logged in on multiple devices simultaneously.
    """
    pipe = redis_client.pipeline()
    pipe.setex(f"session:{token}", ttl, user_id)
    pipe.sadd(f"user_sessions:{user_id}", token)
    # Keep the reverse-index alive at least as long as the longest session.
    pipe.expire(f"user_sessions:{user_id}", ttl)
    await pipe.execute()


async def get_session(token: str) -> Optional[str]:
    """Return the user_id bound to a token, or None if the session expired."""
    return await redis_client.get(f"session:{token}")


async def refresh_session(token: str, ttl: int = SESSION_TTL_SECONDS) -> None:
    """Sliding-window TTL refresh on access."""
    user_id = await redis_client.get(f"session:{token}")
    if user_id:
        pipe = redis_client.pipeline()
        pipe.expire(f"session:{token}", ttl)
        pipe.expire(f"user_sessions:{user_id}", ttl)
        await pipe.execute()


async def delete_session(token: str) -> None:
    """Revoke a single device session (the one logging out)."""
    user_id = await redis_client.get(f"session:{token}")
    pipe = redis_client.pipeline()
    pipe.delete(f"session:{token}")
    if user_id:
        pipe.srem(f"user_sessions:{user_id}", token)
    await pipe.execute()


async def delete_all_user_sessions(user_id: str) -> int:
    """Force sign-out from every device. Returns count of revoked tokens."""
    tokens = await redis_client.smembers(f"user_sessions:{user_id}")
    if not tokens:
        return 0
    pipe = redis_client.pipeline()
    for token in tokens:
        pipe.delete(f"session:{token}")
    pipe.delete(f"user_sessions:{user_id}")
    await pipe.execute()
    return len(tokens)


# ---------- Per-user cache (avoids Mongo on every request) ----------
USER_CACHE_TTL = 30 * 60  # 30 minutes


async def cache_user(user_id: str, user: dict, ttl: int = USER_CACHE_TTL) -> None:
    await redis_client.setex(f"user:{user_id}", ttl, _dumps(user))


async def get_cached_user(user_id: str) -> Optional[dict]:
    raw = await redis_client.get(f"user:{user_id}")
    return json.loads(raw) if raw else None


async def invalidate_user_cache(user_id: str) -> None:
    await redis_client.delete(f"user:{user_id}")


# ---------- Generic cache ----------
async def cache_set(key: str, value: Any, ttl: int = 1800) -> None:
    await redis_client.setex(key, ttl, _dumps(value))


async def cache_get(key: str) -> Optional[Any]:
    data = await redis_client.get(key)
    return json.loads(data) if data else None


async def cache_delete(key: str) -> None:
    await redis_client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    keys = []
    async for key in redis_client.scan_iter(match=pattern):
        keys.append(key)
    if keys:
        await redis_client.delete(*keys)


# ---------- Rate Limiting ----------
async def increment_rate_limit(identifier: str, ttl: int = 3600) -> int:
    key = f"rate_limit:{identifier}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, ttl)
    return count


async def get_rate_limit(identifier: str) -> int:
    count = await redis_client.get(f"rate_limit:{identifier}")
    return int(count) if count else 0


async def reset_rate_limit(identifier: str) -> None:
    await redis_client.delete(f"rate_limit:{identifier}")


# ---------- Failed login tracking ----------
async def record_failed_login(identifier: str) -> int:
    key = f"login_attempts:{identifier}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 1800)
    return count


async def get_failed_login_count(identifier: str) -> int:
    count = await redis_client.get(f"login_attempts:{identifier}")
    return int(count) if count else 0


async def clear_failed_logins(identifier: str) -> None:
    await redis_client.delete(f"login_attempts:{identifier}")


async def set_account_lockout(identifier: str, ttl: int = 3600) -> None:
    await redis_client.setex(f"lockout:{identifier}", ttl, "1")


async def is_account_locked(identifier: str) -> bool:
    return bool(await redis_client.exists(f"lockout:{identifier}"))


# ---------- Health ----------
async def redis_health_check() -> bool:
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False


async def close_redis() -> None:
    await redis_client.close()
    await _pool.disconnect()

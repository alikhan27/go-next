"""Redis client for caching, sessions, and rate limiting.

Single global Redis connection used across the application for:
- Session management (user sessions)
- Caching (user data, businesses, services)
- Rate limiting (login attempts, API throttling)
"""
import os
import json
from typing import Any, Optional
from datetime import datetime
from bson import ObjectId
import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


def _json_default(obj):
    """JSON serializer for objects not serializable by default (ObjectId, datetime)."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


def _dumps(value: Any) -> str:
    return json.dumps(value, default=_json_default)

# Create global async Redis client
redis_client = redis.from_url(
    REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
    retry_on_timeout=True,
    health_check_interval=30,
)


# Session Management
async def set_session(session_id: str, user_data: dict, ttl: int = 604800):
    """Store user session in Redis (7 days default TTL)."""
    await redis_client.setex(
        f"session:{session_id}",
        ttl,
        _dumps(user_data)
    )


async def get_session(session_id: str) -> Optional[dict]:
    """Retrieve user session from Redis."""
    data = await redis_client.get(f"session:{session_id}")
    if data:
        return json.loads(data)
    return None


async def delete_session(session_id: str):
    """Delete user session from Redis."""
    await redis_client.delete(f"session:{session_id}")


async def refresh_session(session_id: str, ttl: int = 604800):
    """Extend session TTL."""
    await redis_client.expire(f"session:{session_id}", ttl)


# Caching
async def cache_set(key: str, value: Any, ttl: int = 1800):
    """Cache any data with TTL (30 minutes default)."""
    await redis_client.setex(key, ttl, _dumps(value))


async def cache_get(key: str) -> Optional[Any]:
    """Get cached data."""
    data = await redis_client.get(key)
    if data:
        return json.loads(data)
    return None


async def cache_delete(key: str):
    """Delete cached data."""
    await redis_client.delete(key)


async def cache_delete_pattern(pattern: str):
    """Delete all keys matching pattern."""
    keys = []
    async for key in redis_client.scan_iter(match=pattern):
        keys.append(key)
    if keys:
        await redis_client.delete(*keys)


# Rate Limiting
async def increment_rate_limit(identifier: str, ttl: int = 3600) -> int:
    """Increment rate limit counter and return current count."""
    key = f"rate_limit:{identifier}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, ttl)
    return count


async def get_rate_limit(identifier: str) -> int:
    """Get current rate limit count."""
    count = await redis_client.get(f"rate_limit:{identifier}")
    return int(count) if count else 0


async def reset_rate_limit(identifier: str):
    """Reset rate limit counter."""
    await redis_client.delete(f"rate_limit:{identifier}")


# Login Attempts (Rate Limiting)
async def record_failed_login(identifier: str) -> int:
    """Record failed login attempt and return total count."""
    key = f"login_attempts:{identifier}"
    count = await redis_client.incr(key)
    if count == 1:
        # Set 30 minute expiry on first failed attempt
        await redis_client.expire(key, 1800)
    return count


async def get_failed_login_count(identifier: str) -> int:
    """Get failed login attempt count."""
    count = await redis_client.get(f"login_attempts:{identifier}")
    return int(count) if count else 0


async def clear_failed_logins(identifier: str):
    """Clear failed login attempts."""
    await redis_client.delete(f"login_attempts:{identifier}")


async def set_account_lockout(identifier: str, ttl: int = 3600):
    """Lock account for specified duration (1 hour default)."""
    await redis_client.setex(f"lockout:{identifier}", ttl, "1")


async def is_account_locked(identifier: str) -> bool:
    """Check if account is locked."""
    return bool(await redis_client.exists(f"lockout:{identifier}"))


# Health Check
async def redis_health_check() -> bool:
    """Check if Redis is healthy."""
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False


# Cleanup on shutdown
async def close_redis():
    """Close Redis connection."""
    await redis_client.close()

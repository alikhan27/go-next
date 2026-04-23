"""Public plan catalog."""
from fastapi import APIRouter

from ..config import PLAN_LIMITS

router = APIRouter()


@router.get("/plans")
async def plans():
    return {
        "plans": [
            {"id": "free", "name": "Free", "price_monthly": 0, **PLAN_LIMITS["free"]},
            {"id": "premium", "name": "Premium", "price_monthly": 19, **PLAN_LIMITS["premium"]},
        ],
    }

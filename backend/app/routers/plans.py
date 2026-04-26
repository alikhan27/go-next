"""Public plan catalog."""
from fastapi import APIRouter

from ..services import public_plan

router = APIRouter()


@router.get("/plans")
async def plans():
    return {
        "plans": [
            public_plan("free"),
            public_plan("premium"),
            public_plan("premium_plus"),
        ],
    }

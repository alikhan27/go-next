"""Owner-facing outlet CRUD: list / create / get / update / delete."""
from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..models import CreateBusinessRequest, UpdateBusinessRequest
from ..security import get_current_user
from ..services import (
    create_business_doc,
    list_user_businesses,
    owned_business_or_404,
    plan_limits,
    public_business,
    user_plan,
)

router = APIRouter(prefix="/business")


@router.get("")
async def my_businesses(user: dict = Depends(get_current_user)):
    return await list_user_businesses(user["id"])


@router.post("")
async def create_outlet(body: CreateBusinessRequest, user: dict = Depends(get_current_user)):
    business = await create_business_doc(user, body)
    return public_business(business)


@router.get("/{business_id}")
async def get_outlet(business_id: str, user: dict = Depends(get_current_user)):
    business = await owned_business_or_404(user["id"], business_id)
    return public_business(business)


@router.patch("/{business_id}")
async def update_outlet(
    business_id: str,
    body: UpdateBusinessRequest,
    user: dict = Depends(get_current_user),
):
    business = await owned_business_or_404(user["id"], business_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    limits = plan_limits(user)
    if "total_chairs" in updates and updates["total_chairs"] > limits["max_stations"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your {user_plan(user).title()} plan allows up to "
                f"{limits['max_stations']} stations. Upgrade to add more."
            ),
        )
    if "token_limit" in updates and updates["token_limit"] > limits["max_tokens_per_day"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your {user_plan(user).title()} plan allows up to "
                f"{limits['max_tokens_per_day']} tokens / day. Upgrade for a higher limit."
            ),
        )
    if updates:
        await db.businesses.update_one({"id": business["id"]}, {"$set": updates})
    updated = await db.businesses.find_one({"id": business["id"]}, {"_id": 0})
    return public_business(updated)


@router.delete("/{business_id}")
async def delete_outlet(business_id: str, user: dict = Depends(get_current_user)):
    await owned_business_or_404(user["id"], business_id)
    await db.businesses.delete_one({"id": business_id})
    await db.queue.delete_many({"business_id": business_id})
    return {"ok": True}

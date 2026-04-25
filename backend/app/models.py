"""Pydantic request models for the API surface."""
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ---- Auth ----
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    new_password: str = Field(min_length=6)


class LockAccountRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)


# ---- Business ----
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


# ---- Queue ----
class JoinQueueRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=80)
    customer_phone: str = Field(min_length=6, max_length=20)
    service_id: Optional[str] = None


class WalkInRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=80)
    customer_phone: str = ""
    service_id: Optional[str] = None


StatusT = Literal["waiting", "serving", "completed", "cancelled", "no_show"]


class UpdateStatusRequest(BaseModel):
    status: StatusT


# ---- Services (premium+) ----
class CreateServiceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    duration_minutes: int = Field(ge=1, le=480)
    sort_order: int = Field(default=0, ge=0, le=999)


class UpdateServiceRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=480)
    sort_order: Optional[int] = Field(default=None, ge=0, le=999)
    is_active: Optional[bool] = None


# ---- Admin ----
class AdminUserUpdate(BaseModel):
    plan: Optional[Literal["free", "premium", "premium_plus"]] = None
    is_locked: Optional[bool] = None

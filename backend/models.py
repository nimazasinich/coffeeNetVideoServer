"""
SmartCopy Pro — Pydantic Models
Input validation for all API endpoints. Never trust client data.
"""
import re
import uuid
from typing import Optional, List
from pydantic import BaseModel, field_validator, Field
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class MediaCategory(str, Enum):
    movie  = "movie"
    series = "series"

class JobStatus(str, Enum):
    pending   = "pending"
    queued    = "queued"
    active    = "active"
    completed = "completed"
    failed    = "failed"
    cancelled = "cancelled"

class DeliveryType(str, Enum):
    usb    = "usb"
    mobile = "mobile"

class PaymentMode(str, Enum):
    manual = "manual"
    online = "online"

class PaymentStatus(str, Enum):
    pending   = "pending"
    confirmed = "confirmed"
    failed    = "failed"
    refunded  = "refunded"


# ─── Media ────────────────────────────────────────────────────────────────────

class MediaItem(BaseModel):
    id:          str
    name:        str
    size_bytes:  int
    category:    MediaCategory
    extension:   str
    added_at:    str
    price_usd:   Optional[float] = None

class MediaListResponse(BaseModel):
    items: List[MediaItem]
    total: int


# ─── Drive ────────────────────────────────────────────────────────────────────

class DriveInfo(BaseModel):
    id:             str
    path:           str
    label:          Optional[str]
    capacity_bytes: Optional[int]
    free_bytes:     Optional[int]
    is_locked:      bool = False


# ─── Jobs ─────────────────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    media_id:      str = Field(..., min_length=36, max_length=36)
    drive_id:      Optional[str] = Field(None, min_length=1, max_length=100)
    delivery_type: DeliveryType = DeliveryType.usb
    payment_mode:  PaymentMode  = PaymentMode.manual
    priority:      int          = 0

    @field_validator("media_id")
    @classmethod
    def validate_media_id(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("media_id must be a valid UUID v4")
        return v

    @field_validator("drive_id")
    @classmethod
    def validate_drive_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^[A-Za-z0-9_\-:/\\\\.]+$', v):
            raise ValueError("drive_id contains invalid characters")
        return v


class JobResponse(BaseModel):
    id:             str
    media_id:       str
    drive_id:       Optional[str]
    status:         JobStatus
    delivery_type:  DeliveryType
    progress:       float
    bytes_written:  int
    error_message:  Optional[str]
    retry_count:    int
    created_at:     str
    started_at:     Optional[str]
    completed_at:   Optional[str]
    media_name:     Optional[str] = None
    media_size:     Optional[int] = None


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=200)

    @field_validator("username")
    @classmethod
    def sanitize_username(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_\-\.]+$', v):
            raise ValueError("Invalid username")
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1,  max_length=200)
    new_password: str = Field(..., min_length=8,  max_length=200)


# ─── Admin ────────────────────────────────────────────────────────────────────

class PricingTier(BaseModel):
    id:          Optional[int]  = None
    name:        str            = Field(..., min_length=1, max_length=100)
    max_size_gb: float          = Field(..., gt=0)
    price_usd:   float          = Field(..., ge=0)

class UpdatePricingRequest(BaseModel):
    tiers: List[PricingTier]

class ConfirmPaymentRequest(BaseModel):
    job_id:      str            = Field(..., min_length=36, max_length=36)
    payment_ref: Optional[str]  = Field(None, max_length=200)

    @field_validator("job_id")
    @classmethod
    def validate_job_id(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("job_id must be a valid UUID v4")
        return v

class SettingUpdate(BaseModel):
    key:   str = Field(..., max_length=100)
    value: str = Field(..., max_length=1000)

    @field_validator("key")
    @classmethod
    def valid_key(cls, v: str) -> str:
        allowed = {"shop_name", "currency", "max_copies_per_session", "media_root"}
        # === QR UPGRADE START ===
        allowed.update({
            "qr_base_url", "show_pricing", "shop_logo", "install_id",
            "shop_name", "default_currency",
            "media_server_url",  # BUGFIX: was missing — admin couldn't set agent media redirect
        })
        # === QR UPGRADE END ===
        if v not in allowed:
            raise ValueError(f"Unknown setting key: {v}. Allowed: {allowed}")
        return v


# ─── Mobile / Payments ────────────────────────────────────────────────────────

class IssueTokenRequest(BaseModel):
    job_id:      str = Field(..., min_length=36, max_length=36)
    media_id:    str = Field(..., min_length=36, max_length=36)
    ttl_seconds: int = Field(900, ge=60, le=86400)

class CreateStripeSessionRequest(BaseModel):
    job_id:       str = Field(..., min_length=36, max_length=36)
    amount_cents: int = Field(500, ge=50)
    currency:     str = Field("USD", max_length=3)
    description:  str = Field("SmartCopy Media Download", max_length=200)


# ─── Agent ────────────────────────────────────────────────────────────────────

class AgentRegisterRequest(BaseModel):
    agent_id: Optional[str] = None
    hostname: str           = Field("unknown", max_length=255)
    version:  str           = Field("0.0.0",   max_length=32)


# ─── WebSocket Events ─────────────────────────────────────────────────────────

class WSEvent(BaseModel):
    event:   str
    payload: dict

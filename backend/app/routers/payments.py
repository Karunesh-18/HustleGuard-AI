"""Payments router — Razorpay order creation and signature verification.

Endpoints:
  POST /api/v1/payments/create-order   — create a Razorpay order (returns order_id)
  POST /api/v1/payments/verify         — verify signature after checkout success
  GET  /api/v1/payments/key            — return public key_id for frontend (safe to expose)
"""

import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.payment_service import create_order, verify_payment_signature
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

_DB_GUARD = "Database is unavailable."


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    amount_inr: float = Field(gt=0, description="Amount in INR (≥ 1)")
    rider_id: int = Field(gt=0)
    purpose: str = Field(
        default="premium",
        description="'premium' | 'topup' | 'custom'",
    )
    notes: dict | None = None


class CreateOrderResponse(BaseModel):
    order_id: str
    amount_paise: int
    currency: str = "INR"
    key_id: str          # safe to return — this is the public key


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    rider_id: int = Field(gt=0)
    amount_inr: float = Field(gt=0)


class VerifyPaymentResponse(BaseModel):
    success: bool
    payment_id: str
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/key")
async def get_public_key() -> dict:
    """Return the Razorpay public key ID — safe to expose to the browser."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    if not key_id:
        raise HTTPException(status_code=503, detail="Razorpay not configured on this server.")
    return {"key_id": key_id}


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_payment_order(payload: CreateOrderRequest) -> CreateOrderResponse:
    """Create a Razorpay order.

    The frontend receives the order_id and opens the Razorpay checkout modal.
    Amount is accepted in INR and converted to paise internally.
    """
    receipt = f"rider_{payload.rider_id}_{payload.purpose}_{date.today().isoformat()}"
    try:
        order = create_order(
            amount_inr=payload.amount_inr,
            receipt=receipt,
            notes={"rider_id": str(payload.rider_id), "purpose": payload.purpose,
                   **(payload.notes or {})},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Payment service error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="Payment gateway error. Try again.") from exc

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    return CreateOrderResponse(
        order_id=order["id"],
        amount_paise=order["amount"],
        currency=order.get("currency", "INR"),
        key_id=key_id,
    )


@router.post("/verify", response_model=VerifyPaymentResponse)
async def verify_payment(payload: VerifyPaymentRequest) -> VerifyPaymentResponse:
    """Verify the Razorpay payment signature after checkout success.

    The signature is computed server-side using the secret key.
    Returns success=True only if the signature is genuine — preventing
    tampered / replayed payment IDs from being accepted.
    """
    try:
        valid = verify_payment_signature(
            order_id=payload.razorpay_order_id,
            payment_id=payload.razorpay_payment_id,
            signature=payload.razorpay_signature,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if not valid:
        logger.warning(
            "Invalid Razorpay signature for rider %s order %s",
            payload.rider_id, payload.razorpay_order_id,
        )
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed. Contact support.",
        )

    logger.info(
        "Payment verified | rider=%s payment=%s amount=₹%s",
        payload.rider_id, payload.razorpay_payment_id, payload.amount_inr,
    )

    # TODO (Phase 3): persist PaymentRecord to DB, update subscription billing_date
    return VerifyPaymentResponse(
        success=True,
        payment_id=payload.razorpay_payment_id,
        message=f"Payment of ₹{payload.amount_inr:.0f} verified successfully.",
    )

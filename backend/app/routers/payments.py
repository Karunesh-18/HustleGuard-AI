"""Payments router — Razorpay order creation and signature verification.

Endpoints:
  POST /api/v1/payments/create-order   — create a Razorpay order (returns order_id)
  POST /api/v1/payments/verify         — verify signature; on success, activate subscription
  GET  /api/v1/payments/key            — return public key_id for frontend (safe to expose)
"""

import logging
import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.payment_service import create_order, verify_payment_signature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

_DB_GUARD = "Database is unavailable."


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    amount_inr: float = Field(gt=0, description="Amount in INR (≥ 1)")
    rider_id: int = Field(gt=0)
    purpose: str = Field(
        default="premium",
        description="'premium' | 'topup' | 'custom' | 'account_link'",
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
    # If provided and purpose=="premium", subscribe this policy plan after verification
    policy_name: str | None = None
    purpose: str = "premium"


class VerifyPaymentResponse(BaseModel):
    success: bool
    payment_id: str
    message: str
    policy_activated: bool = False


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
async def verify_payment(
    payload: VerifyPaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> VerifyPaymentResponse:
    """Verify the Razorpay payment signature after checkout success.

    The signature is computed server-side using the secret key preventing
    tampered / replayed payment IDs from being accepted.

    If purpose=="premium" and policy_name is provided, the rider is
    automatically subscribed to that plan with the waiting period waived
    (payment proves good faith — waiving prevents locking out a rider who
    just paid but is in an active disruption).
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
        "Payment verified | rider=%s payment=%s amount=₹%s purpose=%s",
        payload.rider_id, payload.razorpay_payment_id, payload.amount_inr, payload.purpose,
    )

    # Auto-subscribe rider to plan if this was a premium payment
    policy_activated = False
    if payload.purpose == "premium" and payload.policy_name:
        if not getattr(request.app.state, "database_ready", False):
            # Log warning but don't fail — payment already verified
            logger.warning("DB unavailable — cannot auto-subscribe rider %s after payment", payload.rider_id)
        else:
            try:
                from app.schemas import RiderPolicyCreate
                from app.services.policy_service import subscribe_rider_to_policy
                sub_payload = RiderPolicyCreate(
                    rider_id=payload.rider_id,
                    policy_name=payload.policy_name,
                    waive_waiting_period=True,  # payment = proof of good faith
                )
                subscribe_rider_to_policy(db, sub_payload)
                policy_activated = True
                logger.info(
                    "Auto-subscribed rider %s to '%s' after Razorpay payment %s",
                    payload.rider_id, payload.policy_name, payload.razorpay_payment_id,
                )
            except Exception as sub_exc:
                # Don't fail the payment verification — subscription can be retried
                logger.error(
                    "Post-payment subscription failed for rider %s plan=%s: %s",
                    payload.rider_id, payload.policy_name, sub_exc,
                )

    msg = f"Payment of ₹{payload.amount_inr:.0f} verified successfully."
    if policy_activated:
        msg += f" Coverage plan '{payload.policy_name}' is now active."

    return VerifyPaymentResponse(
        success=True,
        payment_id=payload.razorpay_payment_id,
        message=msg,
        policy_activated=policy_activated,
    )

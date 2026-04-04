"""Razorpay payment service.

Handles:
  - Order creation (amount in paise, INR × 100)
  - Signature verification using HMAC-SHA256
  - Gracefully degrades if RAZORPAY_KEY_ID is not configured
"""
import hashlib
import hmac
import logging
import os

logger = logging.getLogger(__name__)

_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
_client = None


def _get_client():
    """Lazily initialise the Razorpay client so the app starts even if keys are missing."""
    global _client
    if _client is not None:
        return _client
    if not _KEY_ID or not _KEY_SECRET:
        raise RuntimeError(
            "Razorpay credentials not configured. "
            "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
        )
    try:
        import razorpay  # type: ignore[import-untyped]
        _client = razorpay.Client(auth=(_KEY_ID, _KEY_SECRET))
        logger.info("Razorpay client initialised (test mode: %s)", _KEY_ID.startswith("rzp_test_"))
    except ImportError as exc:
        raise RuntimeError("razorpay package not installed. Run: pip install razorpay") from exc
    return _client


def create_order(amount_inr: float, receipt: str, notes: dict | None = None) -> dict:
    """Create a Razorpay order.

    Args:
        amount_inr: Amount in Indian Rupees (will be converted to paise internally).
        receipt:    Unique receipt string (e.g. "rider_42_premium_2026-04-05").
        notes:      Optional metadata dict embedded in the Razorpay order.

    Returns:
        Razorpay order object (id, amount, currency, status, …).
    """
    client = _get_client()
    amount_paise = int(round(amount_inr * 100))
    if amount_paise < 100:
        raise ValueError(f"Minimum Razorpay order is ₹1 (100 paise). Got: {amount_paise}")

    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt[:40],          # Razorpay limit: 40 chars
        "notes": notes or {},
        "payment_capture": True,           # auto-capture on success
    })
    logger.info(
        "Razorpay order created | id=%s amount=%s receipt=%s",
        order["id"], amount_paise, receipt,
    )
    return order


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay webhook / checkout signature (HMAC-SHA256).

    Returns True if the signature matches (payment is genuine).
    Logs a warning and returns False on mismatch.
    """
    payload = f"{order_id}|{payment_id}"
    expected = hmac.new(
        _KEY_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    # Use compare_digest to prevent timing attacks
    result = hmac.compare_digest(expected, signature)
    if not result:
        logger.warning(
            "Razorpay signature mismatch | order=%s payment=%s", order_id, payment_id
        )
    return result

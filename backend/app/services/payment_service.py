"""Razorpay payment service.

Handles:
  - Order creation (amount in paise, INR × 100)
  - Signature verification using the official Razorpay SDK utility
  - Gracefully degrades if RAZORPAY_KEY_ID is not configured

Keys are read lazily inside functions (not at module import time) to avoid
ordering issues when .env is loaded after the module is first imported.
"""
import logging
import os

logger = logging.getLogger(__name__)

_client = None


def _key_id() -> str:
    """Read key ID lazily so .env is always loaded first."""
    return os.getenv("RAZORPAY_KEY_ID", "").strip()


def _key_secret() -> str:
    return os.getenv("RAZORPAY_KEY_SECRET", "").strip()


def _get_client():
    """Lazily initialise the Razorpay SDK client."""
    global _client
    if _client is not None:
        return _client
    kid = _key_id()
    ksec = _key_secret()
    if not kid or not ksec:
        raise RuntimeError(
            "Razorpay credentials not configured. "
            "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env"
        )
    try:
        import razorpay  # type: ignore[import-untyped]
        _client = razorpay.Client(auth=(kid, ksec))
        logger.info("Razorpay client initialised (test mode: %s)", kid.startswith("rzp_test_"))
    except ImportError as exc:
        raise RuntimeError("razorpay package not installed. Run: pip install razorpay") from exc
    return _client


def create_order(amount_inr: float, receipt: str, notes: dict | None = None) -> dict:
    """Create a Razorpay order.

    Args:
        amount_inr: Amount in Indian Rupees (converted to paise internally).
        receipt:    Unique receipt string (max 40 chars enforced).
        notes:      Optional metadata dict embedded in the order.

    Returns:
        Razorpay order dict (id, amount, currency, status, …).
    """
    client = _get_client()
    amount_paise = int(round(amount_inr * 100))
    if amount_paise < 100:
        raise ValueError(f"Minimum Razorpay order is ₹1 (100 paise). Got: {amount_paise}")

    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt[:40],
        "notes": notes or {},
        "payment_capture": True,
    })
    logger.info(
        "Razorpay order created | id=%s amount_paise=%s receipt=%s",
        order["id"], amount_paise, receipt,
    )
    return order


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay checkout signature using the official SDK utility.

    The SDK computes HMAC-SHA256 over "{order_id}|{payment_id}" with the
    secret key — identical algorithm to our manual implementation but using
    Razorpay's tested code path to ensure future-proof compliance.

    Returns True if signature matches (payment is genuine), False otherwise.
    """
    try:
        client = _get_client()
        # SDK raises razorpay.errors.SignatureVerificationError on mismatch
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        logger.info("Payment signature verified | order=%s payment=%s", order_id, payment_id)
        return True
    except Exception as exc:
        logger.warning(
            "Payment signature mismatch | order=%s payment=%s error=%s",
            order_id, payment_id, exc,
        )
        return False

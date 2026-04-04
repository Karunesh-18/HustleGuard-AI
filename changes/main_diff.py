"""
main.py — changes required (diff-style comments showing what to add).

Add these lines to backend/main.py alongside the existing router registrations:

BEFORE (original):
    from app.routers import claims, domain, fraud, health, ml, users, triggers

AFTER (refactored):
    from app.routers import claims, domain, fraud, health, ml, policy, users, triggers

And in the router registration section, add:

    app.include_router(policy.router)

That's the only change needed in main.py — the policy router is self-contained.
"""

# ── Paste this into main.py in the router imports section ────────────────────

from app.routers import claims, domain, fraud, health, ml, policy, users, triggers  # noqa: F401

# ── And add this line in the app.include_router() block ──────────────────────

# app.include_router(health.router)
# app.include_router(users.router)
# app.include_router(ml.router)
# app.include_router(fraud.router)
# app.include_router(claims.router)
# app.include_router(domain.router)
# app.include_router(triggers.router)
# app.include_router(policy.router)   ← ADD THIS LINE

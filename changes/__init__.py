"""
Routers package — registers all FastAPI routers.

Added: policy router for exclusion checking and policy terms endpoints.
"""
from . import claims, domain, fraud, health, ml, policy, triggers, users

__all__ = ["claims", "domain", "fraud", "health", "ml", "policy", "triggers", "users"]

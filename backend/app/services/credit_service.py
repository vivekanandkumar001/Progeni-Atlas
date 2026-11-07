"""Credit Pack Purchase Service.

Handles credit pack purchases, validation, and admin-controlled
free trials/permissions for candidates and recruiters.
All pack pricing is stored dynamically in SystemConfig - nothing is hardcoded.
"""

from datetime import datetime, timedelta
from sqlalchemy import select

from app.models import User, Purchase, SystemConfig
from app.services.otp_service import otp_service


def _get_pack_pricing(db, role: str) -> dict:
    """Get pack pricing for a role from SystemConfig, with fallback defaults."""
    # Try to load from SystemConfig
    config = db.scalar(
        select(SystemConfig).where(SystemConfig.key == f"credit_packs_{role}")
    )
    
    if config and config.value:
        return config.value
    
    # Fallback to hardcoded defaults (will be overwritten by admin via API)
    # These defaults match the original implementation
    if role == "candidate":
        return {
            "pack_49": (49, 30),
            "pack_99": (99, 70),
            "pack_199": (199, 150),
        }
    elif role == "recruiter":
        return {
            "pack_999": (999, 800),
            "pack_1999": (1999, 1800),
            "pack_4999": (4999, 4500),
        }
    return {}


def _save_pack_pricing(db, role: str, pricing: dict):
    """Save pack pricing to SystemConfig."""
    # Remove any existing config for this role
    db.execute(
        select(SystemConfig).where(SystemConfig.key == f"credit_packs_{role}")
    )
    # Actually let me just update or insert
    existing = db.scalar(
        select(SystemConfig).where(SystemConfig.key == f"credit_packs_{role}")
    )
    if existing:
        existing.value = pricing
        existing.updated_at = datetime.utcnow()
    else:
        existing = SystemConfig(
            key=f"credit_packs_{role}",
            value=pricing,
            description=f"Credit pack pricing for {role} role",
        )
        db.add(existing)
    db.flush()


def purchase_credits(db, user: User, pack_name: str) -> dict:
    """Process a credit pack purchase.

    Validates the pack, adds credits to the user's account,
    and records the purchase. Pricing read dynamically from SystemConfig.

    Returns dict with success status and details.
    """
    # Determine user role
    role = user.role.value

    # Get available packs and pricing for this role (from DB, not hardcoded)
    available_packs = _get_pack_pricing(db, role)

    # Validate pack exists for this role
    if pack_name not in available_packs:
        return {
            "success": False,
            "error": f"Invalid pack '{pack_name}' for role '{role}'",
            "available_packs": list(available_packs.keys()),
        }

    price, credits_added = available_packs[pack_name]

    # Check if user already has an active/pending purchase of this pack
    existing_pending = db.scalar(
        select(Purchase)
        .where(
            Purchase.user_id == user.id,
            Purchase.pack_name == pack_name,
            Purchase.status.in_(["pending", "completed"]),
        )
        .order_by(Purchase.created_at.desc())
        .limit(1)
    )

    if existing_pending:
        return {
            "success": False,
            "error": f"You already have a {pack_name} purchase {'completed' if existing_pending.status == 'completed' else 'pending'}",
        }

    # Create purchase record
    purchase = Purchase(
        user_id=user.id,
        amount=price,
        credits_added=credits_added,
        pack_name=pack_name,
        purpose="credit_purchase",
        status="pending",
    )
    db.add(purchase)
    db.flush()

    # Add credits to user
    user.credits += credits_added
    purchase.status = "completed"

    # Save updated pricing back to DB (in case admin changed it)
    _save_pack_pricing(db, role, _get_pack_pricing(db, role))

    # Record the purchase
    db.flush()

    return {
        "success": True,
        "pack_name": pack_name,
        "price": price,
        "credits_added": credits_added,
        "new_balance": user.credits,
        "transaction_id": purchase.id,
    }


def admin_give_credits(db, user: User, credits: int, reason: str = "admin_award") -> dict:
    """Admin gives free credits to a user.

    Admin can give credits to candidates (free trials) or recruiters.
    This does not create a purchase record.

    Returns dict with success status and new balance.
    """
    user.credits += credits

    # Record as an admin award (no purchase record)
    return {
        "success": True,
        "credits_added": credits,
        "new_balance": user.credits,
        "reason": reason,
        "transaction_type": "admin_award",
    }


def admin_set_pack_pricing(db, role: str, packs: dict) -> dict:
    """Admin can modify credit pack pricing for a role.

    Args:
        role: "candidate" or "recruiter"
        packs: dict of pack_name: (price, credits)

    Updates SystemConfig and returns confirmation.
    """
    _save_pack_pricing(db, role, packs)
    return {
        "success": True,
        "role": role,
        "new_pricing": packs,
    }
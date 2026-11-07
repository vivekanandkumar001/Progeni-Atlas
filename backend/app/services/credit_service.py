"""Credit Pack Purchase Service.

Handles credit pack purchases, validation, and admin-controlled
free trials/permissions for candidates and recruiters.
"""

from datetime import datetime, timedelta
from sqlalchemy import select

from app.models import User, Purchase
from app.services.otp_service import otp_service


# Credit pack pricing configuration (in rupees)
# Format: {role: {pack_name: (price_in_rupees, credits_added)}}
CREDIT_PACK_PRICING = {
    "candidate": {
        "pack_49": (49, 30),   # ₹49 = 30 credits
        "pack_99": (99, 70),   # ₹99 = 70 credits
        "pack_199": (199, 150), # ₹199 = 150 credits
    },
    "recruiter": {
        "pack_999": (999, 800),  # ₹999 = 800 credits
        "pack_1999": (1999, 1800), # ₹1999 = 1800 credits
        "pack_4999": (4999, 4500), # ₹4999 = 4500 credits
    },
}


def get_available_packs(role: str) -> dict:
    """Get available credit packs for a given role."""
    return CREDIT_PACK_PRICING.get(role, {})


def purchase_credits(db, user: User, pack_name: str) -> dict:
    """Process a credit pack purchase.

    Validates the pack, checks if user can purchase it,
    adds credits to the user's account, and records the purchase.

    Returns dict with success status and details.
    """
    # Determine user role
    role = user.role.value

    # Get available packs for this role
    available_packs = get_available_packs(role)

    # Validate pack exists for this role
    if pack_name not in available_packs:
        return {
            "success": False,
            "error": f"Invalid pack '{pack_name}' for role '{role}'",
            "available_packs": list(available_packs.keys()),
        }

    price, credits_added = available_packs[pack_name]

    # Check if user already has an active/pending purchase of this pack
    # (Prevent double-purchasing same pack simultaneously)
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


def admin_set_pack_pricing(role: str, packs: dict) -> dict:
    """Admin can modify credit pack pricing for a role.

    Args:
        role: "candidate" or "recruiter"
        packs: dict of pack_name: (price, credits)

    Returns confirmation.
    """
    CREDIT_PACK_PRICING[role] = packs
    return {
        "success": True,
        "role": role,
        "new_pricing": packs,
    }
"""
Progeni Atlas — Billing & Wallet Blueprint
===========================================
Wallet balance, ledger transactions, Razorpay order creation, payment verification.
"""

import os
import uuid
import time
import hashlib
import hmac
import traceback
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, g

from core.db import get_mongo_db
from core.security import (
    _authenticate_request, resolve_user, require_auth, require_super_admin
)
from core.context import get_current_candidate, get_current_recruiter
from core.wallet import get_user_wallet_balance

billing_bp = Blueprint("billing_bp", __name__)

@billing_bp.route("/api/billing/wallet", methods=["GET"])
@require_auth
def get_billing_wallet():
    """Fetch billing wallet balance and credit allowances dynamically from MongoDB."""
    try:
        user = getattr(g, "user", None)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        user_id = str(user.get("id") or user.get("_id"))
        name = user.get("full_name") or user.get("name") or "User"
        role = (user.get("role", "candidate") or "candidate").upper()
        acc_type = "RECRUITER" if role in ("RECRUITER", "EMPLOYER", "ADMIN") else "CANDIDATE"
        
        db = get_mongo_db()
        wallet_doc = None
        demo_quota = {
            "totalAllowed": 0,
            "completed": 0,
            "remaining": 0,
            "maxDurationSeconds": 600
        }
        if db is not None:
            da_query = [{"user_id": user_id}]
            if user and user.get("org_id"):
                da_query.append({"org_id": user.get("org_id")})
            da = db.demo_allowances.find_one({"$or": da_query})
            if da:
                total_a = int(da.get("free_demos_total") or 2)
                used_a = int(da.get("free_demos_used") or 0)
                rem_a = int(da.get("free_demos_remaining") if da.get("free_demos_remaining") is not None else max(0, total_a - used_a))
                demo_quota = {
                    "totalAllowed": total_a,
                    "completed": used_a,
                    "remaining": rem_a,
                    "maxDurationSeconds": int(da.get("demo_duration_limit_seconds") or 600)
                }

            wallet_doc = db.wallets.find_one({"userId": user_id})
            if not wallet_doc:
                now_str = datetime.now(timezone.utc).isoformat()
                init_credits = 10.0 if acc_type == "CANDIDATE" else 0.0
                wallet_doc = {
                    "id": "wallet-" + (user_id[:8] if user_id else "user"),
                    "accountName": f"{name}'s Primary Wallet",
                    "accountType": acc_type,
                    "orgId": user.get("org_id") if user else None,
                    "userId": user_id,
                    "currency": "INR",
                    "ratePerMinuteCredits": 0.5,
                    "baseFeeCredits": 0.0,
                    "availableCredits": init_credits,
                    "paidCredits": 0.0,
                    "promotionalCredits": init_credits,
                    "consumedCredits": 0.0,
                    "reservedCredits": 0.0,
                    "lowBalanceThresholdCredits": 5.0,
                    "isLowBalance": init_credits <= 0,
                    "chargingEnabled": True,
                    "demoQuota": demo_quota,
                    "created_at": now_str,
                    "updated_at": now_str
                }
                db.wallets.insert_one(wallet_doc)
            else:
                wallet_doc["demoQuota"] = demo_quota
                # Ensure authoritative rate: 1 Rupee = 2 Minutes (0.5 credits/min)
                if wallet_doc.get("ratePerMinuteCredits") != 0.5:
                    wallet_doc["ratePerMinuteCredits"] = 0.5
                    db.wallets.update_one({"_id": wallet_doc["_id"]}, {"$set": {"ratePerMinuteCredits": 0.5}})

        if wallet_doc:
            wallet_doc["ratePerMinuteCredits"] = 0.5
            # GUARANTEE: Balance is NEVER negative (min 0.0)
            curr_bal = max(0.0, float(wallet_doc.get("availableCredits", 0.0)))
            wallet_doc["availableCredits"] = curr_bal
            wallet_doc["isLowBalance"] = curr_bal <= float(wallet_doc.get("lowBalanceThresholdCredits", 5.0))
            wallet_doc.pop("_id", None)
            return jsonify({"success": True, "wallet": wallet_doc}), 200

        return jsonify({
            "success": True,
            "wallet": {
                "id": "wallet-" + (user_id[:8] if user_id else "cand"),
                "accountName": f"{name}'s Primary Wallet",
                "accountType": acc_type,
                "orgId": None,
                "userId": user_id,
                "currency": "INR",
                "ratePerMinuteCredits": 0.5,
                "baseFeeCredits": 0.0,
                "availableCredits": 0.0,
                "paidCredits": 0.0,
                "promotionalCredits": 0.0,
                "consumedCredits": 0.0,
                "reservedCredits": 0.0,
                "lowBalanceThresholdCredits": 5.0,
                "isLowBalance": True,
                "chargingEnabled": True,
                "demoQuota": demo_quota
            }
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@billing_bp.route("/api/billing/wallet/transactions", methods=["GET"])
@require_auth
def get_billing_wallet_transactions():
    """Fetch persistent wallet transactions from MongoDB ledger with Paytm-style statement."""
    try:
        user = getattr(g, "user", None)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        user_id = str(user.get("id") or user.get("_id"))
        user_email = (user and user.get("email")) or ""

        db = get_mongo_db()
        if db is not None:
            # 1. Check for completed interview sessions that require ledger entries
            filter_q = {"status": {"$in": ["completed", "COMPLETED"]}}
            or_conds = []
            if user_id:
                or_conds.extend([{"candidate_id": user_id}, {"candidate_id": str(user_id)}])
            if user_email:
                or_conds.append({"candidate_email": user_email})
            if or_conds:
                filter_q["$or"] = or_conds

            completed_sessions = list(db.interview_sessions.find(filter_q).sort("created_at", 1))
            for session in completed_sessions:
                s_id = str(session.get("id") or session.get("session_id") or session.get("_id"))
                existing_entry = db.wallet_transactions.find_one({
                    "$or": [
                        {"sessionId": s_id},
                        {"id": f"tx-interview-{s_id[:8]}"},
                        {"id": f"tx-demo-{s_id[:8]}"}
                    ]
                })
                if not existing_entry:
                    role_name = session.get("job_title") or session.get("role_title") or "Technical Screening"
                    started = session.get("started_at")
                    finished = session.get("finished_at")
                    duration_mins = 4
                    if started and finished:
                        try:
                            s_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
                            f_dt = datetime.fromisoformat(finished.replace("Z", "+00:00"))
                            diff_sec = (f_dt - s_dt).total_seconds()
                            if 30 <= diff_sec <= 7200:
                                duration_mins = max(1, int(round(diff_sec / 60)))
                        except Exception:
                            pass
                    elif session.get("duration_minutes"):
                        duration_mins = min(int(session.get("duration_minutes")), 15)

                    is_demo = (session.get("session_type") == "demo") or (s_id == "7f0b6c2f-29b9-4317-8e99-39e7894422b5")
                    if is_demo:
                        db.wallet_transactions.insert_one({
                            "id": f"tx-demo-{s_id[:8]}",
                            "userId": user_id,
                            "sessionId": s_id,
                            "txRef": f"TXN-DEMO-{s_id[:8].upper()}",
                            "entryType": "free_demo",
                            "category": "DEMO",
                            "title": f"Practice Interview: {role_name}",
                            "reason": f"Free Demo Quota Used (1 of 2) • 100% Discounted ({duration_mins} mins)",
                            "amountCredits": 0.0,
                            "amountInr": 0.0,
                            "roleTitle": role_name,
                            "durationMinutes": duration_mins,
                            "ratePerMinute": 0.0,
                            "status": "COMPLETED",
                            "createdAt": finished or session.get("created_at") or datetime.now(timezone.utc).isoformat()
                        })
                    else:
                        rate = 2.0
                        cost = round(duration_mins * rate, 2)
                        db.wallet_transactions.insert_one({
                            "id": f"tx-interview-{s_id[:8]}",
                            "userId": user_id,
                            "sessionId": s_id,
                            "txRef": f"TXN-PRACTICE-{s_id[:8].upper()}",
                            "entryType": "interview_debit",
                            "category": "OUT",
                            "title": f"Practice Interview: {role_name}",
                            "reason": f"AI Technical Practice Screening ({duration_mins} mins @ 2 cr/min)",
                            "amountCredits": -cost,
                            "amountInr": -cost,
                            "roleTitle": role_name,
                            "durationMinutes": duration_mins,
                            "ratePerMinute": rate,
                            "status": "COMPLETED",
                            "createdAt": finished or session.get("created_at") or datetime.now(timezone.utc).isoformat()
                        })

            # 3. Fetch all transactions and compute chronological running balances
            raw_docs = list(db.wallet_transactions.find(
                {"$or": [{"userId": user_id}, {"candidate_id": user_id}]}
            ).sort("createdAt", 1))

            running_balance = 0.0
            total_credited = 0.0
            total_debited = 0.0

            enriched_txs = []
            for d in raw_docs:
                d.pop("_id", None)
                amt = float(d.get("amountCredits") or 0.0)
                # GUARANTEE: Balance can NEVER be negative!
                running_balance = max(0.0, running_balance + amt)
                d["balanceAfter"] = max(0.0, round(running_balance, 2))
                d["amountCredits"] = round(amt, 2)
                d["amountInr"] = round(amt, 2)

                if amt > 0:
                    total_credited += amt
                    d["category"] = "IN"
                    if not d.get("title"):
                        d["title"] = d.get("reason") or "Credits Added"
                elif amt < 0:
                    total_debited += abs(amt)
                    d["category"] = "OUT"
                    if not d.get("title"):
                        d["title"] = "Interview Settlement"
                else:
                    d["category"] = "DEMO"
                    if not d.get("title"):
                        d["title"] = "Free Demo Interview"

                enriched_txs.append(d)

            # Update wallet document with consistent balances (guaranteed >= 0.0)
            final_available = max(0.0, round(running_balance, 2))
            now_iso = datetime.now(timezone.utc).isoformat()
            db.wallets.update_one(
                {"userId": user_id},
                {
                    "$set": {
                        "availableCredits": final_available,
                        "consumedCredits": round(total_debited, 2),
                        "updated_at": now_iso
                    }
                },
                upsert=True
            )

            # Sort descending for display (newest transaction first)
            enriched_txs.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)

            return jsonify({
                "success": True,
                "transactions": enriched_txs,
                "summary": {
                    "availableCredits": final_available,
                    "totalCredited": round(total_credited, 2),
                    "totalDebited": round(total_debited, 2),
                    "count": len(enriched_txs)
                }
            }), 200

        # Fallback if DB is unavailable or empty
        return jsonify({
            "success": True,
            "transactions": [],
            "summary": {
                "availableCredits": 0.0,
                "totalCredited": 0.0,
                "totalDebited": 0.0,
                "count": 0
            }
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ==============================================================================
# MAYANK SINGH MULTI-MERCHANT UPI PAYMENT GATEWAY (Repo: mynkdev-21/upi-gateway)
# ==============================================================================
MAYANK_UPI_GATEWAY_URL = os.environ.get("UPI_GATEWAY_URL", "https://pay.progeni.live").rstrip("/")
MAYANK_UPI_KEY = os.environ.get("UPI_GATEWAY_KEY", "live_key_mayank_upi_progeni")
MAYANK_UPI_SECRET = os.environ.get("UPI_GATEWAY_SECRET", "sec_mayank_upi_signed_secret_2026")
MAYANK_UPI_VPA = os.environ.get("UPI_MERCHANT_VPA", "progeniatlas@ptaxis")
MAYANK_UPI_PAYEE = os.environ.get("UPI_PAYEE_NAME", "Progeni Atlas")


def _complete_paid_order(db, order_rec, payment_ref, reason_title):
    """Atomically credit candidate/recruiter wallet, update order status, and log transaction.
    Guarantees idempotency via atomic state transition (pending -> paid)."""
    if not order_rec or not db:
        return 0.0

    order_id = order_rec.get("order_id")
    user_id = order_rec.get("userId")
    amount_credits = float(order_rec.get("amount_credits") or 0.0)
    if not order_id or not user_id or amount_credits <= 0:
        return 0.0

    now_str = datetime.now(timezone.utc).isoformat()

    # Atomic guard: only transition from non-paid state once
    res = db.billing_orders.update_one(
        {
            "order_id": order_id,
            "status": {"$in": ["pending", "review", "pending_verification"]}
        },
        {"$set": {
            "status": "paid",
            "utr": payment_ref,
            "payment_id": payment_ref,
            "paid_at": now_str,
            "updated_at": now_str
        }}
    )

    if res.modified_count == 0:
        # Already processed or invalid status
        return 0.0

    # Increment wallet balance atomically
    db.wallets.update_one(
        {"userId": user_id},
        {
            "$inc": {
                "availableCredits": amount_credits,
                "paidCredits": amount_credits
            },
            "$set": {"updated_at": now_str}
        },
        upsert=True
    )

    # Insert immutable transaction record in MongoDB ledger
    tx_id = f"tx-upi-{payment_ref[-12:]}" if len(payment_ref) >= 12 else f"tx-upi-{uuid.uuid4().hex[:10]}"
    db.wallet_transactions.update_one(
        {"id": tx_id},
        {"$set": {
            "id": tx_id,
            "userId": user_id,
            "txRef": f"TXN-{payment_ref[-12:].upper() if len(payment_ref) >= 12 else payment_ref}",
            "entryType": "recharge_paid",
            "category": "IN",
            "title": "Money Added via Progeni Atlas UPI",
            "amountCredits": amount_credits,
            "amountInr": float(order_rec.get("amount_inr") or amount_credits),
            "paymentId": payment_ref,
            "orderId": order_id,
            "reason": reason_title,
            "status": "COMPLETED",
            "createdAt": now_str
        }},
        upsert=True
    )
    return amount_credits


@billing_bp.route("/api/billing/wallet/create-order", methods=["POST"])
@require_auth
def create_wallet_order():
    """Create a verified payment order using Progeni Atlas UPI Gateway."""
    try:
        user = g.user
        if not user:
            user, _, _ = get_current_candidate(request)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        user_id = str(user.get("id") or user.get("_id"))
        name = user.get("full_name") or user.get("name") or "Candidate"
        email = user.get("email") or "candidate@progeni.live"
        phone = user.get("phone") or ""

        data = request.get_json(silent=True) or {}
        amount_credits = float(data.get("amount_credits") or data.get("amount") or 70)
        amount_inr = float(data.get("amount_inr") or data.get("inr") or data.get("amount") or amount_credits)
        amount_inr_formatted = f"{amount_inr:.2f}"

        client_order_id = f"PA-ORD-{uuid.uuid4().hex[:10].upper()}"
        note = f"Progeni Atlas Credits ({int(amount_credits)} cr)"

        # Standard RFC-3986 UPI Intent URI (matches Mayank Singh upi-gateway Order->upiIntentUrl specification)
        from urllib.parse import urlencode
        params = {
            "pa": MAYANK_UPI_VPA,
            "pn": MAYANK_UPI_PAYEE,
            "am": amount_inr_formatted,
            "cu": "INR",
            "tr": client_order_id,
            "tn": note
        }
        upi_intent = f"upi://pay?{urlencode(params)}"
        payment_url = f"{MAYANK_UPI_GATEWAY_URL}/pay/{client_order_id}"
        order_no = client_order_id

        # Attempt to create order directly in Mayank Singh Gateway API if server is reached
        try:
            import requests
            gw_res = requests.post(
                f"{MAYANK_UPI_GATEWAY_URL}/api/v1/orders",
                headers={
                    "X-Api-Key": MAYANK_UPI_KEY,
                    "X-Api-Secret": MAYANK_UPI_SECRET,
                    "Content-Type": "application/json"
                },
                json={
                    "amount": float(amount_inr_formatted),
                    "client_order_id": client_order_id,
                    "customer_name": name,
                    "customer_email": email,
                    "customer_mobile": phone,
                    "note": note,
                    "redirect_url": "https://atlas.progeni.live/candidate/wallet"
                },
                timeout=4
            )
            if gw_res.ok:
                res_json = gw_res.json()
                order_data = res_json.get("data", {})
                if order_data.get("order_id"):
                    order_no = order_data.get("order_id")
                if order_data.get("upi_intent"):
                    upi_intent = order_data.get("upi_intent")
                if order_data.get("payment_url"):
                    payment_url = order_data.get("payment_url")
        except Exception as gw_err:
            # Fallback to direct dynamic client-side UPI intent
            print(f"[Mayank UPI Gateway direct intent used]: {gw_err}")

        # Save order record in MongoDB
        db = get_mongo_db()
        if db is not None:
            now_iso = datetime.now(timezone.utc).isoformat()
            db.billing_orders.update_one(
                {"order_id": order_no},
                {"$set": {
                    "order_id": order_no,
                    "client_order_id": client_order_id,
                    "userId": user_id,
                    "gateway": "progeni_atlas_upi",
                    "amount_credits": amount_credits,
                    "amount_inr": amount_inr,
                    "amount_paise": int(round(amount_inr * 100)),
                    "upi_vpa": MAYANK_UPI_VPA,
                    "upi_intent": upi_intent,
                    "status": "pending",
                    "created_at": now_iso
                }},
                upsert=True
            )

        return jsonify({
            "success": True,
            "gateway": "progeni_atlas_upi",
            "order_id": order_no,
            "client_order_id": client_order_id,
            "amount_inr": amount_inr,
            "amount_credits": amount_credits,
            "amount": int(round(amount_inr * 100)),
            "currency": "INR",
            "upi_id": MAYANK_UPI_VPA,
            "payee_name": MAYANK_UPI_PAYEE,
            "upi_intent": upi_intent,
            "qr_data": upi_intent,
            "payment_url": payment_url,
            "account_name": f"{name}'s Primary Wallet",
            "user_name": name,
            "user_email": email
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@billing_bp.route("/api/billing/wallet/check-order-status", methods=["GET", "POST"])
@require_auth
def check_order_status():
    """Poll live payment status from Mayank Singh's gateway or MongoDB order record."""
    try:
        user = getattr(g, "user", None)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        data = request.get_json(silent=True) or {}
        order_id = request.args.get("order_id") or data.get("order_id") or data.get("client_order_id")
        if not order_id:
            return jsonify({"success": False, "error": "order_id is required"}), 400

        db = get_mongo_db()
        order_rec = None
        if db is not None:
            order_rec = db.billing_orders.find_one({"$or": [{"order_id": order_id}, {"client_order_id": order_id}]})

        if not order_rec:
            return jsonify({"success": False, "error": "Order not found"}), 404

        # Enforce account ownership check
        caller_id = str(user.get("id") or user.get("_id"))
        order_user_id = str(order_rec.get("userId") or "")
        if order_user_id and order_user_id != caller_id and str(user.get("role", "")).lower() not in ("super_admin", "admin"):
            return jsonify({"success": False, "error": "Unauthorized: Order does not belong to your account"}), 403

        status = order_rec.get("status") or "pending"

        # If not yet paid, poll Mayank Singh Gateway API
        if status != "paid":
            try:
                import requests
                gw_check = requests.get(
                    f"{MAYANK_UPI_GATEWAY_URL}/api/v1/orders/{order_id}",
                    headers={
                        "X-Api-Key": MAYANK_UPI_KEY,
                        "X-Api-Secret": MAYANK_UPI_SECRET
                    },
                    timeout=3
                )
                if gw_check.ok:
                    gw_data = gw_check.json().get("data", {})
                    if gw_data.get("status") == "paid":
                        status = "paid"
                        utr = gw_data.get("utr") or f"UPI-{uuid.uuid4().hex[:8].upper()}"
                        if db is not None and order_rec:
                            _complete_paid_order(db, order_rec, utr, "Progeni Atlas UPI Auto-Check")
            except Exception:
                pass

        return jsonify({
            "success": True,
            "order_id": order_id,
            "status": status,
            "amount_credits": (order_rec.get("amount_credits") if order_rec else 70)
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@billing_bp.route("/api/billing/wallet/submit-utr", methods=["POST"])
@require_auth
def submit_wallet_utr():
    """Verify UPI transaction via customer-submitted 12-digit UTR number."""
    try:
        user = g.user
        if not user:
            user, _, _ = get_current_candidate(request)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        user_id = str(user.get("id") or user.get("_id"))

        data = request.get_json(silent=True) or {}
        order_id = str(data.get("order_id") or "").strip()
        utr = str(data.get("utr") or "").strip()

        if not order_id:
            return jsonify({"success": False, "error": "order_id is required"}), 400
        if not utr or len(utr) < 6:
            return jsonify({"success": False, "error": "Please enter a valid UPI reference (UTR) number (minimum 6 digits)"}), 400

        db = get_mongo_db()
        if db is None:
            return jsonify({"success": False, "error": "Database not reachable"}), 500

        # Validate that order exists and belongs authoritatively to this user
        order_rec = db.billing_orders.find_one({"$or": [{"order_id": order_id}, {"client_order_id": order_id}]})
        if not order_rec:
            return jsonify({"success": False, "error": "Order not found"}), 404

        order_user_id = str(order_rec.get("userId") or "")
        if order_user_id and order_user_id != user_id:
            return jsonify({"success": False, "error": "Unauthorized: Order does not belong to your account"}), 403

        if order_rec.get("status") == "paid":
            return jsonify({
                "success": True,
                "message": "This order has already been verified and credited.",
                "status": "paid",
                "order_id": order_id
            }), 200

        # Anti-Replay: check if UTR was already recorded in any completed order or transaction
        existing_utr = db.billing_orders.find_one({"utr": utr, "status": "paid"})
        if existing_utr and existing_utr.get("order_id") != order_id:
            return jsonify({"success": False, "error": "This UTR number has already been claimed on another order."}), 409

        # Poll Mayank Singh UPI Gateway for authoritative confirmation
        is_gw_paid = False
        try:
            import requests
            gw_check = requests.get(
                f"{MAYANK_UPI_GATEWAY_URL}/api/v1/orders/{order_id}",
                headers={
                    "X-Api-Key": MAYANK_UPI_KEY,
                    "X-Api-Secret": MAYANK_UPI_SECRET
                },
                timeout=4
            )
            if gw_check.ok:
                gw_data = gw_check.json().get("data", {})
                if gw_data.get("status") == "paid":
                    is_gw_paid = True
                    utr = gw_data.get("utr") or utr
        except Exception as gw_err:
            print(f"[Gateway Verification Check]: {gw_err}")

        if is_gw_paid:
            credits_added = _complete_paid_order(db, order_rec, utr, f"Progeni Atlas UPI Gateway (UTR: {utr})")
            return jsonify({
                "success": True,
                "message": f"Payment verified! {int(credits_added)} credits added to your wallet.",
                "utr": utr,
                "order_id": order_id,
                "status": "paid",
                "credits_added": credits_added
            }), 200

        # Gateway has not yet confirmed: record UTR under pending verification
        now_str = datetime.now(timezone.utc).isoformat()
        db.billing_orders.update_one(
            {"order_id": order_rec.get("order_id")},
            {"$set": {
                "utr": utr,
                "status": "pending_verification",
                "submitted_at": now_str,
                "updated_at": now_str
            }}
        )

        return jsonify({
            "success": True,
            "message": "UTR reference received and submitted for gateway confirmation.",
            "utr": utr,
            "order_id": order_id,
            "status": "pending_verification"
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@billing_bp.route("/api/billing/wallet/upi-webhook", methods=["POST"])
def upi_webhook():
    """Signed webhook listener for Mayank Singh's Multi-Merchant UPI Gateway."""
    try:
        raw_body = request.get_data()
        signature = request.headers.get("X-Signature", "")
        event = request.headers.get("X-Event", "")

        # Strict HMAC-SHA256 signature verification
        if not MAYANK_UPI_SECRET:
            print("[UPI Webhook Warning]: MAYANK_UPI_SECRET is not configured on server.")
            return jsonify({"success": False, "error": "Webhook signing secret is not configured"}), 500

        if not signature:
            return jsonify({"success": False, "error": "Missing signature header"}), 401

        expected_sig = hmac.new(MAYANK_UPI_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, signature):
            print(f"[UPI Webhook Warning]: Invalid signature. Received: {signature}")
            return jsonify({"success": False, "error": "Invalid webhook signature"}), 401

        payload = request.get_json(silent=True) or {}
        order_data = payload.get("data", {})
        client_order_id = order_data.get("client_order_id") or order_data.get("order_id")
        status = order_data.get("status")
        utr = order_data.get("utr") or f"WEBHOOK-{uuid.uuid4().hex[:8].upper()}"

        if (event == "order.paid" or status == "paid") and client_order_id:
            db = get_mongo_db()
            if db is not None:
                order_rec = db.billing_orders.find_one({"$or": [{"order_id": client_order_id}, {"client_order_id": client_order_id}]})
                if order_rec and order_rec.get("status") != "paid":
                    _complete_paid_order(db, order_rec, utr, f"Webhook Verified Payment (UTR: {utr})")

        return jsonify({"success": True, "message": "Webhook processed successfully"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@billing_bp.route("/api/billing/wallet/verify-payment", methods=["POST"])
@require_auth
def verify_wallet_payment():
    """Authoritative payment verification requiring user authentication and upstream gateway confirmation."""
    try:
        user = g.user
        if not user:
            user, _, _ = get_current_candidate(request)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        user_id = str(user.get("id") or user.get("_id"))
        data = request.get_json(silent=True) or {}
        rzp_order_id = str(data.get("razorpay_order_id") or "").strip()
        rzp_payment_id = str(data.get("razorpay_payment_id") or "").strip()
        rzp_signature = str(data.get("razorpay_signature") or "").strip()
        order_id = str(data.get("order_id") or rzp_order_id or "").strip()
        utr = str(data.get("utr") or rzp_payment_id or "").strip()

        if not order_id:
            return jsonify({"success": False, "error": "order_id is required"}), 400

        db = get_mongo_db()
        if db is None:
            return jsonify({"success": False, "error": "Database unavailable"}), 503

        order_rec = db.billing_orders.find_one({"$or": [{"order_id": order_id}, {"client_order_id": order_id}]})
        if not order_rec:
            return jsonify({"success": False, "error": "Order not found"}), 404

        order_user_id = str(order_rec.get("userId") or "")
        if order_user_id and order_user_id != user_id:
            return jsonify({"success": False, "error": "Unauthorized: Order does not belong to your account"}), 403

        if order_rec.get("status") == "paid":
            return jsonify({
                "success": True,
                "message": "Order is already verified and credited.",
                "status": "paid",
                "order_id": order_id
            }), 200

        # Authoritatively verify transaction with payment gateway
        is_gw_paid = False

        # 1. Official Razorpay Signature Verification
        rzp_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
        if rzp_order_id and rzp_payment_id and rzp_signature and rzp_secret:
            msg = f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8")
            expected_sig = hmac.new(rzp_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected_sig, rzp_signature):
                is_gw_paid = True
                utr = rzp_payment_id

        # 2. Mayank UPI Gateway API Verification (if not already verified via Razorpay)
        if not is_gw_paid and MAYANK_UPI_GATEWAY_URL and MAYANK_UPI_KEY:
            try:
                import requests
                gw_check = requests.get(
                    f"{MAYANK_UPI_GATEWAY_URL}/api/v1/orders/{order_id}",
                    headers={
                        "X-Api-Key": MAYANK_UPI_KEY,
                        "X-Api-Secret": MAYANK_UPI_SECRET
                    },
                    timeout=4
                )
                if gw_check.ok:
                    gw_data = gw_check.json().get("data", {})
                    if gw_data.get("status") == "paid":
                        is_gw_paid = True
                        utr = gw_data.get("utr") or utr or f"UPI-{uuid.uuid4().hex[:8].upper()}"
            except Exception as gw_err:
                print(f"[Payment Verification Gateway Check Error]: {gw_err}")

        if is_gw_paid:
            credits_added = _complete_paid_order(db, order_rec, utr, f"Gateway Verified Payment (Ref: {utr})")
            return jsonify({
                "success": True,
                "message": f"Payment verified! {int(credits_added)} credits added to your wallet.",
                "paymentId": utr,
                "orderId": order_id,
                "rechargeAmountCredits": credits_added,
                "status": "paid"
            }), 200

        # Not confirmed yet by gateway: record reference under pending_verification
        now_str = datetime.now(timezone.utc).isoformat()
        if utr:
            db.billing_orders.update_one(
                {"order_id": order_rec.get("order_id")},
                {"$set": {
                    "utr": utr,
                    "status": "pending_verification",
                    "submitted_at": now_str,
                    "updated_at": now_str
                }}
            )

        return jsonify({
            "success": True,
            "message": "Payment is being verified by the payment gateway.",
            "status": "pending_verification",
            "order_id": order_id
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500



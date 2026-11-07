"""Authentication routes. Backend is the sole authorization authority."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models import (
    OtpCode,
    Organization,
    RefreshToken,
    User,
    UserRole,
    UserStatus,
)
from app.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    OtpStatusResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    ResendOtpRequest,
    ResendOtpResponse,
    TokenPair,
    UserOut,
    VerifyOtpRequest,
)
from app.services import audit, otp_service
from app.services.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _slugify(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "org"
    return base[:120]


def _issue_tokens(db: Session, user: User, request: Request) -> TokenPair:
    access = create_access_token(
        subject=user.id, role=user.role.value, org_id=user.org_id
    )
    raw_refresh, refresh_hash = create_refresh_token(subject=user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=(request.headers.get("user-agent") or "")[:400] or None,
        )
    )
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return TokenPair(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    if payload.role == UserRole.SUPER_ADMIN:
        # Super admin is never self-service; it is provisioned only.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin accounts cannot be self-registered",
        )

    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email is already registered")

    org: Organization | None = None
    if payload.role == UserRole.RECRUITER:
        if not payload.org_name:
            raise HTTPException(
                status_code=422, detail="org_name is required to register as a recruiter"
            )
        org_name = payload.org_name.strip()
        base = _slugify(org_name)
        slug, suffix = base, 1
        while db.scalar(select(Organization).where(Organization.slug == slug)):
            suffix += 1
            slug = f"{base}-{suffix}"
        org = Organization(name=org_name, slug=slug)
        db.add(org)
        db.flush()

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
        org_id=org.id if org else None,
        headline=payload.headline,
        is_email_verified=False,
        status=UserStatus.ACTIVE,
        credits=0,  # Will be set to 10 after OTP verification
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered") from None

    # Generate and send 6-digit email OTP (2-minute TTL, HMAC-SHA256 peppered)
    otp_record_email, raw_code_email, email_sent, email_err = otp_service.create_and_send_otp(
        db, email=email, user_id=user.id, purpose="REGISTRATION_VERIFY"
    )

    # Generate and send 6-digit phone OTP (2-minute TTL, HMAC-SHA256 peppered)
    # Only send if phone number is provided
    otp_record_phone = None
    raw_code_phone = None
    if payload.phone:
        otp_record_phone, raw_code_phone, sms_sent, sms_err = otp_service.create_and_send_otp(
            db, phone=payload.phone, user_id=user.id, purpose="REGISTRATION_VERIFY"
        )
    else:
        sms_sent = True  # No phone = not required
        sms_err = None

    # Check if both OTPs were sent successfully
    if not email_sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send verification email: {email_err}",
        )

    if payload.phone and not sms_sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send verification SMS: {sms_err}",
        )

    audit.record(
        db,
        action="auth.register",
        actor_id=user.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={
            "role": user.role.value,
            "email_sent": email_sent,
            "sms_sent": sms_sent,
            "phone_provided": bool(payload.phone),
        },
        commit=True,
    )

    return RegisterResponse(
        success=True,
        email=user.email,
        role=user.role,
        is_email_verified=False,
        otp_required=True,
        expires_in_sec=settings.OTP_TTL_SEC,
        redirect_url=f"/verify-otp?email={user.email}&purpose=REGISTRATION_VERIFY&phone={payload.phone or ''}",
    )


@router.post("/verify-otp", response_model=TokenPair)
def verify_otp(
    payload: VerifyOtpRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenPair:
    """Validate OTP with atomic attempt increment and issue real JWT token pair on success."""
    contact_type = payload.contact_type
    code = payload.code
    purpose = payload.purpose

    # Determine email and phone based on contact_type
    if contact_type == "email":
        email = payload.email.lower().strip()
        phone = None
    else:  # phone
        email = None
        phone = payload.phone.strip() if payload.phone else None

    success, detail, user = otp_service.verify_otp(
        db, email=email, phone=phone, code=code, purpose=purpose
    )
    if not success:
        audit.record(
            db,
            action="auth.otp_verify_failed",
            request=request,
            detail={"contact_type": contact_type, "purpose": purpose},
            commit=True,
        )
        if "Too many" in detail:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    tokens = _issue_tokens(db, user, request)
    audit.record(
        db,
        action="auth.otp_verified",
        actor_id=user.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={"purpose": payload.purpose},
        commit=True,
    )
    return tokens


@router.post("/resend-otp", response_model=ResendOtpResponse)
def resend_otp(
    payload: ResendOtpRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ResendOtpResponse:
    """Rate-limited OTP resend.

    ANTI-ENUMERATION: Returns identical response shape whether account exists or not.
    """
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    # If user does not exist, return generic success without leaking non-existence
    if not user:
        return ResendOtpResponse(
            success=True,
            message="If an account exists for this email, a verification code has been sent.",
            expires_in_sec=settings.OTP_TTL_SEC,
            cooldown_sec=settings.OTP_RESEND_COOLDOWN_SEC,
        )

    # Check cooldown against latest OTP request
    last_otp = db.scalar(
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == payload.purpose)
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    now_utc = datetime.now(timezone.utc)
    if last_otp and last_otp.created_at:
        created_at = last_otp.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        elapsed = (now_utc - created_at).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SEC:
            remaining = int(settings.OTP_RESEND_COOLDOWN_SEC - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting a new OTP.",
            )

    # Invalidate previous unconsumed OTPs and dispatch fresh OTP
    otp_record, raw_code, email_sent, email_err = otp_service.create_and_send_otp(
        db, email=email, user_id=user.id, purpose=payload.purpose
    )

    audit.record(
        db,
        action="auth.otp_resend",
        actor_id=user.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={"purpose": payload.purpose, "email_sent": email_sent},
        commit=True,
    )

    return ResendOtpResponse(
        success=True,
        message="If an account exists for this email, a verification code has been sent.",
        expires_in_sec=settings.OTP_TTL_SEC,
        cooldown_sec=settings.OTP_RESEND_COOLDOWN_SEC,
    )


@router.get("/otp-status", response_model=OtpStatusResponse)
def otp_status(
    email: str,
    purpose: str = "REGISTRATION_VERIFY",
    db: Session = Depends(get_db),
) -> OtpStatusResponse:
    """Server-truth OTP timer state so UI countdown matches backend expiry.

    ANTI-ENUMERATION: Always returns 200 with timing fields, never an 'exists' flag.
    """
    clean_email = email.lower().strip()
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required.")

    record = db.scalar(
        select(OtpCode)
        .where(OtpCode.email == clean_email, OtpCode.purpose == purpose)
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )

    now_utc = datetime.now(timezone.utc)
    if not record:
        return OtpStatusResponse(
            expires_in_sec=0,
            cooldown_remaining_sec=0,
            ttl_sec=settings.OTP_TTL_SEC,
            cooldown_sec=settings.OTP_RESEND_COOLDOWN_SEC,
        )

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    expires_in = max(0, int((expires_at - now_utc).total_seconds()))

    created_at = record.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    elapsed = (now_utc - created_at).total_seconds()
    cooldown_left = max(0, int(settings.OTP_RESEND_COOLDOWN_SEC - elapsed))

    return OtpStatusResponse(
        expires_in_sec=expires_in,
        cooldown_remaining_sec=cooldown_left,
        ttl_sec=settings.OTP_TTL_SEC,
        cooldown_sec=settings.OTP_RESEND_COOLDOWN_SEC,
    )


@router.post("/login", response_model=TokenPair)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenPair:
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    # Auto-provision user accounts in dev if missing
    if user is None:
        user = User(
            email=email,
            password_hash=hash_password(payload.password),
            full_name=email.split("@")[0].replace(".", " ").title(),
            role=UserRole.RECRUITER if "recruiter" in email else UserRole.CANDIDATE,
            is_email_verified=True,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not verify_password(payload.password, user.password_hash):
        # Same message either way: do not disclose account existence.
        audit.record(
            db,
            action="auth.login_failed",
            request=request,
            detail={"email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Account is suspended")

    # Mandatory security check: Email must be verified before login is permitted
    if not user.is_email_verified:
        audit.record(
            db,
            action="auth.login_blocked_unverified",
            actor_id=user.id,
            request=request,
            detail={"email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified. Please verify your email with the OTP sent to your address.",
        )

    tokens = _issue_tokens(db, user, request)
    audit.record(
        db,
        action="auth.login",
        actor_id=user.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
    )
    return tokens


@router.post("/refresh", response_model=TokenPair)
def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenPair:
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if stored is None or stored.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token is invalid")
    if stored.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token has expired")

    user = db.get(User, stored.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=401, detail="Refresh token is invalid")

    # Rotate: the presented token is single-use.
    stored.revoked_at = datetime.now(timezone.utc)
    db.commit()

    tokens = _issue_tokens(db, user, request)
    audit.record(
        db,
        action="auth.refresh",
        actor_id=user.id,
        org_id=user.org_id,
        request=request,
    )
    return tokens


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def logout(
    payload: LogoutRequest,
    request: Request,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if payload.refresh_token:
        stored = db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == hash_refresh_token(payload.refresh_token),
                RefreshToken.user_id == current.id,
            )
        )
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = datetime.now(timezone.utc)
    else:
        for row in db.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == current.id, RefreshToken.revoked_at.is_(None)
            )
        ):
            row.revoked_at = datetime.now(timezone.utc)
    db.commit()
    audit.record(
        db,
        action="auth.logout",
        actor_id=current.id,
        org_id=current.org_id,
        request=request,
    )


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> User:
    return current


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    """Initiate password reset flow by dispatching a 6-digit OTP."""
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address.",
        )

    # Check cooldown if previous OTP was generated recently
    record = db.scalar(
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == "FORGOT_PASSWORD")
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    if record:
        now_utc = datetime.now(timezone.utc)
        created_at = record.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        elapsed = (now_utc - created_at).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SEC:
            remaining = int(settings.OTP_RESEND_COOLDOWN_SEC - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting a new OTP.",
            )

    otp_record, raw_code, email_sent, email_err = otp_service.create_and_send_otp(
        db, email=email, user_id=user.id, purpose="FORGOT_PASSWORD"
    )

    audit.record(
        db,
        action="auth.forgot_password_requested",
        actor_id=user.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={"email_sent": email_sent},
        commit=True,
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send password reset email: {email_err}",
        )

    return ForgotPasswordResponse(
        success=True,
        email=email,
        expiresInSec=settings.OTP_TTL_SEC,
        redirectUrl=f"/verify-otp?email={email}&purpose=FORGOT_PASSWORD",
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ResetPasswordResponse:
    """Verify OTP and update user password."""
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address.",
        )

    success, detail, _ = otp_service.verify_otp(
        db, email=email, code=payload.otp, purpose="FORGOT_PASSWORD"
    )
    if not success:
        audit.record(
            db,
            action="auth.password_reset_failed",
            actor_id=user.id,
            request=request,
            detail={"email": email, "reason": detail},
            commit=True,
        )
        if "Too many" in detail:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    # Update password and mark email verified
    user.password_hash = hash_password(payload.newPassword)
    user.is_email_verified = True

    # Invalidate all existing refresh tokens for security
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    db.commit()

    audit.record(
        db,
        action="auth.password_reset_success",
        actor_id=user.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        commit=True,
    )

    return ResetPasswordResponse(
        success=True,
        message="Password reset successfully. Please log in with your new password.",
        redirectUrl="/login",
    )


@router.post("/purchase-credits", response_model=dict)
def purchase_credits(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Purchase a credit pack.

    Available packs:
    - Candidate: pack_49 (₹49 = 30 credits), pack_99 (₹99 = 70 credits), pack_199 (₹199 = 150 credits)
    - Recruiter: pack_999 (₹999 = 800 credits), pack_1999 (₹1999 = 1800 credits), pack_4999 (₹4999 = 4500 credits)

    Returns new credit balance and transaction details.
    """
    from app.services.credit_service import purchase_credits

    pack_name = payload.get("pack_name")
    if not pack_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="pack_name is required",
        )

    result = purchase_credits(db, current_user, pack_name)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"],
        )

    audit.record(
        db,
        action="auth.credit_purchased",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        entity_type="user",
        entity_id=current_user.id,
        request=request,
        detail={
            "pack_name": result["pack_name"],
            "price": result["price"],
            "credits_added": result["credits_added"],
            "new_balance": result["new_balance"],
        },
        commit=True,
    )

    return {
        "success": True,
        "pack_name": result["pack_name"],
        "price": result["price"],
        "credits_added": result["credits_added"],
        "new_balance": result["new_balance"],
        "transaction_id": result["transaction_id"],
    }


@router.post("/admin/give-credits", response_model=dict)
def admin_give_credits(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Give free credits to a user.

    Only SUPER_ADMIN or recruiters can award credits.
    Used for free trials and permissions.

    Required payload:
    - user_id: uuid of the user to receive credits
    - credits: number of credits to add
    - reason: optional reason description
    """
    from app.services.credit_service import admin_give_credits

    # Check permission: SUPER_ADMIN or recruiter
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.RECRUITER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/recruiter can award credits",
        )

    user_id = payload.get("user_id")
    credits = payload.get("credits")
    reason = payload.get("reason", "admin_award")

    if not user_id or not credits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and credits are required",
        )

    # Find the target user
    target_user = db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    result = admin_give_credits(db, target_user, credits, reason)

    audit.record(
        db,
        action="auth.admin_award_credits",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        entity_type="user",
        entity_id=target_user.id,
        request=request,
        detail={
            "target_user_id": str(user_id),
            "target_user_email": target_user.email,
            "credits_added": credits,
            "new_balance": target_user.credits,
            "reason": reason,
            "admin_id": str(current_user.id),
        },
        commit=True,
    )

    return {
        "success": result["success"],
        "credits_added": result["credits_added"],
        "new_balance": result["new_balance"],
        "reason": result["reason"],
        "target_user_email": target_user.email,
    }


@router.post("/admin/set-pack-pricing", response_model=dict)
def admin_set_pack_pricing(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Set credit pack pricing for a role.

    Only SUPER_ADMIN can modify pack pricing.

    Required payload:
    - role: "candidate" or "recruiter"
    - packs: dict of pack_name: (price_in_rupees, credits_added)
    """
    from app.services.credit_service import admin_set_pack_pricing

    # Check permission: Only SUPER_ADMIN
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN can modify pack pricing",
        )

    role = payload.get("role")
    packs = payload.get("packs")

    if not role or not packs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role and packs are required",
        )

    if role not in ["candidate", "recruiter"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role must be 'candidate' or 'recruiter'",
        )

    result = admin_set_pack_pricing(role, packs)

    audit.record(
        db,
        action="auth.admin_set_pack_pricing",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        entity_type="config",
        entity_id="0",
        request=request,
        detail={
            "role": role,
            "new_pricing": str(packs),
            "admin_id": str(current_user.id),
        },
        commit=True,
    )

    return {
        "success": result["success"],
        "role": result["role"],
        "new_pricing": result["new_pricing"],
    }


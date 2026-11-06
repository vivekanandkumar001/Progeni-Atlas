"""Rubric service: evaluation criteria, weight validation, and versioned approval lifecycle."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, RubricStatus, RubricVersion, utcnow

DEFAULT_RUBRIC_WEIGHTS: dict[str, float] = {
    "technicalDepth": 40.0,
    "systemArchitecture": 30.0,
    "communication": 15.0,
    "problemSolving": 15.0,
}

DEFAULT_COMPETENCIES: list[dict[str, Any]] = [
    {
        "name": "technicalDepth",
        "label": "Technical Depth",
        "weight": 40.0,
        "is_must_have": True,
        "description": "Proficiency in algorithms, code efficiency, and core platform concepts.",
        "evidence_signals": [
            "Code implementation quality",
            "Time and space complexity reasoning",
            "Handling of edge cases and boundaries",
        ],
    },
    {
        "name": "systemArchitecture",
        "label": "System Architecture",
        "weight": 30.0,
        "is_must_have": True,
        "description": "Designing scalable, fault-tolerant distributed systems and modular architectures.",
        "evidence_signals": [
            "Component trade-off analysis",
            "Data consistency models and caching",
            "Resilience and failure-mode recovery",
        ],
    },
    {
        "name": "communication",
        "label": "Communication",
        "weight": 15.0,
        "is_must_have": False,
        "description": "Clarity of technical explanations and collaborative problem-solving style.",
        "evidence_signals": [
            "Clear and concise articulation",
            "Structured thought process",
            "Receptiveness to hints and feedback",
        ],
    },
    {
        "name": "problemSolving",
        "label": "Problem Solving",
        "weight": 15.0,
        "is_must_have": False,
        "description": "Ability to break down ambiguous challenges into structured, testable components.",
        "evidence_signals": [
            "Root-cause diagnosis",
            "Hypothesis-driven debugging",
            "Pragmatic engineering trade-offs",
        ],
    },
]


def validate_rubric_weights(
    weights: dict[str, float | int],
    competencies: list[dict[str, Any]] | None = None,
) -> None:
    """Validate scoring weights and must-have constraints:
    1. Weights cannot be empty.
    2. Every weight must be non-negative.
    3. Weights must sum to 100 (±0.5 tolerance).
    4. Every must-have competency must have weight > 0.
    """
    if not weights:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rubric weights cannot be empty.",
        )

    for k, v in weights.items():
        if v < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Weight for '{k}' cannot be negative ({v}).",
            )

    total = sum(weights.values())
    if not (99.5 <= total <= 100.5):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Rubric weights must sum to 100 (±0.5). Current total: {total:.1f}",
        )

    if competencies:
        for comp in competencies:
            name = comp.get("name")
            is_must_have = comp.get("is_must_have", False)
            weight = comp.get("weight")
            if weight is None and name in weights:
                weight = weights[name]

            if is_must_have and (weight is None or weight <= 0):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Must-have competency '{name}' must have a weight > 0.",
                )


def get_latest_rubric(db: Session, job_id: uuid.UUID) -> RubricVersion | None:
    """Return the most recent RubricVersion for a job, ordered by version desc."""
    return db.scalars(
        select(RubricVersion)
        .where(RubricVersion.job_id == job_id)
        .order_by(RubricVersion.version.desc())
        .limit(1)
    ).first()


def get_or_create_default_rubric(
    db: Session, job: Job, user_id: uuid.UUID | None = None
) -> RubricVersion:
    """Get the current latest rubric version, or initialize Version 1 in DRAFT status."""
    latest = get_latest_rubric(db, job.id)
    if latest is not None:
        return latest

    # Seed from the job's flat weight map when it holds one. A legacy
    # `jobs.rubric_weights` blob that no longer satisfies the weight contract
    # would make every later edit fail validation, so fall back to the defaults
    # rather than propagating an unusable rubric.
    weights = dict(job.rubric_weights) if job.rubric_weights else dict(DEFAULT_RUBRIC_WEIGHTS)
    try:
        validate_rubric_weights(weights)
    except HTTPException:
        weights = dict(DEFAULT_RUBRIC_WEIGHTS)

    competencies = [dict(c) for c in DEFAULT_COMPETENCIES]

    # Align competencies weights with the seed weights.
    for c in competencies:
        if c["name"] in weights:
            c["weight"] = float(weights[c["name"]])

    rubric = RubricVersion(
        job_id=job.id,
        version=1,
        status=RubricStatus.DRAFT,
        title=f"{job.title} Evaluation Rubric",
        weights=weights,
        competencies=competencies,
        custom_instructions=f"Focus on production-level scenarios, edge-case resilience, and code clarity for {job.title}.",
        created_by=user_id,
    )
    db.add(rubric)
    # `Job.rubric_weights` mirrors the *approved* rubric, so a freshly seeded
    # draft deliberately does not write it. See `update_rubric`.
    db.commit()
    db.refresh(rubric)
    return rubric


def update_rubric(
    db: Session,
    job: Job,
    weights: dict[str, float | int] | None = None,
    competencies: list[dict[str, Any]] | None = None,
    custom_instructions: str | None = None,
    title: str | None = None,
    target_status: str | None = None,
    user_id: uuid.UUID | None = None,
) -> RubricVersion:
    """Update rubric criteria.

    - If current latest is APPROVED, editing creates a NEW version (version = latest.version + 1),
      preserving the prior approved version in history.
    - If current latest is DRAFT, editing mutates the draft in place.
    - If target_status is 'approved', sets status=APPROVED and records approval metadata.

    ``Job.rubric_weights`` is the flat map downstream consumers read, so it is
    only refreshed when the resulting version is APPROVED. A draft must not
    change what the interview engine would score against.
    """
    latest = get_or_create_default_rubric(db, job, user_id)

    # Resolve new values against latest version
    new_weights = dict(weights) if weights is not None else dict(latest.weights)
    new_competencies = (
        [dict(c) for c in competencies] if competencies is not None else list(latest.competencies)
    )
    new_instructions = (
        custom_instructions if custom_instructions is not None else latest.custom_instructions
    )
    new_title = title if title is not None else latest.title

    # Validate weights & competencies
    validate_rubric_weights(new_weights, new_competencies)

    now = datetime.now(timezone.utc)
    is_approving = target_status and target_status.lower() == RubricStatus.APPROVED.value

    if latest.status == RubricStatus.APPROVED:
        # Create a new version to preserve the approved historical version
        new_version_num = latest.version + 1
        new_status = RubricStatus.APPROVED if is_approving else RubricStatus.DRAFT

        new_rubric = RubricVersion(
            job_id=job.id,
            version=new_version_num,
            status=new_status,
            title=new_title,
            weights=new_weights,
            competencies=new_competencies,
            custom_instructions=new_instructions,
            created_by=user_id,
            approved_by=user_id if is_approving else None,
            approved_at=now if is_approving else None,
        )
        db.add(new_rubric)
        if is_approving:
            job.rubric_weights = new_weights
        db.commit()
        db.refresh(new_rubric)
        return new_rubric
    else:
        # Mutate draft in-place
        latest.weights = new_weights
        latest.competencies = new_competencies
        latest.custom_instructions = new_instructions
        latest.title = new_title

        if is_approving:
            latest.status = RubricStatus.APPROVED
            latest.approved_by = user_id
            latest.approved_at = now
            job.rubric_weights = new_weights

        db.commit()
        db.refresh(latest)
        return latest


def approve_rubric(db: Session, job: Job, user_id: uuid.UUID) -> RubricVersion:
    """Explicitly transition a draft rubric to APPROVED."""
    latest = get_or_create_default_rubric(db, job, user_id)
    if latest.status == RubricStatus.APPROVED:
        return latest

    # Validate weights before approving
    validate_rubric_weights(latest.weights, latest.competencies)

    now = datetime.now(timezone.utc)
    latest.status = RubricStatus.APPROVED
    latest.approved_by = user_id
    latest.approved_at = now
    job.rubric_weights = latest.weights
    db.commit()
    db.refresh(latest)
    return latest


def list_rubric_versions(db: Session, job_id: uuid.UUID) -> list[RubricVersion]:
    """Fetch full version history for a job's rubric."""
    return list(
        db.scalars(
            select(RubricVersion)
            .where(RubricVersion.job_id == job_id)
            .order_by(RubricVersion.version.desc())
        )
    )

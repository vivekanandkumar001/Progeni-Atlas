"""Persist per-question timing while preserving active interviews.

Revision ID: 0032_persist_interview_deadlines
Revises: 0013_interview_lifecycle_state
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision = "0032_persist_interview_deadlines"
down_revision: Union[str, None] = "0013_interview_lifecycle_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None


def upgrade() -> None:
    # Add nullable first so active sessions remain opted out. Only sessions not
    # yet started at rollout receive the new 120-second question limit.
    op.add_column(
        "interview_sessions",
        sa.Column("question_time_limit_seconds", sa.Integer(), nullable=True),
    )
    op.execute(
        "UPDATE interview_sessions SET question_time_limit_seconds = 120 "
        "WHERE started_at IS NULL"
    )
    op.alter_column(
        "interview_sessions",
        "question_time_limit_seconds",
        server_default=sa.text("120"),
    )

    op.add_column(
        "interview_questions",
        sa.Column("question_deadline_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "interview_questions",
        sa.Column("timed_out_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "interview_responses",
        sa.Column(
            "is_timeout_result",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("interview_responses", "is_timeout_result")
    op.drop_column("interview_questions", "timed_out_at")
    op.drop_column("interview_questions", "question_deadline_at")
    op.drop_column("interview_sessions", "question_time_limit_seconds")

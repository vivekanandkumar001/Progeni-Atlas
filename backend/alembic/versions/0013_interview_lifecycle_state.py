"""Add the explicit interview lifecycle state and its audit trail.

The interview lifecycle was previously implicit in the coarse ``status``
column, which cannot represent the pre-flight, turn and closing phases
separately and cannot be advanced safely under concurrency.

This migration adds:
  * ``interview_sessions.mode``            - real / practice / demo
  * ``interview_sessions.lifecycle_state``  - authoritative lifecycle state
  * ``interview_sessions.state_version``    - monotonic transition counter
  * ``interview_session_transitions``       - append-only transition audit trail

Revision ID: 0013_interview_lifecycle_state
Revises: 0012_notifications_type
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_interview_lifecycle_state"
down_revision: Union[str, None] = "0012_notifications_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "interview_sessions",
        sa.Column("mode", sa.String(length=20), nullable=True, server_default="real"),
    )
    op.create_index("ix_interview_sessions_mode", "interview_sessions", ["mode"])

    # NULL means "pre-lifecycle row". Existing sessions keep working: the
    # lifecycle resolves them conservatively from the legacy status column.
    op.add_column(
        "interview_sessions",
        sa.Column("lifecycle_state", sa.String(length=40), nullable=True),
    )
    op.create_index("ix_interview_sessions_lifecycle_state", "interview_sessions", ["lifecycle_state"])

    op.add_column(
        "interview_sessions",
        sa.Column(
            "state_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    op.create_table(
        "interview_session_transitions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("from_state", sa.String(length=40), nullable=False),
        sa.Column("to_state", sa.String(length=40), nullable=False),
        sa.Column("actor_type", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "metadata_json",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "transitioned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["interview_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_session_transitions_session_time",
        "interview_session_transitions",
        ["session_id", "transitioned_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_session_transitions_session_time", table_name="interview_session_transitions")
    op.drop_table("interview_session_transitions")
    op.drop_column("interview_sessions", "state_version")
    op.drop_index("ix_interview_sessions_lifecycle_state", table_name="interview_sessions")
    op.drop_column("interview_sessions", "lifecycle_state")
    op.drop_index("ix_interview_sessions_mode", table_name="interview_sessions")
    op.drop_column("interview_sessions", "mode")

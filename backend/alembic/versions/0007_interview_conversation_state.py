"""0007_interview_conversation_state

Revision ID: 0007_interview_conversation_state
Revises: None
Create Date: 2026-09-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0007_interview_conversation_state'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing revision already applied in Neon DB
    pass


def downgrade() -> None:
    pass

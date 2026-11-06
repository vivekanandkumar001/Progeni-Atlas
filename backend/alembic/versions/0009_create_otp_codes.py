"""0009_create_otp_codes

Revision ID: 0009_create_otp_codes
Revises: 0008_align_staging_schema
Create Date: 2026-09-29 11:58:00.000000

Creates the otp_codes table for secure, HMAC-peppered OTP authentication in FastAPI.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0009_create_otp_codes'
down_revision: Union[str, None] = '0008_align_staging_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_public_id VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS years_experience FLOAT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS headline VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(160);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    """)
    op.create_table(
        'otp_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('code_hash', sa.String(255), nullable=False),
        sa.Column('purpose', sa.String(50), nullable=False, server_default='REGISTRATION_VERIFY'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_otp_codes_email', 'otp_codes', ['email'])
    op.create_index('ix_otp_codes_user_id', 'otp_codes', ['user_id'])
    op.create_index('ix_otp_codes_lookup', 'otp_codes', ['email', 'purpose', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_otp_codes_lookup', table_name='otp_codes')
    op.drop_index('ix_otp_codes_user_id', table_name='otp_codes')
    op.drop_index('ix_otp_codes_email', table_name='otp_codes')
    op.drop_table('otp_codes')

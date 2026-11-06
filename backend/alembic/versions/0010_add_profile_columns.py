"""0010_add_profile_columns

Revision ID: 0010_add_profile_columns
Revises: 0009_create_otp_codes
Create Date: 2026-09-29 13:10:00.000000

Brings the ``users`` profile columns back under Alembic control.

Background
----------
During a development session these five columns were added to the live Neon
``users`` table with raw ``ALTER TABLE`` statements executed outside of
Alembic, which left the DDL unreproducible on a fresh database. This migration
formally owns that DDL.

Every statement is ``IF NOT EXISTS`` / ``IF EXISTS`` guarded, so the migration
is a safe no-op against the already-altered Neon database while still
reproducing the exact state from scratch on any new database.

The post-upgrade assertion is the important part: ``IF NOT EXISTS`` silently
skips a column that already exists with the WRONG type. Rather than recording
that drift as "done", the migration inspects ``information_schema`` and raises
so the mismatch has to be resolved by a human.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_add_profile_columns"
down_revision: Union[str, None] = "0009_create_otp_codes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (column_name, DDL type, information_schema.data_type, character_maximum_length)
PROFILE_COLUMNS = (
    ("avatar_public_id", "VARCHAR(255)", "character varying", 255),
    ("years_experience", "FLOAT", "double precision", None),
    ("headline", "VARCHAR(255)", "character varying", 255),
    ("location", "VARCHAR(160)", "character varying", 160),
    ("updated_at", "TIMESTAMPTZ DEFAULT now()", "timestamp with time zone", None),
)


def upgrade() -> None:
    for name, ddl_type, _, _ in PROFILE_COLUMNS:
        op.execute(
            sa.text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {name} {ddl_type}")
        )

    _assert_columns_match()


def downgrade() -> None:
    for name, _, _, _ in reversed(PROFILE_COLUMNS):
        op.execute(sa.text(f"ALTER TABLE users DROP COLUMN IF EXISTS {name}"))


def _assert_columns_match() -> None:
    """Fail loudly if any column exists but with a different type than declared.

    Guards against the silent-drift trap of ``ADD COLUMN IF NOT EXISTS``.
    Skipped in offline (--sql) mode, where there is no live connection to inspect.
    """
    from alembic import context

    if context.is_offline_mode():
        return

    conn = op.get_bind()
    expected = {
        name: (data_type, max_length) for name, _, data_type, max_length in PROFILE_COLUMNS
    }
    rows = conn.execute(
        sa.text(
            """
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'users'
              AND column_name = ANY(:names)
            """
        ),
        {"names": list(expected)},
    ).fetchall()

    actual = {r[0]: (r[1], r[2]) for r in rows}
    problems = []
    for name, want in expected.items():
        if name not in actual:
            problems.append(f"{name}: MISSING after migration")
        elif actual[name] != want:
            problems.append(f"{name}: expected {want}, found {actual[name]}")
    if problems:
        raise RuntimeError(
            "Migration 0010 could not converge the users profile columns: "
            + "; ".join(problems)
        )

"""0011_rubric_versions

Revision ID: 0011_rubric_versions
Revises: 0010_add_profile_columns
Create Date: 2026-09-29 16:40:00.000000

Brings the rubric model under Alembic control.

Background
----------
``app.models`` has declared ``RubricVersion`` (and ``Job.rubric_weights``) since
the evaluation-blueprint work, but no migration ever created the table. The
recruiter rubric API therefore had nothing to read from or write to, and
``jobs.rubric_weights`` was missing from the live schema entirely even though
``JobOut`` exposes it.

``jobs.rubric_weights`` alone is not enough to carry a rubric: competency
descriptions and evidence signals do not fit a flat weight map, and the
draft -> approved lifecycle needs somewhere to keep superseded versions. So
this migration creates the proper ``rubric_versions`` table rather than
widening the JSONB column.

Every statement is ``IF NOT EXISTS`` guarded, so the migration is a safe no-op
against a database that was created with ``Base.metadata.create_all()`` while
still reproducing the exact state from scratch on a new database.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_rubric_versions"
down_revision: Union[str, None] = "0010_add_profile_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rubric_status') THEN
                    CREATE TYPE rubric_status AS ENUM ('draft', 'approved', 'archived');
                END IF;
            END $$;
            """
        )
    )

    # Flat weight map kept on the job for cheap reads / job listings.
    op.execute(sa.text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rubric_weights JSONB"))

    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS rubric_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                version INT NOT NULL DEFAULT 1,
                status rubric_status NOT NULL DEFAULT 'draft',
                title VARCHAR(255) NOT NULL DEFAULT '',
                weights JSONB NOT NULL DEFAULT '{}'::jsonb,
                competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
                custom_instructions TEXT,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
                approved_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_job_rubric_version UNIQUE (job_id, version)
            );
            """
        )
    )

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_rubric_versions_job_id ON rubric_versions(job_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_rubric_versions_status ON rubric_versions(status)"))
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_rubric_versions_job_status "
            "ON rubric_versions(job_id, status)"
        )
    )

    _assert_schema_converged()


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS rubric_versions"))
    op.execute(sa.text("ALTER TABLE jobs DROP COLUMN IF EXISTS rubric_weights"))
    op.execute(sa.text("DROP TYPE IF EXISTS rubric_status"))


# (table, column, information_schema.data_type)
EXPECTED = (
    ("jobs", "rubric_weights", "jsonb"),
    ("rubric_versions", "job_id", "uuid"),
    ("rubric_versions", "version", "integer"),
    ("rubric_versions", "status", "USER-DEFINED"),
    ("rubric_versions", "title", "character varying"),
    ("rubric_versions", "weights", "jsonb"),
    ("rubric_versions", "competencies", "jsonb"),
    ("rubric_versions", "approved_at", "timestamp with time zone"),
)


def _assert_schema_converged() -> None:
    """Fail loudly if a column exists but with a different type than declared.

    ``CREATE TABLE IF NOT EXISTS`` silently accepts a pre-existing table with
    the wrong shape, which would let the ORM drift away from the database.
    Skipped in offline (--sql) mode, where there is no live connection.
    """
    from alembic import context

    if context.is_offline_mode():
        return

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = ANY(:tables)
            """
        ),
        {"tables": sorted({t for t, _, _ in EXPECTED})},
    ).fetchall()

    actual = {(r[0], r[1]): r[2] for r in rows}
    problems = []
    for table, column, data_type in EXPECTED:
        found = actual.get((table, column))
        if found is None:
            problems.append(f"{table}.{column}: MISSING after migration")
        elif found != data_type:
            problems.append(f"{table}.{column}: expected {data_type}, found {found}")
    if problems:
        raise RuntimeError(
            "Migration 0011 could not converge the rubric schema: " + "; ".join(problems)
        )

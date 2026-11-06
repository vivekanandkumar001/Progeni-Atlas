"""0012_notifications_type

Revision ID: 0012_notifications_type
Revises: 0011_rubric_versions
Create Date: 2026-09-29 19:05:00.000000

Aligns the live ``notifications`` table with the ``app.models.Notification`` model.

Background
----------
``app.models.Notification`` has always declared ``notification_type``, ``body``,
``payload`` and ``read_at``, but **no migration ever created or altered the
``notifications`` table**. Migration 0008 created the ``notification_type``
ENUM *type* yet never added the *column*, so the table survived on Neon with a
legacy shape::

    id, user_id, type VARCHAR(50), title, message TEXT, link, is_read,
    created_at, updated_at

Every write to a notification therefore failed with::

    psycopg2.errors.UndefinedColumn:
        column "notification_type" of relation "notifications" does not exist

which surfaced as a 500 on ``POST /api/candidate/resume`` after resume parsing,
embedding and Qdrant indexing had all already succeeded.

A second, hidden mismatch is fixed here too: ``NotificationType`` is declared
without ``values_callable``, so SQLAlchemy persists the enum **member names**
(``RESUME_PARSED``), while 0008 created the PostgreSQL labels in lower case
(``resume_parsed``). Simply adding the column would trade ``UndefinedColumn``
for ``invalid input value for enum notification_type``. The enum labels are
renamed to match the model. The type is orphaned (no column referenced it), so
this rename touches no stored data.

Approach
--------
Additive and idempotent wherever possible, and **lossless**:

* ``type``      -> renamed to ``notification_type`` and retyped to the enum, so
                   any legacy rows are preserved rather than dropped.
* ``message``   -> renamed to ``body`` and made nullable, matching the model.
* ``payload`` / ``read_at`` -> added with the model's defaults.
* ``id`` / ``title`` already match the model and are left untouched.

The legacy nullable ``link`` column is intentionally left in place; the ORM
never writes it and removing it is out of scope.

The post-upgrade assertion guards the ``ADD COLUMN IF NOT EXISTS`` silent-drift
trap in the same spirit as 0010: it re-reads ``information_schema`` and raises
rather than recording a partial fix as "done".

No application behaviour is changed and no notification rows are deleted.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_notifications_type"
down_revision: Union[str, None] = "0011_rubric_versions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (column_name, information_schema.data_type, character_maximum_length)
# ``notification_type`` is a USER-DEFINED enum, so its ``udt_name`` is asserted
# separately by ``_assert_columns_match``.
REQUIRED_COLUMNS = (
    ("id", "uuid", None),
    ("user_id", "uuid", None),
    ("notification_type", "USER-DEFINED", None),
    ("title", "character varying", 255),
    ("body", "text", None),
    ("payload", "jsonb", None),
    ("is_read", "boolean", None),
    ("read_at", "timestamp with time zone", None),
    ("created_at", "timestamp with time zone", None),
    ("updated_at", "timestamp with time zone", None),
)

REQUIRED_INDEX = "ix_notifications_user_read"

# 0008 created these labels in lower case; the model persists the upper-case
# member names. Ordered so each RENAME VALUE sees an unambiguous state.
ENUM_LABEL_CASING = (
    ("interview_invited", "INTERVIEW_INVITED"),
    ("interview_rescheduled", "INTERVIEW_RESCHEDULED"),
    ("interview_reminder", "INTERVIEW_REMINDER"),
    ("interview_completed", "INTERVIEW_COMPLETED"),
    ("scorecard_ready", "SCORECARD_READY"),
    ("resume_parsed", "RESUME_PARSED"),
    ("resume_failed", "RESUME_FAILED"),
    ("system", "SYSTEM"),
)


def upgrade() -> None:
    # ------------------------------------------------- 1. enum type exists
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'notification_type'
                ) THEN
                    CREATE TYPE notification_type AS ENUM (
                        'INTERVIEW_INVITED', 'INTERVIEW_RESCHEDULED',
                        'INTERVIEW_REMINDER', 'INTERVIEW_COMPLETED',
                        'SCORECARD_READY', 'RESUME_PARSED', 'RESUME_FAILED',
                        'SYSTEM'
                    );
                END IF;
            END $$;
            """
        )
    )

    # ------------------------- 2. table exists with the model's exact shape
    # Only fires on a database that never had the legacy table.
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                notification_type notification_type NOT NULL,
                title VARCHAR(255) NOT NULL,
                body TEXT,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                read_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
    )

    # ------------- 3. enum labels must be the upper-case member names
    op.execute(
        sa.text(
            """
            DO $$
            DECLARE
                old_label TEXT;
                new_label TEXT;
                has_old BOOLEAN;
                has_new BOOLEAN;
            BEGIN
                FOR old_label, new_label IN
                    SELECT * FROM (VALUES
                        ('interview_invited',     'INTERVIEW_INVITED'),
                        ('interview_rescheduled', 'INTERVIEW_RESCHEDULED'),
                        ('interview_reminder',    'INTERVIEW_REMINDER'),
                        ('interview_completed',   'INTERVIEW_COMPLETED'),
                        ('scorecard_ready',       'SCORECARD_READY'),
                        ('resume_parsed',         'RESUME_PARSED'),
                        ('resume_failed',         'RESUME_FAILED'),
                        ('system',                'SYSTEM')
                    ) AS labels(old_label, new_label)
                LOOP
                    SELECT EXISTS (
                        SELECT 1 FROM pg_type ty
                        JOIN pg_enum en ON en.enumtypid = ty.oid
                        WHERE ty.typname = 'notification_type'
                          AND en.enumlabel = old_label
                    ) INTO has_old;

                    SELECT EXISTS (
                        SELECT 1 FROM pg_type ty
                        JOIN pg_enum en ON en.enumtypid = ty.oid
                        WHERE ty.typname = 'notification_type'
                          AND en.enumlabel = new_label
                    ) INTO has_new;

                    IF has_old AND NOT has_new THEN
                        EXECUTE format(
                            'ALTER TYPE notification_type RENAME VALUE %L TO %L',
                            old_label, new_label
                        );
                    END IF;
                END LOOP;
            END $$;
            """
        )
    )

    # ------------------ 4. legacy column renames (lossless, data preserved)
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'type'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'notification_type'
                ) THEN
                    ALTER TABLE notifications RENAME COLUMN type TO notification_type;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'message'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'body'
                ) THEN
                    ALTER TABLE notifications RENAME COLUMN message TO body;
                END IF;
            END $$;
            """
        )
    )

    # ------------ 5. retype notification_type VARCHAR -> notification_type enum
    # upper() maps the legacy lower-case convention onto the model's labels. An
    # unrecognised legacy value raises here instead of being silently dropped.
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'notification_type'
                      AND data_type = 'character varying'
                ) THEN
                    ALTER TABLE notifications
                        ALTER COLUMN notification_type TYPE notification_type
                        USING upper(notification_type::text)::notification_type;
                END IF;
            END $$;
            """
        )
    )

    # ------------------------------ 6. missing columns and server defaults
    op.execute(
        sa.text(
            """
            ALTER TABLE notifications
                ALTER COLUMN notification_type SET NOT NULL,
                ALTER COLUMN body DROP NOT NULL;

            ALTER TABLE notifications
                ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

            ALTER TABLE notifications
                ALTER COLUMN is_read SET DEFAULT FALSE,
                ALTER COLUMN created_at SET DEFAULT NOW(),
                ALTER COLUMN updated_at SET DEFAULT NOW();
            """
        )
    )

    # ------------------------------------------- 7. FK and composite index
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'notifications'::regclass
                      AND contype = 'f'
                      AND pg_get_constraintdef(oid) LIKE '%users%'
                ) THEN
                    ALTER TABLE notifications
                        ADD CONSTRAINT notifications_user_id_fkey
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
                END IF;
            END $$;
            """
        )
    )

    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS {REQUIRED_INDEX} "
            "ON notifications (user_id, is_read)"
        )
    )

    _assert_columns_match()


def downgrade() -> None:
    op.execute(sa.text(f"DROP INDEX IF EXISTS {REQUIRED_INDEX}"))
    op.execute(
        sa.text(
            "ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey"
        )
    )
    op.execute(
        sa.text(
            """
            ALTER TABLE notifications
                DROP COLUMN IF EXISTS payload,
                DROP COLUMN IF EXISTS read_at,
                ALTER COLUMN notification_type DROP NOT NULL,
                ALTER COLUMN body SET NOT NULL,
                ALTER COLUMN is_read DROP DEFAULT,
                ALTER COLUMN created_at DROP DEFAULT,
                ALTER COLUMN updated_at DROP DEFAULT;

            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'notification_type'
                ) THEN
                    ALTER TABLE notifications
                        ALTER COLUMN notification_type TYPE VARCHAR(50)
                        USING lower(notification_type::text);
                    ALTER TABLE notifications
                        RENAME COLUMN notification_type TO type;
                    ALTER TABLE notifications ALTER COLUMN type SET NOT NULL;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'notifications'
                      AND column_name = 'body'
                ) THEN
                    ALTER TABLE notifications RENAME COLUMN body TO message;
                END IF;
            END $$;
            """
        )
    )


def _assert_columns_match() -> None:
    """Fail loudly if the table did not converge on the model's shape.

    Guards against the silent-drift trap of ``ADD COLUMN IF NOT EXISTS``: a
    column that already exists with the wrong type must not be recorded as
    "done". Skipped in offline (--sql) mode, where there is no live connection.
    """
    from alembic import context

    if context.is_offline_mode():
        return

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT column_name, data_type, character_maximum_length, udt_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'notifications'
              AND column_name = ANY(:names)
            """
        ),
        {"names": [name for name, _, _ in REQUIRED_COLUMNS]},
    ).fetchall()

    actual = {r[0]: (r[1], r[2], r[3]) for r in rows}
    problems: list[str] = []
    for name, data_type, max_length in REQUIRED_COLUMNS:
        if name not in actual:
            problems.append(f"{name}: MISSING after migration")
            continue
        got_type, got_length, got_udt = actual[name]
        if got_type != data_type:
            problems.append(f"{name}: expected data_type {data_type!r}, found {got_type!r}")
        if max_length is not None and got_length != max_length:
            problems.append(
                f"{name}: expected character_maximum_length {max_length}, found {got_length}"
            )
        if name == "notification_type" and got_udt != "notification_type":
            problems.append(
                f"{name}: expected the notification_type enum, found udt_name {got_udt!r}"
            )

    if problems:
        raise RuntimeError(
            "Migration 0012 could not converge the notifications columns: "
            + "; ".join(problems)
        )

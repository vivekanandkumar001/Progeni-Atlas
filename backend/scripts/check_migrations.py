"""Schema-drift gate. Run this in CI and before any deploy.

    python -m scripts.check_migrations

It enforces the rule that all schema changes go through Alembic migrations:

  1. The migration graph has exactly one head and is a single linear chain
     (no forked/branched history that would silently skip a migration).
  2. The live database's ``alembic_version`` matches that head. A mismatch means
     someone changed the database outside of Alembic, or forgot to migrate.
  3. Every column owned by migration 0010 matches the SQLAlchemy model, so the
     migration and the ORM cannot drift apart.

Exits 0 when clean, 1 on any failure.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

from alembic.config import Config
from alembic.script import ScriptDirectory  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
import app.models  # noqa: E402,F401

# Migration that owns the users profile columns restored in this session.
PROFILE_MIGRATION = "0010_add_profile_columns"
PROFILE_TABLE = "users"

failures: list[str] = []


def check_single_linear_head() -> str:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    if len(heads) != 1:
        failures.append(
            f"Expected exactly 1 migration head, found {len(heads)}: {heads}. "
            "Merge the branches before continuing."
        )
        return "<invalid>"

    revs = list(script.walk_revisions())
    for rev in revs:
        down = rev.down_revision
        if isinstance(down, (list, tuple)):
            failures.append(
                f"Revision {rev.revision} has multiple down_revisions {down}; "
                "history is not linear."
            )
    print(f"  migration chain: {len(revs)} revisions, head={heads[0]}")
    return heads[0]


def check_live_db_at_head(head: str) -> None:
    if not settings.DATABASE_URL:
        failures.append("DATABASE_URL is not configured; cannot verify live schema.")
        return
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        current = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    if current != head:
        failures.append(
            f"Live DB is at '{current}' but the code head is '{head}'. "
            "Run `alembic upgrade head`."
        )
    else:
        print(f"  live alembic_version: {current} (matches head)")


def _model_column_signature(col) -> tuple[str, int | None]:
    """Map an ORM column to (information_schema data_type, max_length).

    This mirrors what Postgres actually stores, so it can be compared against
    the raw types a migration declares via information_schema.
    """
    import sqlalchemy.types as satypes

    t = col.type
    if isinstance(t, satypes.DateTime):
        data_type = "timestamp with time zone" if t.timezone else "timestamp without time zone"
        return data_type, None
    if isinstance(t, satypes.Float):
        # Float maps to DOUBLE PRECISION on PostgreSQL (as_integer is False by default).
        return "double precision", None
    if isinstance(t, satypes.String):
        return "character varying", t.length
    return str(t).lower(), None


def check_profile_columns_match_models() -> None:
    """0010's declared types must equal the ORM's, for both users columns."""
    path = BACKEND_DIR / "alembic" / "versions" / f"{PROFILE_MIGRATION}.py"
    if not path.exists():
        failures.append(f"Migration file for '{PROFILE_MIGRATION}' not found at {path}.")
        return

    module = _load_migration(path)
    model_table = Base.metadata.tables[PROFILE_TABLE]
    for name, _ddl, data_type, max_length in module.PROFILE_COLUMNS:
        if name not in model_table.columns:
            failures.append(
                f"'{name}' is owned by {PROFILE_MIGRATION} but absent from the "
                f"{PROFILE_TABLE} SQLAlchemy model."
            )
            continue
        model_sig = _model_column_signature(model_table.columns[name])
        if model_sig != (data_type, max_length):
            failures.append(
                f"{PROFILE_TABLE}.{name}: migration declares "
                f"({data_type!r}, {max_length!r}) but the model has {model_sig!r}."
            )
    print(
        f"  {PROFILE_MIGRATION}: {len(module.PROFILE_COLUMNS)} columns checked against models"
    )


def _load_migration(path: Path):
    spec = importlib.util.spec_from_file_location(f"tp_migration_{path.stem}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_live_db_has_profile_columns() -> None:
    if not settings.DATABASE_URL:
        return
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        live = {c["name"] for c in inspect(conn).get_columns(PROFILE_TABLE)}
    module = _load_migration(
        BACKEND_DIR / "alembic" / "versions" / f"{PROFILE_MIGRATION}.py"
    )
    for name, *_ in module.PROFILE_COLUMNS:
        if name not in live:
            failures.append(
                f"{PROFILE_TABLE}.{name} is declared in {PROFILE_MIGRATION} "
                "but missing from the live database."
            )
    print(f"  live {PROFILE_TABLE}: {len(module.PROFILE_COLUMNS)} columns present")


def main() -> int:
    print("Schema-drift check")
    print("=" * 60)
    head = check_single_linear_head()
    check_live_db_at_head(head)
    check_profile_columns_match_models()
    check_live_db_has_profile_columns()

    print("=" * 60)
    if failures:
        print("FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("OK: migrations, models, and live database are in sync.")
    print("Reminder: never ALTER the database by hand. Write a migration.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

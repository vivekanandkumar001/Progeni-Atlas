import os
from dotenv import load_dotenv
load_dotenv(".env")
from app.database import engine
from sqlalchemy import text

TABLES = ["interview_sessions", "companion_pairings", "companion_rate_limits", "users", "candidate_resumes", "organizations"]

with engine.connect() as c:
    for t in TABLES:
        print("=" * 70)
        print("TABLE:", t)
        rows = c.execute(text("""
            select column_name, data_type, is_nullable, column_default
            from information_schema.columns
            where table_schema='public' and table_name=:t
            order by ordinal_position
        """), {"t": t}).fetchall()
        for r in rows:
            print(f"  {r[0]:<28} {r[1]:<28} null={r[2]:<4} default={str(r[3])[:40]}")
        cons = c.execute(text("""
            select con.conname, pg_get_constraintdef(con.oid)
            from pg_constraint con
            join pg_class rel on rel.oid = con.conrelid
            join pg_namespace n on n.oid = rel.relnamespace
            where n.nspname='public' and rel.relname=:t
        """), {"t": t}).fetchall()
        for r in cons:
            print(f"  CONSTRAINT {r[0]}: {r[1]}")

    print("=" * 70)
    print("ALEMBIC VERSION TABLE:")
    try:
        v = c.execute(text("select version_num from alembic_version")).fetchall()
        print("  head:", [x[0] for x in v])
    except Exception as e:
        print("  no alembic_version table:", type(e).__name__)

    print("=" * 70)
    print("UPDATING RESUMES:")
    c.execute(text("UPDATE candidate_resumes SET parsed_text = COALESCE(parsed_text, parsed_text_clean), status = 'PARSED' WHERE parsed_text IS NULL AND parsed_text_clean IS NOT NULL"))
    c.commit()
    for r in c.execute(text("select id, candidate_id, file_name, status, is_active, length(parsed_text) from candidate_resumes")).fetchall():
        print("  Resume:", r)


    print("=" * 70)
    print("ORGANIZATIONS:")
    for r in c.execute(text("select id, name, slug from organizations")).fetchall():
        print(" ", r)

    print("=" * 70)
    print("SESSION_TYPE ENUM:")
    for r in c.execute(text("select enumlabel from pg_enum join pg_type on pg_enum.enumtypid = pg_type.oid where pg_type.typname = 'session_type'")).fetchall():
        print(" ", r[0])


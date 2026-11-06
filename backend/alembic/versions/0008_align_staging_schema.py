"""0008_align_staging_schema

Revision ID: 0008_align_staging_schema
Revises: 0007_interview_conversation_state
Create Date: 2026-09-29 10:35:00.000000

Aligns legacy Neon Cloud PostgreSQL tables with current application models:
  - Preserves existing rows in all tables
  - Safely migrates job_profiles -> jobs
  - Safely migrates interview_answers -> interview_responses
  - Updates interview_sessions, interview_questions, scorecards, candidate_resumes
  - Adds missing tables: skills, code_submissions, proctoring_events, candidate_reports,
    competency_scores, refresh_tokens, audit_logs, system_config, companion_pairings,
    companion_rate_limits
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0008_align_staging_schema'
down_revision: Union[str, None] = '0007_interview_conversation_state'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------- 1. Enums
    op.execute("""
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
            CREATE TYPE job_status AS ENUM ('draft', 'open', 'archived');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_state') THEN
            CREATE TYPE agent_state AS ENUM ('CONNECTING', 'READY', 'LIVE', 'PROCESSING', 'COMPLETED', 'ERROR');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'speaker') THEN
            CREATE TYPE speaker AS ENUM ('ai_interviewer', 'candidate');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_decision') THEN
            CREATE TYPE action_decision AS ENUM ('PASS', 'PROBE_FURTHER', 'SWITCH_TOPIC', 'TERMINATE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proctoring_event_type') THEN
            CREATE TYPE proctoring_event_type AS ENUM ('tab_switch', 'visibility_change', 'fullscreen_exit', 'window_blur', 'camera_disabled', 'mic_disabled', 'multiple_faces', 'unauthorized_action', 'copy_paste_attempt', 'network_drop');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
            CREATE TYPE severity AS ENUM ('info', 'warning', 'critical');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
            CREATE TYPE notification_type AS ENUM ('interview_invited', 'interview_rescheduled', 'interview_reminder', 'interview_completed', 'scorecard_ready', 'resume_parsed', 'resume_failed', 'system');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resume_status') THEN
            CREATE TYPE resume_status AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'FAILED');
        END IF;
    END $$;
    """)

    # -------------------------------- 2. Migrate job_profiles -> jobs
    op.execute("""
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_profiles')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs') THEN
            ALTER TABLE job_profiles RENAME TO jobs;
        END IF;
    END $$;
    """)

    # If jobs still does not exist, create it
    op.execute("""
    CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(120),
        experience_level VARCHAR(40),
        job_description TEXT NOT NULL,
        skills_required VARCHAR(120)[] DEFAULT '{}',
        status job_status NOT NULL DEFAULT 'open',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status job_status NOT NULL DEFAULT 'open';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS ix_jobs_org_status ON jobs(org_id, status);
    """)

    # -------------------------------- 3. Align interview_sessions
    op.execute("""
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_sessions' AND column_name='job_profile_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_sessions' AND column_name='job_id') THEN
            ALTER TABLE interview_sessions RENAME COLUMN job_profile_id TO job_id;
        END IF;
    END $$;
    """)

    op.execute("""
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS agent_state agent_state DEFAULT 'CONNECTING';
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 45;
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS join_window_minutes INT DEFAULT 15;
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recording_public_id VARCHAR(255);
    ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS ix_sessions_candidate_status ON interview_sessions(candidate_id, status);
    CREATE INDEX IF NOT EXISTS ix_sessions_org_status ON interview_sessions(org_id, status);
    CREATE INDEX IF NOT EXISTS ix_sessions_scheduled_at ON interview_sessions(scheduled_at);
    """)

    # -------------------------------- 4. Align interview_questions
    op.execute("""
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_questions' AND column_name='real_session_id') THEN
            UPDATE interview_questions SET session_id = real_session_id WHERE session_id IS NULL;
        END IF;
    END $$;
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS turn_index INT DEFAULT 0;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_questions' AND column_name='sequence_number') THEN
            UPDATE interview_questions SET turn_index = sequence_number WHERE turn_index IS NULL;
        END IF;
    END $$;
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS stage interview_stage DEFAULT 'intro';
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS prompt_text TEXT;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interview_questions' AND column_name='question_text') THEN
            UPDATE interview_questions SET prompt_text = question_text WHERE prompt_text IS NULL;
        END IF;
    END $$;
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS expected_concepts TEXT[] DEFAULT '{}';
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT TRUE;
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS model_used VARCHAR(120);
    ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS latency_ms INT;
    """)

    # -------------------------------- 5. Migrate interview_answers -> interview_responses
    op.execute("""
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interview_answers')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interview_responses') THEN
            ALTER TABLE interview_answers RENAME TO interview_responses;
        END IF;
    END $$;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS interview_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
        turn_index INT NOT NULL DEFAULT 0,
        speaker speaker NOT NULL DEFAULT 'candidate',
        answer_text TEXT NOT NULL DEFAULT '',
        audio_url TEXT,
        audio_latency_ms INT,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        relevance_score FLOAT,
        depth_score FLOAT,
        correctness_score FLOAT,
        evaluator_notes TEXT,
        missing_concepts TEXT[] DEFAULT '{}',
        red_flags TEXT[] DEFAULT '{}',
        action_decision action_decision,
        recommended_follow_up TEXT,
        evaluated_at TIMESTAMPTZ,
        model_used VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES interview_questions(id) ON DELETE CASCADE;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS turn_index INT DEFAULT 0;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS speaker speaker DEFAULT 'candidate';
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS answer_text TEXT DEFAULT '';
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS audio_url TEXT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS audio_latency_ms INT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS relevance_score FLOAT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS depth_score FLOAT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS correctness_score FLOAT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS evaluator_notes TEXT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS missing_concepts TEXT[] DEFAULT '{}';
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS red_flags TEXT[] DEFAULT '{}';
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS action_decision action_decision;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS recommended_follow_up TEXT;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS model_used VARCHAR(120);
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE interview_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    """)

    # -------------------------------- 6. Missing tables required by models
    op.execute("""
    CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) UNIQUE NOT NULL,
        category VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS code_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        turn_index INT DEFAULT 0,
        language VARCHAR(40) NOT NULL,
        source_code TEXT NOT NULL,
        stdout TEXT,
        stderr TEXT,
        exit_code INT,
        passed_count INT,
        total_count INT,
        execution_time_ms INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS proctoring_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type proctoring_event_type NOT NULL,
        severity severity DEFAULT 'info',
        detail TEXT,
        metadata_json JSONB DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS candidate_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE UNIQUE,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        summary TEXT,
        recommendation final_recommendation,
        pdf_public_id VARCHAR(255),
        pdf_url TEXT,
        generated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS competency_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scorecard_id UUID NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
        competency VARCHAR(120) NOT NULL,
        score NUMERIC(5,2),
        weight NUMERIC(5,2),
        evidence TEXT,
        evaluator_comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        user_agent VARCHAR(400),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80),
        entity_id VARCHAR(80),
        ip_address VARCHAR(64),
        user_agent VARCHAR(400),
        detail JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(120) UNIQUE NOT NULL,
        value JSONB DEFAULT '{}'::jsonb,
        description TEXT,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS companion_pairings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        device_info TEXT
    );

    CREATE TABLE IF NOT EXISTS companion_rate_limits (
        key TEXT PRIMARY KEY,
        count INT NOT NULL DEFAULT 1,
        reset_at TIMESTAMPTZ NOT NULL
    );
    """)

    # -------------------------------- 7. Align scorecards & candidate_resumes
    op.execute("""
    ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS recommendation final_recommendation;
    ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS executive_summary TEXT;
    ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS strengths TEXT[] DEFAULT '{}';
    ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS concerns TEXT[] DEFAULT '{}';
    ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS model_used VARCHAR(120);
    ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255) DEFAULT '';
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS secure_url TEXT DEFAULT '';
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS resource_type VARCHAR(40) DEFAULT 'raw';
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS purpose VARCHAR(60) DEFAULT 'resume';
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS file_size INT DEFAULT 0;
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS status resume_status DEFAULT 'UPLOADED';
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS parse_error TEXT;
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS parsed_text TEXT;
    ALTER TABLE candidate_resumes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    """)


def downgrade() -> None:
    pass

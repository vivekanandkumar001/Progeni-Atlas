-- =============================================================================
-- TalentPulse AI - PostgreSQL Relational Schema & Migration Script
-- Version: 3.0.0
-- Description: Core DDL migration script with UUID PKs, foreign keys, media pointers,
--              OTP tokens, verification tracking, and performance indexes.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_tier') THEN
        CREATE TYPE organization_tier AS ENUM ('starter', 'growth', 'enterprise');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('candidate', 'recruiter', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experience_level') THEN
        CREATE TYPE experience_level AS ENUM ('junior', 'mid', 'senior', 'lead');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_type') THEN
        CREATE TYPE session_type AS ENUM ('mock', 'live');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'abandoned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_stage') THEN
        CREATE TYPE interview_stage AS ENUM ('intro', 'resume_probe', 'technical', 'scenario', 'wrap_up');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'final_recommendation') THEN
        CREATE TYPE final_recommendation AS ENUM ('STRONG_HIRE', 'HIRE', 'LEAN_HIRE', 'REJECT');
    END IF;
END $$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    tier organization_tier NOT NULL DEFAULT 'starter',
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'candidate',
    status user_status NOT NULL DEFAULT 'active',
    is_email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    avatar_url TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Job Profiles Table
CREATE TABLE IF NOT EXISTS job_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    experience_level experience_level NOT NULL DEFAULT 'mid',
    job_description TEXT NOT NULL,
    skills_required TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Candidate Resumes Table
CREATE TABLE IF NOT EXISTS candidate_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    parsed_text_clean TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Interview Sessions Table
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_profile_id UUID REFERENCES job_profiles(id) ON DELETE SET NULL,
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    session_type session_type NOT NULL DEFAULT 'live',
    status session_status NOT NULL DEFAULT 'scheduled',
    current_stage interview_stage NOT NULL DEFAULT 'intro',
    recording_url TEXT,
    recording_duration_sec INT,
    total_score NUMERIC(5, 2) CHECK (total_score >= 0.00 AND total_score <= 100.00),
    final_recommendation final_recommendation,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Dedicated Table for Secure Email OTP Tokens
CREATE TABLE IF NOT EXISTS email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp_hash TEXT NOT NULL,
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('REGISTRATION_VERIFY', 'FORGOT_PASSWORD')),
    expires_at TIMESTAMPTZ NOT NULL,
    attempts_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration safety for existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE job_profiles ADD COLUMN IF NOT EXISTS skills_required TEXT[] DEFAULT '{}';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS job_profile_id UUID REFERENCES job_profiles(id) ON DELETE SET NULL;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS session_type session_type DEFAULT 'live';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recording_duration_sec INT;

-- =============================================================================
-- INDEXES & PERFORMANCE OPTIMIZATIONS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_email_otps_lookup ON email_otps(email, purpose, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate ON interview_sessions(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON interview_sessions(job_profile_id);
CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON candidate_resumes(candidate_id, is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_job_profiles_org ON job_profiles(org_id);

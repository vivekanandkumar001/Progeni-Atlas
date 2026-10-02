-- =============================================================================
-- TalentPulse AI - Candidate Profile Migration Script
-- Version: 3.1.0
-- Description: Extends users table with academic, bio, social links, skills summary,
--              and 2FA fields, ensuring candidate_resumes table is up to date.
-- =============================================================================

-- Extend users table with academic & profile fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS course VARCHAR(50),
ADD COLUMN IF NOT EXISTS branch VARCHAR(100),
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20),
ADD COLUMN IF NOT EXISTS college_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS github_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS skills_summary TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Ensure candidate_resumes table is up to date
CREATE TABLE IF NOT EXISTS candidate_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    parsed_text_clean TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

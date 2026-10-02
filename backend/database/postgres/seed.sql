-- =============================================================================
-- TalentPulse AI - PostgreSQL Demo Seed Data
-- Version: 2.1.0
-- Description: Sample organizations, users, job profiles, resumes, and interview sessions.
-- =============================================================================

TRUNCATE TABLE interview_sessions CASCADE;
TRUNCATE TABLE candidate_resumes CASCADE;
TRUNCATE TABLE job_profiles CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- 1. Insert Demo Organizations
INSERT INTO organizations (id, name, slug, tier, logo_url) VALUES
('11111111-1111-1111-1111-111111111111', 'Acme AI Systems', 'acme-ai', 'enterprise', 'https://storage.talentpulse.ai/avatars/org_acme.png'),
('22222222-2222-2222-2222-222222222222', 'Apex Health Technologies', 'apex-health', 'growth', 'https://storage.talentpulse.ai/avatars/org_apex.png'),
('33333333-3333-3333-3333-333333333333', 'CloudScale Startups', 'cloudscale', 'starter', NULL);

-- 2. Insert Demo Users (Valid Hex UUIDs)
INSERT INTO users (id, org_id, email, password_hash, full_name, role, status, avatar_url, phone) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'admin@acmeai.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Sarah Connor', 'admin', 'active', 'https://storage.talentpulse.ai/avatars/a1111111-1111-1111-1111-111111111111.jpg', '+1-555-0192'),
('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'recruiter@acmeai.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Marcus Vance', 'recruiter', 'active', 'https://storage.talentpulse.ai/avatars/b2222222-2222-2222-2222-222222222222.jpg', '+1-555-0144'),
('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'vivekanand@talentpulse.ai', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Vivekanand Kumar', 'candidate', 'active', 'https://storage.talentpulse.ai/avatars/c3333333-3333-3333-3333-333333333333.jpg', '+91-9876543210');

-- 3. Insert Job Profiles
INSERT INTO job_profiles (id, org_id, title, department, experience_level, job_description, skills_required) VALUES
(
    'd1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Full-Stack & Systems Architecture Engineer',
    'Core Engineering',
    'senior',
    'We are seeking a Senior Full-Stack Architecture Engineer with expertise in Next.js, Node.js, WebRTC video streaming, and distributed microservices.',
    ARRAY['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'MongoDB', 'System Architecture']
);

-- 4. Insert Candidate Resumes
INSERT INTO candidate_resumes (id, candidate_id, file_name, file_size_bytes, file_url, mime_type, parsed_text_clean, is_active) VALUES
(
    'f1111111-1111-1111-1111-111111111111',
    'c3333333-3333-3333-3333-333333333333',
    'Vivekanand_Kumar_Resume_2026.pdf',
    1468006,
    'https://storage.talentpulse.ai/resumes/c3333333-3333-3333-3333-333333333333/f1111111-1111-1111-1111-111111111111.pdf',
    'application/pdf',
    'Vivekanand Kumar - Senior Full-Stack Systems Architect with background in React, Next.js, FastAPI, PostgreSQL, MongoDB, Qdrant, and distributed real-time media applications.',
    TRUE
);

-- 5. Insert Interview Sessions
INSERT INTO interview_sessions 
(id, job_profile_id, candidate_id, recruiter_id, org_id, session_type, status, current_stage, recording_url, recording_duration_sec, total_score, final_recommendation, started_at, ended_at)
VALUES
(
    'e1111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111',
    'c3333333-3333-3333-3333-333333333333',
    'b2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'live',
    'completed',
    'wrap_up',
    'https://storage.talentpulse.ai/recordings/e1111111-1111-1111-1111-111111111111/full_interview.mp4',
    1840,
    88.00,
    'STRONG_HIRE',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour'
);

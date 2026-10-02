-- =============================================================================
-- TalentPulse AI - Enterprise Recruiter & Organization Profile Migration Script
-- Version: 3.2.0
-- Description: Extends organizations and users tables for recruiter profile,
--              company branding, team seat RBAC, and hiring quotas.
-- =============================================================================

-- Extend organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS website_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS headquarters_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Extend users table for recruiter role details
ALTER TABLE users
ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS monthly_hiring_quota INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS is_org_admin BOOLEAN DEFAULT FALSE;

-- Organization team members invite table
CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'recruiter',
    status VARCHAR(50) DEFAULT 'pending',
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

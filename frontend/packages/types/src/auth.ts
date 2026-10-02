import { z } from 'zod';

// =============================================================================
// ENUMS & PRIMITIVE SCHEMAS
// =============================================================================

export const UserRoleSchema = z.enum(['candidate', 'recruiter', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(['active', 'suspended']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const OrgTierSchema = z.enum(['sandbox', 'growth', 'enterprise']);
export type OrgTier = z.infer<typeof OrgTierSchema>;

// =============================================================================
// DOMAIN MODELS
// =============================================================================

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  tier: OrgTierSchema,
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const UserPayloadSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
  status: UserStatusSchema,
  createdAt: z.string().datetime().or(z.date()),
});
export type UserPayload = z.infer<typeof UserPayloadSchema>;

// =============================================================================
// AUTHENTICATION REQUEST / RESPONSE SCHEMAS
// =============================================================================

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(255),
  role: UserRoleSchema.default('candidate'),
  orgSlug: z.string().optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserPayloadSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

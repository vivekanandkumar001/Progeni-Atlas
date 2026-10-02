import { z } from "zod";

export const LoginValidationSchema = z.object({
  role: z.enum(["candidate", "recruiter"]),
  email: z
    .string()
    .trim()
    .min(1, "Email Address is required")
    .email("Enter a valid email address")
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof LoginValidationSchema>;

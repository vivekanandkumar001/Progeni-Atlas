import { z } from "zod";

export const LoginValidationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address")
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Please enter your password")
    .min(8, "Password must be at least 8 characters"),
});

export type LoginFormData = z.infer<typeof LoginValidationSchema>;
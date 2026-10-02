import { z } from "zod";

const nameRegex = /^[A-Z][a-z]*(?: [A-Z][a-z]*)*$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,32}$/;
const phoneRegex = /^[6-9]\d{9}$/;

export const RegisterValidationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(64, "Name cannot exceed 64 characters")
    .regex(nameRegex, "Each word must begin with a capital letter (e.g., John Doe)"),

  email: z
    .string()
    .trim()
    .min(1, "Email Address is required")
    .email("Please enter a valid email address")
    .toLowerCase(),

  course: z
    .string()
    .trim()
    .min(1, "Please select your course"),

  branch: z
    .string()
    .trim()
    .min(1, "Please select your branch / specialization"),

  year: z
    .string()
    .trim()
    .min(1, "Please select your academic year"),

  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(phoneRegex, "Please enter a valid 10-digit mobile number"),

  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(32, "Password cannot exceed 32 characters")
    .regex(
      passwordRegex,
      "Password must include at least one uppercase letter, lowercase letter, number, and special character"
    ),

  confirmPassword: z
    .string()
    .min(1, "Please confirm your password"),

  resume: z
    .custom<File>((val) => val instanceof File, "Please upload your resume (PDF or DOCX)")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File size must be 5MB or less")
    .refine(
      (file) =>
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
        ].includes(file.type),
      "Only PDF and DOCX files are supported"
    ),

  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions to proceed" }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof RegisterValidationSchema>;

export const RecruiterRegisterSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full Name is required")
    .min(2, "Full Name must be at least 2 characters")
    .max(64, "Full Name cannot exceed 64 characters")
    .regex(nameRegex, "Each word must begin with a capital letter"),

  workEmail: z
    .string()
    .trim()
    .min(1, "Work Email Address is required")
    .email("Please enter a valid corporate email address")
    .toLowerCase(),

  companyName: z
    .string()
    .trim()
    .min(2, "Company name is required"),

  designation: z
    .string()
    .trim()
    .min(2, "Job title is required"),

  teamSize: z
    .string()
    .min(1, "Please select your company size"),

  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(phoneRegex, "Please enter a valid 10-digit phone number"),

  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(32, "Password cannot exceed 32 characters")
    .regex(passwordRegex, "Password must include uppercase, lowercase, number, and special character"),

  confirmPassword: z
    .string()
    .min(1, "Please confirm your password"),

  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the enterprise terms to proceed" }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RecruiterFormData = z.infer<typeof RecruiterRegisterSchema>;

export const getCourseYears = (course: string): string[] => {
  const durationMap: Record<string, number> = {
    'B.Tech': 4,
    'M.Tech': 2,
    'BCA': 3,
    'MCA': 2,
    'B.Sc CS': 3,
    'Other': 4,
  };

  const totalYears = durationMap[course] || 4;
  return Array.from({ length: totalYears }, (_, i) => {
    const year = i + 1;
    const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
    return `${year}${suffix} Year`;
  });
};

export const isFreeEmailDomain = (email: string): boolean => {
  const freeDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  return freeDomains.includes(domain || "");
};

import { z } from "zod";
import {
  getPhoneValidationMessage,
  isValidPhoneNumber,
} from "./phone";

const nameRegex = /^[A-Z][a-z]*(?: [A-Z][a-z]*)*$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,32}$/;

export const RegisterValidationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Please enter your full name")
    .min(2, "Name must be at least 2 characters")
    .max(64, "Name cannot exceed 64 characters")
    .regex(nameRegex, "Each word must begin with a capital letter (e.g., John Doe)"),

  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
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
    .min(1, "Please select your education / experience status"),

  phoneCountry: z.string().trim().min(1, "Please select your country code"),

  phone: z
    .string()
    .trim()
    .min(1, "Please enter your phone number"),

  password: z
    .string()
    .min(1, "Please enter your password")
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
    .refine(
      (file) => !(file instanceof File) || file.size > 0,
      "The selected resume file is empty"
    )
    .refine(
      (file) => !(file instanceof File) || file.size <= 5 * 1024 * 1024,
      "File size must be 5MB or less"
    )
    .refine(
      (file) =>
        !(file instanceof File) ||
        /\.(pdf|docx)$/i.test(file.name) ||
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(file.type),
      "Only PDF and DOCX files are supported"
    ),

  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions to proceed",
  }),
})
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    if (!isValidPhoneNumber(data.phoneCountry, data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: getPhoneValidationMessage(data.phoneCountry),
      });
    }
  });

export type RegisterFormData = z.infer<typeof RegisterValidationSchema>;

/**
 * zod only runs object-level refinements when every base field parses, so a
 * single invalid field (say a missing resume) would hide the password-match
 * and country-aware phone errors until everything else was fixed. This
 * companion schema uses permissive fields, so its refinements always run, and
 * `withCrossFieldChecks` merges anything it finds into the main resolver's
 * result — one submit then reveals every problem at once.
 */
const CrossFieldSchema = z.object({
  phoneCountry: z.string(),
  phone: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
})
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    if (data.phone && !isValidPhoneNumber(data.phoneCountry, data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: getPhoneValidationMessage(data.phoneCountry),
      });
    }
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
export function withCrossFieldChecks<TResolver extends (...args: any[]) => any>(
  baseResolver: TResolver
): TResolver {
  return (async (values: unknown, context: unknown, options: unknown) => {
    const result = await baseResolver(values, context, options);
    const errors = (result as { errors?: Record<string, unknown> } | undefined)?.errors;
    if (errors) {
      const cross = CrossFieldSchema.safeParse(values ?? {});
      if (!cross.success) {
        for (const issue of cross.error.issues) {
          const key = String(issue.path?.[0] ?? "");
          if (key && !errors[key]) {
            errors[key] = { type: "validation", message: issue.message };
          }
        }
      }
    }
    return result;
  }) as unknown as TResolver;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const RecruiterRegisterSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Please enter your full name")
    .min(2, "Full Name must be at least 2 characters")
    .max(64, "Full Name cannot exceed 64 characters")
    .regex(nameRegex, "Each word must begin with a capital letter"),

  workEmail: z
    .string()
    .trim()
    .min(1, "Please enter your work email address")
    .email("Please enter a valid corporate email address")
    .toLowerCase(),

  companyName: z
    .string()
    .trim()
    .min(2, "Please enter your company name"),

  designation: z
    .string()
    .trim()
    .min(2, "Please enter your job title"),

  teamSize: z
    .string()
    .min(1, "Please select your company size"),

  phoneCountry: z.string().trim().min(1, "Please select your country code"),

  phone: z
    .string()
    .trim()
    .min(1, "Please enter your phone number"),

  password: z
    .string()
    .min(1, "Please enter your password")
    .min(8, "Password must be at least 8 characters")
    .max(32, "Password cannot exceed 32 characters")
    .regex(passwordRegex, "Password must include uppercase, lowercase, number, and special character"),

  confirmPassword: z
    .string()
    .min(1, "Please confirm your password"),

  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the enterprise terms to proceed",
  }),
})
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    if (!isValidPhoneNumber(data.phoneCountry, data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: getPhoneValidationMessage(data.phoneCountry),
      });
    }
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

/**
 * Options shown under "Graduated / Experience" in the education status dropdown.
 * Kept separate from academic years so the UI can group them clearly and the
 * dashboard can tell a current student apart from a graduate.
 */
export const EXPERIENCE_STATUS_OPTIONS = [
  'Fresher (0 years)',
  '1-2 Years Experience',
  '2+ Years Experience',
] as const;

export function isAcademicYearValue(course: string, value: string): boolean {
  return getCourseYears(course).includes(value);
}

export const isFreeEmailDomain = (email: string): boolean => {
  const freeDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  return freeDomains.includes(domain || "");
};

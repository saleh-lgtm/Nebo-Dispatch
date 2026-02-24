import { z } from "zod";
import { PASSWORD_POLICY } from "./passwordPolicy";

// ===== SECURITY HELPERS =====

// Sanitize string input (prevent XSS)
const sanitizeString = (val: string) =>
    val.replace(/[<>]/g, "").trim();

// Strong password schema based on password policy
const strongPasswordSchema = z
    .string()
    .min(PASSWORD_POLICY.minLength, `Password must be at least ${PASSWORD_POLICY.minLength} characters`)
    .max(PASSWORD_POLICY.maxLength, `Password must be less than ${PASSWORD_POLICY.maxLength} characters`)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\\/`~]/, "Password must contain at least one special character")
    .refine((val) => !/(.)\1{2,}/.test(val), "Password cannot contain more than 2 repeated characters");

// Safe email schema (lowercase, trimmed)
const safeEmailSchema = z
    .string()
    .email("Invalid email address")
    .transform((val) => val.toLowerCase().trim());

// Safe name schema (sanitized, proper length)
const safeNameSchema = z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .transform(sanitizeString);

// ===== USER SCHEMAS =====

export const loginSchema = z.object({
    email: safeEmailSchema,
    password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z.object({
    name: safeNameSchema,
    email: safeEmailSchema,
    password: strongPasswordSchema,
    role: z.enum(["ADMIN", "DISPATCHER", "ACCOUNTING"], {
        error: "Invalid role selected",
    }),
});

export const updateUserSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    isActive: z.boolean().optional(),
});

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: strongPasswordSchema,
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: "New password must be different from current password",
        path: ["newPassword"],
    });

export const resetPasswordSchema = z.object({
    password: strongPasswordSchema,
});

// ===== SCHEDULING SCHEMAS =====

export const createScheduleSchema = z.object({
    userId: z.string().min(1, "User is required"),
    shiftStart: z.date({ error: "Start time is required" }),
    shiftEnd: z.date({ error: "End time is required" }),
}).refine((data) => data.shiftEnd > data.shiftStart, {
    message: "End time must be after start time",
    path: ["shiftEnd"],
});

export const scheduleRequestSchema = z.object({
    type: z.enum(["HOURS_MODIFICATION", "SCHEDULE_CHANGE", "REVIEW"], {
        error: "Invalid request type",
    }),
    reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
    scheduleId: z.string().optional(),
    requestedStart: z.date().optional(),
    requestedEnd: z.date().optional(),
});

// ===== AFFILIATE SCHEMAS =====

export const createAffiliateSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    market: z.string().min(2, "Market/region is required"),
    notes: z.string().optional(),
    cityTransferRate: z.string().optional(),
});

export const approveAffiliateSchema = z.object({
    id: z.string().min(1, "Affiliate ID is required"),
    adminNotes: z.string().optional(),
});

// ===== SHIFT REPORT SCHEMAS =====

export const shiftReportSchema = z.object({
    callsReceived: z.number().min(0, "Cannot be negative").default(0),
    emailsSent: z.number().min(0, "Cannot be negative").default(0),
    quotesGiven: z.number().min(0, "Cannot be negative").default(0),
    handoffNotes: z.string().optional(),
    generalComments: z.string().optional(),
    newIdeas: z.string().optional(),
    incidents: z.string().optional(),
    clockOut: z.boolean().default(false),
});

// ===== GLOBAL NOTES SCHEMAS =====

export const createNoteSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title too long"),
    content: z.string().min(10, "Content must be at least 10 characters"),
});

export const updateNoteSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title too long").optional(),
    content: z.string().min(10, "Content must be at least 10 characters").optional(),
});

// ===== HELPER FUNCTIONS =====

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type ScheduleRequestInput = z.infer<typeof scheduleRequestSchema>;
export type CreateAffiliateInput = z.infer<typeof createAffiliateSchema>;
export type ShiftReportInput = z.infer<typeof shiftReportSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

/**
 * Validate data against a schema and return typed result or errors
 */
export function validateForm<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (!errors[path]) {
            errors[path] = issue.message;
        }
    }

    return { success: false, errors };
}

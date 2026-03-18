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

// ===== PRESENCE SCHEMAS =====

export const updatePresenceSchema = z.object({
    currentPage: z.string().max(200).optional(),
});

// ===== SMS CONTACT SCHEMAS =====

export const updateSMSContactSchema = z.object({
    name: z.string().max(100).optional(),
    customLabel: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
});

export const linkContactSchema = z.object({
    phoneNumber: z.string().min(10, "Invalid phone number"),
    entityId: z.string().min(1, "Entity ID is required"),
});

export const searchQuerySchema = z.object({
    query: z.string().min(1, "Search query is required").max(100),
});

// ===== CONTACT SCHEMAS =====

export const createContactSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().max(20).optional(),
    company: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
});

export const updateContactSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(20).optional(),
    company: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
});

// ===== NOTIFICATION SCHEMAS =====

export const createNotificationSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    type: z.enum([
        "GENERAL", "SHIFT_SWAP_REQUEST", "SHIFT_SWAP_RESPONSE",
        "SHIFT_SWAP_APPROVED", "SHIFT_SWAP_REJECTED",
        "TIME_OFF_APPROVED", "TIME_OFF_REJECTED",
        "TASK_ASSIGNED", "SCHEDULE_PUBLISHED", "SOP_REQUIRES_ACK"
    ]),
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(1000),
    entityType: z.string().max(50).optional(),
    entityId: z.string().optional(),
    actionUrl: z.string().max(500).optional(),
});

// ===== EVENT SCHEMAS =====

export const createEventSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().max(2000).optional(),
    eventDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    eventType: z.enum(["GAME_DAY", "CONCERT", "CONFERENCE", "HOLIDAY", "PROMOTION", "GENERAL"]).optional(),
    location: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
    expectedVolume: z.string().max(100).optional(),
    staffingNotes: z.string().max(1000).optional(),
});

export const updateEventSchema = createEventSchema.partial();

// ===== REQUEST SCHEMAS =====

export const createDetailedRequestSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    type: z.enum(["HOURS_MODIFICATION", "SCHEDULE_CHANGE", "REVIEW"]),
    reason: z.string().min(10, "Please provide a detailed reason"),
    scheduleId: z.string().optional(),
    requestedStart: z.coerce.date().optional(),
    requestedEnd: z.coerce.date().optional(),
});

export const userIdParamSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
});

// ===== TASK SCHEMAS =====

export const createAdminTaskSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().max(2000).optional(),
    assignToAll: z.boolean(),
    assignedToId: z.string().optional(),
    priority: z.number().min(0).max(10).optional(),
    dueDate: z.coerce.date().optional(),
});

export const updateAdminTaskSchema = createAdminTaskSchema.partial();

export const completeTaskSchema = z.object({
    taskId: z.string().min(1, "Task ID is required"),
    notes: z.string().max(1000).optional(),
});

export const getRecentCompletionsSchema = z.object({
    limit: z.number().min(1).max(100).optional(),
});

// ===== FLEET SCHEMAS =====

export const createVehicleSchema = z.object({
    name: z.string().min(2, "Name is required").max(100),
    type: z.enum(["SEDAN", "SUV", "VAN", "LIMOUSINE", "STRETCH_LIMO", "SPRINTER", "MINI_BUS", "COACH", "OTHER"]),
    make: z.string().min(1, "Make is required").max(50),
    model: z.string().min(1, "Model is required").max(50),
    year: z.number().min(1900).max(2100),
    color: z.string().max(30).optional(),
    licensePlate: z.string().min(1, "License plate is required").max(20),
    vin: z.string().min(1, "VIN is required").max(20),
    passengerCapacity: z.number().min(1).max(100).optional(),
    luggageCapacity: z.number().min(0).max(100).optional(),
    notes: z.string().max(2000).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const updateVehicleStatusSchema = z.object({
    id: z.string().min(1, "Vehicle ID is required"),
    status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE", "RETIRED"]),
});

export const createPermitSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    permitType: z.string().min(1, "Permit type is required").max(100),
    permitNumber: z.string().max(100).optional(),
    issuingAuthority: z.string().max(200).optional(),
    issueDate: z.coerce.date().optional(),
    expirationDate: z.coerce.date(),
    notes: z.string().max(1000).optional(),
    fileUrl: z.string().max(500).optional(),
    fileName: z.string().max(200).optional(),
    fileSize: z.number().optional(),
});

export const updatePermitSchema = createPermitSchema.partial().omit({ vehicleId: true });

export const createInsuranceSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    insuranceType: z.string().min(1, "Insurance type is required").max(100),
    provider: z.string().min(1, "Provider is required").max(200),
    policyNumber: z.string().max(100).optional(),
    coverageAmount: z.number().optional(),
    issueDate: z.coerce.date().optional(),
    expirationDate: z.coerce.date(),
    notes: z.string().max(1000).optional(),
    fileUrl: z.string().max(500).optional(),
    fileName: z.string().max(200).optional(),
    fileSize: z.number().optional(),
});

export const updateInsuranceSchema = createInsuranceSchema.partial().omit({ vehicleId: true });

export const createRegistrationSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    state: z.string().min(1, "State is required").max(50),
    registrationNumber: z.string().max(50).optional(),
    issueDate: z.coerce.date().optional(),
    expirationDate: z.coerce.date(),
    notes: z.string().max(1000).optional(),
    fileUrl: z.string().max(500).optional(),
    fileName: z.string().max(200).optional(),
    fileSize: z.number().optional(),
});

export const updateRegistrationSchema = createRegistrationSchema.partial().omit({ vehicleId: true });

export const createVehicleDocumentSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    documentType: z.string().min(1, "Document type is required").max(100),
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(1000).optional(),
    fileUrl: z.string().min(1, "File URL is required").max(500),
    fileName: z.string().min(1, "File name is required").max(200),
    fileSize: z.number().optional(),
    mimeType: z.string().max(100).optional(),
});

export const getVehicleFiltersSchema = z.object({
    status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE", "RETIRED"]).optional(),
    type: z.enum(["SEDAN", "SUV", "VAN", "LIMOUSINE", "STRETCH_LIMO", "SPRINTER", "MINI_BUS", "COACH", "OTHER"]).optional(),
    search: z.string().max(100).optional(),
});

export const daysAheadSchema = z.object({
    daysAhead: z.number().min(1).max(365).optional(),
});

// ===== DRIVER SCHEMAS =====

export const driverVehicleSchema = z.object({
    vehicleType: z.string().max(50).optional(),
    make: z.string().max(50).optional(),
    model: z.string().max(50).optional(),
    year: z.number().min(1900).max(2100).optional(),
    color: z.string().max(30).optional(),
    licensePlate: z.string().max(20).optional(),
    passengerCapacity: z.number().min(1).max(100).optional(),
    insuranceExpiry: z.coerce.date().optional(),
    notes: z.string().max(1000).optional(),
});

export const schedulePreferencesSchema = z.object({
    preferredDays: z.array(z.string()).optional(),
    preferredShifts: z.array(z.string()).optional(),
    maxHoursWeek: z.number().min(0).max(168).optional(),
    timezone: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
});

export const vehicleAssignmentSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    isPrimary: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
});

export const updateVehicleAssignmentSchema = z.object({
    endDate: z.coerce.date().optional(),
    isPrimary: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
});

// ===== AFFILIATE PRICING SCHEMAS =====

export const pricingInputSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
    serviceType: z.string().min(1, "Service type is required").max(100),
    flatRate: z.number().min(0, "Flat rate must be positive"),
    notes: z.string().max(1000).optional(),
});

export const routePriceInputSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
    pickupLocation: z.string().min(1, "Pickup location is required").max(200),
    dropoffLocation: z.string().min(1, "Dropoff location is required").max(200),
    vehicleType: z.string().max(50).optional(),
    price: z.number().min(0, "Price must be positive"),
    notes: z.string().max(1000).optional(),
});

export const bulkPricingSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
    entries: z.array(z.object({
        serviceType: z.string().min(1).max(100),
        flatRate: z.number().min(0),
        notes: z.string().max(1000).optional(),
    })),
});

export const bulkRoutePricesSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
    routes: z.array(z.object({
        pickupLocation: z.string().min(1).max(200),
        dropoffLocation: z.string().min(1).max(200),
        vehicleType: z.string().max(50).optional(),
        price: z.number().min(0),
        notes: z.string().max(1000).optional(),
    })),
});

export const copyPricingSchema = z.object({
    sourceAffiliateId: z.string().min(1, "Source affiliate ID is required"),
    targetAffiliateId: z.string().min(1, "Target affiliate ID is required"),
});

export const idParamSchema = z.object({
    id: z.string().min(1, "ID is required"),
});

export const affiliateIdParamSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
});

// ===== SHARED PARAM SCHEMAS =====

export const limitParamSchema = z.object({
    limit: z.number().min(1).max(100).optional(),
});

export const daysParamSchema = z.object({
    days: z.number().min(1).max(365).optional(),
});

export const weeksParamSchema = z.object({
    weeks: z.number().min(1).max(52).optional(),
});

export const dateRangeSchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
});

// ===== ADMIN DASHBOARD SCHEMAS =====

export const featureAccessSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    feature: z.enum([
        "QUOTES", "CONTACTS", "SMS", "FLEET", "SCHEDULER",
        "REPORTS", "DIRECTORY", "CONFIRMATIONS", "TBR_TRIPS",
        "NOTES", "TASKS", "ANALYTICS"
    ]),
    permission: z.enum(["NONE", "READ", "EDIT"]),
});

export const taskConfigSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    primaryTask: z.string().max(200).nullable(),
    secondaryTask: z.string().max(200).nullable(),
    notes: z.string().max(1000).nullable().optional(),
});

// ===== PORTAL SCHEMAS =====

export const createPortalSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    url: z.string().url("Invalid URL format").max(500),
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(20).optional(),
});

export const updatePortalSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    url: z.string().url().max(500).optional(),
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(20).optional(),
    sortOrder: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
});

export const rejectPortalSchema = z.object({
    id: z.string().min(1, "Portal ID is required"),
    reason: z.string().max(500).optional(),
});

// ===== BLAST SMS SCHEMAS =====

export const blastFilterSchema = z.object({
    sources: z.array(z.enum(["contacts", "affiliates"])).optional(),
    contactTagIds: z.array(z.string()).optional(),
    affiliateTagIds: z.array(z.string()).optional(),
    affiliateTypes: z.array(z.enum(["FARM_IN", "FARM_OUT", "IOS", "HOUSE_CHAUFFEUR"])).optional(),
    searchQuery: z.string().max(200).optional(),
    selectedRecipientIds: z.array(z.string()).optional(),
});

export const sendBlastSMSSchema = z.object({
    selectedIds: z.array(z.string().min(1)).min(1, "At least one recipient required"),
    message: z.string().min(1, "Message is required").max(1600, "Message too long"),
    contactTagIds: z.array(z.string()).optional(),
    affiliateTagIds: z.array(z.string()).optional(),
});

// ===== VEHICLE MAPPING SCHEMAS =====

export const vehicleMappingSchema = z.object({
    tbrVehicleType: z.string().min(1, "TBR vehicle type is required").max(100),
    laVehicleType: z.string().min(1, "LA vehicle type is required").max(100),
    laVehicleId: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
});

export const upsertVehicleMappingSchema = z.object({
    id: z.string().optional(),
    tbrVehicleType: z.string().min(1).max(100),
    laVehicleType: z.string().min(1).max(100),
    laVehicleId: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
});

export const toggleMappingSchema = z.object({
    id: z.string().min(1, "Mapping ID is required"),
    isActive: z.boolean(),
});

// ===== DISPATCHER PREFERENCES SCHEMAS =====

export const dispatcherPreferencesSchema = z.object({
    preferredDays: z.array(z.enum([
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ])).optional(),
    preferredShifts: z.array(z.enum(["Morning", "Evening", "Night", "Overnight"])).optional(),
    maxHoursWeek: z.number().min(0).max(168).nullable().optional(),
    minHoursWeek: z.number().min(0).max(168).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    blackoutDates: z.array(z.string()).optional(),
});

export const blackoutDateSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
});

// ===== AFFILIATE AUDIT SCHEMAS =====

export const auditConfigSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
    auditFrequency: z.enum(["EVERY_SHIFT", "DAILY", "WEEKLY"]).optional(),
    priority: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
});

export const updateAuditConfigSchema = z.object({
    auditFrequency: z.enum(["EVERY_SHIFT", "DAILY", "WEEKLY"]).optional(),
    priority: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
});

// ===== TAG SCHEMAS =====

export const createTagSchema = z.object({
    name: z.string().min(1, "Tag name is required").max(50, "Tag name must be 50 characters or less"),
    color: z.string().max(20).optional(),
    description: z.string().max(200).optional(),
});

export const updateTagSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    color: z.string().max(20).optional(),
    description: z.string().max(200).optional(),
});

export const tagAssignmentSchema = z.object({
    contactId: z.string().min(1, "Contact ID is required"),
    tagIds: z.array(z.string()),
});

export const tagContactSchema = z.object({
    contactId: z.string().min(1, "Contact ID is required"),
    tagId: z.string().min(1, "Tag ID is required"),
});

export const tagIdsSchema = z.object({
    tagIds: z.array(z.string()),
});

// ===== HOURS SCHEMAS =====

export const shiftsFilterSchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    userId: z.string().optional(),
    limit: z.number().min(1).max(500).optional(),
    offset: z.number().min(0).optional(),
});

// ===== SOP SCHEMAS =====

export const createSOPSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().max(2000).optional(),
    content: z.string().min(10, "Content must be at least 10 characters"),
    category: z.string().max(100).optional(),
    isPublished: z.boolean().optional(),
    order: z.number().min(0).optional(),
    quickReference: z.string().max(5000).optional(),
    requiresAcknowledgment: z.boolean().optional(),
    relatedSopIds: z.array(z.string()).optional(),
});

export const updateSOPSchema = z.object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    content: z.string().min(10).optional(),
    category: z.string().max(100).optional(),
    isPublished: z.boolean().optional(),
    order: z.number().min(0).optional(),
    quickReference: z.string().max(5000).optional(),
    requiresAcknowledgment: z.boolean().optional(),
    relatedSopIds: z.array(z.string()).optional(),
    changeNote: z.string().max(500).optional(),
});

export const quizQuestionDataSchema = z.object({
    question: z.string().min(1).max(500),
    options: z.array(z.string().min(1)).min(2),
    correctAnswer: z.number().min(0),
    explanation: z.string().max(1000).optional(),
});

export const createSOPQuizSchema = z.object({
    sopId: z.string().min(1, "SOP ID is required"),
    questions: z.array(quizQuestionDataSchema).min(1, "At least one question required"),
    title: z.string().max(200).optional(),
    passingScore: z.number().min(0).max(100).optional(),
});

export const submitQuizAttemptSchema = z.object({
    quizId: z.string().min(1, "Quiz ID is required"),
    answers: z.array(z.number()),
});

export const sopSearchSchema = z.object({
    query: z.string().min(1).max(200),
});

// ===== ANNOUNCEMENT SCHEMAS =====

export const createAnnouncementSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title too long"),
    content: z.string().min(10, "Content must be at least 10 characters"),
    isPinned: z.boolean().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
});

export const updateAnnouncementSchema = z.object({
    title: z.string().min(3).max(100).optional(),
    content: z.string().min(10).optional(),
    isPinned: z.boolean().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
});

export const getAllShiftNotesSchema = z.object({
    limit: z.number().min(1).max(500).optional(),
    offset: z.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

// ===== CALENDAR SCHEMAS =====

export const calendarUserIdSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
});

export const calendarTokenSchema = z.object({
    token: z.string().min(1, "Token is required"),
    userId: z.string().min(1, "User ID is required"),
});

// ===== STORAGE SCHEMAS =====

export const uploadFileSchema = z.object({
    bucket: z.enum(["fleet-documents", "avatars", "sop-files", "general"]),
    folder: z.string().min(1).max(200),
});

export const deleteFileSchema = z.object({
    bucket: z.enum(["fleet-documents", "avatars", "sop-files", "general"]),
    fileUrl: z.string().url("Invalid file URL"),
});

export const signedUrlSchema = z.object({
    bucket: z.enum(["fleet-documents", "avatars", "sop-files", "general"]),
    filePath: z.string().min(1, "File path is required").max(500),
    expiresIn: z.number().min(60).max(86400).optional(),
});

// ===== ACCOUNTING SCHEMAS =====

export const flagReservationSchema = z.object({
    shiftReportId: z.string().min(1, "Shift report ID is required"),
    reservationType: z.enum(["accepted", "modified", "cancelled"]),
    reservationId: z.string().min(1, "Reservation ID is required"),
    reservationNotes: z.string().max(2000).optional(),
    flagReason: z.string().max(2000).optional(),
});

export const createAccountingFlagsSchema = z.object({
    shiftReportId: z.string().min(1, "Shift report ID is required"),
    flags: z.array(z.object({
        reservationType: z.enum(["accepted", "modified", "cancelled"]),
        reservationId: z.string().min(1, "Reservation ID is required"),
        reservationNotes: z.string().max(2000).optional(),
        flagReason: z.string().max(2000).optional(),
    })),
});

export const getFlaggedReservationsSchema = z.object({
    status: z.enum(["PENDING", "IN_REVIEW", "RESOLVED"]).optional(),
    limit: z.number().min(1).max(200).optional(),
    offset: z.number().min(0).optional(),
});

export const resolveAccountingFlagSchema = z.object({
    flagId: z.string().min(1, "Flag ID is required"),
    resolution: z.string().min(1, "Resolution is required").max(2000),
    accountingNotes: z.string().max(2000).optional(),
});

// ===== ADMIN REQUEST SCHEMAS =====

export const approveRequestSchema = z.object({
    id: z.string().min(1, "Request ID is required"),
    adminNotes: z.string().max(2000).optional(),
    applyChanges: z.boolean().optional(),
});

export const rejectRequestSchema = z.object({
    id: z.string().min(1, "Request ID is required"),
    adminNotes: z.string().min(1, "Reason is required").max(2000),
});

// ===== AFFILIATE EXTENDED SCHEMAS =====

export const updateAffiliateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    state: z.string().max(50).optional(),
    cities: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional(),
    cityTransferRate: z.string().max(50).optional(),
});

export const createAffiliateAttachmentSchema = z.object({
    affiliateId: z.string().min(1, "Affiliate ID is required"),
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(1000).optional(),
    documentType: z.string().max(100).optional(),
    fileUrl: z.string().min(1, "File URL is required").max(500),
    fileName: z.string().min(1, "File name is required").max(200),
    fileSize: z.number().optional(),
    mimeType: z.string().max(100).optional(),
});

// ===== SCHEDULE TEMPLATE SCHEMAS =====

export const templateShiftInputSchema = z.object({
    dayOfWeek: z.number().min(0).max(6),
    startHour: z.number().min(0).max(23),
    endHour: z.number().min(0).max(23),
    market: z.string().optional(),
    shiftType: z.string().optional(),
    dispatcherId: z.string().optional(),
    order: z.number().min(0).optional(),
});

export const createScheduleTemplateSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(1000).nullable(),
    shifts: z.array(templateShiftInputSchema),
});

export const updateScheduleTemplateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
    shifts: z.array(templateShiftInputSchema).optional(),
});

// ===== AUDIT LOG SCHEMAS =====

export const auditLogInputSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    action: z.string().min(1, "Action is required"),
    entity: z.string().min(1, "Entity is required"),
    entityId: z.string().optional(),
    ipAddress: z.string().optional(),
});

export const auditLogsFilterSchema = z.object({
    userId: z.string().optional(),
    action: z.string().optional(),
    entity: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    limit: z.number().min(1).max(200).optional(),
    offset: z.number().min(0).optional(),
});

// ===== BILLING REVIEW SCHEMAS =====

export const createBillingReviewSchema = z.object({
    tripNumber: z.string().min(1, "Trip number is required").max(50),
    passengerName: z.string().max(200).optional(),
    tripDate: z.coerce.date().optional(),
    reason: z.enum([
        "EXTRA_WAITING_TIME", "EXTRA_STOPS", "ROUTE_CHANGE", "TOLL_FEES",
        "PARKING_FEES", "GRATUITY_ADJUSTMENT", "PRICE_CORRECTION",
        "NO_SHOW_CHARGE", "CANCELLATION_FEE", "DAMAGE_CHARGE",
        "AFFILIATE_BILLING", "OTHER",
    ]),
    reasonOther: z.string().max(500).optional(),
    amount: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
    shiftId: z.string().optional(),
    shiftReportId: z.string().optional(),
});

export const billingReviewOptionsSchema = z.object({
    status: z.enum(["PENDING", "IN_REVIEW", "RESOLVED"]).optional(),
    limit: z.number().min(1).max(200).optional(),
    offset: z.number().min(0).optional(),
    submittedById: z.string().optional(),
});

export const resolveBillingReviewSchema = z.object({
    reviewId: z.string().min(1, "Review ID is required"),
    resolution: z.string().min(1, "Resolution is required").max(2000),
    resolvedAmount: z.number().min(0).optional(),
    accountingNotes: z.string().max(2000).optional(),
});

// ===== SHIFT SWAP SCHEMAS =====

export const requestShiftSwapSchema = z.object({
    targetUserId: z.string().min(1, "Target user is required"),
    requesterShiftId: z.string().min(1, "Your shift is required"),
    targetShiftId: z.string().min(1, "Target shift is required"),
    reason: z.string().max(1000).optional(),
});

export const respondToSwapSchema = z.object({
    id: z.string().min(1, "Swap request ID is required"),
    accept: z.boolean(),
    response: z.string().max(1000).optional(),
});

// ===== TIME OFF SCHEMAS =====

export const requestTimeOffSchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(1, "Reason is required").max(1000),
    type: z.enum(["VACATION", "SICK", "PERSONAL", "OTHER"]),
});

export const timeOffFiltersSchema = z.object({
    status: z.string().optional(),
    userId: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

// ===== USER MANAGEMENT SCHEMAS =====

export const changeUserRoleSchema = z.object({
    id: z.string().min(1, "User ID is required"),
    newRole: z.enum(["ADMIN", "DISPATCHER"]),
});

export const adminResetPasswordSchema = z.object({
    id: z.string().min(1, "User ID is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

// ===== NETWORK PARTNER SCHEMAS =====

export const createNetworkPartnerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email"),
    phone: z.string().max(20).optional(),
    type: z.enum(["FARM_IN", "FARM_OUT", "IOS", "HOUSE_CHAUFFEUR"]),
    state: z.string().max(50).optional(),
    cities: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional(),
    cityTransferRate: z.string().max(50).optional(),
    market: z.string().max(100).optional(),
    employeeId: z.string().max(50).optional(),
    submittedById: z.string().min(1, "Submitted by ID is required"),
});

export const updateNetworkPartnerSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    state: z.string().max(50).optional(),
    cities: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional(),
    cityTransferRate: z.string().max(50).optional(),
    market: z.string().max(100).optional(),
    employeeId: z.string().max(50).optional(),
    isActive: z.boolean().optional(),
});

export const createQuickContactSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone: z.string().min(10, "Invalid phone number").max(20),
    email: z.string().email().optional().or(z.literal("")),
    notes: z.string().max(2000).optional(),
});

export const createPartnerAttachmentSchema = z.object({
    affiliateId: z.string().min(1, "Partner ID is required"),
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(1000).optional(),
    documentType: z.string().max(100).optional(),
    fileUrl: z.string().min(1, "File URL is required").max(500),
    fileName: z.string().min(1, "File name is required").max(200),
    fileSize: z.number().optional(),
    mimeType: z.string().max(100).optional(),
});

// ===== TRIP CONFIRMATION SCHEMAS =====

export const completeConfirmationSchema = z.object({
    confirmationId: z.string().min(1, "Confirmation ID is required"),
    status: z.enum(["PENDING", "CONFIRMED", "NO_ANSWER", "CANCELLED", "EXPIRED"]),
    notes: z.string().max(1000).optional(),
});

export const confirmationFiltersSchema = z.object({
    status: z.enum(["PENDING", "CONFIRMED", "NO_ANSWER", "CANCELLED", "EXPIRED", "ALL"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    dispatcherId: z.string().optional(),
    search: z.string().max(200).optional(),
    limit: z.number().min(1).max(500).optional(),
    offset: z.number().min(0).optional(),
});

export const confirmationTabDataSchema = z.object({
    tab: z.enum(["overview", "dispatchers", "accountability"]),
    days: z.number().min(1).max(365).optional(),
});

// ===== SHIFT REPORT EXTENDED SCHEMAS =====

export const reviewShiftReportSchema = z.object({
    reportId: z.string().min(1, "Report ID is required"),
    performanceScore: z.number().min(0).max(10).optional(),
    adminFeedback: z.string().max(2000).optional(),
    status: z.enum(["REVIEWED", "FLAGGED"]).optional(),
});

export const shiftReportFiltersSchema = z.object({
    userId: z.string().optional(),
    status: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    limit: z.number().min(1).max(500).optional(),
    offset: z.number().min(0).optional(),
});

// ===== ROUTE PRICING EXTENDED SCHEMAS =====

export const routePriceSearchParamsSchema = z.object({
    zoneFrom: z.string().max(200).optional(),
    zoneTo: z.string().max(200).optional(),
    vehicleCode: z.string().max(50).optional(),
    limit: z.number().min(1).max(100).optional(),
});

export const zoneSuggestionsSchema = z.object({
    query: z.string().min(2).max(200),
    type: z.enum(["from", "to"]),
    limit: z.number().min(1).max(100).optional(),
});

export const routePriceBatchSchema = z.object({
    batchNumber: z.number().min(0),
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
export type UpdatePresenceInput = z.infer<typeof updatePresenceSchema>;
export type UpdateSMSContactInput = z.infer<typeof updateSMSContactSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateDetailedRequestInput = z.infer<typeof createDetailedRequestSchema>;
export type CreateAdminTaskInput = z.infer<typeof createAdminTaskSchema>;
export type UpdateAdminTaskInput = z.infer<typeof updateAdminTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type CreatePermitInput = z.infer<typeof createPermitSchema>;
export type CreateInsuranceInput = z.infer<typeof createInsuranceSchema>;
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type CreateVehicleDocumentInput = z.infer<typeof createVehicleDocumentSchema>;
export type DriverVehicleInput = z.infer<typeof driverVehicleSchema>;
export type SchedulePreferencesInput = z.infer<typeof schedulePreferencesSchema>;
export type VehicleAssignmentInput = z.infer<typeof vehicleAssignmentSchema>;
export type PricingInput = z.infer<typeof pricingInputSchema>;
export type RoutePriceInput = z.infer<typeof routePriceInputSchema>;

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

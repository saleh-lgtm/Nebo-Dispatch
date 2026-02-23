"use server";

import twilio from "twilio";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Initialize Twilio client lazily to catch initialization errors
let client: ReturnType<typeof twilio> | null = null;

function getClient() {
    if (!client) {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            throw new Error("Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
        }
        client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    }
    return client;
}

// Read at runtime, not module load time
function getTwilioPhoneNumber(): string {
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!phoneNumber) {
        throw new Error("TWILIO_PHONE_NUMBER environment variable is not set");
    }
    return phoneNumber;
}

// Message templates (internal use only, not exported to avoid "use server" issues)
const SMS_TEMPLATES = {
    RESERVATION_CONFIRMATION: (details: { name: string; date: string; time: string; pickup: string }) =>
        `Hi ${details.name}, your ride is confirmed for ${details.date} at ${details.time}. Pickup: ${details.pickup}. Reply HELP for assistance.`,

    DRIVER_ASSIGNMENT: (details: { driverName: string; pickup: string; time: string }) =>
        `New trip assigned: Pickup at ${details.pickup} at ${details.time}. Check your app for details.`,

    RIDE_REMINDER: (details: { name: string; time: string; pickup: string }) =>
        `Reminder: Your ride is scheduled for today at ${details.time}. Pickup: ${details.pickup}. Please be ready 5 min early.`,

    DRIVER_EN_ROUTE: (details: { name: string; driverName: string; eta: string }) =>
        `Hi ${details.name}, your driver ${details.driverName} is on the way. ETA: ${details.eta}. Track your ride in the app.`,

    DRIVER_ARRIVED: (details: { name: string; driverName: string; vehicle: string }) =>
        `Hi ${details.name}, your driver ${details.driverName} has arrived. Vehicle: ${details.vehicle}. Please proceed to pickup.`,

    RIDE_COMPLETED: (details: { name: string }) =>
        `Thank you for riding with Nebo Rides, ${details.name}! We appreciate your business.`,

    CANCELLATION: (details: { name: string; date: string; time: string }) =>
        `Hi ${details.name}, your ride scheduled for ${details.date} at ${details.time} has been cancelled. Contact us if you have questions.`,
};

// Calculate message segments (for cost estimation)
function calculateSegments(message: string): number {
    // GSM-7: 160 chars per segment, UCS-2: 70 chars per segment
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const charsPerSegment = hasUnicode ? 70 : 160;
    return Math.ceil(message.length / charsPerSegment);
}

// Check if a phone number has opted out
async function isOptedOut(phoneNumber: string): Promise<boolean> {
    const optOut = await prisma.sMSOptOut.findUnique({
        where: { phoneNumber },
    });
    // User is opted out if record exists AND optedInAt is null or before optedOutAt
    if (!optOut || !optOut.optedOutAt) return false;
    if (!optOut.optedInAt) return true;
    return optOut.optedOutAt > optOut.optedInAt;
}

// Send a single SMS
export async function sendSMS(to: string, message: string) {
    const session = await requireAuth();

    // Validate and format phone number
    let formattedPhone: string;
    try {
        formattedPhone = formatPhoneNumber(to);
    } catch {
        return {
            success: false,
            error: "Invalid phone number format. Must be a valid E.164 number (e.g., +1234567890).",
        };
    }

    // Check opt-out status
    if (await isOptedOut(formattedPhone)) {
        console.warn(`SMS blocked: ${formattedPhone} has opted out`);
        return {
            success: false,
            error: "This number has opted out of SMS messages. They can reply START to resubscribe.",
        };
    }

    // Calculate segments and warn if multi-segment
    const segments = calculateSegments(message);
    if (segments > 1) {
        console.info(`SMS to ${formattedPhone} will be sent as ${segments} segments (longer messages cost more)`);
    }

    // Get status callback URL from environment
    const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;

    try {
        const twilioPhoneNumber = getTwilioPhoneNumber();
        const twilioClient = getClient();
        const formattedFrom = formatPhoneNumber(twilioPhoneNumber);
        const result = await twilioClient.messages.create({
            body: message,
            from: formattedFrom,
            to: formattedPhone,
            ...(statusCallbackUrl && { statusCallback: statusCallbackUrl }),
        });

        // Log the SMS
        await logSMS({
            to: formattedPhone,
            message,
            status: result.status,
            messageSid: result.sid,
            segments: result.numSegments ? parseInt(result.numSegments) : segments,
            sentById: session.user.id,
        });

        return {
            success: true,
            messageSid: result.sid,
            status: result.status,
            segments: result.numSegments || segments,
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to send SMS:", errorMessage);

        await logSMS({
            to: formattedPhone,
            message,
            status: "failed",
            error: errorMessage,
            sentById: session.user.id,
        });

        return {
            success: false,
            error: errorMessage,
        };
    }
}

// Send bulk SMS to multiple recipients
export async function sendBulkSMS(recipients: { phone: string; message: string }[]) {
    const session = await requireAdmin();

    const results = await Promise.allSettled(
        recipients.map(({ phone, message }) => sendSMS(phone, message))
    );

    const successful = results.filter(r => r.status === "fulfilled" && (r.value as { success: boolean }).success).length;
    const failed = results.length - successful;

    await createAuditLog(
        session.user.id,
        "CREATE",
        "SMS",
        "bulk",
        { totalSent: successful, totalFailed: failed }
    );

    return {
        total: results.length,
        successful,
        failed,
        results: results.map((r, i) => ({
            phone: recipients[i].phone,
            ...(r.status === "fulfilled" ? r.value : { success: false, error: "Failed" }),
        })),
    };
}

// Send reservation confirmation SMS
export async function sendReservationConfirmation(
    phone: string,
    details: { name: string; date: string; time: string; pickup: string }
) {
    const message = SMS_TEMPLATES.RESERVATION_CONFIRMATION(details);
    return sendSMS(phone, message);
}

// Send driver assignment notification
export async function sendDriverAssignment(
    driverPhone: string,
    details: { driverName: string; pickup: string; time: string }
) {
    const message = SMS_TEMPLATES.DRIVER_ASSIGNMENT(details);
    return sendSMS(driverPhone, message);
}

// Send ride reminder
export async function sendRideReminder(
    phone: string,
    details: { name: string; time: string; pickup: string }
) {
    const message = SMS_TEMPLATES.RIDE_REMINDER(details);
    return sendSMS(phone, message);
}

// Send driver en route notification
export async function sendDriverEnRoute(
    phone: string,
    details: { name: string; driverName: string; eta: string }
) {
    const message = SMS_TEMPLATES.DRIVER_EN_ROUTE(details);
    return sendSMS(phone, message);
}

// Send driver arrived notification
export async function sendDriverArrived(
    phone: string,
    details: { name: string; driverName: string; vehicle: string }
) {
    const message = SMS_TEMPLATES.DRIVER_ARRIVED(details);
    return sendSMS(phone, message);
}

// Send ride completed notification
export async function sendRideCompleted(phone: string, details: { name: string }) {
    const message = SMS_TEMPLATES.RIDE_COMPLETED(details);
    return sendSMS(phone, message);
}

// Send cancellation notification
export async function sendCancellation(
    phone: string,
    details: { name: string; date: string; time: string }
) {
    const message = SMS_TEMPLATES.CANCELLATION(details);
    return sendSMS(phone, message);
}

// Send custom SMS (admin only)
export async function sendCustomSMS(phone: string, message: string) {
    try {
        await requireAdmin();
        return await sendSMS(phone, message);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("sendCustomSMS error:", error);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

// Get SMS history
export async function getSMSHistory(options?: {
    limit?: number;
    offset?: number;
    status?: string;
}) {
    await requireAdmin();

    const { limit = 50, offset = 0, status } = options || {};

    const where: { status?: string } = {};
    if (status) {
        where.status = status;
    }

    const [logs, total] = await Promise.all([
        prisma.sMSLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
            include: {
                sentBy: { select: { id: true, name: true } },
            },
        }),
        prisma.sMSLog.count({ where }),
    ]);

    return { logs, total };
}

// Get SMS statistics
export async function getSMSStats() {
    await requireAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [todayCount, monthCount, totalSegments, failedCount] = await Promise.all([
        prisma.sMSLog.count({
            where: { createdAt: { gte: today } },
        }),
        prisma.sMSLog.count({
            where: { createdAt: { gte: thisMonth } },
        }),
        prisma.sMSLog.aggregate({
            _sum: { segments: true },
            where: { createdAt: { gte: thisMonth } },
        }),
        prisma.sMSLog.count({
            where: { status: "failed", createdAt: { gte: thisMonth } },
        }),
    ]);

    const estimatedCost = (totalSegments._sum.segments || 0) * 0.0079;

    return {
        todayCount,
        monthCount,
        totalSegments: totalSegments._sum.segments || 0,
        failedCount,
        estimatedCost: estimatedCost.toFixed(2),
    };
}

// Validate E.164 phone number format
function validateE164(phone: string): boolean {
    const pattern = /^\+[1-9]\d{1,14}$/;
    return pattern.test(phone);
}

// Helper: Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");

    let formatted: string;

    // If it's a 10-digit US number, add +1
    if (digits.length === 10) {
        formatted = `+1${digits}`;
    }
    // If it already has country code
    else if (digits.length === 11 && digits.startsWith("1")) {
        formatted = `+${digits}`;
    }
    // If it already starts with +, use as-is
    else if (phone.startsWith("+")) {
        formatted = phone;
    }
    // Default: assume US and add +1
    else {
        formatted = `+1${digits}`;
    }

    // Validate the formatted number
    if (!validateE164(formatted)) {
        throw new Error(`Invalid phone number format: ${phone}. Must be a valid E.164 number.`);
    }

    return formatted;
}

// Helper: Log SMS to database
async function logSMS(data: {
    to: string;
    from?: string;
    message: string;
    status: string;
    messageSid?: string;
    segments?: number;
    error?: string;
    sentById?: string;
}) {
    try {
        // Normalize phone number for conversation threading
        const conversationPhone = formatPhoneNumber(data.to);

        await prisma.sMSLog.create({
            data: {
                direction: "OUTBOUND",
                from: data.from,
                to: data.to,
                message: data.message,
                status: data.status,
                messageSid: data.messageSid,
                segments: data.segments || 1,
                error: data.error,
                sentById: data.sentById,
                conversationPhone: conversationPhone,
            },
        });
    } catch (e) {
        console.error("Failed to log SMS:", e);
    }
}

// Get list of unique conversations (grouped by phone number)
export async function getConversations(options?: {
    limit?: number;
    offset?: number;
}) {
    await requireAuth();

    const { limit = 50, offset = 0 } = options || {};

    // Get distinct conversation phones with the latest message
    const conversations = await prisma.$queryRaw<
        Array<{
            conversationPhone: string;
            lastMessage: string;
            lastMessageAt: Date;
            messageCount: bigint;
            unreadCount: bigint;
        }>
    >`
        SELECT
            "conversationPhone",
            (SELECT message FROM "SMSLog" s2 WHERE s2."conversationPhone" = s1."conversationPhone" ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage",
            MAX("createdAt") as "lastMessageAt",
            COUNT(*) as "messageCount",
            COUNT(*) FILTER (WHERE direction = 'INBOUND' AND status = 'received') as "unreadCount"
        FROM "SMSLog" s1
        WHERE "conversationPhone" IS NOT NULL
        GROUP BY "conversationPhone"
        ORDER BY MAX("createdAt") DESC
        LIMIT ${limit}
        OFFSET ${offset}
    `;

    // Convert BigInt to number for JSON serialization
    const formattedConversations = conversations.map(conv => ({
        ...conv,
        messageCount: Number(conv.messageCount),
        unreadCount: Number(conv.unreadCount),
    }));

    const total = await prisma.sMSLog.groupBy({
        by: ["conversationPhone"],
        where: { conversationPhone: { not: null } },
    });

    return { conversations: formattedConversations, total: total.length };
}

// Get messages for a specific conversation (by phone number)
export async function getConversationMessages(
    phoneNumber: string,
    options?: { limit?: number; offset?: number }
) {
    await requireAuth();

    const { limit = 100, offset = 0 } = options || {};

    // Normalize the phone number
    const normalizedPhone = formatPhoneNumber(phoneNumber);

    const messages = await prisma.sMSLog.findMany({
        where: {
            conversationPhone: normalizedPhone,
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
        include: {
            sentBy: { select: { id: true, name: true } },
        },
    });

    const total = await prisma.sMSLog.count({
        where: { conversationPhone: normalizedPhone },
    });

    return { messages, total };
}

// Send SMS within a conversation (for the chat UI)
export async function sendConversationSMS(phoneNumber: string, message: string) {
    const session = await requireAuth();

    // Validate and format phone number
    let normalizedPhone: string;
    try {
        normalizedPhone = formatPhoneNumber(phoneNumber);
    } catch {
        return {
            success: false,
            error: "Invalid phone number format. Must be a valid E.164 number (e.g., +1234567890).",
        };
    }

    // Check opt-out status
    if (await isOptedOut(normalizedPhone)) {
        return {
            success: false,
            error: "This number has opted out of SMS messages. They can reply START to resubscribe.",
        };
    }

    // Calculate segments
    const segments = calculateSegments(message);

    // Get status callback URL from environment
    const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;

    try {
        const twilioPhoneNumber = getTwilioPhoneNumber();
        const twilioClient = getClient();
        const formattedFrom = formatPhoneNumber(twilioPhoneNumber);

        const result = await twilioClient.messages.create({
            body: message,
            from: formattedFrom,
            to: normalizedPhone,
            ...(statusCallbackUrl && { statusCallback: statusCallbackUrl }),
        });

        // Log with conversation phone
        await prisma.sMSLog.create({
            data: {
                direction: "OUTBOUND",
                from: formattedFrom,
                to: normalizedPhone,
                message: message,
                status: result.status,
                messageSid: result.sid,
                segments: result.numSegments ? parseInt(result.numSegments) : segments,
                sentById: session.user.id,
                conversationPhone: normalizedPhone,
            },
        });

        return {
            success: true,
            messageSid: result.sid,
            status: result.status,
            segments: result.numSegments || segments,
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to send SMS:", errorMessage);

        return {
            success: false,
            error: errorMessage,
        };
    }
}

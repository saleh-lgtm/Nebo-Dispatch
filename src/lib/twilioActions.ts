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

// Send a single SMS
export async function sendSMS(to: string, message: string) {
    const session = await requireAuth();

    // Format phone number (ensure it starts with +1 for US)
    const formattedPhone = formatPhoneNumber(to);

    try {
        const twilioPhoneNumber = getTwilioPhoneNumber();
        const twilioClient = getClient();
        const formattedFrom = formatPhoneNumber(twilioPhoneNumber);
        const result = await twilioClient.messages.create({
            body: message,
            from: formattedFrom,
            to: formattedPhone,
        });

        // Log the SMS
        await logSMS({
            to: formattedPhone,
            message,
            status: result.status,
            messageSid: result.sid,
            segments: result.numSegments ? parseInt(result.numSegments) : 1,
            sentById: session.user.id,
        });

        return {
            success: true,
            messageSid: result.sid,
            status: result.status,
            segments: result.numSegments,
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

// Helper: Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");

    // If it's a 10-digit US number, add +1
    if (digits.length === 10) {
        return `+1${digits}`;
    }

    // If it already has country code
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }

    // If it already starts with +, return as-is
    if (phone.startsWith("+")) {
        return phone;
    }

    // Default: assume US and add +1
    return `+1${digits}`;
}

// Helper: Log SMS to database
async function logSMS(data: {
    to: string;
    message: string;
    status: string;
    messageSid?: string;
    segments?: number;
    error?: string;
    sentById?: string;
}) {
    try {
        await prisma.sMSLog.create({
            data: {
                to: data.to,
                message: data.message,
                status: data.status,
                messageSid: data.messageSid,
                segments: data.segments || 1,
                error: data.error,
                sentById: data.sentById,
            },
        });
    } catch (e) {
        console.error("Failed to log SMS:", e);
    }
}

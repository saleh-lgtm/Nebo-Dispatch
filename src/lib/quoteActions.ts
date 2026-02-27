"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { QuoteStatus, QuoteOutcome, QuoteActionType, Prisma } from "@prisma/client";

// 72 hours in milliseconds
const QUOTE_EXPIRATION_HOURS = 72;
const QUOTE_EXPIRATION_MS = QUOTE_EXPIRATION_HOURS * 60 * 60 * 1000;

export interface CreateQuoteData {
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    serviceType: string;
    source?: string; // Where the lead came from
    dateOfService?: Date; // When the service is needed
    pickupDate?: Date;
    pickupLocation?: string;
    dropoffLocation?: string;
    estimatedAmount?: number;
    notes?: string;
    shiftId?: string;
}

export async function createQuote(data: CreateQuoteData) {
    const session = await requireAuth();

    // Auto-detect active shift if not provided
    let shiftId = data.shiftId;
    if (!shiftId) {
        const activeShift = await prisma.shift.findFirst({
            where: {
                userId: session.user.id,
                clockOut: null,
            },
        });
        shiftId = activeShift?.id;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + QUOTE_EXPIRATION_MS);

    const quote = await prisma.quote.create({
        data: {
            clientName: data.clientName,
            clientEmail: data.clientEmail,
            clientPhone: data.clientPhone,
            serviceType: data.serviceType,
            source: data.source,
            dateOfService: data.dateOfService,
            pickupDate: data.pickupDate,
            pickupLocation: data.pickupLocation,
            dropoffLocation: data.dropoffLocation,
            estimatedAmount: data.estimatedAmount,
            notes: data.notes,
            createdById: session.user.id,
            assignedToId: session.user.id,
            nextFollowUp: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Follow up in 24h
            expiresAt,
            lastActionAt: now,
            actionCount: 1,
            shiftId,
            // Create the initial "CREATED" action
            actions: {
                create: {
                    userId: session.user.id,
                    actionType: "CREATED",
                    notes: `Quote created for ${data.clientName}`,
                },
            },
        },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "Quote",
        quote.id,
        { clientName: data.clientName, serviceType: data.serviceType, source: data.source, shiftId }
    );

    revalidatePath("/dashboard");
    return quote;
}

// Get quotes created during a specific shift
export async function getShiftQuotes(shiftId: string) {
    await requireAuth();

    return prisma.quote.findMany({
        where: { shiftId },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
    });
}

export async function getQuotes(options?: {
    status?: QuoteStatus[];
    assignedToId?: string;
    limit?: number;
    includeExpired?: boolean;
}) {
    await requireAuth();

    return prisma.quote.findMany({
        where: {
            status: options?.status ? { in: options.status } : undefined,
            assignedToId: options?.assignedToId,
        },
        include: {
            createdBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
            actions: {
                orderBy: { createdAt: "desc" },
                take: 5, // Last 5 actions
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [
            { nextFollowUp: "asc" },
            { createdAt: "desc" },
        ],
        take: options?.limit,
    });
}

export async function getPendingQuotes() {
    await requireAuth();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Read-only query - no writes on every page load
    const quotes = await prisma.quote.findMany({
        where: {
            status: { in: ["PENDING", "FOLLOWING_UP"] },
        },
        include: {
            createdBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
            actions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [
            { isFlagged: "desc" },
            { nextFollowUp: "asc" },
        ],
    });

    // Compute flags in-memory for display (avoids DB writes on every load)
    return quotes.map(quote => ({
        ...quote,
        // Show as flagged if no action in 24h
        isFlagged: quote.isFlagged || (quote.lastActionAt ? quote.lastActionAt < twentyFourHoursAgo : false),
    }));
}

// Get a single quote with full action history
export async function getQuoteWithHistory(quoteId: string) {
    await requireAuth();

    return prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
            createdBy: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            actions: {
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
        },
    });
}

// Record an action on a quote
export async function recordQuoteAction(
    quoteId: string,
    actionType: QuoteActionType,
    notes?: string,
    metadata?: Record<string, unknown>
) {
    const session = await requireAuth();
    const now = new Date();

    const [quote, action] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                lastActionAt: now,
                actionCount: { increment: 1 },
                isFlagged: false, // Clear flag when action is taken
                ...(actionType === "FOLLOW_UP" || actionType === "CALLED" || actionType === "EMAILED" || actionType === "TEXTED"
                    ? {
                          followUpCount: { increment: 1 },
                          lastFollowUp: now,
                          nextFollowUp: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                          status: "FOLLOWING_UP",
                      }
                    : {}),
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType,
                notes,
                metadata: metadata as Prisma.InputJsonValue | undefined,
            },
            include: {
                user: { select: { id: true, name: true } },
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "FOLLOW_UP",
        "Quote",
        quoteId,
        { actionType, notes }
    );

    revalidatePath("/dashboard");
    return { quote, action };
}

export async function recordFollowUp(
    quoteId: string,
    notes: string,
    actionType: QuoteActionType = "FOLLOW_UP",
    nextFollowUpDate?: Date
) {
    const session = await requireAuth();
    const now = new Date();

    const [quote, action] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                followUpCount: { increment: 1 },
                lastFollowUp: now,
                lastActionAt: now,
                actionCount: { increment: 1 },
                isFlagged: false,
                nextFollowUp: nextFollowUpDate || new Date(now.getTime() + 24 * 60 * 60 * 1000),
                followUpNotes: notes,
                status: "FOLLOWING_UP",
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType,
                notes,
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "FOLLOW_UP",
        "Quote",
        quoteId,
        { notes, followUpCount: quote.followUpCount, actionType }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function setQuoteOutcome(
    quoteId: string,
    outcome: QuoteOutcome,
    reason?: string
) {
    const session = await requireAuth();
    const now = new Date();

    const status: QuoteStatus = outcome === "WON" ? "CONVERTED" : "LOST";

    const [quote, action] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                outcome,
                outcomeReason: reason,
                outcomeAt: now,
                status,
                lastActionAt: now,
                actionCount: { increment: 1 },
                isFlagged: false,
                ...(outcome === "WON" ? { convertedAt: now } : {}),
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType: "OUTCOME_SET",
                notes: `Quote ${outcome === "WON" ? "won" : "lost"}${reason ? `: ${reason}` : ""}`,
                metadata: { outcome, reason },
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        outcome === "WON" ? "CONVERT" : "UPDATE_STATUS",
        "Quote",
        quoteId,
        { outcome, reason }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function convertQuote(quoteId: string, reservationId?: string) {
    const session = await requireAuth();
    const now = new Date();

    const [quote] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                status: "CONVERTED",
                outcome: "WON",
                outcomeAt: now,
                convertedAt: now,
                reservationId,
                lastActionAt: now,
                actionCount: { increment: 1 },
                isFlagged: false,
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType: "OUTCOME_SET",
                notes: `Quote converted to booking${reservationId ? ` (Reservation: ${reservationId})` : ""}`,
                metadata: { reservationId },
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "CONVERT",
        "Quote",
        quoteId,
        { reservationId }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function updateQuoteStatus(quoteId: string, status: QuoteStatus) {
    const session = await requireAuth();
    const now = new Date();

    const [quote] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                status,
                lastActionAt: now,
                actionCount: { increment: 1 },
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType: "STATUS_CHANGE",
                notes: `Status changed to ${status}`,
                metadata: { newStatus: status },
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "UPDATE_STATUS",
        "Quote",
        quoteId,
        { status }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function assignQuote(quoteId: string, userId: string) {
    const session = await requireAuth();

    // SECURITY: Only admins can reassign quotes to other users
    const allowedRoles = ["SUPER_ADMIN", "ADMIN"];
    if (!allowedRoles.includes(session.user.role || "")) {
        throw new Error("Unauthorized: Only administrators can reassign quotes");
    }

    const now = new Date();

    const assignee = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const [quote] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                assignedToId: userId,
                lastActionAt: now,
                actionCount: { increment: 1 },
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType: "REASSIGNED",
                notes: `Quote reassigned to ${assignee?.name || userId}`,
                metadata: { assignedTo: userId },
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "ASSIGN",
        "Quote",
        quoteId,
        { assignedTo: userId }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function addQuoteNote(quoteId: string, notes: string) {
    const session = await requireAuth();
    const now = new Date();

    const [quote, action] = await prisma.$transaction([
        prisma.quote.update({
            where: { id: quoteId },
            data: {
                lastActionAt: now,
                actionCount: { increment: 1 },
                isFlagged: false,
            },
        }),
        prisma.quoteAction.create({
            data: {
                quoteId,
                userId: session.user.id,
                actionType: "NOTE_ADDED",
                notes,
            },
            include: {
                user: { select: { id: true, name: true } },
            },
        }),
    ]);

    revalidatePath("/dashboard");
    return { quote, action };
}

export async function getQuoteStats() {
    await requireAuth();

    const now = new Date();

    const [pending, followingUp, converted, lost, expired, flagged] = await Promise.all([
        prisma.quote.count({ where: { status: "PENDING" } }),
        prisma.quote.count({ where: { status: "FOLLOWING_UP" } }),
        prisma.quote.count({ where: { status: "CONVERTED" } }),
        prisma.quote.count({ where: { status: "LOST" } }),
        prisma.quote.count({ where: { status: "EXPIRED" } }),
        prisma.quote.count({ where: { isFlagged: true, status: { in: ["PENDING", "FOLLOWING_UP"] } } }),
    ]);

    // Quotes expiring soon (within 24 hours)
    const expiringSoon = await prisma.quote.count({
        where: {
            status: { in: ["PENDING", "FOLLOWING_UP"] },
            expiresAt: {
                gt: now,
                lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
        },
    });

    return { pending, followingUp, converted, lost, expired, flagged, expiringSoon };
}

// Get quote performance metrics for analytics
export async function getQuoteAnalytics(dateRange?: { start: Date; end: Date }) {
    await requireAuth();

    const where = dateRange
        ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
        : {};

    const [
        totalQuotes,
        convertedQuotes,
        lostQuotes,
        avgActionsPerQuote,
    ] = await Promise.all([
        prisma.quote.count({ where }),
        prisma.quote.count({ where: { ...where, outcome: "WON" } }),
        prisma.quote.count({ where: { ...where, outcome: "LOST" } }),
        prisma.quote.aggregate({
            where,
            _avg: { actionCount: true },
        }),
    ]);

    const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0;

    return {
        totalQuotes,
        convertedQuotes,
        lostQuotes,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgActionsPerQuote: Math.round((avgActionsPerQuote._avg.actionCount || 0) * 10) / 10,
    };
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import {
    notifyTimeOffDecision,
    notifyAdminsOfPendingRequest,
} from "./notificationActions";

export type TimeOffType = "VACATION" | "SICK" | "PERSONAL" | "OTHER";

// Request time off
export async function requestTimeOff(
    startDate: Date,
    endDate: Date,
    reason: string,
    type: TimeOffType
) {
    const session = await requireAuth();

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
        throw new Error("Start date must be before end date");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
        throw new Error("Cannot request time off in the past");
    }

    const timeOffRequest = await prisma.timeOffRequest.create({
        data: {
            userId: session.user.id,
            startDate: start,
            endDate: end,
            reason,
            type,
            status: "PENDING",
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "TimeOffRequest",
        timeOffRequest.id,
        { startDate: start.toISOString(), endDate: end.toISOString(), type, reason }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    // Notify admins about the new time off request
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
    });
    await notifyAdminsOfPendingRequest(
        "TIME_OFF",
        timeOffRequest.id,
        user?.name || "A dispatcher"
    );

    return timeOffRequest;
}

// Get my time off requests
export async function getMyTimeOffRequests() {
    const session = await requireAuth();

    return await prisma.timeOffRequest.findMany({
        where: { userId: session.user.id },
        include: {
            reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}

// Get pending time off requests (admin only)
export async function getPendingTimeOffRequests() {
    await requireAdmin();

    return await prisma.timeOffRequest.findMany({
        where: { status: "PENDING" },
        include: {
            user: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
    });
}

// Get all time off requests with optional filters (admin only)
export async function getAllTimeOffRequests(filters?: {
    status?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
}) {
    await requireAdmin();

    const where: Record<string, unknown> = {};

    if (filters?.status) {
        where.status = filters.status;
    }
    if (filters?.userId) {
        where.userId = filters.userId;
    }
    if (filters?.startDate || filters?.endDate) {
        where.startDate = {};
        if (filters?.startDate) {
            (where.startDate as Record<string, Date>).gte = filters.startDate;
        }
        if (filters?.endDate) {
            (where.startDate as Record<string, Date>).lte = filters.endDate;
        }
    }

    return await prisma.timeOffRequest.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}

// Approve time off request (admin only)
export async function approveTimeOff(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const request = await prisma.timeOffRequest.findUnique({
        where: { id },
    });

    if (!request) {
        throw new Error("Time off request not found");
    }

    if (request.status !== "PENDING") {
        throw new Error("Can only approve pending requests");
    }

    const updated = await prisma.timeOffRequest.update({
        where: { id },
        data: {
            status: "APPROVED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
            adminNotes: adminNotes || undefined,
        },
        include: {
            user: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "APPROVE",
        "TimeOffRequest",
        id,
        { userId: request.userId, adminNotes }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    // Notify the user that their time off was approved
    await notifyTimeOffDecision(request.userId, id, true, adminNotes);

    return updated;
}

// Reject time off request (admin only)
export async function rejectTimeOff(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const request = await prisma.timeOffRequest.findUnique({
        where: { id },
    });

    if (!request) {
        throw new Error("Time off request not found");
    }

    if (request.status !== "PENDING") {
        throw new Error("Can only reject pending requests");
    }

    const updated = await prisma.timeOffRequest.update({
        where: { id },
        data: {
            status: "REJECTED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
            adminNotes: adminNotes || undefined,
        },
        include: {
            user: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "REJECT",
        "TimeOffRequest",
        id,
        { userId: request.userId, adminNotes }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    // Notify the user that their time off was rejected
    await notifyTimeOffDecision(request.userId, id, false, adminNotes);

    return updated;
}

// Cancel time off request (by the user who created it)
export async function cancelTimeOff(id: string) {
    const session = await requireAuth();

    const request = await prisma.timeOffRequest.findUnique({
        where: { id },
    });

    if (!request) {
        throw new Error("Time off request not found");
    }

    if (request.userId !== session.user.id) {
        throw new Error("You can only cancel your own requests");
    }

    if (request.status !== "PENDING") {
        throw new Error("Can only cancel pending requests");
    }

    const updated = await prisma.timeOffRequest.update({
        where: { id },
        data: {
            status: "CANCELLED",
        },
    });

    await createAuditLog(
        session.user.id,
        "CANCEL",
        "TimeOffRequest",
        id,
        { originalStatus: "PENDING" }
    );

    revalidatePath("/schedule");

    return updated;
}

// Get time off calendar - see who's off in a date range
export async function getTimeOffCalendar(startDate: Date, endDate: Date) {
    await requireAuth();

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all approved time off that overlaps with the date range
    const timeOffRequests = await prisma.timeOffRequest.findMany({
        where: {
            status: "APPROVED",
            OR: [
                {
                    // Time off starts within the range
                    startDate: {
                        gte: start,
                        lte: end,
                    },
                },
                {
                    // Time off ends within the range
                    endDate: {
                        gte: start,
                        lte: end,
                    },
                },
                {
                    // Time off spans the entire range
                    AND: [
                        { startDate: { lte: start } },
                        { endDate: { gte: end } },
                    ],
                },
            ],
        },
        include: {
            user: { select: { id: true, name: true } },
        },
        orderBy: { startDate: "asc" },
    });

    return timeOffRequests;
}

// Get time off statistics for a user
export async function getTimeOffStats(userId?: string) {
    const session = await requireAuth();
    const targetUserId = userId || session.user.id;

    // If requesting someone else's stats, require admin
    if (userId && userId !== session.user.id) {
        await requireAdmin();
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const requests = await prisma.timeOffRequest.findMany({
        where: {
            userId: targetUserId,
            startDate: { gte: yearStart },
            endDate: { lte: yearEnd },
        },
    });

    const stats = {
        pending: requests.filter(r => r.status === "PENDING").length,
        approved: requests.filter(r => r.status === "APPROVED").length,
        rejected: requests.filter(r => r.status === "REJECTED").length,
        cancelled: requests.filter(r => r.status === "CANCELLED").length,
        byType: {
            VACATION: requests.filter(r => r.type === "VACATION" && r.status === "APPROVED").length,
            SICK: requests.filter(r => r.type === "SICK" && r.status === "APPROVED").length,
            PERSONAL: requests.filter(r => r.type === "PERSONAL" && r.status === "APPROVED").length,
            OTHER: requests.filter(r => r.type === "OTHER" && r.status === "APPROVED").length,
        },
    };

    return stats;
}

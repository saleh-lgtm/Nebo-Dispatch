"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Get all requests for a specific user (user can only view their own)
export async function getUserRequests(userId: string) {
    const session = await requireAuth();

    // Users can only view their own requests (unless admin)
    if (session.user.id !== userId && session.user.role === "DISPATCHER") {
        throw new Error("Cannot view another user's requests");
    }

    return await prisma.schedulingRequest.findMany({
        where: { userId },
        include: {
            schedule: true,
            shift: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

// Create a detailed scheduling request
export async function createDetailedRequest(data: {
    userId: string;
    type: "HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW";
    reason: string;
    scheduleId?: string;
    requestedStart?: Date;
    requestedEnd?: Date;
}) {
    const session = await requireAuth();

    // Users can only create requests for themselves
    if (session.user.id !== data.userId) {
        throw new Error("Cannot create request for another user");
    }

    const request = await prisma.schedulingRequest.create({
        data: {
            userId: data.userId,
            type: data.type,
            reason: data.reason,
            scheduleId: data.scheduleId || null,
            requestedStart: data.requestedStart || null,
            requestedEnd: data.requestedEnd || null,
            status: "PENDING",
        },
        include: { schedule: true },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "SchedulingRequest",
        request.id,
        { type: data.type }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/requests");
    return request;
}

// Get upcoming published shifts for a dispatcher
export async function getUpcomingShifts(userId: string) {
    const session = await requireAuth();

    // Users can only view their own shifts (unless admin)
    if (session.user.id !== userId && session.user.role === "DISPATCHER") {
        throw new Error("Cannot view another user's shifts");
    }

    const now = new Date();
    return await prisma.schedule.findMany({
        where: {
            userId,
            isPublished: true,
            shiftStart: { gte: now },
        },
        orderBy: { shiftStart: "asc" },
        take: 20,
    });
}

// Get past shifts for history
export async function getPastShifts(userId: string) {
    const session = await requireAuth();

    // Users can only view their own shifts (unless admin)
    if (session.user.id !== userId && session.user.role === "DISPATCHER") {
        throw new Error("Cannot view another user's shifts");
    }

    const now = new Date();
    return await prisma.schedule.findMany({
        where: {
            userId,
            shiftEnd: { lt: now },
        },
        orderBy: { shiftStart: "desc" },
        take: 30,
    });
}

// Get current/active shift
export async function getCurrentShift(userId: string) {
    const session = await requireAuth();

    // Users can only view their own shifts (unless admin)
    if (session.user.id !== userId && session.user.role === "DISPATCHER") {
        throw new Error("Cannot view another user's shifts");
    }

    const now = new Date();
    return await prisma.schedule.findFirst({
        where: {
            userId,
            isPublished: true,
            shiftStart: { lte: now },
            shiftEnd: { gte: now },
        },
    });
}

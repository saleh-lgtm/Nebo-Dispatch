"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { createDetailedRequestSchema, userIdParamSchema } from "./schemas";

// Get all requests for a specific user (user can only view their own)
export async function getUserRequests(userId: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = userIdParamSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID", data: [] };
        }

        // Users can only view their own requests (unless admin)
        if (session.user.id !== userId && session.user.role === "DISPATCHER") {
            return { success: false, error: "Cannot view another user's requests", data: [] };
        }

        const requests = await prisma.schedulingRequest.findMany({
            where: { userId },
            include: {
                schedule: true,
                shift: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: requests };
    } catch (error) {
        console.error("getUserRequests error:", error);
        return { success: false, error: "Failed to get user requests", data: [] };
    }
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
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = createDetailedRequestSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Users can only create requests for themselves
        if (session.user.id !== data.userId) {
            return { success: false, error: "Cannot create request for another user" };
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
        return { success: true, data: request };
    } catch (error) {
        console.error("createDetailedRequest error:", error);
        return { success: false, error: "Failed to create request" };
    }
}

// Get upcoming published shifts for a dispatcher
export async function getUpcomingShifts(userId: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = userIdParamSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID", data: [] };
        }

        // Users can only view their own shifts (unless admin)
        if (session.user.id !== userId && session.user.role === "DISPATCHER") {
            return { success: false, error: "Cannot view another user's shifts", data: [] };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const shifts = await prisma.schedule.findMany({
            where: {
                userId,
                isPublished: true,
                date: { gte: today },
            },
            orderBy: [{ date: "asc" }, { startHour: "asc" }],
            take: 20,
        });

        return { success: true, data: shifts };
    } catch (error) {
        console.error("getUpcomingShifts error:", error);
        return { success: false, error: "Failed to get upcoming shifts", data: [] };
    }
}

// Get past shifts for history
export async function getPastShifts(userId: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = userIdParamSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID", data: [] };
        }

        // Users can only view their own shifts (unless admin)
        if (session.user.id !== userId && session.user.role === "DISPATCHER") {
            return { success: false, error: "Cannot view another user's shifts", data: [] };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const shifts = await prisma.schedule.findMany({
            where: {
                userId,
                date: { lt: today },
            },
            orderBy: [{ date: "desc" }, { startHour: "desc" }],
            take: 30,
        });

        return { success: true, data: shifts };
    } catch (error) {
        console.error("getPastShifts error:", error);
        return { success: false, error: "Failed to get past shifts", data: [] };
    }
}

// Get current/active shift
export async function getCurrentShift(userId: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = userIdParamSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID", data: null };
        }

        // Users can only view their own shifts (unless admin)
        if (session.user.id !== userId && session.user.role === "DISPATCHER") {
            return { success: false, error: "Cannot view another user's shifts", data: null };
        }

        // Get today's schedule as "current" (simplified - actual current check would need hour comparison)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const shift = await prisma.schedule.findFirst({
            where: {
                userId,
                isPublished: true,
                date: today,
            },
            orderBy: { startHour: "asc" },
        });

        return { success: true, data: shift };
    } catch (error) {
        console.error("getCurrentShift error:", error);
        return { success: false, error: "Failed to get current shift", data: null };
    }
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Time off types
export type TimeOffType = "vacation" | "sick" | "personal" | "other";

// Submit a time off request (any authenticated user)
export async function submitTimeOffRequest(data: {
    startDate: Date;
    endDate: Date;
    timeOffType: TimeOffType;
    reason: string;
}) {
    const session = await requireAuth();

    // Validate dates
    if (data.endDate < data.startDate) {
        throw new Error("End date must be after start date");
    }

    const request = await prisma.schedulingRequest.create({
        data: {
            userId: session.user.id,
            type: "TIME_OFF",
            requestedStart: data.startDate,
            requestedEnd: data.endDate,
            timeOffType: data.timeOffType,
            reason: data.reason,
            status: "PENDING",
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "SchedulingRequest",
        request.id,
        { type: "TIME_OFF", timeOffType: data.timeOffType }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/requests");
    return request;
}

// Get user's time off requests
export async function getMyTimeOffRequests() {
    const session = await requireAuth();

    return await prisma.schedulingRequest.findMany({
        where: {
            userId: session.user.id,
            type: "TIME_OFF",
        },
        orderBy: { createdAt: "desc" },
    });
}

// Submit a shift swap request
export async function submitShiftSwapRequest(data: {
    scheduleId: string;
    targetUserId: string;
    targetScheduleId: string;
    reason: string;
}) {
    const session = await requireAuth();

    // Verify both schedules exist
    const [mySchedule, targetSchedule] = await Promise.all([
        prisma.schedule.findUnique({ where: { id: data.scheduleId } }),
        prisma.schedule.findUnique({ where: { id: data.targetScheduleId } }),
    ]);

    if (!mySchedule || !targetSchedule) {
        throw new Error("One or both schedules not found");
    }

    // Verify ownership
    if (mySchedule.userId !== session.user.id) {
        throw new Error("You can only swap your own shifts");
    }

    if (targetSchedule.userId !== data.targetUserId) {
        throw new Error("Target schedule doesn't belong to the target user");
    }

    const request = await prisma.schedulingRequest.create({
        data: {
            userId: session.user.id,
            type: "SHIFT_SWAP",
            scheduleId: data.scheduleId,
            targetUserId: data.targetUserId,
            targetScheduleId: data.targetScheduleId,
            reason: data.reason,
            status: "PENDING",
            targetAccepted: null,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "SchedulingRequest",
        request.id,
        { type: "SHIFT_SWAP", targetUserId: data.targetUserId }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/requests");
    return request;
}

// Get incoming swap requests for current user
export async function getIncomingSwapRequests() {
    const session = await requireAuth();

    return await prisma.schedulingRequest.findMany({
        where: {
            type: "SHIFT_SWAP",
            targetUserId: session.user.id,
            status: "PENDING",
            targetAccepted: null,
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            schedule: true,
            targetSchedule: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

// Get outgoing swap requests for current user
export async function getOutgoingSwapRequests() {
    const session = await requireAuth();

    return await prisma.schedulingRequest.findMany({
        where: {
            type: "SHIFT_SWAP",
            userId: session.user.id,
        },
        include: {
            targetUser: { select: { id: true, name: true, email: true } },
            schedule: true,
            targetSchedule: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

// Target user accepts or rejects a swap request
export async function respondToSwapRequest(requestId: string, accept: boolean) {
    const session = await requireAuth();

    const request = await prisma.schedulingRequest.findUnique({
        where: { id: requestId },
    });

    if (!request) {
        throw new Error("Request not found");
    }

    if (request.targetUserId !== session.user.id) {
        throw new Error("You are not the target of this swap request");
    }

    if (request.targetAccepted !== null) {
        throw new Error("You have already responded to this request");
    }

    const updated = await prisma.schedulingRequest.update({
        where: { id: requestId },
        data: {
            targetAccepted: accept,
            // If rejected by target, auto-reject the whole request
            status: accept ? "PENDING" : "REJECTED",
            adminNotes: accept ? null : "Rejected by target user",
        },
    });

    await createAuditLog(
        session.user.id,
        accept ? "APPROVE" : "REJECT",
        "SchedulingRequest",
        requestId,
        { type: "SHIFT_SWAP_RESPONSE", accepted: accept }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/requests");
    return updated;
}

// Admin approves a shift swap (performs the actual swap)
export async function approveShiftSwap(requestId: string, adminNotes?: string) {
    const session = await requireAdmin();

    const request = await prisma.schedulingRequest.findUnique({
        where: { id: requestId },
        include: { schedule: true, targetSchedule: true },
    });

    if (!request) {
        throw new Error("Request not found");
    }

    if (request.type !== "SHIFT_SWAP") {
        throw new Error("This is not a shift swap request");
    }

    if (!request.targetAccepted) {
        throw new Error("Target user has not accepted this swap yet");
    }

    // Perform the swap - exchange userIds on the schedules
    await prisma.$transaction([
        prisma.schedule.update({
            where: { id: request.scheduleId! },
            data: { userId: request.targetUserId! },
        }),
        prisma.schedule.update({
            where: { id: request.targetScheduleId! },
            data: { userId: request.userId },
        }),
        prisma.schedulingRequest.update({
            where: { id: requestId },
            data: {
                status: "APPROVED",
                adminNotes: adminNotes || "Shift swap completed",
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "APPROVE",
        "SchedulingRequest",
        requestId,
        { type: "SHIFT_SWAP_COMPLETE", adminNotes }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");
    revalidatePath("/admin/requests");
}

// Get time off and swap request statistics (admin)
export async function getTimeOffStats() {
    await requireAdmin();

    const [pendingTimeOff, pendingSwaps, approvedTimeOff, totalTimeOff] = await Promise.all([
        prisma.schedulingRequest.count({
            where: { type: "TIME_OFF", status: "PENDING" },
        }),
        prisma.schedulingRequest.count({
            where: { type: "SHIFT_SWAP", status: "PENDING", targetAccepted: true },
        }),
        prisma.schedulingRequest.count({
            where: { type: "TIME_OFF", status: "APPROVED" },
        }),
        prisma.schedulingRequest.count({
            where: { type: "TIME_OFF" },
        }),
    ]);

    return {
        pendingTimeOff,
        pendingSwaps,
        approvedTimeOff,
        totalTimeOff,
    };
}

// Get all time off requests for a date range (admin)
export async function getTimeOffCalendar(startDate: Date, endDate: Date) {
    await requireAdmin();

    return await prisma.schedulingRequest.findMany({
        where: {
            type: "TIME_OFF",
            status: "APPROVED",
            requestedStart: { lte: endDate },
            requestedEnd: { gte: startDate },
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { requestedStart: "asc" },
    });
}

// Cancel a time off or swap request (user can cancel their own pending requests)
export async function cancelMyRequest(requestId: string) {
    const session = await requireAuth();

    const request = await prisma.schedulingRequest.findUnique({
        where: { id: requestId },
    });

    if (!request) {
        throw new Error("Request not found");
    }

    if (request.userId !== session.user.id) {
        throw new Error("You can only cancel your own requests");
    }

    if (request.status !== "PENDING") {
        throw new Error("Can only cancel pending requests");
    }

    await prisma.schedulingRequest.delete({
        where: { id: requestId },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "SchedulingRequest",
        requestId,
        { type: request.type, reason: "User cancelled" }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/requests");
}

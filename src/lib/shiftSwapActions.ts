"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Request a shift swap
export async function requestShiftSwap(
    targetUserId: string,
    requesterShiftId: string,
    targetShiftId: string,
    reason?: string
) {
    const session = await requireAuth();

    // Cannot swap with yourself
    if (targetUserId === session.user.id) {
        throw new Error("Cannot request a swap with yourself");
    }

    // Verify both schedules exist and are owned by the correct users
    const [requesterShift, targetShift] = await Promise.all([
        prisma.schedule.findUnique({
            where: { id: requesterShiftId },
            include: { user: { select: { id: true, name: true } } },
        }),
        prisma.schedule.findUnique({
            where: { id: targetShiftId },
            include: { user: { select: { id: true, name: true } } },
        }),
    ]);

    if (!requesterShift) {
        throw new Error("Your shift not found");
    }

    if (!targetShift) {
        throw new Error("Target shift not found");
    }

    if (requesterShift.userId !== session.user.id) {
        throw new Error("You can only offer your own shifts for swap");
    }

    if (targetShift.userId !== targetUserId) {
        throw new Error("Target shift does not belong to the target user");
    }

    // Check if there's already a pending swap request for these shifts
    const existingRequest = await prisma.shiftSwapRequest.findFirst({
        where: {
            OR: [
                {
                    requesterShiftId,
                    targetShiftId,
                    status: { in: ["PENDING_TARGET", "PENDING_ADMIN"] },
                },
                {
                    requesterShiftId: targetShiftId,
                    targetShiftId: requesterShiftId,
                    status: { in: ["PENDING_TARGET", "PENDING_ADMIN"] },
                },
            ],
        },
    });

    if (existingRequest) {
        throw new Error("There is already a pending swap request for these shifts");
    }

    const swapRequest = await prisma.shiftSwapRequest.create({
        data: {
            requesterId: session.user.id,
            targetUserId,
            requesterShiftId,
            targetShiftId,
            reason: reason || null,
            status: "PENDING_TARGET",
        },
        include: {
            requester: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true } },
            requesterShift: true,
            targetShift: true,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "ShiftSwapRequest",
        swapRequest.id,
        {
            targetUserId,
            requesterShiftId,
            targetShiftId,
            reason,
        }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    return swapRequest;
}

// Get my swap requests (both made and received)
export async function getMySwapRequests() {
    const session = await requireAuth();

    const [madeRequests, receivedRequests] = await Promise.all([
        // Requests I made
        prisma.shiftSwapRequest.findMany({
            where: { requesterId: session.user.id },
            include: {
                targetUser: { select: { id: true, name: true } },
                requesterShift: true,
                targetShift: true,
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        // Requests targeting me
        prisma.shiftSwapRequest.findMany({
            where: { targetUserId: session.user.id },
            include: {
                requester: { select: { id: true, name: true } },
                requesterShift: true,
                targetShift: true,
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    return { madeRequests, receivedRequests };
}

// Get pending swap requests - for targets (needs their response) and admins (needs approval)
export async function getPendingSwapRequests() {
    const session = await requireAuth();
    const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";

    // Requests waiting for target user response
    const pendingTargetRequests = await prisma.shiftSwapRequest.findMany({
        where: {
            targetUserId: session.user.id,
            status: "PENDING_TARGET",
        },
        include: {
            requester: { select: { id: true, name: true } },
            requesterShift: true,
            targetShift: true,
        },
        orderBy: { createdAt: "asc" },
    });

    // Admin: Requests waiting for admin approval
    let pendingAdminRequests: typeof pendingTargetRequests = [];
    if (isAdmin) {
        pendingAdminRequests = await prisma.shiftSwapRequest.findMany({
            where: { status: "PENDING_ADMIN" },
            include: {
                requester: { select: { id: true, name: true } },
                targetUser: { select: { id: true, name: true } },
                requesterShift: true,
                targetShift: true,
            },
            orderBy: { createdAt: "asc" },
        });
    }

    return { pendingTargetRequests, pendingAdminRequests };
}

// Target user responds to a swap request
export async function respondToSwap(
    id: string,
    accept: boolean,
    response?: string
) {
    const session = await requireAuth();

    const request = await prisma.shiftSwapRequest.findUnique({
        where: { id },
    });

    if (!request) {
        throw new Error("Swap request not found");
    }

    if (request.targetUserId !== session.user.id) {
        throw new Error("You are not the target of this swap request");
    }

    if (request.status !== "PENDING_TARGET") {
        throw new Error("This request is not waiting for your response");
    }

    const newStatus = accept ? "PENDING_ADMIN" : "REJECTED";

    const updated = await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
            status: newStatus,
            targetResponse: response || null,
        },
        include: {
            requester: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true } },
            requesterShift: true,
            targetShift: true,
        },
    });

    await createAuditLog(
        session.user.id,
        accept ? "ACCEPT" : "REJECT",
        "ShiftSwapRequest",
        id,
        { accept, response }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    return updated;
}

// Admin approves a swap request and performs the actual swap
export async function adminApproveSwap(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const request = await prisma.shiftSwapRequest.findUnique({
        where: { id },
        include: {
            requesterShift: true,
            targetShift: true,
        },
    });

    if (!request) {
        throw new Error("Swap request not found");
    }

    if (request.status !== "PENDING_ADMIN") {
        throw new Error("This request is not waiting for admin approval");
    }

    // Perform the swap - exchange userIds on the schedules
    await prisma.$transaction([
        // Update the requester's shift to belong to target
        prisma.schedule.update({
            where: { id: request.requesterShiftId },
            data: { userId: request.targetUserId },
        }),
        // Update the target's shift to belong to requester
        prisma.schedule.update({
            where: { id: request.targetShiftId },
            data: { userId: request.requesterId },
        }),
        // Mark the request as approved
        prisma.shiftSwapRequest.update({
            where: { id },
            data: {
                status: "APPROVED",
                reviewedById: session.user.id,
                reviewedAt: new Date(),
                adminNotes: adminNotes || null,
            },
        }),
    ]);

    await createAuditLog(
        session.user.id,
        "APPROVE",
        "ShiftSwapRequest",
        id,
        {
            requesterId: request.requesterId,
            targetUserId: request.targetUserId,
            requesterShiftId: request.requesterShiftId,
            targetShiftId: request.targetShiftId,
            adminNotes,
        }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    return { success: true };
}

// Admin rejects a swap request
export async function adminRejectSwap(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const request = await prisma.shiftSwapRequest.findUnique({
        where: { id },
    });

    if (!request) {
        throw new Error("Swap request not found");
    }

    if (request.status !== "PENDING_ADMIN") {
        throw new Error("This request is not waiting for admin approval");
    }

    const updated = await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
            status: "REJECTED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
            adminNotes: adminNotes || null,
        },
    });

    await createAuditLog(
        session.user.id,
        "REJECT",
        "ShiftSwapRequest",
        id,
        { adminNotes }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    return updated;
}

// Cancel a swap request (by the requester)
export async function cancelSwapRequest(id: string) {
    const session = await requireAuth();

    const request = await prisma.shiftSwapRequest.findUnique({
        where: { id },
    });

    if (!request) {
        throw new Error("Swap request not found");
    }

    if (request.requesterId !== session.user.id) {
        throw new Error("You can only cancel your own swap requests");
    }

    if (!["PENDING_TARGET", "PENDING_ADMIN"].includes(request.status)) {
        throw new Error("Can only cancel pending requests");
    }

    const updated = await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
            status: "CANCELLED",
        },
    });

    await createAuditLog(
        session.user.id,
        "CANCEL",
        "ShiftSwapRequest",
        id,
        { previousStatus: request.status }
    );

    revalidatePath("/schedule");

    return updated;
}

// Get available users and their shifts for swap selection
export async function getSwapableShifts(startDate: Date, endDate: Date) {
    const session = await requireAuth();

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all published schedules in the date range (excluding current user)
    const schedules = await prisma.schedule.findMany({
        where: {
            isPublished: true,
            userId: { not: session.user.id },
            shiftStart: {
                gte: start,
                lte: end,
            },
        },
        include: {
            user: { select: { id: true, name: true } },
        },
        orderBy: { shiftStart: "asc" },
    });

    // Get current user's schedules in the date range
    const mySchedules = await prisma.schedule.findMany({
        where: {
            isPublished: true,
            userId: session.user.id,
            shiftStart: {
                gte: start,
                lte: end,
            },
        },
        orderBy: { shiftStart: "asc" },
    });

    return { availableShifts: schedules, myShifts: mySchedules };
}

// Get swap request statistics
export async function getSwapStats() {
    const session = await requireAuth();
    const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";

    const baseStats = await prisma.shiftSwapRequest.groupBy({
        by: ["status"],
        where: {
            OR: [
                { requesterId: session.user.id },
                { targetUserId: session.user.id },
            ],
        },
        _count: true,
    });

    let adminStats = null;
    if (isAdmin) {
        adminStats = await prisma.shiftSwapRequest.count({
            where: { status: "PENDING_ADMIN" },
        });
    }

    return {
        myStats: Object.fromEntries(
            baseStats.map(s => [s.status, s._count])
        ),
        pendingAdminApproval: adminStats,
    };
}

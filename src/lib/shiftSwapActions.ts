"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import {
    notifyShiftSwapRequest,
    notifyShiftSwapResponse,
    notifyShiftSwapAdminDecision,
    notifyAdminsOfPendingRequest,
} from "./notificationActions";
import {
    requestShiftSwapSchema,
    respondToSwapSchema,
    idParamSchema,
    dateRangeSchema,
} from "./schemas";

// Request a shift swap
export async function requestShiftSwap(
    targetUserId: string,
    requesterShiftId: string,
    targetShiftId: string,
    reason?: string
) {
    try {
        const session = await requireAuth();

        const parsed = requestShiftSwapSchema.safeParse({ targetUserId, requesterShiftId, targetShiftId, reason });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        // Cannot swap with yourself
        if (targetUserId === session.user.id) {
            return { success: false, error: "Cannot request a swap with yourself" };
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
            return { success: false, error: "Your shift not found" };
        }

        if (!targetShift) {
            return { success: false, error: "Target shift not found" };
        }

        if (requesterShift.userId !== session.user.id) {
            return { success: false, error: "You can only offer your own shifts for swap" };
        }

        if (targetShift.userId !== targetUserId) {
            return { success: false, error: "Target shift does not belong to the target user" };
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
            return { success: false, error: "There is already a pending swap request for these shifts" };
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

        // Notify the target user about the swap request
        await notifyShiftSwapRequest(targetUserId, session.user.id, swapRequest.id);

        return { success: true, data: swapRequest };
    } catch (error) {
        console.error("Failed to request shift swap:", error);
        return { success: false, error: "Failed to request shift swap" };
    }
}

// Get my swap requests (both made and received)
export async function getMySwapRequests() {
    try {
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

        return { success: true, data: { madeRequests, receivedRequests } };
    } catch (error) {
        console.error("Failed to get swap requests:", error);
        return { success: false, error: "Failed to get swap requests" };
    }
}

// Get pending swap requests - for targets (needs their response) and admins (needs approval)
export async function getPendingSwapRequests() {
    try {
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

        return { success: true, data: { pendingTargetRequests, pendingAdminRequests } };
    } catch (error) {
        console.error("Failed to get pending swap requests:", error);
        return { success: false, error: "Failed to get pending swap requests" };
    }
}

// Target user responds to a swap request
export async function respondToSwap(
    id: string,
    accept: boolean,
    response?: string
) {
    try {
        const session = await requireAuth();

        const parsed = respondToSwapSchema.safeParse({ id, accept, response });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const request = await prisma.shiftSwapRequest.findUnique({
            where: { id },
        });

        if (!request) {
            return { success: false, error: "Swap request not found" };
        }

        if (request.targetUserId !== session.user.id) {
            return { success: false, error: "You are not the target of this swap request" };
        }

        if (request.status !== "PENDING_TARGET") {
            return { success: false, error: "This request is not waiting for your response" };
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

        // Notify the requester about the target's response
        await notifyShiftSwapResponse(request.requesterId, session.user.id, id, accept);

        // If accepted, notify admins that swap is pending their approval
        if (accept) {
            const requesterName = updated.requester?.name || "A dispatcher";
            await notifyAdminsOfPendingRequest("SHIFT_SWAP", id, requesterName);
        }

        return { success: true, data: updated };
    } catch (error) {
        console.error("Failed to respond to swap:", error);
        return { success: false, error: "Failed to respond to swap request" };
    }
}

// Admin approves a swap request and performs the actual swap
export async function adminApproveSwap(id: string, adminNotes?: string) {
    try {
        const session = await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid swap request ID" };
        }

        const request = await prisma.shiftSwapRequest.findUnique({
            where: { id },
            include: {
                requesterShift: true,
                targetShift: true,
            },
        });

        if (!request) {
            return { success: false, error: "Swap request not found" };
        }

        if (request.status !== "PENDING_ADMIN") {
            return { success: false, error: "This request is not waiting for admin approval" };
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

        // Notify both users that the swap was approved
        await notifyShiftSwapAdminDecision(
            request.requesterId,
            request.targetUserId,
            id,
            true
        );

        return { success: true };
    } catch (error) {
        console.error("Failed to approve swap:", error);
        return { success: false, error: "Failed to approve swap request" };
    }
}

// Admin rejects a swap request
export async function adminRejectSwap(id: string, adminNotes?: string) {
    try {
        const session = await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid swap request ID" };
        }

        const request = await prisma.shiftSwapRequest.findUnique({
            where: { id },
        });

        if (!request) {
            return { success: false, error: "Swap request not found" };
        }

        if (request.status !== "PENDING_ADMIN") {
            return { success: false, error: "This request is not waiting for admin approval" };
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

        // Notify both users that the swap was rejected
        await notifyShiftSwapAdminDecision(
            request.requesterId,
            request.targetUserId,
            id,
            false
        );

        return { success: true, data: updated };
    } catch (error) {
        console.error("Failed to reject swap:", error);
        return { success: false, error: "Failed to reject swap request" };
    }
}

// Cancel a swap request (by the requester)
export async function cancelSwapRequest(id: string) {
    try {
        const session = await requireAuth();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid swap request ID" };
        }

        const request = await prisma.shiftSwapRequest.findUnique({
            where: { id },
        });

        if (!request) {
            return { success: false, error: "Swap request not found" };
        }

        if (request.requesterId !== session.user.id) {
            return { success: false, error: "You can only cancel your own swap requests" };
        }

        if (!["PENDING_TARGET", "PENDING_ADMIN"].includes(request.status)) {
            return { success: false, error: "Can only cancel pending requests" };
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

        return { success: true, data: updated };
    } catch (error) {
        console.error("Failed to cancel swap request:", error);
        return { success: false, error: "Failed to cancel swap request" };
    }
}

// Get available users and their shifts for swap selection
export async function getSwapableShifts(startDate: Date, endDate: Date) {
    try {
        const session = await requireAuth();

        const parsed = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid date range" };
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get all published schedules in the date range (excluding current user)
        const schedules = await prisma.schedule.findMany({
            where: {
                isPublished: true,
                userId: { not: session.user.id },
                date: {
                    gte: start,
                    lte: end,
                },
            },
            include: {
                user: { select: { id: true, name: true } },
            },
            orderBy: [{ date: "asc" }, { startHour: "asc" }],
        });

        // Get current user's schedules in the date range
        const mySchedules = await prisma.schedule.findMany({
            where: {
                isPublished: true,
                userId: session.user.id,
                date: {
                    gte: start,
                    lte: end,
                },
            },
            orderBy: [{ date: "asc" }, { startHour: "asc" }],
        });

        return { success: true, data: { availableShifts: schedules, myShifts: mySchedules } };
    } catch (error) {
        console.error("Failed to get swapable shifts:", error);
        return { success: false, error: "Failed to get available shifts" };
    }
}

// Get swap request statistics
export async function getSwapStats() {
    try {
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
            success: true,
            data: {
                myStats: Object.fromEntries(
                    baseStats.map(s => [s.status, s._count])
                ),
                pendingAdminApproval: adminStats,
            },
        };
    } catch (error) {
        console.error("Failed to get swap stats:", error);
        return { success: false, error: "Failed to get swap statistics" };
    }
}

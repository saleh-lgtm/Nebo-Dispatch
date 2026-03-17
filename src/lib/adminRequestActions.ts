"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import {
    approveRequestSchema,
    rejectRequestSchema,
    limitParamSchema,
} from "./schemas";

// Get all pending requests (ADMIN/SUPER_ADMIN only)
export async function getPendingRequests() {
    try {
        await requireAdmin();

        const requests = await prisma.schedulingRequest.findMany({
            where: { status: "PENDING" },
            include: {
                user: { select: { id: true, name: true, email: true } },
                schedule: true,
                shift: true,
                targetUser: { select: { id: true, name: true, email: true } },
                targetSchedule: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return { success: true, data: requests };
    } catch (error) {
        console.error("getPendingRequests error:", error);
        return { success: false, error: "Failed to get pending requests", data: [] };
    }
}

// Get all requests (ADMIN/SUPER_ADMIN only)
export async function getAllRequests(limit: number = 50) {
    try {
        await requireAdmin();

        const parsed = limitParamSchema.safeParse({ limit });
        if (!parsed.success) {
            return { success: false, error: "Invalid limit", data: [] };
        }

        const requests = await prisma.schedulingRequest.findMany({
            include: {
                user: { select: { id: true, name: true, email: true } },
                schedule: true,
                targetUser: { select: { id: true, name: true, email: true } },
                targetSchedule: true,
            },
            orderBy: { createdAt: "desc" },
            take: parsed.data.limit || 50,
        });

        return { success: true, data: requests };
    } catch (error) {
        console.error("getAllRequests error:", error);
        return { success: false, error: "Failed to get requests", data: [] };
    }
}

// Approve a request (ADMIN/SUPER_ADMIN only)
export async function approveRequest(
    id: string,
    adminNotes?: string,
    applyChanges: boolean = false
) {
    try {
        const session = await requireAdmin();

        const parsed = approveRequestSchema.safeParse({ id, adminNotes, applyChanges });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const request = await prisma.schedulingRequest.update({
            where: { id: parsed.data.id },
            data: {
                status: "APPROVED",
                adminNotes: parsed.data.adminNotes || null,
                updatedAt: new Date(),
            },
            include: { schedule: true },
        });

        // Log the approval
        await createAuditLog(
            session.user.id,
            "APPROVE",
            "SchedulingRequest",
            parsed.data.id,
            { adminNotes: parsed.data.adminNotes, applyChanges: parsed.data.applyChanges }
        );

        // Note: Auto-apply disabled - Schedule model now uses date/startHour/endHour instead of DateTime fields.
        // Admin must manually update the schedule after approving the request.
        // TODO: Update SchedulingRequest model to use date/startHour/endHour fields

        revalidatePath("/admin/requests");
        revalidatePath("/admin/scheduler");
        revalidatePath("/schedule");
        return { success: true, data: request };
    } catch (error) {
        console.error("approveRequest error:", error);
        return { success: false, error: "Failed to approve request" };
    }
}

// Reject a request (ADMIN/SUPER_ADMIN only)
export async function rejectRequest(id: string, adminNotes: string) {
    try {
        const session = await requireAdmin();

        const parsed = rejectRequestSchema.safeParse({ id, adminNotes });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const request = await prisma.schedulingRequest.update({
            where: { id: parsed.data.id },
            data: {
                status: "REJECTED",
                adminNotes: parsed.data.adminNotes,
                updatedAt: new Date(),
            },
        });

        // Log the rejection
        await createAuditLog(
            session.user.id,
            "REJECT",
            "SchedulingRequest",
            parsed.data.id,
            { adminNotes: parsed.data.adminNotes }
        );

        revalidatePath("/admin/requests");
        revalidatePath("/schedule");
        return { success: true, data: request };
    } catch (error) {
        console.error("rejectRequest error:", error);
        return { success: false, error: "Failed to reject request" };
    }
}

// Get request counts by status (ADMIN/SUPER_ADMIN only)
export async function getRequestCounts() {
    try {
        await requireAdmin();

        const [pending, approved, rejected] = await Promise.all([
            prisma.schedulingRequest.count({ where: { status: "PENDING" } }),
            prisma.schedulingRequest.count({ where: { status: "APPROVED" } }),
            prisma.schedulingRequest.count({ where: { status: "REJECTED" } }),
        ]);

        return { success: true, data: { pending, approved, rejected, total: pending + approved + rejected } };
    } catch (error) {
        console.error("getRequestCounts error:", error);
        return { success: false, error: "Failed to get request counts", data: { pending: 0, approved: 0, rejected: 0, total: 0 } };
    }
}

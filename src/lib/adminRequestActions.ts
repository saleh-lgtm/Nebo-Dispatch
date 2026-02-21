"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Get all pending requests (ADMIN/SUPER_ADMIN only)
export async function getPendingRequests() {
    await requireAdmin();

    return await prisma.schedulingRequest.findMany({
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
}

// Get all requests (ADMIN/SUPER_ADMIN only)
export async function getAllRequests(limit: number = 50) {
    await requireAdmin();

    return await prisma.schedulingRequest.findMany({
        include: {
            user: { select: { id: true, name: true, email: true } },
            schedule: true,
            targetUser: { select: { id: true, name: true, email: true } },
            targetSchedule: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

// Approve a request (ADMIN/SUPER_ADMIN only)
export async function approveRequest(
    id: string,
    adminNotes?: string,
    applyChanges: boolean = false
) {
    const session = await requireAdmin();

    const request = await prisma.schedulingRequest.update({
        where: { id },
        data: {
            status: "APPROVED",
            adminNotes: adminNotes || null,
            updatedAt: new Date(),
        },
        include: { schedule: true },
    });

    // Log the approval
    await createAuditLog(
        session.user.id,
        "APPROVE",
        "SchedulingRequest",
        id,
        { adminNotes, applyChanges }
    );

    // Optionally auto-apply the schedule change
    if (applyChanges && request.scheduleId && request.requestedStart && request.requestedEnd) {
        await prisma.schedule.update({
            where: { id: request.scheduleId },
            data: {
                shiftStart: request.requestedStart,
                shiftEnd: request.requestedEnd,
            },
        });
    }

    revalidatePath("/admin/requests");
    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
    return request;
}

// Reject a request (ADMIN/SUPER_ADMIN only)
export async function rejectRequest(id: string, adminNotes: string) {
    const session = await requireAdmin();

    const request = await prisma.schedulingRequest.update({
        where: { id },
        data: {
            status: "REJECTED",
            adminNotes,
            updatedAt: new Date(),
        },
    });

    // Log the rejection
    await createAuditLog(
        session.user.id,
        "REJECT",
        "SchedulingRequest",
        id,
        { adminNotes }
    );

    revalidatePath("/admin/requests");
    revalidatePath("/schedule");
    return request;
}

// Get request counts by status (ADMIN/SUPER_ADMIN only)
export async function getRequestCounts() {
    await requireAdmin();

    const [pending, approved, rejected] = await Promise.all([
        prisma.schedulingRequest.count({ where: { status: "PENDING" } }),
        prisma.schedulingRequest.count({ where: { status: "APPROVED" } }),
        prisma.schedulingRequest.count({ where: { status: "REJECTED" } }),
    ]);

    return { pending, approved, rejected, total: pending + approved + rejected };
}

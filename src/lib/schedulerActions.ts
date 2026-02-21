"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Helper to get start of week (Sunday 00:00:00) - internal use only
function getWeekStartInternal(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Get all dispatchers (ADMIN/SUPER_ADMIN only)
export async function getDispatchers() {
    await requireAdmin();

    return await prisma.user.findMany({
        where: { role: "DISPATCHER", isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
    });
}

// Get schedules for a specific week (ADMIN/SUPER_ADMIN only)
export async function getWeekSchedules(weekStart: Date) {
    await requireAdmin();

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return await prisma.schedule.findMany({
        where: {
            shiftStart: {
                gte: weekStart,
                lt: weekEnd,
            },
        },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { shiftStart: "asc" },
    });
}

// Create a new schedule block (ADMIN/SUPER_ADMIN only)
export async function createScheduleBlock(data: {
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
}) {
    const session = await requireAdmin();
    const weekStart = getWeekStartInternal(data.shiftStart);

    const schedule = await prisma.schedule.create({
        data: {
            userId: data.userId,
            shiftStart: data.shiftStart,
            shiftEnd: data.shiftEnd,
            weekStart: weekStart,
            isPublished: false,
        },
        include: { user: { select: { id: true, name: true } } },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "Schedule",
        schedule.id,
        { userId: data.userId, shiftStart: data.shiftStart, shiftEnd: data.shiftEnd }
    );

    revalidatePath("/admin/scheduler");
    return schedule;
}

// Update schedule block position/duration (ADMIN/SUPER_ADMIN only)
export async function updateScheduleBlock(
    id: string,
    data: { shiftStart?: Date; shiftEnd?: Date }
) {
    const session = await requireAdmin();
    const updateData: Record<string, unknown> = { ...data };

    if (data.shiftStart) {
        updateData.weekStart = getWeekStartInternal(data.shiftStart);
    }

    const schedule = await prisma.schedule.update({
        where: { id },
        data: updateData,
        include: { user: { select: { id: true, name: true } } },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Schedule",
        id,
        data
    );

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
    return schedule;
}

// Delete a schedule block (ADMIN/SUPER_ADMIN only)
export async function deleteScheduleBlock(id: string) {
    const session = await requireAdmin();

    await prisma.schedule.delete({ where: { id } });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "Schedule",
        id
    );

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
}

// Publish all schedules for a week (ADMIN/SUPER_ADMIN only)
export async function publishWeekSchedules(weekStart: Date) {
    const session = await requireAdmin();

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await prisma.schedule.updateMany({
        where: {
            shiftStart: {
                gte: weekStart,
                lt: weekEnd,
            },
        },
        data: { isPublished: true },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Schedule",
        undefined,
        { action: "publish_week", weekStart: weekStart.toISOString() }
    );

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
}

// Unpublish all schedules for a week (ADMIN/SUPER_ADMIN only)
export async function unpublishWeekSchedules(weekStart: Date) {
    const session = await requireAdmin();

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await prisma.schedule.updateMany({
        where: {
            shiftStart: {
                gte: weekStart,
                lt: weekEnd,
            },
        },
        data: { isPublished: false },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Schedule",
        undefined,
        { action: "unpublish_week", weekStart: weekStart.toISOString() }
    );

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
}

// Check if week is published (ADMIN/SUPER_ADMIN only)
export async function isWeekPublished(weekStart: Date): Promise<boolean> {
    await requireAdmin();

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const count = await prisma.schedule.count({
        where: {
            shiftStart: {
                gte: weekStart,
                lt: weekEnd,
            },
            isPublished: true,
        },
    });

    return count > 0;
}

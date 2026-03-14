"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { notifySchedulePublished } from "./notificationActions";

// Helper to get start of week (Sunday 00:00:00 UTC) - internal use only
function getWeekStartInternal(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
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

// Schedule with user relation type
type ScheduleWithUser = {
    id: string;
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
    weekStart: Date | null;
    user: { id: string; name: string | null };
};

// Create a new schedule block (ADMIN/SUPER_ADMIN only)
export async function createScheduleBlock(data: {
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
}): Promise<{ success: boolean; schedule?: ScheduleWithUser; error?: string }> {
    try {
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
        return { success: true, schedule };
    } catch (error) {
        console.error("Failed to create schedule:", error);
        return { success: false, error: "Failed to create shift. Please try again." };
    }
}

// Update schedule block position/duration (ADMIN/SUPER_ADMIN only)
export async function updateScheduleBlock(
    id: string,
    data: { shiftStart?: Date; shiftEnd?: Date }
): Promise<{ success: boolean; schedule?: ScheduleWithUser; error?: string }> {
    try {
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
        return { success: true, schedule };
    } catch (error) {
        console.error("Failed to update schedule:", error);
        return { success: false, error: "Failed to update shift. Please try again." };
    }
}

// Delete a schedule block (ADMIN/SUPER_ADMIN only)
export async function deleteScheduleBlock(id: string): Promise<{ success: boolean; error?: string }> {
    try {
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
        return { success: true };
    } catch (error) {
        console.error("Failed to delete schedule:", error);
        return { success: false, error: "Failed to delete shift. Please try again." };
    }
}

// Publish all schedules for a week (ADMIN/SUPER_ADMIN only)
export async function publishWeekSchedules(weekStart: Date): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAdmin();

        // Use milliseconds for timezone-safe date calculation
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS_MS);

        const result = await prisma.schedule.updateMany({
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
            { action: "publish_week", weekStart: weekStart.toISOString(), count: result.count }
        );

        // Notify all dispatchers with shifts this week
        await notifySchedulePublished(weekStart);

        revalidatePath("/admin/scheduler");
        revalidatePath("/schedule");
        return { success: true };
    } catch (error) {
        console.error("Failed to publish schedules:", error);
        return { success: false, error: "Failed to publish schedule. Please try again." };
    }
}

// Unpublish all schedules for a week (ADMIN/SUPER_ADMIN only)
export async function unpublishWeekSchedules(weekStart: Date): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAdmin();

        // Use milliseconds for timezone-safe date calculation
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS_MS);

        const result = await prisma.schedule.updateMany({
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
            { action: "unpublish_week", weekStart: weekStart.toISOString(), count: result.count }
        );

        revalidatePath("/admin/scheduler");
        revalidatePath("/schedule");
        return { success: true };
    } catch (error) {
        console.error("Failed to unpublish schedules:", error);
        return { success: false, error: "Failed to unpublish schedule. Please try again." };
    }
}

// Check if week is published (ADMIN/SUPER_ADMIN only)
export async function isWeekPublished(weekStart: Date): Promise<boolean> {
    await requireAdmin();

    // Use milliseconds for timezone-safe date calculation
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS_MS);

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

// Copy schedules from previous week to target week (ADMIN/SUPER_ADMIN only)
export async function copyPreviousWeekSchedules(targetWeekStart: Date) {
    const session = await requireAdmin();

    // Use milliseconds to add exactly 7 days (avoids timezone issues with setDate)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // Calculate previous week start (7 days before target)
    const previousWeekStart = new Date(targetWeekStart.getTime() - SEVEN_DAYS_MS);
    const previousWeekEnd = new Date(previousWeekStart.getTime() + SEVEN_DAYS_MS);
    const targetWeekEnd = new Date(targetWeekStart.getTime() + SEVEN_DAYS_MS);

    // Get all schedules from previous week
    const previousSchedules = await prisma.schedule.findMany({
        where: {
            shiftStart: {
                gte: previousWeekStart,
                lt: previousWeekEnd,
            },
        },
        include: { user: { select: { id: true, name: true } } },
    });

    if (previousSchedules.length === 0) {
        return { success: false, copied: 0, message: "No schedules found in previous week" };
    }

    // Check for existing schedules in target week
    const existingCount = await prisma.schedule.count({
        where: {
            shiftStart: {
                gte: targetWeekStart,
                lt: targetWeekEnd,
            },
        },
    });

    if (existingCount > 0) {
        return {
            success: false,
            copied: 0,
            message: `Target week already has ${existingCount} schedule(s). Clear them first or add manually.`
        };
    }

    try {
        // Copy each schedule, adjusting dates by +7 days using milliseconds
        const newSchedules = await Promise.all(
            previousSchedules.map(async (schedule) => {
                // Add exactly 7 days in milliseconds (timezone-safe)
                const newShiftStart = new Date(schedule.shiftStart.getTime() + SEVEN_DAYS_MS);
                const newShiftEnd = new Date(schedule.shiftEnd.getTime() + SEVEN_DAYS_MS);

                return prisma.schedule.create({
                    data: {
                        userId: schedule.userId,
                        shiftStart: newShiftStart,
                        shiftEnd: newShiftEnd,
                        weekStart: targetWeekStart,
                        isPublished: false,
                    },
                    include: { user: { select: { id: true, name: true } } },
                });
            })
        );

        await createAuditLog(
            session.user.id,
            "CREATE",
            "Schedule",
            undefined,
            {
                action: "copy_previous_week",
                sourceWeek: previousWeekStart.toISOString(),
                targetWeek: targetWeekStart.toISOString(),
                copiedCount: newSchedules.length
            }
        );

        revalidatePath("/admin/scheduler");

        return {
            success: true,
            copied: newSchedules.length,
            schedules: newSchedules,
            message: `Copied ${newSchedules.length} schedule(s) from previous week`
        };
    } catch (error) {
        console.error("Failed to copy schedules:", error);
        return {
            success: false,
            copied: 0,
            message: "Failed to copy schedules. Please try again."
        };
    }
}

// Get user's next scheduled shift (for any authenticated user)
export async function getUserNextShift(userId: string) {
    await requireAuth();

    const now = new Date();

    return prisma.schedule.findFirst({
        where: {
            userId,
            isPublished: true,
            shiftStart: { gte: now },
        },
        orderBy: { shiftStart: "asc" },
        select: {
            id: true,
            shiftStart: true,
            shiftEnd: true,
        },
    });
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { notifySchedulePublished } from "./notificationActions";
import { detectScheduleConflicts, type ScheduleConflict } from "./scheduleConflicts";

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

// Cached version of getDispatchers - 5 minute cache
const getCachedDispatchersInternal = unstable_cache(
    async () => {
        return await prisma.user.findMany({
            where: { role: "DISPATCHER", isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        });
    },
    ["dispatchers-list"],
    { revalidate: 300, tags: ["dispatchers"] }
);

export async function getCachedDispatchers() {
    await requireAdmin();
    return getCachedDispatchersInternal();
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

// Cached version of getWeekSchedules - 60 second cache
const getCachedWeekSchedulesInternal = unstable_cache(
    async (weekStartISO: string) => {
        const weekStart = new Date(weekStartISO);
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
    },
    ["week-schedules"],
    { revalidate: 60, tags: ["schedules"] }
);

export async function getCachedWeekSchedules(weekStart: Date) {
    await requireAdmin();
    return getCachedWeekSchedulesInternal(weekStart.toISOString());
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
// Set checkConflicts to true to check for conflicts before creating
// If skipBlockingConflicts is false and there are error-level conflicts, creation will be blocked
export async function createScheduleBlock(data: {
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    checkConflicts?: boolean;
    skipBlockingConflicts?: boolean; // Force create even with error-level conflicts
}): Promise<{
    success: boolean;
    schedule?: ScheduleWithUser;
    error?: string;
    conflicts?: ScheduleConflict[];
}> {
    try {
        const session = await requireAdmin();
        const weekStart = getWeekStartInternal(data.shiftStart);

        // Check for conflicts if requested
        if (data.checkConflicts) {
            const conflicts = await detectScheduleConflicts({
                userId: data.userId,
                shiftStart: data.shiftStart,
                shiftEnd: data.shiftEnd,
            });

            // If there are blocking conflicts and we shouldn't skip them, return them
            const hasBlocking = conflicts.some((c) => c.severity === "error");
            if (hasBlocking && !data.skipBlockingConflicts) {
                return {
                    success: false,
                    error: "Schedule has conflicts that need to be resolved",
                    conflicts,
                };
            }

            // If there are warnings, still create but return the conflicts
            if (conflicts.length > 0) {
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
                    { userId: data.userId, shiftStart: data.shiftStart, shiftEnd: data.shiftEnd, conflicts: conflicts.length }
                );

                revalidatePath("/admin/scheduler");
                revalidateTag("schedules", "max");
                return { success: true, schedule, conflicts };
            }
        }

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
        revalidateTag("schedules", "max");
        return { success: true, schedule };
    } catch (error) {
        console.error("Failed to create schedule:", error);
        return { success: false, error: "Failed to create shift. Please try again." };
    }
}

// Update schedule block position/duration (ADMIN/SUPER_ADMIN only)
export async function updateScheduleBlock(
    id: string,
    data: {
        shiftStart?: Date;
        shiftEnd?: Date;
        checkConflicts?: boolean;
        skipBlockingConflicts?: boolean;
    }
): Promise<{
    success: boolean;
    schedule?: ScheduleWithUser;
    error?: string;
    conflicts?: ScheduleConflict[];
}> {
    try {
        const session = await requireAdmin();

        // Get current schedule to know the user
        const currentSchedule = await prisma.schedule.findUnique({
            where: { id },
            select: { userId: true, shiftStart: true, shiftEnd: true },
        });

        if (!currentSchedule) {
            return { success: false, error: "Schedule not found" };
        }

        const newShiftStart = data.shiftStart || currentSchedule.shiftStart;
        const newShiftEnd = data.shiftEnd || currentSchedule.shiftEnd;

        // Check for conflicts if requested
        if (data.checkConflicts) {
            const conflicts = await detectScheduleConflicts({
                userId: currentSchedule.userId,
                shiftStart: newShiftStart,
                shiftEnd: newShiftEnd,
                excludeScheduleId: id, // Exclude current schedule from overlap check
            });

            const hasBlocking = conflicts.some((c) => c.severity === "error");
            if (hasBlocking && !data.skipBlockingConflicts) {
                return {
                    success: false,
                    error: "Schedule update has conflicts that need to be resolved",
                    conflicts,
                };
            }

            if (conflicts.length > 0) {
                const updateData: Record<string, unknown> = {};
                if (data.shiftStart) {
                    updateData.shiftStart = data.shiftStart;
                    updateData.weekStart = getWeekStartInternal(data.shiftStart);
                }
                if (data.shiftEnd) {
                    updateData.shiftEnd = data.shiftEnd;
                }

                const schedule = await prisma.schedule.update({
                    where: { id },
                    data: updateData,
                    include: { user: { select: { id: true, name: true } } },
                });

                await createAuditLog(session.user.id, "UPDATE", "Schedule", id, {
                    ...data,
                    conflicts: conflicts.length,
                });

                revalidatePath("/admin/scheduler");
                revalidatePath("/schedule");
                revalidateTag("schedules", "max");
                return { success: true, schedule, conflicts };
            }
        }

        const updateData: Record<string, unknown> = {};
        if (data.shiftStart) {
            updateData.shiftStart = data.shiftStart;
            updateData.weekStart = getWeekStartInternal(data.shiftStart);
        }
        if (data.shiftEnd) {
            updateData.shiftEnd = data.shiftEnd;
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
        revalidateTag("schedules", "max");
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
        revalidateTag("schedules", "max");
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
        revalidateTag("schedules", "max");
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
        revalidateTag("schedules", "max");
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
        // Batch insert: prepare all schedule data
        const scheduleData = previousSchedules.map((schedule) => ({
            userId: schedule.userId,
            shiftStart: new Date(schedule.shiftStart.getTime() + SEVEN_DAYS_MS),
            shiftEnd: new Date(schedule.shiftEnd.getTime() + SEVEN_DAYS_MS),
            weekStart: targetWeekStart,
            isPublished: false,
        }));

        // Create all schedules in a single database call
        await prisma.schedule.createMany({ data: scheduleData });

        // Fetch the newly created schedules with user relations
        const newSchedules = await prisma.schedule.findMany({
            where: {
                weekStart: targetWeekStart,
                shiftStart: { gte: targetWeekStart, lt: targetWeekEnd },
            },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { shiftStart: "asc" },
        });

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
        revalidateTag("schedules", "max");

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

// Types for week stats
export interface WeekStats {
    totalHours: number;
    shiftCount: number;
    dispatcherCount: number;
    hoursByDispatcher: { userId: string; name: string | null; hours: number }[];
    coverageByDay: { day: number; hours: number; shiftCount: number }[];
}

/**
 * Get aggregated stats for a week using raw SQL for performance
 * (ADMIN/SUPER_ADMIN only)
 */
export async function getWeekStats(weekStart: Date): Promise<WeekStats> {
    await requireAdmin();

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS_MS);

    // Run all queries in parallel for efficiency
    const [totalStats, hoursByDispatcher, coverageByDay] = await Promise.all([
        // Total hours and counts
        prisma.$queryRaw<{ total_hours: number | null; shift_count: bigint; dispatcher_count: bigint }[]>`
            SELECT
                SUM(EXTRACT(EPOCH FROM ("shiftEnd" - "shiftStart")) / 3600) as total_hours,
                COUNT(*) as shift_count,
                COUNT(DISTINCT "userId") as dispatcher_count
            FROM "Schedule"
            WHERE "shiftStart" >= ${weekStart}
              AND "shiftStart" < ${weekEnd}
        `,

        // Hours by dispatcher
        prisma.$queryRaw<{ userId: string; name: string | null; hours: number }[]>`
            SELECT
                s."userId",
                u."name",
                SUM(EXTRACT(EPOCH FROM (s."shiftEnd" - s."shiftStart")) / 3600) as hours
            FROM "Schedule" s
            JOIN "User" u ON s."userId" = u.id
            WHERE s."shiftStart" >= ${weekStart}
              AND s."shiftStart" < ${weekEnd}
            GROUP BY s."userId", u."name"
            ORDER BY hours DESC
        `,

        // Coverage by day of week (0 = Sunday)
        prisma.$queryRaw<{ day: number; hours: number; shift_count: bigint }[]>`
            SELECT
                EXTRACT(DOW FROM "shiftStart" AT TIME ZONE 'America/Chicago') as day,
                SUM(EXTRACT(EPOCH FROM ("shiftEnd" - "shiftStart")) / 3600) as hours,
                COUNT(*) as shift_count
            FROM "Schedule"
            WHERE "shiftStart" >= ${weekStart}
              AND "shiftStart" < ${weekEnd}
            GROUP BY day
            ORDER BY day
        `,
    ]);

    const stats = totalStats[0] || { total_hours: 0, shift_count: BigInt(0), dispatcher_count: BigInt(0) };

    return {
        totalHours: Number(stats.total_hours) || 0,
        shiftCount: Number(stats.shift_count),
        dispatcherCount: Number(stats.dispatcher_count),
        hoursByDispatcher: hoursByDispatcher.map(d => ({
            userId: d.userId,
            name: d.name,
            hours: Number(d.hours) || 0,
        })),
        coverageByDay: coverageByDay.map(d => ({
            day: Number(d.day),
            hours: Number(d.hours) || 0,
            shiftCount: Number(d.shift_count),
        })),
    };
}

// Cached version of getWeekStats - 30 second cache
const getCachedWeekStatsInternal = unstable_cache(
    async (weekStartISO: string) => {
        const weekStart = new Date(weekStartISO);
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS_MS);

        const [totalStats, hoursByDispatcher, coverageByDay] = await Promise.all([
            prisma.$queryRaw<{ total_hours: number | null; shift_count: bigint; dispatcher_count: bigint }[]>`
                SELECT
                    SUM(EXTRACT(EPOCH FROM ("shiftEnd" - "shiftStart")) / 3600) as total_hours,
                    COUNT(*) as shift_count,
                    COUNT(DISTINCT "userId") as dispatcher_count
                FROM "Schedule"
                WHERE "shiftStart" >= ${weekStart}
                  AND "shiftStart" < ${weekEnd}
            `,
            prisma.$queryRaw<{ userId: string; name: string | null; hours: number }[]>`
                SELECT
                    s."userId",
                    u."name",
                    SUM(EXTRACT(EPOCH FROM (s."shiftEnd" - s."shiftStart")) / 3600) as hours
                FROM "Schedule" s
                JOIN "User" u ON s."userId" = u.id
                WHERE s."shiftStart" >= ${weekStart}
                  AND s."shiftStart" < ${weekEnd}
                GROUP BY s."userId", u."name"
                ORDER BY hours DESC
            `,
            prisma.$queryRaw<{ day: number; hours: number; shift_count: bigint }[]>`
                SELECT
                    EXTRACT(DOW FROM "shiftStart" AT TIME ZONE 'America/Chicago') as day,
                    SUM(EXTRACT(EPOCH FROM ("shiftEnd" - "shiftStart")) / 3600) as hours,
                    COUNT(*) as shift_count
                FROM "Schedule"
                WHERE "shiftStart" >= ${weekStart}
                  AND "shiftStart" < ${weekEnd}
                GROUP BY day
                ORDER BY day
            `,
        ]);

        const stats = totalStats[0] || { total_hours: 0, shift_count: BigInt(0), dispatcher_count: BigInt(0) };

        return {
            totalHours: Number(stats.total_hours) || 0,
            shiftCount: Number(stats.shift_count),
            dispatcherCount: Number(stats.dispatcher_count),
            hoursByDispatcher: hoursByDispatcher.map(d => ({
                userId: d.userId,
                name: d.name,
                hours: Number(d.hours) || 0,
            })),
            coverageByDay: coverageByDay.map(d => ({
                day: Number(d.day),
                hours: Number(d.hours) || 0,
                shiftCount: Number(d.shift_count),
            })),
        };
    },
    ["week-stats"],
    { revalidate: 30, tags: ["schedules"] }
);

export async function getCachedWeekStats(weekStart: Date): Promise<WeekStats> {
    await requireAdmin();
    return getCachedWeekStatsInternal(weekStart.toISOString());
}

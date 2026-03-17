"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

/**
 * Convert a date and hour integer to a full DateTime
 */
function createDateWithHour(date: Date, hour: number): Date {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    return d;
}

export interface ShiftStatus {
    isClocked: boolean;
    shift: {
        id: string;
        clockIn: Date;
        clockOut: Date | null;
        scheduledStart: Date | null;
        scheduledEnd: Date | null;
        earlyClockIn: number | null;
    } | null;
    scheduledShift: {
        id: string;
        date: Date;
        startHour: number;
        endHour: number;
    } | null;
    hasSubmittedReport: boolean;
}

/**
 * Get current shift status for the logged-in user
 */
export async function getShiftStatus(): Promise<{ success: boolean; data?: ShiftStatus; error?: string }> {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        // Get active shift (clocked in but not out)
        const activeShift = await prisma.shift.findFirst({
            where: {
                userId,
                clockOut: null,
            },
            include: {
                reports: {
                    where: { status: { in: ["SUBMITTED", "REVIEWED"] } },
                    take: 1,
                },
            },
        });

        // Get today's scheduled shift
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scheduledShift = await prisma.schedule.findFirst({
            where: {
                userId,
                isPublished: true,
                date: today,
            },
            orderBy: { startHour: "asc" },
        });

        return {
            success: true,
            data: {
                isClocked: !!activeShift,
                shift: activeShift
                    ? {
                          id: activeShift.id,
                          clockIn: activeShift.clockIn,
                          clockOut: activeShift.clockOut,
                          scheduledStart: activeShift.scheduledStart,
                          scheduledEnd: activeShift.scheduledEnd,
                          earlyClockIn: activeShift.earlyClockIn,
                      }
                    : null,
                scheduledShift: scheduledShift
                    ? {
                          id: scheduledShift.id,
                          date: scheduledShift.date,
                          startHour: scheduledShift.startHour,
                          endHour: scheduledShift.endHour,
                      }
                    : null,
                hasSubmittedReport: activeShift ? activeShift.reports.length > 0 : false,
            },
        };
    } catch (error) {
        console.error("getShiftStatus error:", error);
        return { success: false, error: "Failed to get shift status" };
    }
}

/**
 * Clock in - creates a new shift with schedule comparison
 */
export async function clockIn(): Promise<{ success: boolean; shiftId?: string; error?: string }> {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        // Check if already clocked in
        const existingShift = await prisma.shift.findFirst({
            where: { userId, clockOut: null },
        });

        if (existingShift) {
            return { success: false, error: "Already clocked in" };
        }

        // Get today's scheduled shift for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scheduledShift = await prisma.schedule.findFirst({
            where: {
                userId,
                isPublished: true,
                date: today,
            },
            orderBy: { startHour: "asc" },
        });

        const clockInTime = new Date();
        let earlyClockIn: number | null = null;
        let scheduledStart: Date | null = null;
        let scheduledEnd: Date | null = null;

        if (scheduledShift) {
            // Convert integer hours to DateTime for Shift model
            scheduledStart = createDateWithHour(scheduledShift.date, scheduledShift.startHour);
            // For overnight shifts, end date is next day
            const isOvernight = scheduledShift.endHour <= scheduledShift.startHour && scheduledShift.endHour !== scheduledShift.startHour;
            scheduledEnd = isOvernight
                ? createDateWithHour(new Date(scheduledShift.date.getTime() + 24 * 60 * 60 * 1000), scheduledShift.endHour)
                : createDateWithHour(scheduledShift.date, scheduledShift.endHour);

            // Calculate minutes early (positive) or late (negative)
            earlyClockIn = Math.round((scheduledStart.getTime() - clockInTime.getTime()) / (1000 * 60));
        }

        // Create the shift
        const shift = await prisma.shift.create({
            data: {
                userId,
                clockIn: clockInTime,
                scheduledStart,
                scheduledEnd,
                earlyClockIn,
            },
        });

        await createAuditLog(session.user.id, "CLOCK_IN", "Shift", shift.id, {
            earlyClockIn,
            scheduledStart,
        });

        // Create standard tasks for the new shift
        const templates = await prisma.taskTemplate.findMany({
            where: { isActive: true },
            include: { items: true },
        });

        const taskEntries = templates.flatMap((t) =>
            t.items.map((item) => ({
                shiftId: shift.id,
                content: item.content,
            }))
        );

        if (taskEntries.length > 0) {
            await prisma.shiftTask.createMany({ data: taskEntries });
        } else {
            // Fallback default tasks
            const defaultTasks = [
                "Check Reservations/Info/Admin inboxes",
                "Make sure all emails are read",
                "Check wake up calls mapping",
                "Confirm all trips on portals",
                "Confirm drivers/vehicles",
                "Generate passenger link list",
                "Monitor chauffeurs",
            ];
            await prisma.shiftTask.createMany({
                data: defaultTasks.map((content) => ({ shiftId: shift.id, content })),
            });
        }

        // Add admin-assigned tasks to the shift
        const adminTasks = await prisma.adminTask.findMany({
            where: {
                isActive: true,
                OR: [{ assignToAll: true }, { assignedToId: userId }],
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        });

        if (adminTasks.length > 0) {
            await prisma.shiftTask.createMany({
                data: adminTasks.map((task) => ({
                    shiftId: shift.id,
                    content: task.title,
                    isAdminTask: true,
                    assignedById: task.createdById,
                    priority: task.priority,
                })),
            });
        }

        revalidatePath("/dashboard");
        revalidatePath("/reports/shift");

        return { success: true, shiftId: shift.id };
    } catch (error) {
        console.error("clockIn error:", error);
        return { success: false, error: "Failed to clock in. Please try again." };
    }
}

/**
 * Clock out - requires shift report or flags for admin
 * Uses a transaction to ensure atomicity and prevent race conditions
 */
export async function clockOut(forceWithoutReport = false): Promise<{
    success: boolean;
    error?: string;
    requiresReport?: boolean;
    details?: string;
}> {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        // Get active shift with report status
        const activeShift = await prisma.shift.findFirst({
            where: { userId, clockOut: null },
            include: {
                reports: {
                    where: { status: { in: ["SUBMITTED", "REVIEWED"] } },
                    take: 1,
                },
                tasks: {
                    where: { isAdminTask: true },
                    select: { id: true, content: true },
                },
            },
        });

        if (!activeShift) {
            return {
                success: false,
                error: "Not clocked in",
                details: "No active shift found. You may have already clocked out."
            };
        }

        const hasReport = activeShift.reports.length > 0;

        // If no report and not forcing, require report
        if (!hasReport && !forceWithoutReport) {
            return {
                success: false,
                error: "Please complete your shift report before clocking out",
                requiresReport: true,
                details: "Submit your shift report first, or choose to clock out without it (will be flagged for review)."
            };
        }

        const clockOutTime = new Date();
        const totalHours =
            (clockOutTime.getTime() - activeShift.clockIn.getTime()) / (1000 * 60 * 60);

        let earlyClockOut: number | null = null;
        if (activeShift.scheduledEnd) {
            const scheduledMs = activeShift.scheduledEnd.getTime();
            const actualMs = clockOutTime.getTime();
            earlyClockOut = Math.round((scheduledMs - actualMs) / (1000 * 60));
        }

        // Use transaction for atomicity - all operations succeed or none do
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update shift with clock out time
            await tx.shift.update({
                where: { id: activeShift.id },
                data: {
                    clockOut: clockOutTime,
                    totalHours: Math.round(totalHours * 100) / 100,
                    earlyClockOut,
                    incompleteReportFlag: !hasReport,
                },
            });

            // 2. Reset admin task completions for THIS shift's tasks only
            // Get the specific admin task IDs that were assigned to this shift
            const shiftAdminTaskContents = activeShift.tasks.map(t => t.content);

            let deletedCount = 0;
            if (shiftAdminTaskContents.length > 0) {
                // Find admin tasks that match the shift task contents
                const matchingAdminTasks = await tx.adminTask.findMany({
                    where: {
                        title: { in: shiftAdminTaskContents },
                        isActive: true,
                    },
                    select: { id: true },
                });

                if (matchingAdminTasks.length > 0) {
                    const adminTaskIds = matchingAdminTasks.map(t => t.id);
                    const deleted = await tx.adminTaskCompletion.deleteMany({
                        where: {
                            userId,
                            taskId: { in: adminTaskIds },
                        },
                    });
                    deletedCount = deleted.count;
                }
            }

            return { deletedCount };
        });

        // Create audit logs outside transaction (non-critical)
        if (result.deletedCount > 0) {
            await createAuditLog(
                session.user.id,
                "DELETE",
                "AdminTaskCompletion",
                activeShift.id,
                { action: "shift_clock_out_reset", completionsCleared: result.deletedCount, shiftId: activeShift.id }
            );
        }

        await createAuditLog(session.user.id, "CLOCK_OUT", "Shift", activeShift.id, {
            totalHours: Math.round(totalHours * 100) / 100,
            earlyClockOut,
            incompleteReport: !hasReport,
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports/shift");
        revalidatePath("/admin/hours");

        return { success: true };
    } catch (error) {
        console.error("Clock out failed:", error);
        return {
            success: false,
            error: "Failed to clock out. Please try again.",
            details: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

/**
 * Get shifts with incomplete reports (for admin view)
 */
export async function getIncompleteReportShifts() {
    try {
        const session = await requireAuth();

        if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
            return { success: false, error: "Unauthorized", data: [] };
        }

        const shifts = await prisma.shift.findMany({
            where: {
                incompleteReportFlag: true,
                clockOut: { not: null },
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { clockOut: "desc" },
            take: 50,
        });

        return { success: true, data: shifts };
    } catch (error) {
        console.error("getIncompleteReportShifts error:", error);
        return { success: false, error: "Failed to get incomplete report shifts", data: [] };
    }
}

/**
 * Check if user can logout - blocks if they have an active shift without a submitted report
 */
export async function canLogout(): Promise<{
    success: boolean;
    data?: {
        allowed: boolean;
        reason?: string;
        hasActiveShift: boolean;
        hasSubmittedReport: boolean;
        shiftId?: string;
    };
    error?: string;
}> {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        // Only dispatchers need shift report validation
        if (session.user.role !== "DISPATCHER") {
            return { success: true, data: { allowed: true, hasActiveShift: false, hasSubmittedReport: true } };
        }

        // Get active shift
        const activeShift = await prisma.shift.findFirst({
            where: { userId, clockOut: null },
            include: {
                reports: {
                    where: { status: { in: ["SUBMITTED", "REVIEWED"] } },
                    take: 1,
                },
            },
        });

        if (!activeShift) {
            return { success: true, data: { allowed: true, hasActiveShift: false, hasSubmittedReport: true } };
        }

        const hasReport = activeShift.reports.length > 0;

        if (!hasReport) {
            return {
                success: true,
                data: {
                    allowed: false,
                    reason: "You must submit a shift report before logging out. Please complete your shift report first.",
                    hasActiveShift: true,
                    hasSubmittedReport: false,
                    shiftId: activeShift.id,
                },
            };
        }

        return {
            success: true,
            data: {
                allowed: true,
                hasActiveShift: true,
                hasSubmittedReport: true,
                shiftId: activeShift.id,
            },
        };
    } catch (error) {
        console.error("canLogout error:", error);
        return { success: false, error: "Failed to check logout status" };
    }
}

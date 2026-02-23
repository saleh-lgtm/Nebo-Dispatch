"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

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
        shiftStart: Date;
        shiftEnd: Date;
    } | null;
    hasSubmittedReport: boolean;
}

/**
 * Get current shift status for the logged-in user
 */
export async function getShiftStatus(): Promise<ShiftStatus> {
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
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scheduledShift = await prisma.schedule.findFirst({
        where: {
            userId,
            isPublished: true,
            shiftStart: {
                gte: today,
                lt: tomorrow,
            },
        },
    });

    return {
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
                  shiftStart: scheduledShift.shiftStart,
                  shiftEnd: scheduledShift.shiftEnd,
              }
            : null,
        hasSubmittedReport: activeShift ? activeShift.reports.length > 0 : false,
    };
}

/**
 * Clock in - creates a new shift with schedule comparison
 */
export async function clockIn(): Promise<{ success: boolean; shiftId?: string; error?: string }> {
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
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const scheduledShift = await prisma.schedule.findFirst({
        where: {
            userId,
            isPublished: true,
            shiftStart: {
                gte: todayStart,
                lt: todayEnd,
            },
        },
    });

    const clockInTime = new Date();
    let earlyClockIn: number | null = null;

    if (scheduledShift) {
        // Calculate minutes early (positive) or late (negative)
        const scheduledMs = scheduledShift.shiftStart.getTime();
        const actualMs = clockInTime.getTime();
        earlyClockIn = Math.round((scheduledMs - actualMs) / (1000 * 60));
    }

    // Create the shift
    const shift = await prisma.shift.create({
        data: {
            userId,
            clockIn: clockInTime,
            scheduledStart: scheduledShift?.shiftStart || null,
            scheduledEnd: scheduledShift?.shiftEnd || null,
            earlyClockIn,
        },
    });

    await createAuditLog(session.user.id, "CLOCK_IN", "Shift", shift.id, {
        earlyClockIn,
        scheduledStart: scheduledShift?.shiftStart,
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
}

/**
 * Clock out - requires shift report or flags for admin
 */
export async function clockOut(forceWithoutReport = false): Promise<{
    success: boolean;
    error?: string;
    requiresReport?: boolean;
}> {
    const session = await requireAuth();
    const userId = session.user.id;

    // Get active shift
    const activeShift = await prisma.shift.findFirst({
        where: { userId, clockOut: null },
        include: {
            reports: {
                where: { status: { in: ["SUBMITTED", "REVIEWED"] } },
            },
        },
    });

    if (!activeShift) {
        return { success: false, error: "Not clocked in" };
    }

    const hasReport = activeShift.reports.length > 0;

    // If no report and not forcing, require report
    if (!hasReport && !forceWithoutReport) {
        return {
            success: false,
            error: "Please complete your shift report before clocking out",
            requiresReport: true,
        };
    }

    const clockOutTime = new Date();
    const totalHours =
        (clockOutTime.getTime() - activeShift.clockIn.getTime()) / (1000 * 60 * 60);

    let earlyClockOut: number | null = null;
    if (activeShift.scheduledEnd) {
        // Calculate minutes early (positive) or late (negative)
        const scheduledMs = activeShift.scheduledEnd.getTime();
        const actualMs = clockOutTime.getTime();
        earlyClockOut = Math.round((scheduledMs - actualMs) / (1000 * 60));
    }

    // Update shift
    await prisma.shift.update({
        where: { id: activeShift.id },
        data: {
            clockOut: clockOutTime,
            totalHours: Math.round(totalHours * 100) / 100,
            earlyClockOut,
            incompleteReportFlag: !hasReport,
        },
    });

    // Reset all task completions for this dispatcher (Option A)
    // Admin tasks persist, but completions are reset for the next shift
    const deletedCompletions = await prisma.adminTaskCompletion.deleteMany({
        where: { userId },
    });

    if (deletedCompletions.count > 0) {
        await createAuditLog(
            session.user.id,
            "DELETE",
            "AdminTaskCompletion",
            "bulk",
            { action: "shift_reset", completionsCleared: deletedCompletions.count }
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
}

/**
 * Get shifts with incomplete reports (for admin view)
 */
export async function getIncompleteReportShifts() {
    const session = await requireAuth();

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        throw new Error("Unauthorized");
    }

    return await prisma.shift.findMany({
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
}

/**
 * Check if user can logout - blocks if they have an active shift without a submitted report
 */
export async function canLogout(): Promise<{
    allowed: boolean;
    reason?: string;
    hasActiveShift: boolean;
    hasSubmittedReport: boolean;
    shiftId?: string;
}> {
    const session = await requireAuth();
    const userId = session.user.id;

    // Only dispatchers need shift report validation
    if (session.user.role !== "DISPATCHER") {
        return { allowed: true, hasActiveShift: false, hasSubmittedReport: true };
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
        return { allowed: true, hasActiveShift: false, hasSubmittedReport: true };
    }

    const hasReport = activeShift.reports.length > 0;

    if (!hasReport) {
        return {
            allowed: false,
            reason: "You must submit a shift report before logging out. Please complete your shift report first.",
            hasActiveShift: true,
            hasSubmittedReport: false,
            shiftId: activeShift.id,
        };
    }

    return {
        allowed: true,
        hasActiveShift: true,
        hasSubmittedReport: true,
        shiftId: activeShift.id,
    };
}

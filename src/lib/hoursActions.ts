"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";

interface HoursSummary {
    userId: string;
    userName: string;
    scheduledHours: number;
    workedHours: number;
    overtime: number;
}

// Get hours summary for all dispatchers in a date range (ADMIN/SUPER_ADMIN only)
export async function getDispatcherHours(
    startDate: Date,
    endDate: Date
): Promise<HoursSummary[]> {
    await requireAdmin();

    // Get all schedules in date range
    const schedules = await prisma.schedule.findMany({
        where: {
            shiftStart: { gte: startDate },
            shiftEnd: { lte: endDate },
        },
        include: { user: { select: { id: true, name: true } } },
    });

    // Get actual worked shifts (clocked in/out)
    const shifts = await prisma.shift.findMany({
        where: {
            clockIn: { gte: startDate },
            clockOut: { lte: endDate, not: null },
        },
        include: { user: { select: { id: true, name: true } } },
    });

    // Aggregate by user
    const userMap = new Map<string, HoursSummary>();

    // Calculate scheduled hours
    for (const schedule of schedules) {
        const hours = (new Date(schedule.shiftEnd).getTime() - new Date(schedule.shiftStart).getTime()) / (1000 * 60 * 60);
        const existing = userMap.get(schedule.userId) || {
            userId: schedule.userId,
            userName: schedule.user.name || "Unknown",
            scheduledHours: 0,
            workedHours: 0,
            overtime: 0,
        };
        existing.scheduledHours += hours;
        userMap.set(schedule.userId, existing);
    }

    // Calculate worked hours
    for (const shift of shifts) {
        if (!shift.clockOut) continue;
        const hours = (new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime()) / (1000 * 60 * 60);
        const existing = userMap.get(shift.userId) || {
            userId: shift.userId,
            userName: shift.user.name || "Unknown",
            scheduledHours: 0,
            workedHours: 0,
            overtime: 0,
        };
        existing.workedHours += hours;
        userMap.set(shift.userId, existing);
    }

    // Calculate overtime (hours > 40 per week)
    for (const summary of userMap.values()) {
        summary.overtime = Math.max(0, summary.workedHours - 40);
        // Round to 1 decimal place
        summary.scheduledHours = Math.round(summary.scheduledHours * 10) / 10;
        summary.workedHours = Math.round(summary.workedHours * 10) / 10;
        summary.overtime = Math.round(summary.overtime * 10) / 10;
    }

    return Array.from(userMap.values()).sort((a, b) => b.scheduledHours - a.scheduledHours);
}

// Get weekly hours trend for a specific dispatcher (ADMIN/SUPER_ADMIN only)
export async function getWeeklyHoursTrend(userId: string, weeks: number = 4) {
    await requireAdmin();

    const results = [];
    const now = new Date();

    for (let w = 0; w < weeks; w++) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const schedules = await prisma.schedule.findMany({
            where: {
                userId,
                shiftStart: { gte: weekStart },
                shiftEnd: { lte: weekEnd },
            },
        });

        const hours = schedules.reduce((sum, s) => {
            return sum + (new Date(s.shiftEnd).getTime() - new Date(s.shiftStart).getTime()) / (1000 * 60 * 60);
        }, 0);

        results.unshift({
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            hours: Math.round(hours * 10) / 10,
        });
    }

    return results;
}

// Get all shifts for a date range with pagination
export async function getAllShifts(options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    limit?: number;
    offset?: number;
}) {
    await requireAdmin();

    const where: Record<string, unknown> = {};

    if (options.userId) {
        where.userId = options.userId;
    }

    if (options.startDate || options.endDate) {
        where.clockIn = {};
        if (options.startDate) {
            (where.clockIn as Record<string, Date>).gte = options.startDate;
        }
        if (options.endDate) {
            (where.clockIn as Record<string, Date>).lte = options.endDate;
        }
    }

    const [shifts, total] = await Promise.all([
        prisma.shift.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { clockIn: "desc" },
            take: options.limit || 50,
            skip: options.offset || 0,
        }),
        prisma.shift.count({ where }),
    ]);

    return { shifts, total };
}

// Get currently active shifts
export async function getActiveShifts() {
    await requireAdmin();

    const activeShifts = await prisma.shift.findMany({
        where: { clockOut: null },
        include: {
            user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { clockIn: "asc" },
    });

    return activeShifts.map((shift) => {
        const now = new Date();
        const hoursWorking = (now.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60);
        return {
            ...shift,
            currentHours: Math.round(hoursWorking * 100) / 100,
        };
    });
}

// Get team totals for a date range
export async function getTeamTotals(startDate: Date, endDate: Date) {
    await requireAdmin();

    const shifts = await prisma.shift.findMany({
        where: {
            clockIn: { gte: startDate },
            clockOut: { not: null, lte: endDate },
        },
        select: { totalHours: true },
    });

    const totalHours = shifts.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const totalShifts = shifts.length;
    const avgHoursPerShift = totalShifts > 0 ? totalHours / totalShifts : 0;

    return {
        totalHours: Math.round(totalHours * 100) / 100,
        totalShifts,
        avgHoursPerShift: Math.round(avgHoursPerShift * 100) / 100,
    };
}

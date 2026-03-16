"use server";

import prisma from "./prisma";

// Conflict types with severity levels
export interface ScheduleConflict {
    type: "overlap" | "insufficient_rest" | "time_off" | "overtime" | "preference_mismatch";
    severity: "error" | "warning";
    message: string;
    details?: {
        conflictingShiftId?: string;
        conflictingShiftStart?: Date;
        conflictingShiftEnd?: Date;
        hoursWorked?: number;
        maxHours?: number;
        restPeriodHours?: number;
    };
}

// Minimum rest period between shifts (in hours)
const MIN_REST_HOURS = 8;

// Maximum weekly hours before overtime warning
const MAX_WEEKLY_HOURS = 40;

// Maximum daily hours before warning
const MAX_DAILY_HOURS = 12;

interface DetectConflictsParams {
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    excludeScheduleId?: string; // Exclude when updating an existing schedule
}

/**
 * Detect scheduling conflicts for a proposed shift
 * Returns an array of conflicts (errors and warnings)
 */
export async function detectScheduleConflicts({
    userId,
    shiftStart,
    shiftEnd,
    excludeScheduleId,
}: DetectConflictsParams): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    // Get the week boundaries for the shift
    const weekStart = getWeekStart(shiftStart);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch relevant data in parallel
    const [existingSchedules, timeOffRequests, dispatcherPrefs] = await Promise.all([
        // Get all schedules for this user in the week
        prisma.schedule.findMany({
            where: {
                userId,
                shiftStart: { gte: weekStart, lt: weekEnd },
                ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
            },
            orderBy: { shiftStart: "asc" },
        }),

        // Get approved time off requests
        prisma.timeOffRequest.findMany({
            where: {
                userId,
                status: "APPROVED",
                OR: [
                    // Time off that overlaps with the proposed shift
                    { startDate: { lte: shiftEnd }, endDate: { gte: shiftStart } },
                ],
            },
        }),

        // Get dispatcher preferences
        prisma.dispatcherPreferences.findUnique({
            where: { userId },
        }),
    ]);

    // 1. Check for overlapping shifts (ERROR)
    for (const schedule of existingSchedules) {
        if (isOverlapping(shiftStart, shiftEnd, schedule.shiftStart, schedule.shiftEnd)) {
            conflicts.push({
                type: "overlap",
                severity: "error",
                message: `Shift overlaps with existing shift (${formatTimeRange(schedule.shiftStart, schedule.shiftEnd)})`,
                details: {
                    conflictingShiftId: schedule.id,
                    conflictingShiftStart: schedule.shiftStart,
                    conflictingShiftEnd: schedule.shiftEnd,
                },
            });
        }
    }

    // 2. Check for insufficient rest between shifts (WARNING)
    const allShifts = [...existingSchedules, { shiftStart, shiftEnd, id: "proposed" }].sort(
        (a, b) => a.shiftStart.getTime() - b.shiftStart.getTime()
    );

    for (let i = 0; i < allShifts.length - 1; i++) {
        const currentEnd = allShifts[i].shiftEnd;
        const nextStart = allShifts[i + 1].shiftStart;
        const restHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);

        if (restHours > 0 && restHours < MIN_REST_HOURS) {
            // Only warn if this involves the proposed shift
            if (allShifts[i].id === "proposed" || allShifts[i + 1].id === "proposed") {
                conflicts.push({
                    type: "insufficient_rest",
                    severity: "warning",
                    message: `Only ${restHours.toFixed(1)} hours of rest between shifts (minimum ${MIN_REST_HOURS} recommended)`,
                    details: {
                        restPeriodHours: restHours,
                    },
                });
            }
        }
    }

    // 3. Check for time off conflicts (ERROR)
    for (const timeOff of timeOffRequests) {
        conflicts.push({
            type: "time_off",
            severity: "error",
            message: `Dispatcher has approved time off from ${formatDate(timeOff.startDate)} to ${formatDate(timeOff.endDate)}`,
        });
    }

    // 4. Check weekly overtime (WARNING)
    const proposedHours = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
    const existingHours = existingSchedules.reduce((sum, s) => {
        return sum + (s.shiftEnd.getTime() - s.shiftStart.getTime()) / (1000 * 60 * 60);
    }, 0);
    const totalWeeklyHours = existingHours + proposedHours;

    if (totalWeeklyHours > MAX_WEEKLY_HOURS) {
        conflicts.push({
            type: "overtime",
            severity: "warning",
            message: `Total weekly hours (${totalWeeklyHours.toFixed(1)}) exceeds ${MAX_WEEKLY_HOURS} hours`,
            details: {
                hoursWorked: totalWeeklyHours,
                maxHours: MAX_WEEKLY_HOURS,
            },
        });
    }

    // 5. Check shift duration (WARNING)
    if (proposedHours > MAX_DAILY_HOURS) {
        conflicts.push({
            type: "overtime",
            severity: "warning",
            message: `Shift duration (${proposedHours.toFixed(1)} hours) exceeds ${MAX_DAILY_HOURS} hours`,
            details: {
                hoursWorked: proposedHours,
                maxHours: MAX_DAILY_HOURS,
            },
        });
    }

    // 6. Check dispatcher preferences (WARNING)
    if (dispatcherPrefs) {
        // Check max weekly hours preference
        if (dispatcherPrefs.maxHoursWeek && totalWeeklyHours > dispatcherPrefs.maxHoursWeek) {
            conflicts.push({
                type: "preference_mismatch",
                severity: "warning",
                message: `Exceeds dispatcher's preferred max hours (${dispatcherPrefs.maxHoursWeek}h/week)`,
                details: {
                    hoursWorked: totalWeeklyHours,
                    maxHours: dispatcherPrefs.maxHoursWeek,
                },
            });
        }

        // Check day preferences
        const dayName = getDayName(shiftStart.getUTCDay());
        if (dispatcherPrefs.preferredDays.length > 0 && !dispatcherPrefs.preferredDays.includes(dayName)) {
            conflicts.push({
                type: "preference_mismatch",
                severity: "warning",
                message: `${dayName} is not in dispatcher's preferred days`,
            });
        }

        // Check blackout dates
        const shiftDateStr = shiftStart.toISOString().slice(0, 10);
        if (dispatcherPrefs.blackoutDates.includes(shiftDateStr)) {
            conflicts.push({
                type: "time_off",
                severity: "warning",
                message: `${formatDate(shiftStart)} is marked as unavailable by the dispatcher`,
            });
        }
    }

    return conflicts;
}

/**
 * Quick check if there are any blocking (error-level) conflicts
 */
export async function hasBlockingConflicts(params: DetectConflictsParams): Promise<boolean> {
    const conflicts = await detectScheduleConflicts(params);
    return conflicts.some((c) => c.severity === "error");
}

/**
 * Get weekly hour summary for a dispatcher
 */
export async function getWeeklyHoursSummary(
    userId: string,
    weekStart: Date
): Promise<{
    totalHours: number;
    shiftsCount: number;
    isOvertime: boolean;
    maxHoursPreference?: number;
}> {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [schedules, prefs] = await Promise.all([
        prisma.schedule.findMany({
            where: {
                userId,
                shiftStart: { gte: weekStart, lt: weekEnd },
            },
        }),
        prisma.dispatcherPreferences.findUnique({
            where: { userId },
            select: { maxHoursWeek: true },
        }),
    ]);

    const totalHours = schedules.reduce((sum, s) => {
        return sum + (s.shiftEnd.getTime() - s.shiftStart.getTime()) / (1000 * 60 * 60);
    }, 0);

    const maxHours = prefs?.maxHoursWeek ?? MAX_WEEKLY_HOURS;

    return {
        totalHours,
        shiftsCount: schedules.length,
        isOvertime: totalHours > maxHours,
        maxHoursPreference: prefs?.maxHoursWeek ?? undefined,
    };
}

// Helper functions
function isOverlapping(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function formatTimeRange(start: Date, end: Date): string {
    const formatTime = (d: Date) =>
        d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Chicago",
        });
    const formatDay = (d: Date) =>
        d.toLocaleDateString("en-US", {
            weekday: "short",
            timeZone: "America/Chicago",
        });

    return `${formatDay(start)} ${formatTime(start)} - ${formatTime(end)}`;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Chicago",
    });
}

function getDayName(dayIndex: number): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayIndex];
}

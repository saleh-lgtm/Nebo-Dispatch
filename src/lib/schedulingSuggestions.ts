"use server";

import prisma from "./prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// Require admin access
async function requireAdmin() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
        throw new Error("Admin access required");
    }
    return session.user.id;
}

// Suggestion types
export interface SchedulingSuggestion {
    type: "gap_coverage" | "overtime_warning" | "preference_match" | "fairness" | "understaffed";
    priority: "high" | "medium" | "low";
    message: string;
    action?: {
        dispatcherId: string;
        dispatcherName: string;
        dayOfWeek: number;
        startHour: number;
        duration: number;
    };
}

// Helper to calculate shift duration from integer hours
function getShiftDuration(startHour: number, endHour: number): number {
    if (endHour > startHour) return endHour - startHour;
    return 24 - startHour + endHour; // Overnight shift
}

// Constants
const TARGET_HOURS_PER_WEEK = 40;
const MIN_DISPATCHERS_PER_SHIFT = 1;
const PREFERRED_SHIFT_SLOTS = [
    { name: "Morning", startHour: 6, endHour: 14 },
    { name: "Afternoon", startHour: 14, endHour: 22 },
    { name: "Night", startHour: 22, endHour: 6 }, // Wraps to next day
];

/**
 * Get scheduling suggestions for a week
 * Analyzes coverage gaps, dispatcher fairness, and preferences
 */
export async function getSchedulingSuggestions(
    weekStart: Date
): Promise<SchedulingSuggestion[]> {
    await requireAdmin();

    const suggestions: SchedulingSuggestion[] = [];

    // Normalize weekStart
    const normalizedWeekStart = new Date(weekStart);
    normalizedWeekStart.setUTCHours(0, 0, 0, 0);
    const day = normalizedWeekStart.getUTCDay();
    normalizedWeekStart.setUTCDate(normalizedWeekStart.getUTCDate() - day);

    const weekEnd = new Date(normalizedWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch data
    const [schedules, dispatchers, preferences] = await Promise.all([
        // Current week schedules
        prisma.schedule.findMany({
            where: {
                date: { gte: normalizedWeekStart, lt: weekEnd },
            },
            include: {
                user: { select: { id: true, name: true } },
            },
        }),

        // All active dispatchers
        prisma.user.findMany({
            where: {
                role: "DISPATCHER",
                isActive: true,
                approvalStatus: "APPROVED",
            },
            select: { id: true, name: true },
        }),

        // Dispatcher preferences
        prisma.dispatcherPreferences.findMany({
            include: { user: { select: { id: true, name: true } } },
        }),
    ]);

    // Calculate hours per dispatcher
    const hoursPerDispatcher = new Map<string, number>();
    const dispatcherNames = new Map<string, string>();

    for (const dispatcher of dispatchers) {
        hoursPerDispatcher.set(dispatcher.id, 0);
        dispatcherNames.set(dispatcher.id, dispatcher.name || "Unknown");
    }

    for (const schedule of schedules) {
        const hours = getShiftDuration(schedule.startHour, schedule.endHour);
        const current = hoursPerDispatcher.get(schedule.userId) || 0;
        hoursPerDispatcher.set(schedule.userId, current + hours);
    }

    // Build preference map
    const prefMap = new Map(preferences.map((p) => [p.userId, p]));

    // 1. Analyze coverage gaps (by day and shift period)
    const coverageByDayShift = analyzeCoverage(schedules, normalizedWeekStart);

    for (const { dayOfWeek, period, coverage, suggestedStart, suggestedDuration } of coverageByDayShift) {
        if (coverage < MIN_DISPATCHERS_PER_SHIFT) {
            // Find best dispatcher for this gap
            const bestDispatcher = findBestDispatcherForSlot(
                dayOfWeek,
                suggestedStart,
                hoursPerDispatcher,
                prefMap,
                dispatcherNames
            );

            if (bestDispatcher) {
                suggestions.push({
                    type: "gap_coverage",
                    priority: "high",
                    message: `No coverage on ${getDayName(dayOfWeek)} ${period}. ${bestDispatcher.name} is a good match.`,
                    action: {
                        dispatcherId: bestDispatcher.id,
                        dispatcherName: bestDispatcher.name,
                        dayOfWeek,
                        startHour: suggestedStart,
                        duration: suggestedDuration,
                    },
                });
            } else {
                suggestions.push({
                    type: "understaffed",
                    priority: "high",
                    message: `No coverage on ${getDayName(dayOfWeek)} ${period}. Consider scheduling a dispatcher.`,
                });
            }
        }
    }

    // 2. Fairness analysis - dispatchers with too few or too many hours
    const avgHours = Array.from(hoursPerDispatcher.values()).reduce((a, b) => a + b, 0) / hoursPerDispatcher.size || 0;

    for (const [dispatcherId, hours] of hoursPerDispatcher) {
        const name = dispatcherNames.get(dispatcherId) || "Unknown";
        const pref = prefMap.get(dispatcherId);
        const minHours = pref?.minHoursWeek ?? 20;
        const maxHours = pref?.maxHoursWeek ?? TARGET_HOURS_PER_WEEK;

        // Dispatcher has too few hours
        if (hours < minHours && hours < avgHours - 10) {
            suggestions.push({
                type: "fairness",
                priority: "medium",
                message: `${name} has only ${hours.toFixed(1)}h scheduled (prefers ${minHours}h minimum). Consider adding shifts.`,
            });
        }

        // Dispatcher approaching overtime
        if (hours > maxHours) {
            suggestions.push({
                type: "overtime_warning",
                priority: "medium",
                message: `${name} is at ${hours.toFixed(1)}h, exceeding their ${maxHours}h preference.`,
            });
        }
    }

    // 3. Preference-based suggestions
    for (const pref of preferences) {
        const dispatcherHours = hoursPerDispatcher.get(pref.userId) || 0;
        const name = pref.user.name || "Unknown";

        // If dispatcher prefers specific days but isn't scheduled on them
        if (pref.preferredDays.length > 0 && dispatcherHours < (pref.minHoursWeek ?? 20)) {
            const scheduledDays = new Set(
                schedules
                    .filter((s) => s.userId === pref.userId)
                    .map((s) => getDayName(new Date(s.date).getUTCDay()))
            );

            const unscheduledPreferredDays = pref.preferredDays.filter((d) => !scheduledDays.has(d));

            if (unscheduledPreferredDays.length > 0) {
                const dayIndex = getDayIndex(unscheduledPreferredDays[0]);
                const startHour = getPreferredStartHour(pref.preferredShifts);

                suggestions.push({
                    type: "preference_match",
                    priority: "low",
                    message: `${name} prefers ${unscheduledPreferredDays.join(", ")} but isn't scheduled.`,
                    action: {
                        dispatcherId: pref.userId,
                        dispatcherName: name,
                        dayOfWeek: dayIndex,
                        startHour,
                        duration: 8,
                    },
                });
            }
        }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
}

// Analyze coverage by day and shift period
// Using new schedule model with date/startHour/endHour
function analyzeCoverage(
    schedules: Array<{ date: Date; startHour: number; endHour: number }>,
    weekStart: Date
) {
    const gaps: Array<{
        dayOfWeek: number;
        period: string;
        coverage: number;
        suggestedStart: number;
        suggestedDuration: number;
    }> = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const targetDate = new Date(weekStart);
        targetDate.setUTCDate(targetDate.getUTCDate() + dayOfWeek);
        targetDate.setUTCHours(0, 0, 0, 0);

        for (const slot of PREFERRED_SHIFT_SLOTS) {
            // Count schedules for this day that cover this slot
            const coverage = schedules.filter((s) => {
                const schedDate = new Date(s.date);
                schedDate.setUTCHours(0, 0, 0, 0);
                if (schedDate.getTime() !== targetDate.getTime()) return false;

                // Check if shift covers this slot (simplified check)
                const isOvernight = s.endHour <= s.startHour;
                if (isOvernight) {
                    // Overnight shift covers this slot if:
                    // - slot starts before shift ends, or
                    // - slot starts after shift starts
                    return s.startHour <= slot.endHour || slot.startHour >= s.startHour || slot.startHour < s.endHour;
                }
                // Regular shift: check overlap
                return s.startHour < slot.endHour && s.endHour > slot.startHour;
            }).length;

            gaps.push({
                dayOfWeek,
                period: slot.name,
                coverage,
                suggestedStart: slot.startHour,
                suggestedDuration: 8,
            });
        }
    }

    return gaps.filter((g) => g.coverage < MIN_DISPATCHERS_PER_SHIFT);
}

// Find the best dispatcher for a slot based on hours and preferences
function findBestDispatcherForSlot(
    dayOfWeek: number,
    startHour: number,
    hoursPerDispatcher: Map<string, number>,
    prefMap: Map<string, {
        preferredDays: string[];
        preferredShifts: string[];
        maxHoursWeek: number | null;
        minHoursWeek: number | null;
    }>,
    dispatcherNames: Map<string, string>
): { id: string; name: string } | null {
    const dayName = getDayName(dayOfWeek);
    const shiftPeriod = getShiftPeriod(startHour);

    let bestScore = -Infinity;
    let bestDispatcher: { id: string; name: string } | null = null;

    for (const [dispatcherId, hours] of hoursPerDispatcher) {
        const pref = prefMap.get(dispatcherId);
        const maxHours = pref?.maxHoursWeek ?? TARGET_HOURS_PER_WEEK;

        // Skip if already at max hours
        if (hours >= maxHours) continue;

        let score = 0;

        // Prefer dispatchers with fewer hours (fairness)
        score += (TARGET_HOURS_PER_WEEK - hours) * 2;

        // Bonus for day preference match
        if (pref?.preferredDays.includes(dayName)) {
            score += 20;
        }

        // Bonus for shift period preference match
        if (pref?.preferredShifts.includes(shiftPeriod)) {
            score += 15;
        }

        // Penalty if below minimum hours (incentivize filling them first)
        if (pref?.minHoursWeek && hours < pref.minHoursWeek) {
            score += 10;
        }

        if (score > bestScore) {
            bestScore = score;
            bestDispatcher = {
                id: dispatcherId,
                name: dispatcherNames.get(dispatcherId) || "Unknown",
            };
        }
    }

    return bestDispatcher;
}

// Helper functions
function getDayName(dayIndex: number): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayIndex];
}

function getDayIndex(dayName: string): number {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days.indexOf(dayName);
}

function getShiftPeriod(hour: number): string {
    if (hour >= 6 && hour < 14) return "Morning";
    if (hour >= 14 && hour < 22) return "Evening";
    return "Night";
}

function getPreferredStartHour(preferredShifts: string[]): number {
    if (preferredShifts.includes("Morning")) return 6;
    if (preferredShifts.includes("Evening")) return 14;
    if (preferredShifts.includes("Night")) return 22;
    return 8; // Default
}

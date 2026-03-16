"use server";

import prisma from "./prisma";
import type { ValidationError, Market } from "@/types/schedule";
import { getWeekStart, addDays, getShiftDuration, formatHour, DAY_NAMES_FULL } from "@/types/schedule";

// Minimum rest period between shifts (in hours)
const MIN_REST_HOURS = 8;

// Maximum weekly hours before overtime warning
const MAX_WEEKLY_HOURS = 40;

// Maximum daily hours before warning
const MAX_DAILY_HOURS = 12;

interface DetectConflictsParams {
  userId: string;
  date: Date;
  startHour: number;
  endHour: number;
  excludeScheduleId?: string;
}

/**
 * Detect scheduling conflicts for a proposed shift
 * NO TIMEZONE CONVERSION - hours are just integers
 */
export async function detectScheduleConflicts({
  userId,
  date,
  startHour,
  endHour,
  excludeScheduleId,
}: DetectConflictsParams): Promise<ValidationError[]> {
  const conflicts: ValidationError[] = [];

  const weekStart = getWeekStart(date);

  // Fetch relevant data in parallel
  const [existingSchedules, timeOffRequests, dispatcherPrefs] = await Promise.all([
    // Get all schedules for this user in the week
    prisma.schedule.findMany({
      where: {
        userId,
        weekStart,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
      orderBy: [{ date: "asc" }, { startHour: "asc" }],
    }),

    // Get approved time off requests that overlap with this date
    prisma.timeOffRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: date },
        endDate: { gte: date },
      },
    }),

    // Get dispatcher preferences
    prisma.dispatcherPreferences.findUnique({
      where: { userId },
    }),
  ]);

  // 1. Check for overlapping shifts on the same date (ERROR)
  const sameDaySchedules = existingSchedules.filter(
    (s) => s.date.toDateString() === date.toDateString()
  );

  for (const schedule of sameDaySchedules) {
    if (shiftsOverlap({ startHour, endHour }, { startHour: schedule.startHour, endHour: schedule.endHour })) {
      const existingDisplay = `${formatHour(schedule.startHour)}-${formatHour(schedule.endHour)}`;
      conflicts.push({
        type: "overlap",
        severity: "error",
        message: `Overlaps with existing shift (${existingDisplay})`,
        userId,
        date,
      });
    }
  }

  // 2. Check for time off conflicts (ERROR)
  if (timeOffRequests.length > 0) {
    const timeOff = timeOffRequests[0];
    conflicts.push({
      type: "time_off",
      severity: "error",
      message: `Dispatcher has approved time off from ${formatDateSimple(timeOff.startDate)} to ${formatDateSimple(timeOff.endDate)}`,
      userId,
      date,
    });
  }

  // 3. Check weekly overtime (WARNING)
  const proposedHours = getShiftDuration(startHour, endHour);
  const existingHours = existingSchedules.reduce(
    (sum, s) => sum + getShiftDuration(s.startHour, s.endHour),
    0
  );
  const totalWeeklyHours = existingHours + proposedHours;

  if (totalWeeklyHours > MAX_WEEKLY_HOURS) {
    conflicts.push({
      type: "overtime",
      severity: "warning",
      message: `Total weekly hours (${totalWeeklyHours}) exceeds ${MAX_WEEKLY_HOURS} hours`,
      userId,
    });
  }

  // 4. Check shift duration (WARNING)
  if (proposedHours > MAX_DAILY_HOURS) {
    conflicts.push({
      type: "overtime",
      severity: "warning",
      message: `Shift duration (${proposedHours} hours) exceeds ${MAX_DAILY_HOURS} hours`,
      userId,
      date,
    });
  }

  // 5. Check dispatcher preferences (WARNING)
  if (dispatcherPrefs) {
    // Check max weekly hours preference
    if (dispatcherPrefs.maxHoursWeek && totalWeeklyHours > dispatcherPrefs.maxHoursWeek) {
      conflicts.push({
        type: "overtime",
        severity: "warning",
        message: `Exceeds dispatcher's preferred max hours (${dispatcherPrefs.maxHoursWeek}h/week)`,
        userId,
      });
    }

    // Check day preferences (0=Mon, 6=Sun in our system)
    const dayIndex = getDayIndexFromDate(date);
    const dayName = DAY_NAMES_FULL[dayIndex];
    if (dispatcherPrefs.preferredDays.length > 0 && !dispatcherPrefs.preferredDays.includes(dayName)) {
      conflicts.push({
        type: "consecutive_days",
        severity: "warning",
        message: `${dayName} is not in dispatcher's preferred days`,
        userId,
        date,
      });
    }

    // Check blackout dates
    const dateStr = date.toISOString().slice(0, 10);
    if (dispatcherPrefs.blackoutDates.includes(dateStr)) {
      conflicts.push({
        type: "time_off",
        severity: "warning",
        message: `${formatDateSimple(date)} is marked as unavailable by the dispatcher`,
        userId,
        date,
      });
    }
  }

  // 6. Check for insufficient rest between shifts (WARNING)
  // This is tricky with the new model - we need to look at adjacent days
  const prevDaySchedules = await prisma.schedule.findMany({
    where: {
      userId,
      date: addDays(date, -1),
    },
  });

  const nextDaySchedules = await prisma.schedule.findMany({
    where: {
      userId,
      date: addDays(date, 1),
    },
  });

  // Check rest after previous day's shifts
  for (const prevShift of prevDaySchedules) {
    const prevEndHour = prevShift.endHour;
    // If previous shift ends late and this shift starts early
    // Calculate rest: hours from prevEnd to midnight + hours from midnight to start
    let restHours: number;
    if (prevShift.endHour <= prevShift.startHour) {
      // Previous was overnight, ends on this day
      restHours = startHour - prevEndHour;
    } else {
      // Previous ended same day, rest = (24 - prevEnd) + start
      restHours = (24 - prevEndHour) + startHour;
    }

    if (restHours > 0 && restHours < MIN_REST_HOURS) {
      conflicts.push({
        type: "consecutive_days",
        severity: "warning",
        message: `Only ${restHours} hours rest after previous day's shift (minimum ${MIN_REST_HOURS} recommended)`,
        userId,
        date,
      });
    }
  }

  // Check rest before next day's shifts
  for (const nextShift of nextDaySchedules) {
    let restHours: number;
    if (endHour <= startHour) {
      // This shift is overnight, ends on next day
      restHours = nextShift.startHour - endHour;
    } else {
      // This shift ends today
      restHours = (24 - endHour) + nextShift.startHour;
    }

    if (restHours > 0 && restHours < MIN_REST_HOURS) {
      conflicts.push({
        type: "consecutive_days",
        severity: "warning",
        message: `Only ${restHours} hours rest before next day's shift (minimum ${MIN_REST_HOURS} recommended)`,
        userId,
        date,
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
  const normalized = getWeekStart(weekStart);

  const [schedules, prefs] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        userId,
        weekStart: normalized,
      },
    }),
    prisma.dispatcherPreferences.findUnique({
      where: { userId },
      select: { maxHoursWeek: true },
    }),
  ]);

  const totalHours = schedules.reduce(
    (sum, s) => sum + getShiftDuration(s.startHour, s.endHour),
    0
  );

  const maxHours = prefs?.maxHoursWeek ?? MAX_WEEKLY_HOURS;

  return {
    totalHours,
    shiftsCount: schedules.length,
    isOvertime: totalHours > maxHours,
    maxHoursPreference: prefs?.maxHoursWeek ?? undefined,
  };
}

/**
 * Check coverage gaps for a week
 */
export async function checkWeekCoverageGaps(
  weekStart: Date,
  requiredMarkets: Market[] = ["DFW", "AUS", "SAT"]
): Promise<ValidationError[]> {
  const normalized = getWeekStart(weekStart);
  const warnings: ValidationError[] = [];

  const schedules = await prisma.schedule.findMany({
    where: { weekStart: normalized },
  });

  // Check each day
  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(normalized, i);
    const daySchedules = schedules.filter(
      (s) => s.date.toDateString() === dayDate.toDateString()
    );

    if (daySchedules.length === 0) {
      warnings.push({
        type: "no_coverage",
        severity: "warning",
        message: `No coverage on ${DAY_NAMES_FULL[i]}`,
        date: dayDate,
      });
      continue;
    }

    // Check market coverage
    const marketsWithCoverage = new Set(daySchedules.map((s) => s.market).filter(Boolean));
    for (const market of requiredMarkets) {
      if (!marketsWithCoverage.has(market)) {
        warnings.push({
          type: "no_coverage",
          severity: "warning",
          message: `No ${market} coverage on ${DAY_NAMES_FULL[i]}`,
          date: dayDate,
        });
      }
    }
  }

  return warnings;
}

// ============ HELPER FUNCTIONS ============

/**
 * Check if two shifts overlap (accounting for overnight shifts)
 */
function shiftsOverlap(
  a: { startHour: number; endHour: number },
  b: { startHour: number; endHour: number }
): boolean {
  const getHourSet = (start: number, end: number): Set<number> => {
    const hours = new Set<number>();
    if (end > start) {
      for (let h = start; h < end; h++) hours.add(h);
    } else {
      // Overnight
      for (let h = start; h < 24; h++) hours.add(h);
      for (let h = 0; h < end; h++) hours.add(h);
    }
    return hours;
  };

  const aHours = getHourSet(a.startHour, a.endHour);
  const bHours = getHourSet(b.startHour, b.endHour);

  for (const h of aHours) {
    if (bHours.has(h)) return true;
  }
  return false;
}

/**
 * Get day index (0=Mon, 6=Sun) from a Date
 */
function getDayIndexFromDate(date: Date): number {
  const jsDay = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon, 6=Sun
}

/**
 * Format date simply
 */
function formatDateSimple(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

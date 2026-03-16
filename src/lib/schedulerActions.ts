"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { notifySchedulePublished } from "./notificationActions";
import type {
  Dispatcher,
  ScheduleRecord,
  ScheduleInput,
  WeekScheduleData,
  ValidationError,
  Market,
  ShiftType,
} from "@/types/schedule";
import { getWeekStart, addDays, getShiftDuration } from "@/types/schedule";

// ============ QUERY FUNCTIONS ============

/**
 * Get all active dispatchers
 */
export async function getDispatchers(): Promise<Dispatcher[]> {
  await requireAdmin();

  return prisma.user.findMany({
    where: { role: "DISPATCHER", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get schedules for a week (Monday-Sunday)
 */
export async function getWeekSchedules(weekStart: Date): Promise<WeekScheduleData> {
  await requireAdmin();

  const normalizedWeekStart = getWeekStart(weekStart);
  const weekEnd = addDays(normalizedWeekStart, 7);

  const schedules = await prisma.schedule.findMany({
    where: {
      weekStart: normalizedWeekStart,
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
  });

  const records: ScheduleRecord[] = schedules.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.user.name,
    date: s.date,
    startHour: s.startHour,
    endHour: s.endHour,
    market: s.market as Market | null,
    shiftType: s.shiftType as ShiftType,
    isPublished: s.isPublished,
    notes: s.notes,
  }));

  const isPublished = schedules.length > 0 && schedules.some((s) => s.isPublished);

  return {
    schedules: records,
    weekStart: normalizedWeekStart,
    weekEnd,
    isPublished,
  };
}

/**
 * Get a single schedule by ID
 */
export async function getSchedule(id: string): Promise<ScheduleRecord | null> {
  await requireAdmin();

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!schedule) return null;

  return {
    id: schedule.id,
    userId: schedule.userId,
    userName: schedule.user.name,
    date: schedule.date,
    startHour: schedule.startHour,
    endHour: schedule.endHour,
    market: schedule.market as Market | null,
    shiftType: schedule.shiftType as ShiftType,
    isPublished: schedule.isPublished,
    notes: schedule.notes,
  };
}

// ============ MUTATION FUNCTIONS ============

/**
 * Create a new schedule
 */
export async function createSchedule(data: ScheduleInput): Promise<{
  success: boolean;
  schedule?: ScheduleRecord;
  errors?: ValidationError[];
}> {
  try {
    const session = await requireAdmin();

    // Validate hours
    if (data.startHour < 0 || data.startHour > 23 || data.endHour < 0 || data.endHour > 23) {
      return {
        success: false,
        errors: [{ type: "invalid_hours", severity: "error", message: "Hours must be between 0 and 23" }],
      };
    }

    // Check for overlaps
    const overlaps = await checkOverlaps(data.userId, data.date, data.startHour, data.endHour);
    if (overlaps.length > 0) {
      return { success: false, errors: overlaps };
    }

    const weekStart = getWeekStart(data.date);

    const schedule = await prisma.schedule.create({
      data: {
        userId: data.userId,
        date: data.date,
        startHour: data.startHour,
        endHour: data.endHour,
        market: data.market,
        shiftType: data.shiftType || "CUSTOM",
        weekStart,
        isPublished: false,
        notes: data.notes,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await createAuditLog(session.user.id, "CREATE", "Schedule", schedule.id, {
      userId: data.userId,
      date: data.date,
      startHour: data.startHour,
      endHour: data.endHour,
      market: data.market,
    });

    revalidatePath("/admin/scheduler");

    return {
      success: true,
      schedule: {
        id: schedule.id,
        userId: schedule.userId,
        userName: schedule.user.name,
        date: schedule.date,
        startHour: schedule.startHour,
        endHour: schedule.endHour,
        market: schedule.market as Market | null,
        shiftType: schedule.shiftType as ShiftType,
        isPublished: schedule.isPublished,
        notes: schedule.notes,
      },
    };
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return {
      success: false,
      errors: [{ type: "overlap", severity: "error", message: "Failed to create shift. Please try again." }],
    };
  }
}

/**
 * Update an existing schedule
 */
export async function updateSchedule(
  id: string,
  data: Partial<ScheduleInput>
): Promise<{
  success: boolean;
  schedule?: ScheduleRecord;
  errors?: ValidationError[];
}> {
  try {
    const session = await requireAdmin();

    const existing = await prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      return {
        success: false,
        errors: [{ type: "overlap", severity: "error", message: "Schedule not found" }],
      };
    }

    // Merge with existing data for validation
    const finalData = {
      userId: data.userId ?? existing.userId,
      date: data.date ?? existing.date,
      startHour: data.startHour ?? existing.startHour,
      endHour: data.endHour ?? existing.endHour,
    };

    // Validate hours if changed
    if (data.startHour !== undefined || data.endHour !== undefined) {
      if (finalData.startHour < 0 || finalData.startHour > 23 || finalData.endHour < 0 || finalData.endHour > 23) {
        return {
          success: false,
          errors: [{ type: "invalid_hours", severity: "error", message: "Hours must be between 0 and 23" }],
        };
      }
    }

    // Check for overlaps (excluding self)
    const overlaps = await checkOverlaps(finalData.userId, finalData.date, finalData.startHour, finalData.endHour, id);
    if (overlaps.length > 0) {
      return { success: false, errors: overlaps };
    }

    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) {
      updateData.date = data.date;
      updateData.weekStart = getWeekStart(data.date);
    }
    if (data.startHour !== undefined) updateData.startHour = data.startHour;
    if (data.endHour !== undefined) updateData.endHour = data.endHour;
    if (data.market !== undefined) updateData.market = data.market;
    if (data.shiftType !== undefined) updateData.shiftType = data.shiftType;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: { user: { select: { id: true, name: true } } },
    });

    await createAuditLog(session.user.id, "UPDATE", "Schedule", id, data);

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");

    return {
      success: true,
      schedule: {
        id: schedule.id,
        userId: schedule.userId,
        userName: schedule.user.name,
        date: schedule.date,
        startHour: schedule.startHour,
        endHour: schedule.endHour,
        market: schedule.market as Market | null,
        shiftType: schedule.shiftType as ShiftType,
        isPublished: schedule.isPublished,
        notes: schedule.notes,
      },
    };
  } catch (error) {
    console.error("Failed to update schedule:", error);
    return {
      success: false,
      errors: [{ type: "overlap", severity: "error", message: "Failed to update shift. Please try again." }],
    };
  }
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();

    await prisma.schedule.delete({ where: { id } });

    await createAuditLog(session.user.id, "DELETE", "Schedule", id);

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete schedule:", error);
    return { success: false, error: "Failed to delete shift. Please try again." };
  }
}

// ============ BULK OPERATIONS ============

/**
 * Preview what would be copied from previous week
 */
export async function previewCopyPreviousWeek(targetWeekStart: Date): Promise<{
  schedules: ScheduleRecord[];
  conflicts: string[];
}> {
  await requireAdmin();

  const normalized = getWeekStart(targetWeekStart);
  const prevWeekStart = addDays(normalized, -7);

  const prevSchedules = await prisma.schedule.findMany({
    where: { weekStart: prevWeekStart },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
  });

  // Check for existing schedules in target week
  const existingCount = await prisma.schedule.count({
    where: { weekStart: normalized },
  });

  const conflicts: string[] = [];
  if (existingCount > 0) {
    conflicts.push(`Target week has ${existingCount} existing schedule(s). Clear first.`);
  }

  const schedules: ScheduleRecord[] = prevSchedules.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.user.name,
    date: addDays(s.date, 7), // Preview with +7 days
    startHour: s.startHour,
    endHour: s.endHour,
    market: s.market as Market | null,
    shiftType: s.shiftType as ShiftType,
    isPublished: false,
    notes: null,
  }));

  return { schedules, conflicts };
}

/**
 * Copy previous week's schedules to target week
 * NO TIMEZONE CONVERSION - just add 7 days to each date
 */
export async function copyPreviousWeek(targetWeekStart: Date): Promise<{
  success: boolean;
  copied: number;
  skipped: number;
  errors: string[];
}> {
  try {
    const session = await requireAdmin();

    const normalized = getWeekStart(targetWeekStart);
    const prevWeekStart = addDays(normalized, -7);

    // Get previous week's schedules
    const prevSchedules = await prisma.schedule.findMany({
      where: { weekStart: prevWeekStart },
      include: { user: { select: { id: true, name: true } } },
    });

    if (prevSchedules.length === 0) {
      return { success: false, copied: 0, skipped: 0, errors: ["No schedules in previous week"] };
    }

    // Check target week is empty
    const existingCount = await prisma.schedule.count({
      where: { weekStart: normalized },
    });

    if (existingCount > 0) {
      return {
        success: false,
        copied: 0,
        skipped: existingCount,
        errors: [`Target week has ${existingCount} existing schedules. Clear first.`],
      };
    }

    // Create new schedules with dates shifted +7 days
    // NO TIMEZONE CONVERSION - just add 7 days to the date
    // startHour and endHour are UNCHANGED - they're just integers
    const newSchedules = prevSchedules.map((s) => ({
      userId: s.userId,
      date: addDays(s.date, 7),
      startHour: s.startHour, // UNCHANGED
      endHour: s.endHour, // UNCHANGED
      market: s.market, // UNCHANGED
      shiftType: s.shiftType, // UNCHANGED
      weekStart: normalized,
      isPublished: false,
      notes: null, // Don't copy notes
    }));

    await prisma.schedule.createMany({ data: newSchedules });

    await createAuditLog(session.user.id, "CREATE", "Schedule", undefined, {
      action: "copy_previous_week",
      sourceWeek: prevWeekStart.toISOString(),
      targetWeek: normalized.toISOString(),
      copiedCount: newSchedules.length,
    });

    revalidatePath("/admin/scheduler");

    return { success: true, copied: newSchedules.length, skipped: 0, errors: [] };
  } catch (error) {
    console.error("Failed to copy schedules:", error);
    return { success: false, copied: 0, skipped: 0, errors: ["Failed to copy schedules. Please try again."] };
  }
}

/**
 * Clear all schedules for a week
 */
export async function clearWeekSchedules(weekStart: Date): Promise<{
  success: boolean;
  deleted: number;
  error?: string;
}> {
  try {
    const session = await requireAdmin();

    const normalized = getWeekStart(weekStart);

    const result = await prisma.schedule.deleteMany({
      where: { weekStart: normalized },
    });

    await createAuditLog(session.user.id, "DELETE", "Schedule", undefined, {
      action: "clear_week",
      weekStart: normalized.toISOString(),
      deletedCount: result.count,
    });

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");

    return { success: true, deleted: result.count };
  } catch (error) {
    console.error("Failed to clear schedules:", error);
    return { success: false, deleted: 0, error: "Failed to clear schedules. Please try again." };
  }
}

/**
 * Publish all schedules for a week
 */
export async function publishWeek(weekStart: Date): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = await requireAdmin();

    const normalized = getWeekStart(weekStart);

    const result = await prisma.schedule.updateMany({
      where: { weekStart: normalized },
      data: { isPublished: true },
    });

    await createAuditLog(session.user.id, "UPDATE", "Schedule", undefined, {
      action: "publish_week",
      weekStart: normalized.toISOString(),
      count: result.count,
    });

    // Notify dispatchers
    await notifySchedulePublished(normalized);

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Failed to publish schedules:", error);
    return { success: false, count: 0, error: "Failed to publish schedule. Please try again." };
  }
}

/**
 * Unpublish all schedules for a week
 */
export async function unpublishWeek(weekStart: Date): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = await requireAdmin();

    const normalized = getWeekStart(weekStart);

    const result = await prisma.schedule.updateMany({
      where: { weekStart: normalized },
      data: { isPublished: false },
    });

    await createAuditLog(session.user.id, "UPDATE", "Schedule", undefined, {
      action: "unpublish_week",
      weekStart: normalized.toISOString(),
      count: result.count,
    });

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Failed to unpublish schedules:", error);
    return { success: false, count: 0, error: "Failed to unpublish schedule. Please try again." };
  }
}

// ============ VALIDATION HELPERS ============

/**
 * Check if two shifts overlap (accounting for overnight shifts)
 */
function shiftsOverlap(a: { startHour: number; endHour: number }, b: { startHour: number; endHour: number }): boolean {
  // Convert to hour ranges, handling overnight wrapping
  const getHourSet = (start: number, end: number): Set<number> => {
    const hours = new Set<number>();
    if (end > start) {
      // Normal shift
      for (let h = start; h < end; h++) hours.add(h);
    } else {
      // Overnight shift
      for (let h = start; h < 24; h++) hours.add(h);
      for (let h = 0; h < end; h++) hours.add(h);
    }
    return hours;
  };

  const aHours = getHourSet(a.startHour, a.endHour);
  const bHours = getHourSet(b.startHour, b.endHour);

  // Check intersection
  for (const h of aHours) {
    if (bHours.has(h)) return true;
  }
  return false;
}

/**
 * Check for overlapping schedules on the same date for the same user
 */
async function checkOverlaps(
  userId: string,
  date: Date,
  startHour: number,
  endHour: number,
  excludeId?: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Get existing schedules for this user on this date
  const existing = await prisma.schedule.findMany({
    where: {
      userId,
      date,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  for (const schedule of existing) {
    if (shiftsOverlap({ startHour, endHour }, { startHour: schedule.startHour, endHour: schedule.endHour })) {
      const existingDisplay = `${formatHourSimple(schedule.startHour)}-${formatHourSimple(schedule.endHour)}`;
      errors.push({
        type: "overlap",
        severity: "error",
        message: `Overlaps with existing shift (${existingDisplay})`,
        userId,
        date,
      });
    }
  }

  return errors;
}

function formatHourSimple(h: number): string {
  if (h === 0) return "12A";
  if (h < 12) return `${h}A`;
  if (h === 12) return "12P";
  return `${h - 12}P`;
}

// ============ COVERAGE REPORT ============

/**
 * Get coverage report for a week
 */
export async function getWeekCoverageReport(weekStart: Date): Promise<{
  byDay: { date: Date; dayName: string; shifts: number; hours: number; markets: (Market | null)[] }[];
  totalHours: number;
  dispatcherHours: { userId: string; name: string; hours: number }[];
}> {
  await requireAdmin();

  const normalized = getWeekStart(weekStart);
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const schedules = await prisma.schedule.findMany({
    where: { weekStart: normalized },
    include: { user: { select: { id: true, name: true } } },
  });

  // Group by day
  const byDay = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(normalized, i);
    const daySchedules = schedules.filter(
      (s) => s.date.toDateString() === dayDate.toDateString()
    );

    const hours = daySchedules.reduce((sum, s) => sum + getShiftDuration(s.startHour, s.endHour), 0);
    const markets = [...new Set(daySchedules.map((s) => s.market as Market | null))];

    byDay.push({
      date: dayDate,
      dayName: DAY_NAMES[i],
      shifts: daySchedules.length,
      hours,
      markets,
    });
  }

  // Total hours
  const totalHours = schedules.reduce((sum, s) => sum + getShiftDuration(s.startHour, s.endHour), 0);

  // Hours by dispatcher
  const dispatcherMap = new Map<string, { name: string; hours: number }>();
  for (const s of schedules) {
    const existing = dispatcherMap.get(s.userId) || { name: s.user.name || "Unknown", hours: 0 };
    existing.hours += getShiftDuration(s.startHour, s.endHour);
    dispatcherMap.set(s.userId, existing);
  }

  const dispatcherHours = Array.from(dispatcherMap.entries())
    .map(([userId, data]) => ({ userId, name: data.name, hours: data.hours }))
    .sort((a, b) => b.hours - a.hours);

  return { byDay, totalHours, dispatcherHours };
}

// ============ DISPATCHER VIEW ============

/**
 * Get user's next scheduled shift (for any authenticated user)
 */
export async function getUserNextShift(userId: string) {
  await requireAuth();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.schedule.findFirst({
    where: {
      userId,
      isPublished: true,
      date: { gte: today },
    },
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
    select: {
      id: true,
      date: true,
      startHour: true,
      endHour: true,
      market: true,
    },
  });
}

/**
 * Get user's schedules for current and next week
 */
export async function getUserUpcomingSchedules(userId: string) {
  await requireAuth();

  const today = new Date();
  const thisWeekStart = getWeekStart(today);
  const nextWeekEnd = addDays(thisWeekStart, 14);

  const schedules = await prisma.schedule.findMany({
    where: {
      userId,
      isPublished: true,
      date: {
        gte: thisWeekStart,
        lt: nextWeekEnd,
      },
    },
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
    select: {
      id: true,
      date: true,
      startHour: true,
      endHour: true,
      market: true,
      shiftType: true,
    },
  });

  return schedules.map((s) => ({
    ...s,
    market: s.market as Market | null,
    shiftType: s.shiftType as ShiftType,
  }));
}

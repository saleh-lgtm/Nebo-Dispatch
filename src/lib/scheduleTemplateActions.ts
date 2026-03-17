"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-helpers";
import type { Market, ShiftType } from "@/types/schedule";
import { getWeekStart, addDays, formatHour, DAY_NAMES_FULL } from "@/types/schedule";
import {
    idParamSchema,
    createScheduleTemplateSchema,
    updateScheduleTemplateSchema,
} from "./schemas";

// Types - using Int hours (0-23), NOT Float
export interface TemplateShiftInput {
    dayOfWeek: number; // 0-6 (Monday-Sunday, NOT Sunday-Saturday)
    startHour: number; // 0-23 integer
    endHour: number; // 0-23 integer (replaces durationHours)
    market?: Market;
    shiftType?: ShiftType;
    dispatcherId?: string;
    order?: number;
}

export interface ScheduleTemplateWithShifts {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdById: string;
    createdBy: { name: string | null };
    shifts: {
        id: string;
        dayOfWeek: number; // 0=Mon, 6=Sun
        startHour: number; // 0-23
        endHour: number; // 0-23
        market: Market | null;
        shiftType: ShiftType;
        dispatcherId: string | null;
        order: number;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Get all schedule templates (ADMIN/SUPER_ADMIN only)
 */
export async function getScheduleTemplates(
    includeInactive = false
): Promise<{ success: boolean; data?: ScheduleTemplateWithShifts[]; error?: string }> {
    try {
        await requireAdmin();

        const templates = await prisma.scheduleTemplate.findMany({
            where: includeInactive ? {} : { isActive: true },
            include: {
                createdBy: { select: { name: true } },
                shifts: {
                    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }, { order: "asc" }],
                },
            },
            orderBy: { name: "asc" },
        });

        return { success: true, data: templates };
    } catch (error) {
        console.error("getScheduleTemplates error:", error);
        return { success: false, error: "Failed to get templates" };
    }
}

/**
 * Get a single template by ID
 */
export async function getScheduleTemplate(templateId: string): Promise<{ success: boolean; data?: ScheduleTemplateWithShifts | null; error?: string }> {
    try {
        await requireAdmin();

        const parsed = idParamSchema.safeParse({ id: templateId });
        if (!parsed.success) {
            return { success: false, error: "Invalid template ID" };
        }

        const template = await prisma.scheduleTemplate.findUnique({
            where: { id: parsed.data.id },
            include: {
                createdBy: { select: { name: true } },
                shifts: {
                    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }, { order: "asc" }],
                },
            },
        });

        return { success: true, data: template };
    } catch (error) {
        console.error("getScheduleTemplate error:", error);
        return { success: false, error: "Failed to get template" };
    }
}

/**
 * Create a new schedule template
 */
export async function createScheduleTemplate(
    name: string,
    description: string | null,
    shifts: TemplateShiftInput[]
): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
        const session = await requireAdmin();

        const parsed = createScheduleTemplateSchema.safeParse({ name, description, shifts });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const template = await prisma.scheduleTemplate.create({
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
                createdById: session.user.id,
                shifts: {
                    create: parsed.data.shifts.map((shift, idx) => ({
                        dayOfWeek: shift.dayOfWeek,
                        startHour: shift.startHour,
                        endHour: shift.endHour,
                        market: (shift.market as Market) || null,
                        shiftType: (shift.shiftType as ShiftType) || "CUSTOM",
                        dispatcherId: shift.dispatcherId || null,
                        order: shift.order ?? idx,
                    })),
                },
            },
        });

        revalidatePath("/admin/scheduler");
        return { success: true, templateId: template.id };
    } catch (error) {
        console.error("Error creating template:", error);
        return { success: false, error: "Failed to create template" };
    }
}

/**
 * Update an existing template
 */
export async function updateScheduleTemplate(
    templateId: string,
    data: {
        name?: string;
        description?: string | null;
        isActive?: boolean;
        shifts?: TemplateShiftInput[];
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        const parsedId = idParamSchema.safeParse({ id: templateId });
        if (!parsedId.success) {
            return { success: false, error: "Invalid template ID" };
        }

        const parsed = updateScheduleTemplateSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        // Update template fields
        await prisma.scheduleTemplate.update({
            where: { id: parsedId.data.id },
            data: {
                ...(parsed.data.name !== undefined && { name: parsed.data.name }),
                ...(parsed.data.description !== undefined && { description: parsed.data.description }),
                ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
            },
        });

        // If shifts provided, replace all shifts
        if (parsed.data.shifts) {
            // Delete existing shifts
            await prisma.scheduleTemplateShift.deleteMany({
                where: { templateId: parsedId.data.id },
            });

            // Create new shifts
            await prisma.scheduleTemplateShift.createMany({
                data: parsed.data.shifts.map((shift, idx) => ({
                    templateId: parsedId.data.id,
                    dayOfWeek: shift.dayOfWeek,
                    startHour: shift.startHour,
                    endHour: shift.endHour,
                    market: (shift.market as Market) || null,
                    shiftType: (shift.shiftType as ShiftType) || "CUSTOM",
                    dispatcherId: shift.dispatcherId || null,
                    order: shift.order ?? idx,
                })),
            });
        }

        revalidatePath("/admin/scheduler");
        return { success: true };
    } catch (error) {
        console.error("Error updating template:", error);
        return { success: false, error: "Failed to update template" };
    }
}

/**
 * Delete a template (soft delete - sets isActive to false)
 */
export async function deleteScheduleTemplate(
    templateId: string,
    hardDelete = false
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        const parsed = idParamSchema.safeParse({ id: templateId });
        if (!parsed.success) {
            return { success: false, error: "Invalid template ID" };
        }

        if (hardDelete) {
            await prisma.scheduleTemplate.delete({
                where: { id: parsed.data.id },
            });
        } else {
            await prisma.scheduleTemplate.update({
                where: { id: parsed.data.id },
                data: { isActive: false },
            });
        }

        revalidatePath("/admin/scheduler");
        return { success: true };
    } catch (error) {
        console.error("Error deleting template:", error);
        return { success: false, error: "Failed to delete template" };
    }
}

/**
 * Apply a template to a specific week
 * Creates schedule entries for each shift in the template
 *
 * NO TIMEZONE CONVERSION - hours are just integers (6 = 6 AM, 14 = 2 PM, etc.)
 */
export async function applyTemplateToWeek(
    templateId: string,
    weekStart: Date,
    dispatcherAssignments?: Record<number, string> // shiftIndex -> dispatcherId override
): Promise<{
    success: boolean;
    created: number;
    skipped: number;
    errors: string[];
}> {
    try {
        await requireAdmin();

        const parsed = idParamSchema.safeParse({ id: templateId });
        if (!parsed.success) {
            return { success: false, created: 0, skipped: 0, errors: ["Invalid template ID"] };
        }

        const result = {
            success: true,
            created: 0,
            skipped: 0,
            errors: [] as string[],
        };

        // Get the template with shifts
        const template = await prisma.scheduleTemplate.findUnique({
            where: { id: parsed.data.id },
            include: {
                shifts: {
                    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
                },
            },
        });

        if (!template) {
            return { success: false, created: 0, skipped: 0, errors: ["Template not found"] };
        }

        // Normalize weekStart to Monday
        const normalized = getWeekStart(weekStart);

        // Create schedules for each template shift
        const scheduleData: {
            userId: string;
            date: Date;
            startHour: number;
            endHour: number;
            market: Market | null;
            shiftType: ShiftType;
            weekStart: Date;
            isPublished: boolean;
        }[] = [];

        for (let i = 0; i < template.shifts.length; i++) {
            const shift = template.shifts[i];

            // Get dispatcher - either from override or template default
            const dispatcherId = dispatcherAssignments?.[i] ?? shift.dispatcherId;

            if (!dispatcherId) {
                result.skipped++;
                result.errors.push(
                    `Shift ${i + 1} (${DAY_NAMES_FULL[shift.dayOfWeek]} ${formatHour(shift.startHour)}) has no dispatcher assigned`
                );
                continue;
            }

            // Calculate the date for this shift (dayOfWeek: 0=Mon, 6=Sun)
            const shiftDate = addDays(normalized, shift.dayOfWeek);

            // Check for existing schedule at this time for this dispatcher
            const existing = await prisma.schedule.findFirst({
                where: {
                    userId: dispatcherId,
                    date: shiftDate,
                },
            });

            if (existing) {
                result.skipped++;
                result.errors.push(
                    `Skipped: Existing shift for ${DAY_NAMES_FULL[shift.dayOfWeek]} ${formatHour(shift.startHour)}`
                );
                continue;
            }

            scheduleData.push({
                userId: dispatcherId,
                date: shiftDate,
                startHour: shift.startHour,
                endHour: shift.endHour,
                market: shift.market,
                shiftType: shift.shiftType,
                weekStart: normalized,
                isPublished: false,
            });
        }

        // Batch create all valid schedules
        if (scheduleData.length > 0) {
            await prisma.schedule.createMany({ data: scheduleData });
            result.created = scheduleData.length;
        }

        revalidatePath("/admin/scheduler");
        return result;
    } catch (error) {
        console.error("Error applying template:", error);
        return { success: false, created: 0, skipped: 0, errors: ["Failed to apply template"] };
    }
}

/**
 * Create a template from an existing week's schedule
 *
 * NO TIMEZONE CONVERSION - reads date/startHour/endHour directly
 */
export async function createTemplateFromWeek(
    weekStart: Date,
    name: string,
    description?: string,
    includeDispatchers = false
): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
        const session = await requireAdmin();

        // Normalize weekStart to Monday
        const normalized = getWeekStart(weekStart);

        // Get all schedules for this week
        const schedules = await prisma.schedule.findMany({
            where: {
                weekStart: normalized,
            },
            orderBy: [{ date: "asc" }, { startHour: "asc" }],
        });

        if (schedules.length === 0) {
            return { success: false, error: "No schedules found for this week" };
        }

        // Convert schedules to template shifts
        // dayOfWeek is calculated from the date (0=Mon, 6=Sun)
        const shifts: TemplateShiftInput[] = schedules.map((schedule, idx) => {
            // Get day index: difference between schedule date and weekStart
            const dayDiff = Math.floor(
                (schedule.date.getTime() - normalized.getTime()) / (24 * 60 * 60 * 1000)
            );
            const dayOfWeek = Math.max(0, Math.min(6, dayDiff)); // Clamp to 0-6

            return {
                dayOfWeek,
                startHour: schedule.startHour,
                endHour: schedule.endHour,
                market: schedule.market as Market | undefined,
                shiftType: schedule.shiftType as ShiftType,
                dispatcherId: includeDispatchers ? schedule.userId : undefined,
                order: idx,
            };
        });

        // Create the template
        const template = await prisma.scheduleTemplate.create({
            data: {
                name,
                description: description || null,
                createdById: session.user.id,
                shifts: {
                    create: shifts.map((shift) => ({
                        dayOfWeek: shift.dayOfWeek,
                        startHour: shift.startHour,
                        endHour: shift.endHour,
                        market: shift.market || null,
                        shiftType: shift.shiftType || "CUSTOM",
                        dispatcherId: shift.dispatcherId || null,
                        order: shift.order ?? 0,
                    })),
                },
            },
        });

        revalidatePath("/admin/scheduler");
        return { success: true, templateId: template.id };
    } catch (error) {
        console.error("Error creating template from week:", error);
        return { success: false, error: "Failed to create template from week" };
    }
}

"use server";

import prisma from "./prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { revalidateTag } from "next/cache";

// Helper to require admin role
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

// Types
export interface TemplateShiftInput {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startHour: number; // 0-24 (decimal hours, e.g., 8.5 = 8:30 AM)
    durationHours: number;
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
        dayOfWeek: number;
        startHour: number;
        durationHours: number;
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
): Promise<ScheduleTemplateWithShifts[]> {
    await requireAdmin();

    return prisma.scheduleTemplate.findMany({
        where: includeInactive ? {} : { isActive: true },
        include: {
            createdBy: { select: { name: true } },
            shifts: {
                orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }, { order: "asc" }],
            },
        },
        orderBy: { name: "asc" },
    });
}

/**
 * Get a single template by ID
 */
export async function getScheduleTemplate(templateId: string): Promise<ScheduleTemplateWithShifts | null> {
    await requireAdmin();

    return prisma.scheduleTemplate.findUnique({
        where: { id: templateId },
        include: {
            createdBy: { select: { name: true } },
            shifts: {
                orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }, { order: "asc" }],
            },
        },
    });
}

/**
 * Create a new schedule template
 */
export async function createScheduleTemplate(
    name: string,
    description: string | null,
    shifts: TemplateShiftInput[]
): Promise<{ success: boolean; templateId?: string; error?: string }> {
    const userId = await requireAdmin();

    try {
        // Validate shifts
        for (const shift of shifts) {
            if (shift.dayOfWeek < 0 || shift.dayOfWeek > 6) {
                return { success: false, error: `Invalid day of week: ${shift.dayOfWeek}` };
            }
            if (shift.startHour < 0 || shift.startHour >= 24) {
                return { success: false, error: `Invalid start hour: ${shift.startHour}` };
            }
            if (shift.durationHours <= 0 || shift.durationHours > 24) {
                return { success: false, error: `Invalid duration: ${shift.durationHours}` };
            }
        }

        const template = await prisma.scheduleTemplate.create({
            data: {
                name,
                description,
                createdById: userId,
                shifts: {
                    create: shifts.map((shift, idx) => ({
                        dayOfWeek: shift.dayOfWeek,
                        startHour: shift.startHour,
                        durationHours: shift.durationHours,
                        dispatcherId: shift.dispatcherId || null,
                        order: shift.order ?? idx,
                    })),
                },
            },
        });

        revalidateTag("schedule-templates", "max");
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
    await requireAdmin();

    try {
        // Update template fields
        await prisma.scheduleTemplate.update({
            where: { id: templateId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });

        // If shifts provided, replace all shifts
        if (data.shifts) {
            // Delete existing shifts
            await prisma.scheduleTemplateShift.deleteMany({
                where: { templateId },
            });

            // Create new shifts
            await prisma.scheduleTemplateShift.createMany({
                data: data.shifts.map((shift, idx) => ({
                    templateId,
                    dayOfWeek: shift.dayOfWeek,
                    startHour: shift.startHour,
                    durationHours: shift.durationHours,
                    dispatcherId: shift.dispatcherId || null,
                    order: shift.order ?? idx,
                })),
            });
        }

        revalidateTag("schedule-templates", "max");
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
    await requireAdmin();

    try {
        if (hardDelete) {
            await prisma.scheduleTemplate.delete({
                where: { id: templateId },
            });
        } else {
            await prisma.scheduleTemplate.update({
                where: { id: templateId },
                data: { isActive: false },
            });
        }

        revalidateTag("schedule-templates", "max");
        return { success: true };
    } catch (error) {
        console.error("Error deleting template:", error);
        return { success: false, error: "Failed to delete template" };
    }
}

/**
 * Apply a template to a specific week
 * Creates schedule blocks for each shift in the template
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
    await requireAdmin();

    const result = {
        success: true,
        created: 0,
        skipped: 0,
        errors: [] as string[],
    };

    try {
        // Get the template with shifts
        const template = await prisma.scheduleTemplate.findUnique({
            where: { id: templateId },
            include: {
                shifts: {
                    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
                },
            },
        });

        if (!template) {
            return { success: false, created: 0, skipped: 0, errors: ["Template not found"] };
        }

        // Ensure weekStart is at the start of the week (Sunday 00:00 UTC)
        const normalizedWeekStart = new Date(weekStart);
        normalizedWeekStart.setUTCHours(0, 0, 0, 0);
        const day = normalizedWeekStart.getUTCDay();
        normalizedWeekStart.setUTCDate(normalizedWeekStart.getUTCDate() - day);

        // Create schedules for each template shift
        const scheduleData: {
            userId: string;
            shiftStart: Date;
            shiftEnd: Date;
            weekStart: Date;
            isPublished: boolean;
        }[] = [];

        for (let i = 0; i < template.shifts.length; i++) {
            const shift = template.shifts[i];

            // Get dispatcher - either from override or template default
            const dispatcherId = dispatcherAssignments?.[i] ?? shift.dispatcherId;

            if (!dispatcherId) {
                result.skipped++;
                result.errors.push(`Shift ${i + 1} (${getDayName(shift.dayOfWeek)} ${formatHour(shift.startHour)}) has no dispatcher assigned`);
                continue;
            }

            // Calculate shift start time
            const shiftStart = new Date(normalizedWeekStart);
            shiftStart.setUTCDate(shiftStart.getUTCDate() + shift.dayOfWeek);

            // Set hours (handle decimal hours)
            const hours = Math.floor(shift.startHour);
            const minutes = Math.round((shift.startHour - hours) * 60);
            shiftStart.setUTCHours(hours, minutes, 0, 0);

            // Calculate shift end time
            const shiftEnd = new Date(shiftStart.getTime() + shift.durationHours * 60 * 60 * 1000);

            // Check for existing schedule at this time for this dispatcher
            const existing = await prisma.schedule.findFirst({
                where: {
                    userId: dispatcherId,
                    shiftStart: { lte: shiftEnd },
                    shiftEnd: { gte: shiftStart },
                },
            });

            if (existing) {
                result.skipped++;
                result.errors.push(
                    `Skipped: Existing shift for ${getDayName(shift.dayOfWeek)} ${formatHour(shift.startHour)}`
                );
                continue;
            }

            scheduleData.push({
                userId: dispatcherId,
                shiftStart,
                shiftEnd,
                weekStart: normalizedWeekStart,
                isPublished: false,
            });
        }

        // Batch create all valid schedules
        if (scheduleData.length > 0) {
            await prisma.schedule.createMany({ data: scheduleData });
            result.created = scheduleData.length;
        }

        revalidateTag("schedules", "max");
        return result;
    } catch (error) {
        console.error("Error applying template:", error);
        return { success: false, created: 0, skipped: 0, errors: ["Failed to apply template"] };
    }
}

/**
 * Create a template from an existing week's schedule
 */
export async function createTemplateFromWeek(
    weekStart: Date,
    name: string,
    description?: string,
    includeDispatchers = false
): Promise<{ success: boolean; templateId?: string; error?: string }> {
    const userId = await requireAdmin();

    try {
        // Normalize weekStart
        const normalizedWeekStart = new Date(weekStart);
        normalizedWeekStart.setUTCHours(0, 0, 0, 0);
        const day = normalizedWeekStart.getUTCDay();
        normalizedWeekStart.setUTCDate(normalizedWeekStart.getUTCDate() - day);

        const weekEnd = new Date(normalizedWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Get all schedules for this week
        const schedules = await prisma.schedule.findMany({
            where: {
                shiftStart: { gte: normalizedWeekStart, lt: weekEnd },
            },
            orderBy: { shiftStart: "asc" },
        });

        if (schedules.length === 0) {
            return { success: false, error: "No schedules found for this week" };
        }

        // Convert schedules to template shifts
        const shifts: TemplateShiftInput[] = schedules.map((schedule, idx) => {
            const dayOfWeek = schedule.shiftStart.getUTCDay();
            const startHour = schedule.shiftStart.getUTCHours() + schedule.shiftStart.getUTCMinutes() / 60;
            const durationMs = schedule.shiftEnd.getTime() - schedule.shiftStart.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            return {
                dayOfWeek,
                startHour,
                durationHours,
                dispatcherId: includeDispatchers ? schedule.userId : undefined,
                order: idx,
            };
        });

        // Create the template
        const template = await prisma.scheduleTemplate.create({
            data: {
                name,
                description: description || null,
                createdById: userId,
                shifts: {
                    create: shifts.map((shift) => ({
                        dayOfWeek: shift.dayOfWeek,
                        startHour: shift.startHour,
                        durationHours: shift.durationHours,
                        dispatcherId: shift.dispatcherId || null,
                        order: shift.order ?? 0,
                    })),
                },
            },
        });

        revalidateTag("schedule-templates", "max");
        return { success: true, templateId: template.id };
    } catch (error) {
        console.error("Error creating template from week:", error);
        return { success: false, error: "Failed to create template from week" };
    }
}

// Helper functions
function getDayName(dayIndex: number): string {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[dayIndex];
}

function formatHour(hour: number): string {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return m === 0 ? `${displayHour}${period}` : `${displayHour}:${m.toString().padStart(2, "0")}${period}`;
}

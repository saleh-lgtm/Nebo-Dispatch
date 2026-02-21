"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Helper to get start of week (Sunday 00:00:00) - internal use only
function getWeekStartInternal(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Get all dispatchers
export async function getDispatchers() {
    return await prisma.user.findMany({
        where: { role: "DISPATCHER" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
    });
}

// Get schedules for a specific week
export async function getWeekSchedules(weekStart: Date) {
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

// Create a new schedule block
export async function createScheduleBlock(data: {
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
}) {
    const weekStart = getWeekStartInternal(data.shiftStart);

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

    revalidatePath("/admin/scheduler");
    return schedule;
}

// Update schedule block position/duration
export async function updateScheduleBlock(
    id: string,
    data: { shiftStart?: Date; shiftEnd?: Date }
) {
    const updateData: any = { ...data };

    if (data.shiftStart) {
        updateData.weekStart = getWeekStartInternal(data.shiftStart);
    }

    const schedule = await prisma.schedule.update({
        where: { id },
        data: updateData,
        include: { user: { select: { id: true, name: true } } },
    });

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
    return schedule;
}

// Delete a schedule block
export async function deleteScheduleBlock(id: string) {
    await prisma.schedule.delete({ where: { id } });
    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
}

// Publish all schedules for a week
export async function publishWeekSchedules(weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await prisma.schedule.updateMany({
        where: {
            shiftStart: {
                gte: weekStart,
                lt: weekEnd,
            },
        },
        data: { isPublished: true },
    });

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
}

// Unpublish all schedules for a week
export async function unpublishWeekSchedules(weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await prisma.schedule.updateMany({
        where: {
            shiftStart: {
                gte: weekStart,
                lt: weekEnd,
            },
        },
        data: { isPublished: false },
    });

    revalidatePath("/admin/scheduler");
    revalidatePath("/schedule");
}

// Check if week is published (any published schedule in that week)
export async function isWeekPublished(weekStart: Date): Promise<boolean> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

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

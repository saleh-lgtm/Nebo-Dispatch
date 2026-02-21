"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleTask(entryId: string, isCompleted: boolean) {
    await prisma.shiftTask.update({
        where: { id: entryId },
        data: {
            isCompleted,
            completedAt: isCompleted ? new Date() : null,
        },
    });
    revalidatePath("/reports/shift");
}

export async function saveShiftReport(data: any) {
    const { shiftId, userId, clockOut, ...reportData } = data;

    await prisma.shiftReport.create({
        data: {
            user: { connect: { id: userId } },
            shift: { connect: { id: shiftId } },
            ...reportData,
        },
    });

    // Also clock out if requested (often reports are done at shift end)
    if (data.clockOut) {
        await prisma.shift.update({
            where: { id: shiftId },
            data: { clockOut: new Date() },
        });
    }

    revalidatePath("/dashboard");
    revalidatePath("/reports/shift");
}

export async function createActiveShift(userId: string) {
    // First check if there's already an active one
    const existing = await prisma.shift.findFirst({
        where: { userId, clockOut: null },
    });

    if (existing) return existing;

    const shift = await prisma.shift.create({
        data: {
            userId,
            clockIn: new Date(),
        },
    });

    // Create standard tasks for the new shift
    const templates = await prisma.taskTemplate.findMany({
        where: { isActive: true },
        include: { items: true },
    });

    const taskEntries = templates.flatMap((t: any) =>
        t.items.map((item: any) => ({
            shiftId: shift.id,
            content: item.content,
        }))
    );

    if (taskEntries.length > 0) {
        await prisma.shiftTask.createMany({
            data: taskEntries,
        });
    } else {
        // Fallback default tasks if no templates exist yet
        const defaultTasks = [
            "Check Reservations/Info/Admin inboxes",
            "Make sure all emails are read",
            "Check wake up calls mapping",
            "Confirm all trips on portals",
            "Confirm drivers/vehicles",
            "Generate passenger link list",
            "Monitor chauffeurs"
        ];
        await prisma.shiftTask.createMany({
            data: defaultTasks.map(content => ({ shiftId: shift.id, content })),
        });
    }

    revalidatePath("/dashboard");
    return shift;
}

// Affiliate Actions
export async function submitAffiliate(data: {
    name: string;
    email: string;
    market: string;
    notes?: string;
    cityTransferRate?: string;
    submittedById: string;
}) {
    const affiliate = await prisma.affiliate.create({
        data: {
            ...data,
            isApproved: false, // Default to pending
        },
    });
    revalidatePath("/affiliates");
    return affiliate;
}

export async function getAffiliates(onlyApproved = true) {
    return await prisma.affiliate.findMany({
        where: onlyApproved ? { isApproved: true } : {},
        orderBy: { name: "asc" },
        include: { submittedBy: { select: { name: true } } },
    });
}

// Scheduling Request Actions
export async function createSchedulingRequest(data: {
    userId: string;
    type: "HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW";
    reason: string;
    requestedStart?: Date;
    requestedEnd?: Date;
    shiftId?: string;
    scheduleId?: string;
}) {
    const request = await prisma.schedulingRequest.create({
        data,
    });
    revalidatePath("/schedule");
    return request;
}

export async function getDispatcherSchedule(userId: string) {
    return await prisma.schedule.findMany({
        where: { userId, isPublished: true },
        orderBy: { shiftStart: "asc" },
    });
}

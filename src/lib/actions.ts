"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

export async function toggleTask(entryId: string, isCompleted: boolean) {
    await requireAuth();

    await prisma.shiftTask.update({
        where: { id: entryId },
        data: {
            isCompleted,
            completedAt: isCompleted ? new Date() : null,
        },
    });
    revalidatePath("/reports/shift");
}

export async function saveShiftReport(data: Record<string, unknown> & {
    shiftId: string;
    userId: string;
    clockOut?: boolean;
}) {
    const session = await requireAuth();
    const { shiftId, userId, clockOut, ...reportData } = data;

    // Ensure user can only save their own report
    if (session.user.id !== userId) {
        throw new Error("Cannot save report for another user");
    }

    const report = await prisma.shiftReport.create({
        data: {
            user: { connect: { id: userId } },
            shift: { connect: { id: shiftId } },
            // Core communication metrics
            callsReceived: reportData.callsReceived as number | undefined,
            emailsSent: reportData.emailsSent as number | undefined,
            quotesGiven: reportData.quotesGiven as number | undefined,
            // Reservation tracking
            totalReservationsHandled: reportData.totalReservationsHandled as number | undefined,
            acceptedReservations: reportData.acceptedReservations as object | undefined,
            modifiedReservations: reportData.modifiedReservations as object | undefined,
            cancelledReservations: reportData.cancelledReservations as object | undefined,
            // Customer interaction metrics
            complaintsReceived: reportData.complaintsReceived as number | undefined,
            complaintsResolved: reportData.complaintsResolved as number | undefined,
            escalations: reportData.escalations as number | undefined,
            // Driver coordination metrics
            driversDispatched: reportData.driversDispatched as number | undefined,
            noShowsHandled: reportData.noShowsHandled as number | undefined,
            latePickups: reportData.latePickups as number | undefined,
            // Narrative fields
            handoffNotes: reportData.handoffNotes as string | undefined,
            generalComments: reportData.generalComments as string | undefined,
            newIdeas: reportData.newIdeas as string | undefined,
            incidents: reportData.incidents as string | undefined,
            achievements: reportData.achievements as string | undefined,
            challenges: reportData.challenges as string | undefined,
            // Self-assessment rating (1-5)
            shiftRating: reportData.shiftRating as number | undefined,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "ShiftReport",
        report.id
    );

    // Also clock out if requested (often reports are done at shift end)
    if (clockOut) {
        await prisma.shift.update({
            where: { id: shiftId },
            data: { clockOut: new Date() },
        });

        await createAuditLog(
            session.user.id,
            "CLOCK_OUT",
            "Shift",
            shiftId
        );
    }

    revalidatePath("/dashboard");
    revalidatePath("/reports/shift");
}

export async function createActiveShift(userId: string) {
    const session = await requireAuth();

    // Ensure user can only create their own shift
    if (session.user.id !== userId) {
        throw new Error("Cannot create shift for another user");
    }

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

    await createAuditLog(
        session.user.id,
        "CLOCK_IN",
        "Shift",
        shift.id
    );

    // Create standard tasks for the new shift
    const templates = await prisma.taskTemplate.findMany({
        where: { isActive: true },
        include: { items: true },
    });

    type TaskTemplate = {
        items: { content: string }[];
    };

    const taskEntries = templates.flatMap((t: TaskTemplate) =>
        t.items.map((item) => ({
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
    const session = await requireAuth();

    // Ensure user can only submit affiliates under their own ID
    if (session.user.id !== data.submittedById) {
        throw new Error("Cannot submit affiliate for another user");
    }

    const affiliate = await prisma.affiliate.create({
        data: {
            ...data,
            isApproved: false, // Default to pending
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "Affiliate",
        affiliate.id,
        { name: data.name, market: data.market }
    );

    revalidatePath("/affiliates");
    return affiliate;
}

export async function getAffiliates(onlyApproved = true) {
    await requireAuth();

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
    const session = await requireAuth();

    // Ensure user can only create requests for themselves
    if (session.user.id !== data.userId) {
        throw new Error("Cannot create request for another user");
    }

    const request = await prisma.schedulingRequest.create({
        data,
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "SchedulingRequest",
        request.id,
        { type: data.type }
    );

    revalidatePath("/schedule");
    return request;
}

export async function getDispatcherSchedule(userId: string) {
    const session = await requireAuth();

    // Users can only view their own schedule (unless admin)
    if (session.user.id !== userId && session.user.role === "DISPATCHER") {
        throw new Error("Cannot view another user's schedule");
    }

    return await prisma.schedule.findMany({
        where: { userId, isPublished: true },
        orderBy: { shiftStart: "asc" },
    });
}

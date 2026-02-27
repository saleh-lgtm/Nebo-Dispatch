"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

export async function toggleTask(entryId: string, isCompleted: boolean) {
    await requireAuth();

    // Get current task to check if startedAt needs to be set
    const currentTask = await prisma.shiftTask.findUnique({
        where: { id: entryId },
    });

    const now = new Date();
    const updateData: {
        isCompleted: boolean;
        completedAt: Date | null;
        startedAt?: Date;
    } = {
        isCompleted,
        completedAt: isCompleted ? now : null,
    };

    // Set startedAt on first completion (when task is first worked on)
    if (isCompleted && !currentTask?.startedAt) {
        updateData.startedAt = now;
    }

    await prisma.shiftTask.update({
        where: { id: entryId },
        data: updateData,
    });
    revalidatePath("/reports/shift");
}

interface FlaggedReservation {
    reservationType: "accepted" | "modified" | "cancelled";
    reservationId: string;
    reservationNotes?: string;
    flagReason?: string;
}

interface RetailLeadInput {
    serviceRequested: string;
    outcome: "WON" | "NEEDS_FOLLOW_UP" | "LOST";
    lostReason?: "VEHICLE_TYPE" | "AVAILABILITY" | "PRICING" | "OTHER";
    lostReasonOther?: string;
    notes?: string;
}

export async function saveShiftReport(data: Record<string, unknown> & {
    shiftId: string;
    userId: string;
    clockOut?: boolean;
    flaggedReservations?: FlaggedReservation[];
    retailLeads?: RetailLeadInput[];
}) {
    const session = await requireAuth();
    const { shiftId, userId, clockOut, flaggedReservations, retailLeads, ...reportData } = data;

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
            // Narrative fields
            handoffNotes: reportData.handoffNotes as string | undefined,
            generalComments: reportData.generalComments as string | undefined,
            newIdeas: reportData.newIdeas as string | undefined,
            incidents: reportData.incidents as string | undefined,
            achievements: reportData.achievements as string | undefined,
            challenges: reportData.challenges as string | undefined,
        },
    });

    // Create accounting flags for flagged reservations
    if (flaggedReservations && flaggedReservations.length > 0) {
        await prisma.accountingFlag.createMany({
            data: flaggedReservations.map((flag) => ({
                shiftReportId: report.id,
                reservationType: flag.reservationType,
                reservationId: flag.reservationId,
                reservationNotes: flag.reservationNotes,
                flagReason: flag.flagReason,
                flaggedById: session.user.id,
                status: "PENDING" as const,
            })),
            skipDuplicates: true,
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "AccountingFlag",
            report.id,
            { flagCount: flaggedReservations.length }
        );
    }

    // Create retail leads
    if (retailLeads && retailLeads.length > 0) {
        await prisma.retailLead.createMany({
            data: retailLeads.map((lead) => ({
                shiftReportId: report.id,
                serviceRequested: lead.serviceRequested,
                outcome: lead.outcome,
                lostReason: lead.lostReason || null,
                lostReasonOther: lead.lostReasonOther || null,
                notes: lead.notes || null,
            })),
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "RetailLead",
            report.id,
            { leadCount: retailLeads.length }
        );
    }

    await createAuditLog(
        session.user.id,
        "CREATE",
        "ShiftReport",
        report.id
    );

    // Also clock out if requested (often reports are done at shift end)
    if (clockOut) {
        // Get shift to calculate total hours
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            select: { clockIn: true },
        });

        const clockOutTime = new Date();
        const totalHours = shift
            ? (clockOutTime.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60)
            : null;

        await prisma.shift.update({
            where: { id: shiftId },
            data: {
                clockOut: clockOutTime,
                totalHours: totalHours ? Math.round(totalHours * 100) / 100 : null,
            },
        });

        // Reset all task completions for this dispatcher (Option A)
        // Admin tasks persist, but completions are reset for the next shift
        const deletedCompletions = await prisma.adminTaskCompletion.deleteMany({
            where: { userId: session.user.id },
        });

        if (deletedCompletions.count > 0) {
            await createAuditLog(
                session.user.id,
                "DELETE",
                "AdminTaskCompletion",
                "bulk",
                { action: "shift_reset", completionsCleared: deletedCompletions.count }
            );
        }

        await createAuditLog(
            session.user.id,
            "CLOCK_OUT",
            "Shift",
            shiftId,
            { totalHours: totalHours ? Math.round(totalHours * 100) / 100 : null }
        );
    }

    revalidatePath("/dashboard");
    revalidatePath("/reports/shift");
    revalidatePath("/admin/hours");

    return { success: true, reportId: report.id };
}

/**
 * Save shift report draft (auto-save to server)
 * This allows users to save their progress without clocking out
 */
export interface ShiftReportDraft {
    shiftId: string;
    accepted: Array<{ id: string; notes: string; flaggedForAccounting?: boolean; flagReason?: string }>;
    modified: Array<{ id: string; notes: string; flaggedForAccounting?: boolean; flagReason?: string }>;
    cancelled: Array<{ id: string; notes: string; flaggedForAccounting?: boolean; flagReason?: string }>;
    retailLeads: Array<{
        serviceRequested: string;
        outcome: "WON" | "NEEDS_FOLLOW_UP" | "LOST";
        lostReason?: "VEHICLE_TYPE" | "AVAILABILITY" | "PRICING" | "OTHER";
        lostReasonOther?: string;
        notes?: string;
    }>;
    billingReviews?: Array<{
        tripNumber: string;
        passengerName?: string;
        tripDate?: string;
        reason: string;
        reasonOther?: string;
        amount?: number;
        notes?: string;
    }>;
    handoffNotes: string;
    metrics: {
        calls: number;
        emails: number;
        totalReservationsHandled: number;
    };
    narrative: {
        comments: string;
        incidents: string;
        ideas: string;
    };
}

export async function saveShiftReportDraft(draft: ShiftReportDraft) {
    const session = await requireAuth();

    // Find or create draft record
    const existingDraft = await prisma.shiftReportDraft.findFirst({
        where: {
            shiftId: draft.shiftId,
            userId: session.user.id,
        },
    });

    const draftData = {
        userId: session.user.id,
        shiftId: draft.shiftId,
        draftData: draft as unknown as object,
        lastSavedAt: new Date(),
    };

    if (existingDraft) {
        await prisma.shiftReportDraft.update({
            where: { id: existingDraft.id },
            data: draftData,
        });
    } else {
        await prisma.shiftReportDraft.create({
            data: draftData,
        });
    }

    return { success: true, savedAt: new Date() };
}

/**
 * Get existing draft for a shift
 */
export async function getShiftReportDraft(shiftId: string): Promise<ShiftReportDraft | null> {
    const session = await requireAuth();

    const draft = await prisma.shiftReportDraft.findFirst({
        where: {
            shiftId,
            userId: session.user.id,
        },
    });

    if (!draft) return null;

    return draft.draftData as unknown as ShiftReportDraft;
}

/**
 * Delete draft after successful submit
 */
export async function deleteShiftReportDraft(shiftId: string) {
    const session = await requireAuth();

    await prisma.shiftReportDraft.deleteMany({
        where: {
            shiftId,
            userId: session.user.id,
        },
    });

    return { success: true };
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

    // Add admin-assigned tasks to the shift
    const adminTasks = await prisma.adminTask.findMany({
        where: {
            isActive: true,
            OR: [
                { assignToAll: true },
                { assignedToId: userId },
            ],
        },
        orderBy: [
            { priority: "desc" },
            { createdAt: "desc" },
        ],
    });

    if (adminTasks.length > 0) {
        await prisma.shiftTask.createMany({
            data: adminTasks.map((task) => ({
                shiftId: shift.id,
                content: task.title,
                isAdminTask: true,
                assignedById: task.createdById,
                priority: task.priority,
            })),
        });
    }

    revalidatePath("/dashboard");
    return shift;
}

// Affiliate Actions
export async function submitAffiliate(data: {
    name: string;
    email: string;
    phone?: string;
    state: string;
    cities: string[];
    notes?: string;
    cityTransferRate?: string;
    submittedById: string;
    type: "FARM_IN" | "FARM_OUT";
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
        { name: data.name, state: data.state, cities: data.cities.join(", "), type: data.type }
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

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import type {
    DashboardNotesData,
    AnnouncementWithStatus,
    ShiftHandoffNote,
} from "@/types/note";

// ============================================
// DASHBOARD QUERY - Main function for dashboard
// ============================================

/**
 * Get all notes for the dashboard:
 * 1. Active announcements (pinned first, then by date)
 * 2. Notes from currently active shifts
 * 3. Notes from immediately preceding shifts (shift carryover)
 */
export async function getDashboardNotes(
    userId: string
): Promise<DashboardNotesData> {
    await requireAuth();

    const now = new Date();

    // Get all active announcements (not expired)
    const announcements = await prisma.globalNote.findMany({
        where: {
            isAnnouncement: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: {
            author: { select: { id: true, name: true } },
            reads: {
                where: { userId },
            },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    // Get current user's active shift
    const userActiveShift = await prisma.shift.findFirst({
        where: { userId, clockOut: null },
    });

    // Get all active shifts (for shift notes visibility)
    const activeShifts = await prisma.shift.findMany({
        where: { clockOut: null },
        select: { id: true },
    });

    // Get preceding shifts (completed within last 8 hours) for carryover
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const precedingShifts = await prisma.shift.findMany({
        where: {
            clockOut: {
                not: null,
                gte: eightHoursAgo,
            },
        },
        select: { id: true },
        orderBy: { clockOut: "desc" },
        take: 10, // Limit to last 10 preceding shifts
    });

    const relevantShiftIds = [
        ...activeShifts.map((s) => s.id),
        ...precedingShifts.map((s) => s.id),
    ];

    // Get shift notes from relevant shifts
    const shiftNotes = await prisma.globalNote.findMany({
        where: {
            isAnnouncement: false,
            shiftId: { in: relevantShiftIds },
        },
        include: {
            author: { select: { id: true, name: true } },
            shift: {
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    // Count unacknowledged announcements
    const unacknowledgedCount = announcements.filter(
        (a) => a.reads.length === 0 || !a.reads[0].acknowledged
    ).length;

    // Transform announcements with read status
    const announcementsWithStatus: AnnouncementWithStatus[] = announcements.map(
        (a) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            author: a.author,
            isAnnouncement: a.isAnnouncement,
            isPinned: a.isPinned,
            expiresAt: a.expiresAt,
            shiftId: a.shiftId,
            readStatus: {
                isRead: a.reads.length > 0,
                readAt: a.reads[0]?.readAt || null,
                isAcknowledged: a.reads[0]?.acknowledged || false,
                acknowledgedAt: a.reads[0]?.acknowledgedAt || null,
            },
        })
    );

    // Transform shift notes with context
    const shiftNotesWithContext: ShiftHandoffNote[] = shiftNotes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        author: n.author,
        isAnnouncement: n.isAnnouncement,
        isPinned: n.isPinned,
        expiresAt: n.expiresAt,
        shiftId: n.shiftId,
        shift: n.shift
            ? {
                  id: n.shift.id,
                  clockIn: n.shift.clockIn,
                  clockOut: n.shift.clockOut,
                  user: n.shift.user,
              }
            : undefined,
        isFromCurrentShift: userActiveShift
            ? n.shiftId === userActiveShift.id
            : false,
        isFromPreviousShift: !activeShifts.some((s) => s.id === n.shiftId),
        shiftAuthor: n.shift?.user || n.author,
    }));

    return {
        announcements: announcementsWithStatus,
        shiftNotes: shiftNotesWithContext,
        unacknowledgedCount,
    };
}

// ============================================
// ANNOUNCEMENT ACKNOWLEDGMENT
// ============================================

/**
 * Acknowledge an announcement (marks as read and acknowledged)
 */
export async function acknowledgeAnnouncement(announcementId: string) {
    const session = await requireAuth();

    const read = await prisma.announcementRead.upsert({
        where: {
            announcementId_userId: {
                announcementId,
                userId: session.user.id,
            },
        },
        create: {
            announcementId,
            userId: session.user.id,
            acknowledged: true,
            acknowledgedAt: new Date(),
        },
        update: {
            acknowledged: true,
            acknowledgedAt: new Date(),
        },
    });

    // Update shift report metric if user has active shift
    const activeShift = await prisma.shift.findFirst({
        where: { userId: session.user.id, clockOut: null },
    });

    if (activeShift) {
        // Try to update existing report or just track the acknowledgment
        await prisma.shiftReport.updateMany({
            where: { shiftId: activeShift.id },
            data: { announcementsRead: { increment: 1 } },
        });
    }

    revalidatePath("/dashboard");
    return read;
}

/**
 * Get unacknowledged announcements for a user
 */
export async function getUnacknowledgedAnnouncements(userId: string) {
    await requireAuth();

    const now = new Date();

    const announcements = await prisma.globalNote.findMany({
        where: {
            isAnnouncement: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: {
            reads: {
                where: { userId, acknowledged: true },
            },
        },
    });

    return announcements.filter((a) => a.reads.length === 0);
}

// ============================================
// SHIFT NOTE CREATION (Any authenticated user with active shift)
// ============================================

/**
 * Create a shift handoff note (links to user's active shift)
 */
export async function createShiftNote(data: { title: string; content: string }) {
    const session = await requireAuth();

    // Get user's active shift
    const activeShift = await prisma.shift.findFirst({
        where: { userId: session.user.id, clockOut: null },
    });

    if (!activeShift) {
        throw new Error(
            "No active shift found. Please clock in to create shift notes."
        );
    }

    const note = await prisma.globalNote.create({
        data: {
            authorId: session.user.id,
            title: data.title,
            content: data.content,
            isAnnouncement: false,
            shiftId: activeShift.id,
        },
        include: { author: { select: { id: true, name: true } } },
    });

    // Update shift report metric
    await prisma.shiftReport.updateMany({
        where: { shiftId: activeShift.id },
        data: { notesCreated: { increment: 1 } },
    });

    await createAuditLog(session.user.id, "CREATE", "ShiftNote", note.id, {
        title: data.title,
        shiftId: activeShift.id,
    });

    revalidatePath("/dashboard");
    return note;
}

// ============================================
// ANNOUNCEMENT MANAGEMENT (Admin only)
// ============================================

/**
 * Create a company announcement (Admin only)
 */
export async function createAnnouncement(data: {
    title: string;
    content: string;
    isPinned?: boolean;
    expiresAt?: Date | null;
}) {
    const session = await requireAdmin();

    const note = await prisma.globalNote.create({
        data: {
            authorId: session.user.id,
            title: data.title,
            content: data.content,
            isAnnouncement: true,
            isPinned: data.isPinned ?? false,
            expiresAt: data.expiresAt,
        },
        include: { author: { select: { id: true, name: true } } },
    });

    await createAuditLog(session.user.id, "CREATE", "Announcement", note.id, {
        title: data.title,
        isPinned: data.isPinned,
    });

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

/**
 * Update an announcement (Admin only)
 */
export async function updateAnnouncement(
    id: string,
    data: {
        title?: string;
        content?: string;
        isPinned?: boolean;
        expiresAt?: Date | null;
    }
) {
    const session = await requireAdmin();

    const note = await prisma.globalNote.update({
        where: { id },
        data,
        include: { author: { select: { id: true, name: true } } },
    });

    await createAuditLog(session.user.id, "UPDATE", "Announcement", id, data);

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

/**
 * Delete an announcement (Admin only)
 */
export async function deleteAnnouncement(id: string) {
    const session = await requireAdmin();

    await prisma.globalNote.delete({ where: { id } });

    await createAuditLog(session.user.id, "DELETE", "Announcement", id);

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
}

/**
 * Toggle pin status of an announcement (Admin only)
 */
export async function toggleAnnouncementPin(id: string) {
    const session = await requireAdmin();

    const current = await prisma.globalNote.findUnique({ where: { id } });
    if (!current) throw new Error("Announcement not found");

    const note = await prisma.globalNote.update({
        where: { id },
        data: { isPinned: !current.isPinned },
    });

    await createAuditLog(session.user.id, "UPDATE", "Announcement", id, {
        isPinned: note.isPinned,
    });

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

// ============================================
// ADMIN STATS
// ============================================

/**
 * Get acknowledgment statistics for an announcement (Admin only)
 */
export async function getAnnouncementStats(announcementId: string) {
    await requireAdmin();

    const [totalReads, totalAcknowledged, reads] = await Promise.all([
        prisma.announcementRead.count({ where: { announcementId } }),
        prisma.announcementRead.count({
            where: { announcementId, acknowledged: true },
        }),
        prisma.announcementRead.findMany({
            where: { announcementId },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { readAt: "desc" },
        }),
    ]);

    const totalUsers = await prisma.user.count({
        where: { isActive: true, role: { in: ["DISPATCHER", "ADMIN"] } },
    });

    return {
        totalReads,
        totalAcknowledged,
        totalUsers,
        reads,
        acknowledgmentRate:
            totalUsers > 0
                ? Math.round((totalAcknowledged / totalUsers) * 100)
                : 0,
    };
}

/**
 * Get all announcements with their stats (Admin only)
 */
export async function getAllAnnouncementsWithStats() {
    await requireAdmin();

    const announcements = await prisma.globalNote.findMany({
        where: { isAnnouncement: true },
        include: {
            author: { select: { id: true, name: true } },
            _count: {
                select: { reads: true },
            },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return announcements;
}

/**
 * Get all shift notes (Admin only - for viewing all shift handoffs)
 */
export async function getAllShiftNotes(options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
}) {
    await requireAdmin();

    const where: Record<string, unknown> = { isAnnouncement: false };

    if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options.startDate) {
            (where.createdAt as Record<string, Date>).gte = options.startDate;
        }
        if (options.endDate) {
            (where.createdAt as Record<string, Date>).lte = options.endDate;
        }
    }

    const [notes, total] = await Promise.all([
        prisma.globalNote.findMany({
            where,
            include: {
                author: { select: { id: true, name: true } },
                shift: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        }),
        prisma.globalNote.count({ where }),
    ]);

    return { notes, total };
}

// ============================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================

/**
 * @deprecated Use getDashboardNotes or getAllAnnouncementsWithStats instead
 * Get all global notes (any authenticated user can view)
 */
export async function getGlobalNotes() {
    await requireAuth();

    return await prisma.globalNote.findMany({
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
    });
}

/**
 * @deprecated Use createAnnouncement instead
 * Create a new global note (ADMIN/SUPER_ADMIN only)
 */
export async function createGlobalNote(data: {
    authorId: string;
    title: string;
    content: string;
}) {
    const session = await requireAdmin();

    const note = await prisma.globalNote.create({
        data: {
            ...data,
            isAnnouncement: true, // Legacy notes become announcements
        },
        include: { author: { select: { id: true, name: true } } },
    });

    await createAuditLog(session.user.id, "CREATE", "GlobalNote", note.id, {
        title: data.title,
    });

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

/**
 * @deprecated Use updateAnnouncement instead
 * Update a global note (ADMIN/SUPER_ADMIN only)
 */
export async function updateGlobalNote(
    id: string,
    data: { title?: string; content?: string }
) {
    const session = await requireAdmin();

    const note = await prisma.globalNote.update({
        where: { id },
        data,
        include: { author: { select: { id: true, name: true } } },
    });

    await createAuditLog(session.user.id, "UPDATE", "GlobalNote", id, data);

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

/**
 * @deprecated Use deleteAnnouncement instead
 * Delete a global note (ADMIN/SUPER_ADMIN only)
 */
export async function deleteGlobalNote(id: string) {
    const session = await requireAdmin();

    await prisma.globalNote.delete({ where: { id } });

    await createAuditLog(session.user.id, "DELETE", "GlobalNote", id);

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
}

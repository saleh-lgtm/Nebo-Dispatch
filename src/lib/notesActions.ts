"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { z } from "zod";
import {
    createNoteSchema,
    createAnnouncementSchema,
    updateAnnouncementSchema,
    getAllShiftNotesSchema,
} from "./schemas";
import type {
    DashboardNotesData,
    AnnouncementWithStatus,
    ShiftHandoffNote,
} from "@/types/note";

const idSchema = z.string().min(1, "ID is required");

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
): Promise<{ success: boolean; data?: DashboardNotesData; error?: string }> {
    try {
        await requireAuth();

        const userIdResult = idSchema.safeParse(userId);
        if (!userIdResult.success) {
            return { success: false, error: "Invalid user ID" };
        }

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
            success: true,
            data: {
                announcements: announcementsWithStatus,
                shiftNotes: shiftNotesWithContext,
                unacknowledgedCount,
            },
        };
    } catch (error) {
        console.error("getDashboardNotes error:", error);
        return { success: false, error: "Failed to get dashboard notes" };
    }
}

// ============================================
// ANNOUNCEMENT ACKNOWLEDGMENT
// ============================================

/**
 * Acknowledge an announcement (marks as read and acknowledged)
 */
export async function acknowledgeAnnouncement(announcementId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(announcementId);
        if (!idResult.success) {
            return { success: false, error: "Invalid announcement ID" };
        }

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
            await prisma.shiftReport.updateMany({
                where: { shiftId: activeShift.id },
                data: { announcementsRead: { increment: 1 } },
            });
        }

        revalidatePath("/dashboard");
        return { success: true, data: read };
    } catch (error) {
        console.error("acknowledgeAnnouncement error:", error);
        return { success: false, error: "Failed to acknowledge announcement" };
    }
}

/**
 * Get unacknowledged announcements for a user
 */
export async function getUnacknowledgedAnnouncements(userId: string) {
    try {
        await requireAuth();

        const userIdResult = idSchema.safeParse(userId);
        if (!userIdResult.success) {
            return { success: false, error: "Invalid user ID", data: [] };
        }

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

        return { success: true, data: announcements.filter((a) => a.reads.length === 0) };
    } catch (error) {
        console.error("getUnacknowledgedAnnouncements error:", error);
        return { success: false, error: "Failed to get unacknowledged announcements", data: [] };
    }
}

// ============================================
// SHIFT NOTE CREATION (Any authenticated user with active shift)
// ============================================

/**
 * Create a shift handoff note (links to user's active shift)
 */
export async function createShiftNote(data: { title: string; content: string }) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = createNoteSchema.safeParse(data);
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        // Get user's active shift
        const activeShift = await prisma.shift.findFirst({
            where: { userId: session.user.id, clockOut: null },
        });

        if (!activeShift) {
            return {
                success: false,
                error: "No active shift found. Please clock in to create shift notes.",
            };
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
        return { success: true, data: note };
    } catch (error) {
        console.error("createShiftNote error:", error);
        return { success: false, error: "Failed to create shift note" };
    }
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
    try {
        const session = await requireAdmin();

        const parseResult = createAnnouncementSchema.safeParse(data);
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

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
        return { success: true, data: note };
    } catch (error) {
        console.error("createAnnouncement error:", error);
        return { success: false, error: "Failed to create announcement" };
    }
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
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid announcement ID" };
        }

        const dataResult = updateAnnouncementSchema.safeParse(data);
        if (!dataResult.success) {
            const errors = dataResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const note = await prisma.globalNote.update({
            where: { id },
            data,
            include: { author: { select: { id: true, name: true } } },
        });

        await createAuditLog(session.user.id, "UPDATE", "Announcement", id, data);

        revalidatePath("/admin/notes");
        revalidatePath("/dashboard");
        return { success: true, data: note };
    } catch (error) {
        console.error("updateAnnouncement error:", error);
        return { success: false, error: "Failed to update announcement" };
    }
}

/**
 * Delete an announcement (Admin only)
 */
export async function deleteAnnouncement(id: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid announcement ID" };
        }

        await prisma.globalNote.delete({ where: { id } });

        await createAuditLog(session.user.id, "DELETE", "Announcement", id);

        revalidatePath("/admin/notes");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("deleteAnnouncement error:", error);
        return { success: false, error: "Failed to delete announcement" };
    }
}

/**
 * Toggle pin status of an announcement (Admin only)
 */
export async function toggleAnnouncementPin(id: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid announcement ID" };
        }

        const current = await prisma.globalNote.findUnique({ where: { id } });
        if (!current) {
            return { success: false, error: "Announcement not found" };
        }

        const note = await prisma.globalNote.update({
            where: { id },
            data: { isPinned: !current.isPinned },
        });

        await createAuditLog(session.user.id, "UPDATE", "Announcement", id, {
            isPinned: note.isPinned,
        });

        revalidatePath("/admin/notes");
        revalidatePath("/dashboard");
        return { success: true, data: note };
    } catch (error) {
        console.error("toggleAnnouncementPin error:", error);
        return { success: false, error: "Failed to toggle pin" };
    }
}

// ============================================
// ADMIN STATS
// ============================================

/**
 * Get acknowledgment statistics for an announcement (Admin only)
 */
export async function getAnnouncementStats(announcementId: string) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(announcementId);
        if (!idResult.success) {
            return { success: false, error: "Invalid announcement ID" };
        }

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
            success: true,
            data: {
                totalReads,
                totalAcknowledged,
                totalUsers,
                reads,
                acknowledgmentRate:
                    totalUsers > 0
                        ? Math.round((totalAcknowledged / totalUsers) * 100)
                        : 0,
            },
        };
    } catch (error) {
        console.error("getAnnouncementStats error:", error);
        return { success: false, error: "Failed to get announcement stats" };
    }
}

/**
 * Get all announcements with their stats (Admin only)
 */
export async function getAllAnnouncementsWithStats() {
    try {
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

        return { success: true, data: announcements };
    } catch (error) {
        console.error("getAllAnnouncementsWithStats error:", error);
        return { success: false, error: "Failed to get announcements", data: [] };
    }
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
    try {
        await requireAdmin();

        if (options) {
            const parseResult = getAllShiftNotesSchema.safeParse(options);
            if (!parseResult.success) {
                return { success: false, error: "Invalid options" };
            }
        }

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

        return { success: true, data: { notes, total } };
    } catch (error) {
        console.error("getAllShiftNotes error:", error);
        return { success: false, error: "Failed to get shift notes" };
    }
}

// ============================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================

/**
 * @deprecated Use getDashboardNotes or getAllAnnouncementsWithStats instead
 * Get all global notes (any authenticated user can view)
 */
export async function getGlobalNotes() {
    try {
        await requireAuth();

        const data = await prisma.globalNote.findMany({
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getGlobalNotes error:", error);
        return { success: false, error: "Failed to get notes", data: [] };
    }
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
    try {
        const session = await requireAdmin();

        const parseResult = createNoteSchema.safeParse(data);
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

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
        return { success: true, data: note };
    } catch (error) {
        console.error("createGlobalNote error:", error);
        return { success: false, error: "Failed to create note" };
    }
}

/**
 * @deprecated Use updateAnnouncement instead
 * Update a global note (ADMIN/SUPER_ADMIN only)
 */
export async function updateGlobalNote(
    id: string,
    data: { title?: string; content?: string }
) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid note ID" };
        }

        const note = await prisma.globalNote.update({
            where: { id },
            data,
            include: { author: { select: { id: true, name: true } } },
        });

        await createAuditLog(session.user.id, "UPDATE", "GlobalNote", id, data);

        revalidatePath("/admin/notes");
        revalidatePath("/dashboard");
        return { success: true, data: note };
    } catch (error) {
        console.error("updateGlobalNote error:", error);
        return { success: false, error: "Failed to update note" };
    }
}

/**
 * @deprecated Use deleteAnnouncement instead
 * Delete a global note (ADMIN/SUPER_ADMIN only)
 */
export async function deleteGlobalNote(id: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid note ID" };
        }

        await prisma.globalNote.delete({ where: { id } });

        await createAuditLog(session.user.id, "DELETE", "GlobalNote", id);

        revalidatePath("/admin/notes");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("deleteGlobalNote error:", error);
        return { success: false, error: "Failed to delete note" };
    }
}

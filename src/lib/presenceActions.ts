"use server";

import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { updatePresenceSchema } from "./schemas";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function updatePresence(currentPage?: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = updatePresenceSchema.safeParse({ currentPage });
        if (!parseResult.success) {
            return { success: false, error: "Invalid input" };
        }

        await prisma.userPresence.upsert({
            where: { userId: session.user.id },
            update: {
                isOnline: true,
                lastSeenAt: new Date(),
                currentPage: parseResult.data.currentPage,
            },
            create: {
                userId: session.user.id,
                isOnline: true,
                lastSeenAt: new Date(),
                currentPage: parseResult.data.currentPage,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("updatePresence error:", error);
        return { success: false, error: "Failed to update presence" };
    }
}

export async function setOffline() {
    try {
        const session = await requireAuth();

        await prisma.userPresence.upsert({
            where: { userId: session.user.id },
            update: {
                isOnline: false,
                lastSeenAt: new Date(),
            },
            create: {
                userId: session.user.id,
                isOnline: false,
                lastSeenAt: new Date(),
            },
        });

        return { success: true };
    } catch (error) {
        console.error("setOffline error:", error);
        return { success: false, error: "Failed to set offline" };
    }
}

export async function getOnlineUsers() {
    try {
        await requireAuth();

        const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        const presences = await prisma.userPresence.findMany({
            where: {
                lastSeenAt: { gte: threshold },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { lastSeenAt: "desc" },
        });

        const data = presences.map((p) => ({
            ...p.user,
            currentPage: p.currentPage,
            lastSeenAt: p.lastSeenAt,
        }));

        return { success: true, data };
    } catch (error) {
        console.error("getOnlineUsers error:", error);
        return { success: false, error: "Failed to get online users", data: [] };
    }
}

export async function getOnlineCount() {
    try {
        await requireAuth();

        const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        const count = await prisma.userPresence.count({
            where: {
                lastSeenAt: { gte: threshold },
            },
        });

        return { success: true, data: count };
    } catch (error) {
        console.error("getOnlineCount error:", error);
        return { success: false, error: "Failed to get online count", data: 0 };
    }
}

export async function getActiveShiftUsers() {
    try {
        await requireAuth();

        // Users with active shifts (clocked in, not clocked out)
        const activeShifts = await prisma.shift.findMany({
            where: {
                clockOut: null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { clockIn: "desc" },
        });

        const data = activeShifts.map((s) => ({
            ...s.user,
            clockIn: s.clockIn,
            shiftId: s.id,
        }));

        return { success: true, data };
    } catch (error) {
        console.error("getActiveShiftUsers error:", error);
        return { success: false, error: "Failed to get active shift users", data: [] };
    }
}

// Admin function to get full presence info
export async function getPresenceReport() {
    try {
        await requireAdmin();

        const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        const [online, activeShifts, total] = await Promise.all([
            prisma.userPresence.count({
                where: { lastSeenAt: { gte: threshold } },
            }),
            prisma.shift.count({
                where: { clockOut: null },
            }),
            prisma.user.count({
                where: { isActive: true },
            }),
        ]);

        return { success: true, data: { online, activeShifts, total } };
    } catch (error) {
        console.error("getPresenceReport error:", error);
        return { success: false, error: "Failed to get presence report", data: { online: 0, activeShifts: 0, total: 0 } };
    }
}

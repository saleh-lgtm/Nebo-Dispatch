"use server";

import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "./auth-helpers";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function updatePresence(currentPage?: string) {
    const session = await requireAuth();

    await prisma.userPresence.upsert({
        where: { userId: session.user.id },
        update: {
            isOnline: true,
            lastSeenAt: new Date(),
            currentPage,
        },
        create: {
            userId: session.user.id,
            isOnline: true,
            lastSeenAt: new Date(),
            currentPage,
        },
    });
}

export async function setOffline() {
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
}

export async function getOnlineUsers() {
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

    return presences.map((p) => ({
        ...p.user,
        currentPage: p.currentPage,
        lastSeenAt: p.lastSeenAt,
    }));
}

export async function getOnlineCount() {
    await requireAuth();

    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

    return prisma.userPresence.count({
        where: {
            lastSeenAt: { gte: threshold },
        },
    });
}

export async function getActiveShiftUsers() {
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

    return activeShifts.map((s) => ({
        ...s.user,
        clockIn: s.clockIn,
        shiftId: s.id,
    }));
}

// Admin function to get full presence info
export async function getPresenceReport() {
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

    return { online, activeShifts, total };
}

"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { BadgeCounts } from "@/config/navigation";

/**
 * Fetch badge counts for navigation items.
 * Only returns counts for ADMIN and SUPER_ADMIN roles.
 * Other roles get empty counts (they don't have badge items).
 */
export async function getNavBadgeCounts(): Promise<{ success: true; data: BadgeCounts }> {
    const emptyCounts: BadgeCounts = {
        pendingConfirmations: 0,
        unreadSms: 0,
        pendingRequests: 0,
        pendingTasks: 0,
        newTbrTrips: 0,
    };

    const session = await getServerSession(authOptions);

    if (!session) {
        return { success: true, data: emptyCounts };
    }

    const role = session.user.role;

    // Only ADMIN and SUPER_ADMIN see badge counts
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return { success: true, data: emptyCounts };
    }

    try {
        // Calculate 24 hours ago for "new" items
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        // Fetch all counts in parallel
        const [
            pendingConfirmations,
            unreadSms,
            pendingTimeOff,
            pendingSwaps,
            pendingTasks,
            newTbrTrips,
        ] = await Promise.all([
            // Pending trip confirmations
            prisma.tripConfirmation.count({
                where: {
                    status: "PENDING",
                },
            }),

            // Recent inbound SMS messages (last 24 hours)
            // Note: SMSLog doesn't have read tracking, so we count recent inbound
            prisma.sMSLog.count({
                where: {
                    direction: "INBOUND",
                    createdAt: {
                        gte: twentyFourHoursAgo,
                    },
                },
            }),

            // Pending time off requests
            prisma.timeOffRequest.count({
                where: {
                    status: "PENDING",
                },
            }),

            // Pending shift swap requests (either awaiting target or admin approval)
            prisma.shiftSwapRequest.count({
                where: {
                    status: {
                        in: ["PENDING_TARGET", "PENDING_ADMIN"],
                    },
                },
            }),

            // Active admin tasks
            prisma.adminTask.count({
                where: {
                    isActive: true,
                },
            }),

            // New TBR trips in the last 24 hours
            prisma.tbrTrip.count({
                where: {
                    createdAt: {
                        gte: twentyFourHoursAgo,
                    },
                    tbrStatus: "PENDING",
                },
            }),
        ]);

        return {
            success: true,
            data: {
                pendingConfirmations,
                unreadSms,
                pendingRequests: pendingTimeOff + pendingSwaps,
                pendingTasks,
                newTbrTrips,
            },
        };
    } catch (error) {
        console.error("Failed to fetch nav badge counts:", error);
        return { success: true, data: emptyCounts };
    }
}

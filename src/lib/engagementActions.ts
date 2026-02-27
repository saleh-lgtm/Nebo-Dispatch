"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";
import {
    ENGAGEMENT_POINTS,
    type DispatcherEngagement,
    type DailyEngagement,
    type EngagementReport,
} from "./engagementTypes";

// Re-export types for consumers (types are allowed in "use server" files)
export type { EngagementAction, DispatcherEngagement, DailyEngagement, EngagementReport } from "./engagementTypes";

/**
 * Get dispatcher engagement metrics for a given timeframe
 */
export async function getEngagementReport(
    days: number = 7
): Promise<EngagementReport> {
    await requireAdmin();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all active dispatchers
    const dispatchers = await prisma.user.findMany({
        where: {
            isActive: true,
            role: { in: ["DISPATCHER", "ADMIN"] },
        },
        select: { id: true, name: true },
    });

    // Build engagement data for each dispatcher
    const dispatcherEngagements: DispatcherEngagement[] = [];

    for (const dispatcher of dispatchers) {
        // Get audit logs for this dispatcher
        const auditLogs = await prisma.auditLog.findMany({
            where: {
                userId: dispatcher.id,
                createdAt: { gte: startDate, lte: endDate },
            },
            select: {
                action: true,
                entity: true,
                createdAt: true,
            },
        });

        // Count specific actions
        const quotesCreated = auditLogs.filter(
            (log) => log.action === "CREATE" && log.entity === "Quote"
        ).length;

        const tripsConfirmed = auditLogs.filter(
            (log) =>
                log.entity === "TripConfirmation" &&
                (log.action === "UPDATE" || log.action === "CREATE")
        ).length;

        const smsSent = auditLogs.filter(
            (log) => log.action === "CREATE" && log.entity === "SMS"
        ).length;

        const billingReviews = auditLogs.filter(
            (log) => log.action === "CREATE" && log.entity === "BillingReview"
        ).length;

        const quoteFollowups = auditLogs.filter(
            (log) => log.action === "FOLLOW_UP" && log.entity === "Quote"
        ).length;

        const shiftNotesCreated = auditLogs.filter(
            (log) => log.action === "CREATE" && log.entity === "ShiftNote"
        ).length;

        // Get task completions directly from the database for more accuracy
        const tasksCompleted = await prisma.adminTaskCompletion.count({
            where: {
                userId: dispatcher.id,
                completedAt: { gte: startDate, lte: endDate },
            },
        });

        // Get announcement acknowledgments
        const announcementsAcknowledged = await prisma.announcementRead.count({
            where: {
                userId: dispatcher.id,
                acknowledgedAt: { gte: startDate, lte: endDate },
            },
        });

        // Calculate total points
        const totalPoints =
            quotesCreated * ENGAGEMENT_POINTS.QUOTE_CREATED +
            tripsConfirmed * ENGAGEMENT_POINTS.TRIP_CONFIRMED +
            smsSent * ENGAGEMENT_POINTS.SMS_SENT +
            tasksCompleted * ENGAGEMENT_POINTS.TASK_COMPLETED +
            billingReviews * ENGAGEMENT_POINTS.BILLING_REVIEW +
            shiftNotesCreated * ENGAGEMENT_POINTS.SHIFT_NOTE_CREATED +
            announcementsAcknowledged * ENGAGEMENT_POINTS.ANNOUNCEMENT_ACKNOWLEDGED +
            quoteFollowups * ENGAGEMENT_POINTS.QUOTE_FOLLOWUP;

        const totalActions =
            quotesCreated +
            tripsConfirmed +
            smsSent +
            tasksCompleted +
            billingReviews +
            shiftNotesCreated +
            announcementsAcknowledged +
            quoteFollowups;

        dispatcherEngagements.push({
            userId: dispatcher.id,
            userName: dispatcher.name || "Unknown",
            totalPoints,
            totalActions,
            breakdown: {
                quotesCreated,
                tripsConfirmed,
                smsSent,
                tasksCompleted,
                billingReviews,
                shiftNotesCreated,
                announcementsAcknowledged,
                quoteFollowups,
            },
        });
    }

    // Sort by total points descending
    dispatcherEngagements.sort((a, b) => b.totalPoints - a.totalPoints);

    // Generate daily trend data
    const dailyTrend: DailyEngagement[] = [];

    for (let i = 0; i < days; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(dayStart.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dateStr = dayStart.toISOString().split("T")[0];

        const dayData: DailyEngagement = {
            date: dateStr,
            dispatchers: [],
            totalActions: 0,
            totalPoints: 0,
        };

        for (const dispatcher of dispatchers) {
            // Get audit logs for this day
            const dayLogs = await prisma.auditLog.count({
                where: {
                    userId: dispatcher.id,
                    createdAt: { gte: dayStart, lte: dayEnd },
                    OR: [
                        { action: "CREATE", entity: "Quote" },
                        { entity: "TripConfirmation" },
                        { action: "CREATE", entity: "SMS" },
                        { action: "CREATE", entity: "BillingReview" },
                        { action: "FOLLOW_UP", entity: "Quote" },
                        { action: "CREATE", entity: "ShiftNote" },
                    ],
                },
            });

            // Get task completions for this day
            const dayTasks = await prisma.adminTaskCompletion.count({
                where: {
                    userId: dispatcher.id,
                    completedAt: { gte: dayStart, lte: dayEnd },
                },
            });

            const actions = dayLogs + dayTasks;
            // Estimate points (simplified for daily view)
            const points = actions * 4; // Average point value

            if (actions > 0) {
                dayData.dispatchers.push({
                    userId: dispatcher.id,
                    userName: dispatcher.name || "Unknown",
                    actions,
                    points,
                });
                dayData.totalActions += actions;
                dayData.totalPoints += points;
            }
        }

        dailyTrend.push(dayData);
    }

    // Generate top performers list
    const topPerformers = dispatcherEngagements
        .slice(0, 10)
        .map((d, index) => ({
            userId: d.userId,
            userName: d.userName,
            totalPoints: d.totalPoints,
            rank: index + 1,
        }));

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dispatchers: dispatcherEngagements,
        dailyTrend,
        topPerformers,
    };
}

/**
 * Get simplified daily action counts for chart display
 * More efficient query for Area Chart data
 */
export async function getDailyEngagementTrend(days: number = 7) {
    await requireAdmin();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all active dispatchers
    const dispatchers = await prisma.user.findMany({
        where: {
            isActive: true,
            role: { in: ["DISPATCHER", "ADMIN"] },
        },
        select: { id: true, name: true },
    });

    // Get all audit logs in the range
    const auditLogs = await prisma.auditLog.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate },
            userId: { in: dispatchers.map((d) => d.id) },
            OR: [
                { action: "CREATE", entity: "Quote" },
                { entity: "TripConfirmation" },
                { action: "CREATE", entity: "SMS" },
                { action: "CREATE", entity: "BillingReview" },
                { action: "FOLLOW_UP", entity: "Quote" },
                { action: "CREATE", entity: "ShiftNote" },
                { action: "CREATE", entity: "GlobalNote" },
            ],
        },
        select: {
            userId: true,
            createdAt: true,
            action: true,
            entity: true,
        },
    });

    // Get task completions
    const taskCompletions = await prisma.adminTaskCompletion.findMany({
        where: {
            userId: { in: dispatchers.map((d) => d.id) },
            completedAt: { gte: startDate, lte: endDate },
        },
        select: {
            userId: true,
            completedAt: true,
        },
    });

    // Create a map for dispatcher names
    const dispatcherMap = new Map(dispatchers.map((d) => [d.id, d.name || "Unknown"]));

    // Build daily data structure
    const dailyData: Record<
        string,
        { date: string; total: number; [key: string]: string | number }
    > = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
        const day = new Date(startDate);
        day.setDate(day.getDate() + i);
        const dateStr = day.toISOString().split("T")[0];
        dailyData[dateStr] = { date: dateStr, total: 0 };

        // Initialize each dispatcher with 0
        for (const dispatcher of dispatchers) {
            dailyData[dateStr][dispatcher.id] = 0;
        }
    }

    // Process audit logs
    for (const log of auditLogs) {
        const dateStr = log.createdAt.toISOString().split("T")[0];
        if (dailyData[dateStr]) {
            const currentVal = dailyData[dateStr][log.userId];
            if (typeof currentVal === "number") {
                dailyData[dateStr][log.userId] = currentVal + 1;
                dailyData[dateStr].total =
                    (dailyData[dateStr].total as number) + 1;
            }
        }
    }

    // Process task completions
    for (const task of taskCompletions) {
        if (task.completedAt) {
            const dateStr = task.completedAt.toISOString().split("T")[0];
            if (dailyData[dateStr]) {
                const currentVal = dailyData[dateStr][task.userId];
                if (typeof currentVal === "number") {
                    dailyData[dateStr][task.userId] = currentVal + 1;
                    dailyData[dateStr].total =
                        (dailyData[dateStr].total as number) + 1;
                }
            }
        }
    }

    // Convert to array and sort by date
    const chartData = Object.values(dailyData).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Build dispatcher info for legend
    const dispatcherInfo = dispatchers.map((d) => ({
        id: d.id,
        name: d.name || "Unknown",
        color: getDispatcherColor(dispatchers.indexOf(d)),
    }));

    return {
        chartData,
        dispatchers: dispatcherInfo,
    };
}

/**
 * Get color for dispatcher based on index
 */
function getDispatcherColor(index: number): string {
    const colors = [
        "#3b82f6", // blue
        "#22c55e", // green
        "#f59e0b", // amber
        "#ef4444", // red
        "#8b5cf6", // violet
        "#ec4899", // pink
        "#06b6d4", // cyan
        "#84cc16", // lime
        "#f97316", // orange
        "#6366f1", // indigo
    ];
    return colors[index % colors.length];
}

/**
 * Get engagement summary for a single dispatcher
 */
export async function getDispatcherEngagement(
    userId: string,
    days: number = 30
) {
    await requireAdmin();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
    });

    if (!user) {
        throw new Error("User not found");
    }

    const auditLogs = await prisma.auditLog.findMany({
        where: {
            userId,
            createdAt: { gte: startDate, lte: endDate },
        },
        select: {
            action: true,
            entity: true,
            createdAt: true,
        },
    });

    // Count specific actions
    const quotesCreated = auditLogs.filter(
        (log) => log.action === "CREATE" && log.entity === "Quote"
    ).length;

    const tripsConfirmed = auditLogs.filter(
        (log) => log.entity === "TripConfirmation"
    ).length;

    const smsSent = auditLogs.filter(
        (log) => log.action === "CREATE" && log.entity === "SMS"
    ).length;

    const billingReviews = auditLogs.filter(
        (log) => log.action === "CREATE" && log.entity === "BillingReview"
    ).length;

    const quoteFollowups = auditLogs.filter(
        (log) => log.action === "FOLLOW_UP" && log.entity === "Quote"
    ).length;

    const tasksCompleted = await prisma.adminTaskCompletion.count({
        where: {
            userId,
            completedAt: { gte: startDate, lte: endDate },
        },
    });

    const announcementsAcknowledged = await prisma.announcementRead.count({
        where: {
            userId,
            acknowledgedAt: { gte: startDate, lte: endDate },
        },
    });

    const totalPoints =
        quotesCreated * ENGAGEMENT_POINTS.QUOTE_CREATED +
        tripsConfirmed * ENGAGEMENT_POINTS.TRIP_CONFIRMED +
        smsSent * ENGAGEMENT_POINTS.SMS_SENT +
        tasksCompleted * ENGAGEMENT_POINTS.TASK_COMPLETED +
        billingReviews * ENGAGEMENT_POINTS.BILLING_REVIEW +
        announcementsAcknowledged * ENGAGEMENT_POINTS.ANNOUNCEMENT_ACKNOWLEDGED +
        quoteFollowups * ENGAGEMENT_POINTS.QUOTE_FOLLOWUP;

    return {
        userId: user.id,
        userName: user.name || "Unknown",
        days,
        totalPoints,
        breakdown: {
            quotesCreated,
            tripsConfirmed,
            smsSent,
            tasksCompleted,
            billingReviews,
            announcementsAcknowledged,
            quoteFollowups,
        },
        pointValues: ENGAGEMENT_POINTS,
    };
}

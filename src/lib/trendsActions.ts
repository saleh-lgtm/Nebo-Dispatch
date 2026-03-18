"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";
import { dateRangeSchema } from "./schemas";

interface DailyActivity {
    date: string;
    smsSent: number;
    quotesCreated: number;
    confirmationsCompleted: number;
}

interface DispatcherActivity {
    userId: string;
    userName: string;
    smsSent: number;
    quotesCreated: number;
}

/**
 * Daily activity trend from real source models (SMSLog, Quote, TripConfirmation).
 * Every date in the range appears even if counts are 0.
 */
export async function getDailyActivityTrend(
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; data?: DailyActivity[]; error?: string }> {
    try {
        await requireAdmin();

        const parseResult = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid date range" };
        }

        const [smsLogs, quotes, confirmations] = await Promise.all([
            // Outbound SMS by date
            prisma.sMSLog.findMany({
                where: {
                    direction: "OUTBOUND",
                    createdAt: { gte: startDate, lte: endDate },
                },
                select: { createdAt: true },
            }),

            // Quotes by date
            prisma.quote.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                },
                select: { createdAt: true },
            }),

            // Completed confirmations by date
            prisma.tripConfirmation.findMany({
                where: {
                    status: "CONFIRMED",
                    completedAt: { gte: startDate, lte: endDate },
                },
                select: { completedAt: true },
            }),
        ]);

        // Build counts map
        const countsMap = new Map<string, { smsSent: number; quotesCreated: number; confirmationsCompleted: number }>();

        for (const sms of smsLogs) {
            const dateKey = sms.createdAt.toISOString().split("T")[0];
            const entry = countsMap.get(dateKey) || { smsSent: 0, quotesCreated: 0, confirmationsCompleted: 0 };
            entry.smsSent++;
            countsMap.set(dateKey, entry);
        }

        for (const quote of quotes) {
            const dateKey = quote.createdAt.toISOString().split("T")[0];
            const entry = countsMap.get(dateKey) || { smsSent: 0, quotesCreated: 0, confirmationsCompleted: 0 };
            entry.quotesCreated++;
            countsMap.set(dateKey, entry);
        }

        for (const conf of confirmations) {
            if (!conf.completedAt) continue;
            const dateKey = conf.completedAt.toISOString().split("T")[0];
            const entry = countsMap.get(dateKey) || { smsSent: 0, quotesCreated: 0, confirmationsCompleted: 0 };
            entry.confirmationsCompleted++;
            countsMap.set(dateKey, entry);
        }

        // Fill every date in range (including zero-count days)
        const result: DailyActivity[] = [];
        const current = new Date(startDate);
        current.setUTCHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setUTCHours(0, 0, 0, 0);

        while (current <= end) {
            const dateKey = current.toISOString().split("T")[0];
            const entry = countsMap.get(dateKey) || { smsSent: 0, quotesCreated: 0, confirmationsCompleted: 0 };
            result.push({ date: dateKey, ...entry });
            current.setUTCDate(current.getUTCDate() + 1);
        }

        return { success: true, data: result };
    } catch (error) {
        console.error("getDailyActivityTrend error:", error);
        return { success: false, error: "Failed to get daily activity trend" };
    }
}

/**
 * Per-dispatcher activity comparison from real source models.
 * Top 8 dispatchers by SMS sent, with quote counts joined.
 */
export async function getDispatcherActivityComparison(
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; data?: DispatcherActivity[]; error?: string }> {
    try {
        await requireAdmin();

        const parseResult = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid date range" };
        }

        // Get active dispatchers/admins
        const dispatchers = await prisma.user.findMany({
            where: {
                role: { in: ["DISPATCHER", "ADMIN"] },
                isActive: true,
            },
            select: { id: true, name: true },
        });

        if (dispatchers.length === 0) {
            return { success: true, data: [] };
        }

        const dispatcherIds = dispatchers.map(d => d.id);

        const [smsByUser, quotesByUser] = await Promise.all([
            // Outbound SMS per dispatcher
            prisma.sMSLog.groupBy({
                by: ["sentById"],
                _count: { id: true },
                where: {
                    sentById: { in: dispatcherIds },
                    direction: "OUTBOUND",
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),

            // Quotes per dispatcher
            prisma.quote.groupBy({
                by: ["createdById"],
                _count: { id: true },
                where: {
                    createdById: { in: dispatcherIds },
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),
        ]);

        const smsMap = new Map(
            smsByUser
                .filter(s => s.sentById !== null)
                .map(s => [s.sentById!, s._count.id])
        );
        const quotesMap = new Map(
            quotesByUser.map(q => [q.createdById, q._count.id])
        );

        const nameMap = new Map(dispatchers.map(d => [d.id, d.name ?? "Unknown"]));

        // Build rows for all dispatchers that have any activity
        const rows: DispatcherActivity[] = [];
        for (const id of dispatcherIds) {
            const smsSent = smsMap.get(id) || 0;
            const quotesCreated = quotesMap.get(id) || 0;
            if (smsSent === 0 && quotesCreated === 0) continue;
            rows.push({
                userId: id,
                userName: nameMap.get(id) || "Unknown",
                smsSent,
                quotesCreated,
            });
        }

        // Sort by smsSent desc, take top 8
        rows.sort((a, b) => b.smsSent - a.smsSent);

        return { success: true, data: rows.slice(0, 8) };
    } catch (error) {
        console.error("getDispatcherActivityComparison error:", error);
        return { success: false, error: "Failed to get dispatcher activity comparison" };
    }
}

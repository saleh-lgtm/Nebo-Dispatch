"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";
import { dateRangeSchema } from "./schemas";

interface OverallMetrics {
    totalCalls: number;
    totalEmails: number;
    totalQuotes: number;
    totalReports: number;
    averageCallsPerShift: number;
}

interface DispatcherMetrics {
    userId: string;
    userName: string;
    calls: number;
    emails: number;
    quotes: number;
    reportCount: number;
}

// Get overall performance metrics for a date range (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN metrics, excludes SUPER_ADMIN
export async function getPerformanceMetrics(
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; data?: OverallMetrics; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid date range" };
        }

        const reports = await prisma.shiftReport.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                user: {
                    role: { in: ["DISPATCHER", "ADMIN"] },
                },
            },
        });

        const totalCalls = reports.reduce((sum, r) => sum + r.callsReceived, 0);
        const totalEmails = reports.reduce((sum, r) => sum + r.emailsSent, 0);
        const totalQuotes = reports.reduce((sum, r) => sum + r.quotesGiven, 0);

        return {
            success: true,
            data: {
                totalCalls,
                totalEmails,
                totalQuotes,
                totalReports: reports.length,
                averageCallsPerShift: reports.length > 0 ? Math.round(totalCalls / reports.length) : 0,
            },
        };
    } catch (error) {
        console.error("getPerformanceMetrics error:", error);
        return { success: false, error: "Failed to get performance metrics" };
    }
}

// Get per-dispatcher comparison metrics (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN metrics, excludes SUPER_ADMIN
export async function getDispatcherComparison(
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; data?: DispatcherMetrics[]; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid date range" };
        }

        const reports = await prisma.shiftReport.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                user: {
                    role: { in: ["DISPATCHER", "ADMIN"] },
                },
            },
            include: { user: { select: { id: true, name: true, role: true } } },
        });

        const userMap = new Map<string, DispatcherMetrics>();

        for (const report of reports) {
            const existing = userMap.get(report.userId) || {
                userId: report.userId,
                userName: report.user.name || "Unknown",
                calls: 0,
                emails: 0,
                quotes: 0,
                reportCount: 0,
            };

            existing.calls += report.callsReceived;
            existing.emails += report.emailsSent;
            existing.quotes += report.quotesGiven;
            existing.reportCount += 1;

            userMap.set(report.userId, existing);
        }

        return {
            success: true,
            data: Array.from(userMap.values()).sort((a, b) => b.calls - a.calls),
        };
    } catch (error) {
        console.error("getDispatcherComparison error:", error);
        return { success: false, error: "Failed to get dispatcher comparison" };
    }
}

// Get daily trend data (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN metrics, excludes SUPER_ADMIN
export async function getDailyTrend(
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; data?: { date: string; calls: number; emails: number; quotes: number }[]; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid date range" };
        }

        const reports = await prisma.shiftReport.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                user: {
                    role: { in: ["DISPATCHER", "ADMIN"] },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const dayMap = new Map<string, { calls: number; emails: number; quotes: number }>();

        for (const report of reports) {
            const dateKey = new Date(report.createdAt).toISOString().split("T")[0];
            const existing = dayMap.get(dateKey) || { calls: 0, emails: 0, quotes: 0 };
            existing.calls += report.callsReceived;
            existing.emails += report.emailsSent;
            existing.quotes += report.quotesGiven;
            dayMap.set(dateKey, existing);
        }

        const result = Array.from(dayMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { success: true, data: result };
    } catch (error) {
        console.error("getDailyTrend error:", error);
        return { success: false, error: "Failed to get daily trend" };
    }
}

// Get all dispatchers for selection (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN roles, excludes SUPER_ADMIN
export async function getDispatcherList(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAdmin();

        const dispatchers = await prisma.user.findMany({
            where: {
                role: { in: ["DISPATCHER", "ADMIN"] },
                isActive: true,
            },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: "asc" },
        });

        return { success: true, data: dispatchers };
    } catch (error) {
        console.error("getDispatcherList error:", error);
        return { success: false, error: "Failed to get dispatcher list" };
    }
}

// Get daily confirmation accountability trend
export async function getConfirmationAccountabilityTrend(
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; data?: { date: string; completed: number; missed: number; onTime: number }[]; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = dateRangeSchema.safeParse({ startDate, endDate });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid date range" };
        }

        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                pickupAt: { gte: startDate, lte: endDate },
            },
            select: {
                status: true,
                pickupAt: true,
                completedAt: true,
                minutesBeforeDue: true,
            },
        });

        const dayMap = new Map<
            string,
            { completed: number; missed: number; onTime: number }
        >();

        for (const conf of confirmations) {
            const dateKey = conf.pickupAt.toISOString().split("T")[0];
            const existing = dayMap.get(dateKey) || {
                completed: 0,
                missed: 0,
                onTime: 0,
            };

            if (conf.status === "EXPIRED") {
                existing.missed++;
            } else if (conf.completedAt) {
                existing.completed++;
                if (conf.minutesBeforeDue && conf.minutesBeforeDue > 0) {
                    existing.onTime++;
                }
            }

            dayMap.set(dateKey, existing);
        }

        const result = Array.from(dayMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { success: true, data: result };
    } catch (error) {
        console.error("getConfirmationAccountabilityTrend error:", error);
        return { success: false, error: "Failed to get confirmation accountability trend" };
    }
}

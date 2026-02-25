"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";

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
): Promise<OverallMetrics> {
    await requireAdmin();

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
        totalCalls,
        totalEmails,
        totalQuotes,
        totalReports: reports.length,
        averageCallsPerShift: reports.length > 0 ? Math.round(totalCalls / reports.length) : 0,
    };
}

// Get per-dispatcher comparison metrics (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN metrics, excludes SUPER_ADMIN
export async function getDispatcherComparison(
    startDate: Date,
    endDate: Date
): Promise<DispatcherMetrics[]> {
    await requireAdmin();

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

    return Array.from(userMap.values()).sort((a, b) => b.calls - a.calls);
}

// Get daily trend data (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN metrics, excludes SUPER_ADMIN
export async function getDailyTrend(
    startDate: Date,
    endDate: Date
): Promise<{ date: string; calls: number; emails: number; quotes: number }[]> {
    await requireAdmin();

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

    return Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// Get all dispatchers for selection (ADMIN/SUPER_ADMIN only)
// Includes DISPATCHER and ADMIN roles, excludes SUPER_ADMIN
export async function getDispatcherList() {
    await requireAdmin();

    return await prisma.user.findMany({
        where: {
            role: { in: ["DISPATCHER", "ADMIN"] },
            isActive: true
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
    });
}

// Get daily confirmation accountability trend
export async function getConfirmationAccountabilityTrend(
    startDate: Date,
    endDate: Date
): Promise<{ date: string; completed: number; missed: number; onTime: number }[]> {
    await requireAdmin();

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

    return Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

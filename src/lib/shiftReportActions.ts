"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Get all shift reports (ADMIN/SUPER_ADMIN only)
export async function getAllShiftReports(options?: {
    userId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}) {
    await requireAdmin();

    const where: Record<string, unknown> = {};

    if (options?.userId) {
        where.userId = options.userId;
    }

    if (options?.status) {
        where.status = options.status;
    }

    if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options?.startDate) {
            (where.createdAt as Record<string, Date>).gte = options.startDate;
        }
        if (options?.endDate) {
            (where.createdAt as Record<string, Date>).lte = options.endDate;
        }
    }

    const [reports, total] = await Promise.all([
        prisma.shiftReport.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                shift: {
                    select: {
                        id: true,
                        clockIn: true,
                        clockOut: true,
                        totalHours: true,
                        quotes: {
                            select: {
                                id: true,
                                clientName: true,
                                serviceType: true,
                                status: true,
                                estimatedAmount: true,
                            },
                        },
                    },
                },
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        }),
        prisma.shiftReport.count({ where }),
    ]);

    return { reports, total };
}

// Get a single shift report by ID
export async function getShiftReportById(id: string) {
    const session = await requireAuth();

    const report = await prisma.shiftReport.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, name: true, email: true } },
            shift: {
                select: {
                    id: true,
                    clockIn: true,
                    clockOut: true,
                    totalHours: true,
                    tasks: true,
                    quotes: {
                        select: {
                            id: true,
                            clientName: true,
                            serviceType: true,
                            status: true,
                            estimatedAmount: true,
                        },
                    },
                },
            },
            reviewedBy: { select: { id: true, name: true } },
        },
    });

    if (!report) {
        throw new Error("Report not found");
    }

    // Only allow access to own reports or if admin
    if (report.userId !== session.user.id && session.user.role === "DISPATCHER") {
        throw new Error("Access denied");
    }

    return report;
}

// Get dispatcher's own reports
export async function getMyShiftReports(limit: number = 20) {
    const session = await requireAuth();

    return await prisma.shiftReport.findMany({
        where: { userId: session.user.id },
        include: {
            shift: { select: { clockIn: true, clockOut: true, totalHours: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

// Review a shift report (ADMIN/SUPER_ADMIN only)
export async function reviewShiftReport(
    reportId: string,
    data: {
        performanceScore?: number;
        adminFeedback?: string;
        status?: "REVIEWED" | "FLAGGED";
    }
) {
    const session = await requireAdmin();

    const report = await prisma.shiftReport.update({
        where: { id: reportId },
        data: {
            performanceScore: data.performanceScore,
            adminFeedback: data.adminFeedback,
            status: data.status || "REVIEWED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
        },
    });

    await createAuditLog(
        session.user.id,
        "REVIEW",
        "ShiftReport",
        reportId,
        { performanceScore: data.performanceScore, status: data.status }
    );

    revalidatePath("/admin/reports");
    return report;
}

// Get dispatcher performance summary
export async function getDispatcherPerformance(
    userId: string,
    startDate?: Date,
    endDate?: Date
) {
    await requireAdmin();

    const where: Record<string, unknown> = { userId };

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            (where.createdAt as Record<string, Date>).gte = startDate;
        }
        if (endDate) {
            (where.createdAt as Record<string, Date>).lte = endDate;
        }
    }

    const reports = await prisma.shiftReport.findMany({
        where,
        include: {
            shift: { select: { clockIn: true, clockOut: true, totalHours: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    // Calculate aggregates
    const totalReports = reports.length;
    const totalCalls = reports.reduce((sum, r) => sum + r.callsReceived, 0);
    const totalEmails = reports.reduce((sum, r) => sum + r.emailsSent, 0);
    const totalQuotes = reports.reduce((sum, r) => sum + r.quotesGiven, 0);
    const totalReservations = reports.reduce((sum, r) => sum + r.totalReservationsHandled, 0);
    const totalComplaints = reports.reduce((sum, r) => sum + r.complaintsReceived, 0);
    const resolvedComplaints = reports.reduce((sum, r) => sum + r.complaintsResolved, 0);
    const totalEscalations = reports.reduce((sum, r) => sum + r.escalations, 0);
    const totalDriversDispatched = reports.reduce((sum, r) => sum + r.driversDispatched, 0);
    const totalNoShows = reports.reduce((sum, r) => sum + r.noShowsHandled, 0);
    const totalLatePickups = reports.reduce((sum, r) => sum + r.latePickups, 0);

    // Calculate averages
    const avgPerformanceScore = reports
        .filter(r => r.performanceScore !== null)
        .reduce((sum, r, _, arr) => sum + (r.performanceScore || 0) / arr.length, 0);

    const avgShiftRating = reports
        .filter(r => r.shiftRating !== null)
        .reduce((sum, r, _, arr) => sum + (r.shiftRating || 0) / arr.length, 0);

    // Calculate total hours worked
    const totalHours = reports.reduce((sum, r) => sum + (r.shift.totalHours || 0), 0);

    // Get flagged reports count
    const flaggedCount = reports.filter(r => r.status === "FLAGGED").length;
    const reviewedCount = reports.filter(r => r.status === "REVIEWED").length;

    return {
        totalReports,
        totalHours: Math.round(totalHours * 10) / 10,
        metrics: {
            calls: totalCalls,
            emails: totalEmails,
            quotes: totalQuotes,
            reservations: totalReservations,
            complaints: totalComplaints,
            resolvedComplaints,
            escalations: totalEscalations,
            driversDispatched: totalDriversDispatched,
            noShows: totalNoShows,
            latePickups: totalLatePickups,
        },
        averages: {
            callsPerShift: totalReports > 0 ? Math.round(totalCalls / totalReports) : 0,
            emailsPerShift: totalReports > 0 ? Math.round(totalEmails / totalReports) : 0,
            quotesPerShift: totalReports > 0 ? Math.round(totalQuotes / totalReports) : 0,
            performanceScore: Math.round(avgPerformanceScore),
            shiftRating: Math.round(avgShiftRating * 10) / 10,
        },
        statusCounts: {
            flagged: flaggedCount,
            reviewed: reviewedCount,
            pending: totalReports - flaggedCount - reviewedCount,
        },
        recentReports: reports.slice(0, 5),
    };
}

// Get team performance summary (all dispatchers)
export async function getTeamPerformance(startDate?: Date, endDate?: Date) {
    await requireAdmin();

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            (where.createdAt as Record<string, Date>).gte = startDate;
        }
        if (endDate) {
            (where.createdAt as Record<string, Date>).lte = endDate;
        }
    }

    // Get all dispatchers with their reports
    const dispatchers = await prisma.user.findMany({
        where: { role: "DISPATCHER", isActive: true },
        select: {
            id: true,
            name: true,
            email: true,
            shiftReports: {
                where,
                select: {
                    id: true,
                    callsReceived: true,
                    emailsSent: true,
                    quotesGiven: true,
                    totalReservationsHandled: true,
                    complaintsReceived: true,
                    complaintsResolved: true,
                    escalations: true,
                    driversDispatched: true,
                    performanceScore: true,
                    shiftRating: true,
                    status: true,
                    createdAt: true,
                    shift: { select: { totalHours: true } },
                },
            },
        },
    });

    // Calculate performance for each dispatcher
    const dispatcherStats = dispatchers.map(dispatcher => {
        const reports = dispatcher.shiftReports;
        const totalReports = reports.length;

        if (totalReports === 0) {
            return {
                id: dispatcher.id,
                name: dispatcher.name,
                email: dispatcher.email,
                totalReports: 0,
                totalHours: 0,
                avgPerformanceScore: 0,
                totalCalls: 0,
                totalEmails: 0,
                totalQuotes: 0,
                flaggedReports: 0,
            };
        }

        const totalCalls = reports.reduce((sum, r) => sum + r.callsReceived, 0);
        const totalEmails = reports.reduce((sum, r) => sum + r.emailsSent, 0);
        const totalQuotes = reports.reduce((sum, r) => sum + r.quotesGiven, 0);
        const totalHours = reports.reduce((sum, r) => sum + (r.shift.totalHours || 0), 0);
        const flaggedReports = reports.filter(r => r.status === "FLAGGED").length;

        const scoredReports = reports.filter(r => r.performanceScore !== null);
        const avgPerformanceScore = scoredReports.length > 0
            ? scoredReports.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / scoredReports.length
            : 0;

        return {
            id: dispatcher.id,
            name: dispatcher.name,
            email: dispatcher.email,
            totalReports,
            totalHours: Math.round(totalHours * 10) / 10,
            avgPerformanceScore: Math.round(avgPerformanceScore),
            totalCalls,
            totalEmails,
            totalQuotes,
            flaggedReports,
        };
    });

    // Sort by performance score (descending)
    dispatcherStats.sort((a, b) => b.avgPerformanceScore - a.avgPerformanceScore);

    // Calculate team totals
    const teamTotals = {
        totalReports: dispatcherStats.reduce((sum, d) => sum + d.totalReports, 0),
        totalHours: dispatcherStats.reduce((sum, d) => sum + d.totalHours, 0),
        totalCalls: dispatcherStats.reduce((sum, d) => sum + d.totalCalls, 0),
        totalEmails: dispatcherStats.reduce((sum, d) => sum + d.totalEmails, 0),
        totalQuotes: dispatcherStats.reduce((sum, d) => sum + d.totalQuotes, 0),
        avgPerformanceScore: dispatcherStats.length > 0
            ? Math.round(dispatcherStats.reduce((sum, d) => sum + d.avgPerformanceScore, 0) / dispatcherStats.length)
            : 0,
    };

    return {
        dispatchers: dispatcherStats,
        teamTotals,
    };
}

// Get report statistics for dashboard
export async function getReportStats() {
    await requireAdmin();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, thisWeek, thisMonth, pending, flagged] = await Promise.all([
        prisma.shiftReport.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.shiftReport.count({ where: { createdAt: { gte: startOfWeek } } }),
        prisma.shiftReport.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.shiftReport.count({ where: { status: "SUBMITTED" } }),
        prisma.shiftReport.count({ where: { status: "FLAGGED" } }),
    ]);

    return { today, thisWeek, thisMonth, pending, flagged };
}

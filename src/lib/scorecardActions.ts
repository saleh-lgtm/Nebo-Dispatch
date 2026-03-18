"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";
import { dateRangeSchema } from "./schemas";
import { getFrontEmailMetrics, getFrontTeamOverview } from "./frontActions";

// ============================================
// Types
// ============================================

export interface ConfirmationMetrics {
    totalHandled: number;
    onTimeCount: number;
    onTimeRate: number;
    avgMinutesBeforeDue: number;
    missedCount: number;
    accountabilityScore: number;
}

export interface CommunicationMetrics {
    smsSent: number;
    smsReceived: number;
    avgResponseTimeMinutes: number | null;
}

export interface ShiftMetrics {
    totalShifts: number;
    avgPunctualityMinutes: number;
    reportSubmissionRate: number;
    avgSelfRating: number | null;
}

export interface QuoteMetrics {
    totalCreated: number;
    won: number;
    lost: number;
    pending: number;
    conversionRate: number;
    totalEstimatedRevenue: number;
}

export interface EmailMetrics {
    emailsSent: number;
    emailsReceived: number;
    avgResponseTimeMinutes: number | null;
    inboxBreakdown: Record<string, number>;
}

export interface CategoryScores {
    confirmations: number | null;
    communications: number | null;
    email: number | null;
    punctuality: number | null;
    quotes: number | null;
    reportCompliance: number | null;
}

export interface DispatcherScorecard {
    userId: string;
    userName: string;
    userEmail: string | null;
    role: string;
    confirmationMetrics: ConfirmationMetrics;
    communicationMetrics: CommunicationMetrics;
    emailMetrics: EmailMetrics | null;
    shiftMetrics: ShiftMetrics;
    quoteMetrics: QuoteMetrics;
    categoryScores: CategoryScores;
    overallScore: number;
    letterGrade: string;
}

export interface RecentActivity {
    type: "confirmation" | "sms" | "shift" | "quote" | "report";
    description: string;
    timestamp: Date;
}

// ============================================
// Score Calculation Helpers
// ============================================

function calculateLetterGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function calculateCategoryScores(
    confirmationMetrics: ConfirmationMetrics,
    communicationMetrics: CommunicationMetrics,
    emailMetrics: EmailMetrics | null,
    shiftMetrics: ShiftMetrics,
    quoteMetrics: QuoteMetrics,
    teamAvgSms: number,
    teamAvgEmails: number
): CategoryScores {
    // Confirmations (25%): null if no data, else on-time rate × 100
    const confirmations = confirmationMetrics.totalHandled > 0
        ? Math.round(confirmationMetrics.onTimeRate * 100)
        : null;

    // Communications (15%): null if no SMS activity
    const totalSms = communicationMetrics.smsSent + communicationMetrics.smsReceived;
    const communications = totalSms > 0
        ? Math.round(clamp((totalSms / teamAvgSms) * 100, 0, 100))
        : null;

    // Email (15%): null if no Front mapping or no email activity
    let email: number | null = null;
    if (emailMetrics && emailMetrics.emailsSent > 0) {
        email = Math.round(
            teamAvgEmails > 0
                ? clamp((emailMetrics.emailsSent / teamAvgEmails) * 100, 0, 100)
                : 100
        );
    }

    // Punctuality (20%): null if no shifts
    const punctuality = shiftMetrics.totalShifts > 0
        ? Math.round(clamp(
            100 - (Math.max(0, -shiftMetrics.avgPunctualityMinutes) * 5),
            0,
            100
        ))
        : null;

    // Quotes (15%): null if no quotes
    const quotes = quoteMetrics.totalCreated > 0
        ? Math.round(quoteMetrics.conversionRate * 100)
        : null;

    // Report compliance (10%): null if no shifts, capped at 100
    const reportCompliance = shiftMetrics.totalShifts > 0
        ? Math.round(Math.min(shiftMetrics.reportSubmissionRate, 1) * 100)
        : null;

    return { confirmations, communications, email, punctuality, quotes, reportCompliance };
}

// Weights for each category — used for overall score
const CATEGORY_WEIGHTS: Record<keyof CategoryScores, number> = {
    confirmations: 0.25,
    communications: 0.15,
    email: 0.15,
    punctuality: 0.20,
    quotes: 0.15,
    reportCompliance: 0.10,
};

function calculateOverallScore(scores: CategoryScores): number {
    // Only include categories that have data (non-null).
    // Redistribute weight from N/A categories proportionally.
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, weight] of Object.entries(CATEGORY_WEIGHTS)) {
        const value = scores[key as keyof CategoryScores];
        if (value !== null) {
            totalWeight += weight;
            weightedSum += value * weight;
        }
    }

    if (totalWeight === 0) return 0;
    return Math.round(weightedSum / totalWeight);
}

// ============================================
// Individual Scorecard
// ============================================

export async function getDispatcherScorecard(
    userId: string,
    dateRange: { from: Date; to: Date }
): Promise<{ success: boolean; data?: DispatcherScorecard; error?: string }> {
    try {
        await requireAdmin();

        const parseResult = dateRangeSchema.safeParse({
            startDate: dateRange.from,
            endDate: dateRange.to,
        });
        if (!parseResult.success) {
            return { success: false, error: "Invalid date range" };
        }

        const { from, to } = dateRange;

        // Fetch user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                accountabilityScore: true,
            },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Run all queries in parallel
        const [
            confirmationsHandled,
            onTimeConfirmations,
            confirmationTimings,
            missedCount,
            shifts,
            shiftReports,
            quotes,
            smsLogs,
        ] = await Promise.all([
            // 1. Confirmations handled
            prisma.tripConfirmation.count({
                where: {
                    completedById: userId,
                    completedAt: { gte: from, lte: to },
                },
            }),

            // 2. On-time confirmations (minutesBeforeDue > 0)
            prisma.tripConfirmation.count({
                where: {
                    completedById: userId,
                    completedAt: { gte: from, lte: to },
                    minutesBeforeDue: { gt: 0 },
                },
            }),

            // 3. Average minutes before due
            prisma.tripConfirmation.aggregate({
                _avg: { minutesBeforeDue: true },
                where: {
                    completedById: userId,
                    completedAt: { gte: from, lte: to },
                    minutesBeforeDue: { not: null },
                },
            }),

            // 4. Missed confirmations
            prisma.missedConfirmationAccountability.count({
                where: {
                    dispatcherId: userId,
                    createdAt: { gte: from, lte: to },
                },
            }),

            // 5. Shifts in period (totalHours needed to filter stale shifts)
            prisma.shift.findMany({
                where: {
                    userId,
                    clockIn: { gte: from, lte: to },
                    clockOut: { not: null },
                },
                select: {
                    id: true,
                    clockIn: true,
                    clockOut: true,
                    earlyClockIn: true,
                    totalHours: true,
                },
            }),

            // 6. Shift reports in period
            prisma.shiftReport.findMany({
                where: {
                    userId,
                    createdAt: { gte: from, lte: to },
                    status: { in: ["SUBMITTED", "REVIEWED"] },
                },
                select: {
                    autoSmsSent: true,
                    autoSmsReceived: true,
                    shiftRating: true,
                },
            }),

            // 7. Quotes in period
            prisma.quote.findMany({
                where: {
                    createdById: userId,
                    createdAt: { gte: from, lte: to },
                },
                select: {
                    status: true,
                    outcome: true,
                    estimatedAmount: true,
                },
            }),

            // 8. SMS logs for response time calculation
            prisma.sMSLog.findMany({
                where: {
                    createdAt: { gte: from, lte: to },
                    OR: [
                        { sentById: userId, direction: "OUTBOUND" },
                        { direction: "INBOUND" },
                    ],
                },
                select: {
                    direction: true,
                    conversationPhone: true,
                    createdAt: true,
                    sentById: true,
                },
                orderBy: { createdAt: "asc" },
            }),
        ]);

        // --- Confirmation Metrics ---
        const confirmationMetrics: ConfirmationMetrics = {
            totalHandled: confirmationsHandled,
            onTimeCount: onTimeConfirmations,
            onTimeRate: confirmationsHandled > 0
                ? onTimeConfirmations / confirmationsHandled
                : 0,
            avgMinutesBeforeDue: confirmationTimings._avg.minutesBeforeDue ?? 0,
            missedCount: missedCount,
            accountabilityScore: user.accountabilityScore,
        };

        // --- Communication Metrics (from SMSLog directly) ---
        const totalSmsSent = smsLogs.filter(
            l => l.direction === "OUTBOUND" && l.sentById === userId
        ).length;
        const totalSmsReceived = smsLogs.filter(
            l => l.direction === "INBOUND"
        ).length;

        // Calculate avg SMS response time from SMSLog
        let totalResponseTime = 0;
        let responseCount = 0;

        // Group messages by conversation phone for response time
        const inboundByConversation = new Map<string, Date[]>();
        const outboundByConversation = new Map<string, Date[]>();

        for (const log of smsLogs) {
            if (!log.conversationPhone) continue;
            if (log.direction === "INBOUND") {
                const existing = inboundByConversation.get(log.conversationPhone) || [];
                existing.push(log.createdAt);
                inboundByConversation.set(log.conversationPhone, existing);
            } else if (log.direction === "OUTBOUND" && log.sentById === userId) {
                const existing = outboundByConversation.get(log.conversationPhone) || [];
                existing.push(log.createdAt);
                outboundByConversation.set(log.conversationPhone, existing);
            }
        }

        // For each inbound, find the next outbound to the same conversation
        for (const [phone, inbounds] of inboundByConversation) {
            const outbounds = outboundByConversation.get(phone) || [];
            for (const inboundTime of inbounds) {
                const nextOutbound = outbounds.find(t => t > inboundTime);
                if (nextOutbound) {
                    const diffMinutes = (nextOutbound.getTime() - inboundTime.getTime()) / (1000 * 60);
                    if (diffMinutes <= 120) { // Only count responses within 2 hours
                        totalResponseTime += diffMinutes;
                        responseCount++;
                    }
                }
            }
        }

        const communicationMetrics: CommunicationMetrics = {
            smsSent: totalSmsSent,
            smsReceived: totalSmsReceived,
            avgResponseTimeMinutes: responseCount > 0
                ? Math.round((totalResponseTime / responseCount) * 10) / 10
                : null,
        };

        // --- Shift Metrics ---
        // Filter out stale shifts (>24h duration — data errors from missed clock-outs)
        const MAX_SHIFT_HOURS = 24;
        const validShifts = shifts.filter(s => {
            const hours = s.totalHours ?? (
                (s.clockOut!.getTime() - s.clockIn.getTime()) / (1000 * 60 * 60)
            );
            return hours <= MAX_SHIFT_HOURS;
        });
        const completedShiftCount = validShifts.length;
        const earlyClockInValues = validShifts
            .filter(s => s.earlyClockIn !== null)
            .map(s => s.earlyClockIn!);
        const avgPunctuality = earlyClockInValues.length > 0
            ? earlyClockInValues.reduce((sum, v) => sum + v, 0) / earlyClockInValues.length
            : 0;
        const reportCount = shiftReports.length;
        const ratings = shiftReports
            .filter(r => r.shiftRating !== null)
            .map(r => r.shiftRating!);
        const avgRating = ratings.length > 0
            ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
            : null;

        const shiftMetrics: ShiftMetrics = {
            totalShifts: completedShiftCount,
            avgPunctualityMinutes: Math.round(avgPunctuality),
            reportSubmissionRate: completedShiftCount > 0
                ? Math.min(reportCount / completedShiftCount, 1) // Cap at 100%
                : 0,
            avgSelfRating: avgRating,
        };

        // --- Quote Metrics ---
        const wonQuotes = quotes.filter(q => q.outcome === "WON");
        const lostQuotes = quotes.filter(q => q.outcome === "LOST" || q.status === "LOST");
        const pendingQuotes = quotes.filter(q =>
            q.outcome === null && q.status !== "LOST" && q.status !== "EXPIRED"
        );
        const totalRevenue = wonQuotes.reduce(
            (sum, q) => sum + (q.estimatedAmount ?? 0), 0
        );

        const quoteMetrics: QuoteMetrics = {
            totalCreated: quotes.length,
            won: wonQuotes.length,
            lost: lostQuotes.length,
            pending: pendingQuotes.length,
            conversionRate: quotes.length > 0
                ? wonQuotes.length / quotes.length
                : 0,
            totalEstimatedRevenue: Math.round(totalRevenue * 100) / 100,
        };

        // --- Email Metrics (from Front) ---
        let emailMetrics: EmailMetrics | null = null;
        try {
            const emailResult = await getFrontEmailMetrics(userId, from, to);
            if (emailResult.success && emailResult.data) {
                emailMetrics = emailResult.data;
            }
        } catch {
            // Front API unavailable — email metrics will be null
        }

        // --- Category Scores ---
        // For individual scorecard, use their own SMS as reference (team avg computed in team view)
        const teamAvgSms = totalSmsSent + totalSmsReceived; // Self-reference for individual
        const teamAvgEmails = emailMetrics?.emailsSent ?? 0; // Self-reference for individual
        const categoryScores = calculateCategoryScores(
            confirmationMetrics,
            communicationMetrics,
            emailMetrics,
            shiftMetrics,
            quoteMetrics,
            teamAvgSms > 0 ? teamAvgSms : 1,
            teamAvgEmails > 0 ? teamAvgEmails : 1
        );

        const overallScore = calculateOverallScore(categoryScores);

        return {
            success: true,
            data: {
                userId: user.id,
                userName: user.name ?? "Unknown",
                userEmail: user.email,
                role: user.role,
                confirmationMetrics,
                communicationMetrics,
                emailMetrics,
                shiftMetrics,
                quoteMetrics,
                categoryScores,
                overallScore,
                letterGrade: calculateLetterGrade(overallScore),
            },
        };
    } catch (error) {
        console.error("getDispatcherScorecard error:", error);
        return { success: false, error: "Failed to get dispatcher scorecard" };
    }
}

// ============================================
// Team Scorecard
// ============================================

export async function getTeamScorecard(
    dateRange: { from: Date; to: Date }
): Promise<{ success: boolean; data?: DispatcherScorecard[]; error?: string }> {
    try {
        await requireAdmin();

        const parseResult = dateRangeSchema.safeParse({
            startDate: dateRange.from,
            endDate: dateRange.to,
        });
        if (!parseResult.success) {
            return { success: false, error: "Invalid date range" };
        }

        const { from, to } = dateRange;

        // Get all active dispatchers and admins
        const dispatchers = await prisma.user.findMany({
            where: {
                role: { in: ["DISPATCHER", "ADMIN"] },
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                accountabilityScore: true,
            },
        });

        if (dispatchers.length === 0) {
            return { success: true, data: [] };
        }

        const dispatcherIds = dispatchers.map(d => d.id);

        // Batch queries for all dispatchers
        const [
            confirmationsByUser,
            onTimeByUser,
            missedByUser,
            allShifts,
            allReports,
            allQuotes,
            smsOutboundByUser,
            smsInboundByUser,
        ] = await Promise.all([
            // Confirmations per user
            prisma.tripConfirmation.groupBy({
                by: ["completedById"],
                _count: { id: true },
                where: {
                    completedById: { in: dispatcherIds },
                    completedAt: { gte: from, lte: to },
                },
            }),

            // On-time confirmations per user
            prisma.tripConfirmation.groupBy({
                by: ["completedById"],
                _count: { id: true },
                where: {
                    completedById: { in: dispatcherIds },
                    completedAt: { gte: from, lte: to },
                    minutesBeforeDue: { gt: 0 },
                },
            }),

            // Missed confirmations per user
            prisma.missedConfirmationAccountability.groupBy({
                by: ["dispatcherId"],
                _count: { id: true },
                where: {
                    dispatcherId: { in: dispatcherIds },
                    createdAt: { gte: from, lte: to },
                },
            }),

            // All shifts (include totalHours/clockIn/clockOut for stale shift filtering)
            prisma.shift.findMany({
                where: {
                    userId: { in: dispatcherIds },
                    clockIn: { gte: from, lte: to },
                    clockOut: { not: null },
                },
                select: {
                    userId: true,
                    clockIn: true,
                    clockOut: true,
                    totalHours: true,
                    earlyClockIn: true,
                },
            }),

            // All reports
            prisma.shiftReport.findMany({
                where: {
                    userId: { in: dispatcherIds },
                    createdAt: { gte: from, lte: to },
                    status: { in: ["SUBMITTED", "REVIEWED"] },
                },
                select: {
                    userId: true,
                    autoSmsSent: true,
                    autoSmsReceived: true,
                    shiftRating: true,
                },
            }),

            // All quotes
            prisma.quote.findMany({
                where: {
                    createdById: { in: dispatcherIds },
                    createdAt: { gte: from, lte: to },
                },
                select: {
                    createdById: true,
                    status: true,
                    outcome: true,
                    estimatedAmount: true,
                },
            }),

            // SMS outbound counts from SMSLog (accurate, not ShiftReport auto fields)
            prisma.sMSLog.groupBy({
                by: ["sentById"],
                _count: { id: true },
                where: {
                    sentById: { in: dispatcherIds },
                    direction: "OUTBOUND",
                    createdAt: { gte: from, lte: to },
                },
            }),

            // SMS inbound counts — attribute to all dispatchers proportionally
            // (inbound is not per-user, so we count total for team avg)
            prisma.sMSLog.groupBy({
                by: ["sentById"],
                _count: { id: true },
                where: {
                    direction: "INBOUND",
                    createdAt: { gte: from, lte: to },
                },
            }),
        ]);

        // Build lookup maps
        const confirmationsMap = new Map(
            confirmationsByUser.map(c => [c.completedById!, c._count.id])
        );
        const onTimeMap = new Map(
            onTimeByUser.map(c => [c.completedById!, c._count.id])
        );
        const missedMap = new Map(
            missedByUser.map(c => [c.dispatcherId, c._count.id])
        );

        // SMS lookup maps (from SMSLog directly)
        const smsOutboundMap = new Map(
            smsOutboundByUser
                .filter(s => s.sentById !== null)
                .map(s => [s.sentById!, s._count.id])
        );
        // Inbound is team-wide — count total and distribute evenly
        const totalInbound = smsInboundByUser.reduce((sum, s) => sum + s._count.id, 0);
        const smsInboundMap = new Map<string, number>();
        // Each dispatcher gets the total inbound count (it's team-wide, not per-user)
        for (const d of dispatchers) {
            smsInboundMap.set(d.id, totalInbound);
        }

        // Group shifts by user, filtering out stale shifts (>24h)
        const MAX_SHIFT_HOURS = 24;
        const shiftsByUser = new Map<string, typeof allShifts>();
        for (const shift of allShifts) {
            const hours = shift.totalHours ?? (
                (shift.clockOut!.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60)
            );
            if (hours > MAX_SHIFT_HOURS) continue; // Skip data errors
            const arr = shiftsByUser.get(shift.userId) || [];
            arr.push(shift);
            shiftsByUser.set(shift.userId, arr);
        }

        // Group reports by user
        const reportsByUser = new Map<string, typeof allReports>();
        for (const report of allReports) {
            const arr = reportsByUser.get(report.userId) || [];
            arr.push(report);
            reportsByUser.set(report.userId, arr);
        }

        // Group quotes by user
        const quotesByUser = new Map<string, typeof allQuotes>();
        for (const quote of allQuotes) {
            const arr = quotesByUser.get(quote.createdById) || [];
            arr.push(quote);
            quotesByUser.set(quote.createdById, arr);
        }

        // Calculate team average SMS for communications scoring (from SMSLog)
        let totalTeamSms = 0;
        let activeDispatchers = 0;
        for (const dispatcher of dispatchers) {
            const sent = smsOutboundMap.get(dispatcher.id) || 0;
            const received = smsInboundMap.get(dispatcher.id) || 0;
            const sms = sent + received;
            if (sms > 0) {
                totalTeamSms += sms;
                activeDispatchers++;
            }
        }
        const teamAvgSms = activeDispatchers > 0 ? totalTeamSms / activeDispatchers : 1;

        // Fetch Front email metrics for all teammates
        const frontTeamData: Map<string, { emailsSent: number; avgResponseTimeMinutes: number | null }> = new Map();
        try {
            const frontResult = await getFrontTeamOverview(from, to);
            if (frontResult.success && frontResult.data) {
                for (const member of frontResult.data) {
                    frontTeamData.set(member.userId, {
                        emailsSent: member.emailsSent,
                        avgResponseTimeMinutes: member.avgResponseTimeMinutes,
                    });
                }
            }
        } catch {
            // Front API unavailable — skip email metrics
        }

        // Calculate team average emails
        let totalTeamEmails = 0;
        let emailActiveCount = 0;
        for (const fd of frontTeamData.values()) {
            if (fd.emailsSent > 0) {
                totalTeamEmails += fd.emailsSent;
                emailActiveCount++;
            }
        }
        const teamAvgEmails = emailActiveCount > 0 ? totalTeamEmails / emailActiveCount : 1;

        // Build scorecards
        const scorecards: DispatcherScorecard[] = dispatchers.map(dispatcher => {
            const totalHandled = confirmationsMap.get(dispatcher.id) || 0;
            const onTimeCount = onTimeMap.get(dispatcher.id) || 0;
            const missedCount = missedMap.get(dispatcher.id) || 0;
            const userShifts = shiftsByUser.get(dispatcher.id) || [];
            const userReports = reportsByUser.get(dispatcher.id) || [];
            const userQuotes = quotesByUser.get(dispatcher.id) || [];

            // Confirmation metrics
            const confirmationMetrics: ConfirmationMetrics = {
                totalHandled,
                onTimeCount,
                onTimeRate: totalHandled > 0 ? onTimeCount / totalHandled : 0,
                avgMinutesBeforeDue: 0, // Skip aggregate for team view (expensive)
                missedCount,
                accountabilityScore: dispatcher.accountabilityScore,
            };

            // Communication metrics (from SMSLog counts for accuracy)
            const smsSent = smsOutboundMap.get(dispatcher.id) || 0;
            const smsReceived = smsInboundMap.get(dispatcher.id) || 0;
            const communicationMetrics: CommunicationMetrics = {
                smsSent,
                smsReceived,
                avgResponseTimeMinutes: null, // Skip for team view (expensive per-user query)
            };

            // Shift metrics
            const earlyClockInValues = userShifts
                .filter(s => s.earlyClockIn !== null)
                .map(s => s.earlyClockIn!);
            const avgPunctuality = earlyClockInValues.length > 0
                ? earlyClockInValues.reduce((sum, v) => sum + v, 0) / earlyClockInValues.length
                : 0;
            const ratings = userReports
                .filter(r => r.shiftRating !== null)
                .map(r => r.shiftRating!);

            const shiftMetrics: ShiftMetrics = {
                totalShifts: userShifts.length,
                avgPunctualityMinutes: Math.round(avgPunctuality),
                reportSubmissionRate: userShifts.length > 0
                    ? Math.min(userReports.length / userShifts.length, 1) // Cap at 100%
                    : 0,
                avgSelfRating: ratings.length > 0
                    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
                    : null,
            };

            // Quote metrics
            const wonQuotes = userQuotes.filter(q => q.outcome === "WON");
            const lostQuotes = userQuotes.filter(q => q.outcome === "LOST" || q.status === "LOST");
            const pendingQuotes = userQuotes.filter(q =>
                q.outcome === null && q.status !== "LOST" && q.status !== "EXPIRED"
            );

            const quoteMetrics: QuoteMetrics = {
                totalCreated: userQuotes.length,
                won: wonQuotes.length,
                lost: lostQuotes.length,
                pending: pendingQuotes.length,
                conversionRate: userQuotes.length > 0
                    ? wonQuotes.length / userQuotes.length
                    : 0,
                totalEstimatedRevenue: wonQuotes.reduce(
                    (sum, q) => sum + (q.estimatedAmount ?? 0), 0
                ),
            };

            // Email metrics from Front
            const frontData = frontTeamData.get(dispatcher.id);
            const emailMetrics: EmailMetrics | null = frontData
                ? {
                      emailsSent: frontData.emailsSent,
                      emailsReceived: 0, // Not tracked per-user in team view
                      avgResponseTimeMinutes: frontData.avgResponseTimeMinutes,
                      inboxBreakdown: {},
                  }
                : null;

            // Category scores
            const categoryScores = calculateCategoryScores(
                confirmationMetrics,
                communicationMetrics,
                emailMetrics,
                shiftMetrics,
                quoteMetrics,
                teamAvgSms,
                teamAvgEmails
            );

            const overallScore = calculateOverallScore(categoryScores);

            return {
                userId: dispatcher.id,
                userName: dispatcher.name ?? "Unknown",
                userEmail: dispatcher.email,
                role: dispatcher.role,
                confirmationMetrics,
                communicationMetrics,
                emailMetrics,
                shiftMetrics,
                quoteMetrics,
                categoryScores,
                overallScore,
                letterGrade: calculateLetterGrade(overallScore),
            };
        });

        // Sort by overall score descending
        scorecards.sort((a, b) => b.overallScore - a.overallScore);

        return { success: true, data: scorecards };
    } catch (error) {
        console.error("getTeamScorecard error:", error);
        return { success: false, error: "Failed to get team scorecard" };
    }
}

// ============================================
// Recent Activity for Detail View
// ============================================

export async function getDispatcherRecentActivity(
    userId: string,
    limit: number = 20
): Promise<{ success: boolean; data?: RecentActivity[]; error?: string }> {
    try {
        await requireAdmin();

        const safeLimit = Math.min(Math.max(limit, 1), 50);

        // Fetch recent actions across all categories in parallel
        const [recentConfirmations, recentShifts, recentReports, recentQuotes, recentSms] =
            await Promise.all([
                prisma.tripConfirmation.findMany({
                    where: { completedById: userId, completedAt: { not: null } },
                    orderBy: { completedAt: "desc" },
                    take: safeLimit,
                    select: {
                        tripNumber: true,
                        passengerName: true,
                        status: true,
                        completedAt: true,
                        minutesBeforeDue: true,
                    },
                }),

                prisma.shift.findMany({
                    where: { userId, clockOut: { not: null } },
                    orderBy: { clockIn: "desc" },
                    take: safeLimit,
                    select: {
                        clockIn: true,
                        clockOut: true,
                        earlyClockIn: true,
                        totalHours: true,
                    },
                }),

                prisma.shiftReport.findMany({
                    where: { userId, status: { in: ["SUBMITTED", "REVIEWED"] } },
                    orderBy: { createdAt: "desc" },
                    take: safeLimit,
                    select: {
                        createdAt: true,
                        shiftRating: true,
                        status: true,
                    },
                }),

                prisma.quote.findMany({
                    where: { createdById: userId },
                    orderBy: { createdAt: "desc" },
                    take: safeLimit,
                    select: {
                        clientName: true,
                        status: true,
                        outcome: true,
                        estimatedAmount: true,
                        createdAt: true,
                    },
                }),

                prisma.sMSLog.findMany({
                    where: { sentById: userId, direction: "OUTBOUND" },
                    orderBy: { createdAt: "desc" },
                    take: safeLimit,
                    select: {
                        to: true,
                        createdAt: true,
                    },
                }),
            ]);

        const activities: RecentActivity[] = [];

        for (const c of recentConfirmations) {
            const timing = c.minutesBeforeDue && c.minutesBeforeDue > 0
                ? `${c.minutesBeforeDue}min early`
                : "late";
            activities.push({
                type: "confirmation",
                description: `Confirmed trip #${c.tripNumber} for ${c.passengerName} (${timing})`,
                timestamp: c.completedAt!,
            });
        }

        for (const s of recentShifts) {
            const hours = s.totalHours ? `${s.totalHours.toFixed(1)}h` : "ongoing";
            const punctuality = s.earlyClockIn !== null
                ? s.earlyClockIn > 0
                    ? `${s.earlyClockIn}min early`
                    : `${Math.abs(s.earlyClockIn)}min late`
                : "";
            activities.push({
                type: "shift",
                description: `Shift completed (${hours})${punctuality ? ` — clocked in ${punctuality}` : ""}`,
                timestamp: s.clockOut ?? s.clockIn,
            });
        }

        for (const r of recentReports) {
            const rating = r.shiftRating ? ` — self-rated ${r.shiftRating}/5` : "";
            activities.push({
                type: "report",
                description: `Shift report ${r.status.toLowerCase()}${rating}`,
                timestamp: r.createdAt,
            });
        }

        for (const q of recentQuotes) {
            const amount = q.estimatedAmount ? ` ($${q.estimatedAmount.toFixed(0)})` : "";
            const status = q.outcome ?? q.status;
            activities.push({
                type: "quote",
                description: `Quote for ${q.clientName}${amount} — ${status.toLowerCase()}`,
                timestamp: q.createdAt,
            });
        }

        for (const sms of recentSms) {
            activities.push({
                type: "sms",
                description: `SMS sent to ${sms.to}`,
                timestamp: sms.createdAt,
            });
        }

        // Sort by timestamp desc and take limit
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return { success: true, data: activities.slice(0, safeLimit) };
    } catch (error) {
        console.error("getDispatcherRecentActivity error:", error);
        return { success: false, error: "Failed to get recent activity" };
    }
}

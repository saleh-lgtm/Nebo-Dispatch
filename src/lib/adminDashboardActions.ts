"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "./prisma";
import { DispatcherFeature, PermissionLevel } from "@prisma/client";

// ============================================
// Admin Dashboard Stats
// ============================================

export interface AdminDashboardStats {
    users: {
        total: number;
        active: number;
        pendingApproval: number;
        dispatchers: number;
    };
    confirmations: {
        pending: number;
        overdue: number;
        completedToday: number;
    };
    quotes: {
        pendingToday: number;
        convertedToday: number;
    };
    shifts: {
        activeNow: number;
        reportsToReview: number;
        flaggedReports: number;
    };
    requests: {
        pendingTimeOff: number;
        pendingSwaps: number;
    };
    contacts: {
        pendingApproval: number;
    };
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [
        userStats,
        confirmationStats,
        quoteStats,
        shiftStats,
        requestStats,
        contactStats,
    ] = await Promise.all([
        // User stats
        prisma.user.aggregate({
            _count: { id: true },
            where: { role: { not: "SUPER_ADMIN" } },
        }).then(async (total) => ({
            total: total._count.id,
            active: await prisma.user.count({ where: { isActive: true, role: { not: "SUPER_ADMIN" } } }),
            pendingApproval: await prisma.user.count({ where: { approvalStatus: "PENDING" } }),
            dispatchers: await prisma.user.count({ where: { role: "DISPATCHER", isActive: true } }),
        })),

        // Confirmation stats
        Promise.all([
            prisma.tripConfirmation.count({ where: { status: "PENDING" } }),
            prisma.tripConfirmation.count({
                where: {
                    status: "PENDING",
                    dueAt: { lt: now },
                },
            }),
            prisma.tripConfirmation.count({
                where: {
                    status: "CONFIRMED",
                    completedAt: { gte: startOfDay, lte: endOfDay },
                },
            }),
        ]).then(([pending, overdue, completedToday]) => ({
            pending,
            overdue,
            completedToday,
        })),

        // Quote stats
        Promise.all([
            prisma.quote.count({
                where: {
                    status: "PENDING",
                    createdAt: { gte: startOfDay },
                },
            }),
            prisma.quote.count({
                where: {
                    status: "CONVERTED",
                    updatedAt: { gte: startOfDay, lte: endOfDay },
                },
            }),
        ]).then(([pendingToday, convertedToday]) => ({
            pendingToday,
            convertedToday,
        })),

        // Shift stats
        Promise.all([
            prisma.shift.count({
                where: {
                    clockOut: null,
                    clockIn: { not: null },
                },
            }),
            prisma.shiftReport.count({ where: { status: "SUBMITTED" } }),
            prisma.shiftReport.count({ where: { status: "FLAGGED" } }),
        ]).then(([activeNow, reportsToReview, flaggedReports]) => ({
            activeNow,
            reportsToReview,
            flaggedReports,
        })),

        // Request stats
        Promise.all([
            prisma.timeOffRequest.count({ where: { status: "PENDING" } }),
            prisma.shiftSwapRequest.count({
                where: {
                    status: { in: ["PENDING_TARGET", "PENDING_ADMIN"] },
                },
            }),
        ]).then(([pendingTimeOff, pendingSwaps]) => ({
            pendingTimeOff,
            pendingSwaps,
        })),

        // Contact stats
        prisma.contact.count({ where: { approvalStatus: "PENDING" } }).then((pendingApproval) => ({
            pendingApproval,
        })),
    ]);

    return {
        users: userStats,
        confirmations: confirmationStats,
        quotes: quoteStats,
        shifts: shiftStats,
        requests: requestStats,
        contacts: contactStats,
    };
}

// ============================================
// Dispatcher Feature Access
// ============================================

export interface DispatcherPermission {
    userId: string;
    userName: string;
    feature: DispatcherFeature;
    permission: PermissionLevel;
}

export interface DispatcherAccessConfig {
    userId: string;
    userName: string;
    email: string | null;
    permissions: Record<DispatcherFeature, PermissionLevel>;
    taskConfig: {
        primaryTask: string | null;
        secondaryTask: string | null;
        notes: string | null;
    } | null;
}

export async function getDispatcherAccessList(): Promise<DispatcherAccessConfig[]> {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const dispatchers = await prisma.user.findMany({
        where: {
            role: "DISPATCHER",
            isActive: true,
        },
        include: {
            featureAccessGrants: true,
            taskConfig: true,
        },
        orderBy: { name: "asc" },
    });

    // Default permissions for features
    const defaultPermissions: Record<DispatcherFeature, PermissionLevel> = {
        QUOTES: "EDIT",
        CONTACTS: "READ",
        SMS: "EDIT",
        FLEET: "READ",
        SCHEDULER: "READ",
        REPORTS: "EDIT",
        DIRECTORY: "READ",
        CONFIRMATIONS: "EDIT",
        TBR_TRIPS: "READ",
        NOTES: "EDIT",
        TASKS: "READ",
        ANALYTICS: "NONE",
    };

    return dispatchers.map((dispatcher) => {
        // Build permission map from grants, falling back to defaults
        const permissions = { ...defaultPermissions };
        dispatcher.featureAccessGrants.forEach((grant) => {
            permissions[grant.feature] = grant.permission;
        });

        return {
            userId: dispatcher.id,
            userName: dispatcher.name || "Unnamed",
            email: dispatcher.email,
            permissions,
            taskConfig: dispatcher.taskConfig
                ? {
                      primaryTask: dispatcher.taskConfig.primaryTask,
                      secondaryTask: dispatcher.taskConfig.secondaryTask,
                      notes: dispatcher.taskConfig.notes,
                  }
                : null,
        };
    });
}

export async function updateDispatcherFeatureAccess(
    userId: string,
    feature: DispatcherFeature,
    permission: PermissionLevel
): Promise<void> {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    // Verify target is a dispatcher
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "DISPATCHER") {
        throw new Error("User not found or not a dispatcher");
    }

    await prisma.dispatcherFeatureAccess.upsert({
        where: {
            userId_feature: { userId, feature },
        },
        create: {
            userId,
            feature,
            permission,
            grantedById: session.user.id,
        },
        update: {
            permission,
            grantedById: session.user.id,
        },
    });
}

export async function updateDispatcherTaskConfig(
    userId: string,
    data: {
        primaryTask: string | null;
        secondaryTask: string | null;
        notes?: string | null;
    }
): Promise<void> {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    // Verify target is a dispatcher
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "DISPATCHER") {
        throw new Error("User not found or not a dispatcher");
    }

    await prisma.dispatcherTaskConfig.upsert({
        where: { userId },
        create: {
            userId,
            primaryTask: data.primaryTask,
            secondaryTask: data.secondaryTask,
            notes: data.notes || null,
            configuredById: session.user.id,
        },
        update: {
            primaryTask: data.primaryTask,
            secondaryTask: data.secondaryTask,
            notes: data.notes,
        },
    });
}

// ============================================
// Dispatcher Analytics
// ============================================

export interface DispatcherAnalytics {
    userId: string;
    userName: string;
    primaryTask: string | null;
    secondaryTask: string | null;
    stats: {
        shiftsThisMonth: number;
        hoursThisMonth: number;
        quotesCreated: number;
        quotesConverted: number;
        confirmationsCompleted: number;
        reportsSubmitted: number;
        flaggedReports: number;
    };
}

export async function getDispatcherAnalytics(): Promise<DispatcherAnalytics[]> {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const dispatchers = await prisma.user.findMany({
        where: {
            role: "DISPATCHER",
            isActive: true,
        },
        include: {
            taskConfig: true,
            shifts: {
                where: {
                    clockIn: { gte: startOfMonth },
                },
                select: {
                    clockIn: true,
                    clockOut: true,
                },
            },
            quotesCreated: {
                where: {
                    createdAt: { gte: startOfMonth },
                },
                select: { status: true },
            },
            confirmationsCompleted: {
                where: {
                    completedAt: { gte: startOfMonth },
                },
                select: { id: true },
            },
            shiftReports: {
                where: {
                    createdAt: { gte: startOfMonth },
                },
                select: { status: true },
            },
        },
        orderBy: { name: "asc" },
    });

    return dispatchers.map((dispatcher) => {
        // Calculate hours
        const totalMinutes = dispatcher.shifts.reduce((acc, shift) => {
            if (shift.clockIn && shift.clockOut) {
                return acc + (shift.clockOut.getTime() - shift.clockIn.getTime()) / 60000;
            }
            return acc;
        }, 0);

        return {
            userId: dispatcher.id,
            userName: dispatcher.name || "Unnamed",
            primaryTask: dispatcher.taskConfig?.primaryTask || null,
            secondaryTask: dispatcher.taskConfig?.secondaryTask || null,
            stats: {
                shiftsThisMonth: dispatcher.shifts.length,
                hoursThisMonth: Math.round(totalMinutes / 60 * 10) / 10,
                quotesCreated: dispatcher.quotesCreated.length,
                quotesConverted: dispatcher.quotesCreated.filter((q) => q.status === "CONVERTED").length,
                confirmationsCompleted: dispatcher.confirmationsCompleted.length,
                reportsSubmitted: dispatcher.shiftReports.length,
                flaggedReports: dispatcher.shiftReports.filter((r) => r.status === "FLAGGED").length,
            },
        };
    });
}

// ============================================
// Quick Actions
// ============================================

export async function getRecentActivity(limit: number = 10) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const [recentLogins, recentReports, recentQuotes] = await Promise.all([
        // Recent logins
        prisma.user.findMany({
            where: {
                lastLogin: { not: null },
                role: { not: "SUPER_ADMIN" },
            },
            select: {
                id: true,
                name: true,
                lastLogin: true,
            },
            orderBy: { lastLogin: "desc" },
            take: limit,
        }),

        // Recent shift reports
        prisma.shiftReport.findMany({
            where: {
                status: { in: ["SUBMITTED", "FLAGGED"] },
            },
            select: {
                id: true,
                user: { select: { name: true } },
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        }),

        // Recent quotes
        prisma.quote.findMany({
            select: {
                id: true,
                clientName: true,
                status: true,
                createdAt: true,
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        }),
    ]);

    return {
        recentLogins,
        recentReports,
        recentQuotes,
    };
}

// ============================================
// Feature list for UI
// ============================================

export const DISPATCHER_FEATURES: { key: DispatcherFeature; label: string; description: string }[] = [
    { key: "QUOTES", label: "Quotes", description: "Create and manage customer quotes" },
    { key: "CONTACTS", label: "Contacts", description: "View and manage contact directory" },
    { key: "SMS", label: "SMS", description: "Send SMS messages to clients" },
    { key: "FLEET", label: "Fleet", description: "View fleet vehicle information" },
    { key: "SCHEDULER", label: "Scheduler", description: "View work schedules" },
    { key: "REPORTS", label: "Reports", description: "Submit shift reports" },
    { key: "DIRECTORY", label: "Directory", description: "View company directory" },
    { key: "CONFIRMATIONS", label: "Confirmations", description: "Handle trip confirmations" },
    { key: "TBR_TRIPS", label: "TBR Trips", description: "View TBR Global trips" },
    { key: "NOTES", label: "Notes", description: "View and create global notes" },
    { key: "TASKS", label: "Tasks", description: "View assigned tasks" },
    { key: "ANALYTICS", label: "Analytics", description: "View performance analytics" },
];

// Common task presets for dispatcher assignments
export const TASK_PRESETS = [
    "TBR Trip Management",
    "Retail Quote Handling",
    "Trip Confirmations",
    "Client Communications",
    "Fleet Coordination",
    "Affiliate Dispatch",
    "Airport Runs",
    "Event Coordination",
    "VIP Client Services",
    "After-Hours Support",
];

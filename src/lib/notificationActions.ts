"use server";

import prisma from "./prisma";
import { requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { createNotificationSchema } from "./schemas";
import { z } from "zod";

const idSchema = z.string().min(1, "ID is required");

// ============================================
// CREATE NOTIFICATIONS
// ============================================

interface CreateNotificationData {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
}

export async function createNotification(data: CreateNotificationData) {
    try {
        const parseResult = createNotificationSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: "Invalid notification data" };
        }

        const notification = await prisma.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
                title: data.title,
                message: data.message,
                entityType: data.entityType,
                entityId: data.entityId,
                actionUrl: data.actionUrl,
            },
        });

        return { success: true, data: notification };
    } catch (error) {
        console.error("createNotification error:", error);
        return { success: false, error: "Failed to create notification" };
    }
}

// Create notification for multiple users
export async function createNotificationsForUsers(
    userIds: string[],
    data: Omit<CreateNotificationData, "userId">
) {
    try {
        if (!userIds.length) {
            return { success: true, data: { count: 0 } };
        }

        const result = await prisma.notification.createMany({
            data: userIds.map((userId) => ({
                userId,
                type: data.type,
                title: data.title,
                message: data.message,
                entityType: data.entityType,
                entityId: data.entityId,
                actionUrl: data.actionUrl,
            })),
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("createNotificationsForUsers error:", error);
        return { success: false, error: "Failed to create notifications" };
    }
}

// ============================================
// GET NOTIFICATIONS
// ============================================

export async function getMyNotifications(options?: {
    unreadOnly?: boolean;
    limit?: number;
}) {
    try {
        const session = await requireAuth();

        const notifications = await prisma.notification.findMany({
            where: {
                userId: session.user.id,
                ...(options?.unreadOnly ? { isRead: false } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: options?.limit || 50,
        });

        return { success: true, data: notifications };
    } catch (error) {
        console.error("getMyNotifications error:", error);
        return { success: false, error: "Failed to get notifications", data: [] };
    }
}

export async function getUnreadNotificationCount() {
    try {
        const session = await requireAuth();

        const count = await prisma.notification.count({
            where: {
                userId: session.user.id,
                isRead: false,
            },
        });

        return { success: true, data: count };
    } catch (error) {
        console.error("getUnreadNotificationCount error:", error);
        return { success: false, error: "Failed to get count", data: 0 };
    }
}

// ============================================
// UPDATE NOTIFICATIONS
// ============================================

export async function markNotificationAsRead(notificationId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(notificationId);
        if (!idResult.success) {
            return { success: false, error: "Invalid notification ID" };
        }

        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification || notification.userId !== session.user.id) {
            return { success: false, error: "Notification not found" };
        }

        const updated = await prisma.notification.update({
            where: { id: notificationId },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        revalidatePath("/dashboard");
        return { success: true, data: updated };
    } catch (error) {
        console.error("markNotificationAsRead error:", error);
        return { success: false, error: "Failed to mark notification as read" };
    }
}

export async function markAllNotificationsAsRead() {
    try {
        const session = await requireAuth();

        await prisma.notification.updateMany({
            where: {
                userId: session.user.id,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("markAllNotificationsAsRead error:", error);
        return { success: false, error: "Failed to mark notifications as read" };
    }
}

export async function deleteNotification(notificationId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(notificationId);
        if (!idResult.success) {
            return { success: false, error: "Invalid notification ID" };
        }

        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification || notification.userId !== session.user.id) {
            return { success: false, error: "Notification not found" };
        }

        await prisma.notification.delete({
            where: { id: notificationId },
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("deleteNotification error:", error);
        return { success: false, error: "Failed to delete notification" };
    }
}

export async function deleteAllReadNotifications() {
    try {
        const session = await requireAuth();

        await prisma.notification.deleteMany({
            where: {
                userId: session.user.id,
                isRead: true,
            },
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("deleteAllReadNotifications error:", error);
        return { success: false, error: "Failed to delete notifications" };
    }
}

// ============================================
// NOTIFICATION HELPERS
// ============================================

// Helper function to get user names for notification messages
async function getUserName(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });
    return user?.name || "Someone";
}

// Shift Swap Notifications
export async function notifyShiftSwapRequest(
    targetUserId: string,
    requesterId: string,
    swapRequestId: string
) {
    try {
        const requesterName = await getUserName(requesterId);

        return createNotification({
            userId: targetUserId,
            type: "SHIFT_SWAP_REQUEST",
            title: "Shift Swap Request",
            message: `${requesterName} wants to swap shifts with you.`,
            entityType: "ShiftSwapRequest",
            entityId: swapRequestId,
            actionUrl: "/dashboard",
        });
    } catch (error) {
        console.error("notifyShiftSwapRequest error:", error);
        return { success: false, error: "Failed to send notification" };
    }
}

export async function notifyShiftSwapResponse(
    requesterId: string,
    targetUserId: string,
    swapRequestId: string,
    accepted: boolean
) {
    try {
        const targetName = await getUserName(targetUserId);

        return createNotification({
            userId: requesterId,
            type: "SHIFT_SWAP_RESPONSE",
            title: accepted ? "Swap Request Accepted" : "Swap Request Declined",
            message: `${targetName} ${accepted ? "accepted" : "declined"} your shift swap request.`,
            entityType: "ShiftSwapRequest",
            entityId: swapRequestId,
            actionUrl: "/dashboard",
        });
    } catch (error) {
        console.error("notifyShiftSwapResponse error:", error);
        return { success: false, error: "Failed to send notification" };
    }
}

export async function notifyShiftSwapAdminDecision(
    requesterId: string,
    targetUserId: string,
    swapRequestId: string,
    approved: boolean
) {
    try {
        const type = approved ? "SHIFT_SWAP_APPROVED" : "SHIFT_SWAP_REJECTED";
        const title = approved ? "Shift Swap Approved" : "Shift Swap Rejected";
        const message = approved
            ? "Your shift swap has been approved by admin."
            : "Your shift swap has been rejected by admin.";

        // Notify both users
        return createNotificationsForUsers([requesterId, targetUserId], {
            type,
            title,
            message,
            entityType: "ShiftSwapRequest",
            entityId: swapRequestId,
            actionUrl: "/dashboard",
        });
    } catch (error) {
        console.error("notifyShiftSwapAdminDecision error:", error);
        return { success: false, error: "Failed to send notifications" };
    }
}

// Time Off Notifications
export async function notifyTimeOffDecision(
    userId: string,
    timeOffRequestId: string,
    approved: boolean,
    adminNotes?: string
) {
    try {
        const type = approved ? "TIME_OFF_APPROVED" : "TIME_OFF_REJECTED";
        const title = approved ? "Time Off Approved" : "Time Off Rejected";
        let message = approved
            ? "Your time off request has been approved."
            : "Your time off request has been rejected.";

        if (adminNotes) {
            message += ` Notes: ${adminNotes}`;
        }

        return createNotification({
            userId,
            type,
            title,
            message,
            entityType: "TimeOffRequest",
            entityId: timeOffRequestId,
            actionUrl: "/dashboard",
        });
    } catch (error) {
        console.error("notifyTimeOffDecision error:", error);
        return { success: false, error: "Failed to send notification" };
    }
}

// Task Notifications
export async function notifyTaskAssigned(
    userId: string,
    taskId: string,
    taskTitle: string
) {
    try {
        return createNotification({
            userId,
            type: "TASK_ASSIGNED",
            title: "New Task Assigned",
            message: `You have been assigned a new task: ${taskTitle}`,
            entityType: "AdminTask",
            entityId: taskId,
            actionUrl: "/dashboard",
        });
    } catch (error) {
        console.error("notifyTaskAssigned error:", error);
        return { success: false, error: "Failed to send notification" };
    }
}

export async function notifyTaskAssignedToAll(
    taskId: string,
    taskTitle: string
) {
    try {
        // Get all active dispatchers
        const dispatchers = await prisma.user.findMany({
            where: {
                role: "DISPATCHER",
                isActive: true,
            },
            select: { id: true },
        });

        const userIds = dispatchers.map((d) => d.id);

        return createNotificationsForUsers(userIds, {
            type: "TASK_ASSIGNED",
            title: "New Task Assigned",
            message: `You have been assigned a new task: ${taskTitle}`,
            entityType: "AdminTask",
            entityId: taskId,
            actionUrl: "/dashboard",
        });
    } catch (error) {
        console.error("notifyTaskAssignedToAll error:", error);
        return { success: false, error: "Failed to send notifications" };
    }
}

// Schedule Notifications
export async function notifySchedulePublished(weekStart: Date) {
    try {
        // Calculate week end
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Get all users who have schedules for this week
        const schedules = await prisma.schedule.findMany({
            where: {
                date: {
                    gte: weekStart,
                    lt: weekEnd,
                },
                isPublished: true,
            },
            select: { userId: true },
            distinct: ["userId"],
        });

        const userIds = schedules.map((s) => s.userId);

        if (userIds.length === 0) {
            return { success: true, data: { count: 0 } };
        }

        const formattedDate = weekStart.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });

        // Get shift counts per user for personalized message
        const shiftCounts = await prisma.schedule.groupBy({
            by: ["userId"],
            where: {
                date: {
                    gte: weekStart,
                    lt: weekEnd,
                },
                isPublished: true,
            },
            _count: { id: true },
        });

        const countMap = new Map(shiftCounts.map((s) => [s.userId, s._count.id]));

        // Create personalized notifications for each user
        const notifications = userIds.map((userId) => {
            const shiftCount = countMap.get(userId) || 0;
            const shiftText = shiftCount === 1 ? "1 shift" : `${shiftCount} shifts`;
            return {
                userId,
                type: "SCHEDULE_PUBLISHED" as const,
                title: "New Schedule Published",
                message: `Your schedule for the week of ${formattedDate} is ready. You have ${shiftText} scheduled.`,
                actionUrl: "/schedule",
            };
        });

        // Create all notifications
        await prisma.notification.createMany({
            data: notifications,
        });

        return { success: true, data: { count: userIds.length } };
    } catch (error) {
        console.error("notifySchedulePublished error:", error);
        return { success: false, error: "Failed to send notifications" };
    }
}

// SOP Notifications
export async function notifySOPRequiresAck(
    sopId: string,
    sopTitle: string
) {
    try {
        // Get all active users who haven't acknowledged
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: { in: ["DISPATCHER", "ADMIN", "SUPER_ADMIN"] },
                NOT: {
                    sopReads: {
                        some: {
                            sopId,
                            acknowledged: true,
                        },
                    },
                },
            },
            select: { id: true },
        });

        const userIds = users.map((u) => u.id);

        return createNotificationsForUsers(userIds, {
            type: "SOP_REQUIRES_ACK",
            title: "SOP Requires Acknowledgment",
            message: `Please read and acknowledge: ${sopTitle}`,
            entityType: "SOP",
            entityId: sopId,
            actionUrl: "/sops",
        });
    } catch (error) {
        console.error("notifySOPRequiresAck error:", error);
        return { success: false, error: "Failed to send notifications" };
    }
}

// Admin notifications for pending requests
export async function notifyAdminsOfPendingRequest(
    requestType: "TIME_OFF" | "SHIFT_SWAP",
    requestId: string,
    requesterName: string
) {
    try {
        // Get all admins
        const admins = await prisma.user.findMany({
            where: {
                role: { in: ["ADMIN", "SUPER_ADMIN"] },
                isActive: true,
            },
            select: { id: true },
        });

        const userIds = admins.map((a) => a.id);
        const title = requestType === "TIME_OFF"
            ? "Time Off Request Pending"
            : "Shift Swap Pending Approval";
        const message = requestType === "TIME_OFF"
            ? `${requesterName} submitted a time off request.`
            : `${requesterName}'s shift swap is pending your approval.`;

        return createNotificationsForUsers(userIds, {
            type: "GENERAL",
            title,
            message,
            entityType: requestType === "TIME_OFF" ? "TimeOffRequest" : "ShiftSwapRequest",
            entityId: requestId,
            actionUrl: "/admin/requests",
        });
    } catch (error) {
        console.error("notifyAdminsOfPendingRequest error:", error);
        return { success: false, error: "Failed to send notifications" };
    }
}

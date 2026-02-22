"use server";

import prisma from "./prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";

async function requireAuth() {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");
    return session;
}

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
    return prisma.notification.create({
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
}

// Create notification for multiple users
export async function createNotificationsForUsers(
    userIds: string[],
    data: Omit<CreateNotificationData, "userId">
) {
    return prisma.notification.createMany({
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
}

// ============================================
// GET NOTIFICATIONS
// ============================================

export async function getMyNotifications(options?: {
    unreadOnly?: boolean;
    limit?: number;
}) {
    const session = await requireAuth();

    return prisma.notification.findMany({
        where: {
            userId: session.user.id,
            ...(options?.unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: options?.limit || 50,
    });
}

export async function getUnreadNotificationCount() {
    const session = await requireAuth();

    return prisma.notification.count({
        where: {
            userId: session.user.id,
            isRead: false,
        },
    });
}

// ============================================
// UPDATE NOTIFICATIONS
// ============================================

export async function markNotificationAsRead(notificationId: string) {
    const session = await requireAuth();

    const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
    });

    if (!notification || notification.userId !== session.user.id) {
        throw new Error("Notification not found");
    }

    const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    revalidatePath("/dashboard");
    return updated;
}

export async function markAllNotificationsAsRead() {
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
}

export async function deleteNotification(notificationId: string) {
    const session = await requireAuth();

    const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
    });

    if (!notification || notification.userId !== session.user.id) {
        throw new Error("Notification not found");
    }

    await prisma.notification.delete({
        where: { id: notificationId },
    });

    revalidatePath("/dashboard");
}

export async function deleteAllReadNotifications() {
    const session = await requireAuth();

    await prisma.notification.deleteMany({
        where: {
            userId: session.user.id,
            isRead: true,
        },
    });

    revalidatePath("/dashboard");
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
}

export async function notifyShiftSwapResponse(
    requesterId: string,
    targetUserId: string,
    swapRequestId: string,
    accepted: boolean
) {
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
}

export async function notifyShiftSwapAdminDecision(
    requesterId: string,
    targetUserId: string,
    swapRequestId: string,
    approved: boolean
) {
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
}

// Time Off Notifications
export async function notifyTimeOffDecision(
    userId: string,
    timeOffRequestId: string,
    approved: boolean,
    adminNotes?: string
) {
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
}

// Task Notifications
export async function notifyTaskAssigned(
    userId: string,
    taskId: string,
    taskTitle: string
) {
    return createNotification({
        userId,
        type: "TASK_ASSIGNED",
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${taskTitle}`,
        entityType: "AdminTask",
        entityId: taskId,
        actionUrl: "/dashboard",
    });
}

export async function notifyTaskAssignedToAll(
    taskId: string,
    taskTitle: string
) {
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
}

// Schedule Notifications
export async function notifySchedulePublished(weekStart: Date) {
    // Get all users who have schedules for this week
    const schedules = await prisma.schedule.findMany({
        where: { weekStart },
        select: { userId: true },
        distinct: ["userId"],
    });

    const userIds = schedules.map((s) => s.userId);

    const formattedDate = weekStart.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });

    return createNotificationsForUsers(userIds, {
        type: "SCHEDULE_PUBLISHED",
        title: "Schedule Published",
        message: `The schedule for week of ${formattedDate} has been published.`,
        actionUrl: "/scheduler",
    });
}

// SOP Notifications
export async function notifySOPRequiresAck(
    sopId: string,
    sopTitle: string
) {
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
}

// Admin notifications for pending requests
export async function notifyAdminsOfPendingRequest(
    requestType: "TIME_OFF" | "SHIFT_SWAP",
    requestId: string,
    requesterName: string
) {
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
}

// Notification types

import type { UserReference } from "./user";

/**
 * Notification types in the system
 */
export type NotificationType =
    | "SHIFT_SWAP_REQUEST"
    | "SHIFT_SWAP_APPROVED"
    | "SHIFT_SWAP_REJECTED"
    | "TIME_OFF_APPROVED"
    | "TIME_OFF_REJECTED"
    | "TASK_ASSIGNED"
    | "SCHEDULE_PUBLISHED"
    | "ADMIN_NOTE"
    | "SYSTEM";

/**
 * Notification entity
 */
export interface Notification {
    id: string;
    type: NotificationType | string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    userId: string;
    relatedId?: string | null;
    relatedType?: string | null;
}

/**
 * Notification with sender info
 */
export interface NotificationWithSender extends Notification {
    sender?: UserReference | null;
}

/**
 * Data for creating a notification
 */
export interface CreateNotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedId?: string;
    relatedType?: string;
}

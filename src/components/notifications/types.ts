import {
  Clock,
  Calendar,
  ClipboardList,
  BookOpen,
  AlertCircle,
  Bell,
  RefreshCw,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationIconConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
}

/**
 * Icon configuration by notification type
 */
export const NOTIFICATION_ICONS: Record<string, NotificationIconConfig> = {
  // Shift related
  SHIFT_REMINDER: {
    icon: Clock,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
  },
  SHIFT_CHANGE: {
    icon: Calendar,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
  },
  SCHEDULE_PUBLISHED: {
    icon: Clock,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
  },

  // Shift swap related
  SHIFT_SWAP_REQUEST: {
    icon: RefreshCw,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
  },
  SHIFT_SWAP_RESPONSE: {
    icon: RefreshCw,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
  },
  SHIFT_SWAP_APPROVED: {
    icon: CheckCircle,
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.15)",
  },
  SHIFT_SWAP_REJECTED: {
    icon: XCircle,
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
  },

  // Time off related
  TIME_OFF_APPROVED: {
    icon: CheckCircle,
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.15)",
  },
  TIME_OFF_REJECTED: {
    icon: XCircle,
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
  },

  // Task related
  TASK_ASSIGNED: {
    icon: ClipboardList,
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.15)",
  },
  TASK_DUE_SOON: {
    icon: ClipboardList,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
  },

  // SOP related
  SOP_REQUIRES_ACK: {
    icon: BookOpen,
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.15)",
  },

  // General
  ANNOUNCEMENT: {
    icon: BookOpen,
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.15)",
  },
  SYSTEM: {
    icon: AlertCircle,
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
  },
  DEFAULT: {
    icon: Bell,
    color: "#6b7280",
    bg: "rgba(107, 114, 128, 0.15)",
  },
};

/**
 * Get icon config for notification type
 */
export function getNotificationIcon(type: string): NotificationIconConfig {
  return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.DEFAULT;
}

/**
 * Format notification time for display
 */
export function formatNotificationTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

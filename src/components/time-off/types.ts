/**
 * Time Off Types and Configuration
 */

import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type TimeOffType = "VACATION" | "SICK" | "PERSONAL" | "OTHER";

export interface TimeOffRequest {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  type: string;
  status: TimeOffStatus;
  reviewedById: string | null;
  reviewedBy: { id: string; name: string | null } | null;
  reviewedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  user?: { id: string; name: string | null; email: string | null };
}

export interface StatusConfig {
  bg: string;
  color: string;
  icon: LucideIcon;
  label: string;
}

export const STATUS_CONFIG: Record<TimeOffStatus, StatusConfig> = {
  PENDING: {
    bg: "rgba(251, 191, 36, 0.1)",
    color: "var(--warning)",
    icon: Clock,
    label: "Pending",
  },
  APPROVED: {
    bg: "rgba(34, 197, 94, 0.1)",
    color: "var(--success)",
    icon: CheckCircle,
    label: "Approved",
  },
  REJECTED: {
    bg: "rgba(239, 68, 68, 0.1)",
    color: "var(--danger)",
    icon: XCircle,
    label: "Rejected",
  },
  CANCELLED: {
    bg: "rgba(107, 114, 128, 0.1)",
    color: "var(--text-secondary)",
    icon: AlertCircle,
    label: "Cancelled",
  },
};

export const TYPE_LABELS: Record<TimeOffType, string> = {
  VACATION: "Vacation",
  SICK: "Sick Leave",
  PERSONAL: "Personal",
  OTHER: "Other",
};

/**
 * Get type label with fallback
 */
export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type as TimeOffType] || type;
}

import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export type SwapStatus =
  | "PENDING_TARGET"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface Schedule {
  id: string;
  userId: string;
  date: Date;
  startHour: number;
  endHour: number;
  isPublished: boolean;
  user?: { id: string; name: string | null };
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  targetUserId: string;
  requesterShiftId: string;
  targetShiftId: string;
  status: SwapStatus;
  reason: string | null;
  targetResponse: string | null;
  adminNotes: string | null;
  createdAt: Date;
  requester?: { id: string; name: string | null };
  targetUser?: { id: string; name: string | null };
  requesterShift: Schedule;
  targetShift: Schedule;
  reviewedBy?: { id: string; name: string | null } | null;
}

export interface SwapFormData {
  myShiftId: string;
  targetShiftId: string;
  targetUserId?: string;
  reason: string;
}

export interface StatusConfig {
  bg: string;
  color: string;
  icon: typeof Clock;
  label: string;
}

export const STATUS_CONFIG: Record<SwapStatus, StatusConfig> = {
  PENDING_TARGET: {
    bg: "rgba(251, 191, 36, 0.1)",
    color: "var(--warning)",
    icon: Clock,
    label: "Awaiting Response",
  },
  PENDING_ADMIN: {
    bg: "rgba(56, 189, 248, 0.1)",
    color: "var(--accent)",
    icon: Clock,
    label: "Awaiting Admin",
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

import { CheckCircle, Clock, PhoneOff, XCircle, RotateCcw, AlertTriangle } from "lucide-react";

export interface Stats {
    total: number;
    completed: number;
    pending: number;
    expired: number;
    onTime: number;
    late: number;
    avgLeadTime: number;
    onTimeRate: number;
    completionRate: number;
    byStatus: Record<string, number>;
}

export interface DispatcherMetric {
    id: string;
    name: string;
    total: number;
    onTime: number;
    late: number;
    onTimeRate: number;
    byStatus: Record<string, number>;
}

export interface TripConfirmation {
    id: string;
    tripNumber: string;
    reservationNumber?: string | null;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    accountName?: string | null;
    accountNumber?: string | null;
    status: string;
    completedAt: Date | string | null;
    completedBy: { id: string; name: string | null } | null;
    minutesBeforeDue?: number | null;
    notes?: string | null;
    manifestDate: Date | string;
    createdAt: Date | string;
}

export interface AccountabilityMetric {
    id: string;
    name: string;
    role: string;
    totalShifts: number;
    confirmationsCompleted: number;
    confirmationsOnTime: number;
    confirmationsMissedWhileOnDuty: number;
    accountabilityRate: number;
}

export interface MissedConfirmation {
    id: string;
    tripNumber: string;
    passengerName: string;
    driverName: string;
    dueAt: Date | string;
    pickupAt: Date | string;
    expiredAt: Date | string | null;
    onDutyDispatchers: Array<{
        id: string;
        name: string | null;
        role: string;
        shiftStart: Date | string;
        shiftEnd: Date | string | null;
    }>;
}

export interface Dispatcher {
    id: string;
    name: string;
    count: number;
}

export type SortField = "pickupAt" | "dueAt" | "status" | "tripNumber" | "createdAt" | "completedAt";
export type SortDirection = "asc" | "desc";
export type StatusFilter = "ALL" | "PENDING" | "CONFIRMED" | "NO_ANSWER" | "CANCELLED" | "RESCHEDULED" | "EXPIRED";

export const STATUS_CONFIG: Record<
    string,
    { label: string; icon: typeof CheckCircle; color: string; bgColor: string }
> = {
    PENDING: { label: "Pending", icon: Clock, color: "#60a5fa", bgColor: "rgba(96, 165, 250, 0.12)" },
    CONFIRMED: { label: "Confirmed", icon: CheckCircle, color: "#4ade80", bgColor: "rgba(74, 222, 128, 0.12)" },
    NO_ANSWER: { label: "No Answer", icon: PhoneOff, color: "#fbbf24", bgColor: "rgba(251, 191, 36, 0.12)" },
    CANCELLED: { label: "Cancelled", icon: XCircle, color: "#f87171", bgColor: "rgba(248, 113, 113, 0.12)" },
    RESCHEDULED: { label: "Rescheduled", icon: RotateCcw, color: "#a78bfa", bgColor: "rgba(167, 139, 250, 0.12)" },
    EXPIRED: { label: "Expired", icon: AlertTriangle, color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.12)" },
};

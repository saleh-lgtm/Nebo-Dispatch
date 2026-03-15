import { CheckCircle, XCircle, PhoneOff, RotateCcw } from "lucide-react";

export type ConfirmationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "NO_ANSWER"
  | "CANCELLED"
  | "RESCHEDULED"
  | "EXPIRED";

export interface Confirmation {
  id: string;
  tripNumber: string;
  pickupAt: Date | string;
  dueAt: Date | string;
  passengerName: string;
  driverName: string;
  status: string;
  completedAt: Date | string | null;
  completedBy: { id: string; name: string | null } | null;
}

export interface StatusOption {
  value: ConfirmationStatus;
  label: string;
  icon: typeof CheckCircle;
  className: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "CONFIRMED",
    label: "Confirmed",
    icon: CheckCircle,
    className: "status-confirmed",
  },
  {
    value: "NO_ANSWER",
    label: "No Answer",
    icon: PhoneOff,
    className: "status-no-answer",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
    icon: XCircle,
    className: "status-cancelled",
  },
  {
    value: "RESCHEDULED",
    label: "Rescheduled",
    icon: RotateCcw,
    className: "status-rescheduled",
  },
];

// Trip confirmation types

import type { UserReference } from "./user";

/**
 * Confirmation status
 */
export type ConfirmationStatus = "PENDING" | "CONFIRMED" | "FAILED" | "SKIPPED";

/**
 * Trip confirmation for dispatcher follow-up
 */
export interface TripConfirmation {
    id: string;
    tripNumber: string;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    status: ConfirmationStatus | string;
    completedAt: Date | string | null;
    completedBy: UserReference | null;
    notes?: string | null;
    account?: string | null;
}

/**
 * Confirmation widget display item
 */
export interface ConfirmationDisplayItem extends TripConfirmation {
    isOverdue: boolean;
    minutesUntilDue: number;
}

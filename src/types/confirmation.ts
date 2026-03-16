// Trip confirmation types

import type { UserReference } from "./user";

/**
 * Confirmation status — matches ConfirmationStatus enum in prisma/schema.prisma
 */
export type ConfirmationStatus =
    | "PENDING"      // Waiting for dispatcher to confirm
    | "CONFIRMED"    // Driver confirmed
    | "NO_ANSWER"    // Driver didn't answer
    | "CANCELLED"    // Trip was cancelled
    | "RESCHEDULED"  // Pickup time changed
    | "EXPIRED";     // Confirmation window passed without action

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
    status: ConfirmationStatus;
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

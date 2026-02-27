// Quote-related types

import type { UserReference } from "./user";

/**
 * Quote status enum
 */
export type QuoteStatus = "PENDING" | "FOLLOWING_UP" | "CONVERTED" | "LOST" | "EXPIRED";

/**
 * Quote outcome enum
 */
export type QuoteOutcome = "WON" | "LOST" | null;

/**
 * Minimal quote for display in lists
 */
export interface QuoteMinimal {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceType: string;
    estimatedAmount: number | null;
    notes: string | null;
    status: string;
    createdBy: UserReference;
}

/**
 * Full quote with all tracking fields
 */
export interface Quote extends QuoteMinimal {
    source: string | null;
    dateOfService: Date | null;
    pickupDate: Date | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    status: QuoteStatus;
    outcome: QuoteOutcome;
    outcomeReason: string | null;
    followUpCount: number;
    lastFollowUp: Date | null;
    nextFollowUp: Date | null;
    lastActionAt: Date | null;
    actionCount: number;
    isFlagged: boolean;
    expiresAt: Date;
    followUpNotes: string | null;
    assignedTo: UserReference | null;
    createdAt: Date;
}

/**
 * Data for creating a new quote
 */
export interface QuoteCreateInput {
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    serviceType: string;
    estimatedAmount?: number;
    notes?: string;
    shiftId?: string;
}

/**
 * Service types available for quotes
 */
export const SERVICE_TYPES = [
    "Airport Transfer",
    "Hourly Service",
    "Point to Point",
    "City Tour",
    "Event Transportation",
    "Corporate",
    "Other",
] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

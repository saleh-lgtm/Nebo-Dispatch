// Shift and scheduling related types

import type { UserReference } from "./user";

/**
 * Active shift information
 */
export interface ActiveShift {
    id: string;
    clockIn: Date;
    clockOut?: Date | null;
}

/**
 * Scheduled shift (future)
 */
export interface ScheduledShift {
    id: string;
    shiftStart: Date;
    shiftEnd: Date;
}

/**
 * Full schedule entry
 */
export interface Schedule {
    id: string;
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
    notes?: string | null;
    createdAt: Date;
    user?: UserReference;
}

/**
 * Shift report with all metrics
 */
export interface ShiftReport {
    id: string;
    status: string;
    // Communication metrics
    callsReceived: number;
    emailsSent: number;
    quotesGiven: number;
    // Reservation metrics
    totalReservationsHandled: number;
    // Issue tracking
    complaintsReceived: number;
    complaintsResolved: number;
    escalations: number;
    // Driver metrics
    driversDispatched: number;
    noShowsHandled: number;
    latePickups: number;
    // Narrative fields
    handoffNotes: string | null;
    generalComments: string | null;
    newIdeas: string | null;
    incidents: string | null;
    achievements: string | null;
    challenges: string | null;
    // Feedback
    shiftRating: number | null;
    adminFeedback: string | null;
    performanceScore: number | null;
    // Timestamps
    createdAt: Date;
    // Relations
    shift: {
        clockIn: Date;
        clockOut: Date | null;
    };
    user: UserReference;
}

/**
 * Shift swap request
 */
export interface SwapRequest {
    id: string;
    requesterId: string;
    requester: UserReference;
    targetUserId: string | null;
    targetUser: UserReference | null;
    originalScheduleId: string;
    originalSchedule: Schedule;
    targetScheduleId: string | null;
    targetSchedule: Schedule | null;
    status: SwapRequestStatus;
    reason: string | null;
    adminNotes: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    resolvedBy: UserReference | null;
}

export type SwapRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/**
 * Time off request
 */
export interface TimeOffRequest {
    id: string;
    userId: string;
    user: UserReference;
    startDate: Date;
    endDate: Date;
    reason: string;
    status: TimeOffStatus;
    adminNotes: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    resolvedBy: UserReference | null;
}

export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Reservation entry for shift reports
 */
export interface ReservationEntry {
    id: string;
    notes: string;
    flaggedForAccounting?: boolean;
    flagReason?: string;
}

/**
 * Retail lead outcome types
 */
export type RetailLeadOutcome = "WON" | "NEEDS_FOLLOW_UP" | "LOST";
export type LostReason = "VEHICLE_TYPE" | "AVAILABILITY" | "PRICING" | "OTHER";

/**
 * Retail lead entry for shift reports
 */
export interface RetailLeadEntry {
    serviceRequested: string;
    outcome: RetailLeadOutcome;
    lostReason?: LostReason;
    lostReasonOther?: string;
    notes?: string;
}

/**
 * Shift metrics for reporting
 */
export interface ShiftMetrics {
    calls: number;
    emails: number;
    totalReservationsHandled: number;
}

/**
 * Shift narrative fields
 */
export interface ShiftNarrative {
    comments: string;
    incidents: string;
    ideas: string;
}

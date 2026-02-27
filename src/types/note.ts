// Note-related types

import type { UserReference } from "./user";

/**
 * Global note (announcement or shift handoff note)
 */
export interface GlobalNote {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: UserReference;

    // Classification
    isAnnouncement: boolean;
    isPinned: boolean;
    expiresAt: Date | null;

    // Shift relation (for shift notes)
    shiftId: string | null;
    shift?: {
        id: string;
        clockIn: Date;
        clockOut: Date | null;
        user: UserReference;
    };
}

/**
 * Announcement read status for a specific user
 */
export interface AnnouncementReadStatus {
    isRead: boolean;
    readAt: Date | null;
    isAcknowledged: boolean;
    acknowledgedAt: Date | null;
}

/**
 * Announcement with user's read/acknowledgment status
 */
export interface AnnouncementWithStatus extends Omit<GlobalNote, "shift"> {
    readStatus: AnnouncementReadStatus;
}

/**
 * Shift note with context about which shift it's from
 */
export interface ShiftHandoffNote extends GlobalNote {
    isFromCurrentShift: boolean;
    isFromPreviousShift: boolean;
    shiftAuthor: UserReference;
}

/**
 * Dashboard notes data structure (returned by getDashboardNotes)
 */
export interface DashboardNotesData {
    announcements: AnnouncementWithStatus[];
    shiftNotes: ShiftHandoffNote[];
    unacknowledgedCount: number;
}

/**
 * Note input for creation (shift note)
 */
export interface ShiftNoteInput {
    title: string;
    content: string;
}

/**
 * Announcement input for creation (admin only)
 */
export interface AnnouncementInput {
    title: string;
    content: string;
    isPinned?: boolean;
    expiresAt?: Date | null;
}

/**
 * Legacy type for backward compatibility
 */
export interface GlobalNoteInput {
    title: string;
    content: string;
}

// Event-related types

import type { UserReference } from "./user";

/**
 * Event types
 */
export type EventType = "GAME_DAY" | "CONCERT" | "CONFERENCE" | "HOLIDAY" | "PROMOTION" | "GENERAL";

/**
 * Calendar event
 */
export interface CalendarEvent {
    id: string;
    title: string;
    description: string | null;
    eventDate: Date;
    endDate: Date | null;
    eventType: EventType;
    location: string | null;
    notes: string | null;
    expectedVolume: string | null;
    staffingNotes: string | null;
    createdBy: UserReference;
    createdAt: Date;
}

/**
 * Event type display configuration
 */
export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
    GAME_DAY: { label: "Game Day", color: "#ef4444" },
    CONCERT: { label: "Concert", color: "#a855f7" },
    CONFERENCE: { label: "Conference", color: "#3b82f6" },
    HOLIDAY: { label: "Holiday", color: "#22c55e" },
    PROMOTION: { label: "Promotion", color: "#f59e0b" },
    GENERAL: { label: "General", color: "#6b7280" },
};

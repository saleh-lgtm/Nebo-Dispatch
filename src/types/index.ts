/**
 * Centralized Type Exports
 *
 * This module re-exports all types from domain-specific modules
 * for convenient importing throughout the application.
 *
 * Usage:
 *   import type { User, Quote, ShiftReport } from "@/types";
 *   import { SERVICE_TYPES, EVENT_TYPE_CONFIG } from "@/types";
 */

// User types
export type {
    UserReference,
    UserWithEmail,
    OnlineUser,
    SessionUser,
    Session,
} from "./user";
export type { UserRole } from "./user";

// Quote types
export type {
    QuoteMinimal,
    Quote,
    QuoteCreateInput,
} from "./quote";
export type { QuoteStatus, QuoteOutcome, ServiceType } from "./quote";
export { SERVICE_TYPES } from "./quote";

// Shift types
export type {
    ActiveShift,
    ScheduledShift,
    Schedule,
    ShiftReport,
    SwapRequest,
    TimeOffRequest,
    ReservationEntry,
    RetailLeadEntry,
    ShiftMetrics,
    ShiftNarrative,
} from "./shift";
export type {
    SwapRequestStatus,
    TimeOffStatus,
    RetailLeadOutcome,
    LostReason,
} from "./shift";

// Task types
export type {
    ShiftTask,
    AdminTask,
    TaskCompletion,
    TaskWithProgress,
} from "./task";
export type { TaskPriority } from "./task";
export { TASK_PRIORITIES } from "./task";

// Event types
export type { CalendarEvent } from "./event";
export type { EventType } from "./event";
export { EVENT_TYPE_CONFIG } from "./event";

// Confirmation types
export type {
    TripConfirmation,
    ConfirmationDisplayItem,
} from "./confirmation";
export type { ConfirmationStatus } from "./confirmation";

// Notification types
export type {
    Notification,
    NotificationWithSender,
    CreateNotificationInput,
} from "./notification";
export type { NotificationType } from "./notification";

// SMS types
export type {
    SMSLog,
    SMSConversation,
    ChatMessage,
    SMSContact,
} from "./sms";
export type { SMSDirection, SMSStatus } from "./sms";

// Note types
export type { GlobalNote, GlobalNoteInput } from "./note";

// Shift report specific types (for backward compatibility)
export type {
    Metrics,
    Narrative,
    ColorTheme,
    FlagReason,
} from "./shift-report";
export { THEME_COLORS, FLAG_REASONS } from "./shift-report";

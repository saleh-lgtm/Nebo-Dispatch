/**
 * Shift Report Component Types
 *
 * This module contains types specific to shift report UI components.
 * For domain types (ReservationEntry, RetailLeadEntry, etc.), import from:
 *   - @/types/shift for shift-related types
 *   - @/types/quote for quote types
 *   - @/types/task for task types
 *   - @/types/user for user types
 */

// Re-export commonly used types from domain modules for convenience
export type {
    ReservationEntry,
    RetailLeadEntry,
    RetailLeadOutcome,
    LostReason,
    ShiftMetrics as Metrics,
    ShiftNarrative as Narrative,
    ActiveShift,
} from "./shift";

export type { ShiftTask } from "./task";
export type { QuoteMinimal as Quote } from "./quote";
export type { Session } from "./user";

// ============================================
// UI-Specific Types and Constants
// ============================================

/**
 * Color theme type for consistent UI styling
 */
export type ColorTheme = "blue" | "green" | "amber" | "purple" | "red";

/**
 * Theme color configuration for UI components
 */
export const THEME_COLORS: Record<ColorTheme, { bg: string; border: string; text: string }> = {
    blue: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" },
    green: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)", text: "#4ade80" },
    amber: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", text: "#fbbf24" },
    purple: { bg: "rgba(168, 85, 247, 0.1)", border: "rgba(168, 85, 247, 0.2)", text: "#c084fc" },
    red: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)", text: "#f87171" },
};

/**
 * Predefined flag reasons for accounting review
 */
export const FLAG_REASONS = [
    "Price discrepancy",
    "Missing payment info",
    "Affiliate billing issue",
    "Rate adjustment needed",
    "Discount applied",
    "Gratuity issue",
    "Cancellation fee",
    "No-show charge",
    "Extra charges",
    "Refund request",
    "Other",
] as const;

export type FlagReason = typeof FLAG_REASONS[number];

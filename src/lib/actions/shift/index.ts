/**
 * Shift Domain Actions
 *
 * This module exports all shift-related server actions:
 * - Clock in/out operations
 * - Shift report management
 * - Shift swap requests
 */

// Re-export from existing files (for backward compatibility during migration)
export * from "../../clockActions";
export * from "../../shiftReportActions";
export * from "../../shiftSwapActions";

// Re-export shift-related actions from main actions.ts
// These will be moved here in a future refactor
export {
    toggleTask,
    saveShiftReport,
    saveShiftReportDraft,
    getShiftReportDraft,
    deleteShiftReportDraft,
    createActiveShift,
    type ShiftReportDraft,
} from "../../actions";

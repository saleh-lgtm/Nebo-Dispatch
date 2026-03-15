/**
 * Shifts Domain
 *
 * Unified export for shift management: clock in/out, reports, swaps.
 *
 * Usage:
 *   import { clockIn, clockOut, getShiftStatus } from "@/lib/domains/shifts";
 *   import type { ShiftStatus } from "@/lib/domains/shifts";
 */

// ============================================
// CLOCK ACTIONS (clockActions.ts)
// ============================================

export {
  // Types
  type ShiftStatus,

  // Clock operations
  clockIn,
  clockOut,
  getShiftStatus,
  canLogout,

  // Incomplete reports
  getIncompleteReportShifts,
} from "../../clockActions";

// ============================================
// SHIFT REPORT ACTIONS (shiftReportActions.ts)
// ============================================

export {
  // Report queries
  getAllShiftReports,
  getShiftReportById,
  getMyShiftReports,

  // Report management
  reviewShiftReport,

  // Performance & analytics
  getDispatcherPerformance,
  getTeamPerformance,
  getReportStats,
} from "../../shiftReportActions";

// ============================================
// SHIFT SWAP ACTIONS (shiftSwapActions.ts)
// ============================================

export {
  // Swap requests
  requestShiftSwap,
  getMySwapRequests,
  getPendingSwapRequests,
  cancelSwapRequest,

  // Swap responses
  respondToSwap,
  adminApproveSwap,
  adminRejectSwap,

  // Swap utilities
  getSwapableShifts,
  getSwapStats,
} from "../../shiftSwapActions";

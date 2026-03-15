/**
 * Scheduling Domain
 *
 * Unified export for schedule management and time-off requests.
 *
 * Usage:
 *   import { getWeekSchedules, requestTimeOff } from "@/lib/domains/scheduling";
 */

// ============================================
// SCHEDULER ACTIONS (schedulerActions.ts)
// ============================================

export {
  // Schedule queries
  getDispatchers,
  getWeekSchedules,
  isWeekPublished,
  getUserNextShift,

  // Schedule mutations
  createScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,

  // Week publishing
  publishWeekSchedules,
  unpublishWeekSchedules,
  copyPreviousWeekSchedules,
} from "../../schedulerActions";

// ============================================
// TIME-OFF ACTIONS (timeOffActions.ts)
// ============================================

export {
  // Types
  type TimeOffType,

  // Time-off requests
  requestTimeOff,
  cancelTimeOff,

  // Time-off queries
  getMyTimeOffRequests,
  getPendingTimeOffRequests,
  getAllTimeOffRequests,
  getTimeOffCalendar,
  getTimeOffStats,

  // Time-off approval
  approveTimeOff,
  rejectTimeOff,
} from "../../timeOffActions";

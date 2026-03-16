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
  getUserNextShift,
  getUserUpcomingSchedules,
  getSchedule,

  // Schedule mutations
  createSchedule,
  updateSchedule,
  deleteSchedule,

  // Week operations
  publishWeek,
  unpublishWeek,
  copyPreviousWeek,
  clearWeekSchedules,
  previewCopyPreviousWeek,
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

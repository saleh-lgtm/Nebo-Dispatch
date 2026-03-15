/**
 * Custom Hooks
 *
 * Unified exports for reusable React hooks.
 *
 * Usage:
 *   import { useAutoSave, useClockTimer, useToast } from "@/hooks";
 */

// Auto-save for forms
export { useAutoSave } from "./useAutoSave";

// Clock/timer utilities
export {
  useClockTimer,
  formatDuration,
  formatTime,
  getTimeDiffLabel,
} from "./useClockTimer";

// Real-time SMS
export { useRealtimeSMS } from "./useRealtimeSMS";

// Toast notifications
export { useToast } from "./useToast";

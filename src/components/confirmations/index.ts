/**
 * Confirmation Components
 *
 * Components for trip confirmation management.
 *
 * Usage:
 *   import { ConfirmationCard, STATUS_OPTIONS } from "@/components/confirmations";
 */

// Components
export { default as ConfirmationCard } from "./ConfirmationCard";
export { default as ConfirmationModal } from "./ConfirmationModal";

// Types
export type { Confirmation, ConfirmationStatus, StatusOption } from "./types";
export { STATUS_OPTIONS } from "./types";

// Utilities
export {
  getTimeUntilDue,
  isOverdue,
  isUrgent,
  formatConfirmationTime,
  getUrgencyLevel,
} from "./utils";

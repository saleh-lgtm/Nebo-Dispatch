/**
 * Centralized Actions Export
 *
 * This module provides a unified entry point for all server actions.
 * Actions are organized by domain for better maintainability.
 *
 * Usage:
 *   // Import from specific domain (recommended)
 *   import { createActiveShift } from "@/lib/actions/shift";
 *   import { sendSMS } from "@/lib/actions/communication";
 *
 *   // Or import from main barrel (for backward compatibility)
 *   import { createActiveShift, sendSMS } from "@/lib/actions";
 *
 * Domains:
 *   - shift: Clock in/out, reports, swaps
 *   - user: User management, presence, auth
 *   - scheduling: Schedules, time-off
 *   - task: Shift & admin tasks
 *   - communication: SMS, notifications
 *   - affiliate: Affiliates, pricing, network
 *   - operations: Fleet, drivers, confirmations
 *   - content: SOPs, notes, events
 *   - accounting: Quotes, accounting, hours
 *   - admin: Audit, analytics, requests
 */

// Export all domains
export * from "./shift";
export * from "./user";
export * from "./scheduling";
export * from "./task";
export * from "./communication";
export * from "./affiliate";
export * from "./operations";
export * from "./content";
export * from "./accounting";
export * from "./admin";

// Re-export storage actions (utility, not domain-specific)
export * from "../storageActions";

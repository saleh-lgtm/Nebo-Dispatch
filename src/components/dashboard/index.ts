/**
 * Dashboard Components
 *
 * Unified exports for dashboard panels and widgets.
 *
 * Usage:
 *   import { TasksPanel, EventsPanel, ClockButton } from "@/components/dashboard";
 */

// Core widgets
export { default as ClockButton } from "../ClockButton";
export { default as Navbar } from "../Navbar";
export { default as Sidebar } from "../Sidebar";
export { default as SuperAdminSidebar } from "../SuperAdminSidebar";

// Dashboard panels
export { default as TasksPanel } from "../TasksPanel";
export { default as EventsPanel } from "../EventsPanel";
export { default as NotificationPanel } from "../NotificationPanel";
export { default as NotificationBell } from "../NotificationBell";
export { default as TimeOffPanel } from "../TimeOffPanel";
export { default as RecentReportsPanel } from "../RecentReportsPanel";
export { default as ActiveUsersPanel } from "../ActiveUsersPanel";

// Admin panels
export { default as AdminTaskProgressPanel } from "../AdminTaskProgressPanel";
export { default as ShiftSwapPanel } from "../ShiftSwapPanel";

// Engagement & Analytics
export { default as EngagementLeaderboard } from "../EngagementLeaderboard";
export { default as ConfirmationWidget } from "../ConfirmationWidget";

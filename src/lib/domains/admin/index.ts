/**
 * Admin Domain
 *
 * Unified export for admin functions: audit, analytics, dashboard, requests.
 *
 * Usage:
 *   import { getAuditLogs, getPerformanceMetrics } from "@/lib/domains/admin";
 */

// ============================================
// AUDIT ACTIONS (auditActions.ts)
// ============================================

export {
  // Types
  type AuditAction,
  type AuditEntity,

  // Audit logging
  createAuditLog,

  // Audit queries
  getAuditLogs,
  getAuditStats,
} from "../../auditActions";

// ============================================
// ANALYTICS ACTIONS (analyticsActions.ts)
// ============================================

export {
  // Performance metrics
  getPerformanceMetrics,
  getDispatcherComparison,
  getDailyTrend,
  getDispatcherList,
  getConfirmationAccountabilityTrend,
} from "../../analyticsActions";

// ============================================
// ADMIN DASHBOARD (adminDashboardActions.ts)
// ============================================

export {
  // Dashboard stats
  getAdminDashboardStats,
  getRecentActivity,

  // Dispatcher management
  getDispatcherAccessList,
  updateDispatcherFeatureAccess,
  updateDispatcherTaskConfig,
  getDispatcherAnalytics,
} from "../../adminDashboardActions";

// ============================================
// ADMIN REQUESTS (adminRequestActions.ts)
// ============================================

export {
  // Request queries
  getPendingRequests,
  getAllRequests,
  getRequestCounts,

  // Request approval
  approveRequest,
  rejectRequest,
} from "../../adminRequestActions";

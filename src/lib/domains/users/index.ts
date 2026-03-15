/**
 * Users Domain
 *
 * Unified export for user management: CRUD, roles, presence.
 *
 * Usage:
 *   import { getAllUsers, createUser, getOnlineUsers } from "@/lib/domains/users";
 */

// ============================================
// USER ACTIONS (userActions.ts)
// ============================================

export {
  // Password management
  changePassword,
} from "../../userActions";

// ============================================
// USER MANAGEMENT (userManagementActions.ts)
// ============================================

export {
  // User queries
  getAllUsers,
  getUserById,
  getUserStats,

  // User mutations
  createUser,
  updateUser,
  deleteUser,

  // Role management
  changeUserRole,
  resetUserPassword,
} from "../../userManagementActions";

// ============================================
// PRESENCE (presenceActions.ts)
// ============================================

export {
  // Presence tracking
  updatePresence,
  setOffline,

  // Presence queries
  getOnlineUsers,
  getOnlineCount,
  getActiveShiftUsers,
  getPresenceReport,
} from "../../presenceActions";

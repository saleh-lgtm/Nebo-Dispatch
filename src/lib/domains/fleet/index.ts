/**
 * Fleet Domain
 *
 * Unified export for fleet management: vehicles, drivers, permits, insurance.
 *
 * Usage:
 *   import { getVehicles, createVehicle } from "@/lib/domains/fleet";
 *   import type { CreateVehicleData } from "@/lib/domains/fleet";
 *
 * Note: This domain re-exports from legacy files for now.
 * Full refactoring to service/actions pattern planned for future.
 */

// ============================================
// VEHICLE ACTIONS (fleetActions.ts)
// ============================================

export {
  // Types
  type CreateVehicleData,
  type CreatePermitData,
  type CreateInsuranceData,
  type CreateRegistrationData,
  type CreateDocumentData,

  // Vehicle CRUD
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  updateVehicleStatus,
  deleteVehicle,

  // Permit CRUD
  createPermit,
  updatePermit,
  deletePermit,

  // Insurance CRUD
  createInsurance,
  updateInsurance,
  deleteInsurance,

  // Registration CRUD
  createRegistration,
  updateRegistration,
  deleteRegistration,

  // Document CRUD
  createVehicleDocument,
  deleteVehicleDocument,

  // Dashboard & Alerts
  getFleetStats,
  getExpiringDocuments,
  getExpiredDocuments,
} from "../../fleetActions";

// ============================================
// DRIVER/CHAUFFEUR ACTIONS (driverActions.ts)
// ============================================

export {
  // Types
  type DriverVehicleData,
  type SchedulePreferencesData,
  type VehicleAssignmentData,

  // Driver vehicle management
  getDriverVehicle,
  upsertDriverVehicle,
  deleteDriverVehicle,

  // Schedule preferences
  getSchedulePreferences,
  upsertSchedulePreferences,
  deleteSchedulePreferences,

  // Vehicle assignments
  getVehicleAssignments,
  assignVehicle,
  updateVehicleAssignment,
  removeVehicleAssignment,

  // Fleet vehicle queries
  getAvailableFleetVehicles,
  getVehicleChauffeurs,

  // Constants
  VEHICLE_TYPES,
  SHIFT_OPTIONS,
  DAY_OPTIONS,
} from "../../driverActions";

// ============================================
// VEHICLE MAPPING ACTIONS (vehicleMappingActions.ts)
// ============================================

export {
  // Mapping CRUD
  getVehicleMappings,
  getActiveVehicleMappings,
  getVehicleMapping,
  upsertVehicleMapping,
  deleteVehicleMapping,
  toggleVehicleMapping,

  // Utilities
  seedDefaultMappings,
  getLaVehicleTypes,
} from "../../vehicleMappingActions";

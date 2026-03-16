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
 *   import { getUnifiedEntities } from "@/lib/actions/entity";
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
 *   - entity: UNIFIED contacts & affiliates (new!)
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

// Entity module - exclude conflicting exports that exist in communication
// (smsContactActions exports getContacts/updateContact for SMS contacts,
//  contactActions exports getContacts/updateContact for regular contacts)
export {
  // Type exports
  type EntityType,
  type AffiliateSubType,
  type UnifiedApprovalStatus,
  type EntityTag,
  type EntitySmsStats,
  type ContactMetadata,
  type AffiliateMetadata,
  type QuoteMetadata,
  type EntityMetadata,
  type UnifiedEntity,
  type UnifiedEntityQuery,
  type UnifiedEntityResult,
  type CreateUnifiedEntityData,
  type UpdateUnifiedEntityData,
  type UnifiedEntityStats,
  type BlastSmsRecipient,
  type BlastSmsPreview,
  // Type guards
  isContactMetadata,
  isAffiliateMetadata,
  isQuoteMetadata,
  parseEntityId,
  createEntityId,
  // Service functions
  getUnifiedEntities,
  getUnifiedEntity,
  getUnifiedEntityStats,
  createUnifiedEntity,
  updateUnifiedEntity,
  deleteUnifiedEntity,
  approveUnifiedEntity,
  rejectUnifiedEntity,
  getEntityTags,
  assignTagsToUnifiedEntity,
  previewBlastSmsRecipients,
  getEntitiesForBlastSms,
  // Contact actions (renamed to avoid conflict with SMS contacts)
  getContacts as getContactEntities,
  getAllContacts,
  getPendingContacts,
  getMyContacts,
  createContact,
  updateContact as updateContactEntity,
  deleteContact,
  approveContact,
  rejectContact,
  getContactsWithTags,
  getAllContactsWithTags,
  getContactsByTagFilter,
  // Tag actions
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  assignTagsToContact,
  addTagToContact,
  removeTagFromContact,
  getContactsByTags,
  // Enhanced Blast SMS
  getBlastRecipients,
  previewEnhancedBlastSMS,
  sendEnhancedBlastSMS,
  getBlastTags,
} from "./entity";

export * from "./operations";
export * from "./content";
export * from "./accounting";
export * from "./admin";

// Re-export storage actions (utility, not domain-specific)
export * from "../storageActions";

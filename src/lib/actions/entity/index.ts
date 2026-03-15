/**
 * Entity Domain Actions
 *
 * This module provides a UNIFIED interface for working with contacts and affiliates.
 * It abstracts the differences between Contact and Affiliate models, providing:
 *
 * - Single query interface for both entity types
 * - Normalized fields (name, email, phone, approvalStatus)
 * - SMS integration across all entities
 * - Consistent CRUD operations
 *
 * Usage:
 *   // Query unified entities
 *   import { getUnifiedEntities } from "@/lib/actions/entity";
 *   const { entities } = await getUnifiedEntities({ search: "john" });
 *
 *   // Create entity (routes to appropriate model)
 *   import { createUnifiedEntity } from "@/lib/actions/entity";
 *   await createUnifiedEntity({ entityType: "CONTACT", name: "John" });
 *
 *   // Use composite IDs
 *   const entity = await getUnifiedEntity("CONTACT:clx123...");
 *   await updateUnifiedEntity("AFFILIATE:clx456...", { name: "Updated" });
 *
 * Note: This is an ABSTRACTION LAYER. The underlying Contact and Affiliate
 * models remain unchanged. Legacy code can continue using contactActions.ts
 * and affiliateActions.ts directly.
 */

// ============================================
// TYPE EXPORTS
// ============================================

export type {
  // Core types
  EntityType,
  AffiliateSubType,
  UnifiedApprovalStatus,

  // Tag types
  EntityTag,

  // SMS types
  EntitySmsStats,

  // Metadata types
  ContactMetadata,
  AffiliateMetadata,
  QuoteMetadata,
  EntityMetadata,

  // Main entity type
  UnifiedEntity,

  // Query types
  UnifiedEntityQuery,
  UnifiedEntityResult,

  // Mutation types
  CreateUnifiedEntityData,
  UpdateUnifiedEntityData,

  // Stats types
  UnifiedEntityStats,

  // Blast SMS types
  BlastSmsRecipient,
  BlastSmsPreview,
} from "../../unifiedEntityTypes";

// Type guards and utilities
export {
  isContactMetadata,
  isAffiliateMetadata,
  isQuoteMetadata,
  parseEntityId,
  createEntityId,
} from "../../unifiedEntityTypes";

// ============================================
// SERVICE EXPORTS
// ============================================

// Query functions
export {
  getUnifiedEntities,
  getUnifiedEntity,
  getUnifiedEntityStats,
} from "../../unifiedEntityService";

// CRUD functions
export {
  createUnifiedEntity,
  updateUnifiedEntity,
  deleteUnifiedEntity,
} from "../../unifiedEntityService";

// Approval functions
export {
  approveUnifiedEntity,
  rejectUnifiedEntity,
} from "../../unifiedEntityService";

// Tag functions
export {
  getEntityTags,
  assignTagsToUnifiedEntity,
} from "../../unifiedEntityService";

// Blast SMS functions
export {
  previewBlastSmsRecipients,
  getEntitiesForBlastSms,
} from "../../unifiedEntityService";

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================

// Re-export legacy contact actions
export {
  getContacts,
  getAllContacts,
  getPendingContacts,
  getMyContacts,
  createContact,
  updateContact,
  deleteContact,
  approveContact,
  rejectContact,
  getContactsWithTags,
  getAllContactsWithTags,
  getContactsByTagFilter,
} from "../../contactActions";

// Re-export legacy tag actions
export {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  assignTagsToContact,
  addTagToContact,
  removeTagFromContact,
  getContactsByTags,
} from "../../tagActions";

// Re-export blast SMS actions
export {
  previewBlastSMS,
  sendBlastSMS,
  getBlastSMSHistory,
  getBlastSMSStats,
} from "../../blastSMSActions";

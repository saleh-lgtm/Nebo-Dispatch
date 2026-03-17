/**
 * Affiliates Domain
 *
 * Unified export for affiliate/partner management: farm-in, farm-out, pricing, audit.
 *
 * Usage:
 *   import { getAffiliatesWithStatus, approveAffiliate } from "@/lib/domains/affiliates";
 *   import type { CreatePartnerData } from "@/lib/domains/affiliates";
 */

// ============================================
// AFFILIATE CRUD (affiliateActions.ts)
// ============================================

export {
  // Affiliate queries
  getAffiliatesWithStatus,
  getPendingAffiliatesCount,
  getPendingAffiliatesCounts,
  getAffiliateWithAttachments,

  // Affiliate mutations
  approveAffiliate,
  rejectAffiliate,
  updateAffiliate,
  deleteAffiliate,

  // Attachments
  getAffiliateAttachments,
  uploadAffiliateAttachment,
  deleteAffiliateAttachment,
} from "../../affiliateActions";

// ============================================
// AFFILIATE PRICING (affiliatePricingActions.ts)
// ============================================

export {
  // Base pricing
  getAffiliatePricing,
  upsertAffiliatePricing,
  deleteAffiliatePricing,
  bulkUpdatePricing,
  copyPricingFromAffiliate,

  // Route pricing
  getAffiliateRoutePricing,
  upsertAffiliateRoutePrice,
  deleteAffiliateRoutePrice,
  bulkAddRoutePrices,

  // Queries with pricing
  getFarmInAffiliatesWithPricing,
  getFarmInAffiliatesWithAllPricing,
} from "../../affiliatePricingActions";

// ============================================
// AFFILIATE AUDIT (affiliateAuditActions.ts)
// ============================================

export {
  // Types
  type AuditConfigInput,
  type AffiliateAuditEntry,

  // Audit config management
  getAffiliateAuditConfigs,
  getAvailableAffiliatesForAudit,
  addAffiliateToAuditList,
  updateAffiliateAuditConfig,
  removeAffiliateFromAuditList,
  reactivateAffiliateAuditConfig,

  // Shift audit
  getAffiliatesForShiftAudit,
  getAffiliateAuditStats,
} from "../../affiliateAuditActions";

// ============================================
// NETWORK PARTNERS (networkActions.ts)
// ============================================

export {
  // Types
  type PartnerType,
  type CreatePartnerData,
  type UpdatePartnerData,

  // Partner queries
  getNetworkPartners,
  getPendingPartnerCounts,
  getAllNetworkContacts,

  // Partner mutations
  createNetworkPartner,
  updateNetworkPartner,
  approveNetworkPartner,
  rejectNetworkPartner,
  deleteNetworkPartner,
  togglePartnerActive,

  // Partner attachments
  getPartnerAttachments,
  uploadPartnerAttachment,
  deletePartnerAttachment,
} from "../../networkActions";

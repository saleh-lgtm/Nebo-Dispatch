/**
 * Affiliate Domain Actions
 *
 * This module exports all affiliate-related server actions:
 * - Affiliate management
 * - Affiliate pricing
 * - Network connections (partners)
 */

// Re-export affiliate actions
export * from "../../affiliateActions";

// Re-export affiliate pricing actions
export * from "../../affiliatePricingActions";

// Re-export network partner actions
// Note: networkActions has a CreateAttachmentData that conflicts with affiliateActions
// We re-export it with an alias for clarity
export {
    type PartnerType,
    type CreatePartnerData,
    type UpdatePartnerData,
    getNetworkPartners,
    getPendingPartnerCounts,
    createNetworkPartner,
    updateNetworkPartner,
    approveNetworkPartner,
    rejectNetworkPartner,
    deleteNetworkPartner,
    togglePartnerActive,
    getAllNetworkContacts,
    getPartnerAttachments,
    uploadPartnerAttachment,
    deletePartnerAttachment,
    type CreateQuickContactData,
    createQuickContact,
    getPartnerById,
    type CreateAttachmentData as PartnerAttachmentData,
} from "../../networkActions";

// Re-export affiliate-related actions from main actions.ts
export {
    submitAffiliate,
    getAffiliates,
} from "../../actions";

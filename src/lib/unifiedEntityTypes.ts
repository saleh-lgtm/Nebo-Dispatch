/**
 * Unified Entity Types
 *
 * This module defines types for the unified entity service that abstracts
 * Contact, Affiliate, and Quote client models into a single queryable interface.
 *
 * @see unifiedEntityService.ts for implementation
 */

// ============================================
// CORE ENTITY TYPES
// ============================================

/**
 * The type of entity in the unified system
 */
export type EntityType = "CONTACT" | "AFFILIATE" | "QUOTE_CLIENT";

/**
 * Affiliate sub-types for filtering
 */
export type AffiliateSubType =
  | "FARM_IN"
  | "FARM_OUT"
  | "IOS"
  | "HOUSE_CHAUFFEUR";

/**
 * Normalized approval status across all entity types
 * - Contact: Uses ApprovalStatus enum (PENDING/APPROVED/REJECTED)
 * - Affiliate: Uses boolean isApproved (mapped to PENDING/APPROVED)
 * - Quote: Always APPROVED (no approval workflow)
 */
export type UnifiedApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

// ============================================
// TAG TYPES
// ============================================

/**
 * Tag information (from ContactTag model)
 */
export interface EntityTag {
  id: string;
  name: string;
  color: string;
}

// ============================================
// SMS STATS
// ============================================

/**
 * SMS communication statistics for an entity
 */
export interface EntitySmsStats {
  /** Whether an SMSContact record exists for this entity's phone */
  hasContact: boolean;
  /** Timestamp of most recent message */
  lastMessageAt: Date | null;
  /** Preview of the last message content */
  lastMessagePreview: string | null;
  /** Count of unread inbound messages */
  unreadCount: number;
  /** Total message count (inbound + outbound) */
  totalMessages: number;
}

// ============================================
// ENTITY-SPECIFIC METADATA
// ============================================

/**
 * Metadata specific to Contact entities
 */
export interface ContactMetadata {
  type: "CONTACT";
  /** Business/organization name */
  company: string | null;
  /** ID of admin who approved */
  approvedById: string | null;
  /** Name of admin who approved */
  approvedByName: string | null;
  /** When the contact was approved */
  approvedAt: Date | null;
  /** Reason if rejected */
  rejectionReason: string | null;
}

/**
 * Metadata specific to Affiliate entities
 */
export interface AffiliateMetadata {
  type: "AFFILIATE";
  /** The affiliate sub-type */
  affiliateType: AffiliateSubType;
  /** Whether this is a contact-only entry (not a full partner) */
  isContactOnly: boolean;
  /** US state code */
  state: string | null;
  /** Cities served */
  cities: string[];
  /** Market/region (for IOS) */
  market: string | null;
  /** Whether affiliate has pricing entries */
  hasPricing: boolean;
  /** Whether affiliate has attachments */
  hasAttachments: boolean;
  /** City transfer rate info */
  cityTransferRate: string | null;
}

/**
 * Metadata specific to Quote client entities
 */
export interface QuoteMetadata {
  type: "QUOTE_CLIENT";
  /** The quote ID this client is from */
  quoteId: string;
  /** Current quote status */
  quoteStatus: string;
  /** Service date from quote */
  serviceDate: Date | null;
}

/**
 * Union of all metadata types
 */
export type EntityMetadata =
  | ContactMetadata
  | AffiliateMetadata
  | QuoteMetadata;

// ============================================
// UNIFIED ENTITY
// ============================================

/**
 * Unified entity that abstracts Contact, Affiliate, and Quote client models.
 *
 * This provides a single interface for querying and displaying contacts
 * from multiple data sources with consistent field names.
 */
export interface UnifiedEntity {
  /**
   * Composite ID in format `{entityType}:{sourceId}`
   * e.g., "CONTACT:clx123..." or "AFFILIATE:clx456..."
   */
  id: string;

  /** Original model's ID */
  sourceId: string;

  /** Which model this entity came from */
  entityType: EntityType;

  // ---- Common Fields (normalized) ----

  /** Display name */
  name: string;

  /** Email address */
  email: string | null;

  /** Phone number (may not be normalized) */
  phone: string | null;

  /** Notes/description */
  notes: string | null;

  /** Whether the entity is active (not soft-deleted) */
  isActive: boolean;

  /** Normalized approval status */
  approvalStatus: UnifiedApprovalStatus;

  // ---- Tags (Contact only, empty for others) ----

  /** Tags assigned to this entity */
  tags: EntityTag[];

  // ---- SMS Integration ----

  /** SMS statistics (null if no phone) */
  smsStats: EntitySmsStats | null;

  // ---- Type-specific data ----

  /** Entity-specific metadata based on entityType */
  metadata: EntityMetadata;

  // ---- Audit Fields ----

  /** When the entity was created */
  createdAt: Date;

  /** When the entity was last updated */
  updatedAt: Date;

  /** ID of user who created this entity */
  createdById: string;

  /** Name of user who created this entity */
  createdByName: string | null;
}

// ============================================
// QUERY OPTIONS
// ============================================

/**
 * Options for querying unified entities
 */
export interface UnifiedEntityQuery {
  /** Text search across name, email, phone, company */
  search?: string;

  /** Filter by entity types (default: ['CONTACT', 'AFFILIATE']) */
  entityTypes?: EntityType[];

  /** Filter affiliates by sub-type */
  affiliateSubTypes?: AffiliateSubType[];

  /** Filter contacts by tag IDs */
  tagIds?: string[];

  /** Filter by approval status */
  approvalStatus?: UnifiedApprovalStatus;

  /** Only include entities with phone numbers */
  hasPhone?: boolean;

  /** Only include entities with SMS history */
  hasSmsHistory?: boolean;

  /** Include contact-only affiliates (default: true) */
  includeContactOnly?: boolean;

  /** Maximum results to return (default: 50) */
  limit?: number;

  /** Offset for pagination (default: 0) */
  offset?: number;

  /** Field to sort by (default: 'name') */
  orderBy?: "name" | "lastMessage" | "createdAt" | "email";

  /** Sort direction (default: 'asc') */
  orderDir?: "asc" | "desc";
}

/**
 * Result of a unified entity query
 */
export interface UnifiedEntityResult {
  /** The entities matching the query */
  entities: UnifiedEntity[];

  /** Total count of matching entities (for pagination) */
  total: number;

  /** Whether there are more results beyond the limit */
  hasMore: boolean;
}

// ============================================
// CREATE/UPDATE TYPES
// ============================================

/**
 * Data for creating a unified entity
 */
export interface CreateUnifiedEntityData {
  /** Which type of entity to create */
  entityType: EntityType;

  /** Display name (required) */
  name: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Notes/description */
  notes?: string;

  // ---- Contact-specific fields ----

  /** Company name (Contact only) */
  company?: string;

  /** Tag IDs to assign (Contact only) */
  tagIds?: string[];

  // ---- Affiliate-specific fields ----

  /** Affiliate type (Affiliate only, default: FARM_OUT) */
  affiliateType?: AffiliateSubType;

  /** Whether this is contact-only (Affiliate only, default: true) */
  isContactOnly?: boolean;

  /** US state code (Affiliate only) */
  state?: string;

  /** Cities served (Affiliate only) */
  cities?: string[];
}

/**
 * Data for updating a unified entity
 */
export interface UpdateUnifiedEntityData {
  /** Display name */
  name?: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Notes/description */
  notes?: string;

  // ---- Contact-specific fields ----

  /** Company name (Contact only) */
  company?: string;

  // ---- Affiliate-specific fields ----

  /** US state code (Affiliate only) */
  state?: string;

  /** Cities served (Affiliate only) */
  cities?: string[];

  /** City transfer rate (Affiliate only) */
  cityTransferRate?: string;
}

// ============================================
// STATS TYPES
// ============================================

/**
 * Statistics about unified entities
 */
export interface UnifiedEntityStats {
  /** Total contacts (Contact model) */
  totalContacts: number;

  /** Pending contacts awaiting approval */
  pendingContacts: number;

  /** Total affiliates (Affiliate model) */
  totalAffiliates: number;

  /** Contact-only affiliates */
  contactOnlyAffiliates: number;

  /** Pending affiliates */
  pendingAffiliates: number;

  /** Affiliates by type */
  affiliatesByType: {
    FARM_IN: number;
    FARM_OUT: number;
    IOS: number;
    HOUSE_CHAUFFEUR: number;
  };

  /** Entities with phone numbers */
  withPhone: number;

  /** Entities with SMS history */
  withSmsHistory: number;
}

// ============================================
// BLAST SMS TYPES
// ============================================

/**
 * Recipient for blast SMS
 */
export interface BlastSmsRecipient {
  /** Composite entity ID */
  id: string;

  /** Entity type */
  entityType: EntityType;

  /** Display name */
  name: string;

  /** Phone number (normalized) */
  phone: string;
}

/**
 * Result of blast SMS preview
 */
export interface BlastSmsPreview {
  /** Recipients that would receive the SMS */
  recipients: BlastSmsRecipient[];

  /** Total recipient count */
  totalCount: number;

  /** Warning messages (e.g., invalid phones) */
  warnings: string[];
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for Contact metadata
 */
export function isContactMetadata(
  metadata: EntityMetadata
): metadata is ContactMetadata {
  return metadata.type === "CONTACT";
}

/**
 * Type guard for Affiliate metadata
 */
export function isAffiliateMetadata(
  metadata: EntityMetadata
): metadata is AffiliateMetadata {
  return metadata.type === "AFFILIATE";
}

/**
 * Type guard for Quote metadata
 */
export function isQuoteMetadata(
  metadata: EntityMetadata
): metadata is QuoteMetadata {
  return metadata.type === "QUOTE_CLIENT";
}

/**
 * Parse a composite entity ID
 */
export function parseEntityId(compositeId: string): {
  entityType: EntityType;
  sourceId: string;
} {
  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];
  if (!entityType || !sourceId) {
    throw new Error(`Invalid composite entity ID: ${compositeId}`);
  }
  return { entityType, sourceId };
}

/**
 * Create a composite entity ID
 */
export function createEntityId(entityType: EntityType, sourceId: string): string {
  return `${entityType}:${sourceId}`;
}

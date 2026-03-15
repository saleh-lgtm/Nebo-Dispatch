"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/auditActions";
import { normalizePhoneNumber } from "@/lib/communicationsSync";
import type {
  UnifiedEntity,
  UnifiedEntityQuery,
  UnifiedEntityResult,
  UnifiedEntityStats,
  CreateUnifiedEntityData,
  UpdateUnifiedEntityData,
  BlastSmsRecipient,
  BlastSmsPreview,
  EntityType,
  EntityTag,
  EntitySmsStats,
} from "./unifiedEntityTypes";

// ============================================
// AUTH HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
  return session;
}

// ============================================
// UNIFIED ENTITY QUERIES
// ============================================

/**
 * Get unified entities from Contact, Affiliate, and optionally Quote models.
 *
 * Uses CTE-based queries for efficiency following the pattern in communicationsSync.ts.
 * This replaces N+1 patterns with a single optimized query.
 *
 * @param query - Query options for filtering, pagination, and sorting
 * @returns Paginated result with entities and total count
 */
export async function getUnifiedEntities(
  query: UnifiedEntityQuery = {}
): Promise<UnifiedEntityResult> {
  await requireAuth();

  const {
    search,
    entityTypes = ["CONTACT", "AFFILIATE"],
    affiliateSubTypes,
    tagIds,
    approvalStatus,
    hasPhone,
    // hasSmsHistory - TODO: implement SMS history filter in query
    includeContactOnly = true,
    limit = 50,
    offset = 0,
    orderBy = "name",
    orderDir = "asc",
  } = query;

  const includeContacts = entityTypes.includes("CONTACT");
  const includeAffiliates = entityTypes.includes("AFFILIATE");

  // Build search condition
  const searchCondition = search
    ? `(name ILIKE '%${search.replace(/'/g, "''")}%' OR email ILIKE '%${search.replace(/'/g, "''")}%' OR phone ILIKE '%${search.replace(/'/g, "''")}%')`
    : "TRUE";

  // Build the unified query using CTEs
  const sql = `
    WITH
    -- SMS stats for all phone numbers
    sms_stats AS (
      SELECT
        sc."phoneNumber",
        sc."affiliateId",
        COUNT(sl.id) as "totalMessages",
        COUNT(CASE WHEN sl.direction = 'INBOUND' AND sl.status != 'read' THEN 1 END) as "unreadCount",
        MAX(sl."createdAt") as "lastMessageAt"
      FROM "SMSContact" sc
      LEFT JOIN "SMSLog" sl ON sl."conversationPhone" = sc."phoneNumber"
      GROUP BY sc.id, sc."phoneNumber", sc."affiliateId"
    ),

    -- Last message preview
    last_messages AS (
      SELECT DISTINCT ON ("conversationPhone")
        "conversationPhone",
        message as "lastMessage"
      FROM "SMSLog"
      ORDER BY "conversationPhone", "createdAt" DESC
    )

    ${includeContacts ? `
    -- Contacts with their tags
    SELECT
      'CONTACT:' || c.id as id,
      c.id as "sourceId",
      'CONTACT' as "entityType",
      c.name,
      c.email,
      c.phone,
      c.notes,
      c."isActive",
      c."approvalStatus"::text as "approvalStatus",
      COALESCE(
        (
          SELECT json_agg(json_build_object('id', ct.id, 'name', ct.name, 'color', ct.color))
          FROM "ContactTagAssignment" cta
          JOIN "ContactTag" ct ON ct.id = cta."tagId"
          WHERE cta."contactId" = c.id
        ),
        '[]'::json
      ) as tags,
      CASE
        WHEN ss."phoneNumber" IS NOT NULL THEN json_build_object(
          'hasContact', true,
          'lastMessageAt', ss."lastMessageAt",
          'lastMessagePreview', lm."lastMessage",
          'unreadCount', COALESCE(ss."unreadCount", 0),
          'totalMessages', COALESCE(ss."totalMessages", 0)
        )
        ELSE NULL
      END as "smsStats",
      json_build_object(
        'type', 'CONTACT',
        'company', c.company,
        'approvedById', c."approvedById",
        'approvedByName', approver.name,
        'approvedAt', c."approvedAt",
        'rejectionReason', c."rejectionReason"
      ) as metadata,
      c."createdAt",
      c."updatedAt",
      c."createdById",
      creator.name as "createdByName"
    FROM "Contact" c
    LEFT JOIN "User" creator ON creator.id = c."createdById"
    LEFT JOIN "User" approver ON approver.id = c."approvedById"
    LEFT JOIN sms_stats ss ON ss."phoneNumber" = c.phone
    LEFT JOIN last_messages lm ON lm."conversationPhone" = c.phone
    WHERE c."isActive" = true
      ${approvalStatus ? `AND c."approvalStatus" = '${approvalStatus}'` : ""}
      ${tagIds?.length ? `AND EXISTS (SELECT 1 FROM "ContactTagAssignment" cta WHERE cta."contactId" = c.id AND cta."tagId" IN (${tagIds.map((id) => `'${id}'`).join(",")}))` : ""}
      ${hasPhone ? `AND c.phone IS NOT NULL` : ""}
      AND ${searchCondition}
    ` : "SELECT NULL WHERE FALSE"}

    ${includeContacts && includeAffiliates ? "UNION ALL" : ""}

    ${includeAffiliates ? `
    -- Affiliates (including isContactOnly)
    SELECT
      'AFFILIATE:' || a.id as id,
      a.id as "sourceId",
      'AFFILIATE' as "entityType",
      a.name,
      a.email,
      a.phone,
      a.notes,
      a."isActive",
      CASE WHEN a."isApproved" THEN 'APPROVED' ELSE 'PENDING' END as "approvalStatus",
      '[]'::json as tags,
      CASE
        WHEN ss."phoneNumber" IS NOT NULL THEN json_build_object(
          'hasContact', true,
          'lastMessageAt', ss."lastMessageAt",
          'lastMessagePreview', lm."lastMessage",
          'unreadCount', COALESCE(ss."unreadCount", 0),
          'totalMessages', COALESCE(ss."totalMessages", 0)
        )
        ELSE NULL
      END as "smsStats",
      json_build_object(
        'type', 'AFFILIATE',
        'affiliateType', a.type,
        'isContactOnly', a."isContactOnly",
        'state', a.state,
        'cities', a.cities,
        'market', a.market,
        'hasPricing', EXISTS(SELECT 1 FROM "AffiliatePricing" ap WHERE ap."affiliateId" = a.id),
        'hasAttachments', EXISTS(SELECT 1 FROM "AffiliateAttachment" aa WHERE aa."affiliateId" = a.id),
        'cityTransferRate', a."cityTransferRate"
      ) as metadata,
      a."createdAt",
      a."updatedAt",
      a."submittedById" as "createdById",
      creator.name as "createdByName"
    FROM "Affiliate" a
    LEFT JOIN "User" creator ON creator.id = a."submittedById"
    LEFT JOIN sms_stats ss ON ss."affiliateId" = a.id
    LEFT JOIN last_messages lm ON lm."conversationPhone" = a.phone
    WHERE a."isActive" = true
      ${approvalStatus === "APPROVED" ? `AND a."isApproved" = true` : ""}
      ${approvalStatus === "PENDING" ? `AND a."isApproved" = false` : ""}
      ${affiliateSubTypes?.length ? `AND a.type IN (${affiliateSubTypes.map((t) => `'${t}'`).join(",")})` : ""}
      ${!includeContactOnly ? `AND a."isContactOnly" = false` : ""}
      ${hasPhone ? `AND a.phone IS NOT NULL` : ""}
      AND ${searchCondition}
    ` : ""}

    ORDER BY ${orderBy === "lastMessage" ? `"smsStats"->>'lastMessageAt'` : `"${orderBy}"`} ${orderDir} NULLS LAST
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<UnifiedEntity[]>(sql);

    const hasMore = results.length > limit;
    const entities = hasMore ? results.slice(0, limit) : results;

    // Get total count
    const countSql = `
      SELECT (
        ${includeContacts ? `(SELECT COUNT(*) FROM "Contact" WHERE "isActive" = true ${approvalStatus ? `AND "approvalStatus" = '${approvalStatus}'` : ""})` : "0"}
        +
        ${includeAffiliates ? `(SELECT COUNT(*) FROM "Affiliate" WHERE "isActive" = true ${approvalStatus === "APPROVED" ? `AND "isApproved" = true` : approvalStatus === "PENDING" ? `AND "isApproved" = false` : ""} ${!includeContactOnly ? `AND "isContactOnly" = false` : ""})` : "0"}
      ) as total
    `;

    const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countSql);

    return {
      entities,
      total: Number(countResult[0].total),
      hasMore,
    };
  } catch (error) {
    console.error("getUnifiedEntities error:", error);
    throw new Error("Failed to fetch unified entities");
  }
}

/**
 * Get a single unified entity by composite ID
 *
 * @param compositeId - Composite ID in format `{entityType}:{sourceId}`
 * @returns The entity or null if not found
 */
export async function getUnifiedEntity(
  compositeId: string
): Promise<UnifiedEntity | null> {
  await requireAuth();

  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];

  if (!entityType || !sourceId) {
    throw new Error(`Invalid composite entity ID: ${compositeId}`);
  }

  if (entityType === "CONTACT") {
    const contact = await prisma.contact.findUnique({
      where: { id: sourceId },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!contact) return null;

    // Get SMS stats
    const smsStats = contact.phone
      ? await getSmsStatsForPhone(contact.phone)
      : null;

    return {
      id: compositeId,
      sourceId: contact.id,
      entityType: "CONTACT",
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      notes: contact.notes,
      isActive: contact.isActive,
      approvalStatus: contact.approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
      tags: contact.tags.map((t) => ({
        id: t.tag.id,
        name: t.tag.name,
        color: t.tag.color,
      })),
      smsStats,
      metadata: {
        type: "CONTACT",
        company: contact.company,
        approvedById: contact.approvedById,
        approvedByName: contact.approvedBy?.name || null,
        approvedAt: contact.approvedAt,
        rejectionReason: contact.rejectionReason,
      },
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      createdById: contact.createdById,
      createdByName: contact.createdBy?.name || null,
    };
  }

  if (entityType === "AFFILIATE") {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: sourceId },
      include: {
        submittedBy: { select: { id: true, name: true } },
        pricingGrid: { select: { id: true } },
        attachments: { select: { id: true } },
      },
    });

    if (!affiliate) return null;

    // Get SMS stats
    const smsStats = affiliate.phone
      ? await getSmsStatsForPhone(affiliate.phone)
      : null;

    return {
      id: compositeId,
      sourceId: affiliate.id,
      entityType: "AFFILIATE",
      name: affiliate.name,
      email: affiliate.email,
      phone: affiliate.phone,
      notes: affiliate.notes,
      isActive: affiliate.isActive,
      approvalStatus: affiliate.isApproved ? "APPROVED" : "PENDING",
      tags: [],
      smsStats,
      metadata: {
        type: "AFFILIATE",
        affiliateType: affiliate.type as "FARM_IN" | "FARM_OUT" | "IOS" | "HOUSE_CHAUFFEUR",
        isContactOnly: affiliate.isContactOnly,
        state: affiliate.state,
        cities: affiliate.cities,
        market: affiliate.market,
        hasPricing: affiliate.pricingGrid.length > 0,
        hasAttachments: affiliate.attachments.length > 0,
        cityTransferRate: affiliate.cityTransferRate,
      },
      createdAt: affiliate.createdAt,
      updatedAt: affiliate.updatedAt,
      createdById: affiliate.submittedById,
      createdByName: affiliate.submittedBy?.name || null,
    };
  }

  return null;
}

/**
 * Helper to get SMS stats for a phone number
 */
async function getSmsStatsForPhone(phone: string): Promise<EntitySmsStats | null> {
  const normalizedPhone = normalizePhoneNumber(phone);

  const smsContact = await prisma.sMSContact.findUnique({
    where: { phoneNumber: normalizedPhone },
  });

  if (!smsContact) {
    return {
      hasContact: false,
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: 0,
      totalMessages: 0,
    };
  }

  const [stats, lastMessage, unreadCount] = await Promise.all([
    prisma.sMSLog.aggregate({
      where: { conversationPhone: normalizedPhone },
      _count: true,
      _max: { createdAt: true },
    }),
    prisma.sMSLog.findFirst({
      where: { conversationPhone: normalizedPhone },
      orderBy: { createdAt: "desc" },
      select: { message: true },
    }),
    prisma.sMSLog.count({
      where: {
        conversationPhone: normalizedPhone,
        direction: "INBOUND",
        status: { not: "read" },
      },
    }),
  ]);

  return {
    hasContact: true,
    lastMessageAt: stats._max.createdAt,
    lastMessagePreview: lastMessage?.message || null,
    unreadCount,
    totalMessages: stats._count,
  };
}

// ============================================
// CREATE / UPDATE / DELETE
// ============================================

/**
 * Create a unified entity (routes to appropriate model based on entityType)
 *
 * @param data - Entity data including entityType
 * @returns The created entity
 */
export async function createUnifiedEntity(
  data: CreateUnifiedEntityData
): Promise<UnifiedEntity> {
  const session = await requireAuth();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");

  if (data.entityType === "CONTACT") {
    const contact = await prisma.contact.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        company: data.company || null,
        approvalStatus: isAdmin ? "APPROVED" : "PENDING",
        approvedById: isAdmin ? session.user.id : null,
        approvedAt: isAdmin ? new Date() : null,
        createdById: session.user.id,
        tags: data.tagIds?.length
          ? {
              create: data.tagIds.map((tagId) => ({
                tagId,
                assignedById: session.user.id,
              })),
            }
          : undefined,
      },
    });

    // Auto-create SMS contact if phone provided
    if (data.phone) {
      const normalizedPhone = normalizePhoneNumber(data.phone);
      await prisma.sMSContact.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
          phoneNumber: normalizedPhone,
          name: data.name,
        },
        update: { name: data.name },
      });
    }

    await createAuditLog(session.user.id, "CREATE", "Contact", contact.id, {
      name: data.name,
      company: data.company,
      status: isAdmin ? "APPROVED" : "PENDING",
    });

    revalidatePath("/dispatcher/directory");
    revalidatePath("/admin/contacts");

    return (await getUnifiedEntity(`CONTACT:${contact.id}`))!;
  }

  if (data.entityType === "AFFILIATE") {
    const affiliate = await prisma.affiliate.create({
      data: {
        name: data.name,
        email: data.email || `${Date.now()}@placeholder.local`,
        phone: data.phone || null,
        notes: data.notes || null,
        type: data.affiliateType || "FARM_OUT",
        isContactOnly: data.isContactOnly ?? true,
        isApproved: true, // Contact-only affiliates are auto-approved
        isActive: true,
        state: data.state || null,
        cities: data.cities || [],
        submittedById: session.user.id,
      },
    });

    // Auto-create SMS contact if phone provided
    if (data.phone) {
      const normalizedPhone = normalizePhoneNumber(data.phone);
      await prisma.sMSContact.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
          phoneNumber: normalizedPhone,
          affiliateId: affiliate.id,
          name: data.name,
        },
        update: {
          affiliateId: affiliate.id,
          name: data.name,
        },
      });
    }

    await createAuditLog(session.user.id, "CREATE", "Affiliate", affiliate.id, {
      name: data.name,
      type: data.affiliateType || "FARM_OUT",
      isContactOnly: data.isContactOnly ?? true,
    });

    revalidatePath("/network");

    return (await getUnifiedEntity(`AFFILIATE:${affiliate.id}`))!;
  }

  throw new Error(`Cannot create entity of type: ${data.entityType}`);
}

/**
 * Update a unified entity
 *
 * @param compositeId - Composite ID in format `{entityType}:{sourceId}`
 * @param data - Fields to update
 * @returns The updated entity
 */
export async function updateUnifiedEntity(
  compositeId: string,
  data: UpdateUnifiedEntityData
): Promise<UnifiedEntity> {
  const session = await requireAuth();
  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];

  if (entityType === "CONTACT") {
    const contact = await prisma.contact.findUnique({ where: { id: sourceId } });
    if (!contact) throw new Error("Contact not found");

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    const isOwner = contact.createdById === session.user.id;

    if (!isAdmin && !isOwner) {
      throw new Error("Not authorized to update this contact");
    }

    await prisma.contact.update({
      where: { id: sourceId },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        company: data.company,
      },
    });

    await createAuditLog(session.user.id, "UPDATE", "Contact", sourceId, { ...data });
    revalidatePath("/dispatcher/directory");
    revalidatePath("/admin/contacts");

    return (await getUnifiedEntity(compositeId))!;
  }

  if (entityType === "AFFILIATE") {
    await requireAdmin();

    await prisma.affiliate.update({
      where: { id: sourceId },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        state: data.state,
        cities: data.cities,
        cityTransferRate: data.cityTransferRate,
      },
    });

    await createAuditLog(session.user.id, "UPDATE", "Affiliate", sourceId, { ...data });
    revalidatePath("/network");

    return (await getUnifiedEntity(compositeId))!;
  }

  throw new Error(`Cannot update entity of type: ${entityType}`);
}

/**
 * Delete a unified entity (soft delete for contacts, respects existing patterns)
 *
 * @param compositeId - Composite ID in format `{entityType}:{sourceId}`
 */
export async function deleteUnifiedEntity(compositeId: string): Promise<void> {
  const session = await requireAuth();
  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];

  if (entityType === "CONTACT") {
    const contact = await prisma.contact.findUnique({ where: { id: sourceId } });
    if (!contact) throw new Error("Contact not found");

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    const isOwner = contact.createdById === session.user.id;

    if (!isAdmin && !isOwner) {
      throw new Error("Not authorized to delete this contact");
    }

    // Soft delete
    await prisma.contact.update({
      where: { id: sourceId },
      data: { isActive: false },
    });

    await createAuditLog(session.user.id, "DELETE", "Contact", sourceId, {
      name: contact.name,
    });

    revalidatePath("/dispatcher/directory");
    revalidatePath("/admin/contacts");
    return;
  }

  if (entityType === "AFFILIATE") {
    await requireAdmin();

    const affiliate = await prisma.affiliate.findUnique({ where: { id: sourceId } });
    if (!affiliate) throw new Error("Affiliate not found");

    // Soft delete (consistent with Contact)
    await prisma.affiliate.update({
      where: { id: sourceId },
      data: { isActive: false },
    });

    await createAuditLog(session.user.id, "DELETE", "Affiliate", sourceId, {
      name: affiliate.name,
    });

    revalidatePath("/network");
    return;
  }

  throw new Error(`Cannot delete entity of type: ${entityType}`);
}

// ============================================
// APPROVAL ACTIONS
// ============================================

/**
 * Approve a unified entity
 */
export async function approveUnifiedEntity(compositeId: string): Promise<UnifiedEntity> {
  const session = await requireAdmin();
  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];

  if (entityType === "CONTACT") {
    const contact = await prisma.contact.update({
      where: { id: sourceId },
      data: {
        approvalStatus: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });

    await createAuditLog(session.user.id, "UPDATE", "Contact", sourceId, {
      action: "APPROVED",
      name: contact.name,
    });

    revalidatePath("/dispatcher/directory");
    revalidatePath("/admin/contacts");

    return (await getUnifiedEntity(compositeId))!;
  }

  if (entityType === "AFFILIATE") {
    const affiliate = await prisma.affiliate.update({
      where: { id: sourceId },
      data: { isApproved: true },
    });

    await createAuditLog(session.user.id, "APPROVE", "Affiliate", sourceId, {
      name: affiliate.name,
    });

    revalidatePath("/network");

    return (await getUnifiedEntity(compositeId))!;
  }

  throw new Error(`Cannot approve entity of type: ${entityType}`);
}

/**
 * Reject a unified entity
 */
export async function rejectUnifiedEntity(
  compositeId: string,
  reason?: string
): Promise<void> {
  const session = await requireAdmin();
  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];

  if (entityType === "CONTACT") {
    const contact = await prisma.contact.update({
      where: { id: sourceId },
      data: {
        approvalStatus: "REJECTED",
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason: reason || null,
      },
    });

    await createAuditLog(session.user.id, "UPDATE", "Contact", sourceId, {
      action: "REJECTED",
      name: contact.name,
      reason,
    });

    revalidatePath("/dispatcher/directory");
    revalidatePath("/admin/contacts");
    return;
  }

  if (entityType === "AFFILIATE") {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: sourceId },
      select: { name: true },
    });

    // Hard delete for affiliates (existing pattern)
    await prisma.affiliate.delete({ where: { id: sourceId } });

    await createAuditLog(session.user.id, "REJECT", "Affiliate", sourceId, {
      name: affiliate?.name,
      reason,
    });

    revalidatePath("/network");
    return;
  }

  throw new Error(`Cannot reject entity of type: ${entityType}`);
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get statistics about unified entities
 */
export async function getUnifiedEntityStats(): Promise<UnifiedEntityStats> {
  await requireAuth();

  const [
    totalContacts,
    pendingContacts,
    totalAffiliates,
    contactOnlyAffiliates,
    pendingAffiliates,
    farmIn,
    farmOut,
    ios,
    houseChauffeur,
    withPhone,
    withSmsHistory,
  ] = await Promise.all([
    prisma.contact.count({ where: { isActive: true } }),
    prisma.contact.count({ where: { isActive: true, approvalStatus: "PENDING" } }),
    prisma.affiliate.count({ where: { isActive: true } }),
    prisma.affiliate.count({ where: { isActive: true, isContactOnly: true } }),
    prisma.affiliate.count({ where: { isActive: true, isApproved: false } }),
    prisma.affiliate.count({ where: { isActive: true, type: "FARM_IN" } }),
    prisma.affiliate.count({ where: { isActive: true, type: "FARM_OUT" } }),
    prisma.affiliate.count({ where: { isActive: true, type: "IOS" } }),
    prisma.affiliate.count({ where: { isActive: true, type: "HOUSE_CHAUFFEUR" } }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM (
        SELECT id FROM "Contact" WHERE "isActive" = true AND phone IS NOT NULL
        UNION ALL
        SELECT id FROM "Affiliate" WHERE "isActive" = true AND phone IS NOT NULL
      ) t
    `.then((r) => Number(r[0].count)),
    prisma.sMSContact.count({
      where: {
        OR: [{ affiliateId: { not: null } }],
      },
    }),
  ]);

  return {
    totalContacts,
    pendingContacts,
    totalAffiliates,
    contactOnlyAffiliates,
    pendingAffiliates,
    affiliatesByType: {
      FARM_IN: farmIn,
      FARM_OUT: farmOut,
      IOS: ios,
      HOUSE_CHAUFFEUR: houseChauffeur,
    },
    withPhone,
    withSmsHistory,
  };
}

// ============================================
// BLAST SMS SUPPORT
// ============================================

/**
 * Preview recipients for blast SMS (currently Contact model only, as it has tags)
 *
 * @param tagIds - Tag IDs to filter by
 * @returns Preview of recipients
 */
export async function previewBlastSmsRecipients(
  tagIds: string[]
): Promise<BlastSmsPreview> {
  await requireAdmin();

  if (!tagIds.length) {
    return { recipients: [], totalCount: 0, warnings: ["No tags selected"] };
  }

  // Get contacts with selected tags and valid phones
  const contacts = await prisma.contact.findMany({
    where: {
      isActive: true,
      approvalStatus: "APPROVED",
      phone: { not: null },
      tags: {
        some: { tagId: { in: tagIds } },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  const warnings: string[] = [];
  const recipients: BlastSmsRecipient[] = [];

  for (const contact of contacts) {
    if (!contact.phone) continue;

    try {
      const normalized = normalizePhoneNumber(contact.phone);
      recipients.push({
        id: `CONTACT:${contact.id}`,
        entityType: "CONTACT",
        name: contact.name,
        phone: normalized,
      });
    } catch {
      warnings.push(`Invalid phone for ${contact.name}: ${contact.phone}`);
    }
  }

  return {
    recipients,
    totalCount: recipients.length,
    warnings,
  };
}

/**
 * Get entities suitable for blast SMS (approved, active, has phone, has tags)
 *
 * @param tagIds - Tag IDs to filter by
 * @returns Array of recipients with normalized phone numbers
 */
export async function getEntitiesForBlastSms(
  tagIds: string[]
): Promise<BlastSmsRecipient[]> {
  const preview = await previewBlastSmsRecipients(tagIds);
  return preview.recipients;
}

// ============================================
// TAG MANAGEMENT (for unified interface)
// ============================================

/**
 * Get all available tags (from ContactTag model)
 */
export async function getEntityTags(): Promise<EntityTag[]> {
  await requireAuth();

  const tags = await prisma.contactTag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
    },
  });

  return tags;
}

/**
 * Assign tags to a unified entity (Contact only currently)
 */
export async function assignTagsToUnifiedEntity(
  compositeId: string,
  tagIds: string[]
): Promise<UnifiedEntity> {
  const session = await requireAdmin();
  const [entityType, sourceId] = compositeId.split(":") as [EntityType, string];

  if (entityType !== "CONTACT") {
    throw new Error("Tags can only be assigned to Contact entities");
  }

  // Remove existing assignments
  await prisma.contactTagAssignment.deleteMany({
    where: { contactId: sourceId },
  });

  // Create new assignments
  if (tagIds.length > 0) {
    await prisma.contactTagAssignment.createMany({
      data: tagIds.map((tagId) => ({
        contactId: sourceId,
        tagId,
        assignedById: session.user.id,
      })),
    });
  }

  await createAuditLog(session.user.id, "UPDATE", "Contact", sourceId, {
    action: "TAGS_UPDATED",
    tagIds,
  });

  revalidatePath("/admin/contacts");

  return (await getUnifiedEntity(compositeId))!;
}

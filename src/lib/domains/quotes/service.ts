/**
 * Quotes Domain Service
 *
 * Pure business logic for quote management.
 * Framework-agnostic and testable in isolation.
 */

import { QuoteStatus, QuoteOutcome, QuoteActionType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  CreateQuoteData,
  QuoteQueryOptions,
  QuoteStats,
  QuoteAnalytics,
  QuoteWithHistory,
  QuoteWithComputedFlag,
  DateRange,
} from "./types";
import {
  QUOTE_EXPIRATION_MS,
  DEFAULT_FOLLOWUP_MS,
  FLAG_THRESHOLD_MS,
  FOLLOWUP_ACTION_TYPES,
  ACTIVE_STATUSES,
} from "./constants";

// ============================================
// QUOTE QUERIES
// ============================================

/**
 * Get quotes with filters
 */
export async function queryQuotes(options: QuoteQueryOptions = {}) {
  return prisma.quote.findMany({
    where: {
      status: options.status ? { in: options.status } : undefined,
      assignedToId: options.assignedToId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      actions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { nextFollowUp: "asc" },
      { createdAt: "desc" },
    ],
    take: options.limit,
  });
}

/**
 * Get pending quotes with computed flag status
 */
export async function getPendingQuotes(): Promise<QuoteWithComputedFlag[]> {
  const twentyFourHoursAgo = new Date(Date.now() - FLAG_THRESHOLD_MS);

  const quotes = await prisma.quote.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      actions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { isFlagged: "desc" },
      { nextFollowUp: "asc" },
    ],
  });

  // Compute flags in-memory for display
  return quotes.map(quote => ({
    ...quote,
    isFlagged: quote.isFlagged || (quote.lastActionAt ? quote.lastActionAt < twentyFourHoursAgo : false),
  }));
}

/**
 * Get quotes for a specific shift
 */
export async function getShiftQuotes(shiftId: string) {
  return prisma.quote.findMany({
    where: { shiftId },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get a single quote with full action history
 */
export async function getQuoteWithHistory(quoteId: string): Promise<QuoteWithHistory | null> {
  return prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      actions: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ============================================
// QUOTE MUTATIONS
// ============================================

/**
 * Create a new quote
 */
export async function createQuote(
  data: CreateQuoteData,
  userId: string,
  shiftId?: string
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUOTE_EXPIRATION_MS);
  const nextFollowUp = new Date(now.getTime() + DEFAULT_FOLLOWUP_MS);

  return prisma.quote.create({
    data: {
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      serviceType: data.serviceType,
      source: data.source,
      dateOfService: data.dateOfService,
      pickupDate: data.pickupDate,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      estimatedAmount: data.estimatedAmount,
      notes: data.notes,
      createdById: userId,
      assignedToId: userId,
      nextFollowUp,
      expiresAt,
      lastActionAt: now,
      actionCount: 1,
      shiftId,
      actions: {
        create: {
          userId,
          actionType: "CREATED",
          notes: `Quote created for ${data.clientName}`,
        },
      },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Record an action on a quote
 */
export async function recordAction(
  quoteId: string,
  userId: string,
  actionType: QuoteActionType,
  notes?: string,
  metadata?: Record<string, unknown>
) {
  const now = new Date();
  const isFollowUp = FOLLOWUP_ACTION_TYPES.includes(actionType);

  const [quote, action] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        lastActionAt: now,
        actionCount: { increment: 1 },
        isFlagged: false,
        ...(isFollowUp
          ? {
              followUpCount: { increment: 1 },
              lastFollowUp: now,
              nextFollowUp: new Date(now.getTime() + DEFAULT_FOLLOWUP_MS),
              status: "FOLLOWING_UP",
            }
          : {}),
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId,
        actionType,
        notes,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { quote, action };
}

/**
 * Record a follow-up with custom next follow-up date
 */
export async function recordFollowUp(
  quoteId: string,
  userId: string,
  notes: string,
  actionType: QuoteActionType = "FOLLOW_UP",
  nextFollowUpDate?: Date
) {
  const now = new Date();

  const [quote] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        followUpCount: { increment: 1 },
        lastFollowUp: now,
        lastActionAt: now,
        actionCount: { increment: 1 },
        isFlagged: false,
        nextFollowUp: nextFollowUpDate || new Date(now.getTime() + DEFAULT_FOLLOWUP_MS),
        followUpNotes: notes,
        status: "FOLLOWING_UP",
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId,
        actionType,
        notes,
      },
    }),
  ]);

  return quote;
}

/**
 * Set quote outcome (won/lost)
 */
export async function setOutcome(
  quoteId: string,
  userId: string,
  outcome: QuoteOutcome,
  reason?: string
) {
  const now = new Date();
  const status: QuoteStatus = outcome === "WON" ? "CONVERTED" : "LOST";

  const [quote] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        outcome,
        outcomeReason: reason,
        outcomeAt: now,
        status,
        lastActionAt: now,
        actionCount: { increment: 1 },
        isFlagged: false,
        ...(outcome === "WON" ? { convertedAt: now } : {}),
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId,
        actionType: "OUTCOME_SET",
        notes: `Quote ${outcome === "WON" ? "won" : "lost"}${reason ? `: ${reason}` : ""}`,
        metadata: { outcome, reason },
      },
    }),
  ]);

  return quote;
}

/**
 * Convert quote to booking
 */
export async function convertQuote(
  quoteId: string,
  userId: string,
  reservationId?: string
) {
  const now = new Date();

  const [quote] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: "CONVERTED",
        outcome: "WON",
        outcomeAt: now,
        convertedAt: now,
        reservationId,
        lastActionAt: now,
        actionCount: { increment: 1 },
        isFlagged: false,
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId,
        actionType: "OUTCOME_SET",
        notes: `Quote converted to booking${reservationId ? ` (Reservation: ${reservationId})` : ""}`,
        metadata: { reservationId },
      },
    }),
  ]);

  return quote;
}

/**
 * Update quote status
 */
export async function updateStatus(
  quoteId: string,
  userId: string,
  status: QuoteStatus
) {
  const now = new Date();

  const [quote] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        status,
        lastActionAt: now,
        actionCount: { increment: 1 },
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId,
        actionType: "STATUS_CHANGE",
        notes: `Status changed to ${status}`,
        metadata: { newStatus: status },
      },
    }),
  ]);

  return quote;
}

/**
 * Assign quote to a user
 */
export async function assignQuote(
  quoteId: string,
  assignerId: string,
  assigneeId: string
) {
  const now = new Date();

  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { name: true },
  });

  const [quote] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        assignedToId: assigneeId,
        lastActionAt: now,
        actionCount: { increment: 1 },
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId: assignerId,
        actionType: "REASSIGNED",
        notes: `Quote reassigned to ${assignee?.name || assigneeId}`,
        metadata: { assignedTo: assigneeId },
      },
    }),
  ]);

  return quote;
}

/**
 * Add a note to a quote
 */
export async function addNote(
  quoteId: string,
  userId: string,
  notes: string
) {
  const now = new Date();

  const [quote, action] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        lastActionAt: now,
        actionCount: { increment: 1 },
        isFlagged: false,
      },
    }),
    prisma.quoteAction.create({
      data: {
        quoteId,
        userId,
        actionType: "NOTE_ADDED",
        notes,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { quote, action };
}

// ============================================
// STATS & ANALYTICS
// ============================================

/**
 * Get quote statistics for dashboard
 */
export async function getStats(): Promise<QuoteStats> {
  const now = new Date();

  const [pending, followingUp, converted, lost, expired, flagged, expiringSoon] = await Promise.all([
    prisma.quote.count({ where: { status: "PENDING" } }),
    prisma.quote.count({ where: { status: "FOLLOWING_UP" } }),
    prisma.quote.count({ where: { status: "CONVERTED" } }),
    prisma.quote.count({ where: { status: "LOST" } }),
    prisma.quote.count({ where: { status: "EXPIRED" } }),
    prisma.quote.count({ where: { isFlagged: true, status: { in: ACTIVE_STATUSES } } }),
    prisma.quote.count({
      where: {
        status: { in: ACTIVE_STATUSES },
        expiresAt: {
          gt: now,
          lt: new Date(now.getTime() + DEFAULT_FOLLOWUP_MS),
        },
      },
    }),
  ]);

  return { pending, followingUp, converted, lost, expired, flagged, expiringSoon };
}

/**
 * Get quote analytics for reporting
 */
export async function getAnalytics(dateRange?: DateRange): Promise<QuoteAnalytics> {
  const where = dateRange
    ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
    : {};

  const [totalQuotes, convertedQuotes, lostQuotes, avgActionsPerQuote] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.count({ where: { ...where, outcome: "WON" } }),
    prisma.quote.count({ where: { ...where, outcome: { not: "WON" } } }),
    prisma.quote.aggregate({
      where,
      _avg: { actionCount: true },
    }),
  ]);

  const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0;

  return {
    totalQuotes,
    convertedQuotes,
    lostQuotes,
    conversionRate: Math.round(conversionRate * 10) / 10,
    avgActionsPerQuote: Math.round((avgActionsPerQuote._avg.actionCount || 0) * 10) / 10,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get active shift for a user
 */
export async function getActiveShift(userId: string): Promise<string | undefined> {
  const activeShift = await prisma.shift.findFirst({
    where: {
      userId,
      clockOut: null,
    },
  });
  return activeShift?.id;
}

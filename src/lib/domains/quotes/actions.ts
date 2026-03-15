"use server";

/**
 * Quotes Domain Server Actions
 *
 * Thin wrapper around service layer that handles:
 * - Authentication/authorization
 * - Audit logging
 * - Cache revalidation
 */

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";
import { createAuditLog } from "@/lib/auditActions";
import { QuoteStatus, QuoteOutcome, QuoteActionType } from "@prisma/client";

import * as service from "./service";
import type { CreateQuoteData, QuoteQueryOptions, DateRange } from "./types";

// ============================================
// READ ACTIONS
// ============================================

/**
 * Get quotes with filters
 */
export async function getQuotes(options?: QuoteQueryOptions) {
  await requireAuth();
  return service.queryQuotes(options);
}

/**
 * Get pending/active quotes
 */
export async function getPendingQuotes() {
  await requireAuth();
  return service.getPendingQuotes();
}

/**
 * Get quotes for a specific shift
 */
export async function getShiftQuotes(shiftId: string) {
  await requireAuth();
  return service.getShiftQuotes(shiftId);
}

/**
 * Get a single quote with full history
 */
export async function getQuoteWithHistory(quoteId: string) {
  await requireAuth();
  return service.getQuoteWithHistory(quoteId);
}

/**
 * Get quote statistics
 */
export async function getQuoteStats() {
  await requireAuth();
  return service.getStats();
}

/**
 * Get quote analytics
 */
export async function getQuoteAnalytics(dateRange?: DateRange) {
  await requireAuth();
  return service.getAnalytics(dateRange);
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Create a new quote
 */
export async function createQuote(data: CreateQuoteData) {
  const session = await requireAuth();

  // Auto-detect active shift if not provided
  let shiftId = data.shiftId;
  if (!shiftId) {
    shiftId = await service.getActiveShift(session.user.id);
  }

  const quote = await service.createQuote(data, session.user.id, shiftId);

  await createAuditLog(
    session.user.id,
    "CREATE",
    "Quote",
    quote.id,
    { clientName: data.clientName, serviceType: data.serviceType, source: data.source, shiftId }
  );

  revalidatePath("/dashboard");
  return quote;
}

/**
 * Record an action on a quote
 */
export async function recordQuoteAction(
  quoteId: string,
  actionType: QuoteActionType,
  notes?: string,
  metadata?: Record<string, unknown>
) {
  const session = await requireAuth();

  const result = await service.recordAction(
    quoteId,
    session.user.id,
    actionType,
    notes,
    metadata
  );

  await createAuditLog(
    session.user.id,
    "FOLLOW_UP",
    "Quote",
    quoteId,
    { actionType, notes }
  );

  revalidatePath("/dashboard");
  return result;
}

/**
 * Record a follow-up
 */
export async function recordFollowUp(
  quoteId: string,
  notes: string,
  actionType: QuoteActionType = "FOLLOW_UP",
  nextFollowUpDate?: Date
) {
  const session = await requireAuth();

  const quote = await service.recordFollowUp(
    quoteId,
    session.user.id,
    notes,
    actionType,
    nextFollowUpDate
  );

  await createAuditLog(
    session.user.id,
    "FOLLOW_UP",
    "Quote",
    quoteId,
    { notes, followUpCount: quote.followUpCount, actionType }
  );

  revalidatePath("/dashboard");
  return quote;
}

/**
 * Set quote outcome (won/lost)
 */
export async function setQuoteOutcome(
  quoteId: string,
  outcome: QuoteOutcome,
  reason?: string
) {
  const session = await requireAuth();

  const quote = await service.setOutcome(
    quoteId,
    session.user.id,
    outcome,
    reason
  );

  await createAuditLog(
    session.user.id,
    outcome === "WON" ? "CONVERT" : "UPDATE_STATUS",
    "Quote",
    quoteId,
    { outcome, reason }
  );

  revalidatePath("/dashboard");
  return quote;
}

/**
 * Convert quote to booking
 */
export async function convertQuote(quoteId: string, reservationId?: string) {
  const session = await requireAuth();

  const quote = await service.convertQuote(
    quoteId,
    session.user.id,
    reservationId
  );

  await createAuditLog(
    session.user.id,
    "CONVERT",
    "Quote",
    quoteId,
    { reservationId }
  );

  revalidatePath("/dashboard");
  return quote;
}

/**
 * Update quote status
 */
export async function updateQuoteStatus(quoteId: string, status: QuoteStatus) {
  const session = await requireAuth();

  const quote = await service.updateStatus(
    quoteId,
    session.user.id,
    status
  );

  await createAuditLog(
    session.user.id,
    "UPDATE_STATUS",
    "Quote",
    quoteId,
    { status }
  );

  revalidatePath("/dashboard");
  return quote;
}

/**
 * Assign quote to a user (admin only)
 */
export async function assignQuote(quoteId: string, userId: string) {
  const session = await requireAuth();

  // SECURITY: Only admins can reassign quotes
  const allowedRoles = ["SUPER_ADMIN", "ADMIN"];
  if (!allowedRoles.includes(session.user.role || "")) {
    throw new Error("Unauthorized: Only administrators can reassign quotes");
  }

  const quote = await service.assignQuote(
    quoteId,
    session.user.id,
    userId
  );

  await createAuditLog(
    session.user.id,
    "ASSIGN",
    "Quote",
    quoteId,
    { assignedTo: userId }
  );

  revalidatePath("/dashboard");
  return quote;
}

/**
 * Add a note to a quote
 */
export async function addQuoteNote(quoteId: string, notes: string) {
  const session = await requireAuth();

  const result = await service.addNote(
    quoteId,
    session.user.id,
    notes
  );

  revalidatePath("/dashboard");
  return result;
}

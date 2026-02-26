"use server";

import prisma from "@/lib/prisma";
import { requireAccounting, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { AccountingFlagStatus, BillingReviewReason } from "@prisma/client";
import { createAuditLog } from "./auditActions";

// Human-readable labels for billing review reasons
export const BILLING_REVIEW_REASON_LABELS: Record<BillingReviewReason, string> = {
    EXTRA_WAITING_TIME: "Extra Waiting Time",
    EXTRA_STOPS: "Additional Stops",
    ROUTE_CHANGE: "Route Change",
    TOLL_FEES: "Toll Fees",
    PARKING_FEES: "Parking Fees",
    GRATUITY_ADJUSTMENT: "Gratuity Adjustment",
    PRICE_CORRECTION: "Price Correction",
    NO_SHOW_CHARGE: "No-Show Charge",
    CANCELLATION_FEE: "Cancellation Fee",
    DAMAGE_CHARGE: "Damage/Cleaning Charge",
    AFFILIATE_BILLING: "Affiliate Billing Issue",
    OTHER: "Other",
};

export interface CreateBillingReviewInput {
    tripNumber: string;
    passengerName?: string;
    tripDate?: Date;
    reason: BillingReviewReason;
    reasonOther?: string;
    amount?: number;
    notes?: string;
    shiftId?: string;
    shiftReportId?: string;
}

// Create a billing review request (dispatchers)
export async function createBillingReview(data: CreateBillingReviewInput) {
    const session = await requireAuth();

    // Validate: if reason is OTHER, reasonOther must be provided
    if (data.reason === "OTHER" && !data.reasonOther?.trim()) {
        throw new Error("Please provide a reason when selecting 'Other'");
    }

    const billingReview = await prisma.billingReview.create({
        data: {
            tripNumber: data.tripNumber.trim(),
            passengerName: data.passengerName?.trim() || null,
            tripDate: data.tripDate || null,
            reason: data.reason,
            reasonOther: data.reason === "OTHER" ? data.reasonOther?.trim() : null,
            amount: data.amount || null,
            notes: data.notes?.trim() || null,
            submittedById: session.user.id,
            shiftId: data.shiftId || null,
            shiftReportId: data.shiftReportId || null,
            status: "PENDING",
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "BillingReview",
        billingReview.id,
        {
            tripNumber: data.tripNumber,
            reason: data.reason,
            amount: data.amount,
        }
    );

    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    return billingReview;
}

// Create multiple billing reviews at once (for batch creation during shift report)
export async function createBillingReviews(
    reviews: CreateBillingReviewInput[],
    shiftId?: string,
    shiftReportId?: string
) {
    const session = await requireAuth();

    const createdReviews = await prisma.$transaction(
        reviews.map((review) =>
            prisma.billingReview.create({
                data: {
                    tripNumber: review.tripNumber.trim(),
                    passengerName: review.passengerName?.trim() || null,
                    tripDate: review.tripDate || null,
                    reason: review.reason,
                    reasonOther: review.reason === "OTHER" ? review.reasonOther?.trim() : null,
                    amount: review.amount || null,
                    notes: review.notes?.trim() || null,
                    submittedById: session.user.id,
                    shiftId: shiftId || review.shiftId || null,
                    shiftReportId: shiftReportId || review.shiftReportId || null,
                    status: "PENDING",
                },
            })
        )
    );

    // Log audit for batch creation
    await createAuditLog(
        session.user.id,
        "CREATE",
        "BillingReview",
        "batch",
        {
            count: reviews.length,
            tripNumbers: reviews.map((r) => r.tripNumber),
        }
    );

    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    return createdReviews;
}

// Get all billing reviews (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function getBillingReviews(options?: {
    status?: AccountingFlagStatus;
    limit?: number;
    offset?: number;
    submittedById?: string;
}) {
    await requireAccounting();

    const where: Record<string, unknown> = {};
    if (options?.status) {
        where.status = options.status;
    }
    if (options?.submittedById) {
        where.submittedById = options.submittedById;
    }

    const [reviews, total] = await Promise.all([
        prisma.billingReview.findMany({
            where,
            include: {
                submittedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true } },
                shift: { select: { clockIn: true, clockOut: true } },
            },
            orderBy: { createdAt: "desc" },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        }),
        prisma.billingReview.count({ where }),
    ]);

    return { reviews, total };
}

// Get pending billing reviews count for badge display
export async function getBillingReviewsCount() {
    await requireAccounting();

    const count = await prisma.billingReview.count({
        where: { status: "PENDING" },
    });

    return count;
}

// Get billing review by ID
export async function getBillingReviewById(id: string) {
    await requireAccounting();

    const review = await prisma.billingReview.findUnique({
        where: { id },
        include: {
            submittedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true } },
            shift: { select: { clockIn: true, clockOut: true, totalHours: true } },
            shiftReport: {
                select: {
                    id: true,
                    createdAt: true,
                    user: { select: { name: true } },
                },
            },
        },
    });

    return review;
}

// Start reviewing a billing review (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function startBillingReviewReview(reviewId: string) {
    const session = await requireAccounting();

    const review = await prisma.billingReview.update({
        where: { id: reviewId },
        data: {
            status: "IN_REVIEW",
            reviewedById: session.user.id,
        },
    });

    revalidatePath("/accounting");
    return review;
}

// Resolve a billing review (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function resolveBillingReview(
    reviewId: string,
    resolution: string,
    resolvedAmount?: number,
    accountingNotes?: string
) {
    const session = await requireAccounting();

    const review = await prisma.billingReview.update({
        where: { id: reviewId },
        data: {
            status: "RESOLVED",
            resolution,
            resolvedAmount: resolvedAmount || null,
            accountingNotes: accountingNotes || null,
            reviewedById: session.user.id,
            reviewedAt: new Date(),
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "BillingReview",
        reviewId,
        {
            action: "resolved",
            resolution,
            resolvedAmount,
        }
    );

    revalidatePath("/accounting");
    return review;
}

// Update accounting notes on a billing review
export async function updateBillingReviewNotes(reviewId: string, notes: string) {
    await requireAccounting();

    const review = await prisma.billingReview.update({
        where: { id: reviewId },
        data: { accountingNotes: notes },
    });

    revalidatePath("/accounting");
    return review;
}

// Get billing review statistics
export async function getBillingReviewStats() {
    await requireAccounting();

    const [pending, inReview, resolved, recentReviews, topReasons] = await Promise.all([
        prisma.billingReview.count({ where: { status: "PENDING" } }),
        prisma.billingReview.count({ where: { status: "IN_REVIEW" } }),
        prisma.billingReview.count({ where: { status: "RESOLVED" } }),
        prisma.billingReview.findMany({
            where: { status: "PENDING" },
            include: {
                submittedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
        prisma.billingReview.groupBy({
            by: ["reason"],
            _count: { reason: true },
            orderBy: { _count: { reason: "desc" } },
            take: 5,
        }),
    ]);

    return {
        pending,
        inReview,
        resolved,
        total: pending + inReview + resolved,
        recentReviews,
        topReasons: topReasons.map((r) => ({
            reason: r.reason,
            label: BILLING_REVIEW_REASON_LABELS[r.reason],
            count: r._count.reason,
        })),
    };
}

// Get billing reviews for a specific shift report
export async function getShiftReportBillingReviews(shiftReportId: string) {
    await requireAuth();

    const reviews = await prisma.billingReview.findMany({
        where: { shiftReportId },
        include: {
            submittedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return reviews;
}

// Get my submitted billing reviews (for dispatchers to see their own submissions)
export async function getMyBillingReviews(options?: {
    limit?: number;
    offset?: number;
}) {
    const session = await requireAuth();

    const [reviews, total] = await Promise.all([
        prisma.billingReview.findMany({
            where: { submittedById: session.user.id },
            include: {
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: options?.limit || 20,
            skip: options?.offset || 0,
        }),
        prisma.billingReview.count({
            where: { submittedById: session.user.id },
        }),
    ]);

    return { reviews, total };
}

// Delete a billing review (only if PENDING and by the submitter)
export async function deleteBillingReview(reviewId: string) {
    const session = await requireAuth();

    const review = await prisma.billingReview.findUnique({
        where: { id: reviewId },
    });

    if (!review) {
        throw new Error("Billing review not found");
    }

    if (review.submittedById !== session.user.id) {
        throw new Error("You can only delete your own billing reviews");
    }

    if (review.status !== "PENDING") {
        throw new Error("Can only delete pending billing reviews");
    }

    await prisma.billingReview.delete({
        where: { id: reviewId },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "BillingReview",
        reviewId,
        { tripNumber: review.tripNumber }
    );

    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    return { success: true };
}

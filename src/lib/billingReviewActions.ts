"use server";

import prisma from "@/lib/prisma";
import { requireAccounting, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { BillingReviewReason } from "@prisma/client";
import { createAuditLog } from "./auditActions";
import {
    createBillingReviewSchema,
    billingReviewOptionsSchema,
    resolveBillingReviewSchema,
    idParamSchema,
} from "./schemas";

// Human-readable labels for billing review reasons
const BILLING_REVIEW_REASON_LABELS: Record<BillingReviewReason, string> = {
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
    try {
        const session = await requireAuth();

        const parsed = createBillingReviewSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        // Validate: if reason is OTHER, reasonOther must be provided
        if (data.reason === "OTHER" && !data.reasonOther?.trim()) {
            return { success: false, error: "Please provide a reason when selecting 'Other'" };
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

        // Create linked billing task for accounting team
        const reasonLabel = BILLING_REVIEW_REASON_LABELS[data.reason] || data.reason;
        await prisma.billingTask.create({
            data: {
                title: `Billing Review: Trip #${data.tripNumber} — ${reasonLabel}`,
                description: data.notes || undefined,
                entityType: "BillingReview",
                entityId: billingReview.id,
                priority: "HIGH",
                createdById: session.user.id,
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
        return { success: true, data: billingReview };
    } catch (error) {
        console.error("Failed to create billing review:", error);
        return { success: false, error: "Failed to create billing review" };
    }
}

// Create multiple billing reviews at once (for batch creation during shift report)
export async function createBillingReviews(
    reviews: CreateBillingReviewInput[],
    shiftId?: string,
    shiftReportId?: string
) {
    try {
        const session = await requireAuth();

        // Validate each review
        for (const review of reviews) {
            const parsed = createBillingReviewSchema.safeParse(review);
            if (!parsed.success) {
                return { success: false, error: `Invalid review for trip ${review.tripNumber}: ${parsed.error.issues[0]?.message}` };
            }
        }

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

        // Create linked billing tasks for each review
        if (createdReviews.length > 0) {
            await prisma.billingTask.createMany({
                data: createdReviews.map((review, i) => {
                    const reasonLabel = BILLING_REVIEW_REASON_LABELS[reviews[i].reason] || reviews[i].reason;
                    return {
                        title: `Billing Review: Trip #${review.tripNumber} — ${reasonLabel}`,
                        description: reviews[i].notes?.trim() || undefined,
                        entityType: "BillingReview",
                        entityId: review.id,
                        priority: "HIGH",
                        createdById: session.user.id,
                    };
                }),
            });
        }

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
        return { success: true, data: createdReviews };
    } catch (error) {
        console.error("Failed to create billing reviews:", error);
        return { success: false, error: "Failed to create billing reviews" };
    }
}

// Get all billing reviews (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function getBillingReviews(options?: {
    status?: "PENDING" | "IN_REVIEW" | "RESOLVED";
    limit?: number;
    offset?: number;
    submittedById?: string;
}) {
    try {
        await requireAccounting();

        if (options) {
            const parsed = billingReviewOptionsSchema.safeParse(options);
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues[0]?.message || "Invalid options" };
            }
        }

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

        return { success: true, data: { reviews, total } };
    } catch (error) {
        console.error("Failed to get billing reviews:", error);
        return { success: false, error: "Failed to get billing reviews" };
    }
}

// Get pending billing reviews count for badge display
export async function getBillingReviewsCount() {
    try {
        await requireAccounting();

        const count = await prisma.billingReview.count({
            where: { status: "PENDING" },
        });

        return { success: true, data: count };
    } catch (error) {
        console.error("Failed to get billing reviews count:", error);
        return { success: false, error: "Failed to get billing reviews count" };
    }
}

// Get billing review by ID
export async function getBillingReviewById(id: string) {
    try {
        await requireAccounting();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid review ID" };
        }

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

        return { success: true, data: review };
    } catch (error) {
        console.error("Failed to get billing review:", error);
        return { success: false, error: "Failed to get billing review" };
    }
}

// Start reviewing a billing review (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function startBillingReviewReview(reviewId: string) {
    try {
        const session = await requireAccounting();

        const parsed = idParamSchema.safeParse({ id: reviewId });
        if (!parsed.success) {
            return { success: false, error: "Invalid review ID" };
        }

        const review = await prisma.billingReview.update({
            where: { id: reviewId },
            data: {
                status: "IN_REVIEW",
                reviewedById: session.user.id,
            },
        });

        revalidatePath("/accounting");
        return { success: true, data: review };
    } catch (error) {
        console.error("Failed to start billing review:", error);
        return { success: false, error: "Failed to start billing review" };
    }
}

// Resolve a billing review (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function resolveBillingReview(
    reviewId: string,
    resolution: string,
    resolvedAmount?: number,
    accountingNotes?: string
) {
    try {
        const session = await requireAccounting();

        const parsed = resolveBillingReviewSchema.safeParse({ reviewId, resolution, resolvedAmount, accountingNotes });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

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

        // Auto-complete the linked billing task
        await prisma.billingTask.updateMany({
            where: {
                entityType: "BillingReview",
                entityId: reviewId,
                status: { not: "COMPLETED" },
            },
            data: {
                status: "COMPLETED",
                resolvedById: session.user.id,
                resolvedAt: new Date(),
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
        return { success: true, data: review };
    } catch (error) {
        console.error("Failed to resolve billing review:", error);
        return { success: false, error: "Failed to resolve billing review" };
    }
}

// Update accounting notes on a billing review
export async function updateBillingReviewNotes(reviewId: string, notes: string) {
    try {
        await requireAccounting();

        const parsed = idParamSchema.safeParse({ id: reviewId });
        if (!parsed.success) {
            return { success: false, error: "Invalid review ID" };
        }

        const review = await prisma.billingReview.update({
            where: { id: reviewId },
            data: { accountingNotes: notes },
        });

        revalidatePath("/accounting");
        return { success: true, data: review };
    } catch (error) {
        console.error("Failed to update billing review notes:", error);
        return { success: false, error: "Failed to update billing review notes" };
    }
}

// Get billing review statistics
export async function getBillingReviewStats() {
    try {
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
            success: true,
            data: {
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
            },
        };
    } catch (error) {
        console.error("Failed to get billing review stats:", error);
        return { success: false, error: "Failed to get billing review stats" };
    }
}

// Get billing reviews for a specific shift report
export async function getShiftReportBillingReviews(shiftReportId: string) {
    try {
        await requireAuth();

        const parsed = idParamSchema.safeParse({ id: shiftReportId });
        if (!parsed.success) {
            return { success: false, error: "Invalid shift report ID" };
        }

        const reviews = await prisma.billingReview.findMany({
            where: { shiftReportId },
            include: {
                submittedBy: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: reviews };
    } catch (error) {
        console.error("Failed to get shift report billing reviews:", error);
        return { success: false, error: "Failed to get shift report billing reviews" };
    }
}

// Get my submitted billing reviews (for dispatchers to see their own submissions)
export async function getMyBillingReviews(options?: {
    limit?: number;
    offset?: number;
}) {
    try {
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

        return { success: true, data: { reviews, total } };
    } catch (error) {
        console.error("Failed to get my billing reviews:", error);
        return { success: false, error: "Failed to get my billing reviews" };
    }
}

// Delete a billing review (only if PENDING and by the submitter)
export async function deleteBillingReview(reviewId: string) {
    try {
        const session = await requireAuth();

        const parsed = idParamSchema.safeParse({ id: reviewId });
        if (!parsed.success) {
            return { success: false, error: "Invalid review ID" };
        }

        const review = await prisma.billingReview.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            return { success: false, error: "Billing review not found" };
        }

        if (review.submittedById !== session.user.id) {
            return { success: false, error: "You can only delete your own billing reviews" };
        }

        if (review.status !== "PENDING") {
            return { success: false, error: "Can only delete pending billing reviews" };
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
    } catch (error) {
        console.error("Failed to delete billing review:", error);
        return { success: false, error: "Failed to delete billing review" };
    }
}

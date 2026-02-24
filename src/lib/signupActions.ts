"use server";

import prisma from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/passwordPolicy";
import { logSecurityEvent, SECURITY_EVENTS } from "@/lib/securityAudit";

interface SignUpInput {
    name: string;
    email: string;
    password: string;
}

interface SignUpResult {
    success: boolean;
    error?: string;
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
    const { name, email, password } = input;

    // Validate input
    if (!name || name.trim().length < 2) {
        return { success: false, error: "Name must be at least 2 characters" };
    }

    if (!email || !email.includes("@")) {
        return { success: false, error: "Please enter a valid email address" };
    }

    // Validate password against policy
    const passwordValidation = validatePassword(password, { email, name });
    if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.errors[0] };
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            // Don't reveal that user exists - security best practice
            return { success: false, error: "Unable to create account. Please try a different email." };
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user with PENDING approval status
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: "DISPATCHER", // Default role
                isActive: true,
                approvalStatus: "PENDING",
            },
        });

        // Log the signup event
        await logSecurityEvent({
            userId: user.id,
            event: SECURITY_EVENTS.USER_CREATED,
            entity: "User",
            entityId: user.id,
            details: {
                method: "self_registration",
                email: normalizedEmail,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Sign up error:", error);
        return { success: false, error: "An error occurred. Please try again." };
    }
}

/**
 * Approve a pending user registration
 */
export async function approveUser(
    userId: string,
    approvedById: string,
    role?: "DISPATCHER" | "ADMIN" | "ACCOUNTING"
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        if (user.approvalStatus === "APPROVED") {
            return { success: false, error: "User is already approved" };
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                approvalStatus: "APPROVED",
                approvedById,
                approvedAt: new Date(),
                role: role || user.role,
            },
        });

        // Log the approval
        await logSecurityEvent({
            userId: approvedById,
            event: SECURITY_EVENTS.USER_UPDATED,
            entity: "User",
            entityId: userId,
            details: {
                action: "approval",
                newStatus: "APPROVED",
                assignedRole: role || user.role,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Approve user error:", error);
        return { success: false, error: "Failed to approve user" };
    }
}

/**
 * Reject a pending user registration
 */
export async function rejectUser(
    userId: string,
    rejectedById: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                approvalStatus: "REJECTED",
                approvedById: rejectedById,
                approvedAt: new Date(),
                rejectionReason: reason,
                isActive: false,
            },
        });

        // Log the rejection
        await logSecurityEvent({
            userId: rejectedById,
            event: SECURITY_EVENTS.USER_UPDATED,
            entity: "User",
            entityId: userId,
            details: {
                action: "rejection",
                newStatus: "REJECTED",
                reason,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Reject user error:", error);
        return { success: false, error: "Failed to reject user" };
    }
}

/**
 * Get all pending user registrations
 */
export async function getPendingUsers() {
    return prisma.user.findMany({
        where: {
            approvalStatus: "PENDING",
        },
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

/**
 * Get count of pending registrations
 */
export async function getPendingUserCount(): Promise<number> {
    return prisma.user.count({
        where: {
            approvalStatus: "PENDING",
        },
    });
}

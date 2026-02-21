"use server";

import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";

// Token expires in 1 hour
const TOKEN_EXPIRY_HOURS = 1;

interface RequestResetResult {
    success: boolean;
    message: string;
}

interface ValidateTokenResult {
    valid: boolean;
    email?: string;
    error?: string;
}

interface ResetPasswordResult {
    success: boolean;
    message: string;
}

/**
 * Request a password reset for the given email.
 * Always returns success message to prevent email enumeration attacks.
 */
export async function requestPasswordReset(email: string): Promise<RequestResetResult> {
    try {
        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Always return success to prevent email enumeration
        // but only create token if user exists
        if (user && user.isActive) {
            // Invalidate any existing tokens for this user
            await prisma.passwordResetToken.updateMany({
                where: {
                    userId: user.id,
                    usedAt: null,
                },
                data: {
                    usedAt: new Date(), // Mark as used to invalidate
                },
            });

            // Generate secure random token
            const token = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

            // Create new token
            await prisma.passwordResetToken.create({
                data: {
                    token,
                    userId: user.id,
                    expiresAt,
                },
            });

            // TODO: Send email with reset link
            // For now, log the token (remove in production)
            console.log(`[DEV] Password reset token for ${normalizedEmail}: ${token}`);
            console.log(`[DEV] Reset link: /reset-password?token=${token}`);

            // In production, you would send an email here:
            // await sendPasswordResetEmail(user.email, user.name, token);
        }

        return {
            success: true,
            message: "If an account exists with this email, you will receive a password reset link.",
        };
    } catch (error) {
        console.error("Password reset request error:", error);
        return {
            success: false,
            message: "An error occurred. Please try again later.",
        };
    }
}

/**
 * Validate a password reset token.
 */
export async function validateResetToken(token: string): Promise<ValidateTokenResult> {
    try {
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetToken) {
            return { valid: false, error: "Invalid reset link" };
        }

        if (resetToken.usedAt) {
            return { valid: false, error: "This reset link has already been used" };
        }

        if (resetToken.expiresAt < new Date()) {
            return { valid: false, error: "This reset link has expired" };
        }

        if (!resetToken.user.isActive) {
            return { valid: false, error: "Account is not active" };
        }

        return {
            valid: true,
            email: resetToken.user.email || undefined,
        };
    } catch (error) {
        console.error("Token validation error:", error);
        return { valid: false, error: "An error occurred" };
    }
}

/**
 * Reset password using a valid token.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
    try {
        // Validate password strength
        if (newPassword.length < 8) {
            return { success: false, message: "Password must be at least 8 characters" };
        }

        if (!/[A-Z]/.test(newPassword)) {
            return { success: false, message: "Password must contain at least one uppercase letter" };
        }

        if (!/[a-z]/.test(newPassword)) {
            return { success: false, message: "Password must contain at least one lowercase letter" };
        }

        if (!/[0-9]/.test(newPassword)) {
            return { success: false, message: "Password must contain at least one number" };
        }

        // Validate token
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            return { success: false, message: "Invalid or expired reset link" };
        }

        // Hash new password
        const hashedPassword = await hash(newPassword, 12);

        // Update password and mark token as used in a transaction
        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: {
                    password: hashedPassword,
                    loginAttempts: 0, // Reset failed login attempts
                    lockedUntil: null, // Unlock account if locked
                },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
            // Log the password reset
            prisma.auditLog.create({
                data: {
                    userId: resetToken.userId,
                    action: "PASSWORD_RESET",
                    entity: "User",
                    entityId: resetToken.userId,
                    details: { method: "email_token" },
                },
            }),
        ]);

        return {
            success: true,
            message: "Password has been reset successfully. You can now sign in.",
        };
    } catch (error) {
        console.error("Password reset error:", error);
        return {
            success: false,
            message: "An error occurred. Please try again later.",
        };
    }
}

/**
 * Clean up expired tokens (can be run as a cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.passwordResetToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { usedAt: { not: null } },
            ],
        },
    });
    return result.count;
}

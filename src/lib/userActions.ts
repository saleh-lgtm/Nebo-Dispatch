"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function changePassword(data: {
    currentPassword: string;
    newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requireAuth();

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    try {
        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, password: true },
        });

        if (!user || !user.password) {
            return { success: false, error: "User not found" };
        }

        // Verify current password
        const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
        if (!isValid) {
            return { success: false, error: "Current password is incorrect" };
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        await createAuditLog(
            session.user.id,
            "PASSWORD_CHANGE",
            "User",
            session.user.id
        );

        return { success: true };
    } catch (error) {
        console.error("Change password error:", error);
        return { success: false, error: "An error occurred. Please try again." };
    }
}

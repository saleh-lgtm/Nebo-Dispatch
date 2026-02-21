"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

export async function changePassword(data: {
    currentPassword: string;
    newPassword: string;
}) {
    const session = await requireAuth();

    // Get user with password
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, password: true },
    });

    if (!user || !user.password) {
        throw new Error("User not found");
    }

    // Verify current password
    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
        throw new Error("Current password is incorrect");
    }

    // Validate new password
    if (data.newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters");
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
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
}

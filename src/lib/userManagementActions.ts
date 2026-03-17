"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, requireAdmin, canModifyUser, canDeleteUser, canChangeUserRole } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import {
    createUserSchema,
    updateUserSchema,
    changeUserRoleSchema,
    adminResetPasswordSchema,
    idParamSchema,
} from "./schemas";

// Get all users (ADMIN/SUPER_ADMIN only)
export async function getAllUsers() {
    try {
        await requireAdmin();

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                createdBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: [
                { role: "asc" },
                { name: "asc" },
            ],
        });

        return { success: true, data: users };
    } catch (error) {
        console.error("Failed to get all users:", error);
        return { success: false, error: "Failed to get users" };
    }
}

// Get user by ID (ADMIN/SUPER_ADMIN only)
export async function getUserById(id: string) {
    try {
        await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid user ID" };
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                createdBy: {
                    select: { id: true, name: true },
                },
            },
        });

        return { success: true, data: user };
    } catch (error) {
        console.error("Failed to get user:", error);
        return { success: false, error: "Failed to get user" };
    }
}

// Create a new user (SUPER_ADMIN only)
export async function createUser(data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "DISPATCHER";
}) {
    try {
        const session = await requireSuperAdmin();

        const parsed = createUserSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existing) {
            return { success: false, error: "A user with this email already exists" };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);

        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role,
                createdById: session.user.id,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "User",
            user.id,
            { name: data.name, email: data.email, role: data.role }
        );

        revalidatePath("/admin/users");
        return { success: true, data: user };
    } catch (error) {
        console.error("Failed to create user:", error);
        return { success: false, error: "Failed to create user" };
    }
}

// Update user details (SUPER_ADMIN only, with restrictions)
export async function updateUser(
    id: string,
    data: {
        name?: string;
        email?: string;
        isActive?: boolean;
    }
) {
    try {
        const session = await requireSuperAdmin();

        const parsedId = idParamSchema.safeParse({ id });
        if (!parsedId.success) {
            return { success: false, error: "Invalid user ID" };
        }

        const parsedData = updateUserSchema.safeParse(data);
        if (!parsedData.success) {
            return { success: false, error: parsedData.error.issues[0]?.message || "Invalid input" };
        }

        // Get target user to check permissions
        const targetUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });

        if (!targetUser) {
            return { success: false, error: "User not found" };
        }

        // Check if allowed to modify this user
        const isSameUser = session.user.id === id;
        if (!canModifyUser(session.user.role, targetUser.role, isSameUser)) {
            return { success: false, error: "Cannot modify this user" };
        }

        // Check for email uniqueness if updating email
        if (data.email) {
            const existing = await prisma.user.findFirst({
                where: { email: data.email, id: { not: id } },
            });
            if (existing) {
                return { success: false, error: "A user with this email already exists" };
            }
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
            },
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "User",
            id,
            data
        );

        revalidatePath("/admin/users");
        return { success: true, data: user };
    } catch (error) {
        console.error("Failed to update user:", error);
        return { success: false, error: "Failed to update user" };
    }
}

// Change user role (SUPER_ADMIN only, cannot change to/from SUPER_ADMIN)
export async function changeUserRole(id: string, newRole: "ADMIN" | "DISPATCHER") {
    try {
        const session = await requireSuperAdmin();

        const parsed = changeUserRoleSchema.safeParse({ id, newRole });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true, name: true },
        });

        if (!targetUser) {
            return { success: false, error: "User not found" };
        }

        // Check if allowed to change role
        if (!canChangeUserRole(session.user.role, targetUser.role, newRole)) {
            return { success: false, error: "Cannot change this user's role" };
        }

        const user = await prisma.user.update({
            where: { id },
            data: { role: newRole },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });

        await createAuditLog(
            session.user.id,
            "ROLE_CHANGE",
            "User",
            id,
            { previousRole: targetUser.role, newRole }
        );

        revalidatePath("/admin/users");
        return { success: true, data: user };
    } catch (error) {
        console.error("Failed to change user role:", error);
        return { success: false, error: "Failed to change user role" };
    }
}

// Reset user password (SUPER_ADMIN only)
export async function resetUserPassword(id: string, newPassword: string) {
    try {
        const session = await requireSuperAdmin();

        const parsed = adminResetPasswordSchema.safeParse({ id, newPassword });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });

        if (!targetUser) {
            return { success: false, error: "User not found" };
        }

        // Cannot reset SUPER_ADMIN passwords (except your own)
        if (targetUser.role === "SUPER_ADMIN" && session.user.id !== id) {
            return { success: false, error: "Cannot reset another super admin's password" };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });

        await createAuditLog(
            session.user.id,
            "PASSWORD_CHANGE",
            "User",
            id,
            { resetBy: session.user.id }
        );

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to reset user password:", error);
        return { success: false, error: "Failed to reset password" };
    }
}

// Force logout user by incrementing tokenVersion (SUPER_ADMIN only)
export async function forceLogoutUser(id: string) {
    try {
        const session = await requireSuperAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid user ID" };
        }

        const targetUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true, name: true },
        });

        if (!targetUser) {
            return { success: false, error: "User not found" };
        }

        // Cannot force-logout another SUPER_ADMIN
        if (targetUser.role === "SUPER_ADMIN" && session.user.id !== id) {
            return { success: false, error: "Cannot force logout another super admin" };
        }

        await prisma.user.update({
            where: { id },
            data: { tokenVersion: { increment: 1 } },
        });

        await createAuditLog(
            session.user.id,
            "FORCE_LOGOUT",
            "User",
            id,
            { targetName: targetUser.name, forcedBy: session.user.id }
        );

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to force logout user:", error);
        return { success: false, error: "Failed to force logout user" };
    }
}

// Delete user (SUPER_ADMIN only, cannot delete SUPER_ADMIN)
export async function deleteUser(id: string) {
    try {
        const session = await requireSuperAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid user ID" };
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true, name: true },
        });

        if (!targetUser) {
            return { success: false, error: "User not found" };
        }

        // Check if allowed to delete
        if (!canDeleteUser(session.user.role, targetUser.role)) {
            return { success: false, error: "Cannot delete this user" };
        }

        // Cannot delete yourself
        if (session.user.id === id) {
            return { success: false, error: "Cannot delete your own account" };
        }

        // Soft delete by deactivating instead of hard delete
        await prisma.user.update({
            where: { id },
            data: { isActive: false },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "User",
            id,
            { name: targetUser.name, role: targetUser.role }
        );

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to deactivate user" };
    }
}

// Get user statistics (SUPER_ADMIN only)
export async function getUserStats() {
    try {
        await requireSuperAdmin();

        const [total, superAdmins, admins, dispatchers, active, inactive] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
            prisma.user.count({ where: { role: "ADMIN" } }),
            prisma.user.count({ where: { role: "DISPATCHER" } }),
            prisma.user.count({ where: { isActive: true } }),
            prisma.user.count({ where: { isActive: false } }),
        ]);

        return {
            success: true,
            data: {
                total,
                byRole: { superAdmins, admins, dispatchers },
                active,
                inactive,
            },
        };
    } catch (error) {
        console.error("Failed to get user stats:", error);
        return { success: false, error: "Failed to get user statistics" };
    }
}

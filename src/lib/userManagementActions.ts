"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, requireAdmin, canModifyUser, canDeleteUser, canChangeUserRole } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Get all users (ADMIN/SUPER_ADMIN only)
export async function getAllUsers() {
    await requireAdmin();

    return await prisma.user.findMany({
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
}

// Get user by ID (ADMIN/SUPER_ADMIN only)
export async function getUserById(id: string) {
    await requireAdmin();

    return await prisma.user.findUnique({
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
}

// Create a new user (SUPER_ADMIN only)
export async function createUser(data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "DISPATCHER";
}) {
    const session = await requireSuperAdmin();

    // Check if email already exists
    const existing = await prisma.user.findUnique({
        where: { email: data.email },
    });

    if (existing) {
        throw new Error("A user with this email already exists");
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
    return user;
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
    const session = await requireSuperAdmin();

    // Get target user to check permissions
    const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
    });

    if (!targetUser) {
        throw new Error("User not found");
    }

    // Check if allowed to modify this user
    const isSameUser = session.user.id === id;
    if (!canModifyUser(session.user.role, targetUser.role, isSameUser)) {
        throw new Error("Cannot modify this user");
    }

    // Check for email uniqueness if updating email
    if (data.email) {
        const existing = await prisma.user.findFirst({
            where: { email: data.email, id: { not: id } },
        });
        if (existing) {
            throw new Error("A user with this email already exists");
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
    return user;
}

// Change user role (SUPER_ADMIN only, cannot change to/from SUPER_ADMIN)
export async function changeUserRole(id: string, newRole: "ADMIN" | "DISPATCHER") {
    const session = await requireSuperAdmin();

    // Get target user
    const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, name: true },
    });

    if (!targetUser) {
        throw new Error("User not found");
    }

    // Check if allowed to change role
    if (!canChangeUserRole(session.user.role, targetUser.role, newRole)) {
        throw new Error("Cannot change this user's role");
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
    return user;
}

// Reset user password (SUPER_ADMIN only)
export async function resetUserPassword(id: string, newPassword: string) {
    const session = await requireSuperAdmin();

    // Get target user
    const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
    });

    if (!targetUser) {
        throw new Error("User not found");
    }

    // Cannot reset SUPER_ADMIN passwords (except your own)
    if (targetUser.role === "SUPER_ADMIN" && session.user.id !== id) {
        throw new Error("Cannot reset another super admin's password");
    }

    // Validate password
    if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
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
}

// Delete user (SUPER_ADMIN only, cannot delete SUPER_ADMIN)
export async function deleteUser(id: string) {
    const session = await requireSuperAdmin();

    // Get target user
    const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, name: true },
    });

    if (!targetUser) {
        throw new Error("User not found");
    }

    // Check if allowed to delete
    if (!canDeleteUser(session.user.role, targetUser.role)) {
        throw new Error("Cannot delete this user");
    }

    // Cannot delete yourself
    if (session.user.id === id) {
        throw new Error("Cannot delete your own account");
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
}

// Get user statistics (SUPER_ADMIN only)
export async function getUserStats() {
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
        total,
        byRole: { superAdmins, admins, dispatchers },
        active,
        inactive,
    };
}

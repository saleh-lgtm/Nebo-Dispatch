import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { Role } from "@prisma/client";

export type AuthSession = {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        role: Role;
    };
};

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthSession> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }
    return session as AuthSession;
}

/**
 * Require specific role(s) - throws if not authorized
 */
export async function requireRole(allowedRoles: Role[]): Promise<AuthSession> {
    const session = await requireAuth();
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error("Insufficient permissions");
    }
    return session;
}

/**
 * Require SUPER_ADMIN role
 */
export async function requireSuperAdmin(): Promise<AuthSession> {
    return requireRole(["SUPER_ADMIN"]);
}

/**
 * Require ADMIN or SUPER_ADMIN role
 */
export async function requireAdmin(): Promise<AuthSession> {
    return requireRole(["SUPER_ADMIN", "ADMIN"]);
}

/**
 * Check if role can manage users (create, update, delete)
 * Only SUPER_ADMIN can manage users
 */
export function canManageUsers(role: Role): boolean {
    return role === "SUPER_ADMIN";
}

/**
 * Check if role can manage admin accounts
 * Only SUPER_ADMIN can promote/demote to admin
 */
export function canManageAdmins(role: Role): boolean {
    return role === "SUPER_ADMIN";
}

/**
 * Check if source user can modify target user
 * SUPER_ADMINs cannot modify other SUPER_ADMINs
 */
export function canModifyUser(
    sourceRole: Role,
    targetRole: Role,
    isSameUser: boolean
): boolean {
    // Users can always modify their own non-role settings
    if (isSameUser) return true;

    // Only SUPER_ADMIN can modify other users
    if (sourceRole !== "SUPER_ADMIN") return false;

    // SUPER_ADMINs cannot modify other SUPER_ADMINs
    if (targetRole === "SUPER_ADMIN") return false;

    return true;
}

/**
 * Check if source user can delete target user
 */
export function canDeleteUser(
    sourceRole: Role,
    targetRole: Role
): boolean {
    // Only SUPER_ADMIN can delete users
    if (sourceRole !== "SUPER_ADMIN") return false;

    // Cannot delete SUPER_ADMINs
    if (targetRole === "SUPER_ADMIN") return false;

    return true;
}

/**
 * Check if source user can change target user's role
 */
export function canChangeUserRole(
    sourceRole: Role,
    targetCurrentRole: Role,
    targetNewRole: Role
): boolean {
    // Only SUPER_ADMIN can change roles
    if (sourceRole !== "SUPER_ADMIN") return false;

    // Cannot change SUPER_ADMIN's role
    if (targetCurrentRole === "SUPER_ADMIN") return false;

    // Cannot promote to SUPER_ADMIN (must be done via DB)
    if (targetNewRole === "SUPER_ADMIN") return false;

    return true;
}

/**
 * Get session without throwing - returns null if not authenticated
 */
export async function getAuthSession(): Promise<AuthSession | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return null;
    }
    return session as AuthSession;
}

/**
 * Check if current user has admin privileges
 */
export async function isAdminUser(): Promise<boolean> {
    const session = await getAuthSession();
    if (!session) return false;
    return session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";
}

/**
 * Check if current user is SUPER_ADMIN
 */
export async function isSuperAdmin(): Promise<boolean> {
    const session = await getAuthSession();
    if (!session) return false;
    return session.user.role === "SUPER_ADMIN";
}

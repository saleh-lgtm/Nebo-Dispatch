// User-related types used across the application

/**
 * Minimal user reference used in relationships
 * e.g., createdBy, assignedTo, completedBy
 */
export interface UserReference {
    id: string;
    name: string | null;
}

/**
 * User with email included
 */
export interface UserWithEmail extends UserReference {
    email: string | null;
}

/**
 * Online/active user with presence information
 */
export interface OnlineUser extends UserWithEmail {
    role: string;
    currentPage?: string | null;
    lastSeenAt?: Date;
    clockIn?: Date;
    shiftId?: string;
}

/**
 * User roles in the system
 */
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "ACCOUNTING" | "DISPATCHER";

/**
 * Session user from NextAuth
 */
export interface SessionUser {
    id: string;
    name: string | null;
    email: string | null;
    role?: UserRole;
}

/**
 * Full session object
 */
export interface Session {
    user: SessionUser;
}

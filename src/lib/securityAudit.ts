/**
 * Security Audit Logging
 * Tracks security-relevant events for compliance and incident response
 */

import prisma from "@/lib/prisma";

// Security event types
export const SECURITY_EVENTS = {
    // Authentication
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    LOGIN_FAILED: "LOGIN_FAILED",
    LOGOUT: "LOGOUT",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
    PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",

    // Account security
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
    ACCOUNT_UNLOCKED: "ACCOUNT_UNLOCKED",
    ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
    ACCOUNT_REACTIVATED: "ACCOUNT_REACTIVATED",

    // Authorization
    ACCESS_DENIED: "ACCESS_DENIED",
    ROLE_CHANGED: "ROLE_CHANGED",
    PERMISSION_CHANGED: "PERMISSION_CHANGED",

    // Data access
    SENSITIVE_DATA_ACCESS: "SENSITIVE_DATA_ACCESS",
    BULK_EXPORT: "BULK_EXPORT",

    // API security
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    INVALID_TOKEN: "INVALID_TOKEN",
    SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",

    // User management
    USER_CREATED: "USER_CREATED",
    USER_DELETED: "USER_DELETED",
    USER_UPDATED: "USER_UPDATED",
} as const;

export type SecurityEvent = typeof SECURITY_EVENTS[keyof typeof SECURITY_EVENTS];

interface AuditLogParams {
    userId?: string;
    event: SecurityEvent;
    entity?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Log a security event
 */
export async function logSecurityEvent(params: AuditLogParams): Promise<void> {
    const { userId, event, entity, entityId, details, ipAddress, userAgent } = params;

    try {
        // For events without a user ID, use a system user or skip
        if (!userId) {
            console.log(`[SECURITY] ${event}`, { entity, entityId, details, ipAddress });
            return;
        }

        await prisma.auditLog.create({
            data: {
                userId,
                action: event,
                entity: entity || "Security",
                entityId,
                details: {
                    ...details,
                    userAgent,
                    timestamp: new Date().toISOString(),
                },
                ipAddress,
            },
        });
    } catch (error) {
        // Don't throw - audit logging should never break the application
        console.error("[SECURITY AUDIT] Failed to log event:", error);
    }
}

/**
 * Log a failed login attempt
 */
export async function logFailedLogin(
    email: string,
    ipAddress?: string,
    reason?: string
): Promise<void> {
    console.log(`[SECURITY] Failed login attempt for ${email} from ${ipAddress}: ${reason}`);

    // Find user to get ID if exists
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
    });

    if (user) {
        await logSecurityEvent({
            userId: user.id,
            event: SECURITY_EVENTS.LOGIN_FAILED,
            entity: "User",
            entityId: user.id,
            details: { email, reason },
            ipAddress,
        });
    }
}

/**
 * Log a successful login
 */
export async function logSuccessfulLogin(
    userId: string,
    ipAddress?: string
): Promise<void> {
    await logSecurityEvent({
        userId,
        event: SECURITY_EVENTS.LOGIN_SUCCESS,
        entity: "User",
        entityId: userId,
        ipAddress,
    });
}

/**
 * Log account lockout
 */
export async function logAccountLocked(
    userId: string,
    ipAddress?: string,
    attempts?: number
): Promise<void> {
    await logSecurityEvent({
        userId,
        event: SECURITY_EVENTS.ACCOUNT_LOCKED,
        entity: "User",
        entityId: userId,
        details: { attempts, lockedAt: new Date().toISOString() },
        ipAddress,
    });
}

/**
 * Log access denied
 */
export async function logAccessDenied(
    userId: string,
    resource: string,
    ipAddress?: string
): Promise<void> {
    await logSecurityEvent({
        userId,
        event: SECURITY_EVENTS.ACCESS_DENIED,
        entity: "Authorization",
        details: { resource },
        ipAddress,
    });
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
    identifier: string,
    endpoint: string,
    ipAddress?: string
): Promise<void> {
    console.warn(`[SECURITY] Rate limit exceeded: ${identifier} on ${endpoint}`);
    // Don't create DB record for rate limits - could be DoS vector
}

/**
 * Log role change
 */
export async function logRoleChange(
    targetUserId: string,
    changedByUserId: string,
    oldRole: string,
    newRole: string,
    ipAddress?: string
): Promise<void> {
    await logSecurityEvent({
        userId: changedByUserId,
        event: SECURITY_EVENTS.ROLE_CHANGED,
        entity: "User",
        entityId: targetUserId,
        details: { oldRole, newRole, targetUserId },
        ipAddress,
    });
}

/**
 * Log password change
 */
export async function logPasswordChange(
    userId: string,
    changedByUserId: string,
    ipAddress?: string
): Promise<void> {
    await logSecurityEvent({
        userId: changedByUserId,
        event: SECURITY_EVENTS.PASSWORD_CHANGED,
        entity: "User",
        entityId: userId,
        details: { selfChange: userId === changedByUserId },
        ipAddress,
    });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
    description: string,
    userId?: string,
    ipAddress?: string,
    details?: Record<string, unknown>
): Promise<void> {
    console.warn(`[SECURITY] Suspicious activity: ${description}`, { userId, ipAddress, details });

    if (userId) {
        await logSecurityEvent({
            userId,
            event: SECURITY_EVENTS.SUSPICIOUS_ACTIVITY,
            entity: "Security",
            details: { description, ...details },
            ipAddress,
        });
    }
}

/**
 * Get security events for a user
 */
export async function getUserSecurityEvents(
    userId: string,
    limit: number = 50
): Promise<unknown[]> {
    return prisma.auditLog.findMany({
        where: {
            userId,
            action: {
                in: Object.values(SECURITY_EVENTS),
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

/**
 * Get recent security events (for admin dashboard)
 */
export async function getRecentSecurityEvents(
    limit: number = 100
): Promise<unknown[]> {
    return prisma.auditLog.findMany({
        where: {
            action: {
                in: Object.values(SECURITY_EVENTS),
            },
        },
        include: {
            user: {
                select: { id: true, name: true, email: true },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// IP-based rate limiting for distributed brute force protection
const IP_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const IP_RATE_LIMIT_MAX_ATTEMPTS = 20; // Max attempts per IP in window
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string): { allowed: boolean; remainingAttempts: number } {
    const now = Date.now();
    const entry = ipAttempts.get(ip);

    // Cleanup expired entries periodically
    if (ipAttempts.size > 10000) {
        for (const [key, val] of ipAttempts.entries()) {
            if (now > val.resetAt) ipAttempts.delete(key);
        }
    }

    if (!entry || now > entry.resetAt) {
        ipAttempts.set(ip, { count: 1, resetAt: now + IP_RATE_LIMIT_WINDOW });
        return { allowed: true, remainingAttempts: IP_RATE_LIMIT_MAX_ATTEMPTS - 1 };
    }

    if (entry.count >= IP_RATE_LIMIT_MAX_ATTEMPTS) {
        return { allowed: false, remainingAttempts: 0 };
    }

    entry.count++;
    return { allowed: true, remainingAttempts: IP_RATE_LIMIT_MAX_ATTEMPTS - entry.count };
}

// Store IP from request context (set via middleware or headers)
let currentRequestIp: string | null = null;
export function setRequestIp(ip: string) {
    currentRequestIp = ip;
}

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 hours
    },
    // SECURITY: Explicit cookie configuration for CSRF protection
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production"
                ? "__Secure-next-auth.session-token"
                : "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === "production"
                ? "__Host-next-auth.csrf-token"
                : "next-auth.csrf-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    providers: [
        CredentialsProvider({
            name: "Sign in",
            credentials: {
                email: {
                    label: "Email",
                    type: "email",
                    placeholder: "hello@example.com",
                },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials.password) {
                    return null;
                }

                // IP-based rate limiting for distributed brute force protection
                const ip = currentRequestIp ||
                    (req?.headers?.["x-forwarded-for"] as string)?.split(",")[0] ||
                    (req?.headers?.["x-real-ip"] as string) ||
                    "unknown";

                const ipRateLimit = checkIpRateLimit(ip);
                if (!ipRateLimit.allowed) {
                    throw new Error("Too many login attempts from this location. Please try again in 15 minutes.");
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email.toLowerCase(),
                    },
                });

                if (!user || !user.password) {
                    return null;
                }

                // Check if account is locked
                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    const remainingMinutes = Math.ceil(
                        (user.lockedUntil.getTime() - Date.now()) / 60000
                    );
                    throw new Error(`Account locked. Try again in ${remainingMinutes} minutes.`);
                }

                // Check if user is active
                if (!user.isActive) {
                    throw new Error("Account has been deactivated. Contact an administrator.");
                }

                // Check approval status
                if (user.approvalStatus === "PENDING") {
                    throw new Error("Your account is pending approval. Please wait for an administrator to review your registration.");
                }

                if (user.approvalStatus === "REJECTED") {
                    throw new Error("Your registration has been rejected. Contact an administrator for more information.");
                }

                const isPasswordValid = await compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    // Increment failed login attempts
                    const newAttempts = (user.loginAttempts || 0) + 1;
                    const updateData: { loginAttempts: number; lockedUntil?: Date } = {
                        loginAttempts: newAttempts,
                    };

                    // Lock account if max attempts reached
                    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
                        updateData.lockedUntil = new Date(
                            Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
                        );
                    }

                    await prisma.user.update({
                        where: { id: user.id },
                        data: updateData,
                    });

                    const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
                    if (remainingAttempts > 0) {
                        throw new Error(`Invalid credentials. ${remainingAttempts} attempts remaining.`);
                    } else {
                        throw new Error(`Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`);
                    }
                }

                // Successful login - reset attempts and update last login
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        loginAttempts: 0,
                        lockedUntil: null,
                        lastLogin: new Date(),
                    },
                });

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
    ],
    callbacks: {
        session: ({ session, token }) => {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    role: token.role,
                },
            };
        },
        jwt: ({ token, user }) => {
            if (user) {
                const u = user as unknown as any;
                return {
                    ...token,
                    id: u.id,
                    role: u.role,
                };
            }
            return token;
        },
    },
    pages: {
        signIn: "/login",
        signOut: "/login",
    },
};

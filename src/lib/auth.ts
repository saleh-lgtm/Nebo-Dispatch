import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 hours
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
            async authorize(credentials) {
                if (!credentials?.email || !credentials.password) {
                    return null;
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
    },
};

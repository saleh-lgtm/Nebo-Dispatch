/**
 * Password Policy Enforcement
 * Ensures strong passwords and prevents common security issues
 */

import { hash, compare } from "bcryptjs";

// Password policy configuration
export const PASSWORD_POLICY = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventUserInfo: true,
} as const;

// Common weak passwords to reject
const COMMON_PASSWORDS = new Set([
    "password",
    "password123",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "letmein",
    "welcome",
    "admin",
    "admin123",
    "nebo",
    "nebo123",
    "nebo2024",
    "dispatch",
    "dispatcher",
]);

interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    strength: "weak" | "fair" | "strong" | "very_strong";
}

/**
 * Validate a password against the policy
 */
export function validatePassword(
    password: string,
    userInfo?: { email?: string; name?: string }
): PasswordValidationResult {
    const errors: string[] = [];
    let strengthScore = 0;

    // Length checks
    if (password.length < PASSWORD_POLICY.minLength) {
        errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
    } else {
        strengthScore++;
    }

    if (password.length > PASSWORD_POLICY.maxLength) {
        errors.push(`Password must be less than ${PASSWORD_POLICY.maxLength} characters`);
    }

    if (password.length >= 12) strengthScore++;
    if (password.length >= 16) strengthScore++;

    // Character requirements
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
    } else if (/[A-Z]/.test(password)) {
        strengthScore++;
    }

    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
    } else if (/[a-z]/.test(password)) {
        strengthScore++;
    }

    if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
        errors.push("Password must contain at least one number");
    } else if (/\d/.test(password)) {
        strengthScore++;
    }

    if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\\/`~]/.test(password)) {
        errors.push("Password must contain at least one special character (!@#$%^&*...)");
    } else if (/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\\/`~]/.test(password)) {
        strengthScore++;
    }

    // Common password check
    if (PASSWORD_POLICY.preventCommonPasswords) {
        const lowerPassword = password.toLowerCase();
        if (COMMON_PASSWORDS.has(lowerPassword)) {
            errors.push("This password is too common. Please choose a more unique password");
        }
    }

    // Prevent password containing user info
    if (PASSWORD_POLICY.preventUserInfo && userInfo) {
        const lowerPassword = password.toLowerCase();

        if (userInfo.email) {
            const emailParts = userInfo.email.toLowerCase().split("@");
            if (emailParts[0] && emailParts[0].length > 2 && lowerPassword.includes(emailParts[0])) {
                errors.push("Password cannot contain your email address");
            }
        }

        if (userInfo.name) {
            const nameParts = userInfo.name.toLowerCase().split(/\s+/);
            for (const part of nameParts) {
                if (part.length > 2 && lowerPassword.includes(part)) {
                    errors.push("Password cannot contain your name");
                    break;
                }
            }
        }
    }

    // Sequential character check
    if (/(.)\1{2,}/.test(password)) {
        errors.push("Password cannot contain more than 2 repeated characters in a row");
    }

    // Determine strength
    let strength: PasswordValidationResult["strength"];
    if (strengthScore <= 2 || errors.length > 0) {
        strength = "weak";
    } else if (strengthScore <= 4) {
        strength = "fair";
    } else if (strengthScore <= 6) {
        strength = "strong";
    } else {
        strength = "very_strong";
    }

    return {
        valid: errors.length === 0,
        errors,
        strength,
    };
}

/**
 * Hash a password securely
 */
export async function hashPassword(password: string): Promise<string> {
    // Use cost factor of 12 (good balance of security and performance)
    return hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return compare(password, hashedPassword);
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const all = uppercase + lowercase + numbers + special;

    let password = "";

    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");
}

/**
 * Check if password was recently used (requires password history in DB)
 * This is a placeholder - implement password history table if needed
 */
export async function wasRecentlyUsed(
    _userId: string,
    _password: string,
    _historyCount: number = 5
): Promise<boolean> {
    // TODO: Implement password history checking
    // This would require a PasswordHistory table in the schema
    return false;
}

/**
 * Get password requirements as user-friendly text
 */
export function getPasswordRequirements(): string[] {
    return [
        `At least ${PASSWORD_POLICY.minLength} characters`,
        "At least one uppercase letter (A-Z)",
        "At least one lowercase letter (a-z)",
        "At least one number (0-9)",
        "At least one special character (!@#$%...)",
        "Cannot be a common password",
        "Cannot contain your name or email",
    ];
}

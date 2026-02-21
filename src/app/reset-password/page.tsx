"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Lock,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    Eye,
    EyeOff,
    KeyRound,
    Check,
    X,
} from "lucide-react";
import { validateResetToken, resetPassword } from "@/lib/passwordResetActions";

function PasswordRequirement({
    met,
    text,
}: {
    met: boolean;
    text: string;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8rem",
                color: met ? "var(--success)" : "var(--text-secondary)",
            }}
        >
            {met ? <Check size={14} /> : <X size={14} />}
            {text}
        </div>
    );
}

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [tokenError, setTokenError] = useState("");
    const [email, setEmail] = useState("");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    // Password requirements
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const passwordsMatch = password === confirmPassword && password.length > 0;
    const allRequirementsMet = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

    useEffect(() => {
        async function validate() {
            if (!token) {
                setTokenValid(false);
                setTokenError("No reset token provided");
                setValidating(false);
                return;
            }

            const result = await validateResetToken(token);
            setTokenValid(result.valid);
            setTokenError(result.error || "");
            setEmail(result.email || "");
            setValidating(false);
        }

        validate();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allRequirementsMet || !token) return;

        setLoading(true);
        setError("");

        try {
            const result = await resetPassword(token, password);

            if (result.success) {
                setSuccess(true);
            } else {
                setError(result.message);
            }
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (validating) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
                <div className="glass-card animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
                    <div style={{ textAlign: "center" }}>
                        <Loader2
                            className="animate-spin"
                            size={40}
                            style={{ color: "var(--accent)", marginBottom: "1rem" }}
                        />
                        <p style={{ color: "var(--text-secondary)" }}>Validating reset link...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Invalid token
    if (!tokenValid) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
                <div className="glass-card animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                display: "inline-flex",
                                padding: "1rem",
                                background: "rgba(239, 68, 68, 0.1)",
                                borderRadius: "50%",
                                color: "var(--danger)",
                                marginBottom: "1rem",
                            }}
                        >
                            <XCircle size={32} />
                        </div>
                        <h1 className="font-display" style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
                            Invalid Link
                        </h1>
                        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                            {tokenError || "This password reset link is invalid or has expired."}
                        </p>
                        <Link
                            href="/forgot-password"
                            className="btn btn-primary"
                            style={{ width: "100%", marginBottom: "1rem" }}
                        >
                            Request New Link
                        </Link>
                        <Link
                            href="/login"
                            className="flex items-center justify-center gap-2"
                            style={{
                                color: "var(--text-secondary)",
                                fontSize: "0.875rem",
                                textDecoration: "none",
                            }}
                        >
                            <ArrowLeft size={16} />
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
                <div className="glass-card animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                display: "inline-flex",
                                padding: "1rem",
                                background: "rgba(34, 197, 94, 0.1)",
                                borderRadius: "50%",
                                color: "var(--success)",
                                marginBottom: "1rem",
                            }}
                        >
                            <CheckCircle size={32} />
                        </div>
                        <h1 className="font-display" style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
                            Password Reset!
                        </h1>
                        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                            Your password has been successfully reset. You can now sign in with your new password.
                        </p>
                        <Link href="/login" className="btn btn-primary" style={{ width: "100%" }}>
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Reset form
    return (
        <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
            <div className="glass-card animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div
                        style={{
                            display: "inline-flex",
                            padding: "1rem",
                            background: "rgba(56, 189, 248, 0.1)",
                            borderRadius: "50%",
                            color: "var(--accent)",
                            marginBottom: "1rem",
                        }}
                    >
                        <KeyRound size={32} />
                    </div>
                    <h1 className="font-display" style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
                        Reset Password
                    </h1>
                    {email && (
                        <p style={{ color: "var(--text-secondary)" }}>
                            for <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {error && (
                        <div
                            style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                color: "var(--danger)",
                                padding: "0.75rem",
                                borderRadius: "0.5rem",
                                textAlign: "center",
                                fontSize: "0.875rem",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label
                            htmlFor="password"
                            style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
                        >
                            New Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <Lock
                                size={18}
                                style={{
                                    position: "absolute",
                                    left: "1rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--text-secondary)",
                                }}
                            />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                className="input focus-ring"
                                placeholder="Enter new password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
                                style={{ paddingLeft: "3rem", paddingRight: "3rem" }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: "absolute",
                                    right: "1rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label
                            htmlFor="confirmPassword"
                            style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
                        >
                            Confirm Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <Lock
                                size={18}
                                style={{
                                    position: "absolute",
                                    left: "1rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--text-secondary)",
                                }}
                            />
                            <input
                                id="confirmPassword"
                                type={showConfirm ? "text" : "password"}
                                className="input focus-ring"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={{ paddingLeft: "3rem", paddingRight: "3rem" }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                style={{
                                    position: "absolute",
                                    right: "1rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                                aria-label={showConfirm ? "Hide password" : "Show password"}
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    <div
                        style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            borderRadius: "0.5rem",
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                        }}
                    >
                        <p style={{ fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                            Password Requirements:
                        </p>
                        <PasswordRequirement met={hasMinLength} text="At least 8 characters" />
                        <PasswordRequirement met={hasUppercase} text="One uppercase letter" />
                        <PasswordRequirement met={hasLowercase} text="One lowercase letter" />
                        <PasswordRequirement met={hasNumber} text="One number" />
                        <PasswordRequirement met={passwordsMatch} text="Passwords match" />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary flex items-center justify-center gap-2"
                        disabled={loading || !allRequirementsMet}
                        style={{ marginTop: "0.5rem" }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Resetting...
                            </>
                        ) : (
                            "Reset Password"
                        )}
                    </button>

                    <Link
                        href="/login"
                        className="flex items-center justify-center gap-2"
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: "0.875rem",
                            textDecoration: "none",
                        }}
                    >
                        <ArrowLeft size={16} />
                        Back to Sign In
                    </Link>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
                    <div className="glass-card" style={{ width: "100%", maxWidth: "400px" }}>
                        <div style={{ textAlign: "center" }}>
                            <Loader2
                                className="animate-spin"
                                size={40}
                                style={{ color: "var(--accent)", marginBottom: "1rem" }}
                            />
                            <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
                        </div>
                    </div>
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}

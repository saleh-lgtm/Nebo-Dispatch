"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle, KeyRound } from "lucide-react";
import { requestPasswordReset } from "@/lib/passwordResetActions";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await requestPasswordReset(email);

            if (result.success) {
                setSubmitted(true);
            } else {
                setError(result.message);
            }
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
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
                            Check Your Email
                        </h1>
                        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                            If an account exists for <strong style={{ color: "var(--text-primary)" }}>{email}</strong>,
                            you will receive a password reset link shortly.
                        </p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                            The link will expire in 1 hour.
                        </p>
                        <Link
                            href="/login"
                            className="btn btn-secondary flex items-center justify-center gap-2"
                            style={{ width: "100%" }}
                        >
                            <ArrowLeft size={18} />
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                        Forgot Password?
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Enter your email and we&apos;ll send you a reset link
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
                >
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
                            htmlFor="email"
                            style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
                        >
                            Email Address
                        </label>
                        <div style={{ position: "relative" }}>
                            <Mail
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
                                id="email"
                                type="email"
                                className="input focus-ring"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                                style={{ paddingLeft: "3rem" }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary flex items-center justify-center gap-2"
                        disabled={loading}
                        style={{ marginTop: "0.5rem" }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Sending...
                            </>
                        ) : (
                            "Send Reset Link"
                        )}
                    </button>

                    <Link
                        href="/login"
                        className="flex items-center justify-center gap-2"
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: "0.875rem",
                            textDecoration: "none",
                            transition: "color 0.2s",
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

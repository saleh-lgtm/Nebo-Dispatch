"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck, Mail, Lock, User, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { signUp } from "@/lib/signupActions";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const result = await signUp({ name, email, password });

            if (result.error) {
                setError(result.error);
            } else {
                setSuccess(true);
            }
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="signup-page">
                <div className="signup-brand">
                    <div className="brand-content">
                        <div className="brand-icon">
                            <Truck size={40} />
                        </div>
                        <h1 className="brand-title">Nebo Dispatch</h1>
                        <p className="brand-tagline">Transportation Management System</p>
                    </div>
                </div>

                <div className="signup-form-panel">
                    <div className="signup-form-container">
                        <div className="success-container">
                            <div className="success-icon">
                                <CheckCircle size={48} />
                            </div>
                            <h2>Registration Submitted</h2>
                            <p>
                                Your account request has been submitted successfully.
                                An administrator will review your application and you&apos;ll
                                receive access once approved.
                            </p>
                            <Link href="/login" className="back-to-login">
                                <span>Back to Login</span>
                                <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                </div>

                <style jsx>{`
                    .signup-page {
                        min-height: 100vh;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                    }

                    .signup-brand {
                        background: linear-gradient(135deg, #059669 0%, #047857 100%);
                        padding: 3rem;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        position: relative;
                        overflow: hidden;
                    }

                    .signup-brand::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        right: -30%;
                        width: 80%;
                        height: 150%;
                        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
                        pointer-events: none;
                    }

                    .brand-content {
                        position: relative;
                        z-index: 1;
                        max-width: 400px;
                    }

                    .brand-icon {
                        width: 72px;
                        height: 72px;
                        background: rgba(255, 255, 255, 0.15);
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        margin-bottom: 1.5rem;
                    }

                    .brand-title {
                        font-size: 2.5rem;
                        font-weight: 700;
                        color: white;
                        margin-bottom: 0.5rem;
                        letter-spacing: -0.02em;
                    }

                    .brand-tagline {
                        font-size: 1.125rem;
                        color: rgba(255, 255, 255, 0.8);
                    }

                    .signup-form-panel {
                        background: var(--bg-primary);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 2rem;
                    }

                    .signup-form-container {
                        width: 100%;
                        max-width: 400px;
                    }

                    .success-container {
                        text-align: center;
                    }

                    .success-icon {
                        width: 80px;
                        height: 80px;
                        background: var(--success-bg);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--success);
                        margin: 0 auto 1.5rem;
                    }

                    .success-container h2 {
                        font-size: 1.5rem;
                        font-weight: 600;
                        color: var(--text-primary);
                        margin-bottom: 1rem;
                    }

                    .success-container p {
                        color: var(--text-secondary);
                        line-height: 1.6;
                        margin-bottom: 2rem;
                    }

                    .back-to-login {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.875rem 1.5rem;
                        background: var(--primary);
                        border-radius: var(--radius-md);
                        color: white;
                        font-weight: 600;
                        text-decoration: none;
                        transition: background 0.15s;
                    }

                    .back-to-login:hover {
                        background: var(--primary-hover);
                    }

                    @media (max-width: 900px) {
                        .signup-page {
                            grid-template-columns: 1fr;
                        }

                        .signup-brand {
                            display: none;
                        }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="signup-page">
            {/* Left Panel - Branding */}
            <div className="signup-brand">
                <div className="brand-content">
                    <div className="brand-icon">
                        <Truck size={40} />
                    </div>
                    <h1 className="brand-title">Nebo Dispatch</h1>
                    <p className="brand-tagline">Transportation Management System</p>
                    <div className="brand-features">
                        <div className="feature-item">
                            <div className="feature-dot" />
                            <span>Join our dispatch team</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-dot" />
                            <span>Admin approval required</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-dot" />
                            <span>Secure registration process</span>
                        </div>
                    </div>
                </div>
                <div className="brand-footer">
                    <span>Trusted by transportation professionals</span>
                </div>
            </div>

            {/* Right Panel - Signup Form */}
            <div className="signup-form-panel">
                <div className="signup-form-container">
                    <div className="signup-header">
                        <h2>Create an account</h2>
                        <p>Sign up to request access to the system</p>
                    </div>

                    <form onSubmit={handleSubmit} className="signup-form">
                        {error && (
                            <div className="signup-error">
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <div className="input-wrapper">
                                <User size={18} className="input-icon" />
                                <input
                                    type="text"
                                    className="signup-input"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    minLength={2}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    className="signup-input"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="signup-input"
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <span className="password-hint">
                                Min 8 characters, uppercase, lowercase, number, and special character
                            </span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="signup-input"
                                    placeholder="Confirm your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="signup-button"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>Request Access</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div className="signup-footer">
                            <span>Already have an account?</span>
                            <Link href="/login" className="login-link">
                                Sign in
                            </Link>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .signup-page {
                    min-height: 100vh;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                }

                /* Brand Panel */
                .signup-brand {
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    padding: 3rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .signup-brand::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -30%;
                    width: 80%;
                    height: 150%;
                    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
                    pointer-events: none;
                }

                .brand-content {
                    position: relative;
                    z-index: 1;
                    max-width: 400px;
                }

                .brand-icon {
                    width: 72px;
                    height: 72px;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    margin-bottom: 1.5rem;
                }

                .brand-title {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: white;
                    margin-bottom: 0.5rem;
                    letter-spacing: -0.02em;
                }

                .brand-tagline {
                    font-size: 1.125rem;
                    color: rgba(255, 255, 255, 0.8);
                    margin-bottom: 3rem;
                }

                .brand-features {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .feature-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 0.9375rem;
                }

                .feature-dot {
                    width: 8px;
                    height: 8px;
                    background: white;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .brand-footer {
                    position: absolute;
                    bottom: 2rem;
                    left: 3rem;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.875rem;
                }

                /* Form Panel */
                .signup-form-panel {
                    background: var(--bg-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }

                .signup-form-container {
                    width: 100%;
                    max-width: 400px;
                }

                .signup-header {
                    margin-bottom: 2rem;
                }

                .signup-header h2 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.5rem;
                }

                .signup-header p {
                    color: var(--text-secondary);
                    font-size: 0.9375rem;
                }

                .signup-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .signup-error {
                    background: var(--danger-bg);
                    border: 1px solid var(--danger-border);
                    border-radius: var(--radius-md);
                    padding: 0.875rem 1rem;
                    color: var(--danger);
                    font-size: 0.875rem;
                    text-align: center;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-label {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .password-hint {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .input-wrapper {
                    position: relative;
                }

                .input-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                    pointer-events: none;
                    transition: color 0.15s;
                }

                .signup-input {
                    width: 100%;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: 0.875rem 1rem 0.875rem 2.75rem;
                    color: var(--text-primary);
                    font-size: 0.9375rem;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }

                .signup-input::placeholder {
                    color: var(--text-muted);
                }

                .signup-input:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px var(--primary-soft);
                }

                .input-wrapper:focus-within .input-icon {
                    color: var(--primary);
                }

                .signup-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.875rem 1.5rem;
                    background: var(--primary);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.9375rem;
                    font-weight: 600;
                    font-family: inherit;
                    cursor: pointer;
                    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
                    margin-top: 0.5rem;
                }

                .signup-button:hover:not(:disabled) {
                    background: var(--primary-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px var(--primary-glow);
                }

                .signup-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .signup-footer {
                    text-align: center;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    display: flex;
                    justify-content: center;
                    gap: 0.5rem;
                }

                .login-link {
                    color: var(--primary);
                    text-decoration: none;
                    font-weight: 500;
                }

                .login-link:hover {
                    text-decoration: underline;
                }

                @media (max-width: 900px) {
                    .signup-page {
                        grid-template-columns: 1fr;
                    }

                    .signup-brand {
                        display: none;
                    }

                    .signup-form-panel {
                        min-height: 100vh;
                    }
                }

                @media (max-width: 480px) {
                    .signup-form-panel {
                        padding: 1.5rem;
                    }
                }
            `}</style>
        </div>
    );
}

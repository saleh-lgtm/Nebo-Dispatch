"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, Mail, Lock, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid email or password");
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Left Panel - Branding */}
            <div className="login-brand">
                <div className="brand-content">
                    <div className="brand-icon">
                        <Truck size={40} />
                    </div>
                    <h1 className="brand-title">Nebo Dispatch</h1>
                    <p className="brand-tagline">Transportation Management System</p>
                    <div className="brand-features">
                        <div className="feature-item">
                            <div className="feature-dot" />
                            <span>Real-time dispatch tracking</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-dot" />
                            <span>Quote management & follow-ups</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-dot" />
                            <span>Team scheduling & reports</span>
                        </div>
                    </div>
                </div>
                <div className="brand-footer">
                    <span>Trusted by transportation professionals</span>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="login-form-panel">
                <div className="login-form-container">
                    <div className="login-header">
                        <h2>Welcome back</h2>
                        <p>Sign in to your account to continue</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="login-error">
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    className="login-input"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="form-label-row">
                                <label className="form-label">Password</label>
                                <Link href="/forgot-password" className="forgot-link">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="login-input"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div className="signup-link">
                            <span>New dispatcher?</span>
                            <Link href="/signup">Request access</Link>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .login-page {
                    min-height: 100vh;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                }

                /* Brand Panel */
                .login-brand {
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    padding: 3rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .login-brand::before {
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
                .login-form-panel {
                    background: var(--bg-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }

                .login-form-container {
                    width: 100%;
                    max-width: 400px;
                }

                .login-header {
                    margin-bottom: 2rem;
                }

                .login-header h2 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.5rem;
                }

                .login-header p {
                    color: var(--text-secondary);
                    font-size: 0.9375rem;
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .login-error {
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

                .form-label-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .forgot-link {
                    font-size: 0.8125rem;
                    color: var(--primary);
                    text-decoration: none;
                    font-weight: 500;
                }

                .forgot-link:hover {
                    text-decoration: underline;
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

                .login-input {
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

                .login-input::placeholder {
                    color: var(--text-muted);
                }

                .login-input:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px var(--primary-soft);
                }

                .input-wrapper:focus-within .input-icon {
                    color: var(--primary);
                }

                .login-button {
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

                .login-button:hover:not(:disabled) {
                    background: var(--primary-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px var(--primary-glow);
                }

                .login-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .signup-link {
                    text-align: center;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    display: flex;
                    justify-content: center;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }

                .signup-link a {
                    color: var(--primary);
                    text-decoration: none;
                    font-weight: 500;
                }

                .signup-link a:hover {
                    text-decoration: underline;
                }

                @media (max-width: 900px) {
                    .login-page {
                        grid-template-columns: 1fr;
                    }

                    .login-brand {
                        display: none;
                    }

                    .login-form-panel {
                        min-height: 100vh;
                    }
                }

                @media (max-width: 480px) {
                    .login-form-panel {
                        padding: 1.5rem;
                    }
                }
            `}</style>
        </div>
    );
}

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
                    background: var(--bg-base);
                }

                /* Brand Panel - n8n-inspired dark gradient */
                .login-brand {
                    background: linear-gradient(135deg, #1a1225 0%, #241a30 50%, #0e0918 100%);
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
                    top: -30%;
                    right: -20%;
                    width: 70%;
                    height: 120%;
                    background: radial-gradient(ellipse, rgba(238, 79, 39, 0.15) 0%, transparent 60%);
                    pointer-events: none;
                }

                .login-brand::after {
                    content: '';
                    position: absolute;
                    bottom: -30%;
                    left: -20%;
                    width: 60%;
                    height: 100%;
                    background: radial-gradient(ellipse, rgba(139, 122, 168, 0.1) 0%, transparent 60%);
                    pointer-events: none;
                }

                .brand-content {
                    position: relative;
                    z-index: 1;
                    max-width: 420px;
                }

                .brand-icon {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, var(--accent-soft), rgba(238, 79, 39, 0.25));
                    border: 1px solid var(--accent-border);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent);
                    margin-bottom: 2rem;
                    box-shadow: 0 0 40px rgba(238, 79, 39, 0.3);
                }

                .brand-title {
                    font-size: 2.75rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #ffffff 0%, #a8a0b4 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: 0.75rem;
                    letter-spacing: -0.03em;
                }

                .brand-tagline {
                    font-size: 1.25rem;
                    color: var(--text-secondary);
                    margin-bottom: 3rem;
                    font-weight: 500;
                }

                .brand-features {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .feature-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    color: var(--text-secondary);
                    font-size: 1rem;
                    font-weight: 500;
                }

                .feature-dot {
                    width: 10px;
                    height: 10px;
                    background: linear-gradient(135deg, var(--accent), var(--accent-hover));
                    border-radius: 50%;
                    flex-shrink: 0;
                    box-shadow: 0 0 15px rgba(238, 79, 39, 0.5);
                }

                .brand-footer {
                    position: absolute;
                    bottom: 2.5rem;
                    left: 3rem;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }

                /* Form Panel */
                .login-form-panel {
                    background: var(--bg-surface);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2.5rem;
                    position: relative;
                }

                .login-form-panel::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 1px;
                    height: 100%;
                    background: linear-gradient(to bottom, transparent, var(--accent-border), transparent);
                }

                .login-form-container {
                    width: 100%;
                    max-width: 420px;
                }

                .login-header {
                    margin-bottom: 2.5rem;
                }

                .login-header h2 {
                    font-size: 2rem;
                    font-weight: 800;
                    color: var(--text-primary);
                    margin-bottom: 0.625rem;
                    letter-spacing: -0.02em;
                }

                .login-header p {
                    color: var(--text-secondary);
                    font-size: 1rem;
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .login-error {
                    background: var(--danger-soft);
                    border: 1px solid var(--danger-border);
                    border-radius: var(--radius-md);
                    padding: 1rem 1.25rem;
                    color: var(--danger);
                    font-size: 0.875rem;
                    text-align: center;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.625rem;
                }

                .form-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .form-label-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .forgot-link {
                    font-size: 0.8125rem;
                    color: var(--accent);
                    text-decoration: none;
                    font-weight: 600;
                    transition: color 0.15s;
                }

                .forgot-link:hover {
                    color: var(--accent-hover);
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
                    transition: color 0.2s;
                }

                .login-input {
                    width: 100%;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: 1rem 1rem 1rem 3rem;
                    color: var(--text-primary);
                    font-size: 0.9375rem;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
                }

                .login-input::placeholder {
                    color: var(--text-muted);
                }

                .login-input:hover {
                    border-color: var(--border-hover);
                }

                .login-input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px var(--accent-soft), 0 0 20px rgba(238, 79, 39, 0.15);
                    background: var(--bg-surface);
                }

                .input-wrapper:focus-within .input-icon {
                    color: var(--accent);
                }

                .login-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.625rem;
                    width: 100%;
                    padding: 1rem 1.5rem;
                    background: linear-gradient(135deg, var(--accent), var(--accent-dim));
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 1rem;
                    font-weight: 700;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin-top: 0.75rem;
                    box-shadow: 0 4px 20px rgba(238, 79, 39, 0.3);
                    position: relative;
                    overflow: hidden;
                }

                .login-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 50%;
                    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.15), transparent);
                    pointer-events: none;
                }

                .login-button:hover:not(:disabled) {
                    background: linear-gradient(135deg, var(--accent-hover), var(--accent));
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(238, 79, 39, 0.4);
                }

                .login-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .signup-link {
                    text-align: center;
                    font-size: 0.9375rem;
                    color: var(--text-secondary);
                    display: flex;
                    justify-content: center;
                    gap: 0.5rem;
                    margin-top: 1rem;
                }

                .signup-link a {
                    color: var(--accent);
                    text-decoration: none;
                    font-weight: 600;
                    transition: color 0.15s;
                }

                .signup-link a:hover {
                    color: var(--accent-hover);
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

                    .login-form-panel::before {
                        display: none;
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

"use client";

import { useState } from "react";
import { Settings, Lock, Eye, EyeOff, CheckCircle, AlertCircle, User, Mail } from "lucide-react";
import { changePassword } from "@/lib/userActions";

interface Props {
    userName: string;
    userEmail: string;
}

export default function SettingsClient({ userName, userEmail }: Props) {
    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        // Validate
        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: "error", text: "New passwords do not match" });
            return;
        }

        if (formData.newPassword.length < 6) {
            setMessage({ type: "error", text: "New password must be at least 6 characters" });
            return;
        }

        setLoading(true);

        try {
            await changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
            });

            setMessage({ type: "success", text: "Password changed successfully!" });
            setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to change password";
            setMessage({ type: "error", text: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto" }}>
            {/* Header */}
            <header className="flex items-center gap-3">
                <Settings size={28} className="text-accent" />
                <div>
                    <h1 className="font-display" style={{ fontSize: "1.75rem" }}>
                        Settings
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Manage your account settings
                    </p>
                </div>
            </header>

            {/* Profile Info Card */}
            <div className="glass-card">
                <h2 className="font-display flex items-center gap-2" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                    <User size={20} className="text-accent" />
                    Profile Information
                </h2>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3" style={{ padding: "0.75rem", background: "rgba(183, 175, 163, 0.05)", borderRadius: "8px" }}>
                        <User size={16} style={{ color: "var(--text-secondary)" }} />
                        <div>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Name</p>
                            <p style={{ fontWeight: 500 }}>{userName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3" style={{ padding: "0.75rem", background: "rgba(183, 175, 163, 0.05)", borderRadius: "8px" }}>
                        <Mail size={16} style={{ color: "var(--text-secondary)" }} />
                        <div>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Email</p>
                            <p style={{ fontWeight: 500 }}>{userEmail}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password Card */}
            <div className="glass-card">
                <h2 className="font-display flex items-center gap-2" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                    <Lock size={20} className="text-accent" />
                    Change Password
                </h2>

                {message && (
                    <div
                        className="flex items-center gap-2"
                        style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "8px",
                            marginBottom: "1rem",
                            background: message.type === "success"
                                ? "rgba(34, 197, 94, 0.1)"
                                : "rgba(239, 68, 68, 0.1)",
                            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                            color: message.type === "success" ? "#22c55e" : "#ef4444",
                        }}
                    >
                        {message.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <span style={{ fontSize: "0.875rem" }}>{message.text}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Current Password */}
                    <div className="flex flex-col gap-1">
                        <label
                            className="text-xs uppercase tracking-wider font-bold"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Current Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPasswords.current ? "text" : "password"}
                                required
                                className="input"
                                style={{ paddingRight: "2.5rem" }}
                                placeholder="Enter current password"
                                value={formData.currentPassword}
                                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                style={{
                                    position: "absolute",
                                    right: "0.75rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-secondary)",
                                    padding: "0.25rem",
                                }}
                            >
                                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div className="flex flex-col gap-1">
                        <label
                            className="text-xs uppercase tracking-wider font-bold"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            New Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPasswords.new ? "text" : "password"}
                                required
                                className="input"
                                style={{ paddingRight: "2.5rem" }}
                                placeholder="Enter new password (min 6 characters)"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                style={{
                                    position: "absolute",
                                    right: "0.75rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-secondary)",
                                    padding: "0.25rem",
                                }}
                            >
                                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="flex flex-col gap-1">
                        <label
                            className="text-xs uppercase tracking-wider font-bold"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Confirm New Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPasswords.confirm ? "text" : "password"}
                                required
                                className="input"
                                style={{ paddingRight: "2.5rem" }}
                                placeholder="Confirm new password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                style={{
                                    position: "absolute",
                                    right: "0.75rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-secondary)",
                                    padding: "0.25rem",
                                }}
                            >
                                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ marginTop: "0.5rem" }}
                    >
                        {loading ? "Changing Password..." : "Change Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}

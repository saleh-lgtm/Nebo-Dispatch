"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Shield, ShieldCheck, User, Mail, Calendar, MoreVertical, X, Check, AlertTriangle } from "lucide-react";
import {
    createUser,
    updateUser,
    changeUserRole,
    resetUserPassword,
    deleteUser,
} from "@/lib/userManagementActions";

interface UserData {
    id: string;
    name: string | null;
    email: string | null;
    role: "SUPER_ADMIN" | "ADMIN" | "ACCOUNTING" | "DISPATCHER";
    isActive: boolean;
    lastLogin: Date | null;
    createdAt: Date;
    createdBy: { id: string; name: string | null } | null;
}

interface Stats {
    total: number;
    byRole: { superAdmins: number; admins: number; dispatchers: number };
    active: number;
    inactive: number;
}

interface Props {
    users: UserData[];
    stats: Stats;
    currentUserId: string;
}

export default function UsersClient({ users, stats, currentUserId }: Props) {
    const router = useRouter();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [filter, setFilter] = useState<"all" | "SUPER_ADMIN" | "ADMIN" | "ACCOUNTING" | "DISPATCHER">("all");
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Form states
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "DISPATCHER" as "ADMIN" | "DISPATCHER" });
    const [editData, setEditData] = useState({ name: "", email: "", isActive: true });
    const [newPassword, setNewPassword] = useState("");

    const filteredUsers = filter === "all" ? users : users.filter(u => u.role === filter);

    const getRoleBadge = (role: string) => {
        const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
            SUPER_ADMIN: { bg: "var(--danger-soft)", text: "var(--danger)", icon: <ShieldCheck size={12} /> },
            ADMIN: { bg: "var(--accent-soft)", text: "var(--accent)", icon: <Shield size={12} /> },
            ACCOUNTING: { bg: "var(--warning-soft)", text: "var(--warning)", icon: <Shield size={12} /> },
            DISPATCHER: { bg: "var(--success-soft)", text: "var(--success)", icon: <User size={12} /> },
        };
        const badge = badges[role] || badges.DISPATCHER;
        return (
            <span
                className="flex items-center gap-1"
                style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    background: badge.bg,
                    color: badge.text,
                }}
            >
                {badge.icon}
                {role.replace("_", " ")}
            </span>
        );
    };

    const handleCreate = async () => {
        setLoading(true);
        setError("");
        try {
            await createUser(newUser);
            setSuccess("User created successfully");
            setShowCreateModal(false);
            setNewUser({ name: "", email: "", password: "", role: "DISPATCHER" });
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create user");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async () => {
        if (!selectedUser) return;
        setLoading(true);
        setError("");
        try {
            await updateUser(selectedUser.id, editData);
            setSuccess("User updated successfully");
            setShowEditModal(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update user");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: "ADMIN" | "DISPATCHER") => {
        setLoading(true);
        setError("");
        try {
            await changeUserRole(userId, newRole);
            setSuccess("Role updated successfully");
            setActiveDropdown(null);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to change role");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser) return;
        setLoading(true);
        setError("");
        try {
            await resetUserPassword(selectedUser.id, newPassword);
            setSuccess("Password reset successfully");
            setShowResetPasswordModal(false);
            setNewPassword("");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;
        setLoading(true);
        setError("");
        try {
            await deleteUser(selectedUser.id);
            setSuccess("User deactivated successfully");
            setShowDeleteModal(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to deactivate user");
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (user: UserData) => {
        setSelectedUser(user);
        setEditData({ name: user.name || "", email: user.email || "", isActive: user.isActive });
        setShowEditModal(true);
        setActiveDropdown(null);
    };

    const openResetPasswordModal = (user: UserData) => {
        setSelectedUser(user);
        setNewPassword("");
        setShowResetPasswordModal(true);
        setActiveDropdown(null);
    };

    const openDeleteModal = (user: UserData) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
        setActiveDropdown(null);
    };

    return (
        <div className="animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header style={{ marginBottom: "2rem" }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-display flex items-center gap-3" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                            <Users size={32} className="text-accent" />
                            User Management
                        </h1>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Manage user accounts and permissions
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <UserPlus size={18} />
                        Add User
                    </button>
                </div>
            </header>

            {/* Alerts */}
            {error && (
                <div style={{ padding: "1rem", background: "var(--danger-soft)", border: "1px solid var(--danger-border)", borderRadius: "0.5rem", marginBottom: "1rem", color: "var(--danger)" }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{ padding: "1rem", background: "var(--success-soft)", border: "1px solid var(--success-border)", borderRadius: "0.5rem", marginBottom: "1rem", color: "var(--success)" }}>
                    {success}
                </div>
            )}

            {/* Stats */}
            <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 600 }}>{stats.total}</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total Users</p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 600, color: "var(--danger)" }}>{stats.byRole.superAdmins}</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Super Admins</p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 600, color: "var(--accent)" }}>{stats.byRole.admins}</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Admins</p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 600, color: "var(--success)" }}>{stats.byRole.dispatchers}</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Dispatchers</p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 600 }}>{stats.active}</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Active</p>
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2" style={{ marginBottom: "1.5rem" }}>
                {(["all", "SUPER_ADMIN", "ADMIN", "DISPATCHER"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`btn ${filter === f ? "btn-primary" : ""}`}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                    >
                        {f === "all" ? "All" : f.replace("_", " ")}
                    </button>
                ))}
            </div>

            {/* Users Table */}
            <div className="glass-card" style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                            <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>User</th>
                            <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>Role</th>
                            <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>Status</th>
                            <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>Created</th>
                            <th style={{ padding: "1rem", textAlign: "right", fontWeight: 500 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user) => (
                            <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "1rem" }}>
                                    <div>
                                        <p style={{ fontWeight: 500 }}>{user.name || "Unnamed"}</p>
                                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                            {user.email}
                                        </p>
                                    </div>
                                </td>
                                <td style={{ padding: "1rem" }}>
                                    {getRoleBadge(user.role)}
                                </td>
                                <td style={{ padding: "1rem" }}>
                                    <span
                                        style={{
                                            padding: "0.25rem 0.5rem",
                                            borderRadius: "9999px",
                                            fontSize: "0.75rem",
                                            fontWeight: 500,
                                            background: user.isActive ? "var(--success-soft)" : "var(--danger-soft)",
                                            color: user.isActive ? "var(--success)" : "var(--danger)",
                                        }}
                                    >
                                        {user.isActive ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "right", position: "relative" }}>
                                    {user.role !== "SUPER_ADMIN" && (
                                        <div style={{ position: "relative", display: "inline-block" }}>
                                            <button
                                                onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                                                className="btn"
                                                style={{ padding: "0.5rem" }}
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                            {activeDropdown === user.id && (
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        right: 0,
                                                        top: "100%",
                                                        background: "var(--bg-secondary)",
                                                        border: "1px solid var(--border)",
                                                        borderRadius: "0.5rem",
                                                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                                        minWidth: "150px",
                                                        zIndex: 10,
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => openEditModal(user)}
                                                        style={{ display: "block", width: "100%", padding: "0.75rem 1rem", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
                                                    >
                                                        Edit Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleRoleChange(user.id, user.role === "ADMIN" ? "DISPATCHER" : "ADMIN")}
                                                        style={{ display: "block", width: "100%", padding: "0.75rem 1rem", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
                                                    >
                                                        {user.role === "ADMIN" ? "Demote to Dispatcher" : "Promote to Admin"}
                                                    </button>
                                                    <button
                                                        onClick={() => openResetPasswordModal(user)}
                                                        style={{ display: "block", width: "100%", padding: "0.75rem 1rem", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
                                                    >
                                                        Reset Password
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(user)}
                                                        style={{ display: "block", width: "100%", padding: "0.75rem 1rem", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                                                    >
                                                        Deactivate User
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {user.role === "SUPER_ADMIN" && (
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                            Protected
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", width: "90%" }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Create New User</h2>
                            <button onClick={() => setShowCreateModal(false)} className="btn" style={{ padding: "0.5rem" }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Name</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    className="input"
                                    style={{ width: "100%" }}
                                    placeholder="Full name"
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Email</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    className="input"
                                    style={{ width: "100%" }}
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Password</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    className="input"
                                    style={{ width: "100%" }}
                                    placeholder="Minimum 6 characters"
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value as "ADMIN" | "DISPATCHER" })}
                                    className="input"
                                    style={{ width: "100%" }}
                                >
                                    <option value="DISPATCHER">Dispatcher</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <button
                                onClick={handleCreate}
                                disabled={loading || !newUser.name || !newUser.email || !newUser.password}
                                className="btn btn-primary"
                                style={{ marginTop: "1rem" }}
                            >
                                {loading ? "Creating..." : "Create User"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", width: "90%" }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Edit User</h2>
                            <button onClick={() => setShowEditModal(false)} className="btn" style={{ padding: "0.5rem" }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Name</label>
                                <input
                                    type="text"
                                    value={editData.name}
                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                    className="input"
                                    style={{ width: "100%" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Email</label>
                                <input
                                    type="email"
                                    value={editData.email}
                                    onChange={e => setEditData({ ...editData, email: e.target.value })}
                                    className="input"
                                    style={{ width: "100%" }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={editData.isActive}
                                    onChange={e => setEditData({ ...editData, isActive: e.target.checked })}
                                />
                                <label htmlFor="isActive" style={{ fontSize: "0.875rem" }}>Active</label>
                            </div>
                            <button
                                onClick={handleEdit}
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ marginTop: "1rem" }}
                            >
                                {loading ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetPasswordModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowResetPasswordModal(false)}>
                    <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", width: "90%" }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Reset Password</h2>
                            <button onClick={() => setShowResetPasswordModal(false)} className="btn" style={{ padding: "0.5rem" }}>
                                <X size={18} />
                            </button>
                        </div>
                        <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                            Reset password for <strong>{selectedUser.name}</strong>
                        </p>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem" }}>New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="input"
                                    style={{ width: "100%" }}
                                    placeholder="Minimum 6 characters"
                                />
                            </div>
                            <button
                                onClick={handleResetPassword}
                                disabled={loading || newPassword.length < 6}
                                className="btn btn-primary"
                            >
                                {loading ? "Resetting..." : "Reset Password"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", width: "90%" }}>
                        <div className="flex items-center gap-3" style={{ marginBottom: "1.5rem" }}>
                            <AlertTriangle size={24} color="#ef4444" />
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Deactivate User</h2>
                        </div>
                        <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                            Are you sure you want to deactivate <strong>{selectedUser.name}</strong>? This will prevent them from logging in.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="btn"
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="btn"
                                style={{ flex: 1, background: "var(--danger)", color: "white" }}
                            >
                                {loading ? "Deactivating..." : "Deactivate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                }
                .modal-content {
                    padding: 1.5rem;
                }
            `}</style>
        </div>
    );
}

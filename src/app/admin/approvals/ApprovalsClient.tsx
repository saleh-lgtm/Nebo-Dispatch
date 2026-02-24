"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, User, Mail, Clock, AlertCircle } from "lucide-react";
import { approveUser, rejectUser } from "@/lib/signupActions";

interface PendingUser {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date;
}

interface ApprovalsClientProps {
    pendingUsers: PendingUser[];
    currentUserId: string;
}

export default function ApprovalsClient({ pendingUsers, currentUserId }: ApprovalsClientProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    const handleApprove = async (userId: string) => {
        setLoading(userId);
        setError(null);

        const role = (selectedRole[userId] || "DISPATCHER") as "DISPATCHER" | "ADMIN" | "ACCOUNTING";
        const result = await approveUser(userId, currentUserId, role);

        if (result.success) {
            router.refresh();
        } else {
            setError(result.error || "Failed to approve user");
        }

        setLoading(null);
    };

    const handleReject = async (userId: string) => {
        if (!confirm("Are you sure you want to reject this registration?")) {
            return;
        }

        setLoading(userId);
        setError(null);

        const result = await rejectUser(userId, currentUserId);

        if (result.success) {
            router.refresh();
        } else {
            setError(result.error || "Failed to reject user");
        }

        setLoading(null);
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">User Approvals</h1>
                    <p className="page-subtitle">Review and approve new user registrations</p>
                </div>
            </div>

            {error && (
                <div className="alert-banner alert-banner-critical mb-4">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X size={16} />
                    </button>
                </div>
            )}

            {pendingUsers.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <User size={48} className="empty-state-icon" />
                        <h3>No Pending Approvals</h3>
                        <p className="text-secondary">All user registrations have been reviewed.</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="panel-header">
                        <span className="panel-title">
                            Pending Registrations ({pendingUsers.length})
                        </span>
                    </div>

                    <div className="flex flex-col gap-4">
                        {pendingUsers.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 rounded-lg"
                                style={{ background: "var(--bg-muted)" }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="avatar">
                                        {(user.name || user.email || "U").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-primary">
                                            {user.name || "Unnamed User"}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-secondary">
                                            <span className="flex items-center gap-1">
                                                <Mail size={14} />
                                                {user.email || "No email"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {formatDate(user.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <select
                                        className="input"
                                        style={{ width: "140px" }}
                                        value={selectedRole[user.id] || "DISPATCHER"}
                                        onChange={(e) =>
                                            setSelectedRole({
                                                ...selectedRole,
                                                [user.id]: e.target.value,
                                            })
                                        }
                                        disabled={loading === user.id}
                                    >
                                        <option value="DISPATCHER">Dispatcher</option>
                                        <option value="ACCOUNTING">Accounting</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>

                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => handleApprove(user.id)}
                                        disabled={loading === user.id}
                                    >
                                        <Check size={16} />
                                        {loading === user.id ? "..." : "Approve"}
                                    </button>

                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleReject(user.id)}
                                        disabled={loading === user.id}
                                    >
                                        <X size={16} />
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

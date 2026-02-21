"use client";

import { useState } from "react";
import {
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Plus,
    ChevronDown,
    ChevronUp,
    User,
    MessageSquare,
    Trash2,
} from "lucide-react";
import {
    cancelTimeOff,
    approveTimeOff,
    rejectTimeOff,
} from "@/lib/timeOffActions";
import TimeOffRequestForm from "./TimeOffRequestForm";

interface TimeOffRequest {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    type: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    reviewedById: string | null;
    reviewedBy: { id: string; name: string | null } | null;
    reviewedAt: Date | null;
    adminNotes: string | null;
    createdAt: Date;
    user?: { id: string; name: string | null; email: string | null };
}

interface Props {
    myRequests: TimeOffRequest[];
    pendingRequests?: TimeOffRequest[]; // For admins
    isAdmin: boolean;
}

export default function TimeOffPanel({ myRequests, pendingRequests = [], isAdmin }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

    const statusConfig = {
        PENDING: {
            bg: "rgba(251, 191, 36, 0.1)",
            color: "var(--warning)",
            icon: Clock,
            label: "Pending",
        },
        APPROVED: {
            bg: "rgba(34, 197, 94, 0.1)",
            color: "var(--success)",
            icon: CheckCircle,
            label: "Approved",
        },
        REJECTED: {
            bg: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            icon: XCircle,
            label: "Rejected",
        },
        CANCELLED: {
            bg: "rgba(107, 114, 128, 0.1)",
            color: "var(--text-secondary)",
            icon: AlertCircle,
            label: "Cancelled",
        },
    };

    const typeLabels: Record<string, string> = {
        VACATION: "Vacation",
        SICK: "Sick Leave",
        PERSONAL: "Personal",
        OTHER: "Other",
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatShortDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
    };

    const handleCancel = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this request?")) return;
        setLoading(id);
        try {
            await cancelTimeOff(id);
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to cancel request");
        }
        setLoading(null);
    };

    const handleApprove = async (id: string) => {
        setLoading(id);
        try {
            await approveTimeOff(id, adminNotes[id] || undefined);
            setAdminNotes((prev) => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to approve request");
        }
        setLoading(null);
    };

    const handleReject = async (id: string) => {
        setLoading(id);
        try {
            await rejectTimeOff(id, adminNotes[id] || undefined);
            setAdminNotes((prev) => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to reject request");
        }
        setLoading(null);
    };

    const pendingMyRequests = myRequests.filter((r) => r.status === "PENDING");
    const historyRequests = myRequests.filter((r) => r.status !== "PENDING");

    const RequestCard = ({
        request,
        showUser = false,
        showActions = false,
        canCancel = false,
    }: {
        request: TimeOffRequest;
        showUser?: boolean;
        showActions?: boolean;
        canCancel?: boolean;
    }) => {
        const config = statusConfig[request.status];
        const StatusIcon = config.icon;
        const isExpanded = expandedRequest === request.id;

        return (
            <div
                style={{
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    marginBottom: "0.75rem",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            {showUser && request.user && (
                                <span
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                    }}
                                >
                                    <User size={14} />
                                    {request.user.name || request.user.email}
                                </span>
                            )}
                            <span
                                style={{
                                    background: config.bg,
                                    color: config.color,
                                    padding: "0.125rem 0.5rem",
                                    borderRadius: "0.25rem",
                                    fontSize: "0.7rem",
                                    fontWeight: 500,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                }}
                            >
                                <StatusIcon size={12} />
                                {config.label}
                            </span>
                            <span
                                style={{
                                    background: "var(--bg-tertiary)",
                                    color: "var(--text-secondary)",
                                    padding: "0.125rem 0.5rem",
                                    borderRadius: "0.25rem",
                                    fontSize: "0.7rem",
                                }}
                            >
                                {typeLabels[request.type] || request.type}
                            </span>
                        </div>

                        <div style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontWeight: 500 }}>
                                {formatShortDate(request.startDate)} - {formatShortDate(request.endDate)}
                            </span>
                        </div>

                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                            }}
                            onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                        >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? "Hide details" : "Show details"}
                        </div>
                    </div>

                    {canCancel && request.status === "PENDING" && (
                        <button
                            onClick={() => handleCancel(request.id)}
                            disabled={loading === request.id}
                            style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                color: "var(--danger)",
                                border: "1px solid var(--danger)",
                                borderRadius: "0.5rem",
                                padding: "0.5rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontSize: "0.75rem",
                            }}
                        >
                            <Trash2 size={14} />
                            Cancel
                        </button>
                    )}
                </div>

                {isExpanded && (
                    <div
                        style={{
                            marginTop: "0.75rem",
                            paddingTop: "0.75rem",
                            borderTop: "1px solid var(--border)",
                        }}
                    >
                        <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                            <strong>Reason:</strong> {request.reason}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            <strong>Submitted:</strong> {formatDate(request.createdAt)}
                        </div>
                        {request.reviewedBy && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                                <strong>Reviewed by:</strong> {request.reviewedBy.name || "Admin"} on{" "}
                                {request.reviewedAt ? formatDate(request.reviewedAt) : "N/A"}
                            </div>
                        )}
                        {request.adminNotes && (
                            <div
                                style={{
                                    marginTop: "0.5rem",
                                    padding: "0.5rem",
                                    background: "var(--bg-tertiary)",
                                    borderRadius: "0.25rem",
                                    fontSize: "0.8rem",
                                }}
                            >
                                <strong>Admin Notes:</strong> {request.adminNotes}
                            </div>
                        )}
                    </div>
                )}

                {showActions && request.status === "PENDING" && (
                    <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                        <div style={{ marginBottom: "0.75rem" }}>
                            <label
                                style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-secondary)",
                                    display: "block",
                                    marginBottom: "0.25rem",
                                }}
                            >
                                Admin Notes (optional)
                            </label>
                            <textarea
                                className="input"
                                value={adminNotes[request.id] || ""}
                                onChange={(e) =>
                                    setAdminNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                                }
                                placeholder="Add notes for the employee..."
                                style={{ width: "100%", height: "60px", resize: "none", fontSize: "0.875rem" }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={() => handleApprove(request.id)}
                                disabled={loading === request.id}
                                className="btn"
                                style={{
                                    flex: 1,
                                    background: "rgba(34, 197, 94, 0.1)",
                                    color: "var(--success)",
                                    border: "1px solid var(--success)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                <CheckCircle size={16} />
                                Approve
                            </button>
                            <button
                                onClick={() => handleReject(request.id)}
                                disabled={loading === request.id}
                                className="btn"
                                style={{
                                    flex: 1,
                                    background: "rgba(239, 68, 68, 0.1)",
                                    color: "var(--danger)",
                                    border: "1px solid var(--danger)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                <XCircle size={16} />
                                Reject
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className="glass-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Calendar size={20} style={{ color: "var(--accent)" }} />
                    <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                        Time Off Requests
                    </h2>
                    {(pendingMyRequests.length > 0 || (isAdmin && pendingRequests.length > 0)) && (
                        <span
                            style={{
                                background: "var(--warning)",
                                color: "black",
                                padding: "0.125rem 0.5rem",
                                borderRadius: "9999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                            }}
                        >
                            {pendingMyRequests.length + (isAdmin ? pendingRequests.length : 0)}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="btn btn-secondary"
                    style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    {showForm ? (
                        <>
                            <XCircle size={16} />
                            Cancel
                        </>
                    ) : (
                        <>
                            <Plus size={16} />
                            Request Time Off
                        </>
                    )}
                </button>
            </div>

            {showForm && (
                <div
                    style={{
                        marginBottom: "1.5rem",
                        padding: "1rem",
                        background: "var(--bg-secondary)",
                        borderRadius: "0.75rem",
                        border: "1px solid var(--border)",
                    }}
                >
                    <TimeOffRequestForm
                        onSuccess={() => setShowForm(false)}
                        onCancel={() => setShowForm(false)}
                    />
                </div>
            )}

            {/* Admin: Pending Requests to Review */}
            {isAdmin && pendingRequests.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                    <h3
                        style={{
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        <MessageSquare size={14} />
                        Pending Review ({pendingRequests.length})
                    </h3>
                    {pendingRequests.map((request) => (
                        <RequestCard key={request.id} request={request} showUser showActions />
                    ))}
                </div>
            )}

            {/* My Pending Requests */}
            {pendingMyRequests.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                    <h3
                        style={{
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        <Clock size={14} />
                        My Pending Requests ({pendingMyRequests.length})
                    </h3>
                    {pendingMyRequests.map((request) => (
                        <RequestCard key={request.id} request={request} canCancel />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {pendingMyRequests.length === 0 && (!isAdmin || pendingRequests.length === 0) && !showForm && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-secondary)" }}>
                    <Calendar size={32} style={{ opacity: 0.2, marginBottom: "0.5rem" }} />
                    <p style={{ fontSize: "0.875rem" }}>No pending time off requests.</p>
                </div>
            )}

            {/* History Toggle */}
            {historyRequests.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.875rem",
                            padding: "0.5rem 0",
                        }}
                    >
                        {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {showHistory ? "Hide" : "Show"} Request History ({historyRequests.length})
                    </button>

                    {showHistory && (
                        <div style={{ marginTop: "0.75rem" }}>
                            {historyRequests.map((request) => (
                                <RequestCard key={request.id} request={request} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

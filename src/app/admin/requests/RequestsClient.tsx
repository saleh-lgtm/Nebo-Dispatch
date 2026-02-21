"use client";

import { useState } from "react";
import {
    FileEdit,
    Clock,
    CheckCircle,
    XCircle,
    User,
    Calendar,
    MessageSquare,
    X,
    Check,
    AlertCircle,
    Palmtree,
    RefreshCw,
    UserCheck,
} from "lucide-react";
import { approveRequest, rejectRequest } from "@/lib/adminRequestActions";
import { approveShiftSwap } from "@/lib/timeOffActions";

interface ScheduleData {
    id: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
}

interface Request {
    id: string;
    userId: string;
    type: "HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW" | "TIME_OFF" | "SHIFT_SWAP";
    status: "PENDING" | "APPROVED" | "REJECTED";
    reason: string | null;
    requestedStart: Date | null;
    requestedEnd: Date | null;
    adminNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; name: string | null; email: string | null };
    schedule: ScheduleData | null;
    // Time off fields
    timeOffType: string | null;
    // Shift swap fields
    targetUser: { id: string; name: string | null; email: string | null } | null;
    targetSchedule: ScheduleData | null;
    targetAccepted: boolean | null;
}

interface Props {
    pendingRequests: Request[];
    allRequests: Request[];
    counts: { pending: number; approved: number; rejected: number; total: number };
}

const TYPE_LABELS: Record<string, string> = {
    HOURS_MODIFICATION: "Hours Modification",
    SCHEDULE_CHANGE: "Schedule Change",
    REVIEW: "Review Request",
    TIME_OFF: "Time Off",
    SHIFT_SWAP: "Shift Swap",
};

const TYPE_COLORS: Record<string, string> = {
    HOURS_MODIFICATION: "var(--warning)",
    SCHEDULE_CHANGE: "var(--accent)",
    REVIEW: "var(--info, #3b82f6)",
    TIME_OFF: "#10b981",
    SHIFT_SWAP: "#8b5cf6",
};

const TIME_OFF_LABELS: Record<string, string> = {
    vacation: "Vacation",
    sick: "Sick Leave",
    personal: "Personal",
    other: "Other",
};

export default function RequestsClient({ pendingRequests, allRequests, counts }: Props) {
    const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
    const [requests, setRequests] = useState<Request[]>(pendingRequests);
    const [allReqs, setAllReqs] = useState<Request[]>(allRequests);
    const [actionModal, setActionModal] = useState<{
        request: Request;
        action: "approve" | "reject";
    } | null>(null);
    const [adminNotes, setAdminNotes] = useState("");
    const [applyChanges, setApplyChanges] = useState(false);
    const [loading, setLoading] = useState(false);

    const displayedRequests = activeTab === "pending" ? requests : allReqs;

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatShiftTime = (start: Date, end: Date) => {
        const s = new Date(start);
        const e = new Date(end);
        return `${s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ${s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} - ${e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    };

    const handleAction = async () => {
        if (!actionModal) return;
        setLoading(true);

        try {
            if (actionModal.action === "approve") {
                // Handle shift swap approval differently
                if (actionModal.request.type === "SHIFT_SWAP") {
                    if (!actionModal.request.targetAccepted) {
                        alert("Cannot approve: Target user has not accepted the swap yet");
                        setLoading(false);
                        return;
                    }
                    await approveShiftSwap(actionModal.request.id, adminNotes || undefined);
                } else {
                    await approveRequest(actionModal.request.id, adminNotes || undefined, applyChanges);
                }
            } else {
                if (!adminNotes.trim()) {
                    alert("Please provide a reason for rejection");
                    setLoading(false);
                    return;
                }
                await rejectRequest(actionModal.request.id, adminNotes);
            }

            // Update local state
            const newStatus = actionModal.action === "approve" ? "APPROVED" : "REJECTED";
            setRequests((prev) => prev.filter((r) => r.id !== actionModal.request.id));
            setAllReqs((prev) =>
                prev.map((r) =>
                    r.id === actionModal.request.id
                        ? { ...r, status: newStatus as "APPROVED" | "REJECTED", adminNotes }
                        : r
                )
            );

            setActionModal(null);
            setAdminNotes("");
            setApplyChanges(false);
        } catch (error) {
            console.error("Failed to process request:", error);
            alert(error instanceof Error ? error.message : "Failed to process request");
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING":
                return (
                    <span className="flex items-center gap-1" style={{ color: "var(--warning)" }}>
                        <Clock size={14} /> Pending
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
                        <CheckCircle size={14} /> Approved
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="flex items-center gap-1" style={{ color: "var(--danger)" }}>
                        <XCircle size={14} /> Rejected
                    </span>
                );
            default:
                return status;
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileEdit size={28} className="text-accent" />
                    <div>
                        <h1 className="font-display" style={{ fontSize: "1.75rem" }}>
                            Schedule Requests
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Review and manage dispatcher schedule change requests
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4">
                    <div className="glass-card" style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
                        <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--warning)" }}>
                            {counts.pending}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Pending</p>
                    </div>
                    <div className="glass-card" style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
                        <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)" }}>
                            {counts.approved}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Approved</p>
                    </div>
                    <div className="glass-card" style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
                        <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--danger)" }}>
                            {counts.rejected}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Rejected</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <button
                    onClick={() => setActiveTab("pending")}
                    style={{
                        padding: "0.75rem 1rem",
                        background: "none",
                        border: "none",
                        borderBottom: activeTab === "pending" ? "2px solid var(--accent)" : "2px solid transparent",
                        color: activeTab === "pending" ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: activeTab === "pending" ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    Pending ({requests.length})
                </button>
                <button
                    onClick={() => setActiveTab("all")}
                    style={{
                        padding: "0.75rem 1rem",
                        background: "none",
                        border: "none",
                        borderBottom: activeTab === "all" ? "2px solid var(--accent)" : "2px solid transparent",
                        color: activeTab === "all" ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: activeTab === "all" ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    All Requests
                </button>
            </div>

            {/* Requests List */}
            <div className="flex flex-col gap-4">
                {displayedRequests.map((request) => (
                    <div key={request.id} className="glass-card">
                        <div className="flex justify-between items-start" style={{ marginBottom: "1rem" }}>
                            <div className="flex items-center gap-3">
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: "50%",
                                        background: "rgba(183, 175, 163, 0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <User size={20} className="text-accent" />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 600 }}>{request.user.name || "Unknown"}</h3>
                                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                        {request.user.email}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span
                                    style={{
                                        padding: "0.25rem 0.75rem",
                                        borderRadius: "50px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: `${TYPE_COLORS[request.type]}20`,
                                        color: TYPE_COLORS[request.type],
                                        border: `1px solid ${TYPE_COLORS[request.type]}40`,
                                    }}
                                >
                                    {TYPE_LABELS[request.type]}
                                </span>
                                {getStatusBadge(request.status)}
                            </div>
                        </div>

                        {/* Request Details */}
                        <div
                            className="flex flex-col gap-3"
                            style={{
                                padding: "1rem",
                                background: "rgba(255, 255, 255, 0.02)",
                                borderRadius: "0.5rem",
                                marginBottom: "1rem",
                            }}
                        >
                            {request.reason && (
                                <div className="flex items-start gap-2">
                                    <MessageSquare size={16} style={{ color: "var(--text-secondary)", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                                            Reason
                                        </p>
                                        <p style={{ lineHeight: 1.5 }}>{request.reason}</p>
                                    </div>
                                </div>
                            )}

                            {request.schedule && (
                                <div className="flex items-start gap-2">
                                    <Calendar size={16} style={{ color: "var(--text-secondary)", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                                            Current Shift
                                        </p>
                                        <p>{formatShiftTime(request.schedule.shiftStart, request.schedule.shiftEnd)}</p>
                                    </div>
                                </div>
                            )}

                            {request.requestedStart && request.requestedEnd && (
                                <div className="flex items-start gap-2">
                                    <Calendar size={16} style={{ color: "var(--accent)", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginBottom: 4 }}>
                                            {request.type === "TIME_OFF" ? "Time Off Period" : "Requested Change"}
                                        </p>
                                        <p style={{ color: "var(--accent)" }}>
                                            {formatShiftTime(request.requestedStart, request.requestedEnd)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Time Off Type */}
                            {request.type === "TIME_OFF" && request.timeOffType && (
                                <div className="flex items-start gap-2">
                                    <Palmtree size={16} style={{ color: "#10b981", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                                            Type of Leave
                                        </p>
                                        <p style={{ color: "#10b981" }}>
                                            {TIME_OFF_LABELS[request.timeOffType] || request.timeOffType}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Shift Swap Details */}
                            {request.type === "SHIFT_SWAP" && request.targetUser && (
                                <div className="flex items-start gap-2">
                                    <RefreshCw size={16} style={{ color: "#8b5cf6", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                                            Swap With
                                        </p>
                                        <p style={{ color: "#8b5cf6" }}>
                                            {request.targetUser.name || request.targetUser.email}
                                        </p>
                                        {request.targetAccepted === null && (
                                            <span style={{ fontSize: "0.75rem", color: "var(--warning)" }}>
                                                Awaiting target acceptance
                                            </span>
                                        )}
                                        {request.targetAccepted === true && (
                                            <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--success)" }}>
                                                <UserCheck size={12} /> Accepted by target
                                            </span>
                                        )}
                                        {request.targetAccepted === false && (
                                            <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>
                                                Rejected by target
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {request.type === "SHIFT_SWAP" && request.targetSchedule && (
                                <div className="flex items-start gap-2">
                                    <Calendar size={16} style={{ color: "#8b5cf6", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                                            Target&apos;s Shift
                                        </p>
                                        <p>{formatShiftTime(request.targetSchedule.shiftStart, request.targetSchedule.shiftEnd)}</p>
                                    </div>
                                </div>
                            )}

                            {request.adminNotes && (
                                <div className="flex items-start gap-2" style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--glass-border)" }}>
                                    <AlertCircle size={16} style={{ color: request.status === "APPROVED" ? "var(--success)" : "var(--danger)", marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                                            Admin Notes
                                        </p>
                                        <p>{request.adminNotes}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                Submitted {formatDate(request.createdAt)}
                            </p>

                            {request.status === "PENDING" && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActionModal({ request, action: "reject" })}
                                        className="btn btn-outline"
                                        style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                                    >
                                        <XCircle size={16} /> Reject
                                    </button>
                                    <button
                                        onClick={() => setActionModal({ request, action: "approve" })}
                                        className="btn btn-primary"
                                    >
                                        <CheckCircle size={16} /> Approve
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {displayedRequests.length === 0 && (
                    <div
                        className="glass-card"
                        style={{ textAlign: "center", padding: "3rem" }}
                    >
                        <FileEdit size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
                        <p style={{ color: "var(--text-secondary)" }}>
                            {activeTab === "pending"
                                ? "No pending requests. All caught up!"
                                : "No requests found."}
                        </p>
                    </div>
                )}
            </div>

            {/* Action Modal */}
            {actionModal && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setActionModal(null);
                            setAdminNotes("");
                            setApplyChanges(false);
                        }
                    }}
                >
                    <div className="glass-card w-full max-w-md animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                {actionModal.action === "approve" ? (
                                    <CheckCircle size={24} style={{ color: "var(--success)" }} />
                                ) : (
                                    <XCircle size={24} style={{ color: "var(--danger)" }} />
                                )}
                                <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                    {actionModal.action === "approve" ? "Approve Request" : "Reject Request"}
                                </h2>
                            </div>
                            <button
                                onClick={() => {
                                    setActionModal(null);
                                    setAdminNotes("");
                                    setApplyChanges(false);
                                }}
                                className="btn-icon"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                                    <strong>Dispatcher:</strong> {actionModal.request.user.name}
                                </p>
                                <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                                    <strong>Type:</strong> {TYPE_LABELS[actionModal.request.type]}
                                </p>
                                {actionModal.request.reason && (
                                    <p style={{ fontSize: "0.875rem" }}>
                                        <strong>Reason:</strong> {actionModal.request.reason}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label
                                    className="text-xs uppercase tracking-wider font-bold"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Admin Notes {actionModal.action === "reject" && "(Required)"}
                                </label>
                                <textarea
                                    className="input"
                                    placeholder={
                                        actionModal.action === "approve"
                                            ? "Optional notes for the dispatcher..."
                                            : "Please provide a reason for rejection..."
                                    }
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    style={{ height: "100px", resize: "vertical" }}
                                    required={actionModal.action === "reject"}
                                />
                            </div>

                            {actionModal.action === "approve" &&
                                actionModal.request.requestedStart &&
                                actionModal.request.requestedEnd && (
                                    <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={applyChanges}
                                            onChange={(e) => setApplyChanges(e.target.checked)}
                                            style={{ width: 16, height: 16 }}
                                        />
                                        <span style={{ fontSize: "0.875rem" }}>
                                            Automatically apply the schedule change
                                        </span>
                                    </label>
                                )}

                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => {
                                        setActionModal(null);
                                        setAdminNotes("");
                                        setApplyChanges(false);
                                    }}
                                    className="btn btn-outline"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAction}
                                    className="btn"
                                    style={{
                                        background:
                                            actionModal.action === "approve"
                                                ? "var(--success)"
                                                : "var(--danger)",
                                        color: "white",
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        "Processing..."
                                    ) : actionModal.action === "approve" ? (
                                        <>
                                            <Check size={16} /> Approve
                                        </>
                                    ) : (
                                        <>
                                            <X size={16} /> Reject
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

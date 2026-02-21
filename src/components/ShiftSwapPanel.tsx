"use client";

import { useState, useEffect } from "react";
import {
    ArrowLeftRight,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Plus,
    ChevronDown,
    ChevronUp,
    User,
    Calendar,
    Send,
    Trash2,
    MessageSquare,
} from "lucide-react";
import {
    requestShiftSwap,
    respondToSwap,
    adminApproveSwap,
    adminRejectSwap,
    cancelSwapRequest,
    getSwapableShifts,
} from "@/lib/shiftSwapActions";

interface Schedule {
    id: string;
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
    user?: { id: string; name: string | null };
}

interface SwapRequest {
    id: string;
    requesterId: string;
    targetUserId: string;
    requesterShiftId: string;
    targetShiftId: string;
    status: "PENDING_TARGET" | "PENDING_ADMIN" | "APPROVED" | "REJECTED" | "CANCELLED";
    reason: string | null;
    targetResponse: string | null;
    adminNotes: string | null;
    createdAt: Date;
    requester?: { id: string; name: string | null };
    targetUser?: { id: string; name: string | null };
    requesterShift: Schedule;
    targetShift: Schedule;
    reviewedBy?: { id: string; name: string | null } | null;
}

interface Props {
    madeRequests: SwapRequest[];
    receivedRequests: SwapRequest[];
    pendingTargetRequests: SwapRequest[];
    pendingAdminRequests: SwapRequest[];
    myShifts: Schedule[];
    isAdmin: boolean;
    userId: string;
}

export default function ShiftSwapPanel({
    madeRequests,
    receivedRequests,
    pendingTargetRequests,
    pendingAdminRequests,
    myShifts,
    isAdmin,
    userId,
}: Props) {
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [targetResponse, setTargetResponse] = useState<Record<string, string>>({});
    const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

    // Form state
    const [availableShifts, setAvailableShifts] = useState<Schedule[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [form, setForm] = useState({
        myShiftId: "",
        targetShiftId: "",
        reason: "",
    });
    const [formError, setFormError] = useState<string | null>(null);

    const statusConfig = {
        PENDING_TARGET: {
            bg: "rgba(251, 191, 36, 0.1)",
            color: "var(--warning)",
            icon: Clock,
            label: "Awaiting Response",
        },
        PENDING_ADMIN: {
            bg: "rgba(56, 189, 248, 0.1)",
            color: "var(--accent)",
            icon: Clock,
            label: "Awaiting Admin",
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

    const formatDateTime = (date: Date) => {
        return new Date(date).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatShortDateTime = (date: Date) => {
        return new Date(date).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    // Load available shifts for swap
    useEffect(() => {
        if (showForm) {
            loadAvailableShifts();
        }
    }, [showForm]);

    const loadAvailableShifts = async () => {
        setLoadingShifts(true);
        try {
            const now = new Date();
            const twoWeeksLater = new Date();
            twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

            const result = await getSwapableShifts(now, twoWeeksLater);
            setAvailableShifts(result.availableShifts);
        } catch (err) {
            console.error("Failed to load shifts:", err);
        }
        setLoadingShifts(false);
    };

    const handleSubmitSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!form.myShiftId || !form.targetShiftId) {
            setFormError("Please select both your shift and the shift you want to swap with");
            return;
        }

        const targetShift = availableShifts.find(s => s.id === form.targetShiftId);
        if (!targetShift) {
            setFormError("Target shift not found");
            return;
        }

        setLoading("form");
        try {
            await requestShiftSwap(
                targetShift.userId,
                form.myShiftId,
                form.targetShiftId,
                form.reason || undefined
            );
            setForm({ myShiftId: "", targetShiftId: "", reason: "" });
            setShowForm(false);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to submit swap request");
        }
        setLoading(null);
    };

    const handleRespondToSwap = async (id: string, accept: boolean) => {
        setLoading(id);
        try {
            await respondToSwap(id, accept, targetResponse[id] || undefined);
            setTargetResponse((prev) => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to respond to swap");
        }
        setLoading(null);
    };

    const handleAdminApprove = async (id: string) => {
        setLoading(id);
        try {
            await adminApproveSwap(id, adminNotes[id] || undefined);
            setAdminNotes((prev) => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to approve swap");
        }
        setLoading(null);
    };

    const handleAdminReject = async (id: string) => {
        setLoading(id);
        try {
            await adminRejectSwap(id, adminNotes[id] || undefined);
            setAdminNotes((prev) => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to reject swap");
        }
        setLoading(null);
    };

    const handleCancelSwap = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this swap request?")) return;
        setLoading(id);
        try {
            await cancelSwapRequest(id);
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Failed to cancel swap");
        }
        setLoading(null);
    };

    // Filter requests
    const pendingMadeRequests = madeRequests.filter(
        (r) => r.status === "PENDING_TARGET" || r.status === "PENDING_ADMIN"
    );
    const historyRequests = [
        ...madeRequests.filter((r) => !["PENDING_TARGET", "PENDING_ADMIN"].includes(r.status)),
        ...receivedRequests.filter((r) => !["PENDING_TARGET", "PENDING_ADMIN"].includes(r.status)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const SwapRequestCard = ({
        request,
        type,
    }: {
        request: SwapRequest;
        type: "made" | "received" | "admin";
    }) => {
        const config = statusConfig[request.status];
        const StatusIcon = config.icon;
        const isExpanded = expandedRequest === request.id;
        const canCancel = type === "made" && ["PENDING_TARGET", "PENDING_ADMIN"].includes(request.status);
        const canRespond = type === "received" && request.status === "PENDING_TARGET";
        const canAdminAction = type === "admin" && request.status === "PENDING_ADMIN";

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
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
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
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem" }}>
                                <User size={14} style={{ color: "var(--text-secondary)" }} />
                                <span style={{ fontWeight: 500 }}>
                                    {type === "made"
                                        ? request.targetUser?.name || "Unknown"
                                        : request.requester?.name || "Unknown"}
                                </span>
                            </div>
                            <ArrowLeftRight size={14} style={{ color: "var(--text-secondary)" }} />
                            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                {type === "admin" ? `${request.requester?.name} & ${request.targetUser?.name}` : "You"}
                            </span>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto 1fr",
                                gap: "0.5rem",
                                alignItems: "center",
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                marginBottom: "0.5rem",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Calendar size={12} />
                                {formatShortDateTime(request.requesterShift.shiftStart)}
                            </div>
                            <ArrowLeftRight size={12} />
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Calendar size={12} />
                                {formatShortDateTime(request.targetShift.shiftStart)}
                            </div>
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

                    {canCancel && (
                        <button
                            onClick={() => handleCancelSwap(request.id)}
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
                        {request.reason && (
                            <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                                <strong>Reason:</strong> {request.reason}
                            </div>
                        )}
                        {request.targetResponse && (
                            <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                                <strong>Response:</strong> {request.targetResponse}
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
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                            <strong>Requested:</strong> {formatDateTime(request.createdAt)}
                        </div>
                    </div>
                )}

                {/* Target User Response */}
                {canRespond && (
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
                                Your Response (optional)
                            </label>
                            <textarea
                                className="input"
                                value={targetResponse[request.id] || ""}
                                onChange={(e) =>
                                    setTargetResponse((prev) => ({ ...prev, [request.id]: e.target.value }))
                                }
                                placeholder="Add a message..."
                                style={{ width: "100%", height: "60px", resize: "none", fontSize: "0.875rem" }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={() => handleRespondToSwap(request.id, true)}
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
                                Accept Swap
                            </button>
                            <button
                                onClick={() => handleRespondToSwap(request.id, false)}
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
                                Decline
                            </button>
                        </div>
                    </div>
                )}

                {/* Admin Actions */}
                {canAdminAction && (
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
                                placeholder="Add notes..."
                                style={{ width: "100%", height: "60px", resize: "none", fontSize: "0.875rem" }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={() => handleAdminApprove(request.id)}
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
                                Approve Swap
                            </button>
                            <button
                                onClick={() => handleAdminReject(request.id)}
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

    const totalPending =
        pendingTargetRequests.length +
        pendingMadeRequests.length +
        (isAdmin ? pendingAdminRequests.length : 0);

    return (
        <section className="glass-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <ArrowLeftRight size={20} style={{ color: "var(--accent)" }} />
                    <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                        Shift Swaps
                    </h2>
                    {totalPending > 0 && (
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
                            {totalPending}
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
                            Request Swap
                        </>
                    )}
                </button>
            </div>

            {/* Swap Request Form */}
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
                    <form onSubmit={handleSubmitSwap}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                            <ArrowLeftRight size={18} style={{ color: "var(--accent)" }} />
                            <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Request Shift Swap</h3>
                        </div>

                        {formError && (
                            <div
                                style={{
                                    padding: "0.75rem 1rem",
                                    marginBottom: "1rem",
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid var(--danger)",
                                    borderRadius: "0.5rem",
                                    color: "var(--danger)",
                                    fontSize: "0.875rem",
                                }}
                            >
                                {formError}
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label
                                    style={{
                                        fontSize: "0.875rem",
                                        color: "var(--text-secondary)",
                                        display: "block",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    Your Shift to Swap *
                                </label>
                                <select
                                    className="input"
                                    value={form.myShiftId}
                                    onChange={(e) => setForm({ ...form, myShiftId: e.target.value })}
                                    required
                                    style={{ width: "100%" }}
                                >
                                    <option value="">Select your shift...</option>
                                    {myShifts.map((shift) => (
                                        <option key={shift.id} value={shift.id}>
                                            {formatDateTime(shift.shiftStart)} - {formatShortDateTime(shift.shiftEnd)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label
                                    style={{
                                        fontSize: "0.875rem",
                                        color: "var(--text-secondary)",
                                        display: "block",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    Shift You Want *
                                </label>
                                {loadingShifts ? (
                                    <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", padding: "0.5rem" }}>
                                        Loading available shifts...
                                    </div>
                                ) : (
                                    <select
                                        className="input"
                                        value={form.targetShiftId}
                                        onChange={(e) => setForm({ ...form, targetShiftId: e.target.value })}
                                        required
                                        style={{ width: "100%" }}
                                    >
                                        <option value="">Select a shift to swap with...</option>
                                        {availableShifts.map((shift) => (
                                            <option key={shift.id} value={shift.id}>
                                                {shift.user?.name || "Unknown"} - {formatDateTime(shift.shiftStart)}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label
                                    style={{
                                        fontSize: "0.875rem",
                                        color: "var(--text-secondary)",
                                        display: "block",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    Reason (optional)
                                </label>
                                <textarea
                                    className="input"
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    placeholder="Why do you want to swap this shift?"
                                    style={{ width: "100%", height: "80px", resize: "none" }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading === "form"}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                                >
                                    {loading === "form" ? (
                                        <>
                                            <Clock size={16} />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            Request Swap
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Requests Targeting Me */}
            {pendingTargetRequests.length > 0 && (
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
                        Swap Requests For You ({pendingTargetRequests.length})
                    </h3>
                    {pendingTargetRequests.map((request) => (
                        <SwapRequestCard key={request.id} request={request} type="received" />
                    ))}
                </div>
            )}

            {/* Admin: Pending Admin Approval */}
            {isAdmin && pendingAdminRequests.length > 0 && (
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
                        <AlertCircle size={14} />
                        Pending Admin Approval ({pendingAdminRequests.length})
                    </h3>
                    {pendingAdminRequests.map((request) => (
                        <SwapRequestCard key={request.id} request={request} type="admin" />
                    ))}
                </div>
            )}

            {/* My Pending Swap Requests */}
            {pendingMadeRequests.length > 0 && (
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
                        My Pending Requests ({pendingMadeRequests.length})
                    </h3>
                    {pendingMadeRequests.map((request) => (
                        <SwapRequestCard key={request.id} request={request} type="made" />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {totalPending === 0 && !showForm && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-secondary)" }}>
                    <ArrowLeftRight size={32} style={{ opacity: 0.2, marginBottom: "0.5rem" }} />
                    <p style={{ fontSize: "0.875rem" }}>No pending shift swap requests.</p>
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
                        {showHistory ? "Hide" : "Show"} Swap History ({historyRequests.length})
                    </button>

                    {showHistory && (
                        <div style={{ marginTop: "0.75rem" }}>
                            {historyRequests.map((request) => (
                                <SwapRequestCard
                                    key={request.id}
                                    request={request}
                                    type={request.requesterId === userId ? "made" : "received"}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

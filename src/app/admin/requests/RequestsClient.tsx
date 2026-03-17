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
import { adminApproveSwap } from "@/lib/shiftSwapActions";
import TabBar from "@/components/ui/TabBar";
import styles from "./Requests.module.css";

interface ScheduleData {
    id: string;
    date: Date;
    startHour: number;
    endHour: number;
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
    timeOffType: string | null;
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

    const formatHour = (hour: number) => {
        if (hour === 0) return "12:00 AM";
        if (hour < 12) return `${hour}:00 AM`;
        if (hour === 12) return "12:00 PM";
        return `${hour - 12}:00 PM`;
    };

    const formatShiftTime = (schedule: ScheduleData) => {
        const d = new Date(schedule.date);
        return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ${formatHour(schedule.startHour)} - ${formatHour(schedule.endHour)}`;
    };

    const formatDateRange = (start: Date, end: Date) => {
        const s = new Date(start);
        const e = new Date(end);
        return `${s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ${s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} - ${e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    };

    const handleAction = async () => {
        if (!actionModal) return;
        setLoading(true);

        try {
            if (actionModal.action === "approve") {
                if (actionModal.request.type === "SHIFT_SWAP") {
                    if (!actionModal.request.targetAccepted) {
                        alert("Cannot approve: Target user has not accepted the swap yet");
                        setLoading(false);
                        return;
                    }
                    const swapResult = await adminApproveSwap(actionModal.request.id, adminNotes || undefined);
                    if (!swapResult.success) {
                        alert(swapResult.error || "Failed to approve swap");
                        setLoading(false);
                        return;
                    }
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
                    <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                        <Clock size={14} /> Pending
                    </span>
                );
            case "APPROVED":
                return (
                    <span className={`${styles.statusBadge} ${styles.statusApproved}`}>
                        <CheckCircle size={14} /> Approved
                    </span>
                );
            case "REJECTED":
                return (
                    <span className={`${styles.statusBadge} ${styles.statusRejected}`}>
                        <XCircle size={14} /> Rejected
                    </span>
                );
            default:
                return status;
        }
    };

    const closeModal = () => {
        setActionModal(null);
        setAdminNotes("");
        setApplyChanges(false);
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <FileEdit size={28} className={styles.headerIcon} />
                    <div>
                        <h1 className={styles.headerTitle}>Schedule Requests</h1>
                        <p className={styles.headerSubtitle}>
                            Review and manage dispatcher schedule change requests
                        </p>
                    </div>
                </div>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <p className={`${styles.statValue} ${styles.statValuePending}`}>
                            {counts.pending}
                        </p>
                        <p className={styles.statLabel}>Pending</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={`${styles.statValue} ${styles.statValueApproved}`}>
                            {counts.approved}
                        </p>
                        <p className={styles.statLabel}>Approved</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={`${styles.statValue} ${styles.statValueRejected}`}>
                            {counts.rejected}
                        </p>
                        <p className={styles.statLabel}>Rejected</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <TabBar
                tabs={[
                    { value: "pending", label: "Pending", count: requests.length },
                    { value: "all", label: "All Requests" },
                ]}
                activeTab={activeTab}
                onChange={(v) => setActiveTab(v as "pending" | "all")}
                variant="underline"
                className={styles.tabBar}
            />

            {/* Requests List */}
            <div className={styles.requestList}>
                {displayedRequests.map((request) => (
                    <div key={request.id} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.userInfo}>
                                <div className={styles.userAvatar}>
                                    <User size={20} />
                                </div>
                                <div>
                                    <h3 className={styles.userName}>{request.user.name || "Unknown"}</h3>
                                    <p className={styles.userEmail}>{request.user.email}</p>
                                </div>
                            </div>

                            <div className={styles.cardMeta}>
                                <span
                                    className={styles.typeBadge}
                                    style={{
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
                        <div className={styles.details}>
                            {request.reason && (
                                <div className={styles.detailRow}>
                                    <MessageSquare size={16} className={styles.detailIcon} />
                                    <div>
                                        <p className={styles.detailLabel}>Reason</p>
                                        <p>{request.reason}</p>
                                    </div>
                                </div>
                            )}

                            {request.schedule && (
                                <div className={styles.detailRow}>
                                    <Calendar size={16} className={styles.detailIcon} />
                                    <div>
                                        <p className={styles.detailLabel}>Current Shift</p>
                                        <p>{formatShiftTime(request.schedule)}</p>
                                    </div>
                                </div>
                            )}

                            {request.requestedStart && request.requestedEnd && (
                                <div className={styles.detailRow}>
                                    <Calendar size={16} className={styles.detailIconAccent} />
                                    <div>
                                        <p className={styles.detailLabelAccent}>
                                            {request.type === "TIME_OFF" ? "Time Off Period" : "Requested Change"}
                                        </p>
                                        <p className={styles.detailValueAccent}>
                                            {formatDateRange(request.requestedStart, request.requestedEnd)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {request.type === "TIME_OFF" && request.timeOffType && (
                                <div className={styles.detailRow}>
                                    <Palmtree size={16} className={styles.detailIconGreen} />
                                    <div>
                                        <p className={styles.detailLabel}>Type of Leave</p>
                                        <p className={styles.detailValueGreen}>
                                            {TIME_OFF_LABELS[request.timeOffType] || request.timeOffType}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {request.type === "SHIFT_SWAP" && request.targetUser && (
                                <div className={styles.detailRow}>
                                    <RefreshCw size={16} className={styles.detailIconPurple} />
                                    <div>
                                        <p className={styles.detailLabel}>Swap With</p>
                                        <p className={styles.detailValuePurple}>
                                            {request.targetUser.name || request.targetUser.email}
                                        </p>
                                        {request.targetAccepted === null && (
                                            <span className={`${styles.swapStatus} ${styles.swapStatusPending}`}>
                                                Awaiting target acceptance
                                            </span>
                                        )}
                                        {request.targetAccepted === true && (
                                            <span className={`${styles.swapStatus} ${styles.swapStatusAccepted}`}>
                                                <UserCheck size={12} /> Accepted by target
                                            </span>
                                        )}
                                        {request.targetAccepted === false && (
                                            <span className={`${styles.swapStatus} ${styles.swapStatusRejected}`}>
                                                Rejected by target
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {request.type === "SHIFT_SWAP" && request.targetSchedule && (
                                <div className={styles.detailRow}>
                                    <Calendar size={16} className={styles.detailIconPurple} />
                                    <div>
                                        <p className={styles.detailLabel}>Target&apos;s Shift</p>
                                        <p>{formatShiftTime(request.targetSchedule)}</p>
                                    </div>
                                </div>
                            )}

                            {request.adminNotes && (
                                <div className={styles.adminNotesRow}>
                                    <AlertCircle
                                        size={16}
                                        style={{
                                            color: request.status === "APPROVED" ? "var(--success)" : "var(--danger)",
                                            marginTop: 2,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div>
                                        <p className={styles.detailLabel}>Admin Notes</p>
                                        <p>{request.adminNotes}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={styles.cardFooter}>
                            <p className={styles.submittedDate}>
                                Submitted {formatDate(request.createdAt)}
                            </p>

                            {request.status === "PENDING" && (
                                <div className={styles.cardActions}>
                                    <button
                                        onClick={() => setActionModal({ request, action: "reject" })}
                                        className={`btn btn-outline ${styles.rejectBtn}`}
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
                    <div className={styles.emptyState}>
                        <FileEdit size={48} className={styles.emptyIcon} />
                        <p className={styles.emptyText}>
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
                    className={styles.overlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeModal();
                    }}
                >
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                {actionModal.action === "approve" ? (
                                    <CheckCircle size={24} style={{ color: "var(--success)" }} />
                                ) : (
                                    <XCircle size={24} style={{ color: "var(--danger)" }} />
                                )}
                                <h2 className={styles.modalTitle}>
                                    {actionModal.action === "approve" ? "Approve Request" : "Reject Request"}
                                </h2>
                            </div>
                            <button onClick={closeModal} className="btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.modalInfo}>
                                <p>
                                    <strong>Dispatcher:</strong> {actionModal.request.user.name}
                                </p>
                                <p>
                                    <strong>Type:</strong> {TYPE_LABELS[actionModal.request.type]}
                                </p>
                                {actionModal.request.reason && (
                                    <p>
                                        <strong>Reason:</strong> {actionModal.request.reason}
                                    </p>
                                )}
                            </div>

                            <div className={styles.modalField}>
                                <label className={styles.modalLabel}>
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
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={applyChanges}
                                            onChange={(e) => setApplyChanges(e.target.checked)}
                                            className={styles.checkbox}
                                        />
                                        <span>Automatically apply the schedule change</span>
                                    </label>
                                )}

                            <div className={styles.modalFooter}>
                                <button onClick={closeModal} className="btn btn-outline">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAction}
                                    className={`btn ${actionModal.action === "approve" ? styles.approveBtn : styles.rejectActionBtn}`}
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

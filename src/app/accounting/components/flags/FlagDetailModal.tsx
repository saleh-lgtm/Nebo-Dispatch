"use client";

import { X, Eye, CheckCircle } from "lucide-react";
import styles from "../../Accounting.module.css";
import type { AccountingFlag } from "./types";

interface FlagDetailModalProps {
    flag: AccountingFlag;
    onClose: () => void;
    onStartReview: (flagId: string) => void;
    onOpenResolve: () => void;
}

function getStatusColor(status: string) {
    switch (status) {
        case "PENDING":
            return { bg: "var(--warning-soft)", text: "var(--warning)" };
        case "IN_REVIEW":
            return { bg: "var(--info-soft)", text: "var(--info)" };
        case "RESOLVED":
            return { bg: "var(--success-soft)", text: "var(--success)" };
        default:
            return { bg: "var(--bg-muted)", text: "var(--text-secondary)" };
    }
}

function getTypeColor(type: string) {
    switch (type) {
        case "accepted":
            return "var(--success)";
        case "modified":
            return "var(--info)";
        case "cancelled":
            return "var(--danger)";
        default:
            return "var(--text-secondary)";
    }
}

export default function FlagDetailModal({
    flag,
    onClose,
    onStartReview,
    onOpenResolve,
}: FlagDetailModalProps) {
    const statusColor = getStatusColor(flag.status);
    const typeColor = getTypeColor(flag.reservationType);

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>Flag Details</h3>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.detailGrid}>
                        <div className={styles.detailItem}>
                            <label>Reservation ID</label>
                            <span>#{flag.reservationId}</span>
                        </div>
                        <div className={styles.detailItem}>
                            <label>Type</label>
                            <span style={{ color: typeColor }}>
                                {flag.reservationType.toUpperCase()}
                            </span>
                        </div>
                        <div className={styles.detailItem}>
                            <label>Status</label>
                            <span
                                className={styles.statusBadge}
                                style={{
                                    background: statusColor.bg,
                                    color: statusColor.text,
                                }}
                            >
                                {flag.status.replace("_", " ")}
                            </span>
                        </div>
                        <div className={styles.detailItem}>
                            <label>Flagged By</label>
                            <span>{flag.flaggedBy.name || "Unknown"}</span>
                        </div>
                        <div className={styles.detailItem}>
                            <label>Dispatcher</label>
                            <span>{flag.shiftReport.user.name || "Unknown"}</span>
                        </div>
                        <div className={styles.detailItem}>
                            <label>Created</label>
                            <span>{new Date(flag.createdAt).toLocaleString()}</span>
                        </div>
                    </div>

                    {flag.flagReason && (
                        <div className={styles.detailSection}>
                            <label>Flag Reason</label>
                            <p>{flag.flagReason}</p>
                        </div>
                    )}

                    {flag.reservationNotes && (
                        <div className={styles.detailSection}>
                            <label>Reservation Notes</label>
                            <p>{flag.reservationNotes}</p>
                        </div>
                    )}

                    {flag.accountingNotes && (
                        <div className={styles.detailSection}>
                            <label>Accounting Notes</label>
                            <p>{flag.accountingNotes}</p>
                        </div>
                    )}

                    {flag.resolution && (
                        <div className={styles.detailSection}>
                            <label>Resolution</label>
                            <p>{flag.resolution}</p>
                        </div>
                    )}

                    {flag.reviewedBy && (
                        <div className={styles.detailSection}>
                            <label>Reviewed By</label>
                            <p>
                                {flag.reviewedBy.name} on{" "}
                                {flag.reviewedAt
                                    ? new Date(flag.reviewedAt).toLocaleString()
                                    : "N/A"}
                            </p>
                        </div>
                    )}
                </div>
                <div className={styles.modalFooter}>
                    {flag.status === "PENDING" && (
                        <button
                            onClick={() => onStartReview(flag.id)}
                            className={`${styles.btn} ${styles.btnPrimary}`}
                        >
                            <Eye size={16} />
                            Start Review
                        </button>
                    )}
                    {flag.status === "IN_REVIEW" && (
                        <button
                            onClick={onOpenResolve}
                            className={`${styles.btn} ${styles.btnSuccess}`}
                        >
                            <CheckCircle size={16} />
                            Resolve
                        </button>
                    )}
                    <button onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

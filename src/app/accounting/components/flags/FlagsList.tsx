"use client";

import {
    Flag,
    Eye,
    CheckCircle,
    FileText,
    User,
    Calendar,
    Clock,
    MessageSquare,
} from "lucide-react";
import styles from "../../Accounting.module.css";
import type { AccountingFlag } from "./types";

interface FlagsListProps {
    flags: AccountingFlag[];
    loading: boolean;
    activeTab: "PENDING" | "IN_REVIEW" | "RESOLVED" | "ALL";
    onSelectFlag: (flag: AccountingFlag) => void;
    onStartReview: (flagId: string) => void;
    onOpenResolve: (flag: AccountingFlag) => void;
}

function getStatusColor(status: string) {
    switch (status) {
        case "PENDING":
            return { bg: "var(--warning-soft)", text: "var(--warning)", border: "var(--warning-border)" };
        case "IN_REVIEW":
            return { bg: "var(--info-soft)", text: "var(--info)", border: "var(--info-border)" };
        case "RESOLVED":
            return { bg: "var(--success-soft)", text: "var(--success)", border: "var(--success-border)" };
        default:
            return { bg: "var(--bg-muted)", text: "var(--text-secondary)", border: "var(--border)" };
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

export default function FlagsList({
    flags,
    loading,
    activeTab,
    onSelectFlag,
    onStartReview,
    onOpenResolve,
}: FlagsListProps) {
    if (loading) {
        return (
            <div className={styles.flagsCard}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    if (flags.length === 0) {
        return (
            <div className={styles.flagsCard}>
                <div className={styles.emptyState}>
                    <Flag size={48} />
                    <h3>No flagged reservations</h3>
                    <p>
                        {activeTab === "PENDING"
                            ? "No reservations are pending review"
                            : activeTab === "IN_REVIEW"
                            ? "No reservations are currently being reviewed"
                            : activeTab === "RESOLVED"
                            ? "No resolved flags yet"
                            : "No flags found"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.flagsCard}>
            <div className={styles.flagsList}>
                {flags.map((flag) => {
                    const statusColor = getStatusColor(flag.status);
                    const typeColor = getTypeColor(flag.reservationType);

                    return (
                        <div key={flag.id} className={styles.flagItem}>
                            <div className={styles.flagHeader}>
                                <div className={styles.flagInfo}>
                                    <span
                                        className={styles.reservationType}
                                        style={{ color: typeColor }}
                                    >
                                        {flag.reservationType.toUpperCase()}
                                    </span>
                                    <span className={styles.reservationId}>
                                        #{flag.reservationId}
                                    </span>
                                    <span
                                        className={styles.flagStatus}
                                        style={{
                                            background: statusColor.bg,
                                            color: statusColor.text,
                                            border: `1px solid ${statusColor.border}`,
                                        }}
                                    >
                                        {flag.status.replace("_", " ")}
                                    </span>
                                </div>
                                <div className={styles.flagActions}>
                                    {flag.status === "PENDING" && (
                                        <button
                                            onClick={() => onStartReview(flag.id)}
                                            className={`${styles.actionBtn} ${styles.actionReview}`}
                                        >
                                            <Eye size={14} />
                                            Start Review
                                        </button>
                                    )}
                                    {flag.status === "IN_REVIEW" && (
                                        <button
                                            onClick={() => onOpenResolve(flag)}
                                            className={`${styles.actionBtn} ${styles.actionResolve}`}
                                        >
                                            <CheckCircle size={14} />
                                            Resolve
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onSelectFlag(flag)}
                                        className={`${styles.actionBtn} ${styles.actionView}`}
                                    >
                                        <FileText size={14} />
                                        Details
                                    </button>
                                </div>
                            </div>

                            <div className={styles.flagBody}>
                                <div className={styles.flagMeta}>
                                    <span className={styles.metaItem}>
                                        <User size={12} />
                                        {flag.shiftReport.user.name || "Unknown"}
                                    </span>
                                    <span className={styles.metaItem}>
                                        <Calendar size={12} />
                                        {new Date(flag.createdAt).toLocaleDateString()}
                                    </span>
                                    <span className={styles.metaItem}>
                                        <Clock size={12} />
                                        {new Date(flag.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>

                                {flag.flagReason && (
                                    <div className={styles.flagReason}>
                                        <MessageSquare size={14} />
                                        <span>{flag.flagReason}</span>
                                    </div>
                                )}

                                {flag.reservationNotes && (
                                    <p className={styles.flagNotes}>{flag.reservationNotes}</p>
                                )}

                                {flag.resolution && (
                                    <div className={styles.flagResolution}>
                                        <CheckCircle size={14} />
                                        <span>Resolution: {flag.resolution}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

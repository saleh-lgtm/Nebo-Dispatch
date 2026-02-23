"use client";

import { useState } from "react";
import { FileText, ChevronRight, Timer, Flag } from "lucide-react";
import { Quote, formatTimeUntilExpiry } from "./types";
import QuotesModal from "./QuotesModal";
import styles from "./QuotesPanel.module.css";

interface Props {
    quotes: Quote[];
}

export default function QuotesPanel({ quotes }: Props) {
    const [showModal, setShowModal] = useState(false);
    const activeQuotes = quotes.filter(q => q.status === "PENDING" || q.status === "FOLLOWING_UP");
    const flaggedCount = activeQuotes.filter(q => q.isFlagged).length;
    const expiringCount = activeQuotes.filter(q => {
        const exp = formatTimeUntilExpiry(q.expiresAt);
        return exp.urgent && !exp.expired;
    }).length;

    const hasUrgent = flaggedCount > 0 || expiringCount > 0;

    return (
        <>
            <button onClick={() => setShowModal(true)} className={styles.trigger}>
                <div className={styles.triggerContent}>
                    <div className={`${styles.triggerIcon} ${hasUrgent ? styles.urgent : ""}`}>
                        <FileText size={24} />
                        {hasUrgent && (
                            <span className={styles.timerIndicator}>
                                <Timer size={12} />
                            </span>
                        )}
                    </div>
                    <div className={styles.triggerText}>
                        <h3>Quote Follow-ups</h3>
                        <p>
                            {activeQuotes.length === 0 ? (
                                "No pending quotes"
                            ) : (
                                <span className={styles.triggerStats}>
                                    <span>{activeQuotes.length} pending</span>
                                    {flaggedCount > 0 && (
                                        <span className={styles.statFlagged}>
                                            <Flag size={12} />
                                            {flaggedCount} flagged
                                        </span>
                                    )}
                                    {expiringCount > 0 && (
                                        <span className={styles.statExpiring}>
                                            <Timer size={12} />
                                            {expiringCount} expiring
                                        </span>
                                    )}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className={styles.triggerRight}>
                    {activeQuotes.length > 0 && (
                        <span className={`${styles.triggerBadge} ${hasUrgent ? styles.urgent : ""}`}>
                            {activeQuotes.length}
                        </span>
                    )}
                    <ChevronRight size={20} className={styles.triggerArrow} />
                </div>
            </button>

            {showModal && (
                <QuotesModal
                    quotes={quotes}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}

"use client";

import { useState } from "react";
import {
    FileText,
    Phone,
    Mail,
    Clock,
    Plus,
    RefreshCw,
    X,
    Timer,
    Calendar,
    Flag,
    Hourglass,
} from "lucide-react";
import { Quote, statusColors, formatTimeSince, formatTimeUntilExpiry } from "./types";
import AddQuoteModal from "./AddQuoteModal";
import QuoteDetailModal from "./QuoteDetailModal";
import styles from "./QuotesModal.module.css";

interface Props {
    quotes: Quote[];
    onClose: () => void;
}

export default function QuotesModal({ quotes, onClose }: Props) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"active" | "all">("active");

    const isOverdue = (nextFollowUp: Date | null) => {
        if (!nextFollowUp) return false;
        return new Date(nextFollowUp) < new Date();
    };

    const activeQuotes = quotes.filter(q => q.status === "PENDING" || q.status === "FOLLOWING_UP");
    const displayQuotes = activeTab === "active" ? activeQuotes : quotes;

    const sortedQuotes = [...displayQuotes].sort((a, b) => {
        if (a.isFlagged && !b.isFlagged) return -1;
        if (!a.isFlagged && b.isFlagged) return 1;
        if (a.nextFollowUp && b.nextFollowUp) {
            return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
        }
        return 0;
    });

    return (
        <>
            <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className={styles.modal}>
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            <FileText size={24} />
                            <h2>Quote Follow-ups</h2>
                        </div>
                        <div className={styles.headerActions}>
                            <button onClick={() => setShowAddModal(true)} className={styles.btnPrimary}>
                                <Plus size={16} />
                                Add Quote
                            </button>
                            <button onClick={onClose} className={styles.closeBtn}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button
                            onClick={() => setActiveTab("active")}
                            className={`${styles.tab} ${activeTab === "active" ? styles.active : ""}`}
                        >
                            Active ({activeQuotes.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`${styles.tab} ${activeTab === "all" ? styles.active : ""}`}
                        >
                            All ({quotes.length})
                        </button>
                    </div>

                    {/* Content */}
                    <div className={styles.content}>
                        {sortedQuotes.length === 0 ? (
                            <div className={styles.emptyState}>
                                <FileText size={48} />
                                <p>No quotes to display</p>
                                <span>Click "Add Quote" to create a new quote.</span>
                            </div>
                        ) : (
                            <div className={styles.quotesList}>
                                {sortedQuotes.map((quote) => {
                                    const expiry = formatTimeUntilExpiry(quote.expiresAt);
                                    const showExpiryWarning = (quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && expiry.urgent;
                                    const overdue = isOverdue(quote.nextFollowUp) && (quote.status === "PENDING" || quote.status === "FOLLOWING_UP");

                                    return (
                                        <div
                                            key={quote.id}
                                            onClick={() => setSelectedQuoteId(quote.id)}
                                            className={`${styles.quoteCard} ${quote.isFlagged ? styles.flagged : ""} ${overdue ? styles.overdue : ""}`}
                                        >
                                            <div className={styles.quoteHeader}>
                                                <div className={styles.quoteTitle}>
                                                    {quote.isFlagged && <Flag size={14} className={styles.flagIcon} />}
                                                    <h4>{quote.clientName}</h4>
                                                    <span className={styles.statusBadge} style={{ background: statusColors[quote.status].bg, color: statusColors[quote.status].color }}>
                                                        {statusColors[quote.status].label}
                                                    </span>
                                                    {showExpiryWarning && (
                                                        <span className={`${styles.expiryBadge} ${expiry.expired ? styles.expired : ""}`}>
                                                            <Hourglass size={10} />
                                                            {expiry.text}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={styles.quoteMetaRight}>
                                                    <span><RefreshCw size={10} /> {quote.followUpCount} follow-ups</span>
                                                    <span><Timer size={10} /> {formatTimeSince(quote.lastActionAt)}</span>
                                                </div>
                                            </div>

                                            <p className={styles.quoteSubtitle}>
                                                {quote.serviceType}
                                                {quote.estimatedAmount && ` • $${quote.estimatedAmount.toLocaleString()}`}
                                                {quote.source && ` • via ${quote.source}`}
                                            </p>

                                            <div className={styles.quoteDetails}>
                                                {quote.clientPhone && (
                                                    <span><Phone size={12} /> {quote.clientPhone}</span>
                                                )}
                                                {quote.clientEmail && (
                                                    <span><Mail size={12} /> {quote.clientEmail}</span>
                                                )}
                                                {quote.dateOfService && (
                                                    <span><Calendar size={12} /> Service: {new Date(quote.dateOfService).toLocaleDateString()}</span>
                                                )}
                                                {(quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && quote.nextFollowUp && (
                                                    <span className={overdue ? styles.overdueText : ""}>
                                                        <Clock size={12} />
                                                        {overdue ? "Overdue" : "Next"}: {new Date(quote.nextFollowUp).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            <div className={styles.quoteFooter}>
                                                Created by {quote.createdBy.name || "Unknown"} • {new Date(quote.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showAddModal && <AddQuoteModal onClose={() => setShowAddModal(false)} />}
            {selectedQuoteId && <QuoteDetailModal quoteId={selectedQuoteId} onClose={() => setSelectedQuoteId(null)} />}
        </>
    );
}

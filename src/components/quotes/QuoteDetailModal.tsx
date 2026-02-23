"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    FileText,
    Clock,
    Plus,
    RefreshCw,
    MessageSquare,
    X,
    Timer,
    User,
    PhoneCall,
    Send,
    MessageCircle,
    History,
    Trophy,
    ThumbsDown,
    Flag,
    Hourglass,
} from "lucide-react";
import {
    recordQuoteAction,
    setQuoteOutcome,
    addQuoteNote,
    getQuoteWithHistory,
} from "@/lib/quoteActions";
import { Quote, statusColors, formatTimeSince, formatTimeUntilExpiry } from "./types";
import styles from "./QuoteDetailModal.module.css";

interface Props {
    quoteId: string;
    onClose: () => void;
}

export default function QuoteDetailModal({ quoteId, onClose }: Props) {
    const router = useRouter();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [noteInput, setNoteInput] = useState("");
    const [showOutcomeModal, setShowOutcomeModal] = useState<"WON" | "LOST" | null>(null);
    const [outcomeReason, setOutcomeReason] = useState("");
    const [activeTab, setActiveTab] = useState<"actions" | "details">("actions");

    useEffect(() => {
        loadQuote();
    }, [quoteId]);

    const loadQuote = async () => {
        setLoading(true);
        try {
            const data = await getQuoteWithHistory(quoteId);
            setQuote(data as unknown as Quote);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleAction = async (actionType: "CALLED" | "EMAILED" | "TEXTED" | "FOLLOW_UP") => {
        if (!noteInput.trim()) return;
        setActionLoading(true);
        try {
            await recordQuoteAction(quoteId, actionType, noteInput);
            setNoteInput("");
            await loadQuote();
            router.refresh();
        } catch (e) {
            console.error(e);
        }
        setActionLoading(false);
    };

    const handleAddNote = async () => {
        if (!noteInput.trim()) return;
        setActionLoading(true);
        try {
            await addQuoteNote(quoteId, noteInput);
            setNoteInput("");
            await loadQuote();
            router.refresh();
        } catch (e) {
            console.error(e);
        }
        setActionLoading(false);
    };

    const handleOutcome = async () => {
        if (!showOutcomeModal) return;
        setActionLoading(true);
        try {
            await setQuoteOutcome(quoteId, showOutcomeModal, outcomeReason || undefined);
            setShowOutcomeModal(null);
            setOutcomeReason("");
            await loadQuote();
            router.refresh();
        } catch (e) {
            console.error(e);
        }
        setActionLoading(false);
    };

    const actionTypeIcons: Record<string, React.ReactNode> = {
        CREATED: <Plus size={14} />,
        CALLED: <PhoneCall size={14} />,
        EMAILED: <Send size={14} />,
        TEXTED: <MessageCircle size={14} />,
        FOLLOW_UP: <RefreshCw size={14} />,
        NOTE_ADDED: <MessageSquare size={14} />,
        REASSIGNED: <User size={14} />,
        STATUS_CHANGE: <Clock size={14} />,
        OUTCOME_SET: <Trophy size={14} />,
    };

    if (loading) {
        return (
            <div className={styles.loadingOverlay}>
                <span>Loading...</span>
            </div>
        );
    }

    if (!quote) {
        onClose();
        return null;
    }

    const expiry = formatTimeUntilExpiry(quote.expiresAt);
    const isActive = quote.status === "PENDING" || quote.status === "FOLLOWING_UP";

    return (
        <>
            <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className={styles.modal}>
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.headerTitle}>
                                {quote.isFlagged && <Flag size={16} className={styles.flag} />}
                                <h2>{quote.clientName}</h2>
                                <span className={styles.status} style={{ background: statusColors[quote.status].bg, color: statusColors[quote.status].color }}>
                                    {statusColors[quote.status].label}
                                </span>
                            </div>
                            <p className={styles.headerSubtitle}>
                                {quote.serviceType} • ${quote.estimatedAmount?.toLocaleString() || "TBD"}
                            </p>
                        </div>
                        <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                    </div>

                    {/* Stats */}
                    <div className={styles.statsRow}>
                        <span><Timer size={14} /> Last: {formatTimeSince(quote.lastActionAt)}</span>
                        <span><RefreshCw size={14} /> {quote.actionCount} actions</span>
                        {isActive && (
                            <span className={expiry.urgent ? styles.urgent : ""}>
                                <Hourglass size={14} /> {expiry.text}
                            </span>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button onClick={() => setActiveTab("actions")} className={activeTab === "actions" ? styles.active : ""}>
                            <History size={14} /> Activity
                        </button>
                        <button onClick={() => setActiveTab("details")} className={activeTab === "details" ? styles.active : ""}>
                            <FileText size={14} /> Details
                        </button>
                    </div>

                    {/* Content */}
                    <div className={styles.content}>
                        {activeTab === "actions" ? (
                            <div className={styles.actionsTab}>
                                {isActive && (
                                    <>
                                        <div className={styles.actionInput}>
                                            <textarea
                                                placeholder="Add notes about your action..."
                                                value={noteInput}
                                                onChange={(e) => setNoteInput(e.target.value)}
                                            />
                                            <div className={styles.actionBtns}>
                                                <button onClick={() => handleAction("CALLED")} disabled={actionLoading || !noteInput.trim()}>
                                                    <PhoneCall size={14} /> Called
                                                </button>
                                                <button onClick={() => handleAction("EMAILED")} disabled={actionLoading || !noteInput.trim()}>
                                                    <Send size={14} /> Emailed
                                                </button>
                                                <button onClick={() => handleAction("TEXTED")} disabled={actionLoading || !noteInput.trim()}>
                                                    <MessageCircle size={14} /> Texted
                                                </button>
                                                <button onClick={handleAddNote} disabled={actionLoading || !noteInput.trim()}>
                                                    <MessageSquare size={14} /> Note
                                                </button>
                                            </div>
                                        </div>

                                        <div className={styles.outcomeBtns}>
                                            <button className={styles.won} onClick={() => setShowOutcomeModal("WON")}>
                                                <Trophy size={16} /> Mark as Won
                                            </button>
                                            <button className={styles.lost} onClick={() => setShowOutcomeModal("LOST")}>
                                                <ThumbsDown size={16} /> Mark as Lost
                                            </button>
                                        </div>
                                    </>
                                )}

                                {quote.outcome && (
                                    <div className={`${styles.outcomeBox} ${quote.outcome === "WON" ? styles.outcomeWon : styles.outcomeLost}`}>
                                        <div className={styles.outcomeHeader}>
                                            {quote.outcome === "WON" ? <Trophy size={18} /> : <ThumbsDown size={18} />}
                                            <span>Quote {quote.outcome === "WON" ? "Won" : "Lost"}</span>
                                            {quote.outcomeAt && (
                                                <span className={styles.outcomeDate}>• {new Date(quote.outcomeAt).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                        {quote.outcomeReason && <p>{quote.outcomeReason}</p>}
                                    </div>
                                )}

                                <div className={styles.activitySection}>
                                    <h4>Activity History</h4>
                                    <div className={styles.activityList}>
                                        {quote.actions && quote.actions.length > 0 ? (
                                            quote.actions.map((action) => (
                                                <div key={action.id} className={styles.activityItem}>
                                                    <div className={styles.activityHeader}>
                                                        <span className={styles.activityType}>
                                                            {actionTypeIcons[action.actionType] || <Clock size={14} />}
                                                            {action.actionType.replace("_", " ")}
                                                        </span>
                                                        <span className={styles.activityTime}>{formatTimeSince(action.createdAt)}</span>
                                                    </div>
                                                    {action.notes && <p className={styles.activityNotes}>{action.notes}</p>}
                                                    <span className={styles.activityUser}>by {action.user.name || "Unknown"}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className={styles.noActivity}>No activity recorded yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.detailsTab}>
                                <div className={styles.detailSection}>
                                    <h4>Contact Information</h4>
                                    <div className={styles.detailGrid}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.label}>Email</span>
                                            <span className={styles.value}>{quote.clientEmail || "—"}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.label}>Phone</span>
                                            <span className={styles.value}>{quote.clientPhone || "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.detailSection}>
                                    <h4>Service Details</h4>
                                    <div className={styles.detailGrid}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.label}>Service Type</span>
                                            <span className={styles.value}>{quote.serviceType}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.label}>Source</span>
                                            <span className={styles.value}>{quote.source || "—"}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.label}>Date of Service</span>
                                            <span className={styles.value}>{quote.dateOfService ? new Date(quote.dateOfService).toLocaleDateString() : "—"}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.label}>Estimated Amount</span>
                                            <span className={styles.value}>{quote.estimatedAmount ? `$${quote.estimatedAmount.toLocaleString()}` : "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                {quote.notes && (
                                    <div className={styles.detailSection}>
                                        <h4>Notes</h4>
                                        <p className={styles.notesText}>{quote.notes}</p>
                                    </div>
                                )}

                                <div className={styles.metaSection}>
                                    <div className={styles.metaRow}>
                                        <span>Created by: {quote.createdBy.name || "Unknown"}</span>
                                        <span>Created: {new Date(quote.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className={styles.metaRow}>
                                        <span>Assigned to: {quote.assignedTo?.name || "Unassigned"}</span>
                                        <span>Expires: {new Date(quote.expiresAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showOutcomeModal && (
                <div className={styles.outcomeOverlay} onClick={(e) => e.target === e.currentTarget && setShowOutcomeModal(null)}>
                    <div className={styles.outcomeModal}>
                        <h3>{showOutcomeModal === "WON" ? "Mark Quote as Won" : "Mark Quote as Lost"}</h3>
                        <div className={styles.formGroup}>
                            <label>Reason (optional)</label>
                            <textarea
                                placeholder={showOutcomeModal === "WON" ? "Booking details..." : "Reason for loss..."}
                                value={outcomeReason}
                                onChange={(e) => setOutcomeReason(e.target.value)}
                            />
                        </div>
                        <div className={styles.outcomeActions}>
                            <button onClick={handleOutcome} className={showOutcomeModal === "WON" ? styles.btnSuccess : styles.btnDanger} disabled={actionLoading}>
                                {actionLoading ? "Saving..." : "Confirm"}
                            </button>
                            <button onClick={() => setShowOutcomeModal(null)} className={styles.btnSecondary}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    FileText,
    Phone,
    Mail,
    Clock,
    Plus,
    RefreshCw,
    MessageSquare,
    X,
    ChevronRight,
    Timer,
    Calendar,
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
    createQuote,
    recordQuoteAction,
    setQuoteOutcome,
    addQuoteNote,
    getQuoteWithHistory,
} from "@/lib/quoteActions";
import { useSession } from "next-auth/react";

interface QuoteAction {
    id: string;
    actionType: string;
    notes: string | null;
    createdAt: Date;
    user: { id: string; name: string | null };
}

interface Quote {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceType: string;
    source: string | null;
    dateOfService: Date | null;
    pickupDate: Date | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    estimatedAmount: number | null;
    notes: string | null;
    status: "PENDING" | "FOLLOWING_UP" | "CONVERTED" | "LOST" | "EXPIRED";
    outcome: "WON" | "LOST" | null;
    outcomeReason: string | null;
    outcomeAt?: Date;
    followUpCount: number;
    lastFollowUp: Date | null;
    nextFollowUp: Date | null;
    lastActionAt: Date | null;
    actionCount: number;
    isFlagged: boolean;
    expiresAt: Date;
    followUpNotes: string | null;
    createdBy: { id: string; name: string | null };
    assignedTo: { id: string; name: string | null } | null;
    createdAt: Date;
    actions?: QuoteAction[];
}

interface Props {
    quotes: Quote[];
}

function formatTimeSince(date: Date | null): string {
    if (!date) return "Never";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
}

function formatTimeUntilExpiry(expiresAt: Date): { text: string; urgent: boolean; expired: boolean } {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return { text: "Expired", urgent: true, expired: true };

    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffHours < 1) return { text: `${diffMins}m left`, urgent: true, expired: false };
    if (diffHours < 24) return { text: `${diffHours}h left`, urgent: diffHours < 12, expired: false };
    return { text: `${Math.floor(diffHours / 24)}d left`, urgent: false, expired: false };
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
            <button onClick={() => setShowModal(true)} className="quotes-trigger">
                <div className="trigger-content">
                    <div className={`trigger-icon ${hasUrgent ? "urgent" : ""}`}>
                        <FileText size={24} />
                        {hasUrgent && (
                            <span className="timer-indicator">
                                <Timer size={12} />
                            </span>
                        )}
                    </div>
                    <div className="trigger-text">
                        <h3>Quote Follow-ups</h3>
                        <p>
                            {activeQuotes.length === 0 ? (
                                "No pending quotes"
                            ) : (
                                <span className="trigger-stats">
                                    <span>{activeQuotes.length} pending</span>
                                    {flaggedCount > 0 && (
                                        <span className="stat-flagged">
                                            <Flag size={12} />
                                            {flaggedCount} flagged
                                        </span>
                                    )}
                                    {expiringCount > 0 && (
                                        <span className="stat-expiring">
                                            <Timer size={12} />
                                            {expiringCount} expiring
                                        </span>
                                    )}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="trigger-right">
                    {activeQuotes.length > 0 && (
                        <span className={`trigger-badge ${hasUrgent ? "urgent" : ""}`}>
                            {activeQuotes.length}
                        </span>
                    )}
                    <ChevronRight size={20} className="trigger-arrow" />
                </div>

                <style jsx>{`
                    .quotes-trigger {
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 1.25rem;
                        background: var(--bg-card);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-lg);
                        cursor: pointer;
                        transition: all 0.15s ease;
                        text-align: left;
                    }

                    .quotes-trigger:hover {
                        border-color: var(--primary);
                        background: var(--bg-hover);
                    }

                    .trigger-content {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                    }

                    .trigger-icon {
                        width: 48px;
                        height: 48px;
                        border-radius: var(--radius-md);
                        background: var(--primary-soft);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--primary);
                        position: relative;
                    }

                    .trigger-icon.urgent {
                        background: var(--danger-bg);
                        color: var(--danger);
                    }

                    .trigger-icon :global(.timer-indicator) {
                        position: absolute;
                        top: -4px;
                        right: -4px;
                        width: 20px;
                        height: 20px;
                        background: var(--warning);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        animation: pulse 2s infinite;
                    }

                    @keyframes pulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.8; }
                    }

                    .trigger-text h3 {
                        font-size: 1rem;
                        font-weight: 600;
                        color: var(--text-primary);
                        margin-bottom: 0.25rem;
                    }

                    .trigger-text p {
                        font-size: 0.875rem;
                        color: var(--text-secondary);
                    }

                    .trigger-stats {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        flex-wrap: wrap;
                    }

                    .stat-flagged {
                        display: flex;
                        align-items: center;
                        gap: 0.25rem;
                        color: var(--danger);
                    }

                    .stat-expiring {
                        display: flex;
                        align-items: center;
                        gap: 0.25rem;
                        color: var(--warning);
                    }

                    .trigger-right {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    }

                    .trigger-badge {
                        padding: 0.25rem 0.75rem;
                        background: var(--warning);
                        color: var(--text-inverse);
                        border-radius: 9999px;
                        font-size: 0.875rem;
                        font-weight: 600;
                    }

                    .trigger-badge.urgent {
                        background: var(--danger);
                        color: white;
                    }

                    .trigger-arrow {
                        color: var(--text-muted);
                        transition: transform 0.15s;
                    }

                    .quotes-trigger:hover .trigger-arrow {
                        transform: translateX(4px);
                        color: var(--primary);
                    }
                `}</style>
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

function QuotesModal({ quotes, onClose }: { quotes: Quote[]; onClose: () => void }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"active" | "all">("active");

    const statusColors = {
        PENDING: { bg: "var(--warning-bg)", color: "var(--warning)", label: "Needs Follow-up" },
        FOLLOWING_UP: { bg: "var(--info-bg)", color: "var(--info)", label: "Following Up" },
        CONVERTED: { bg: "var(--success-bg)", color: "var(--success)", label: "Won" },
        LOST: { bg: "var(--danger-bg)", color: "var(--danger)", label: "Lost" },
        EXPIRED: { bg: "var(--bg-secondary)", color: "var(--text-muted)", label: "Expired" },
    };

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
            <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className="quotes-modal">
                    {/* Header */}
                    <div className="modal-header">
                        <div className="header-title">
                            <FileText size={24} />
                            <h2>Quote Follow-ups</h2>
                        </div>
                        <div className="header-actions">
                            <button onClick={() => setShowAddModal(true)} className="btn-primary">
                                <Plus size={16} />
                                Add Quote
                            </button>
                            <button onClick={onClose} className="btn-close">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="modal-tabs">
                        <button
                            onClick={() => setActiveTab("active")}
                            className={`tab ${activeTab === "active" ? "active" : ""}`}
                        >
                            Active ({activeQuotes.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`tab ${activeTab === "all" ? "active" : ""}`}
                        >
                            All ({quotes.length})
                        </button>
                    </div>

                    {/* Content */}
                    <div className="modal-content">
                        {sortedQuotes.length === 0 ? (
                            <div className="empty-state">
                                <FileText size={48} />
                                <p>No quotes to display</p>
                                <span>Click "Add Quote" to create a new quote.</span>
                            </div>
                        ) : (
                            <div className="quotes-list">
                                {sortedQuotes.map((quote) => {
                                    const expiry = formatTimeUntilExpiry(quote.expiresAt);
                                    const showExpiryWarning = (quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && expiry.urgent;
                                    const overdue = isOverdue(quote.nextFollowUp) && (quote.status === "PENDING" || quote.status === "FOLLOWING_UP");

                                    return (
                                        <div
                                            key={quote.id}
                                            onClick={() => setSelectedQuoteId(quote.id)}
                                            className={`quote-card ${quote.isFlagged ? "flagged" : ""} ${overdue ? "overdue" : ""}`}
                                        >
                                            <div className="quote-header">
                                                <div className="quote-title">
                                                    {quote.isFlagged && <Flag size={14} className="flag-icon" />}
                                                    <h4>{quote.clientName}</h4>
                                                    <span className="status-badge" style={{ background: statusColors[quote.status].bg, color: statusColors[quote.status].color }}>
                                                        {statusColors[quote.status].label}
                                                    </span>
                                                    {showExpiryWarning && (
                                                        <span className={`expiry-badge ${expiry.expired ? "expired" : ""}`}>
                                                            <Hourglass size={10} />
                                                            {expiry.text}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="quote-meta-right">
                                                    <span><RefreshCw size={10} /> {quote.followUpCount} follow-ups</span>
                                                    <span><Timer size={10} /> {formatTimeSince(quote.lastActionAt)}</span>
                                                </div>
                                            </div>

                                            <p className="quote-subtitle">
                                                {quote.serviceType}
                                                {quote.estimatedAmount && ` • $${quote.estimatedAmount.toLocaleString()}`}
                                                {quote.source && ` • via ${quote.source}`}
                                            </p>

                                            <div className="quote-details">
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
                                                    <span className={overdue ? "overdue-text" : ""}>
                                                        <Clock size={12} />
                                                        {overdue ? "Overdue" : "Next"}: {new Date(quote.nextFollowUp).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="quote-footer">
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

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                }

                .quotes-modal {
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: modalIn 0.2s ease;
                }

                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                .modal-header {
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--primary);
                }

                .header-title h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .header-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 1rem;
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .btn-primary:hover {
                    background: var(--primary-hover);
                }

                .btn-close {
                    padding: 0.5rem;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: var(--radius-md);
                    transition: all 0.15s;
                }

                .btn-close:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .modal-tabs {
                    padding: 1rem 1.5rem 0;
                    display: flex;
                    gap: 0.5rem;
                }

                .tab {
                    padding: 0.5rem 1rem;
                    border-radius: 9999px;
                    border: none;
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .tab:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .tab.active {
                    background: var(--primary);
                    color: white;
                }

                .modal-content {
                    flex: 1;
                    overflow: auto;
                    padding: 1rem 1.5rem 1.5rem;
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem 0;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 1rem;
                }

                .empty-state p {
                    font-size: 1rem;
                    margin-bottom: 0.25rem;
                    color: var(--text-secondary);
                }

                .empty-state span {
                    font-size: 0.875rem;
                }

                .quotes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .quote-card {
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .quote-card:hover {
                    border-color: var(--primary);
                    transform: translateX(4px);
                }

                .quote-card.flagged {
                    background: rgba(239, 68, 68, 0.05);
                    border-color: rgba(239, 68, 68, 0.2);
                }

                .quote-card.overdue {
                    border-left: 3px solid var(--danger);
                }

                .quote-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.5rem;
                }

                .quote-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .quote-title :global(.flag-icon) {
                    color: var(--danger);
                }

                .quote-title h4 {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .status-badge {
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.65rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .expiry-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.125rem 0.5rem;
                    background: var(--warning-bg);
                    color: var(--warning);
                    border-radius: 9999px;
                    font-size: 0.65rem;
                    font-weight: 600;
                }

                .expiry-badge.expired {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .quote-meta-right {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.25rem;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }

                .quote-meta-right span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .quote-subtitle {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.75rem;
                }

                .quote-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .quote-details span {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                }

                .overdue-text {
                    color: var(--danger) !important;
                }

                .quote-footer {
                    margin-top: 0.75rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
            `}</style>
        </>
    );
}

function AddQuoteModal({ onClose }: { onClose: () => void }) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        serviceType: "",
        source: "",
        dateOfService: "",
        estimatedAmount: "",
        notes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientName || !form.serviceType) return;

        setLoading(true);
        try {
            await createQuote({
                clientName: form.clientName,
                clientEmail: form.clientEmail || undefined,
                clientPhone: form.clientPhone || undefined,
                serviceType: form.serviceType,
                source: form.source || undefined,
                dateOfService: form.dateOfService ? new Date(form.dateOfService) : undefined,
                estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
                notes: form.notes || undefined,
            });
            router.refresh(); // Refresh the page data
            onClose();
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="add-modal">
                <div className="modal-header">
                    <h3>Add New Quote</h3>
                    <button onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <div className="creator-info">
                    <div className="creator-avatar">
                        {(session?.user?.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="creator-label">Created by</p>
                        <p className="creator-name">{session?.user?.name || "You"}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Client Name *</label>
                        <input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="John Doe" required />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="john@example.com" />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input type="tel" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="+1 234 567 8900" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Service Type *</label>
                            <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} required>
                                <option value="">Select service...</option>
                                <option value="Airport Transfer">Airport Transfer</option>
                                <option value="Hourly Service">Hourly Service</option>
                                <option value="Point to Point">Point to Point</option>
                                <option value="City Tour">City Tour</option>
                                <option value="Event Transportation">Event Transportation</option>
                                <option value="Corporate">Corporate</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Source</label>
                            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                                <option value="">Select source...</option>
                                <option value="Phone">Phone Call</option>
                                <option value="Email">Email</option>
                                <option value="Website">Website</option>
                                <option value="Walk-in">Walk-in</option>
                                <option value="Referral">Referral</option>
                                <option value="Social Media">Social Media</option>
                                <option value="Partner">Partner/Affiliate</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Date of Service</label>
                            <input type="date" value={form.dateOfService} onChange={(e) => setForm({ ...form, dateOfService: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Estimated Amount</label>
                            <input type="number" value={form.estimatedAmount} onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notes</label>
                        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional details..." />
                    </div>

                    <div className="info-box">
                        Quote will expire in 72 hours if no action is taken.
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Adding..." : "Add Quote"}
                        </button>
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    </div>
                </form>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 110;
                    padding: 1rem;
                }

                .add-modal {
                    width: 100%;
                    max-width: 550px;
                    max-height: 90vh;
                    overflow: auto;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    animation: modalIn 0.2s ease;
                }

                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.25rem;
                }

                .modal-header h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                }

                .btn-close {
                    padding: 0.5rem;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: var(--radius-md);
                }

                .btn-close:hover {
                    background: var(--bg-hover);
                }

                .creator-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    margin-bottom: 1.5rem;
                }

                .creator-avatar {
                    width: 36px;
                    height: 36px;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                }

                .creator-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .creator-name {
                    font-weight: 500;
                }

                form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.9375rem;
                    font-family: inherit;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .form-group textarea {
                    height: 80px;
                    resize: none;
                }

                .info-box {
                    padding: 0.75rem;
                    background: var(--info-bg);
                    border: 1px solid var(--info-border);
                    border-radius: var(--radius-md);
                    font-size: 0.8rem;
                    color: var(--info);
                }

                .form-actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }

                .btn-primary {
                    flex: 1;
                    padding: 0.75rem 1.5rem;
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: 0.9375rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .btn-primary:hover:not(:disabled) {
                    background: var(--primary-hover);
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    padding: 0.75rem 1.5rem;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    font-size: 0.9375rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-secondary:hover {
                    background: var(--bg-hover);
                }

                @media (max-width: 600px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

function QuoteDetailModal({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
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

    const statusColors = {
        PENDING: { bg: "var(--warning-bg)", color: "var(--warning)", label: "Pending" },
        FOLLOWING_UP: { bg: "var(--info-bg)", color: "var(--info)", label: "Following Up" },
        CONVERTED: { bg: "var(--success-bg)", color: "var(--success)", label: "Won" },
        LOST: { bg: "var(--danger-bg)", color: "var(--danger)", label: "Lost" },
        EXPIRED: { bg: "var(--bg-secondary)", color: "var(--text-muted)", label: "Expired" },
    };

    if (loading) {
        return (
            <div className="loading-overlay">
                <span>Loading...</span>
                <style jsx>{`
                    .loading-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 120;
                        color: var(--text-secondary);
                    }
                `}</style>
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
            <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className="detail-modal">
                    {/* Header */}
                    <div className="modal-header">
                        <div className="header-left">
                            <div className="header-title">
                                {quote.isFlagged && <Flag size={16} className="flag" />}
                                <h2>{quote.clientName}</h2>
                                <span className="status" style={{ background: statusColors[quote.status].bg, color: statusColors[quote.status].color }}>
                                    {statusColors[quote.status].label}
                                </span>
                            </div>
                            <p className="header-subtitle">
                                {quote.serviceType} • ${quote.estimatedAmount?.toLocaleString() || "TBD"}
                            </p>
                        </div>
                        <button onClick={onClose} className="btn-close"><X size={20} /></button>
                    </div>

                    {/* Stats */}
                    <div className="stats-row">
                        <span><Timer size={14} /> Last: {formatTimeSince(quote.lastActionAt)}</span>
                        <span><RefreshCw size={14} /> {quote.actionCount} actions</span>
                        {isActive && (
                            <span className={expiry.urgent ? "urgent" : ""}>
                                <Hourglass size={14} /> {expiry.text}
                            </span>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="tabs">
                        <button onClick={() => setActiveTab("actions")} className={activeTab === "actions" ? "active" : ""}>
                            <History size={14} /> Activity
                        </button>
                        <button onClick={() => setActiveTab("details")} className={activeTab === "details" ? "active" : ""}>
                            <FileText size={14} /> Details
                        </button>
                    </div>

                    {/* Content */}
                    <div className="modal-content">
                        {activeTab === "actions" ? (
                            <div className="actions-tab">
                                {isActive && (
                                    <>
                                        <div className="action-input">
                                            <textarea
                                                placeholder="Add notes about your action..."
                                                value={noteInput}
                                                onChange={(e) => setNoteInput(e.target.value)}
                                            />
                                            <div className="action-btns">
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

                                        <div className="outcome-btns">
                                            <button className="won" onClick={() => setShowOutcomeModal("WON")}>
                                                <Trophy size={16} /> Mark as Won
                                            </button>
                                            <button className="lost" onClick={() => setShowOutcomeModal("LOST")}>
                                                <ThumbsDown size={16} /> Mark as Lost
                                            </button>
                                        </div>
                                    </>
                                )}

                                {quote.outcome && (
                                    <div className={`outcome-box ${quote.outcome === "WON" ? "won" : "lost"}`}>
                                        <div className="outcome-header">
                                            {quote.outcome === "WON" ? <Trophy size={18} /> : <ThumbsDown size={18} />}
                                            <span>Quote {quote.outcome === "WON" ? "Won" : "Lost"}</span>
                                            {quote.outcomeAt && (
                                                <span className="outcome-date">• {new Date(quote.outcomeAt).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                        {quote.outcomeReason && <p>{quote.outcomeReason}</p>}
                                    </div>
                                )}

                                <div className="activity-section">
                                    <h4>Activity History</h4>
                                    <div className="activity-list">
                                        {quote.actions && quote.actions.length > 0 ? (
                                            quote.actions.map((action) => (
                                                <div key={action.id} className="activity-item">
                                                    <div className="activity-header">
                                                        <span className="activity-type">
                                                            {actionTypeIcons[action.actionType] || <Clock size={14} />}
                                                            {action.actionType.replace("_", " ")}
                                                        </span>
                                                        <span className="activity-time">{formatTimeSince(action.createdAt)}</span>
                                                    </div>
                                                    {action.notes && <p className="activity-notes">{action.notes}</p>}
                                                    <span className="activity-user">by {action.user.name || "Unknown"}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="no-activity">No activity recorded yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="details-tab">
                                <div className="detail-section">
                                    <h4>Contact Information</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="label">Email</span>
                                            <span className="value">{quote.clientEmail || "—"}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Phone</span>
                                            <span className="value">{quote.clientPhone || "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Service Details</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="label">Service Type</span>
                                            <span className="value">{quote.serviceType}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Source</span>
                                            <span className="value">{quote.source || "—"}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Date of Service</span>
                                            <span className="value">{quote.dateOfService ? new Date(quote.dateOfService).toLocaleDateString() : "—"}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Estimated Amount</span>
                                            <span className="value">{quote.estimatedAmount ? `$${quote.estimatedAmount.toLocaleString()}` : "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                {quote.notes && (
                                    <div className="detail-section">
                                        <h4>Notes</h4>
                                        <p className="notes-text">{quote.notes}</p>
                                    </div>
                                )}

                                <div className="meta-section">
                                    <div className="meta-row">
                                        <span>Created by: {quote.createdBy.name || "Unknown"}</span>
                                        <span>Created: {new Date(quote.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="meta-row">
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
                <div className="outcome-overlay" onClick={(e) => e.target === e.currentTarget && setShowOutcomeModal(null)}>
                    <div className="outcome-modal">
                        <h3>{showOutcomeModal === "WON" ? "Mark Quote as Won" : "Mark Quote as Lost"}</h3>
                        <div className="form-group">
                            <label>Reason (optional)</label>
                            <textarea
                                placeholder={showOutcomeModal === "WON" ? "Booking details..." : "Reason for loss..."}
                                value={outcomeReason}
                                onChange={(e) => setOutcomeReason(e.target.value)}
                            />
                        </div>
                        <div className="outcome-actions">
                            <button onClick={handleOutcome} className={showOutcomeModal === "WON" ? "btn-success" : "btn-danger"} disabled={actionLoading}>
                                {actionLoading ? "Saving..." : "Confirm"}
                            </button>
                            <button onClick={() => setShowOutcomeModal(null)} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 120;
                    padding: 1rem;
                }

                .detail-modal {
                    width: 100%;
                    max-width: 700px;
                    max-height: 90vh;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: modalIn 0.2s ease;
                }

                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                .modal-header {
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                }

                .header-left {
                    flex: 1;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.25rem;
                }

                .header-title :global(.flag) {
                    color: var(--danger);
                }

                .header-title h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                }

                .header-title .status {
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .header-subtitle {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }

                .btn-close {
                    padding: 0.5rem;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: var(--radius-md);
                }

                .stats-row {
                    padding: 0.75rem 1.5rem;
                    background: var(--bg-secondary);
                    display: flex;
                    gap: 1.5rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    flex-wrap: wrap;
                }

                .stats-row span {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                }

                .stats-row .urgent {
                    color: var(--danger);
                }

                .tabs {
                    padding: 0.75rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    gap: 0.5rem;
                }

                .tabs button {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius-md);
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .tabs button:hover {
                    background: var(--bg-hover);
                }

                .tabs button.active {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .modal-content {
                    flex: 1;
                    overflow: auto;
                    padding: 1.25rem 1.5rem;
                }

                .actions-tab {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .action-input {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    padding: 1rem;
                }

                .action-input textarea {
                    width: 100%;
                    height: 70px;
                    padding: 0.75rem;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-family: inherit;
                    font-size: 0.9rem;
                    resize: none;
                    margin-bottom: 0.75rem;
                }

                .action-input textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .action-btns {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .action-btns button {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.75rem;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .action-btns button:hover:not(:disabled) {
                    background: var(--bg-hover);
                    border-color: var(--primary);
                }

                .action-btns button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .outcome-btns {
                    display: flex;
                    gap: 0.75rem;
                }

                .outcome-btns button {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .outcome-btns .won {
                    background: var(--success-bg);
                    border: 1px solid var(--success-border);
                    color: var(--success);
                }

                .outcome-btns .won:hover {
                    background: var(--success);
                    color: white;
                }

                .outcome-btns .lost {
                    background: var(--danger-bg);
                    border: 1px solid var(--danger-border);
                    color: var(--danger);
                }

                .outcome-btns .lost:hover {
                    background: var(--danger);
                    color: white;
                }

                .outcome-box {
                    padding: 1rem;
                    border-radius: var(--radius-md);
                }

                .outcome-box.won {
                    background: var(--success-bg);
                    border: 1px solid var(--success-border);
                }

                .outcome-box.lost {
                    background: var(--danger-bg);
                    border: 1px solid var(--danger-border);
                }

                .outcome-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                    font-weight: 600;
                }

                .outcome-box.won .outcome-header {
                    color: var(--success);
                }

                .outcome-box.lost .outcome-header {
                    color: var(--danger);
                }

                .outcome-date {
                    font-size: 0.8rem;
                    font-weight: 400;
                    color: var(--text-muted);
                }

                .outcome-box p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .activity-section h4 {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.75rem;
                }

                .activity-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .activity-item {
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    border-left: 3px solid var(--primary);
                }

                .activity-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.25rem;
                }

                .activity-type {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-weight: 500;
                    font-size: 0.875rem;
                }

                .activity-time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .activity-notes {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.25rem;
                }

                .activity-user {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }

                .no-activity {
                    text-align: center;
                    padding: 2rem;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }

                .details-tab {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .detail-section h4 {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.75rem;
                }

                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                }

                .detail-item {
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }

                .detail-item .label {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    margin-bottom: 0.25rem;
                }

                .detail-item .value {
                    font-size: 0.875rem;
                    color: var(--text-primary);
                }

                .notes-text {
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    white-space: pre-wrap;
                }

                .meta-section {
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }

                .meta-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                }

                .meta-row:first-child {
                    margin-bottom: 0.5rem;
                }

                .meta-row span:first-child {
                    color: var(--text-muted);
                }

                /* Outcome Modal */
                .outcome-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 130;
                    padding: 1rem;
                }

                .outcome-modal {
                    width: 100%;
                    max-width: 400px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    animation: modalIn 0.2s ease;
                }

                .outcome-modal h3 {
                    font-size: 1.125rem;
                    margin-bottom: 1rem;
                }

                .outcome-modal .form-group {
                    margin-bottom: 1rem;
                }

                .outcome-modal .form-group label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    margin-bottom: 0.375rem;
                }

                .outcome-modal textarea {
                    width: 100%;
                    height: 80px;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-family: inherit;
                    resize: none;
                }

                .outcome-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                .btn-success {
                    flex: 1;
                    padding: 0.75rem;
                    background: var(--success);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-weight: 500;
                    cursor: pointer;
                }

                .btn-danger {
                    flex: 1;
                    padding: 0.75rem;
                    background: var(--danger);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-weight: 500;
                    cursor: pointer;
                }

                .btn-secondary {
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                }
            `}</style>
        </>
    );
}

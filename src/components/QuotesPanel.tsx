"use client";

import { useState, useEffect } from "react";
import {
    FileText,
    Phone,
    Mail,
    Clock,
    CheckCircle,
    XCircle,
    Plus,
    RefreshCw,
    MessageSquare,
    X,
    ChevronRight,
    AlertTriangle,
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
    recordFollowUp,
    convertQuote,
    updateQuoteStatus,
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
    userId: string;
    isAdmin: boolean;
}

// Helper to format relative time
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

// Helper to format time until expiration
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

export default function QuotesPanel({ quotes, userId, isAdmin }: Props) {
    const [showModal, setShowModal] = useState(false);
    const activeQuotes = quotes.filter(q => q.status === "PENDING" || q.status === "FOLLOWING_UP");
    const overdueCount = activeQuotes.filter(q => q.nextFollowUp && new Date(q.nextFollowUp) < new Date()).length;
    const flaggedCount = activeQuotes.filter(q => q.isFlagged).length;
    const expiringCount = activeQuotes.filter(q => {
        const exp = formatTimeUntilExpiry(q.expiresAt);
        return exp.urgent && !exp.expired;
    }).length;

    return (
        <>
            {/* Compact Trigger Card */}
            <button
                onClick={() => setShowModal(true)}
                className="glass-card glass-card-interactive"
                style={{
                    width: "100%",
                    textAlign: "left",
                    border: (overdueCount > 0 || flaggedCount > 0) ? "1px solid rgba(248, 113, 113, 0.3)" : "1px solid var(--glass-border)",
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "0.75rem",
                                background: (overdueCount > 0 || flaggedCount > 0) ? "var(--danger-bg)" : "var(--accent-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <FileText size={24} style={{ color: (overdueCount > 0 || flaggedCount > 0) ? "var(--danger)" : "var(--accent)" }} />
                        </div>
                        <div>
                            <h3 className="font-display" style={{ fontSize: "1.125rem", marginBottom: "0.125rem" }}>
                                Quote Follow-ups
                            </h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                {activeQuotes.length === 0 ? (
                                    "No pending quotes"
                                ) : (
                                    <span className="flex items-center gap-2 flex-wrap">
                                        <span>{activeQuotes.length} pending</span>
                                        {flaggedCount > 0 && (
                                            <span style={{ color: "var(--danger)" }} className="flex items-center gap-1">
                                                <Flag size={12} />
                                                {flaggedCount} flagged
                                            </span>
                                        )}
                                        {expiringCount > 0 && (
                                            <span style={{ color: "var(--warning)" }} className="flex items-center gap-1">
                                                <Hourglass size={12} />
                                                {expiringCount} expiring soon
                                            </span>
                                        )}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeQuotes.length > 0 && (
                            <span
                                style={{
                                    background: (overdueCount > 0 || flaggedCount > 0) ? "var(--danger)" : "var(--warning)",
                                    color: (overdueCount > 0 || flaggedCount > 0) ? "white" : "black",
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.875rem",
                                    fontWeight: 600,
                                }}
                            >
                                {activeQuotes.length}
                            </span>
                        )}
                        <ChevronRight size={20} style={{ color: "var(--text-secondary)" }} />
                    </div>
                </div>
            </button>

            {/* Quotes Modal */}
            {showModal && (
                <QuotesModal
                    quotes={quotes}
                    userId={userId}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}

function QuotesModal({ quotes, userId, onClose }: { quotes: Quote[]; userId: string; onClose: () => void }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"active" | "all">("active");

    const statusColors = {
        PENDING: { bg: "var(--warning-bg)", color: "var(--warning)", label: "Needs Follow-up" },
        FOLLOWING_UP: { bg: "var(--info-bg)", color: "var(--info)", label: "Following Up" },
        CONVERTED: { bg: "var(--success-bg)", color: "var(--success)", label: "Won" },
        LOST: { bg: "var(--danger-bg)", color: "var(--danger)", label: "Lost" },
        EXPIRED: { bg: "var(--bg-muted)", color: "var(--text-muted)", label: "Expired" },
    };

    const isOverdue = (nextFollowUp: Date | null) => {
        if (!nextFollowUp) return false;
        return new Date(nextFollowUp) < new Date();
    };

    const activeQuotes = quotes.filter(q => q.status === "PENDING" || q.status === "FOLLOWING_UP");
    const displayQuotes = activeTab === "active" ? activeQuotes : quotes;

    // Sort: flagged first, then by next follow-up
    const sortedQuotes = [...displayQuotes].sort((a, b) => {
        if (a.isFlagged && !b.isFlagged) return -1;
        if (!a.isFlagged && b.isFlagged) return 1;
        if (a.nextFollowUp && b.nextFollowUp) {
            return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
        }
        return 0;
    });

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "1rem",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="animate-fade-in-scale"
                style={{
                    width: "100%",
                    maxWidth: "800px",
                    maxHeight: "90vh",
                    background: "var(--bg-elevated)",
                    borderRadius: "1.125rem",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-xl)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "1.25rem 1.5rem",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-accent" />
                        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Quote Follow-ups</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn btn-primary"
                            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                        >
                            <Plus size={16} />
                            Add Quote
                        </button>
                        <button
                            onClick={onClose}
                            className="btn btn-ghost btn-icon"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ padding: "1rem 1.5rem 0", display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={() => setActiveTab("active")}
                        className={`tab-btn ${activeTab === "active" ? "active" : ""}`}
                    >
                        Active ({activeQuotes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                    >
                        All ({quotes.length})
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "1rem 1.5rem 1.5rem" }}>
                    {sortedQuotes.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
                            <FileText size={48} style={{ opacity: 0.2, marginBottom: "1rem" }} />
                            <p style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>No quotes to display</p>
                            <p style={{ fontSize: "0.875rem" }}>Click "Add Quote" to create a new quote.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {sortedQuotes.map((quote) => {
                                const expiry = formatTimeUntilExpiry(quote.expiresAt);
                                const showExpiryWarning = (quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && expiry.urgent;

                                return (
                                    <div
                                        key={quote.id}
                                        onClick={() => setSelectedQuoteId(quote.id)}
                                        className="quote-card"
                                        style={{
                                            padding: "1rem",
                                            borderRadius: "0.75rem",
                                            background: quote.isFlagged
                                                ? "rgba(248, 113, 113, 0.06)"
                                                : isOverdue(quote.nextFollowUp) && (quote.status === "PENDING" || quote.status === "FOLLOWING_UP")
                                                ? "rgba(248, 113, 113, 0.04)"
                                                : "var(--bg-secondary)",
                                            border: quote.isFlagged
                                                ? "1px solid rgba(248, 113, 113, 0.3)"
                                                : isOverdue(quote.nextFollowUp) && (quote.status === "PENDING" || quote.status === "FOLLOWING_UP")
                                                ? "1px solid rgba(248, 113, 113, 0.2)"
                                                : "1px solid var(--border)",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                        }}
                                    >
                                        <div className="flex items-start justify-between" style={{ marginBottom: "0.75rem" }}>
                                            <div>
                                                <div className="flex items-center gap-2" style={{ marginBottom: "0.25rem" }}>
                                                    {quote.isFlagged && (
                                                        <Flag size={14} style={{ color: "var(--danger)" }} />
                                                    )}
                                                    <h4 style={{ fontWeight: 600 }}>{quote.clientName}</h4>
                                                    <span
                                                        style={{
                                                            background: statusColors[quote.status].bg,
                                                            color: statusColors[quote.status].color,
                                                            padding: "0.125rem 0.5rem",
                                                            borderRadius: "9999px",
                                                            fontSize: "0.65rem",
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                        }}
                                                    >
                                                        {statusColors[quote.status].label}
                                                    </span>
                                                    {showExpiryWarning && (
                                                        <span
                                                            style={{
                                                                background: expiry.expired ? "var(--danger-bg)" : "var(--warning-bg)",
                                                                color: expiry.expired ? "var(--danger)" : "var(--warning)",
                                                                padding: "0.125rem 0.5rem",
                                                                borderRadius: "9999px",
                                                                fontSize: "0.65rem",
                                                                fontWeight: 600,
                                                            }}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <Hourglass size={10} />
                                                            {expiry.text}
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                                    {quote.serviceType}
                                                    {quote.estimatedAmount && ` • $${quote.estimatedAmount.toLocaleString()}`}
                                                    {quote.source && ` • via ${quote.source}`}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                <span className="flex items-center gap-1">
                                                    <RefreshCw size={10} />
                                                    {quote.followUpCount} follow-ups
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Timer size={10} />
                                                    Last: {formatTimeSince(quote.lastActionAt)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                            {quote.clientPhone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone size={12} />
                                                    {quote.clientPhone}
                                                </span>
                                            )}
                                            {quote.clientEmail && (
                                                <span className="flex items-center gap-1">
                                                    <Mail size={12} />
                                                    {quote.clientEmail}
                                                </span>
                                            )}
                                            {quote.dateOfService && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    Service: {new Date(quote.dateOfService).toLocaleDateString()}
                                                </span>
                                            )}
                                            {(quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && quote.nextFollowUp && (
                                                <span className="flex items-center gap-1" style={{ color: isOverdue(quote.nextFollowUp) ? "var(--danger)" : "var(--text-secondary)" }}>
                                                    <Clock size={12} />
                                                    {isOverdue(quote.nextFollowUp) ? "Overdue" : "Next"}: {new Date(quote.nextFollowUp).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            Created by {quote.createdBy.name || "Unknown"} • {new Date(quote.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <style jsx>{`
                    .tab-btn {
                        padding: 0.5rem 1rem;
                        border-radius: 9999px;
                        border: none;
                        cursor: pointer;
                        font-size: 0.875rem;
                        font-weight: 500;
                        background: var(--bg-secondary);
                        color: var(--text-secondary);
                        transition: all 0.2s ease;
                        font-family: inherit;
                    }
                    .tab-btn:hover {
                        background: var(--bg-muted);
                        color: var(--text-primary);
                    }
                    .tab-btn.active {
                        background: var(--accent);
                        color: var(--text-inverse);
                    }
                    .quote-card:hover {
                        transform: translateX(4px);
                        border-color: var(--border-accent) !important;
                    }
                `}</style>
            </div>

            {/* Add Quote Modal */}
            {showAddModal && (
                <AddQuoteModal
                    onClose={() => setShowAddModal(false)}
                    userId={userId}
                />
            )}

            {/* Quote Detail Modal */}
            {selectedQuoteId && (
                <QuoteDetailModal
                    quoteId={selectedQuoteId}
                    onClose={() => setSelectedQuoteId(null)}
                />
            )}
        </div>
    );
}

function AddQuoteModal({ onClose, userId }: { onClose: () => void; userId: string }) {
    const { data: session } = useSession();
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
            onClose();
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 110,
                padding: "1rem",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="glass-card animate-fade-in-scale"
                style={{ width: "100%", maxWidth: "550px", maxHeight: "90vh", overflow: "auto" }}
            >
                <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                    <h3 className="font-display" style={{ fontSize: "1.5rem" }}>Add New Quote</h3>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">
                        <X size={20} />
                    </button>
                </div>

                {/* Creator Info */}
                <div
                    style={{
                        padding: "0.75rem 1rem",
                        background: "var(--bg-secondary)",
                        borderRadius: "0.625rem",
                        marginBottom: "1.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                    }}
                >
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: "var(--accent-soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent)",
                            fontWeight: 600,
                        }}
                    >
                        {(session?.user?.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Created by</p>
                        <p style={{ fontWeight: 500 }}>{session?.user?.name || "You"}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="input-label">Client Name *</label>
                        <input
                            className="input"
                            value={form.clientName}
                            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label className="input-label">Email</label>
                            <input
                                className="input"
                                type="email"
                                value={form.clientEmail}
                                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div>
                            <label className="input-label">Phone</label>
                            <input
                                className="input"
                                type="tel"
                                value={form.clientPhone}
                                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                                placeholder="+1 234 567 8900"
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label className="input-label">Service Type *</label>
                            <select
                                className="input"
                                value={form.serviceType}
                                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                                required
                            >
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
                        <div>
                            <label className="input-label">Source</label>
                            <select
                                className="input"
                                value={form.source}
                                onChange={(e) => setForm({ ...form, source: e.target.value })}
                            >
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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label className="input-label">Date of Service</label>
                            <input
                                className="input"
                                type="date"
                                value={form.dateOfService}
                                onChange={(e) => setForm({ ...form, dateOfService: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="input-label">Estimated Amount</label>
                            <input
                                className="input"
                                type="number"
                                value={form.estimatedAmount}
                                onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="input-label">Notes</label>
                        <textarea
                            className="input"
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Additional details about the quote..."
                            style={{ height: "80px", resize: "none" }}
                        />
                    </div>

                    <div
                        style={{
                            padding: "0.75rem",
                            background: "var(--info-bg)",
                            border: "1px solid var(--info-border)",
                            borderRadius: "0.5rem",
                            fontSize: "0.8rem",
                            color: "var(--info)",
                        }}
                    >
                        Quote will expire in 72 hours if no action is taken.
                    </div>

                    <div className="flex gap-3" style={{ marginTop: "0.5rem" }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            disabled={loading}
                        >
                            {loading ? "Adding..." : "Add Quote"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function QuoteDetailModal({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
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
            setQuote(data as Quote);
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
        EXPIRED: { bg: "var(--bg-muted)", color: "var(--text-muted)", label: "Expired" },
    };

    if (loading) {
        return (
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0, 0, 0, 0.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 120,
                }}
            >
                <div className="animate-pulse" style={{ color: "var(--text-secondary)" }}>Loading...</div>
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
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 120,
                padding: "1rem",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="animate-fade-in-scale"
                style={{
                    width: "100%",
                    maxWidth: "700px",
                    maxHeight: "90vh",
                    background: "var(--bg-elevated)",
                    borderRadius: "1.125rem",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-xl)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2" style={{ marginBottom: "0.25rem" }}>
                                {quote.isFlagged && <Flag size={16} style={{ color: "var(--danger)" }} />}
                                <h2 className="font-display" style={{ fontSize: "1.5rem" }}>{quote.clientName}</h2>
                                <span
                                    style={{
                                        background: statusColors[quote.status].bg,
                                        color: statusColors[quote.status].color,
                                        padding: "0.25rem 0.75rem",
                                        borderRadius: "9999px",
                                        fontSize: "0.7rem",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {statusColors[quote.status].label}
                                </span>
                            </div>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                {quote.serviceType} • ${quote.estimatedAmount?.toLocaleString() || "TBD"}
                            </p>
                        </div>
                        <button onClick={onClose} className="btn btn-ghost btn-icon">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 flex-wrap" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
                        <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                            <Timer size={14} />
                            Last action: {formatTimeSince(quote.lastActionAt)}
                        </span>
                        <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                            <RefreshCw size={14} />
                            {quote.actionCount} actions
                        </span>
                        {isActive && (
                            <span
                                className="flex items-center gap-1"
                                style={{ color: expiry.urgent ? "var(--danger)" : "var(--text-secondary)" }}
                            >
                                <Hourglass size={14} />
                                {expiry.text}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={() => setActiveTab("actions")}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "0.5rem",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            background: activeTab === "actions" ? "var(--accent-soft)" : "transparent",
                            color: activeTab === "actions" ? "var(--accent)" : "var(--text-secondary)",
                            fontFamily: "inherit",
                        }}
                    >
                        <History size={14} style={{ marginRight: "0.375rem", verticalAlign: "middle" }} />
                        Activity
                    </button>
                    <button
                        onClick={() => setActiveTab("details")}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "0.5rem",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            background: activeTab === "details" ? "var(--accent-soft)" : "transparent",
                            color: activeTab === "details" ? "var(--accent)" : "var(--text-secondary)",
                            fontFamily: "inherit",
                        }}
                    >
                        <FileText size={14} style={{ marginRight: "0.375rem", verticalAlign: "middle" }} />
                        Details
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "1.25rem 1.5rem" }}>
                    {activeTab === "actions" ? (
                        <div className="flex flex-col gap-4">
                            {/* Action input - only for active quotes */}
                            {isActive && (
                                <div style={{ background: "var(--bg-secondary)", borderRadius: "0.75rem", padding: "1rem" }}>
                                    <textarea
                                        className="input"
                                        placeholder="Add notes about your action..."
                                        value={noteInput}
                                        onChange={(e) => setNoteInput(e.target.value)}
                                        style={{ height: "70px", resize: "none", marginBottom: "0.75rem" }}
                                    />
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => handleAction("CALLED")}
                                            className="btn btn-secondary"
                                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}
                                            disabled={actionLoading || !noteInput.trim()}
                                        >
                                            <PhoneCall size={14} />
                                            Called
                                        </button>
                                        <button
                                            onClick={() => handleAction("EMAILED")}
                                            className="btn btn-secondary"
                                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}
                                            disabled={actionLoading || !noteInput.trim()}
                                        >
                                            <Send size={14} />
                                            Emailed
                                        </button>
                                        <button
                                            onClick={() => handleAction("TEXTED")}
                                            className="btn btn-secondary"
                                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}
                                            disabled={actionLoading || !noteInput.trim()}
                                        >
                                            <MessageCircle size={14} />
                                            Texted
                                        </button>
                                        <button
                                            onClick={handleAddNote}
                                            className="btn btn-secondary"
                                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}
                                            disabled={actionLoading || !noteInput.trim()}
                                        >
                                            <MessageSquare size={14} />
                                            Add Note
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Outcome buttons - only for active quotes */}
                            {isActive && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowOutcomeModal("WON")}
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            padding: "0.75rem",
                                            background: "var(--success-bg)",
                                            color: "var(--success)",
                                            border: "1px solid var(--success-border)",
                                        }}
                                    >
                                        <Trophy size={16} />
                                        Mark as Won
                                    </button>
                                    <button
                                        onClick={() => setShowOutcomeModal("LOST")}
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            padding: "0.75rem",
                                            background: "var(--danger-bg)",
                                            color: "var(--danger)",
                                            border: "1px solid var(--danger-border)",
                                        }}
                                    >
                                        <ThumbsDown size={16} />
                                        Mark as Lost
                                    </button>
                                </div>
                            )}

                            {/* Outcome display for closed quotes */}
                            {quote.outcome && (
                                <div
                                    style={{
                                        padding: "1rem",
                                        borderRadius: "0.75rem",
                                        background: quote.outcome === "WON" ? "var(--success-bg)" : "var(--danger-bg)",
                                        border: `1px solid ${quote.outcome === "WON" ? "var(--success-border)" : "var(--danger-border)"}`,
                                    }}
                                >
                                    <div className="flex items-center gap-2" style={{ marginBottom: "0.5rem" }}>
                                        {quote.outcome === "WON" ? (
                                            <Trophy size={18} style={{ color: "var(--success)" }} />
                                        ) : (
                                            <ThumbsDown size={18} style={{ color: "var(--danger)" }} />
                                        )}
                                        <span style={{ fontWeight: 600, color: quote.outcome === "WON" ? "var(--success)" : "var(--danger)" }}>
                                            Quote {quote.outcome === "WON" ? "Won" : "Lost"}
                                        </span>
                                        {quote.outcomeAt && (
                                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                                • {new Date(quote.outcomeAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    {quote.outcomeReason && (
                                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                            {quote.outcomeReason}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action history */}
                            <div>
                                <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
                                    Activity History
                                </h4>
                                <div className="flex flex-col gap-2">
                                    {quote.actions && quote.actions.length > 0 ? (
                                        quote.actions.map((action) => (
                                            <div
                                                key={action.id}
                                                style={{
                                                    padding: "0.75rem 1rem",
                                                    background: "var(--bg-secondary)",
                                                    borderRadius: "0.5rem",
                                                    borderLeft: "3px solid var(--accent)",
                                                }}
                                            >
                                                <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem" }}>
                                                    <span className="flex items-center gap-2" style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                                                        {actionTypeIcons[action.actionType] || <Clock size={14} />}
                                                        {action.actionType.replace("_", " ")}
                                                    </span>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                        {formatTimeSince(action.createdAt)}
                                                    </span>
                                                </div>
                                                {action.notes && (
                                                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                                                        {action.notes}
                                                    </p>
                                                )}
                                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                    by {action.user.name || "Unknown"}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem" }}>
                                            No activity recorded yet
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Contact Info */}
                            <div>
                                <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
                                    Contact Information
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Email</p>
                                        <p style={{ fontSize: "0.875rem" }}>{quote.clientEmail || "—"}</p>
                                    </div>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Phone</p>
                                        <p style={{ fontSize: "0.875rem" }}>{quote.clientPhone || "—"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Service Details */}
                            <div>
                                <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
                                    Service Details
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Service Type</p>
                                        <p style={{ fontSize: "0.875rem" }}>{quote.serviceType}</p>
                                    </div>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Source</p>
                                        <p style={{ fontSize: "0.875rem" }}>{quote.source || "—"}</p>
                                    </div>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Date of Service</p>
                                        <p style={{ fontSize: "0.875rem" }}>
                                            {quote.dateOfService ? new Date(quote.dateOfService).toLocaleDateString() : "—"}
                                        </p>
                                    </div>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Estimated Amount</p>
                                        <p style={{ fontSize: "0.875rem" }}>
                                            {quote.estimatedAmount ? `$${quote.estimatedAmount.toLocaleString()}` : "—"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {quote.notes && (
                                <div>
                                    <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
                                        Notes
                                    </h4>
                                    <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                        <p style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{quote.notes}</p>
                                    </div>
                                </div>
                            )}

                            {/* Meta info */}
                            <div style={{ marginTop: "0.5rem", padding: "1rem", background: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem" }}>
                                    <div>
                                        <span style={{ color: "var(--text-muted)" }}>Created by: </span>
                                        <span>{quote.createdBy.name || "Unknown"}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-muted)" }}>Created: </span>
                                        <span>{new Date(quote.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-muted)" }}>Assigned to: </span>
                                        <span>{quote.assignedTo?.name || "Unassigned"}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-muted)" }}>Expires: </span>
                                        <span>{new Date(quote.expiresAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Outcome Modal */}
            {showOutcomeModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 130,
                        padding: "1rem",
                    }}
                    onClick={(e) => e.target === e.currentTarget && setShowOutcomeModal(null)}
                >
                    <div
                        className="glass-card animate-fade-in-scale"
                        style={{ width: "100%", maxWidth: "400px" }}
                    >
                        <h3 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                            {showOutcomeModal === "WON" ? "Mark Quote as Won" : "Mark Quote as Lost"}
                        </h3>
                        <div style={{ marginBottom: "1rem" }}>
                            <label className="input-label">Reason (optional)</label>
                            <textarea
                                className="input"
                                placeholder={showOutcomeModal === "WON" ? "Booking details..." : "Reason for loss..."}
                                value={outcomeReason}
                                onChange={(e) => setOutcomeReason(e.target.value)}
                                style={{ height: "80px", resize: "none" }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleOutcome}
                                className={`btn ${showOutcomeModal === "WON" ? "btn-success" : "btn-danger"}`}
                                style={{ flex: 1 }}
                                disabled={actionLoading}
                            >
                                {actionLoading ? "Saving..." : "Confirm"}
                            </button>
                            <button
                                onClick={() => setShowOutcomeModal(null)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

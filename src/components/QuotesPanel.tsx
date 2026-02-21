"use client";

import { useState } from "react";
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
    AlertCircle,
} from "lucide-react";
import { recordFollowUp, convertQuote, updateQuoteStatus, createQuote } from "@/lib/quoteActions";

interface Quote {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceType: string;
    pickupDate: Date | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    estimatedAmount: number | null;
    notes: string | null;
    status: "PENDING" | "FOLLOWING_UP" | "CONVERTED" | "LOST" | "EXPIRED";
    followUpCount: number;
    lastFollowUp: Date | null;
    nextFollowUp: Date | null;
    followUpNotes: string | null;
    createdBy: { id: string; name: string | null };
    assignedTo: { id: string; name: string | null } | null;
    createdAt: Date;
}

interface Props {
    quotes: Quote[];
    userId: string;
    isAdmin: boolean;
}

export default function QuotesPanel({ quotes, userId, isAdmin }: Props) {
    const [showModal, setShowModal] = useState(false);
    const activeQuotes = quotes.filter(q => q.status === "PENDING" || q.status === "FOLLOWING_UP");
    const overdueCount = activeQuotes.filter(q => q.nextFollowUp && new Date(q.nextFollowUp) < new Date()).length;

    return (
        <>
            {/* Compact Trigger Card */}
            <button
                onClick={() => setShowModal(true)}
                className="glass-card"
                style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "var(--transition-normal)",
                    border: overdueCount > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border)",
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "0.75rem",
                                background: overdueCount > 0 ? "rgba(239, 68, 68, 0.1)" : "var(--accent-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <FileText size={24} style={{ color: overdueCount > 0 ? "var(--danger)" : "var(--accent)" }} />
                        </div>
                        <div>
                            <h3 className="font-display" style={{ fontSize: "1.125rem", marginBottom: "0.125rem" }}>
                                Quote Follow-ups
                            </h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                {activeQuotes.length === 0 ? (
                                    "No pending quotes"
                                ) : (
                                    <>
                                        {activeQuotes.length} pending
                                        {overdueCount > 0 && (
                                            <span style={{ color: "var(--danger)", marginLeft: "0.5rem" }}>
                                                • {overdueCount} overdue
                                            </span>
                                        )}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeQuotes.length > 0 && (
                            <span
                                style={{
                                    background: overdueCount > 0 ? "var(--danger)" : "var(--warning)",
                                    color: overdueCount > 0 ? "white" : "black",
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
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [followUpNote, setFollowUpNote] = useState("");
    const [activeTab, setActiveTab] = useState<"active" | "all">("active");

    const statusColors = {
        PENDING: { bg: "rgba(251, 191, 36, 0.1)", color: "var(--warning)", label: "Needs Follow-up" },
        FOLLOWING_UP: { bg: "rgba(56, 189, 248, 0.1)", color: "var(--accent)", label: "Following Up" },
        CONVERTED: { bg: "rgba(34, 197, 94, 0.1)", color: "var(--success)", label: "Converted" },
        LOST: { bg: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", label: "Lost" },
        EXPIRED: { bg: "rgba(107, 114, 128, 0.1)", color: "var(--text-secondary)", label: "Expired" },
    };

    const handleFollowUp = async (quoteId: string) => {
        if (!followUpNote.trim()) return;
        setLoading(quoteId);
        try {
            await recordFollowUp(quoteId, followUpNote);
            setFollowUpNote("");
            setSelectedQuote(null);
        } catch (e) {
            console.error(e);
        }
        setLoading(null);
    };

    const handleConvert = async (quoteId: string) => {
        setLoading(quoteId);
        try {
            await convertQuote(quoteId);
        } catch (e) {
            console.error(e);
        }
        setLoading(null);
    };

    const handleMarkLost = async (quoteId: string) => {
        setLoading(quoteId);
        try {
            await updateQuoteStatus(quoteId, "LOST");
        } catch (e) {
            console.error(e);
        }
        setLoading(null);
    };

    const formatDate = (date: Date | null) => {
        if (!date) return "Not set";
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const isOverdue = (nextFollowUp: Date | null) => {
        if (!nextFollowUp) return false;
        return new Date(nextFollowUp) < new Date();
    };

    const activeQuotes = quotes.filter(q => q.status === "PENDING" || q.status === "FOLLOWING_UP");
    const displayQuotes = activeTab === "active" ? activeQuotes : quotes;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.8)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "1rem",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="animate-fade-in"
                style={{
                    width: "100%",
                    maxWidth: "700px",
                    maxHeight: "85vh",
                    background: "var(--bg-elevated)",
                    borderRadius: "1rem",
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
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "9999px",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            background: activeTab === "active" ? "var(--accent)" : "var(--bg-secondary)",
                            color: activeTab === "active" ? "var(--text-inverse)" : "var(--text-secondary)",
                            transition: "var(--transition-fast)",
                        }}
                    >
                        Active ({activeQuotes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("all")}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "9999px",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            background: activeTab === "all" ? "var(--accent)" : "var(--bg-secondary)",
                            color: activeTab === "all" ? "var(--text-inverse)" : "var(--text-secondary)",
                            transition: "var(--transition-fast)",
                        }}
                    >
                        All ({quotes.length})
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "1rem 1.5rem 1.5rem" }}>
                    {displayQuotes.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
                            <FileText size={48} style={{ opacity: 0.2, marginBottom: "1rem" }} />
                            <p style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>No quotes to display</p>
                            <p style={{ fontSize: "0.875rem" }}>Click "Add Quote" to create a new quote.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {displayQuotes.map((quote) => (
                                <div
                                    key={quote.id}
                                    style={{
                                        padding: "1rem",
                                        borderRadius: "0.75rem",
                                        background: isOverdue(quote.nextFollowUp) && (quote.status === "PENDING" || quote.status === "FOLLOWING_UP")
                                            ? "rgba(239, 68, 68, 0.05)"
                                            : "var(--bg-secondary)",
                                        border: isOverdue(quote.nextFollowUp) && (quote.status === "PENDING" || quote.status === "FOLLOWING_UP")
                                            ? "1px solid rgba(239, 68, 68, 0.3)"
                                            : "1px solid var(--border)",
                                    }}
                                >
                                    <div className="flex items-start justify-between" style={{ marginBottom: "0.75rem" }}>
                                        <div>
                                            <div className="flex items-center gap-2" style={{ marginBottom: "0.25rem" }}>
                                                <h4 style={{ fontWeight: 600 }}>{quote.clientName}</h4>
                                                <span
                                                    style={{
                                                        background: statusColors[quote.status].bg,
                                                        color: statusColors[quote.status].color,
                                                        padding: "0.125rem 0.5rem",
                                                        borderRadius: "0.25rem",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {statusColors[quote.status].label}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                                {quote.serviceType}
                                                {quote.estimatedAmount && ` • $${quote.estimatedAmount}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                            <RefreshCw size={12} />
                                            {quote.followUpCount} follow-ups
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
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
                                        {(quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && (
                                            <span className="flex items-center gap-1" style={{ color: isOverdue(quote.nextFollowUp) ? "var(--danger)" : "var(--text-secondary)" }}>
                                                <Clock size={12} />
                                                {isOverdue(quote.nextFollowUp) ? "Overdue: " : "Next: "}
                                                {formatDate(quote.nextFollowUp)}
                                            </span>
                                        )}
                                    </div>

                                    {(quote.status === "PENDING" || quote.status === "FOLLOWING_UP") && (
                                        <>
                                            {selectedQuote?.id === quote.id ? (
                                                <div className="flex flex-col gap-2" style={{ marginTop: "1rem" }}>
                                                    <textarea
                                                        className="input"
                                                        placeholder="Add follow-up notes..."
                                                        value={followUpNote}
                                                        onChange={(e) => setFollowUpNote(e.target.value)}
                                                        style={{ height: "80px", resize: "none" }}
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleFollowUp(quote.id)}
                                                            className="btn btn-primary"
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", flex: 1 }}
                                                            disabled={loading === quote.id || !followUpNote.trim()}
                                                        >
                                                            <MessageSquare size={14} />
                                                            Record Follow-up
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedQuote(null)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => setSelectedQuote(quote)}
                                                        className="btn btn-secondary"
                                                        style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", flex: 1 }}
                                                    >
                                                        <MessageSquare size={14} />
                                                        Follow Up
                                                    </button>
                                                    <button
                                                        onClick={() => handleConvert(quote.id)}
                                                        className="btn"
                                                        style={{
                                                            padding: "0.5rem 0.75rem",
                                                            fontSize: "0.8rem",
                                                            background: "rgba(34, 197, 94, 0.1)",
                                                            color: "var(--success)",
                                                            border: "1px solid var(--success)",
                                                        }}
                                                        disabled={loading === quote.id}
                                                    >
                                                        <CheckCircle size={14} />
                                                        Convert
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkLost(quote.id)}
                                                        className="btn"
                                                        style={{
                                                            padding: "0.5rem 0.75rem",
                                                            fontSize: "0.8rem",
                                                            background: "rgba(239, 68, 68, 0.1)",
                                                            color: "var(--danger)",
                                                            border: "1px solid var(--danger)",
                                                        }}
                                                        disabled={loading === quote.id}
                                                    >
                                                        <XCircle size={14} />
                                                        Lost
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Quote Modal */}
            {showAddModal && (
                <AddQuoteModal
                    onClose={() => setShowAddModal(false)}
                    userId={userId}
                />
            )}
        </div>
    );
}

function AddQuoteModal({ onClose, userId }: { onClose: () => void; userId: string }) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        serviceType: "",
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
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "1rem",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="glass-card animate-fade-in"
                style={{ width: "100%", maxWidth: "500px" }}
            >
                <h3 className="font-display" style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>
                    Add New Quote
                </h3>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                            Client Name *
                        </label>
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
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Email
                            </label>
                            <input
                                className="input"
                                type="email"
                                value={form.clientEmail}
                                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Phone
                            </label>
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
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Service Type *
                            </label>
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
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Estimated Amount
                            </label>
                            <input
                                className="input"
                                type="number"
                                value={form.estimatedAmount}
                                onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })}
                                placeholder="$0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                            Notes
                        </label>
                        <textarea
                            className="input"
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Additional details about the quote..."
                            style={{ height: "80px", resize: "none" }}
                        />
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

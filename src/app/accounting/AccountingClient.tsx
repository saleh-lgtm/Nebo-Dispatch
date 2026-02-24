"use client";

import { useState } from "react";
import {
    Calculator,
    Flag,
    Clock,
    CheckCircle,
    Eye,
    FileText,
    User,
    Calendar,
    MessageSquare,
    X,
    Search,
    Filter,
    DollarSign,
    Building2,
} from "lucide-react";
import {
    startAccountingReview,
    resolveAccountingFlag,
    getFlaggedReservations,
} from "@/lib/accountingActions";
import { useRouter } from "next/navigation";
import AffiliatePricingTab from "./AffiliatePricingTab";

interface AccountingFlag {
    id: string;
    reservationType: string;
    reservationId: string;
    reservationNotes: string | null;
    flagReason: string | null;
    status: "PENDING" | "IN_REVIEW" | "RESOLVED";
    accountingNotes: string | null;
    resolution: string | null;
    createdAt: string;
    reviewedAt: string | null;
    shiftReport: {
        id: string;
        createdAt: string;
        user: { id: string; name: string | null; email: string | null };
        shift: { clockIn: string; clockOut: string | null };
    };
    flaggedBy: { id: string; name: string | null };
    reviewedBy: { id: string; name: string | null } | null;
}

interface Stats {
    pending: number;
    inReview: number;
    resolved: number;
    total: number;
}

interface PricingEntry {
    id: string;
    serviceType: string;
    flatRate: number;
    notes: string | null;
}

interface RoutePrice {
    id: string;
    pickupLocation: string;
    dropoffLocation: string;
    vehicleType: string | null;
    price: number;
    notes: string | null;
}

interface Affiliate {
    id: string;
    name: string;
    email: string;
    state: string | null;
    cities: string[];
    pricingGrid: PricingEntry[];
    routePricing: RoutePrice[];
}

interface Props {
    initialStats: Stats;
    initialFlags: AccountingFlag[];
    totalFlags: number;
    userRole: string;
    isAdmin: boolean;
    affiliates: Affiliate[];
}

export default function AccountingClient({
    initialStats,
    initialFlags,
    totalFlags,
    userRole,
    isAdmin,
    affiliates,
}: Props) {
    const router = useRouter();
    const [mainSection, setMainSection] = useState<"flags" | "pricing">("flags");
    const [stats, setStats] = useState(initialStats);
    const [flags, setFlags] = useState(initialFlags);
    const [total, setTotal] = useState(totalFlags);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"PENDING" | "IN_REVIEW" | "RESOLVED" | "ALL">("PENDING");
    const [selectedFlag, setSelectedFlag] = useState<AccountingFlag | null>(null);
    const [resolveModal, setResolveModal] = useState(false);
    const [resolution, setResolution] = useState("");
    const [accountingNotes, setAccountingNotes] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredFlags = flags.filter((flag) => {
        // Filter by tab
        if (activeTab !== "ALL" && flag.status !== activeTab) return false;

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                flag.reservationId.toLowerCase().includes(query) ||
                flag.shiftReport.user.name?.toLowerCase().includes(query) ||
                flag.flagReason?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const handleTabChange = async (tab: typeof activeTab) => {
        setActiveTab(tab);
        setLoading(true);

        try {
            const status = tab === "ALL" ? undefined : tab;
            const result = await getFlaggedReservations({ status, limit: 50 });
            setFlags(result.flags as unknown as AccountingFlag[]);
            setTotal(result.total);
        } catch (error) {
            console.error("Failed to fetch flags:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartReview = async (flagId: string) => {
        try {
            await startAccountingReview(flagId);
            setFlags(
                flags.map((f) =>
                    f.id === flagId ? { ...f, status: "IN_REVIEW" as const } : f
                )
            );
            setStats({ ...stats, pending: stats.pending - 1, inReview: stats.inReview + 1 });
            router.refresh();
        } catch (error) {
            console.error("Failed to start review:", error);
        }
    };

    const handleResolve = async () => {
        if (!selectedFlag || !resolution) return;

        try {
            await resolveAccountingFlag(selectedFlag.id, resolution, accountingNotes);
            setFlags(
                flags.map((f) =>
                    f.id === selectedFlag.id
                        ? { ...f, status: "RESOLVED" as const, resolution, accountingNotes }
                        : f
                )
            );
            setStats({
                ...stats,
                inReview: stats.inReview - 1,
                resolved: stats.resolved + 1,
            });
            setResolveModal(false);
            setSelectedFlag(null);
            setResolution("");
            setAccountingNotes("");
            router.refresh();
        } catch (error) {
            console.error("Failed to resolve flag:", error);
        }
    };

    const getStatusColor = (status: string) => {
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
    };

    const getTypeColor = (type: string) => {
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
    };

    return (
        <div className="accounting-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Calculator size={24} />
                    </div>
                    <div>
                        <h1 className="header-title">Accounting Dashboard</h1>
                        <p className="header-subtitle">
                            Review flagged reservations and manage affiliate pricing
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Section Tabs */}
            <div className="main-tabs">
                <button
                    className={`main-tab ${mainSection === "flags" ? "main-tab-active" : ""}`}
                    onClick={() => setMainSection("flags")}
                >
                    <Flag size={18} />
                    <span>Reservation Flags</span>
                    {stats.pending > 0 && (
                        <span className="main-tab-badge">{stats.pending}</span>
                    )}
                </button>
                <button
                    className={`main-tab ${mainSection === "pricing" ? "main-tab-active" : ""}`}
                    onClick={() => setMainSection("pricing")}
                >
                    <DollarSign size={18} />
                    <span>Affiliate Pricing</span>
                    <span className="main-tab-count">{affiliates.length}</span>
                </button>
            </div>

            {mainSection === "flags" ? (
                <>
            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card stat-pending">
                    <div className="stat-icon">
                        <Flag size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.pending}</span>
                        <span className="stat-label">Pending</span>
                    </div>
                </div>
                <div className="stat-card stat-review">
                    <div className="stat-icon">
                        <Eye size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.inReview}</span>
                        <span className="stat-label">In Review</span>
                    </div>
                </div>
                <div className="stat-card stat-resolved">
                    <div className="stat-icon">
                        <CheckCircle size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.resolved}</span>
                        <span className="stat-label">Resolved</span>
                    </div>
                </div>
                <div className="stat-card stat-total">
                    <div className="stat-icon">
                        <FileText size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total Flags</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-section">
                <div className="tabs">
                    {(["PENDING", "IN_REVIEW", "RESOLVED", "ALL"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            className={`tab ${activeTab === tab ? "tab-active" : ""}`}
                        >
                            {tab === "IN_REVIEW" ? "In Review" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                            {tab === "PENDING" && stats.pending > 0 && (
                                <span className="tab-badge">{stats.pending}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search by reservation ID, dispatcher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Flags Table */}
            <div className="flags-card">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner" />
                        <span>Loading...</span>
                    </div>
                ) : filteredFlags.length === 0 ? (
                    <div className="empty-state">
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
                ) : (
                    <div className="flags-list">
                        {filteredFlags.map((flag) => {
                            const statusColor = getStatusColor(flag.status);
                            const typeColor = getTypeColor(flag.reservationType);

                            return (
                                <div key={flag.id} className="flag-item">
                                    <div className="flag-header">
                                        <div className="flag-info">
                                            <span
                                                className="reservation-type"
                                                style={{ color: typeColor }}
                                            >
                                                {flag.reservationType.toUpperCase()}
                                            </span>
                                            <span className="reservation-id">
                                                #{flag.reservationId}
                                            </span>
                                            <span
                                                className="flag-status"
                                                style={{
                                                    background: statusColor.bg,
                                                    color: statusColor.text,
                                                    border: `1px solid ${statusColor.border}`,
                                                }}
                                            >
                                                {flag.status.replace("_", " ")}
                                            </span>
                                        </div>
                                        <div className="flag-actions">
                                            {flag.status === "PENDING" && (
                                                <button
                                                    onClick={() => handleStartReview(flag.id)}
                                                    className="action-btn action-review"
                                                >
                                                    <Eye size={14} />
                                                    Start Review
                                                </button>
                                            )}
                                            {flag.status === "IN_REVIEW" && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedFlag(flag);
                                                        setResolveModal(true);
                                                    }}
                                                    className="action-btn action-resolve"
                                                >
                                                    <CheckCircle size={14} />
                                                    Resolve
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedFlag(flag)}
                                                className="action-btn action-view"
                                            >
                                                <FileText size={14} />
                                                Details
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flag-body">
                                        <div className="flag-meta">
                                            <span className="meta-item">
                                                <User size={12} />
                                                {flag.shiftReport.user.name || "Unknown"}
                                            </span>
                                            <span className="meta-item">
                                                <Calendar size={12} />
                                                {new Date(flag.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className="meta-item">
                                                <Clock size={12} />
                                                {new Date(flag.createdAt).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>

                                        {flag.flagReason && (
                                            <div className="flag-reason">
                                                <MessageSquare size={14} />
                                                <span>{flag.flagReason}</span>
                                            </div>
                                        )}

                                        {flag.reservationNotes && (
                                            <p className="flag-notes">{flag.reservationNotes}</p>
                                        )}

                                        {flag.resolution && (
                                            <div className="flag-resolution">
                                                <CheckCircle size={14} />
                                                <span>Resolution: {flag.resolution}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedFlag && !resolveModal && (
                <div className="modal-overlay" onClick={() => setSelectedFlag(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Flag Details</h3>
                            <button onClick={() => setSelectedFlag(null)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label>Reservation ID</label>
                                    <span>#{selectedFlag.reservationId}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Type</label>
                                    <span style={{ color: getTypeColor(selectedFlag.reservationType) }}>
                                        {selectedFlag.reservationType.toUpperCase()}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <label>Status</label>
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: getStatusColor(selectedFlag.status).bg,
                                            color: getStatusColor(selectedFlag.status).text,
                                        }}
                                    >
                                        {selectedFlag.status.replace("_", " ")}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <label>Flagged By</label>
                                    <span>{selectedFlag.flaggedBy.name || "Unknown"}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Dispatcher</label>
                                    <span>{selectedFlag.shiftReport.user.name || "Unknown"}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Created</label>
                                    <span>{new Date(selectedFlag.createdAt).toLocaleString()}</span>
                                </div>
                            </div>

                            {selectedFlag.flagReason && (
                                <div className="detail-section">
                                    <label>Flag Reason</label>
                                    <p>{selectedFlag.flagReason}</p>
                                </div>
                            )}

                            {selectedFlag.reservationNotes && (
                                <div className="detail-section">
                                    <label>Reservation Notes</label>
                                    <p>{selectedFlag.reservationNotes}</p>
                                </div>
                            )}

                            {selectedFlag.accountingNotes && (
                                <div className="detail-section">
                                    <label>Accounting Notes</label>
                                    <p>{selectedFlag.accountingNotes}</p>
                                </div>
                            )}

                            {selectedFlag.resolution && (
                                <div className="detail-section">
                                    <label>Resolution</label>
                                    <p>{selectedFlag.resolution}</p>
                                </div>
                            )}

                            {selectedFlag.reviewedBy && (
                                <div className="detail-section">
                                    <label>Reviewed By</label>
                                    <p>
                                        {selectedFlag.reviewedBy.name} on{" "}
                                        {selectedFlag.reviewedAt
                                            ? new Date(selectedFlag.reviewedAt).toLocaleString()
                                            : "N/A"}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            {selectedFlag.status === "PENDING" && (
                                <button
                                    onClick={() => handleStartReview(selectedFlag.id)}
                                    className="btn btn-primary"
                                >
                                    <Eye size={16} />
                                    Start Review
                                </button>
                            )}
                            {selectedFlag.status === "IN_REVIEW" && (
                                <button
                                    onClick={() => setResolveModal(true)}
                                    className="btn btn-success"
                                >
                                    <CheckCircle size={16} />
                                    Resolve
                                </button>
                            )}
                            <button onClick={() => setSelectedFlag(null)} className="btn btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {resolveModal && selectedFlag && (
                <div className="modal-overlay" onClick={() => setResolveModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Resolve Flag</h3>
                            <button onClick={() => setResolveModal(false)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="resolve-info">
                                Resolving flag for reservation <strong>#{selectedFlag.reservationId}</strong>
                            </p>

                            <div className="form-group">
                                <label>Resolution *</label>
                                <select
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    required
                                >
                                    <option value="">Select resolution...</option>
                                    <option value="Approved - No Issues">Approved - No Issues</option>
                                    <option value="Approved - Minor Adjustment">Approved - Minor Adjustment</option>
                                    <option value="Rejected - Requires Correction">Rejected - Requires Correction</option>
                                    <option value="Escalated to Management">Escalated to Management</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Accounting Notes</label>
                                <textarea
                                    value={accountingNotes}
                                    onChange={(e) => setAccountingNotes(e.target.value)}
                                    placeholder="Add any notes about this resolution..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setResolveModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                className="btn btn-success"
                                disabled={!resolution}
                            >
                                <CheckCircle size={16} />
                                Resolve Flag
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </>
            ) : (
                <AffiliatePricingTab affiliates={affiliates} isAdmin={isAdmin} />
            )}

            <style jsx>{`
                .accounting-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 2rem;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: var(--accent);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .header-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .header-subtitle {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                /* Main Section Tabs */
                .main-tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    padding: 0.25rem;
                    background: var(--bg-muted);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    width: fit-content;
                }

                .main-tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: transparent;
                    border: none;
                    border-radius: 10px;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .main-tab:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .main-tab-active {
                    background: var(--accent);
                    color: white;
                }

                .main-tab-badge {
                    background: var(--danger);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .main-tab-active .main-tab-badge {
                    background: rgba(255, 255, 255, 0.3);
                    color: white;
                }

                .main-tab-count {
                    padding: 0.125rem 0.5rem;
                    background: var(--bg-hover);
                    border-radius: 9999px;
                    font-size: 0.7rem;
                }

                .main-tab-active .main-tab-count {
                    background: rgba(255, 255, 255, 0.2);
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                }

                .stat-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-pending .stat-icon {
                    background: var(--warning-soft);
                    color: var(--warning);
                }

                .stat-review .stat-icon {
                    background: var(--info-soft);
                    color: var(--info);
                }

                .stat-resolved .stat-icon {
                    background: var(--success-soft);
                    color: var(--success);
                }

                .stat-total .stat-icon {
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                /* Filters */
                .filters-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    flex-wrap: wrap;
                }

                .tabs {
                    display: flex;
                    gap: 0.5rem;
                }

                .tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: transparent;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tab:hover {
                    background: var(--bg-hover);
                }

                .tab-active {
                    background: var(--accent);
                    color: white;
                    border-color: var(--accent);
                }

                .tab-badge {
                    background: var(--danger);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .tab-active .tab-badge {
                    background: rgba(255, 255, 255, 0.3);
                    color: white;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    min-width: 300px;
                }

                .search-box input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .search-box input::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                /* Flags Card */
                .flags-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    overflow: hidden;
                }

                .loading-state,
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    color: var(--text-secondary);
                    gap: 1rem;
                }

                .empty-state h3 {
                    font-size: 1.125rem;
                    color: var(--text-primary);
                    margin: 0;
                }

                .empty-state p {
                    font-size: 0.875rem;
                    margin: 0;
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--border);
                    border-top-color: var(--accent);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                /* Flags List */
                .flags-list {
                    display: flex;
                    flex-direction: column;
                }

                .flag-item {
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    transition: background 0.2s;
                }

                .flag-item:hover {
                    background: var(--bg-hover);
                }

                .flag-item:last-child {
                    border-bottom: none;
                }

                .flag-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .flag-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .reservation-type {
                    font-size: 0.7rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }

                .reservation-id {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .flag-status {
                    font-size: 0.7rem;
                    font-weight: 500;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                }

                .flag-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-review {
                    background: var(--info-soft);
                    border: 1px solid var(--info-border);
                    color: var(--info);
                }

                .action-review:hover {
                    background: var(--info-soft);
                    filter: brightness(1.1);
                }

                .action-resolve {
                    background: var(--success-soft);
                    border: 1px solid var(--success-border);
                    color: var(--success);
                }

                .action-resolve:hover {
                    background: var(--success-soft);
                    filter: brightness(1.1);
                }

                .action-view {
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    color: var(--text-secondary);
                }

                .action-view:hover {
                    background: var(--bg-active);
                    color: var(--text-primary);
                }

                .flag-body {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .flag-meta {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .flag-reason {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    background: var(--warning-soft);
                    border: 1px solid var(--warning-border);
                    border-radius: 8px;
                    color: var(--warning);
                    font-size: 0.8rem;
                }

                .flag-notes {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin: 0;
                }

                .flag-resolution {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--success);
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                }

                .modal {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                }

                .modal-header h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.25rem;
                }

                .close-btn:hover {
                    color: var(--text-primary);
                }

                .modal-body {
                    padding: 1.5rem;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--border);
                }

                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .detail-item label {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .detail-item span {
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }

                .status-badge {
                    display: inline-block;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                }

                .detail-section {
                    margin-bottom: 1rem;
                }

                .detail-section label {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 0.5rem;
                }

                .detail-section p {
                    font-size: 0.875rem;
                    color: var(--text-primary);
                    margin: 0;
                    padding: 0.75rem;
                    background: var(--bg-muted);
                    border-radius: 8px;
                }

                .resolve-info {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-bottom: 1.5rem;
                }

                .resolve-info strong {
                    color: var(--text-primary);
                }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                }

                .form-group textarea {
                    min-height: 100px;
                    resize: vertical;
                }

                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-primary {
                    background: var(--info);
                    border: none;
                    color: white;
                }

                .btn-success {
                    background: var(--success);
                    border: none;
                    color: white;
                }

                .btn-secondary {
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--text-secondary);
                }

                .btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                }

                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 768px) {
                    .stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .filters-section {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .tabs {
                        overflow-x: auto;
                        padding-bottom: 0.5rem;
                    }

                    .search-box {
                        min-width: auto;
                    }

                    .flag-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 480px) {
                    .stats-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

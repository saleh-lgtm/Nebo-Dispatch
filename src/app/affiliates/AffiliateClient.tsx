"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    Globe,
    Mail,
    MapPin,
    DollarSign,
    Info,
    ShieldCheck,
    Clock,
    Check,
    X,
    MoreVertical,
    Trash2,
} from "lucide-react";
import { submitAffiliate } from "@/lib/actions";
import { approveAffiliate, rejectAffiliate, deleteAffiliate } from "@/lib/affiliateActions";
import { useToast } from "@/hooks/useToast";
import Modal from "@/components/ui/Modal";

interface Affiliate {
    id: string;
    name: string;
    email: string;
    market: string;
    notes: string | null;
    cityTransferRate: string | null;
    isApproved: boolean;
    createdAt: Date;
    submittedBy: { id: string; name: string | null; email: string | null };
}

interface Props {
    initialAffiliates: Affiliate[];
    session: { user: { id: string; name?: string | null; email?: string | null; role: string } };
    isAdmin: boolean;
    pendingCount: number;
}

export default function AffiliateClient({ initialAffiliates, session, isAdmin, pendingCount }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [affiliates] = useState(initialAffiliates);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved">(pendingCount > 0 ? "pending" : "approved");
    const [loading, setLoading] = useState(false);
    const [actionDropdown, setActionDropdown] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ open: boolean; affiliate: Affiliate | null }>({ open: false, affiliate: null });
    const [rejectReason, setRejectReason] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        market: "",
        cityTransferRate: "",
        notes: ""
    });

    const filteredAffiliates = affiliates.filter((a) => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.market.toLowerCase().includes(search.toLowerCase());

        if (!isAdmin) return matchesSearch && a.isApproved;

        if (activeTab === "pending") return matchesSearch && !a.isApproved;
        if (activeTab === "approved") return matchesSearch && a.isApproved;
        return matchesSearch;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await submitAffiliate({
                ...formData,
                submittedById: session.user.id
            });
            setShowForm(false);
            setFormData({ name: "", email: "", market: "", cityTransferRate: "", notes: "" });
            addToast("Affiliate submitted for admin approval!", "success");
            router.refresh();
        } catch {
            addToast("Failed to submit affiliate", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (affiliate: Affiliate) => {
        setLoading(true);
        try {
            await approveAffiliate(affiliate.id);
            addToast(`${affiliate.name} has been approved`, "success");
            setActionDropdown(null);
            router.refresh();
        } catch {
            addToast("Failed to approve affiliate", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectModal.affiliate) return;
        setLoading(true);
        try {
            await rejectAffiliate(rejectModal.affiliate.id, rejectReason);
            addToast(`${rejectModal.affiliate.name} has been rejected`, "info");
            setRejectModal({ open: false, affiliate: null });
            setRejectReason("");
            router.refresh();
        } catch {
            addToast("Failed to reject affiliate", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (affiliate: Affiliate) => {
        if (!confirm(`Are you sure you want to delete ${affiliate.name}?`)) return;
        setLoading(true);
        try {
            await deleteAffiliate(affiliate.id);
            addToast(`${affiliate.name} has been deleted`, "info");
            setActionDropdown(null);
            router.refresh();
        } catch {
            addToast("Failed to delete affiliate", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <header className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>Affiliate Directory</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Manage farm-out partners and network rates</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Add Affiliate</span>
                </button>
            </header>

            {/* Admin Tabs */}
            {isAdmin && (
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setActiveTab("pending")}
                        className={`btn ${activeTab === "pending" ? "btn-primary" : "btn-ghost"}`}
                    >
                        <Clock size={16} />
                        Pending
                        {pendingCount > 0 && (
                            <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("approved")}
                        className={`btn ${activeTab === "approved" ? "btn-primary" : "btn-ghost"}`}
                    >
                        <ShieldCheck size={16} />
                        Approved
                    </button>
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`btn ${activeTab === "all" ? "btn-primary" : "btn-ghost"}`}
                    >
                        <Globe size={16} />
                        All
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="glass-card" style={{ padding: "1rem" }}>
                <div className="flex items-center gap-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: "0.5rem", padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Search size={18} className="text-accent" />
                    <input
                        type="text"
                        placeholder="Search by name or market..."
                        style={{ background: "transparent", border: "none", outline: "none", flex: 1, color: "white" }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Affiliate Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {filteredAffiliates.map((affiliate) => (
                    <div key={affiliate.id} className="glass-card flex flex-col gap-4" style={{ position: "relative" }}>
                        <div className="flex justify-between items-start">
                            <h3 className="font-display" style={{ fontSize: "1.25rem", color: "var(--accent)" }}>
                                {affiliate.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                {affiliate.isApproved ? (
                                    <span className="badge badge-success flex items-center gap-1">
                                        <ShieldCheck size={12} /> Approved
                                    </span>
                                ) : (
                                    <span className="badge badge-warning flex items-center gap-1">
                                        <Clock size={12} /> Pending
                                    </span>
                                )}

                                {isAdmin && (
                                    <div style={{ position: "relative" }}>
                                        <button
                                            onClick={() => setActionDropdown(actionDropdown === affiliate.id ? null : affiliate.id)}
                                            className="btn btn-ghost btn-icon"
                                            aria-label="Actions"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                        {actionDropdown === affiliate.id && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    right: 0,
                                                    top: "100%",
                                                    background: "var(--bg-secondary)",
                                                    border: "1px solid var(--border)",
                                                    borderRadius: "0.5rem",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                                    minWidth: "150px",
                                                    zIndex: 10,
                                                }}
                                            >
                                                {!affiliate.isApproved && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(affiliate)}
                                                            disabled={loading}
                                                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--success)", textAlign: "left" }}
                                                        >
                                                            <Check size={16} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setRejectModal({ open: true, affiliate });
                                                                setActionDropdown(null);
                                                            }}
                                                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--danger)", textAlign: "left" }}
                                                        >
                                                            <X size={16} /> Reject
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(affiliate)}
                                                    disabled={loading}
                                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--danger)", textAlign: "left" }}
                                                >
                                                    <Trash2 size={16} /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                <MapPin size={14} className="text-accent" />
                                <span>{affiliate.market}</span>
                            </div>
                            <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                <Mail size={14} className="text-accent" />
                                <span>{affiliate.email}</span>
                            </div>
                            <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                <DollarSign size={14} className="text-accent" />
                                <span>Rate: {affiliate.cityTransferRate || "Not specified"}</span>
                            </div>
                        </div>

                        {affiliate.notes && (
                            <div style={{ background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "0.5rem" }} className="flex gap-3 items-start">
                                <Info size={16} className="text-accent" style={{ marginTop: "0.125rem" }} />
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{affiliate.notes}</p>
                            </div>
                        )}

                        {!affiliate.isApproved && (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                Submitted by {affiliate.submittedBy.name || affiliate.submittedBy.email}
                            </p>
                        )}
                    </div>
                ))}

                {filteredAffiliates.length === 0 && (
                    <div className="glass-card text-center py-12" style={{ gridColumn: "1 / -1" }}>
                        <Globe size={48} className="text-accent mx-auto mb-4" style={{ opacity: 0.3 }} />
                        <p style={{ color: "var(--text-secondary)" }}>
                            {activeTab === "pending" ? "No pending affiliates to review." : "No affiliates found matching your search."}
                        </p>
                    </div>
                )}
            </div>

            {/* Submit Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Submit New Affiliate" size="lg">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Company Name *
                        </label>
                        <input
                            required
                            className="input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Email Address *
                        </label>
                        <input
                            required
                            type="email"
                            className="input"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Market (City/State) *
                            </label>
                            <input
                                required
                                className="input"
                                value={formData.market}
                                onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Transfer Rate
                            </label>
                            <input
                                className="input"
                                value={formData.cityTransferRate}
                                onChange={(e) => setFormData({ ...formData, cityTransferRate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Additional Notes
                        </label>
                        <textarea
                            className="input"
                            style={{ minHeight: "100px", resize: "vertical" }}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-4 flex-wrap">
                        <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Submitting..." : "Submit for Approval"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Reject Modal */}
            <Modal
                isOpen={rejectModal.open}
                onClose={() => setRejectModal({ open: false, affiliate: null })}
                title="Reject Affiliate"
                size="sm"
            >
                <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                    Are you sure you want to reject <strong>{rejectModal.affiliate?.name}</strong>?
                </p>
                <div className="flex flex-col gap-1 mb-4">
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Reason (optional)
                    </label>
                    <textarea
                        className="input"
                        style={{ minHeight: "80px", resize: "vertical" }}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Provide a reason for rejection..."
                    />
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setRejectModal({ open: false, affiliate: null })} className="btn btn-ghost">
                        Cancel
                    </button>
                    <button onClick={handleReject} className="btn btn-danger" disabled={loading}>
                        {loading ? "Rejecting..." : "Reject"}
                    </button>
                </div>
            </Modal>
        </div>
    );
}

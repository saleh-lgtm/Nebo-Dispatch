"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    Globe,
    Mail,
    Phone,
    MapPin,
    DollarSign,
    Info,
    ShieldCheck,
    Clock,
    Check,
    X,
    MoreVertical,
    Trash2,
    Edit3,
    Building2,
    ArrowDownLeft,
    ArrowUpRight,
} from "lucide-react";
import { submitAffiliate } from "@/lib/actions";
import { approveAffiliate, rejectAffiliate, deleteAffiliate, updateAffiliate } from "@/lib/affiliateActions";
import { useToast } from "@/hooks/useToast";
import Modal from "@/components/ui/Modal";
import AffiliatePricingGrid from "@/components/AffiliatePricingGrid";

type AffiliateType = "FARM_IN" | "FARM_OUT";

interface PricingEntry {
    id: string;
    serviceType: string;
    flatRate: number;
    notes: string | null;
}

interface Affiliate {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    state: string;
    cities: string[];
    notes: string | null;
    cityTransferRate: string | null;
    isApproved: boolean;
    type: AffiliateType;
    createdAt: Date;
    submittedBy: { id: string; name: string | null; email: string | null };
    pricingGrid?: PricingEntry[];
}

interface Props {
    initialAffiliates: Affiliate[];
    session: { user: { id: string; name?: string | null; email?: string | null; role: string } };
    isAdmin: boolean;
    pendingCounts: { farmInCount: number; farmOutCount: number };
}

export default function AffiliateClient({ initialAffiliates, session, isAdmin, pendingCounts }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [affiliates] = useState(initialAffiliates);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [typeTab, setTypeTab] = useState<AffiliateType>("FARM_OUT");
    const [statusTab, setStatusTab] = useState<"all" | "pending" | "approved">(
        (typeTab === "FARM_IN" ? pendingCounts.farmInCount : pendingCounts.farmOutCount) > 0 ? "pending" : "approved"
    );
    const [loading, setLoading] = useState(false);
    const [actionDropdown, setActionDropdown] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ open: boolean; affiliate: Affiliate | null }>({ open: false, affiliate: null });
    const [rejectReason, setRejectReason] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        state: "",
        cities: [] as string[],
        cityInput: "",
        cityTransferRate: "",
        notes: "",
        type: "FARM_OUT" as AffiliateType
    });

    const [editModal, setEditModal] = useState<{ open: boolean; affiliate: Affiliate | null }>({ open: false, affiliate: null });
    const [pricingModal, setPricingModal] = useState<{ open: boolean; affiliate: Affiliate | null }>({ open: false, affiliate: null });
    const [editData, setEditData] = useState({
        name: "",
        email: "",
        phone: "",
        state: "",
        cities: [] as string[],
        cityInput: "",
        cityTransferRate: "",
        notes: ""
    });

    const currentPendingCount = typeTab === "FARM_IN" ? pendingCounts.farmInCount : pendingCounts.farmOutCount;

    const filteredAffiliates = affiliates.filter((a) => {
        // Filter by type first
        if (a.type !== typeTab) return false;

        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.state.toLowerCase().includes(search.toLowerCase()) ||
            a.cities.some(c => c.toLowerCase().includes(search.toLowerCase()));

        if (!isAdmin) return matchesSearch && a.isApproved;

        if (statusTab === "pending") return matchesSearch && !a.isApproved;
        if (statusTab === "approved") return matchesSearch && a.isApproved;
        return matchesSearch;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.cities.length === 0) {
            addToast("Please add at least one city", "error");
            return;
        }
        setLoading(true);
        try {
            await submitAffiliate({
                name: formData.name,
                email: formData.email,
                phone: formData.phone || undefined,
                state: formData.state,
                cities: formData.cities,
                cityTransferRate: formData.cityTransferRate || undefined,
                notes: formData.notes || undefined,
                submittedById: session.user.id,
                type: formData.type
            });
            setShowForm(false);
            setFormData({ name: "", email: "", phone: "", state: "", cities: [], cityInput: "", cityTransferRate: "", notes: "", type: "FARM_OUT" });
            addToast("Affiliate submitted for admin approval!", "success");
            router.refresh();
        } catch {
            addToast("Failed to submit affiliate", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editModal.affiliate) return;
        if (editData.cities.length === 0) {
            addToast("Please add at least one city", "error");
            return;
        }
        setLoading(true);
        try {
            await updateAffiliate(editModal.affiliate.id, {
                name: editData.name,
                email: editData.email,
                phone: editData.phone || undefined,
                state: editData.state,
                cities: editData.cities,
                cityTransferRate: editData.cityTransferRate || undefined,
                notes: editData.notes || undefined,
            });
            setEditModal({ open: false, affiliate: null });
            addToast("Affiliate updated successfully!", "success");
            router.refresh();
        } catch {
            addToast("Failed to update affiliate", "error");
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (affiliate: Affiliate) => {
        setEditData({
            name: affiliate.name,
            email: affiliate.email,
            phone: affiliate.phone || "",
            state: affiliate.state,
            cities: affiliate.cities,
            cityInput: "",
            cityTransferRate: affiliate.cityTransferRate || "",
            notes: affiliate.notes || ""
        });
        setEditModal({ open: true, affiliate });
        setActionDropdown(null);
    };

    const addCity = (isEdit = false) => {
        if (isEdit) {
            const city = editData.cityInput.trim();
            if (city && !editData.cities.includes(city)) {
                setEditData({ ...editData, cities: [...editData.cities, city], cityInput: "" });
            }
        } else {
            const city = formData.cityInput.trim();
            if (city && !formData.cities.includes(city)) {
                setFormData({ ...formData, cities: [...formData.cities, city], cityInput: "" });
            }
        }
    };

    const removeCity = (cityToRemove: string, isEdit = false) => {
        if (isEdit) {
            setEditData({ ...editData, cities: editData.cities.filter(c => c !== cityToRemove) });
        } else {
            setFormData({ ...formData, cities: formData.cities.filter(c => c !== cityToRemove) });
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
                    <p style={{ color: "var(--text-secondary)" }}>
                        Manage your Farm In and Farm Out affiliate network
                    </p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Add Affiliate</span>
                </button>
            </header>

            {/* Type Tabs - Farm In / Farm Out */}
            <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setTypeTab("FARM_OUT")}
                        className={`btn ${typeTab === "FARM_OUT" ? "btn-primary" : "btn-ghost"}`}
                        style={{ minWidth: "140px" }}
                    >
                        <ArrowUpRight size={16} />
                        Farm Out
                        {isAdmin && pendingCounts.farmOutCount > 0 && (
                            <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>
                                {pendingCounts.farmOutCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTypeTab("FARM_IN")}
                        className={`btn ${typeTab === "FARM_IN" ? "btn-primary" : "btn-ghost"}`}
                        style={{ minWidth: "140px" }}
                    >
                        <ArrowDownLeft size={16} />
                        Farm In
                        {isAdmin && pendingCounts.farmInCount > 0 && (
                            <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>
                                {pendingCounts.farmInCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Status Tabs - Admin Only */}
                {isAdmin && (
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setStatusTab("pending")}
                            className={`btn btn-sm ${statusTab === "pending" ? "btn-primary" : "btn-ghost"}`}
                        >
                            <Clock size={14} />
                            Pending
                            {currentPendingCount > 0 && (
                                <span className="badge badge-warning" style={{ marginLeft: "0.25rem", fontSize: "0.7rem" }}>
                                    {currentPendingCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setStatusTab("approved")}
                            className={`btn btn-sm ${statusTab === "approved" ? "btn-primary" : "btn-ghost"}`}
                        >
                            <ShieldCheck size={14} />
                            Approved
                        </button>
                        <button
                            onClick={() => setStatusTab("all")}
                            className={`btn btn-sm ${statusTab === "all" ? "btn-primary" : "btn-ghost"}`}
                        >
                            <Globe size={14} />
                            All
                        </button>
                    </div>
                )}
            </div>

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
                                                <button
                                                    onClick={() => openEditModal(affiliate)}
                                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", textAlign: "left" }}
                                                >
                                                    <Edit3 size={16} /> Edit
                                                </button>
                                                {affiliate.type === "FARM_IN" && (
                                                    <button
                                                        onClick={() => {
                                                            setPricingModal({ open: true, affiliate });
                                                            setActionDropdown(null);
                                                        }}
                                                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "#4ade80", textAlign: "left" }}
                                                    >
                                                        <DollarSign size={16} /> Pricing Grid
                                                    </button>
                                                )}
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
                                <Building2 size={14} className="text-accent" />
                                <span>{affiliate.state}</span>
                            </div>
                            <div className="flex items-start gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                <MapPin size={14} className="text-accent" style={{ marginTop: "0.125rem", flexShrink: 0 }} />
                                <div className="flex flex-wrap gap-1">
                                    {affiliate.cities.map((city) => (
                                        <span key={city} style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.125rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.75rem" }}>
                                            {city}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                <Mail size={14} className="text-accent" />
                                <span>{affiliate.email}</span>
                            </div>
                            {affiliate.phone && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <Phone size={14} className="text-accent" />
                                    <span>{affiliate.phone}</span>
                                </div>
                            )}
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
                            {statusTab === "pending" ? "No pending affiliates to review." : `No ${typeTab === "FARM_IN" ? "Farm In" : "Farm Out"} affiliates found.`}
                        </p>
                    </div>
                )}
            </div>

            {/* Submit Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Submit New Affiliate" size="lg">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Affiliate Type Selection */}
                    <div className="flex flex-col gap-2">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Affiliate Type *
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: "FARM_OUT" })}
                                className={`btn flex-1 ${formData.type === "FARM_OUT" ? "btn-primary" : "btn-ghost"}`}
                                style={{ justifyContent: "center" }}
                            >
                                <ArrowUpRight size={16} />
                                Farm Out
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: "FARM_IN" })}
                                className={`btn flex-1 ${formData.type === "FARM_IN" ? "btn-primary" : "btn-ghost"}`}
                                style={{ justifyContent: "center" }}
                            >
                                <ArrowDownLeft size={16} />
                                Farm In
                            </button>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {formData.type === "FARM_OUT" ? "Partners we send work to" : "Partners that send work to us"}
                        </p>
                    </div>

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
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
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
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                className="input"
                                placeholder="(555) 123-4567"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                State *
                            </label>
                            <input
                                required
                                className="input"
                                placeholder="e.g., TX, CA, NY"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
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
                            Cities Served *
                        </label>
                        <div className="flex gap-2">
                            <input
                                className="input"
                                style={{ flex: 1 }}
                                placeholder="Enter city name and press Add"
                                value={formData.cityInput}
                                onChange={(e) => setFormData({ ...formData, cityInput: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(false); } }}
                            />
                            <button type="button" onClick={() => addCity(false)} className="btn btn-ghost">
                                Add
                            </button>
                        </div>
                        {formData.cities.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {formData.cities.map((city) => (
                                    <span key={city} style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        {city}
                                        <button type="button" onClick={() => removeCity(city, false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, display: "flex" }}>
                                            <X size={14} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
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

            {/* Edit Modal */}
            <Modal
                isOpen={editModal.open}
                onClose={() => setEditModal({ open: false, affiliate: null })}
                title="Edit Affiliate"
                size="lg"
            >
                <form onSubmit={handleEdit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Company Name *
                        </label>
                        <input
                            required
                            className="input"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Email Address *
                            </label>
                            <input
                                required
                                type="email"
                                className="input"
                                value={editData.email}
                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                className="input"
                                placeholder="(555) 123-4567"
                                value={editData.phone}
                                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                State *
                            </label>
                            <input
                                required
                                className="input"
                                placeholder="e.g., TX, CA, NY"
                                value={editData.state}
                                onChange={(e) => setEditData({ ...editData, state: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Transfer Rate
                            </label>
                            <input
                                className="input"
                                value={editData.cityTransferRate}
                                onChange={(e) => setEditData({ ...editData, cityTransferRate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Cities Served *
                        </label>
                        <div className="flex gap-2">
                            <input
                                className="input"
                                style={{ flex: 1 }}
                                placeholder="Enter city name and press Add"
                                value={editData.cityInput}
                                onChange={(e) => setEditData({ ...editData, cityInput: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(true); } }}
                            />
                            <button type="button" onClick={() => addCity(true)} className="btn btn-ghost">
                                Add
                            </button>
                        </div>
                        {editData.cities.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {editData.cities.map((city) => (
                                    <span key={city} style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        {city}
                                        <button type="button" onClick={() => removeCity(city, true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, display: "flex" }}>
                                            <X size={14} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Additional Notes
                        </label>
                        <textarea
                            className="input"
                            style={{ minHeight: "100px", resize: "vertical" }}
                            value={editData.notes}
                            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-4 flex-wrap">
                        <button type="button" onClick={() => setEditModal({ open: false, affiliate: null })} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Pricing Grid Modal */}
            <Modal
                isOpen={pricingModal.open}
                onClose={() => setPricingModal({ open: false, affiliate: null })}
                title="Affiliate Pricing"
                size="lg"
            >
                {pricingModal.affiliate && (
                    <AffiliatePricingGrid
                        affiliateId={pricingModal.affiliate.id}
                        affiliateName={pricingModal.affiliate.name}
                        pricing={pricingModal.affiliate.pricingGrid || []}
                        isAdmin={isAdmin}
                        onClose={() => setPricingModal({ open: false, affiliate: null })}
                    />
                )}
            </Modal>
        </div>
    );
}

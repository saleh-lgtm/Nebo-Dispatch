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
    Paperclip,
    Car,
    Users,
    MessageSquare,
    BookUser,
    User,
    IdCard,
    Calendar,
} from "lucide-react";
import {
    createNetworkPartner,
    approveNetworkPartner,
    rejectNetworkPartner,
    deleteNetworkPartner,
    updateNetworkPartner,
    type PartnerType,
} from "@/lib/networkActions";
import { useToast } from "@/hooks/useToast";
import Modal from "@/components/ui/Modal";
import AffiliatePricingGrid from "@/components/AffiliatePricingGrid";
import AffiliateAttachments from "@/components/affiliates/AffiliateAttachments";
import PartnerForm from "./components/PartnerForm";
import ContactBookView from "./components/ContactBookView";

interface PricingEntry {
    id: string;
    serviceType: string;
    flatRate: number;
    notes: string | null;
}

interface AttachmentEntry {
    id: string;
    title: string;
    description: string | null;
    documentType: string | null;
    fileUrl: string;
    fileName: string;
    fileSize: number | null;
    createdAt: Date;
    uploadedBy: { id: string; name: string | null };
}

interface VehicleInfo {
    id: string;
    vehicleType: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    licensePlate: string | null;
}

interface SchedulePrefs {
    id: string;
    preferredDays: string[];
    preferredShifts: string[];
    maxHoursWeek: number | null;
}

interface VehicleAssignment {
    id: string;
    isPrimary: boolean;
    vehicle: {
        id: string;
        name: string;
        make: string;
        model: string;
        licensePlate: string;
    };
}

interface Partner {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    state: string | null;
    cities: string[];
    notes: string | null;
    cityTransferRate: string | null;
    isApproved: boolean;
    isActive: boolean;
    type: PartnerType;
    market: string | null;
    employeeId: string | null;
    createdAt: Date;
    submittedBy: { id: string; name: string | null; email: string | null };
    pricingGrid?: PricingEntry[];
    attachments?: AttachmentEntry[];
    vehicleInfo?: VehicleInfo | null;
    schedulePrefs?: SchedulePrefs | null;
    vehicleAssignments?: VehicleAssignment[];
    smsContacts?: { id: string; phoneNumber: string }[];
}

interface Props {
    initialPartners: Partner[];
    session: { user: { id: string; name?: string | null; email?: string | null; role: string } };
    isAdmin: boolean;
    pendingCounts: {
        farmInCount: number;
        farmOutCount: number;
        iosCount: number;
        houseChauffeurCount: number;
    };
}

const PARTNER_TYPES: { key: PartnerType; label: string; icon: typeof ArrowUpRight; description: string }[] = [
    { key: "FARM_OUT", label: "Farm Out", icon: ArrowUpRight, description: "Partners we send work to" },
    { key: "FARM_IN", label: "Farm In", icon: ArrowDownLeft, description: "Partners that send work to us" },
    { key: "IOS", label: "IOS", icon: Car, description: "Independent Operators" },
    { key: "HOUSE_CHAUFFEUR", label: "House Chauffeurs", icon: Users, description: "In-house drivers" },
];

export default function NetworkClient({ initialPartners, session, isAdmin, pendingCounts }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [partners] = useState(initialPartners);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [typeTab, setTypeTab] = useState<PartnerType>("FARM_OUT");
    const [statusTab, setStatusTab] = useState<"all" | "pending" | "approved">("approved");
    const [viewMode, setViewMode] = useState<"cards" | "contacts">("cards");
    const [loading, setLoading] = useState(false);
    const [actionDropdown, setActionDropdown] = useState<string | null>(null);

    // Modals
    const [rejectModal, setRejectModal] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });
    const [rejectReason, setRejectReason] = useState("");
    const [editModal, setEditModal] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });
    const [pricingModal, setPricingModal] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });
    const [attachmentsModal, setAttachmentsModal] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });
    const [smsModal, setSmsModal] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });

    const getPendingCount = (type: PartnerType): number => {
        switch (type) {
            case "FARM_IN": return pendingCounts.farmInCount;
            case "FARM_OUT": return pendingCounts.farmOutCount;
            case "IOS": return pendingCounts.iosCount;
            case "HOUSE_CHAUFFEUR": return pendingCounts.houseChauffeurCount;
            default: return 0;
        }
    };

    const currentPendingCount = getPendingCount(typeTab);

    const filteredPartners = partners.filter((p) => {
        if (p.type !== typeTab) return false;

        const searchLower = search.toLowerCase();
        const matchesSearch =
            p.name.toLowerCase().includes(searchLower) ||
            p.email.toLowerCase().includes(searchLower) ||
            (p.phone && p.phone.includes(search)) ||
            (p.state && p.state.toLowerCase().includes(searchLower)) ||
            (p.market && p.market.toLowerCase().includes(searchLower)) ||
            (p.employeeId && p.employeeId.toLowerCase().includes(searchLower)) ||
            p.cities.some(c => c.toLowerCase().includes(searchLower));

        if (!isAdmin) return matchesSearch && p.isApproved;

        if (statusTab === "pending") return matchesSearch && !p.isApproved;
        if (statusTab === "approved") return matchesSearch && p.isApproved;
        return matchesSearch;
    });

    const handleSubmit = async (formData: {
        name: string;
        email: string;
        phone?: string;
        type: PartnerType;
        state?: string;
        cities?: string[];
        notes?: string;
        cityTransferRate?: string;
        market?: string;
        employeeId?: string;
    }) => {
        setLoading(true);
        try {
            await createNetworkPartner({
                ...formData,
                submittedById: session.user.id,
            });
            setShowForm(false);
            addToast("Partner submitted for admin approval!", "success");
            router.refresh();
        } catch {
            addToast("Failed to submit partner", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (partner: Partner) => {
        setLoading(true);
        try {
            await approveNetworkPartner(partner.id);
            addToast(`${partner.name} has been approved`, "success");
            setActionDropdown(null);
            router.refresh();
        } catch {
            addToast("Failed to approve partner", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectModal.partner) return;
        setLoading(true);
        try {
            await rejectNetworkPartner(rejectModal.partner.id, rejectReason);
            addToast(`${rejectModal.partner.name} has been rejected`, "info");
            setRejectModal({ open: false, partner: null });
            setRejectReason("");
            router.refresh();
        } catch {
            addToast("Failed to reject partner", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (partner: Partner) => {
        if (!confirm(`Are you sure you want to delete ${partner.name}?`)) return;
        setLoading(true);
        try {
            await deleteNetworkPartner(partner.id);
            addToast(`${partner.name} has been deleted`, "info");
            setActionDropdown(null);
            router.refresh();
        } catch {
            addToast("Failed to delete partner", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async (data: {
        name?: string;
        email?: string;
        phone?: string;
        state?: string;
        cities?: string[];
        notes?: string;
        cityTransferRate?: string;
        market?: string;
        employeeId?: string;
    }) => {
        if (!editModal.partner) return;
        setLoading(true);
        try {
            await updateNetworkPartner(editModal.partner.id, data);
            setEditModal({ open: false, partner: null });
            addToast("Partner updated successfully!", "success");
            router.refresh();
        } catch {
            addToast("Failed to update partner", "error");
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (partner: Partner) => {
        setEditModal({ open: true, partner });
        setActionDropdown(null);
    };

    const renderPartnerCard = (partner: Partner) => {
        const TypeIcon = PARTNER_TYPES.find(t => t.key === partner.type)?.icon || Globe;

        return (
            <div key={partner.id} className="glass-card flex flex-col gap-4" style={{ position: "relative" }}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <TypeIcon size={16} className="text-accent" />
                        <h3 className="font-display" style={{ fontSize: "1.25rem", color: "var(--accent)" }}>
                            {partner.name}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {!partner.isActive && (
                            <span className="badge badge-danger">Inactive</span>
                        )}
                        {partner.isApproved ? (
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
                                    onClick={() => setActionDropdown(actionDropdown === partner.id ? null : partner.id)}
                                    className="btn btn-ghost btn-icon"
                                    aria-label="Actions"
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {actionDropdown === partner.id && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            right: 0,
                                            top: "100%",
                                            background: "var(--bg-secondary)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "0.5rem",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                            minWidth: "160px",
                                            zIndex: 10,
                                        }}
                                    >
                                        <button
                                            onClick={() => openEditModal(partner)}
                                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", textAlign: "left" }}
                                        >
                                            <Edit3 size={16} /> Edit
                                        </button>
                                        {partner.phone && (
                                            <button
                                                onClick={() => {
                                                    setSmsModal({ open: true, partner });
                                                    setActionDropdown(null);
                                                }}
                                                style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "#60a5fa", textAlign: "left" }}
                                            >
                                                <MessageSquare size={16} /> Message
                                            </button>
                                        )}
                                        {partner.type === "FARM_IN" && (
                                            <button
                                                onClick={() => {
                                                    setPricingModal({ open: true, partner });
                                                    setActionDropdown(null);
                                                }}
                                                style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "#4ade80", textAlign: "left" }}
                                            >
                                                <DollarSign size={16} /> Pricing Grid
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setAttachmentsModal({ open: true, partner });
                                                setActionDropdown(null);
                                            }}
                                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", textAlign: "left" }}
                                        >
                                            <Paperclip size={16} /> Attachments
                                        </button>
                                        {!partner.isApproved && (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(partner)}
                                                    disabled={loading}
                                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--success)", textAlign: "left" }}
                                                >
                                                    <Check size={16} /> Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setRejectModal({ open: true, partner });
                                                        setActionDropdown(null);
                                                    }}
                                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--danger)", textAlign: "left" }}
                                                >
                                                    <X size={16} /> Reject
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleDelete(partner)}
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
                    {/* Common fields */}
                    <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        <Mail size={14} className="text-accent" />
                        <span>{partner.email}</span>
                    </div>
                    {partner.phone && (
                        <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            <Phone size={14} className="text-accent" />
                            <span>{partner.phone}</span>
                        </div>
                    )}

                    {/* Farm In/Out specific */}
                    {(partner.type === "FARM_IN" || partner.type === "FARM_OUT") && (
                        <>
                            {partner.state && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <Building2 size={14} className="text-accent" />
                                    <span>{partner.state}</span>
                                </div>
                            )}
                            {partner.cities.length > 0 && (
                                <div className="flex items-start gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <MapPin size={14} className="text-accent" style={{ marginTop: "0.125rem", flexShrink: 0 }} />
                                    <div className="flex flex-wrap gap-1">
                                        {partner.cities.map((city) => (
                                            <span key={city} style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.125rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.75rem" }}>
                                                {city}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {partner.cityTransferRate && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <DollarSign size={14} className="text-accent" />
                                    <span>Rate: {partner.cityTransferRate}</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* IOS specific */}
                    {partner.type === "IOS" && (
                        <>
                            {partner.market && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <MapPin size={14} className="text-accent" />
                                    <span>Market: {partner.market}</span>
                                </div>
                            )}
                            {partner.vehicleInfo && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <Car size={14} className="text-accent" />
                                    <span>
                                        {[
                                            partner.vehicleInfo.year,
                                            partner.vehicleInfo.make,
                                            partner.vehicleInfo.model,
                                        ].filter(Boolean).join(" ") || "Vehicle info not set"}
                                    </span>
                                </div>
                            )}
                        </>
                    )}

                    {/* House Chauffeur specific */}
                    {partner.type === "HOUSE_CHAUFFEUR" && (
                        <>
                            {partner.employeeId && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <IdCard size={14} className="text-accent" />
                                    <span>ID: {partner.employeeId}</span>
                                </div>
                            )}
                            {partner.schedulePrefs && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <Calendar size={14} className="text-accent" />
                                    <span>
                                        {partner.schedulePrefs.preferredShifts.length > 0
                                            ? partner.schedulePrefs.preferredShifts.join(", ")
                                            : "Schedule not set"}
                                    </span>
                                </div>
                            )}
                            {partner.vehicleAssignments && partner.vehicleAssignments.length > 0 && (
                                <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <Car size={14} className="text-accent" />
                                    <span>
                                        {partner.vehicleAssignments.find(a => a.isPrimary)?.vehicle.name ||
                                            partner.vehicleAssignments[0]?.vehicle.name ||
                                            "No vehicle assigned"}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {partner.notes && (
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "0.5rem" }} className="flex gap-3 items-start">
                        <Info size={16} className="text-accent" style={{ marginTop: "0.125rem" }} />
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{partner.notes}</p>
                    </div>
                )}

                {!partner.isApproved && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Submitted by {partner.submittedBy.name || partner.submittedBy.email}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <header className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>Network Directory</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Manage your partners, operators, and chauffeurs
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode(viewMode === "cards" ? "contacts" : "cards")}
                        className={`btn ${viewMode === "contacts" ? "btn-primary" : "btn-ghost"}`}
                    >
                        <BookUser size={18} />
                        <span>Contact Book</span>
                    </button>
                    <button onClick={() => setShowForm(true)} className="btn btn-primary">
                        <Plus size={18} />
                        <span>Add Partner</span>
                    </button>
                </div>
            </header>

            {viewMode === "contacts" ? (
                <ContactBookView
                    partners={partners.filter(p => p.phone && p.isApproved).map(p => ({
                        id: p.id,
                        name: p.name,
                        email: p.email,
                        phone: p.phone,
                        type: p.type,
                        market: p.market,
                        state: p.state,
                        isApproved: p.isApproved,
                        isActive: p.isActive,
                    }))}
                    onStartChat={(contact) => {
                        const partner = partners.find(p => p.id === contact.id);
                        if (partner) setSmsModal({ open: true, partner });
                    }}
                />
            ) : (
                <>
                    {/* Type Tabs */}
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2 flex-wrap">
                            {PARTNER_TYPES.map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setTypeTab(key)}
                                    className={`btn ${typeTab === key ? "btn-primary" : "btn-ghost"}`}
                                    style={{ minWidth: "130px" }}
                                >
                                    <Icon size={16} />
                                    {label}
                                    {isAdmin && getPendingCount(key) > 0 && (
                                        <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>
                                            {getPendingCount(key)}
                                        </span>
                                    )}
                                </button>
                            ))}
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
                                placeholder="Search by name, email, market, or ID..."
                                style={{ background: "transparent", border: "none", outline: "none", flex: 1, color: "white" }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Partner Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                        {filteredPartners.map(renderPartnerCard)}

                        {filteredPartners.length === 0 && (
                            <div className="glass-card text-center py-12" style={{ gridColumn: "1 / -1" }}>
                                <User size={48} className="text-accent mx-auto mb-4" style={{ opacity: 0.3 }} />
                                <p style={{ color: "var(--text-secondary)" }}>
                                    {statusTab === "pending"
                                        ? "No pending partners to review."
                                        : `No ${PARTNER_TYPES.find(t => t.key === typeTab)?.label} partners found.`}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Add Partner Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Network Partner" size="lg">
                <PartnerForm
                    onSubmit={handleSubmit}
                    onCancel={() => setShowForm(false)}
                    loading={loading}
                    defaultType={typeTab}
                />
            </Modal>

            {/* Edit Partner Modal */}
            <Modal
                isOpen={editModal.open}
                onClose={() => setEditModal({ open: false, partner: null })}
                title="Edit Partner"
                size="lg"
            >
                {editModal.partner && (
                    <PartnerForm
                        onSubmit={handleEdit}
                        onCancel={() => setEditModal({ open: false, partner: null })}
                        loading={loading}
                        initialData={{
                            name: editModal.partner.name,
                            email: editModal.partner.email,
                            phone: editModal.partner.phone || undefined,
                            type: editModal.partner.type,
                            state: editModal.partner.state || undefined,
                            cities: editModal.partner.cities,
                            notes: editModal.partner.notes || undefined,
                            cityTransferRate: editModal.partner.cityTransferRate || undefined,
                            market: editModal.partner.market || undefined,
                            employeeId: editModal.partner.employeeId || undefined,
                        }}
                        isEdit
                    />
                )}
            </Modal>

            {/* Reject Modal */}
            <Modal
                isOpen={rejectModal.open}
                onClose={() => setRejectModal({ open: false, partner: null })}
                title="Reject Partner"
                size="sm"
            >
                <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                    Are you sure you want to reject <strong>{rejectModal.partner?.name}</strong>?
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
                    <button onClick={() => setRejectModal({ open: false, partner: null })} className="btn btn-ghost">
                        Cancel
                    </button>
                    <button onClick={handleReject} className="btn btn-danger" disabled={loading}>
                        {loading ? "Rejecting..." : "Reject"}
                    </button>
                </div>
            </Modal>

            {/* Pricing Grid Modal */}
            <Modal
                isOpen={pricingModal.open}
                onClose={() => setPricingModal({ open: false, partner: null })}
                title="Partner Pricing"
                size="lg"
            >
                {pricingModal.partner && (
                    <AffiliatePricingGrid
                        affiliateId={pricingModal.partner.id}
                        affiliateName={pricingModal.partner.name}
                        pricing={pricingModal.partner.pricingGrid || []}
                        isAdmin={isAdmin}
                        onClose={() => setPricingModal({ open: false, partner: null })}
                    />
                )}
            </Modal>

            {/* Attachments Modal */}
            <Modal
                isOpen={attachmentsModal.open}
                onClose={() => setAttachmentsModal({ open: false, partner: null })}
                title="Partner Attachments"
                size="lg"
            >
                {attachmentsModal.partner && (
                    <AffiliateAttachments
                        affiliateId={attachmentsModal.partner.id}
                        affiliateName={attachmentsModal.partner.name}
                        attachments={attachmentsModal.partner.attachments || []}
                        isAdmin={isAdmin}
                    />
                )}
            </Modal>

            {/* SMS Modal */}
            <Modal
                isOpen={smsModal.open}
                onClose={() => setSmsModal({ open: false, partner: null })}
                title={`Message ${smsModal.partner?.name || ""}`}
                size="lg"
            >
                {smsModal.partner && smsModal.partner.phone && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <MessageSquare size={48} className="text-accent" />
                        <p style={{ color: "var(--text-secondary)" }}>
                            Open SMS conversation with {smsModal.partner.phone}
                        </p>
                        <a
                            href={`/sms?phone=${encodeURIComponent(smsModal.partner.phone)}`}
                            className="btn btn-primary"
                        >
                            Open SMS Dashboard
                        </a>
                    </div>
                )}
            </Modal>
        </div>
    );
}

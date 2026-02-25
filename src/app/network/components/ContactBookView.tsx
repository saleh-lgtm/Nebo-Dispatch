"use client";

import { useState, useMemo } from "react";
import {
    Search,
    Phone,
    Mail,
    MessageSquare,
    ArrowDownLeft,
    ArrowUpRight,
    Car,
    Users,
    ChevronRight,
    User,
    UserPlus,
    X,
    Loader2,
} from "lucide-react";
import { type PartnerType, createQuickContact } from "@/lib/networkActions";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";

interface Partner {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    type: PartnerType;
    market: string | null;
    state: string | null;
    isApproved: boolean;
    isActive: boolean;
}

interface Props {
    partners: Partner[];
    onStartChat: (partner: Partner) => void;
}

const TYPE_CONFIG: Record<PartnerType, { icon: typeof ArrowUpRight; label: string; color: string }> = {
    FARM_OUT: { icon: ArrowUpRight, label: "Farm Out", color: "#60a5fa" },
    FARM_IN: { icon: ArrowDownLeft, label: "Farm In", color: "#4ade80" },
    IOS: { icon: Car, label: "IOS", color: "#f59e0b" },
    HOUSE_CHAUFFEUR: { icon: Users, label: "Chauffeur", color: "#a78bfa" },
};

export default function ContactBookView({ partners, onStartChat }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [search, setSearch] = useState("");
    const [selectedType, setSelectedType] = useState<PartnerType | "all">("all");
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddLoading, setQuickAddLoading] = useState(false);
    const [quickAddData, setQuickAddData] = useState({ name: "", phone: "", email: "", notes: "" });

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickAddData.name.trim() || !quickAddData.phone.trim()) {
            addToast("Name and phone are required", "error");
            return;
        }

        setQuickAddLoading(true);
        try {
            await createQuickContact({
                name: quickAddData.name.trim(),
                phone: quickAddData.phone.trim(),
                email: quickAddData.email.trim() || undefined,
                notes: quickAddData.notes.trim() || undefined,
            });
            addToast("Contact added successfully!", "success");
            setShowQuickAdd(false);
            setQuickAddData({ name: "", phone: "", email: "", notes: "" });
            router.refresh();
        } catch (err) {
            addToast(err instanceof Error ? err.message : "Failed to add contact", "error");
        } finally {
            setQuickAddLoading(false);
        }
    };

    const filteredContacts = useMemo(() => {
        return partners
            .filter((p) => {
                if (selectedType !== "all" && p.type !== selectedType) return false;
                if (!search) return true;

                const searchLower = search.toLowerCase();
                return (
                    p.name.toLowerCase().includes(searchLower) ||
                    p.email.toLowerCase().includes(searchLower) ||
                    (p.phone && p.phone.includes(search)) ||
                    (p.market && p.market.toLowerCase().includes(searchLower)) ||
                    (p.state && p.state.toLowerCase().includes(searchLower))
                );
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [partners, search, selectedType]);

    // Group contacts by first letter
    const groupedContacts = useMemo(() => {
        const groups: Record<string, Partner[]> = {};
        filteredContacts.forEach((contact) => {
            const letter = contact.name.charAt(0).toUpperCase();
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(contact);
        });
        return groups;
    }, [filteredContacts]);

    const formatPhone = (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        if (digits.length === 11 && digits.startsWith("1")) {
            return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        return phone;
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Quick Add Contact Form */}
            {showQuickAdd && (
                <div className="glass-card" style={{ padding: "1.5rem", border: "1px solid var(--accent-soft)" }}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent)" }}>Quick Add Contact</h3>
                        <button onClick={() => setShowQuickAdd(false)} className="btn btn-ghost btn-icon">
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleQuickAdd} className="flex flex-col gap-3">
                        <div className="flex gap-3 flex-wrap">
                            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "200px" }}>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                    Name *
                                </label>
                                <input
                                    className="input"
                                    placeholder="Contact name"
                                    value={quickAddData.name}
                                    onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                    Phone *
                                </label>
                                <input
                                    className="input"
                                    placeholder="(555) 123-4567"
                                    value={quickAddData.phone}
                                    onChange={(e) => setQuickAddData({ ...quickAddData, phone: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "180px" }}>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                    Email (optional)
                                </label>
                                <input
                                    className="input"
                                    type="email"
                                    placeholder="email@example.com"
                                    value={quickAddData.email}
                                    onChange={(e) => setQuickAddData({ ...quickAddData, email: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setShowQuickAdd(false)} className="btn btn-ghost">
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={quickAddLoading}>
                                {quickAddLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                {quickAddLoading ? "Adding..." : "Add Contact"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search and Filter */}
            <div className="glass-card" style={{ padding: "1rem" }}>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: "0.5rem", padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <Search size={18} className="text-accent" />
                            <input
                                type="text"
                                placeholder="Search contacts by name, phone, email..."
                                style={{ background: "transparent", border: "none", outline: "none", flex: 1, color: "white" }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        {!showQuickAdd && (
                            <button onClick={() => setShowQuickAdd(true)} className="btn btn-primary" style={{ flexShrink: 0 }}>
                                <UserPlus size={16} />
                                <span>Quick Add</span>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedType("all")}
                            className={`btn btn-sm ${selectedType === "all" ? "btn-primary" : "btn-ghost"}`}
                        >
                            All ({partners.length})
                        </button>
                        {(Object.keys(TYPE_CONFIG) as PartnerType[]).map((type) => {
                            const config = TYPE_CONFIG[type];
                            const count = partners.filter(p => p.type === type).length;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setSelectedType(type)}
                                    className={`btn btn-sm ${selectedType === type ? "btn-primary" : "btn-ghost"}`}
                                    style={{ gap: "0.25rem" }}
                                >
                                    <config.icon size={14} />
                                    {config.label} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Contact List */}
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                {Object.keys(groupedContacts).length === 0 ? (
                    <div className="text-center py-12">
                        <User size={48} className="text-accent mx-auto mb-4" style={{ opacity: 0.3 }} />
                        <p style={{ color: "var(--text-secondary)" }}>
                            No contacts found
                        </p>
                    </div>
                ) : (
                    Object.keys(groupedContacts)
                        .sort()
                        .map((letter) => (
                            <div key={letter}>
                                <div
                                    style={{
                                        padding: "0.5rem 1rem",
                                        background: "rgba(255,255,255,0.03)",
                                        borderBottom: "1px solid var(--border)",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        color: "var(--accent)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    {letter}
                                </div>
                                {groupedContacts[letter].map((contact) => {
                                    const typeConfig = TYPE_CONFIG[contact.type];
                                    const TypeIcon = typeConfig.icon;

                                    return (
                                        <div
                                            key={contact.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "1rem",
                                                padding: "1rem",
                                                borderBottom: "1px solid var(--border)",
                                                cursor: "pointer",
                                                transition: "background 0.15s",
                                            }}
                                            className="hover:bg-white/5"
                                        >
                                            {/* Avatar */}
                                            <div
                                                style={{
                                                    width: "48px",
                                                    height: "48px",
                                                    borderRadius: "50%",
                                                    background: `${typeConfig.color}20`,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <TypeIcon size={20} style={{ color: typeConfig.color }} />
                                            </div>

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="flex items-center gap-2">
                                                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                                        {contact.name}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: "0.65rem",
                                                            padding: "0.125rem 0.5rem",
                                                            borderRadius: "0.25rem",
                                                            background: `${typeConfig.color}20`,
                                                            color: typeConfig.color,
                                                        }}
                                                    >
                                                        {typeConfig.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                                    {contact.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={12} />
                                                            {formatPhone(contact.phone)}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        <Mail size={12} />
                                                        {contact.email}
                                                    </span>
                                                </div>
                                                {(contact.market || contact.state) && (
                                                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                                                        {contact.market || contact.state}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {contact.phone && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onStartChat(contact);
                                                        }}
                                                        className="btn btn-ghost btn-icon"
                                                        style={{ color: "#60a5fa" }}
                                                        title="Send SMS"
                                                    >
                                                        <MessageSquare size={18} />
                                                    </button>
                                                )}
                                                <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                )}
            </div>

            {/* Stats */}
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
                {selectedType !== "all" && ` in ${TYPE_CONFIG[selectedType].label}`}
            </div>
        </div>
    );
}

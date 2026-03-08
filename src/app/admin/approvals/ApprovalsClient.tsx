"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, User, Mail, Clock, AlertCircle, Globe, Phone, Building2 } from "lucide-react";
import { approveUser, rejectUser } from "@/lib/signupActions";
import { approvePortal, rejectPortal } from "@/lib/portalActions";
import { approveContact, rejectContact } from "@/lib/contactActions";

interface PendingUser {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date;
}

interface PendingPortal {
    id: string;
    name: string;
    url: string;
    description: string | null;
    category: string;
    createdAt: Date;
    createdBy: { id: string; name: string | null; email: string | null } | null;
}

interface PendingContact {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    createdAt: Date;
    createdBy: { id: string; name: string | null; email: string | null } | null;
}

interface ApprovalsClientProps {
    pendingUsers: PendingUser[];
    pendingPortals: PendingPortal[];
    pendingContacts: PendingContact[];
    currentUserId: string;
}

type TabType = "users" | "portals" | "contacts";

export default function ApprovalsClient({
    pendingUsers,
    pendingPortals,
    pendingContacts,
    currentUserId
}: ApprovalsClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("users");
    const [loading, setLoading] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // User handlers
    const handleApproveUser = async (userId: string) => {
        setLoading(userId);
        setError(null);
        const role = (selectedRole[userId] || "DISPATCHER") as "DISPATCHER" | "ADMIN" | "ACCOUNTING";
        const result = await approveUser(userId, currentUserId, role);
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error || "Failed to approve user");
        }
        setLoading(null);
    };

    const handleRejectUser = async (userId: string) => {
        if (!confirm("Are you sure you want to reject this registration?")) return;
        setLoading(userId);
        setError(null);
        const result = await rejectUser(userId, currentUserId);
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error || "Failed to reject user");
        }
        setLoading(null);
    };

    // Portal handlers
    const handleApprovePortal = async (portalId: string) => {
        setLoading(portalId);
        setError(null);
        try {
            await approvePortal(portalId);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to approve portal");
        }
        setLoading(null);
    };

    const handleRejectPortal = async (portalId: string) => {
        const reason = prompt("Reason for rejection (optional):");
        if (reason === null) return; // User cancelled
        setLoading(portalId);
        setError(null);
        try {
            await rejectPortal(portalId, reason || undefined);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reject portal");
        }
        setLoading(null);
    };

    // Contact handlers
    const handleApproveContact = async (contactId: string) => {
        setLoading(contactId);
        setError(null);
        try {
            await approveContact(contactId);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to approve contact");
        }
        setLoading(null);
    };

    const handleRejectContact = async (contactId: string) => {
        const reason = prompt("Reason for rejection (optional):");
        if (reason === null) return; // User cancelled
        setLoading(contactId);
        setError(null);
        try {
            await rejectContact(contactId, reason || undefined);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reject contact");
        }
        setLoading(null);
    };

    const totalPending = pendingUsers.length + pendingPortals.length + pendingContacts.length;

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: "users", label: "Users", count: pendingUsers.length },
        { id: "portals", label: "Portals", count: pendingPortals.length },
        { id: "contacts", label: "Contacts", count: pendingContacts.length },
    ];

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Approvals</h1>
                    <p className="page-subtitle">
                        Review and approve pending submissions ({totalPending} pending)
                    </p>
                </div>
            </div>

            {error && (
                <div className="alert-banner alert-banner-critical mb-4">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            activeTab === tab.id
                                ? "bg-primary text-white"
                                : "bg-muted text-secondary hover:bg-muted-hover"
                        }`}
                        style={{
                            background: activeTab === tab.id ? "var(--accent)" : "var(--bg-muted)",
                            color: activeTab === tab.id ? "white" : "var(--text-secondary)",
                        }}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span
                                className="ml-2 px-2 py-0.5 rounded-full text-xs"
                                style={{
                                    background: activeTab === tab.id ? "rgba(255,255,255,0.2)" : "var(--accent)",
                                    color: activeTab === tab.id ? "white" : "white",
                                }}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Users Tab */}
            {activeTab === "users" && (
                <div className="card">
                    {pendingUsers.length === 0 ? (
                        <div className="empty-state">
                            <User size={48} className="empty-state-icon" />
                            <h3>No Pending Users</h3>
                            <p className="text-secondary">All user registrations have been reviewed.</p>
                        </div>
                    ) : (
                        <>
                            <div className="panel-header">
                                <span className="panel-title">Pending Registrations ({pendingUsers.length})</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {pendingUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between p-4 rounded-lg"
                                        style={{ background: "var(--bg-muted)" }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="avatar">
                                                {(user.name || user.email || "U").charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-primary">
                                                    {user.name || "Unnamed User"}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-secondary">
                                                    <span className="flex items-center gap-1">
                                                        <Mail size={14} />
                                                        {user.email || "No email"}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {formatDate(user.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                className="input"
                                                style={{ width: "140px" }}
                                                value={selectedRole[user.id] || "DISPATCHER"}
                                                onChange={(e) => setSelectedRole({ ...selectedRole, [user.id]: e.target.value })}
                                                disabled={loading === user.id}
                                            >
                                                <option value="DISPATCHER">Dispatcher</option>
                                                <option value="ACCOUNTING">Accounting</option>
                                                <option value="ADMIN">Admin</option>
                                            </select>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => handleApproveUser(user.id)}
                                                disabled={loading === user.id}
                                            >
                                                <Check size={16} />
                                                {loading === user.id ? "..." : "Approve"}
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleRejectUser(user.id)}
                                                disabled={loading === user.id}
                                            >
                                                <X size={16} />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Portals Tab */}
            {activeTab === "portals" && (
                <div className="card">
                    {pendingPortals.length === 0 ? (
                        <div className="empty-state">
                            <Globe size={48} className="empty-state-icon" />
                            <h3>No Pending Portals</h3>
                            <p className="text-secondary">All portal submissions have been reviewed.</p>
                        </div>
                    ) : (
                        <>
                            <div className="panel-header">
                                <span className="panel-title">Pending Portals ({pendingPortals.length})</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {pendingPortals.map((portal) => (
                                    <div
                                        key={portal.id}
                                        className="flex items-center justify-between p-4 rounded-lg"
                                        style={{ background: "var(--bg-muted)" }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                style={{ background: "var(--accent)", color: "white" }}
                                            >
                                                <Globe size={20} />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-primary">{portal.name}</div>
                                                <div className="text-sm text-secondary">{portal.url}</div>
                                                <div className="flex items-center gap-4 text-xs text-secondary mt-1">
                                                    <span>Category: {portal.category}</span>
                                                    <span>By: {portal.createdBy?.name || portal.createdBy?.email || "Unknown"}</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatDate(portal.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => handleApprovePortal(portal.id)}
                                                disabled={loading === portal.id}
                                            >
                                                <Check size={16} />
                                                {loading === portal.id ? "..." : "Approve"}
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleRejectPortal(portal.id)}
                                                disabled={loading === portal.id}
                                            >
                                                <X size={16} />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Contacts Tab */}
            {activeTab === "contacts" && (
                <div className="card">
                    {pendingContacts.length === 0 ? (
                        <div className="empty-state">
                            <User size={48} className="empty-state-icon" />
                            <h3>No Pending Contacts</h3>
                            <p className="text-secondary">All contact submissions have been reviewed.</p>
                        </div>
                    ) : (
                        <>
                            <div className="panel-header">
                                <span className="panel-title">Pending Contacts ({pendingContacts.length})</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {pendingContacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        className="flex items-center justify-between p-4 rounded-lg"
                                        style={{ background: "var(--bg-muted)" }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="avatar">
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-primary">{contact.name}</div>
                                                <div className="flex items-center gap-4 text-sm text-secondary">
                                                    {contact.company && (
                                                        <span className="flex items-center gap-1">
                                                            <Building2 size={14} />
                                                            {contact.company}
                                                        </span>
                                                    )}
                                                    {contact.email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail size={14} />
                                                            {contact.email}
                                                        </span>
                                                    )}
                                                    {contact.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={14} />
                                                            {contact.phone}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-secondary mt-1">
                                                    <span>By: {contact.createdBy?.name || contact.createdBy?.email || "Unknown"}</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatDate(contact.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => handleApproveContact(contact.id)}
                                                disabled={loading === contact.id}
                                            >
                                                <Check size={16} />
                                                {loading === contact.id ? "..." : "Approve"}
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleRejectContact(contact.id)}
                                                disabled={loading === contact.id}
                                            >
                                                <X size={16} />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Globe,
    User,
    Phone,
    Mail,
    Building2,
    Plus,
    Search,
    ExternalLink,
    Pencil,
    Trash2,
    X,
    Check,
    Clock,
    AlertCircle,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { createPortal, updatePortal, deletePortal } from "@/lib/portalActions";
import { createContact, updateContact, deleteContact } from "@/lib/contactActions";

interface Portal {
    id: string;
    name: string;
    url: string;
    description: string | null;
    category: string;
    icon: string;
    color: string;
    approvalStatus: string;
    createdById: string | null;
}

interface Contact {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    notes: string | null;
    approvalStatus: string;
    createdById: string;
}

interface DirectoryClientProps {
    approvedContacts: Contact[];
    myContacts: Contact[];
    approvedPortals: Portal[];
    myPortals: Portal[];
    isAdmin: boolean;
    currentUserId: string;
}

type TabType = "portals" | "contacts";

export default function DirectoryClient({
    approvedContacts,
    myContacts,
    approvedPortals,
    myPortals,
    isAdmin,
    currentUserId,
}: DirectoryClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("contacts");
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Portal form state
    const [showPortalModal, setShowPortalModal] = useState(false);
    const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
    const [portalForm, setPortalForm] = useState({
        name: "",
        url: "",
        description: "",
        category: "other",
    });

    // Contact form state
    const [showContactModal, setShowContactModal] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [contactForm, setContactForm] = useState({
        name: "",
        email: "",
        phone: "",
        company: "",
        notes: "",
    });

    // Combine approved items with user's pending items
    const allContacts = [
        ...myContacts.filter(c => c.approvalStatus !== "APPROVED"),
        ...approvedContacts.filter(c => !myContacts.find(mc => mc.id === c.id)),
    ];

    const allPortals = [
        ...myPortals.filter(p => p.approvalStatus !== "APPROVED"),
        ...approvedPortals.filter(p => !myPortals.find(mp => mp.id === p.id)),
    ];

    // Filter by search
    const filteredContacts = allContacts.filter(contact => {
        if (!search) return true;
        const term = search.toLowerCase();
        return (
            contact.name.toLowerCase().includes(term) ||
            contact.company?.toLowerCase().includes(term) ||
            contact.email?.toLowerCase().includes(term)
        );
    });

    const filteredPortals = allPortals.filter(portal => {
        if (!search) return true;
        const term = search.toLowerCase();
        return (
            portal.name.toLowerCase().includes(term) ||
            portal.description?.toLowerCase().includes(term)
        );
    });

    // Portal handlers
    const handleOpenAddPortal = () => {
        setPortalForm({ name: "", url: "", description: "", category: "other" });
        setEditingPortal(null);
        setShowPortalModal(true);
    };

    const handleOpenEditPortal = (portal: Portal) => {
        setPortalForm({
            name: portal.name,
            url: portal.url,
            description: portal.description || "",
            category: portal.category,
        });
        setEditingPortal(portal);
        setShowPortalModal(true);
    };

    const handleSavePortal = async () => {
        if (!portalForm.name || !portalForm.url) return;
        setSaving(true);
        setError(null);
        try {
            if (editingPortal) {
                await updatePortal(editingPortal.id, portalForm);
            } else {
                await createPortal(portalForm);
            }
            setShowPortalModal(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save portal");
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePortal = async (id: string) => {
        if (!confirm("Are you sure you want to delete this portal?")) return;
        try {
            await deletePortal(id);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete portal");
        }
    };

    // Contact handlers
    const handleOpenAddContact = () => {
        setContactForm({ name: "", email: "", phone: "", company: "", notes: "" });
        setEditingContact(null);
        setShowContactModal(true);
    };

    const handleOpenEditContact = (contact: Contact) => {
        setContactForm({
            name: contact.name,
            email: contact.email || "",
            phone: contact.phone || "",
            company: contact.company || "",
            notes: contact.notes || "",
        });
        setEditingContact(contact);
        setShowContactModal(true);
    };

    const handleSaveContact = async () => {
        if (!contactForm.name) return;
        setSaving(true);
        setError(null);
        try {
            if (editingContact) {
                await updateContact(editingContact.id, contactForm);
            } else {
                await createContact(contactForm);
            }
            setShowContactModal(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save contact");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!confirm("Are you sure you want to delete this contact?")) return;
        try {
            await deleteContact(id);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete contact");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING":
                return (
                    <span className="status-badge pending">
                        <Clock size={12} />
                        Pending Approval
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="status-badge rejected">
                        <XCircle size={12} />
                        Rejected
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="status-badge approved">
                        <CheckCircle2 size={12} />
                        Approved
                    </span>
                );
            default:
                return null;
        }
    };

    const canEdit = (item: { createdById: string | null; approvalStatus: string }) => {
        return isAdmin || item.createdById === currentUserId;
    };

    return (
        <div className="directory-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <User size={24} />
                    </div>
                    <div>
                        <h1>Directory</h1>
                        <p>Manage contacts and external portals</p>
                    </div>
                </div>
            </header>

            {error && (
                <div className="alert-banner">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === "contacts" ? "active" : ""}`}
                    onClick={() => setActiveTab("contacts")}
                >
                    <User size={16} />
                    Contacts ({filteredContacts.length})
                </button>
                <button
                    className={`tab ${activeTab === "portals" ? "active" : ""}`}
                    onClick={() => setActiveTab("portals")}
                >
                    <Globe size={16} />
                    Portals ({filteredPortals.length})
                </button>
            </div>

            {/* Search & Add */}
            <div className="toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    className="add-btn"
                    onClick={activeTab === "contacts" ? handleOpenAddContact : handleOpenAddPortal}
                >
                    <Plus size={16} />
                    Add {activeTab === "contacts" ? "Contact" : "Portal"}
                </button>
            </div>

            {!isAdmin && (
                <div className="info-banner">
                    <AlertCircle size={16} />
                    <span>New items you add will require admin approval before becoming visible to others.</span>
                </div>
            )}

            {/* Contacts Tab */}
            {activeTab === "contacts" && (
                <div className="items-grid">
                    {filteredContacts.length === 0 ? (
                        <div className="empty-state">
                            <User size={48} />
                            <p>No contacts found</p>
                            <button className="add-btn" onClick={handleOpenAddContact}>
                                <Plus size={16} />
                                Add Contact
                            </button>
                        </div>
                    ) : (
                        filteredContacts.map((contact) => (
                            <div key={contact.id} className="item-card">
                                <div className="item-header">
                                    <div className="item-avatar">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    {canEdit(contact) && (
                                        <div className="item-actions">
                                            <button
                                                className="edit-btn"
                                                onClick={() => handleOpenEditContact(contact)}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleDeleteContact(contact.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <h3>{contact.name}</h3>
                                {contact.company && (
                                    <div className="item-detail">
                                        <Building2 size={14} />
                                        {contact.company}
                                    </div>
                                )}
                                {contact.email && (
                                    <a href={`mailto:${contact.email}`} className="item-detail link">
                                        <Mail size={14} />
                                        {contact.email}
                                    </a>
                                )}
                                {contact.phone && (
                                    <a href={`tel:${contact.phone}`} className="item-detail link">
                                        <Phone size={14} />
                                        {contact.phone}
                                    </a>
                                )}
                                {contact.approvalStatus !== "APPROVED" && (
                                    <div className="item-status">
                                        {getStatusBadge(contact.approvalStatus)}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Portals Tab */}
            {activeTab === "portals" && (
                <div className="items-grid">
                    {filteredPortals.length === 0 ? (
                        <div className="empty-state">
                            <Globe size={48} />
                            <p>No portals found</p>
                            <button className="add-btn" onClick={handleOpenAddPortal}>
                                <Plus size={16} />
                                Add Portal
                            </button>
                        </div>
                    ) : (
                        filteredPortals.map((portal) => (
                            <div key={portal.id} className="item-card">
                                <div className="item-header">
                                    <div
                                        className="item-icon"
                                        style={{ backgroundColor: `${portal.color}20`, color: portal.color }}
                                    >
                                        <Globe size={20} />
                                    </div>
                                    {canEdit(portal) && (
                                        <div className="item-actions">
                                            <button
                                                className="edit-btn"
                                                onClick={() => handleOpenEditPortal(portal)}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleDeletePortal(portal.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <h3>{portal.name}</h3>
                                {portal.description && (
                                    <p className="item-description">{portal.description}</p>
                                )}
                                <a
                                    href={portal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="portal-link"
                                >
                                    Open Portal
                                    <ExternalLink size={14} />
                                </a>
                                {portal.approvalStatus !== "APPROVED" && (
                                    <div className="item-status">
                                        {getStatusBadge(portal.approvalStatus)}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Contact Modal */}
            {showContactModal && (
                <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingContact ? "Edit Contact" : "Add Contact"}</h3>
                            <button className="close-btn" onClick={() => setShowContactModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={contactForm.name}
                                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                                    placeholder="Contact name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={contactForm.email}
                                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    value={contactForm.phone}
                                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                            <div className="form-group">
                                <label>Company</label>
                                <input
                                    type="text"
                                    value={contactForm.company}
                                    onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                                    placeholder="Company name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea
                                    value={contactForm.notes}
                                    onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                                    placeholder="Additional notes..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setShowContactModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="save-btn"
                                onClick={handleSaveContact}
                                disabled={saving || !contactForm.name}
                            >
                                <Check size={16} />
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Portal Modal */}
            {showPortalModal && (
                <div className="modal-overlay" onClick={() => setShowPortalModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingPortal ? "Edit Portal" : "Add Portal"}</h3>
                            <button className="close-btn" onClick={() => setShowPortalModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={portalForm.name}
                                    onChange={(e) => setPortalForm({ ...portalForm, name: e.target.value })}
                                    placeholder="Portal name"
                                />
                            </div>
                            <div className="form-group">
                                <label>URL *</label>
                                <input
                                    type="url"
                                    value={portalForm.url}
                                    onChange={(e) => setPortalForm({ ...portalForm, url: e.target.value })}
                                    placeholder="https://example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={portalForm.description}
                                    onChange={(e) => setPortalForm({ ...portalForm, description: e.target.value })}
                                    placeholder="Brief description"
                                />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={portalForm.category}
                                    onChange={(e) => setPortalForm({ ...portalForm, category: e.target.value })}
                                >
                                    <option value="trips">Trips</option>
                                    <option value="rfp">RFPs</option>
                                    <option value="affiliates">Affiliates</option>
                                    <option value="accounting">Accounting</option>
                                    <option value="travel">Travel</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setShowPortalModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="save-btn"
                                onClick={handleSavePortal}
                                disabled={saving || !portalForm.name || !portalForm.url}
                            >
                                <Check size={16} />
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .directory-page {
                    padding: 1.5rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 1.5rem;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    background: var(--accent-soft);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent);
                }

                .page-header h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0 0 0.25rem 0;
                }

                .page-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0;
                }

                .alert-banner {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: var(--radius-md);
                    color: #ef4444;
                    margin-bottom: 1rem;
                }

                .alert-banner button {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                }

                .info-banner {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: var(--accent-soft);
                    border: 1px solid var(--accent-border);
                    border-radius: var(--radius-md);
                    color: var(--accent);
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: var(--transition-fast);
                }

                .tab:hover {
                    background: var(--bg-hover);
                }

                .tab.active {
                    background: var(--accent);
                    border-color: var(--accent);
                    color: white;
                }

                .toolbar {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .search-box {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .search-box:focus-within {
                    border-color: var(--accent);
                }

                .search-box svg {
                    color: var(--text-muted);
                }

                .search-box input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .add-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: var(--accent);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: var(--transition-fast);
                }

                .add-btn:hover {
                    filter: brightness(1.1);
                }

                .items-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }

                .item-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                    transition: var(--transition-normal);
                }

                .item-card:hover {
                    border-color: var(--border-hover);
                    box-shadow: var(--shadow-lg);
                }

                .item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.75rem;
                }

                .item-avatar {
                    width: 40px;
                    height: 40px;
                    background: var(--accent);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 600;
                    font-size: 1rem;
                }

                .item-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .item-actions {
                    display: flex;
                    gap: 0.25rem;
                }

                .edit-btn, .delete-btn {
                    padding: 0.375rem;
                    background: none;
                    border: none;
                    border-radius: var(--radius-sm);
                    color: var(--text-muted);
                    cursor: pointer;
                }

                .edit-btn:hover {
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .item-card h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0 0 0.5rem 0;
                }

                .item-detail {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.375rem;
                }

                .item-detail.link {
                    text-decoration: none;
                    cursor: pointer;
                }

                .item-detail.link:hover {
                    color: var(--accent);
                }

                .item-description {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin: 0 0 0.75rem 0;
                }

                .portal-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--accent);
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    text-decoration: none;
                    margin-top: 0.5rem;
                }

                .portal-link:hover {
                    filter: brightness(1.1);
                }

                .item-status {
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--border);
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .status-badge.pending {
                    background: rgba(245, 158, 11, 0.1);
                    color: #f59e0b;
                }

                .status-badge.approved {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                }

                .status-badge.rejected {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .empty-state {
                    grid-column: 1 / -1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 4rem;
                    color: var(--text-muted);
                    gap: 1rem;
                }

                .empty-state svg {
                    opacity: 0.3;
                }

                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .modal {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    width: 100%;
                    max-width: 480px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--border);
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                }

                .modal-body {
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-group label {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 0.625rem 0.875rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    font-family: inherit;
                }

                .form-group textarea {
                    resize: vertical;
                    min-height: 80px;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1.25rem;
                    border-top: 1px solid var(--border);
                }

                .cancel-btn {
                    padding: 0.625rem 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    cursor: pointer;
                }

                .save-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: var(--accent);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                }

                .save-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 640px) {
                    .directory-page {
                        padding: 1rem;
                    }

                    .toolbar {
                        flex-direction: column;
                    }

                    .items-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

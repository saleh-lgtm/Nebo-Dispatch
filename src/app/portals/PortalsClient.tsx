"use client";

import { useState, useEffect } from "react";
import {
    ExternalLink,
    Globe,
    Car,
    FileText,
    Calendar,
    Users,
    CreditCard,
    Plane,
    Building2,
    Search,
    Clock,
    Bookmark,
    BookmarkCheck,
    Plus,
    Pencil,
    Trash2,
    X,
    Check,
    Settings,
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
    getPortals,
    createPortal,
    updatePortal,
    deletePortal,
    seedDefaultPortals,
} from "@/lib/portalActions";

// Icon mapping for dynamic icon rendering
const ICON_MAP: Record<string, typeof Globe> = {
    Globe,
    Car,
    FileText,
    Calendar,
    Users,
    CreditCard,
    Plane,
    Building2,
};

interface Portal {
    id: string;
    name: string;
    url: string;
    description: string | null;
    category: string;
    icon: string;
    color: string;
    sortOrder: number;
    isActive: boolean;
}

const CATEGORIES = [
    { key: "all", label: "All Portals", icon: Globe },
    { key: "trips", label: "Trips", icon: Car },
    { key: "rfp", label: "RFPs", icon: FileText },
    { key: "affiliates", label: "Affiliates", icon: Users },
    { key: "accounting", label: "Accounting", icon: CreditCard },
    { key: "travel", label: "Travel", icon: Plane },
    { key: "other", label: "Other", icon: Globe },
];

const ICON_OPTIONS = [
    { value: "Globe", label: "Globe" },
    { value: "Car", label: "Car" },
    { value: "FileText", label: "Document" },
    { value: "Calendar", label: "Calendar" },
    { value: "Users", label: "Users" },
    { value: "CreditCard", label: "Credit Card" },
    { value: "Plane", label: "Plane" },
    { value: "Building2", label: "Building" },
];

const COLOR_OPTIONS = [
    "#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#ec4899",
    "#06b6d4", "#64748b", "#0ea5e9", "#14b8a6", "#6366f1", "#f97316",
];

export default function PortalsClient() {
    const { data: session } = useSession();
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session?.user?.role || "");

    const [portals, setPortals] = useState<Portal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string>("all");
    const [favorites, setFavorites] = useState<Set<string>>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("portal-favorites");
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });
    const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("portal-recent");
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    // Admin state
    const [showAdminMode, setShowAdminMode] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        url: "",
        description: "",
        category: "other",
        icon: "Globe",
        color: "#64748b",
    });
    const [saving, setSaving] = useState(false);

    // Load portals
    useEffect(() => {
        async function loadPortals() {
            try {
                const data = await getPortals();
                setPortals(data);
            } catch (error) {
                console.error("Failed to load portals:", error);
            } finally {
                setLoading(false);
            }
        }
        loadPortals();
    }, []);

    const toggleFavorite = (id: string) => {
        setFavorites(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            localStorage.setItem("portal-favorites", JSON.stringify([...newSet]));
            return newSet;
        });
    };

    const trackUsage = (id: string) => {
        setRecentlyUsed(prev => {
            const filtered = prev.filter(p => p !== id);
            const newRecent = [id, ...filtered].slice(0, 5);
            localStorage.setItem("portal-recent", JSON.stringify(newRecent));
            return newRecent;
        });
    };

    const filteredPortals = portals.filter(portal => {
        const matchesSearch = search === "" ||
            portal.name.toLowerCase().includes(search.toLowerCase()) ||
            (portal.description && portal.description.toLowerCase().includes(search.toLowerCase()));
        const matchesCategory = category === "all" || portal.category === category;
        return matchesSearch && matchesCategory;
    });

    const sortedPortals = [...filteredPortals].sort((a, b) => {
        const aFav = favorites.has(a.id) ? 1 : 0;
        const bFav = favorites.has(b.id) ? 1 : 0;
        return bFav - aFav;
    });

    const recentPortals = recentlyUsed
        .map(id => portals.find(p => p.id === id))
        .filter(Boolean) as Portal[];

    // Admin functions
    const handleOpenAdd = () => {
        setFormData({
            name: "",
            url: "",
            description: "",
            category: "other",
            icon: "Globe",
            color: "#64748b",
        });
        setEditingPortal(null);
        setShowAddModal(true);
    };

    const handleOpenEdit = (portal: Portal) => {
        setFormData({
            name: portal.name,
            url: portal.url,
            description: portal.description || "",
            category: portal.category,
            icon: portal.icon,
            color: portal.color,
        });
        setEditingPortal(portal);
        setShowAddModal(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.url) return;

        setSaving(true);
        try {
            if (editingPortal) {
                await updatePortal(editingPortal.id, formData);
            } else {
                await createPortal(formData);
            }
            const data = await getPortals();
            setPortals(data);
            setShowAddModal(false);
        } catch (error) {
            console.error("Failed to save portal:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this portal?")) return;

        try {
            await deletePortal(id);
            setPortals(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Failed to delete portal:", error);
        }
    };

    const handleSeedDefaults = async () => {
        if (!confirm("This will add default portals. Continue?")) return;

        try {
            await seedDefaultPortals();
            const data = await getPortals();
            setPortals(data);
        } catch (error) {
            console.error("Failed to seed portals:", error);
        }
    };

    const getIconComponent = (iconName: string) => {
        return ICON_MAP[iconName] || Globe;
    };

    if (loading) {
        return (
            <div className="portals-page">
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading portals...</p>
                </div>
                <style jsx>{`
                    .portals-page { padding: 2rem; }
                    .loading-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 1rem;
                        padding: 4rem;
                        color: var(--text-muted);
                    }
                    .spinner {
                        width: 32px;
                        height: 32px;
                        border: 3px solid var(--border);
                        border-top-color: var(--accent);
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <div className="portals-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h1>External Portals</h1>
                        <p>Quick access to booking systems, RFPs, and partner networks</p>
                    </div>
                </div>
                {isAdmin && (
                    <div className="header-actions">
                        <button
                            className={`admin-toggle ${showAdminMode ? "active" : ""}`}
                            onClick={() => setShowAdminMode(!showAdminMode)}
                        >
                            <Settings size={16} />
                            {showAdminMode ? "Exit Admin" : "Manage"}
                        </button>
                    </div>
                )}
            </header>

            {/* Admin Controls */}
            {showAdminMode && isAdmin && (
                <div className="admin-bar">
                    <button className="add-btn" onClick={handleOpenAdd}>
                        <Plus size={16} />
                        Add Portal
                    </button>
                    {portals.length === 0 && (
                        <button className="seed-btn" onClick={handleSeedDefaults}>
                            Import Default Portals
                        </button>
                    )}
                </div>
            )}

            {/* Search & Filters */}
            <div className="filters-section">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search portals..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="category-pills">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.key}
                            className={`category-pill ${category === cat.key ? "active" : ""}`}
                            onClick={() => setCategory(cat.key)}
                        >
                            <cat.icon size={14} />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Recently Used */}
            {recentPortals.length > 0 && category === "all" && !search && !showAdminMode && (
                <section className="recent-section">
                    <h2>
                        <Clock size={16} />
                        Recently Used
                    </h2>
                    <div className="recent-portals">
                        {recentPortals.map(portal => {
                            const IconComponent = getIconComponent(portal.icon);
                            return (
                                <a
                                    key={portal.id}
                                    href={portal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="recent-item"
                                    onClick={() => trackUsage(portal.id)}
                                >
                                    <div className="recent-icon" style={{ backgroundColor: `${portal.color}20`, color: portal.color }}>
                                        <IconComponent size={16} />
                                    </div>
                                    <span>{portal.name}</span>
                                    <ExternalLink size={12} />
                                </a>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Portal Grid */}
            <div className="portals-grid">
                {sortedPortals.map(portal => {
                    const IconComponent = getIconComponent(portal.icon);
                    return (
                        <div key={portal.id} className="portal-card">
                            <div className="portal-header">
                                <div className="portal-icon" style={{ backgroundColor: `${portal.color}15`, color: portal.color }}>
                                    <IconComponent size={24} />
                                </div>
                                {showAdminMode ? (
                                    <div className="admin-actions">
                                        <button
                                            className="edit-btn"
                                            onClick={() => handleOpenEdit(portal)}
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDelete(portal.id)}
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className={`favorite-btn ${favorites.has(portal.id) ? "active" : ""}`}
                                        onClick={() => toggleFavorite(portal.id)}
                                        title={favorites.has(portal.id) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        {favorites.has(portal.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                                    </button>
                                )}
                            </div>
                            <h3>{portal.name}</h3>
                            <p>{portal.description || "No description"}</p>
                            <a
                                href={portal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="portal-link"
                                onClick={() => trackUsage(portal.id)}
                            >
                                Open Portal
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    );
                })}

                {sortedPortals.length === 0 && (
                    <div className="empty-state">
                        <Globe size={48} />
                        <p>{portals.length === 0 ? "No portals yet" : "No portals found"}</p>
                        {portals.length === 0 && isAdmin && (
                            <button className="seed-btn" onClick={handleSeedDefaults}>
                                Import Default Portals
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingPortal ? "Edit Portal" : "Add Portal"}</h3>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Portal name"
                                />
                            </div>
                            <div className="form-group">
                                <label>URL *</label>
                                <input
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.filter(c => c.key !== "all").map(cat => (
                                            <option key={cat.key} value={cat.key}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Icon</label>
                                    <select
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    >
                                        {ICON_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Color</label>
                                <div className="color-picker">
                                    {COLOR_OPTIONS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`color-option ${formData.color === color ? "active" : ""}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setFormData({ ...formData, color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setShowAddModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="save-btn"
                                onClick={handleSave}
                                disabled={saving || !formData.name || !formData.url}
                            >
                                <Check size={16} />
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .portals-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
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

                .admin-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: var(--transition-fast);
                }

                .admin-toggle:hover, .admin-toggle.active {
                    background: var(--accent-soft);
                    border-color: var(--accent);
                    color: var(--accent);
                }

                .admin-bar {
                    display: flex;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                    padding: 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .add-btn {
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
                    transition: var(--transition-fast);
                }

                .add-btn:hover {
                    filter: brightness(1.1);
                }

                .seed-btn {
                    padding: 0.625rem 1rem;
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    cursor: pointer;
                }

                .seed-btn:hover {
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .filters-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    transition: var(--transition-fast);
                }

                .search-box:focus-within {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px var(--accent-soft);
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

                .category-pills {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .category-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: 9999px;
                    color: var(--text-secondary);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: var(--transition-fast);
                }

                .category-pill:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .category-pill.active {
                    background: var(--accent-soft);
                    border-color: var(--accent-border);
                    color: var(--accent);
                }

                .recent-section {
                    margin-bottom: 1.5rem;
                }

                .recent-section h2 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin: 0 0 0.75rem 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .recent-portals {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .recent-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.875rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    text-decoration: none;
                    transition: var(--transition-fast);
                }

                .recent-item:hover {
                    background: var(--bg-hover);
                    border-color: var(--accent-border);
                }

                .recent-icon {
                    width: 24px;
                    height: 24px;
                    border-radius: var(--radius-sm);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .recent-item svg:last-child {
                    color: var(--text-muted);
                    margin-left: 0.25rem;
                }

                .portals-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }

                .portal-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                    transition: var(--transition-normal);
                }

                .portal-card:hover {
                    border-color: var(--border-hover);
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-lg);
                }

                .portal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                }

                .portal-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .admin-actions {
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
                    transition: var(--transition-fast);
                }

                .edit-btn:hover {
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .favorite-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 0.25rem;
                    transition: var(--transition-fast);
                }

                .favorite-btn:hover, .favorite-btn.active {
                    color: var(--warning);
                }

                .portal-card h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0 0 0.375rem 0;
                }

                .portal-card p {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin: 0 0 1rem 0;
                    line-height: 1.4;
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
                    transition: var(--transition-fast);
                }

                .portal-link:hover {
                    background: var(--accent-hover);
                }

                .empty-state {
                    grid-column: 1 / -1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
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
                    padding: 0.25rem;
                }

                .close-btn:hover {
                    color: var(--text-primary);
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

                .form-group input, .form-group select {
                    padding: 0.625rem 0.875rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .form-group input:focus, .form-group select:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .color-picker {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .color-option {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 2px solid transparent;
                    cursor: pointer;
                    transition: var(--transition-fast);
                }

                .color-option:hover {
                    transform: scale(1.1);
                }

                .color-option.active {
                    border-color: white;
                    box-shadow: 0 0 0 2px var(--accent);
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

                .cancel-btn:hover {
                    background: var(--bg-hover);
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

                .save-btn:hover:not(:disabled) {
                    filter: brightness(1.1);
                }

                .save-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 640px) {
                    .portals-page {
                        padding: 1rem;
                    }

                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .portals-grid {
                        grid-template-columns: 1fr;
                    }

                    .category-pills {
                        overflow-x: auto;
                        flex-wrap: nowrap;
                        padding-bottom: 0.5rem;
                    }

                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

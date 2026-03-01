"use client";

import { useState } from "react";
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
    Star,
    Clock,
    Bookmark,
    BookmarkCheck,
} from "lucide-react";

// ============================================
// PORTAL CATEGORIES & DATA
// ============================================

interface Portal {
    id: string;
    name: string;
    url: string;
    description: string;
    category: "trips" | "rfp" | "affiliates" | "accounting" | "travel" | "other";
    icon: typeof Globe;
    color: string;
}

const PORTALS: Portal[] = [
    // Trip Management
    {
        id: "limoanywhere",
        name: "Limo Anywhere",
        url: "https://limoanywhere.com",
        description: "Reservation and dispatch management",
        category: "trips",
        icon: Car,
        color: "#3b82f6",
    },
    {
        id: "groundspan",
        name: "GroundSpan",
        url: "https://www.groundspan.com",
        description: "Ground transportation network",
        category: "trips",
        icon: Globe,
        color: "#22c55e",
    },
    {
        id: "ridescheduler",
        name: "RideScheduler",
        url: "https://ridescheduler.com",
        description: "Trip scheduling and management",
        category: "trips",
        icon: Calendar,
        color: "#8b5cf6",
    },
    {
        id: "fast",
        name: "FaST",
        url: "https://fasttransportation.com",
        description: "Farm network coordination",
        category: "trips",
        icon: Car,
        color: "#f59e0b",
    },
    {
        id: "lasso",
        name: "Lasso",
        url: "https://lassolimo.com",
        description: "Affiliate network trips",
        category: "trips",
        icon: Users,
        color: "#ec4899",
    },
    // RFP & Bidding
    {
        id: "rfpmonkey",
        name: "RFP Monkey",
        url: "https://rfpmonkey.com",
        description: "RFP bidding platform",
        category: "rfp",
        icon: FileText,
        color: "#06b6d4",
    },
    {
        id: "gbta",
        name: "GBTA",
        url: "https://www.gbta.org",
        description: "Global Business Travel Association",
        category: "rfp",
        icon: Building2,
        color: "#64748b",
    },
    // Affiliate Networks
    {
        id: "nla",
        name: "NLA Connect",
        url: "https://www.limo.org",
        description: "National Limousine Association",
        category: "affiliates",
        icon: Users,
        color: "#0ea5e9",
    },
    {
        id: "tlpa",
        name: "TLPA",
        url: "https://www.tlpa.org",
        description: "Taxicab, Limousine & Paratransit Association",
        category: "affiliates",
        icon: Building2,
        color: "#14b8a6",
    },
    // Accounting & Payments
    {
        id: "stripe",
        name: "Stripe Dashboard",
        url: "https://dashboard.stripe.com",
        description: "Payment processing",
        category: "accounting",
        icon: CreditCard,
        color: "#6366f1",
    },
    {
        id: "quickbooks",
        name: "QuickBooks",
        url: "https://qbo.intuit.com",
        description: "Accounting software",
        category: "accounting",
        icon: FileText,
        color: "#22c55e",
    },
    // Travel & Flight Tracking
    {
        id: "flightaware",
        name: "FlightAware",
        url: "https://flightaware.com",
        description: "Real-time flight tracking",
        category: "travel",
        icon: Plane,
        color: "#0284c7",
    },
    {
        id: "flightradar",
        name: "Flightradar24",
        url: "https://www.flightradar24.com",
        description: "Live flight tracker",
        category: "travel",
        icon: Plane,
        color: "#f97316",
    },
];

const CATEGORIES = [
    { key: "all", label: "All Portals", icon: Globe },
    { key: "trips", label: "Trips", icon: Car },
    { key: "rfp", label: "RFPs", icon: FileText },
    { key: "affiliates", label: "Affiliates", icon: Users },
    { key: "accounting", label: "Accounting", icon: CreditCard },
    { key: "travel", label: "Travel", icon: Plane },
];

// ============================================
// COMPONENT
// ============================================

export default function PortalsClient() {
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

    const filteredPortals = PORTALS.filter(portal => {
        const matchesSearch = search === "" ||
            portal.name.toLowerCase().includes(search.toLowerCase()) ||
            portal.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === "all" || portal.category === category;
        return matchesSearch && matchesCategory;
    });

    // Sort favorites first
    const sortedPortals = [...filteredPortals].sort((a, b) => {
        const aFav = favorites.has(a.id) ? 1 : 0;
        const bFav = favorites.has(b.id) ? 1 : 0;
        return bFav - aFav;
    });

    const recentPortals = recentlyUsed
        .map(id => PORTALS.find(p => p.id === id))
        .filter(Boolean) as Portal[];

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
            </header>

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
            {recentPortals.length > 0 && category === "all" && !search && (
                <section className="recent-section">
                    <h2>
                        <Clock size={16} />
                        Recently Used
                    </h2>
                    <div className="recent-portals">
                        {recentPortals.map(portal => (
                            <a
                                key={portal.id}
                                href={portal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="recent-item"
                                onClick={() => trackUsage(portal.id)}
                            >
                                <div className="recent-icon" style={{ backgroundColor: `${portal.color}20`, color: portal.color }}>
                                    <portal.icon size={16} />
                                </div>
                                <span>{portal.name}</span>
                                <ExternalLink size={12} />
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* Portal Grid */}
            <div className="portals-grid">
                {sortedPortals.map(portal => (
                    <div key={portal.id} className="portal-card">
                        <div className="portal-header">
                            <div className="portal-icon" style={{ backgroundColor: `${portal.color}15`, color: portal.color }}>
                                <portal.icon size={24} />
                            </div>
                            <button
                                className={`favorite-btn ${favorites.has(portal.id) ? "active" : ""}`}
                                onClick={() => toggleFavorite(portal.id)}
                                title={favorites.has(portal.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                                {favorites.has(portal.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                            </button>
                        </div>
                        <h3>{portal.name}</h3>
                        <p>{portal.description}</p>
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
                ))}

                {sortedPortals.length === 0 && (
                    <div className="empty-state">
                        <Globe size={48} />
                        <p>No portals found</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .portals-page {
                    padding: 1.5rem;
                    max-width: 1400px;
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

                /* Filters */
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

                .search-box input::placeholder {
                    color: var(--text-muted);
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

                /* Recent Section */
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

                /* Portal Grid */
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

                .favorite-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 0.25rem;
                    transition: var(--transition-fast);
                }

                .favorite-btn:hover {
                    color: var(--warning);
                }

                .favorite-btn.active {
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
                    transform: translateX(2px);
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

                @media (max-width: 640px) {
                    .portals-page {
                        padding: 1rem;
                    }

                    .portals-grid {
                        grid-template-columns: 1fr;
                    }

                    .category-pills {
                        overflow-x: auto;
                        flex-wrap: nowrap;
                        padding-bottom: 0.5rem;
                    }

                    .category-pill {
                        white-space: nowrap;
                    }
                }
            `}</style>
        </div>
    );
}

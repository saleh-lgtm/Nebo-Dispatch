"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
    BookOpen,
    Search,
    Star,
    ChevronRight,
    FolderOpen,
    FileText,
    AlertCircle,
    X,
    Loader2,
} from "lucide-react";
import { searchSOPs, toggleSOPFavorite } from "@/lib/sopActions";

interface SOP {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category: string | null;
    requiresAcknowledgment?: boolean;
}

interface Props {
    sopsByCategory: Record<string, SOP[]>;
    favoriteSOPs: SOP[];
    unacknowledgedSOPs: SOP[];
}

export default function SOPsClient({
    sopsByCategory,
    favoriteSOPs: initialFavorites,
    unacknowledgedSOPs,
}: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SOP[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [favorites, setFavorites] = useState<Set<string>>(
        new Set(initialFavorites.map((s) => s.id))
    );
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<"all" | "favorites" | "unread">("all");

    const categoryNames = Object.keys(sopsByCategory).sort();

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await searchSOPs(searchQuery);
                setSearchResults(results);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleToggleFavorite = async (e: React.MouseEvent, sopId: string) => {
        e.preventDefault();
        e.stopPropagation();

        startTransition(async () => {
            try {
                const result = await toggleSOPFavorite(sopId);
                setFavorites((prev) => {
                    const next = new Set(prev);
                    if (result.favorited) {
                        next.add(sopId);
                    } else {
                        next.delete(sopId);
                    }
                    return next;
                });
            } catch (error) {
                console.error("Failed to toggle favorite:", error);
            }
        });
    };

    const renderSOPCard = (sop: SOP) => (
        <Link
            key={sop.id}
            href={`/sops/${sop.slug}`}
            className="sop-card"
        >
            <div className="sop-card-content">
                <h3>{sop.title}</h3>
                {sop.description && <p>{sop.description}</p>}
                {sop.category && (
                    <span className="category-tag">
                        <FolderOpen size={12} />
                        {sop.category}
                    </span>
                )}
            </div>
            <div className="sop-card-actions">
                <button
                    onClick={(e) => handleToggleFavorite(e, sop.id)}
                    className={`favorite-btn ${favorites.has(sop.id) ? "active" : ""}`}
                    disabled={isPending}
                >
                    <Star size={16} fill={favorites.has(sop.id) ? "currentColor" : "none"} />
                </button>
                <ChevronRight size={20} className="chevron" />
            </div>

            <style jsx>{`
                .sop-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    text-decoration: none;
                    transition: all 0.15s ease;
                }

                .sop-card:hover {
                    border-color: var(--primary);
                    background: var(--bg-hover);
                }

                .sop-card-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                    min-width: 0;
                }

                .sop-card-content h3 {
                    font-size: 0.9375rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .sop-card-content p {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .category-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    color: var(--primary);
                    margin-top: 0.25rem;
                }

                .sop-card-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }

                .favorite-btn {
                    padding: 0.375rem;
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    border-radius: var(--radius-md);
                    transition: all 0.15s;
                }

                .favorite-btn:hover {
                    color: var(--warning);
                    background: var(--warning-bg);
                }

                .favorite-btn.active {
                    color: var(--warning);
                }

                .chevron {
                    color: var(--text-muted);
                }
            `}</style>
        </Link>
    );

    return (
        <div className="sops-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h1>Standard Operating Procedures</h1>
                        <p>Company guidelines and documentation</p>
                    </div>
                </div>
            </header>

            {/* Search Bar */}
            <div className="search-section">
                <div className="search-input-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search SOPs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="clear-btn"
                        >
                            <X size={16} />
                        </button>
                    )}
                    {isSearching && <Loader2 size={16} className="spinner" />}
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === "all" ? "active" : ""}`}
                    onClick={() => setActiveTab("all")}
                >
                    All SOPs
                </button>
                <button
                    className={`tab ${activeTab === "favorites" ? "active" : ""}`}
                    onClick={() => setActiveTab("favorites")}
                >
                    <Star size={14} />
                    Favorites
                    {favorites.size > 0 && (
                        <span className="tab-badge">{favorites.size}</span>
                    )}
                </button>
                {unacknowledgedSOPs.length > 0 && (
                    <button
                        className={`tab warning ${activeTab === "unread" ? "active" : ""}`}
                        onClick={() => setActiveTab("unread")}
                    >
                        <AlertCircle size={14} />
                        Needs Review
                        <span className="tab-badge warning">{unacknowledgedSOPs.length}</span>
                    </button>
                )}
            </div>

            {/* Search Results */}
            {searchResults !== null ? (
                <div className="search-results">
                    <h2>Search Results ({searchResults.length})</h2>
                    {searchResults.length > 0 ? (
                        <div className="sop-grid">
                            {searchResults.map(renderSOPCard)}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Search size={48} />
                            <p>No SOPs found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            ) : activeTab === "favorites" ? (
                <div className="favorites-section">
                    <h2>Your Favorites</h2>
                    {favorites.size > 0 ? (
                        <div className="sop-grid">
                            {Object.values(sopsByCategory)
                                .flat()
                                .filter((sop) => favorites.has(sop.id))
                                .map(renderSOPCard)}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Star size={48} />
                            <p>No favorites yet. Star SOPs for quick access.</p>
                        </div>
                    )}
                </div>
            ) : activeTab === "unread" ? (
                <div className="unread-section">
                    <h2>SOPs Requiring Your Review</h2>
                    <p className="section-desc">
                        These SOPs require acknowledgment. Please read and acknowledge them.
                    </p>
                    <div className="sop-grid">
                        {unacknowledgedSOPs.map(renderSOPCard)}
                    </div>
                </div>
            ) : (
                /* All SOPs by Category */
                <div className="categories-section">
                    {categoryNames.length > 0 ? (
                        categoryNames.map((category) => (
                            <section key={category} className="category-section">
                                <div className="category-header">
                                    <FolderOpen size={18} />
                                    <h2>{category}</h2>
                                    <span className="count-badge">
                                        {sopsByCategory[category].length}
                                    </span>
                                </div>
                                <div className="sop-grid">
                                    {sopsByCategory[category].map(renderSOPCard)}
                                </div>
                            </section>
                        ))
                    ) : (
                        <div className="empty-state">
                            <FileText size={48} />
                            <p>No SOPs available yet. Check back later.</p>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .sops-page {
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
                    background: var(--primary-soft);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .page-header h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .page-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                /* Search */
                .search-section {
                    margin-bottom: 1rem;
                }

                .search-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 0.75rem 1rem;
                    transition: border-color 0.15s;
                }

                .search-input-wrapper:focus-within {
                    border-color: var(--primary);
                }

                .search-input-wrapper :global(.search-icon) {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .search-input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    font-size: 0.9375rem;
                    color: var(--text-primary);
                    font-family: inherit;
                }

                .search-input::placeholder {
                    color: var(--text-muted);
                }

                .clear-btn {
                    padding: 0.25rem;
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    border-radius: var(--radius-sm);
                }

                .clear-btn:hover {
                    color: var(--text-primary);
                }

                .search-input-wrapper :global(.spinner) {
                    color: var(--primary);
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Tabs */
                .tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    overflow-x: auto;
                    padding-bottom: 0.25rem;
                }

                .tab {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s;
                    white-space: nowrap;
                }

                .tab:hover {
                    border-color: var(--border-hover);
                    color: var(--text-primary);
                }

                .tab.active {
                    background: var(--primary);
                    border-color: var(--primary);
                    color: white;
                }

                .tab.warning.active {
                    background: var(--warning);
                    border-color: var(--warning);
                }

                .tab-badge {
                    padding: 0.125rem 0.5rem;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 9999px;
                    font-size: 0.75rem;
                }

                .tab:not(.active) .tab-badge {
                    background: var(--bg-hover);
                }

                .tab-badge.warning {
                    background: var(--danger);
                    color: white;
                }

                /* Content Sections */
                .search-results h2,
                .favorites-section h2,
                .unread-section h2 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 1rem;
                }

                .section-desc {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                }

                .sop-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1rem;
                }

                /* Category Section */
                .categories-section {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .category-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .category-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--primary);
                }

                .category-header h2 {
                    font-size: 1.125rem;
                    font-weight: 600;
                }

                .count-badge {
                    padding: 0.125rem 0.5rem;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                /* Empty State */
                .empty-state {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 4rem 2rem;
                    text-align: center;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                    margin-bottom: 1rem;
                }

                .empty-state p {
                    font-size: 0.9375rem;
                }

                @media (max-width: 640px) {
                    .sop-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

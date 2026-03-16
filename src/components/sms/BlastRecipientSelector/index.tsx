"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Search,
    X,
    Users,
    Building2,
    Tag,
    ChevronDown,
    Check,
    Loader2,
    Minus,
} from "lucide-react";
import {
    getBlastRecipients,
    getBlastTags,
    type BlastRecipient,
    type BlastFilter,
} from "@/lib/blastSMSActions";
import type { AffiliateType } from "@prisma/client";
import styles from "./RecipientSelector.module.css";

interface RecipientSelectorProps {
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

const AFFILIATE_TYPES: { value: AffiliateType; label: string }[] = [
    { value: "FARM_IN", label: "Farm In" },
    { value: "FARM_OUT", label: "Farm Out" },
    { value: "IOS", label: "IOS" },
    { value: "HOUSE_CHAUFFEUR", label: "Chauffeur" },
];

const ROW_HEIGHT = 72; // Height of each recipient row in pixels

export default function RecipientSelector({
    selectedIds,
    onSelectionChange,
}: RecipientSelectorProps) {
    // Filter state
    const [sources, setSources] = useState<("contacts" | "affiliates")[]>([
        "contacts",
        "affiliates",
    ]);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [contactTagIds, setContactTagIds] = useState<string[]>([]);
    const [affiliateTagIds, setAffiliateTagIds] = useState<string[]>([]);
    const [affiliateTypes, setAffiliateTypes] = useState<AffiliateType[]>([]);

    // Data state
    const [recipients, setRecipients] = useState<BlastRecipient[]>([]);
    const [contactTags, setContactTags] = useState<
        Array<{ id: string; name: string; color: string; _count: { assignments: number } }>
    >([]);
    const [affiliateTags, setAffiliateTags] = useState<
        Array<{ id: string; name: string; color: string; _count: { assignments: number } }>
    >([]);
    const [loading, setLoading] = useState(true);

    // Dropdown state
    const [showContactTagDropdown, setShowContactTagDropdown] = useState(false);
    const [showAffiliateTagDropdown, setShowAffiliateTagDropdown] = useState(false);

    // Virtual scroll state
    const listRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Load tags on mount
    useEffect(() => {
        async function loadTags() {
            try {
                const result = await getBlastTags();
                if (result.success && result.data) {
                    setContactTags(result.data.contactTags);
                    setAffiliateTags(result.data.affiliateTags);
                }
            } catch (error) {
                console.error("Failed to load tags:", error);
            }
        }
        loadTags();
    }, []);

    // Load recipients when filters change
    useEffect(() => {
        async function loadRecipients() {
            setLoading(true);
            try {
                const filter: BlastFilter = {
                    sources,
                    searchQuery: debouncedSearch || undefined,
                    contactTagIds: contactTagIds.length > 0 ? contactTagIds : undefined,
                    affiliateTagIds: affiliateTagIds.length > 0 ? affiliateTagIds : undefined,
                    affiliateTypes: affiliateTypes.length > 0 ? affiliateTypes : undefined,
                };
                const result = await getBlastRecipients(filter);
                if (result.success && result.data) {
                    setRecipients(result.data.recipients);
                }
            } catch (error) {
                console.error("Failed to load recipients:", error);
            } finally {
                setLoading(false);
            }
        }
        loadRecipients();
    }, [sources, debouncedSearch, contactTagIds, affiliateTagIds, affiliateTypes]);

    // Selection handlers
    const handleToggleSelect = useCallback(
        (prefixedId: string) => {
            if (selectedIds.includes(prefixedId)) {
                onSelectionChange(selectedIds.filter((id) => id !== prefixedId));
            } else {
                onSelectionChange([...selectedIds, prefixedId]);
            }
        },
        [selectedIds, onSelectionChange]
    );

    const handleSelectAll = useCallback(() => {
        const allIds = recipients.map((r) => r.prefixedId);
        const allSelected = allIds.every((id) => selectedIds.includes(id));
        if (allSelected) {
            // Deselect all visible
            onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)));
        } else {
            // Select all visible
            const newSelected = new Set([...selectedIds, ...allIds]);
            onSelectionChange(Array.from(newSelected));
        }
    }, [recipients, selectedIds, onSelectionChange]);

    const handleClearSelection = useCallback(() => {
        onSelectionChange([]);
    }, [onSelectionChange]);

    // Source toggle
    const handleToggleSource = (source: "contacts" | "affiliates") => {
        if (sources.includes(source)) {
            if (sources.length > 1) {
                setSources(sources.filter((s) => s !== source));
            }
        } else {
            setSources([...sources, source]);
        }
    };

    // Tag toggle
    const handleToggleContactTag = (tagId: string) => {
        if (contactTagIds.includes(tagId)) {
            setContactTagIds(contactTagIds.filter((id) => id !== tagId));
        } else {
            setContactTagIds([...contactTagIds, tagId]);
        }
    };

    const handleToggleAffiliateTag = (tagId: string) => {
        if (affiliateTagIds.includes(tagId)) {
            setAffiliateTagIds(affiliateTagIds.filter((id) => id !== tagId));
        } else {
            setAffiliateTagIds([...affiliateTagIds, tagId]);
        }
    };

    // Affiliate type toggle
    const handleToggleAffiliateType = (type: AffiliateType) => {
        if (affiliateTypes.includes(type)) {
            setAffiliateTypes(affiliateTypes.filter((t) => t !== type));
        } else {
            setAffiliateTypes([...affiliateTypes, type]);
        }
    };

    // Virtual scroll calculation
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const visibleRecipients = useMemo(() => {
        const containerHeight = 400;
        const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2);
        const endIndex = Math.min(
            recipients.length,
            Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 2
        );
        return recipients.slice(startIndex, endIndex).map((r, i) => ({
            ...r,
            index: startIndex + i,
        }));
    }, [recipients, scrollTop]);

    // Selection stats
    const selectedContacts = selectedIds.filter((id) => id.startsWith("contact_")).length;
    const selectedAffiliates = selectedIds.filter((id) => id.startsWith("affiliate_")).length;
    const allVisibleSelected =
        recipients.length > 0 && recipients.every((r) => selectedIds.includes(r.prefixedId));
    const someVisibleSelected =
        recipients.some((r) => selectedIds.includes(r.prefixedId)) && !allVisibleSelected;

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowContactTagDropdown(false);
            setShowAffiliateTagDropdown(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    return (
        <div className={styles.container}>
            {/* Filter Bar */}
            <div className={styles.filterBar}>
                {/* Source Toggle */}
                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>Source:</span>
                    <div className={styles.sourceToggle}>
                        <button
                            type="button"
                            className={`${styles.sourceBtn} ${sources.includes("contacts") ? styles.sourceBtnActive : ""}`}
                            onClick={() => handleToggleSource("contacts")}
                        >
                            <Users size={14} />
                            Contacts
                        </button>
                        <button
                            type="button"
                            className={`${styles.sourceBtn} ${sources.includes("affiliates") ? styles.sourceBtnActive : ""}`}
                            onClick={() => handleToggleSource("affiliates")}
                        >
                            <Building2 size={14} />
                            Affiliates
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className={styles.searchWrapper}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search by name, company, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className={styles.searchClear}
                            onClick={() => setSearchQuery("")}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Contact Tags Filter */}
                {sources.includes("contacts") && contactTags.length > 0 && (
                    <div
                        className={styles.tagDropdown}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={`${styles.tagDropdownBtn} ${contactTagIds.length > 0 ? styles.tagDropdownBtnActive : ""}`}
                            onClick={() => {
                                setShowContactTagDropdown(!showContactTagDropdown);
                                setShowAffiliateTagDropdown(false);
                            }}
                        >
                            <Tag size={14} />
                            Contact Tags
                            {contactTagIds.length > 0 && (
                                <span className={styles.tagDropdownCount}>
                                    {contactTagIds.length}
                                </span>
                            )}
                            <ChevronDown size={14} />
                        </button>
                        {showContactTagDropdown && (
                            <div className={styles.tagDropdownMenu}>
                                {contactTags.map((tag) => (
                                    <div
                                        key={tag.id}
                                        className={styles.tagDropdownItem}
                                        onClick={() => handleToggleContactTag(tag.id)}
                                    >
                                        <div
                                            className={`${styles.tagDropdownCheck} ${contactTagIds.includes(tag.id) ? styles.tagDropdownCheckActive : ""}`}
                                        >
                                            {contactTagIds.includes(tag.id) && <Check size={12} />}
                                        </div>
                                        <span
                                            className={styles.tagDropdownColor}
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className={styles.tagDropdownName}>{tag.name}</span>
                                        <span className={styles.tagDropdownItemCount}>
                                            {tag._count.assignments}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Affiliate Tags Filter */}
                {sources.includes("affiliates") && affiliateTags.length > 0 && (
                    <div
                        className={styles.tagDropdown}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={`${styles.tagDropdownBtn} ${affiliateTagIds.length > 0 ? styles.tagDropdownBtnActive : ""}`}
                            onClick={() => {
                                setShowAffiliateTagDropdown(!showAffiliateTagDropdown);
                                setShowContactTagDropdown(false);
                            }}
                        >
                            <Tag size={14} />
                            Affiliate Tags
                            {affiliateTagIds.length > 0 && (
                                <span className={styles.tagDropdownCount}>
                                    {affiliateTagIds.length}
                                </span>
                            )}
                            <ChevronDown size={14} />
                        </button>
                        {showAffiliateTagDropdown && (
                            <div className={styles.tagDropdownMenu}>
                                {affiliateTags.length === 0 ? (
                                    <div className={styles.tagDropdownEmpty}>
                                        No affiliate tags created yet
                                    </div>
                                ) : (
                                    affiliateTags.map((tag) => (
                                        <div
                                            key={tag.id}
                                            className={styles.tagDropdownItem}
                                            onClick={() => handleToggleAffiliateTag(tag.id)}
                                        >
                                            <div
                                                className={`${styles.tagDropdownCheck} ${affiliateTagIds.includes(tag.id) ? styles.tagDropdownCheckActive : ""}`}
                                            >
                                                {affiliateTagIds.includes(tag.id) && (
                                                    <Check size={12} />
                                                )}
                                            </div>
                                            <span
                                                className={styles.tagDropdownColor}
                                                style={{ backgroundColor: tag.color }}
                                            />
                                            <span className={styles.tagDropdownName}>
                                                {tag.name}
                                            </span>
                                            <span className={styles.tagDropdownItemCount}>
                                                {tag._count.assignments}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Affiliate Type Filter */}
                {sources.includes("affiliates") && (
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>Type:</span>
                        <div className={styles.affiliateTypePills}>
                            {AFFILIATE_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    className={`${styles.affiliateTypePill} ${affiliateTypes.includes(type.value) ? styles.affiliateTypePillActive : ""}`}
                                    onClick={() => handleToggleAffiliateType(type.value)}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Selection Summary */}
            {selectedIds.length > 0 && (
                <div className={styles.selectionSummary}>
                    <div className={styles.selectionInfo}>
                        <span className={styles.selectionCount}>
                            {selectedIds.length} selected
                        </span>
                        <div className={styles.selectionBreakdown}>
                            {selectedContacts > 0 && <span>{selectedContacts} contacts</span>}
                            {selectedAffiliates > 0 && (
                                <span>{selectedAffiliates} affiliates</span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.clearSelection}
                        onClick={handleClearSelection}
                    >
                        <X size={14} />
                        Clear
                    </button>
                </div>
            )}

            {/* Recipient List */}
            <div className={styles.listContainer}>
                <div className={styles.listHeader}>
                    <div className={styles.listHeaderLeft}>
                        <div
                            className={styles.selectAllCheckbox}
                            onClick={handleSelectAll}
                        >
                            <div
                                className={`${styles.checkbox} ${allVisibleSelected ? styles.checkboxChecked : someVisibleSelected ? styles.checkboxPartial : ""}`}
                            >
                                {allVisibleSelected && <Check size={12} />}
                                {someVisibleSelected && !allVisibleSelected && (
                                    <Minus size={12} />
                                )}
                            </div>
                        </div>
                        <span className={styles.listCount}>
                            <span className={styles.listCountBold}>{recipients.length}</span>{" "}
                            recipients
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingOverlay}>
                        <Loader2 size={24} className={styles.loadingSpinner} />
                    </div>
                ) : recipients.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Users size={40} style={{ opacity: 0.3 }} />
                        <p className={styles.emptyStateTitle}>No recipients found</p>
                        <p className={styles.emptyStateText}>
                            Try adjusting your filters or search query
                        </p>
                    </div>
                ) : (
                    <div
                        ref={listRef}
                        className={styles.virtualList}
                        onScroll={handleScroll}
                    >
                        <div
                            className={styles.virtualListInner}
                            style={{ height: recipients.length * ROW_HEIGHT }}
                        >
                            {visibleRecipients.map((recipient) => {
                                const isSelected = selectedIds.includes(recipient.prefixedId);
                                return (
                                    <div
                                        key={recipient.prefixedId}
                                        className={`${styles.recipientItem} ${isSelected ? styles.recipientItemSelected : ""}`}
                                        style={{ top: recipient.index * ROW_HEIGHT }}
                                        onClick={() => handleToggleSelect(recipient.prefixedId)}
                                    >
                                        <div
                                            className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ""}`}
                                        >
                                            {isSelected && <Check size={12} />}
                                        </div>
                                        <div className={styles.recipientInfo}>
                                            <div className={styles.recipientName}>
                                                {recipient.name}
                                            </div>
                                            <div className={styles.recipientMeta}>
                                                {recipient.phone && (
                                                    <span className={styles.recipientPhone}>
                                                        {formatPhone(recipient.phone)}
                                                    </span>
                                                )}
                                                {recipient.company && (
                                                    <>
                                                        <span>•</span>
                                                        <span className={styles.recipientCompany}>
                                                            {recipient.company}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            {recipient.tags.length > 0 && (
                                                <div className={styles.recipientTags}>
                                                    {recipient.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className={styles.recipientTag}
                                                            style={{
                                                                backgroundColor: `${tag.color}20`,
                                                                color: tag.color,
                                                            }}
                                                        >
                                                            {tag.name}
                                                        </span>
                                                    ))}
                                                    {recipient.tags.length > 3 && (
                                                        <span
                                                            className={styles.recipientTag}
                                                            style={{
                                                                backgroundColor: "var(--bg-secondary)",
                                                                color: "var(--text-muted)",
                                                            }}
                                                        >
                                                            +{recipient.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span
                                            className={`${styles.recipientType} ${recipient.type === "contact" ? styles.recipientTypeContact : styles.recipientTypeAffiliate}`}
                                        >
                                            {recipient.type === "contact"
                                                ? "Contact"
                                                : recipient.affiliateType?.replace("_", " ") ||
                                                  "Affiliate"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Format phone number for display
function formatPhone(phone: string): string {
    if (phone.startsWith("+1") && phone.length === 12) {
        return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
}

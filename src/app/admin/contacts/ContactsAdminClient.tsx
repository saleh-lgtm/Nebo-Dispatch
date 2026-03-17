"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    Tag,
    Search,
    Building2,
    Phone,
    Mail,
    MoreVertical,
    Tags,
} from "lucide-react";
import { TagBadge, TagFilter, TagManager, TagAssignmentModal } from "@/components/contacts";
import TabBar from "@/components/ui/TabBar";
import styles from "./ContactsAdmin.module.css";

interface TagData {
    id: string;
    name: string;
    color: string;
    description: string | null;
    _count: { assignments: number };
}

interface ContactTag {
    tag: { id: string; name: string; color: string };
}

interface Contact {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    notes: string | null;
    approvalStatus: string;
    createdAt: Date;
    createdBy: { id: string; name: string | null };
    approvedBy: { id: string; name: string | null } | null;
    tags: ContactTag[];
}

interface Props {
    initialContacts: Contact[];
    initialTags: TagData[];
}

export default function ContactsAdminClient({ initialContacts, initialTags }: Props) {
    const router = useRouter();
    const [contacts, setContacts] = useState(initialContacts);
    const [tags, setTags] = useState(initialTags);
    const [activeTab, setActiveTab] = useState<"contacts" | "tags">("contacts");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    const handleRefresh = () => {
        router.refresh();
    };

    const handleTagToggle = (tagId: string) => {
        setSelectedTagFilters((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    };

    const filteredContacts = contacts.filter((contact) => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch =
                contact.name.toLowerCase().includes(query) ||
                contact.email?.toLowerCase().includes(query) ||
                contact.company?.toLowerCase().includes(query) ||
                contact.phone?.includes(query);
            if (!matchesSearch) return false;
        }

        // Tag filter
        if (selectedTagFilters.length > 0) {
            const contactTagIds = contact.tags.map((t) => t.tag.id);
            const hasMatchingTag = selectedTagFilters.some((tagId) =>
                contactTagIds.includes(tagId)
            );
            if (!hasMatchingTag) return false;
        }

        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED":
                return { bg: "var(--success-soft)", text: "var(--success)" };
            case "PENDING":
                return { bg: "var(--warning-soft)", text: "var(--warning)" };
            case "REJECTED":
                return { bg: "var(--danger-soft)", text: "var(--danger)" };
            default:
                return { bg: "var(--bg-muted)", text: "var(--text-secondary)" };
        }
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerIcon}>
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Contact Management</h1>
                        <p className={styles.headerSubtitle}>
                            Manage contacts, tags, and organize for blast messaging
                        </p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <TabBar
                tabs={[
                    { value: "contacts", label: "Contacts", icon: <Users size={16} />, count: contacts.length },
                    { value: "tags", label: "Tags", icon: <Tag size={16} />, count: tags.length },
                ]}
                activeTab={activeTab}
                onChange={(v) => setActiveTab(v as "contacts" | "tags")}
                className={styles.tabBar}
            />

            {activeTab === "contacts" ? (
                <>
                    {/* Search and Filters */}
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, email, company..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tag Filter */}
                    {tags.length > 0 && (
                        <div className={styles.filterBar}>
                            <TagFilter
                                tags={tags}
                                selectedTags={selectedTagFilters}
                                onTagToggle={handleTagToggle}
                                onClearAll={() => setSelectedTagFilters([])}
                            />
                        </div>
                    )}

                    {/* Contacts List */}
                    <div className={styles.contactsList}>
                        {filteredContacts.length === 0 ? (
                            <div className={styles.emptyState}>
                                <Users size={48} />
                                <h3>No contacts found</h3>
                                <p>
                                    {searchQuery || selectedTagFilters.length > 0
                                        ? "Try adjusting your filters"
                                        : "No contacts have been created yet"}
                                </p>
                            </div>
                        ) : (
                            filteredContacts.map((contact) => {
                                const statusColor = getStatusColor(contact.approvalStatus);
                                return (
                                    <div key={contact.id} className={styles.contactCard}>
                                        <div className={styles.contactMain}>
                                            <div className={styles.contactAvatar}>
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={styles.contactInfo}>
                                                <div className={styles.contactHeader}>
                                                    <span className={styles.contactName}>{contact.name}</span>
                                                    <span
                                                        className={styles.contactStatus}
                                                        style={{
                                                            backgroundColor: statusColor.bg,
                                                            color: statusColor.text,
                                                        }}
                                                    >
                                                        {contact.approvalStatus}
                                                    </span>
                                                </div>
                                                <div className={styles.contactMeta}>
                                                    {contact.company && (
                                                        <span className={styles.metaItem}>
                                                            <Building2 size={12} />
                                                            {contact.company}
                                                        </span>
                                                    )}
                                                    {contact.phone && (
                                                        <span className={styles.metaItem}>
                                                            <Phone size={12} />
                                                            {contact.phone}
                                                        </span>
                                                    )}
                                                    {contact.email && (
                                                        <span className={styles.metaItem}>
                                                            <Mail size={12} />
                                                            {contact.email}
                                                        </span>
                                                    )}
                                                </div>
                                                {contact.tags.length > 0 && (
                                                    <div className={styles.contactTags}>
                                                        {contact.tags.map(({ tag }) => (
                                                            <TagBadge
                                                                key={tag.id}
                                                                name={tag.name}
                                                                color={tag.color}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.contactActions}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedContact(contact);
                                                    setAssignModalOpen(true);
                                                }}
                                                className="btn btn-ghost btn-sm"
                                                title="Manage tags"
                                            >
                                                <Tags size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                title="More options"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                <div className={styles.tagManagerContainer}>
                    <TagManager tags={tags} onTagsChange={handleRefresh} />
                </div>
            )}

            {/* Tag Assignment Modal */}
            {selectedContact && (
                <TagAssignmentModal
                    isOpen={assignModalOpen}
                    onClose={() => {
                        setAssignModalOpen(false);
                        setSelectedContact(null);
                    }}
                    contactId={selectedContact.id}
                    contactName={selectedContact.name}
                    availableTags={tags}
                    currentTagIds={selectedContact.tags.map((t) => t.tag.id)}
                    onSuccess={handleRefresh}
                />
            )}
        </div>
    );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    MessageSquare,
    Phone,
    Users,
    Search,
    Send,
    ArrowDownLeft,
    ArrowUpRight,
    Car,
    UserCheck,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    TrendingUp,
    BarChart3,
    Plus,
    Filter,
    MoreHorizontal,
    ChevronRight,
    ArrowLeft,
    Loader2,
    Zap,
    MessageCircle,
    PhoneCall,
    Edit3,
    Trash2,
    ShieldCheck,
    X,
    RefreshCw,
    Sparkles,
    Activity,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import Modal from "@/components/ui/Modal";
import {
    sendConversationSMS,
    getConversationMessages,
} from "@/lib/twilioActions";
import {
    createNetworkPartner,
    updateNetworkPartner,
    deleteNetworkPartner,
    approveNetworkPartner,
    type PartnerType,
} from "@/lib/networkActions";

// ============================================
// TYPES
// ============================================

interface Partner {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    type: PartnerType;
    state: string | null;
    market: string | null;
    cities: string[];
    isApproved: boolean;
    isActive: boolean;
    notes: string | null;
    employeeId: string | null;
    createdAt: Date;
    smsContacts?: Array<{
        id: string;
        phoneNumber: string;
        _count: { messages: number };
    }>;
}

interface Conversation {
    phone: string;
    lastMessage: string;
    lastMessageAt: Date;
    direction: string;
    status: string;
    unreadCount: number;
    contactName: string | null;
    affiliateId: string | null;
    partnerName: string | null;
    partnerType: string | null;
}

interface SMSMessage {
    id: string;
    message: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: Date;
    from?: string | null;
    to: string;
}

interface Stats {
    todayMessages: number;
    weekMessages: number;
    failedMessages: number;
    totalContacts: number;
    todayInbound: number;
    responseRate: number;
}

interface Props {
    initialPartners: Partner[];
    initialConversations: Conversation[];
    stats: Stats;
    pendingCounts: Record<string, number>;
    session: { user: { id: string; name?: string | null; email?: string | null; role: string } };
    isAdmin: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const PARTNER_TYPES: { key: PartnerType; label: string; shortLabel: string; icon: typeof ArrowUpRight; color: string }[] = [
    { key: "FARM_OUT", label: "Farm Out", shortLabel: "Out", icon: ArrowUpRight, color: "#60a5fa" },
    { key: "FARM_IN", label: "Farm In", shortLabel: "In", icon: ArrowDownLeft, color: "#4ade80" },
    { key: "IOS", label: "IOS", shortLabel: "IOS", icon: Car, color: "#f59e0b" },
    { key: "HOUSE_CHAUFFEUR", label: "Chauffeur", shortLabel: "HC", icon: UserCheck, color: "#a78bfa" },
];

const getTypeConfig = (type: string | null) => {
    return PARTNER_TYPES.find(t => t.key === type) || PARTNER_TYPES[0];
};

const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return phone;
};

const formatTime = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CommunicationsHub({
    initialPartners,
    initialConversations,
    stats,
    pendingCounts,
    session,
    isAdmin,
}: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [isPending, startTransition] = useTransition();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // State
    const [partners] = useState<Partner[]>(initialPartners);
    const [conversations] = useState<Conversation[]>(initialConversations);
    const [search, setSearch] = useState("");
    const [activeView, setActiveView] = useState<"contacts" | "messages">("contacts");
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<SMSMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [typeFilter, setTypeFilter] = useState<PartnerType | "all">("all");
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [mobileView, setMobileView] = useState<"list" | "chat">("list");

    // Unified contacts list (partners + conversations)
    const unifiedContacts = useMemo(() => {
        const contactMap = new Map<string, {
            id: string;
            name: string;
            phone: string;
            type: PartnerType | null;
            lastMessage?: string;
            lastMessageAt?: Date;
            unreadCount: number;
            isPartner: boolean;
            partner?: Partner;
        }>();

        // Add partners with phones
        partners.filter(p => p.phone).forEach(p => {
            const normalizedPhone = p.phone!.replace(/\D/g, "");
            contactMap.set(normalizedPhone, {
                id: p.id,
                name: p.name,
                phone: p.phone!,
                type: p.type,
                unreadCount: 0,
                isPartner: true,
                partner: p,
            });
        });

        // Merge conversation data
        conversations.forEach(c => {
            const normalizedPhone = c.phone.replace(/\D/g, "");
            const existing = contactMap.get(normalizedPhone);
            if (existing) {
                existing.lastMessage = c.lastMessage;
                existing.lastMessageAt = c.lastMessageAt;
                existing.unreadCount = c.unreadCount;
            } else {
                contactMap.set(normalizedPhone, {
                    id: c.phone,
                    name: c.contactName || c.partnerName || formatPhone(c.phone),
                    phone: c.phone,
                    type: c.partnerType as PartnerType | null,
                    lastMessage: c.lastMessage,
                    lastMessageAt: c.lastMessageAt,
                    unreadCount: c.unreadCount,
                    isPartner: !!c.affiliateId,
                });
            }
        });

        // Filter and sort
        let contacts = Array.from(contactMap.values());

        if (typeFilter !== "all") {
            contacts = contacts.filter(c => c.type === typeFilter);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            contacts = contacts.filter(c =>
                c.name.toLowerCase().includes(searchLower) ||
                c.phone.includes(search) ||
                c.lastMessage?.toLowerCase().includes(searchLower)
            );
        }

        // Sort by last message time, then alphabetically
        return contacts.sort((a, b) => {
            if (a.lastMessageAt && b.lastMessageAt) {
                return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
            }
            if (a.lastMessageAt) return -1;
            if (b.lastMessageAt) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [partners, conversations, search, typeFilter]);

    // Load messages for selected conversation
    const loadMessages = useCallback(async (phone: string) => {
        setIsLoadingMessages(true);
        try {
            const data = await getConversationMessages(phone, { limit: 100 });
            setMessages(data.messages as SMSMessage[]);
        } catch (error) {
            console.error("Failed to load messages:", error);
            addToast("Failed to load messages", "error");
        } finally {
            setIsLoadingMessages(false);
        }
    }, [addToast]);

    // Handle conversation selection
    const handleSelectConversation = useCallback((phone: string) => {
        setSelectedConversation(phone);
        setMobileView("chat");
        loadMessages(phone);
    }, [loadMessages]);

    // Send message
    const handleSendMessage = async () => {
        if (!selectedConversation || !newMessage.trim()) return;

        setIsSending(true);
        try {
            const result = await sendConversationSMS(selectedConversation, newMessage.trim());
            if (result.success) {
                setNewMessage("");
                await loadMessages(selectedConversation);
                inputRef.current?.focus();
            } else {
                addToast(result.error || "Failed to send message", "error");
            }
        } catch (error) {
            addToast("Failed to send message", "error");
        } finally {
            setIsSending(false);
        }
    };

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-refresh messages
    useEffect(() => {
        if (!selectedConversation) return;
        const interval = setInterval(() => loadMessages(selectedConversation), 15000);
        return () => clearInterval(interval);
    }, [selectedConversation, loadMessages]);

    // Get selected contact info
    const selectedContact = useMemo(() => {
        if (!selectedConversation) return null;
        return unifiedContacts.find(c => c.phone === selectedConversation || c.phone.replace(/\D/g, "") === selectedConversation.replace(/\D/g, ""));
    }, [selectedConversation, unifiedContacts]);

    // Handle partner actions
    const handleApprovePartner = async (partner: Partner) => {
        try {
            await approveNetworkPartner(partner.id);
            addToast(`${partner.name} approved`, "success");
            router.refresh();
        } catch {
            addToast("Failed to approve partner", "error");
        }
    };

    const handleDeletePartner = async (partner: Partner) => {
        if (!confirm(`Delete ${partner.name}?`)) return;
        try {
            await deleteNetworkPartner(partner.id);
            addToast(`${partner.name} deleted`, "info");
            router.refresh();
        } catch {
            addToast("Failed to delete partner", "error");
        }
    };

    return (
        <div className="comm-hub">
            {/* Stats Header */}
            <header className="comm-header">
                <div className="header-left">
                    <div className="header-icon">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h1>Communications Hub</h1>
                        <p>Unified messaging & partner management</p>
                    </div>
                </div>
                <div className="header-stats">
                    <div className="stat-pill">
                        <MessageSquare size={14} />
                        <span className="stat-value">{stats.todayMessages}</span>
                        <span className="stat-label">today</span>
                    </div>
                    <div className="stat-pill stat-pill-success">
                        <TrendingUp size={14} />
                        <span className="stat-value">{stats.responseRate}%</span>
                        <span className="stat-label">response</span>
                    </div>
                    <div className="stat-pill">
                        <Users size={14} />
                        <span className="stat-value">{stats.totalContacts}</span>
                        <span className="stat-label">contacts</span>
                    </div>
                    {stats.failedMessages > 0 && (
                        <div className="stat-pill stat-pill-danger">
                            <AlertCircle size={14} />
                            <span className="stat-value">{stats.failedMessages}</span>
                            <span className="stat-label">failed</span>
                        </div>
                    )}
                </div>
                <div className="header-actions">
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                        <Plus size={16} />
                        <span className="hide-mobile">Add Contact</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="comm-body">
                {/* Sidebar / Contact List */}
                <aside className={`comm-sidebar ${mobileView === "chat" ? "hide-mobile" : ""}`}>
                    {/* Search & Filter */}
                    <div className="sidebar-search">
                        <div className="search-input-wrap">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search contacts or messages..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="search-clear">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Type Filter Pills */}
                    <div className="filter-pills">
                        <button
                            className={`filter-pill ${typeFilter === "all" ? "active" : ""}`}
                            onClick={() => setTypeFilter("all")}
                        >
                            All
                            <span className="pill-count">{partners.filter(p => p.phone).length}</span>
                        </button>
                        {PARTNER_TYPES.map(type => {
                            const count = partners.filter(p => p.phone && p.type === type.key).length;
                            const pending = pendingCounts[type.key] || 0;
                            return (
                                <button
                                    key={type.key}
                                    className={`filter-pill ${typeFilter === type.key ? "active" : ""}`}
                                    onClick={() => setTypeFilter(type.key)}
                                    style={{ "--pill-color": type.color } as React.CSSProperties}
                                >
                                    <type.icon size={12} />
                                    {type.shortLabel}
                                    <span className="pill-count">{count}</span>
                                    {pending > 0 && <span className="pill-pending">{pending}</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Contact List */}
                    <div className="contact-list">
                        {unifiedContacts.length === 0 ? (
                            <div className="empty-contacts">
                                <Users size={40} />
                                <p>No contacts found</p>
                            </div>
                        ) : (
                            unifiedContacts.map(contact => {
                                const typeConfig = getTypeConfig(contact.type);
                                const isSelected = selectedConversation?.replace(/\D/g, "") === contact.phone.replace(/\D/g, "");

                                return (
                                    <div
                                        key={contact.id}
                                        className={`contact-item ${isSelected ? "selected" : ""} ${contact.unreadCount > 0 ? "unread" : ""}`}
                                        onClick={() => handleSelectConversation(contact.phone)}
                                    >
                                        <div
                                            className="contact-avatar"
                                            style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
                                        >
                                            <typeConfig.icon size={18} />
                                        </div>
                                        <div className="contact-info">
                                            <div className="contact-header">
                                                <span className="contact-name">{contact.name}</span>
                                                {contact.lastMessageAt && (
                                                    <span className="contact-time">{formatTime(contact.lastMessageAt)}</span>
                                                )}
                                            </div>
                                            <div className="contact-meta">
                                                {contact.lastMessage ? (
                                                    <span className="contact-preview">{contact.lastMessage}</span>
                                                ) : (
                                                    <span className="contact-phone">{formatPhone(contact.phone)}</span>
                                                )}
                                                {contact.unreadCount > 0 && (
                                                    <span className="unread-badge">{contact.unreadCount}</span>
                                                )}
                                            </div>
                                        </div>
                                        {contact.partner && !contact.partner.isApproved && (
                                            <span className="pending-indicator" title="Pending approval">
                                                <Clock size={14} />
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* Chat Area */}
                <main className={`comm-chat ${mobileView === "list" ? "hide-mobile" : ""}`}>
                    {selectedConversation && selectedContact ? (
                        <>
                            {/* Chat Header */}
                            <div className="chat-header">
                                <button
                                    className="back-btn show-mobile"
                                    onClick={() => setMobileView("list")}
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div
                                    className="chat-avatar"
                                    style={{
                                        backgroundColor: `${getTypeConfig(selectedContact.type).color}20`,
                                        color: getTypeConfig(selectedContact.type).color,
                                    }}
                                >
                                    {React.createElement(getTypeConfig(selectedContact.type).icon, { size: 20 })}
                                </div>
                                <div className="chat-contact-info">
                                    <h2>{selectedContact.name}</h2>
                                    <span className="chat-phone">{formatPhone(selectedContact.phone)}</span>
                                </div>
                                <div className="chat-actions">
                                    <button className="btn btn-ghost btn-icon" title="Call">
                                        <PhoneCall size={18} />
                                    </button>
                                    {selectedContact.partner && isAdmin && (
                                        <>
                                            {!selectedContact.partner.isApproved && (
                                                <button
                                                    className="btn btn-success btn-icon"
                                                    title="Approve"
                                                    onClick={() => handleApprovePartner(selectedContact.partner!)}
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                title="Edit"
                                                onClick={() => setSelectedPartner(selectedContact.partner!)}
                                            >
                                                <Edit3 size={18} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => loadMessages(selectedConversation)}
                                        disabled={isLoadingMessages}
                                    >
                                        <RefreshCw size={18} className={isLoadingMessages ? "animate-spin" : ""} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="chat-messages">
                                {isLoadingMessages && messages.length === 0 ? (
                                    <div className="messages-loading">
                                        <Loader2 size={32} className="animate-spin" />
                                        <p>Loading messages...</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="messages-empty">
                                        <MessageCircle size={48} />
                                        <h3>Start a conversation</h3>
                                        <p>Send a message to begin chatting</p>
                                    </div>
                                ) : (
                                    <div className="messages-list">
                                        {messages.map((msg, idx) => {
                                            const isOutbound = msg.direction === "OUTBOUND";
                                            const showDate = idx === 0 || new Date(messages[idx - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                                            return (
                                                <div key={msg.id}>
                                                    {showDate && (
                                                        <div className="message-date">
                                                            {new Date(msg.createdAt).toLocaleDateString(undefined, {
                                                                weekday: "short",
                                                                month: "short",
                                                                day: "numeric",
                                                            })}
                                                        </div>
                                                    )}
                                                    <div className={`message ${isOutbound ? "outbound" : "inbound"}`}>
                                                        <div className="message-content">
                                                            <p>{msg.message}</p>
                                                            <span className="message-time">
                                                                {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                                                                    hour: "numeric",
                                                                    minute: "2-digit",
                                                                })}
                                                                {isOutbound && (
                                                                    <span className="message-status">
                                                                        {msg.status === "delivered" ? <CheckCircle size={12} /> :
                                                                            msg.status === "failed" ? <XCircle size={12} /> :
                                                                                <Clock size={12} />}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Message Input */}
                            <div className="chat-input">
                                <div className="input-wrap">
                                    <textarea
                                        ref={inputRef}
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        rows={1}
                                    />
                                    <button
                                        className="send-btn"
                                        onClick={handleSendMessage}
                                        disabled={isSending || !newMessage.trim()}
                                    >
                                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                    </button>
                                </div>
                                <div className="input-hint">
                                    <span>Press Enter to send, Shift+Enter for new line</span>
                                    <span className="char-count">{newMessage.length}/160</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="chat-empty">
                            <div className="empty-graphic">
                                <Sparkles size={48} />
                            </div>
                            <h2>Select a conversation</h2>
                            <p>Choose a contact to start messaging or view history</p>
                            <div className="empty-stats">
                                <div className="empty-stat">
                                    <Activity size={16} />
                                    <span>{stats.weekMessages} messages this week</span>
                                </div>
                                <div className="empty-stat">
                                    <Users size={16} />
                                    <span>{unifiedContacts.length} active contacts</span>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Add Contact Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Contact" size="md">
                <QuickAddForm
                    onSubmit={async (data) => {
                        try {
                            await createNetworkPartner({
                                ...data,
                                submittedById: session.user.id,
                            });
                            setShowAddModal(false);
                            addToast("Contact added!", "success");
                            router.refresh();
                        } catch {
                            addToast("Failed to add contact", "error");
                        }
                    }}
                    onCancel={() => setShowAddModal(false)}
                />
            </Modal>

            <style jsx>{`
                .comm-hub {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 68px);
                    background: var(--bg-base);
                }

                /* Header */
                .comm-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 1rem 1.5rem;
                    background: var(--bg-surface);
                    border-bottom: 1px solid var(--border);
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, var(--accent-soft), rgba(238, 79, 39, 0.25));
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent);
                    box-shadow: 0 0 20px rgba(238, 79, 39, 0.2);
                }

                .header-left h1 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0;
                }

                .header-left p {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin: 0;
                }

                .header-stats {
                    display: flex;
                    gap: 0.75rem;
                    flex: 1;
                    justify-content: center;
                }

                .stat-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: 9999px;
                    font-size: 0.8125rem;
                }

                .stat-pill-success {
                    background: var(--success-soft);
                    border-color: var(--success-border);
                    color: var(--success);
                }

                .stat-pill-danger {
                    background: var(--danger-soft);
                    border-color: var(--danger-border);
                    color: var(--danger);
                }

                .stat-value {
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-pill-success .stat-value { color: var(--success); }
                .stat-pill-danger .stat-value { color: var(--danger); }

                .stat-label {
                    color: var(--text-muted);
                    font-size: 0.75rem;
                }

                .header-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                /* Body */
                .comm-body {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                /* Sidebar */
                .comm-sidebar {
                    width: 380px;
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-surface);
                }

                .sidebar-search {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                }

                .search-input-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    transition: var(--transition-fast);
                }

                .search-input-wrap:focus-within {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px var(--accent-soft);
                }

                .search-input-wrap input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .search-input-wrap input::placeholder {
                    color: var(--text-muted);
                }

                .search-input-wrap svg {
                    color: var(--text-muted);
                }

                .search-clear {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 0.25rem;
                    display: flex;
                }

                .search-clear:hover {
                    color: var(--text-primary);
                }

                /* Filter Pills */
                .filter-pills {
                    display: flex;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    overflow-x: auto;
                    border-bottom: 1px solid var(--border);
                }

                .filter-pills::-webkit-scrollbar {
                    display: none;
                }

                .filter-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.75rem;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: var(--transition-fast);
                    white-space: nowrap;
                }

                .filter-pill:hover {
                    background: var(--bg-active);
                    color: var(--text-primary);
                }

                .filter-pill.active {
                    background: var(--accent-soft);
                    border-color: var(--accent-border);
                    color: var(--accent);
                }

                .pill-count {
                    padding: 0.125rem 0.375rem;
                    background: var(--bg-active);
                    border-radius: 9999px;
                    font-size: 0.6875rem;
                }

                .filter-pill.active .pill-count {
                    background: var(--accent);
                    color: white;
                }

                .pill-pending {
                    padding: 0.125rem 0.375rem;
                    background: var(--warning);
                    color: var(--text-inverse);
                    border-radius: 9999px;
                    font-size: 0.6875rem;
                }

                /* Contact List */
                .contact-list {
                    flex: 1;
                    overflow-y: auto;
                }

                .contact-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    cursor: pointer;
                    transition: var(--transition-fast);
                    border-bottom: 1px solid var(--border);
                    position: relative;
                }

                .contact-item:hover {
                    background: var(--bg-hover);
                }

                .contact-item.selected {
                    background: var(--accent-soft);
                    border-left: 3px solid var(--accent);
                }

                .contact-item.unread {
                    background: rgba(238, 79, 39, 0.05);
                }

                .contact-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .contact-info {
                    flex: 1;
                    min-width: 0;
                }

                .contact-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 0.25rem;
                }

                .contact-name {
                    font-weight: 600;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .contact-time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .contact-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .contact-preview,
                .contact-phone {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }

                .contact-item.unread .contact-preview {
                    color: var(--text-primary);
                    font-weight: 500;
                }

                .unread-badge {
                    background: var(--accent);
                    color: white;
                    font-size: 0.6875rem;
                    font-weight: 700;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    flex-shrink: 0;
                }

                .pending-indicator {
                    position: absolute;
                    top: 0.75rem;
                    right: 0.75rem;
                    color: var(--warning);
                }

                .empty-contacts {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--text-muted);
                    gap: 1rem;
                }

                /* Chat Area */
                .comm-chat {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-base);
                    min-width: 0;
                }

                .chat-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.5rem;
                    background: var(--bg-surface);
                    border-bottom: 1px solid var(--border);
                }

                .back-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.5rem;
                }

                .chat-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .chat-contact-info {
                    flex: 1;
                }

                .chat-contact-info h2 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .chat-phone {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }

                .chat-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                /* Messages */
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                }

                .messages-loading,
                .messages-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-muted);
                    gap: 1rem;
                }

                .messages-empty h3 {
                    color: var(--text-secondary);
                    font-size: 1.125rem;
                    margin: 0;
                }

                .messages-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .message-date {
                    text-align: center;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    padding: 1rem 0;
                }

                .message {
                    display: flex;
                    max-width: 75%;
                }

                .message.outbound {
                    margin-left: auto;
                }

                .message-content {
                    padding: 0.875rem 1rem;
                    border-radius: var(--radius-lg);
                    position: relative;
                }

                .message.inbound .message-content {
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-bottom-left-radius: 4px;
                }

                .message.outbound .message-content {
                    background: linear-gradient(135deg, var(--accent), var(--accent-dim));
                    color: white;
                    border-bottom-right-radius: 4px;
                }

                .message-content p {
                    margin: 0;
                    font-size: 0.9375rem;
                    line-height: 1.5;
                    word-wrap: break-word;
                }

                .message-time {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.6875rem;
                    opacity: 0.7;
                    margin-top: 0.5rem;
                }

                .message.inbound .message-time {
                    color: var(--text-muted);
                }

                .message-status {
                    display: flex;
                }

                /* Input */
                .chat-input {
                    padding: 1rem 1.5rem;
                    background: var(--bg-surface);
                    border-top: 1px solid var(--border);
                }

                .input-wrap {
                    display: flex;
                    align-items: flex-end;
                    gap: 0.75rem;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 0.75rem 1rem;
                    transition: var(--transition-fast);
                }

                .input-wrap:focus-within {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px var(--accent-soft);
                }

                .input-wrap textarea {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-primary);
                    font-size: 0.9375rem;
                    font-family: var(--font-sans);
                    resize: none;
                    max-height: 120px;
                    line-height: 1.5;
                }

                .input-wrap textarea::placeholder {
                    color: var(--text-muted);
                }

                .send-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: var(--radius-md);
                    background: var(--accent);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: var(--transition-fast);
                    flex-shrink: 0;
                }

                .send-btn:hover:not(:disabled) {
                    background: var(--accent-hover);
                    transform: scale(1.05);
                }

                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .input-hint {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: 0.5rem;
                    padding: 0 0.25rem;
                }

                .char-count {
                    font-family: var(--font-mono);
                }

                /* Empty Chat State */
                .chat-empty {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    text-align: center;
                }

                .empty-graphic {
                    width: 100px;
                    height: 100px;
                    background: linear-gradient(135deg, var(--accent-soft), rgba(139, 122, 168, 0.15));
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent);
                    margin-bottom: 1.5rem;
                    animation: pulse 3s ease-in-out infinite;
                }

                .chat-empty h2 {
                    font-size: 1.25rem;
                    color: var(--text-primary);
                    margin: 0 0 0.5rem 0;
                }

                .chat-empty p {
                    color: var(--text-secondary);
                    margin: 0;
                }

                .empty-stats {
                    display: flex;
                    gap: 2rem;
                    margin-top: 2rem;
                }

                .empty-stat {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    color: var(--text-muted);
                }

                /* Mobile */
                @media (max-width: 768px) {
                    .comm-header {
                        flex-wrap: wrap;
                        gap: 1rem;
                    }

                    .header-stats {
                        order: 3;
                        width: 100%;
                        justify-content: flex-start;
                        overflow-x: auto;
                    }

                    .header-stats::-webkit-scrollbar {
                        display: none;
                    }

                    .hide-mobile {
                        display: none !important;
                    }

                    .show-mobile {
                        display: flex !important;
                    }

                    .comm-sidebar {
                        width: 100%;
                    }

                    .back-btn {
                        display: flex;
                    }

                    .message {
                        max-width: 85%;
                    }
                }

                @media (max-width: 1024px) {
                    .comm-sidebar {
                        width: 320px;
                    }
                }
            `}</style>
        </div>
    );
}

// ============================================
// QUICK ADD FORM
// ============================================

function QuickAddForm({
    onSubmit,
    onCancel,
}: {
    onSubmit: (data: { name: string; email: string; phone?: string; type: PartnerType }) => Promise<void>;
    onCancel: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        type: "FARM_OUT" as PartnerType,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                name: formData.name,
                email: formData.email || `${formData.phone.replace(/\D/g, "")}@contact.local`,
                phone: formData.phone || undefined,
                type: formData.type,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label className="input-label">Contact Type</label>
                <div className="flex gap-2 flex-wrap">
                    {PARTNER_TYPES.map(type => (
                        <button
                            key={type.key}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: type.key })}
                            className={`btn ${formData.type === type.key ? "btn-primary" : "btn-ghost"}`}
                            style={{ flex: 1, minWidth: "100px" }}
                        >
                            <type.icon size={16} />
                            {type.shortLabel}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label className="input-label">Name *</label>
                <input
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                />
            </div>

            <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                    <label className="input-label">Phone</label>
                    <input
                        className="input"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>
                <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                    <label className="input-label">Email</label>
                    <input
                        className="input"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={onCancel} className="btn btn-ghost">
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !formData.name}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {loading ? "Adding..." : "Add Contact"}
                </button>
            </div>
        </form>
    );
}

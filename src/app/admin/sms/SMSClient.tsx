"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
    MessageSquare,
    Send,
    TrendingUp,
    DollarSign,
    AlertCircle,
    Calendar,
    Filter,
    Phone,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    User,
    RefreshCw,
    MessageCircle,
    BarChart3,
} from "lucide-react";
import {
    sendCustomSMS,
    getSMSHistory,
    getSMSStats,
    getConversations,
    getConversationMessages,
    sendConversationSMS,
} from "@/lib/twilioActions";
import ConversationList from "@/components/sms/ConversationList";
import ChatView from "@/components/sms/ChatView";

interface SMSLog {
    id: string;
    direction?: "INBOUND" | "OUTBOUND";
    from?: string | null;
    to: string;
    message: string;
    status: string;
    messageSid: string | null;
    segments: number;
    error: string | null;
    createdAt: Date;
    sentBy: { id: string; name: string | null } | null;
}

interface SMSStats {
    todayCount: number;
    monthCount: number;
    totalSegments: number;
    failedCount: number;
    estimatedCost: string;
}

interface Conversation {
    conversationPhone: string;
    lastMessage: string;
    lastMessageAt: Date;
    messageCount: number;
    unreadCount: number;
}

interface Props {
    initialLogs: SMSLog[];
    totalLogs: number;
    initialStats: SMSStats;
}

type TabType = "dashboard" | "conversations";

export default function SMSClient({ initialLogs, totalLogs, initialStats }: Props) {
    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [logs, setLogs] = useState<SMSLog[]>(initialLogs);
    const [stats, setStats] = useState<SMSStats>(initialStats);
    const [total, setTotal] = useState(totalLogs);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [page, setPage] = useState(0);
    const [isPending, startTransition] = useTransition();

    // Send SMS form state
    const [phoneNumber, setPhoneNumber] = useState("");
    const [message, setMessage] = useState("");
    const [sendStatus, setSendStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [isSending, setIsSending] = useState(false);

    // Conversation state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [conversationMessages, setConversationMessages] = useState<SMSLog[]>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingChat, setIsSendingChat] = useState(false);

    const LIMIT = 50;

    const refreshData = () => {
        startTransition(async () => {
            const [historyData, newStats] = await Promise.all([
                getSMSHistory({ limit: LIMIT, offset: page * LIMIT, status: statusFilter || undefined }),
                getSMSStats(),
            ]);
            setLogs(historyData.logs as unknown as SMSLog[]);
            setTotal(historyData.total);
            setStats(newStats);
        });
    };

    const loadConversations = useCallback(async () => {
        setIsLoadingConversations(true);
        try {
            const data = await getConversations({ limit: 50 });
            setConversations(data.conversations as Conversation[]);
        } catch (error) {
            console.error("Failed to load conversations:", error);
        } finally {
            setIsLoadingConversations(false);
        }
    }, []);

    const loadConversationMessages = useCallback(async (phone: string) => {
        setIsLoadingMessages(true);
        try {
            const data = await getConversationMessages(phone, { limit: 100 });
            setConversationMessages(data.messages as unknown as SMSLog[]);
        } catch (error) {
            console.error("Failed to load messages:", error);
        } finally {
            setIsLoadingMessages(false);
        }
    }, []);

    // Load conversations when tab changes
    useEffect(() => {
        if (activeTab === "conversations") {
            loadConversations();
        }
    }, [activeTab, loadConversations]);

    // Load messages when conversation is selected
    useEffect(() => {
        if (selectedPhone) {
            loadConversationMessages(selectedPhone);
        }
    }, [selectedPhone, loadConversationMessages]);

    // Auto-refresh conversations every 10 seconds
    useEffect(() => {
        if (activeTab === "conversations") {
            const interval = setInterval(() => {
                loadConversations();
                if (selectedPhone) {
                    loadConversationMessages(selectedPhone);
                }
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab, selectedPhone, loadConversations, loadConversationMessages]);

    const handleFilterChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        setPage(0);
        startTransition(async () => {
            const historyData = await getSMSHistory({
                limit: LIMIT,
                offset: 0,
                status: newStatus || undefined,
            });
            setLogs(historyData.logs as unknown as SMSLog[]);
            setTotal(historyData.total);
        });
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        startTransition(async () => {
            const historyData = await getSMSHistory({
                limit: LIMIT,
                offset: newPage * LIMIT,
                status: statusFilter || undefined,
            });
            setLogs(historyData.logs as unknown as SMSLog[]);
            setTotal(historyData.total);
        });
    };

    const handleSendSMS = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber || !message) return;

        setIsSending(true);
        setSendStatus(null);

        try {
            const result = await sendCustomSMS(phoneNumber, message);
            if (result.success) {
                setSendStatus({ type: "success", message: "SMS sent successfully!" });
                setPhoneNumber("");
                setMessage("");
                refreshData();
            } else {
                setSendStatus({ type: "error", message: result.error || "Failed to send SMS" });
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "An error occurred while sending SMS";
            setSendStatus({ type: "error", message: errorMessage });
        } finally {
            setIsSending(false);
        }
    };

    const handleSendChatMessage = async (messageText: string) => {
        if (!selectedPhone) return;

        setIsSendingChat(true);
        try {
            const result = await sendConversationSMS(selectedPhone, messageText);
            if (result.success) {
                // Reload messages
                await loadConversationMessages(selectedPhone);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsSendingChat(false);
        }
    };

    const handleSelectConversation = (phone: string) => {
        setSelectedPhone(phone);
    };

    const handleBackToList = () => {
        setSelectedPhone(null);
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatPhone = (phone: string) => {
        if (phone.startsWith("+1") && phone.length === 12) {
            return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
        }
        return phone;
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
            delivered: { icon: <CheckCircle size={12} />, className: "status-delivered", label: "Delivered" },
            sent: { icon: <CheckCircle size={12} />, className: "status-sent", label: "Sent" },
            queued: { icon: <Clock size={12} />, className: "status-queued", label: "Queued" },
            failed: { icon: <XCircle size={12} />, className: "status-failed", label: "Failed" },
            undelivered: { icon: <AlertCircle size={12} />, className: "status-failed", label: "Undelivered" },
            received: { icon: <MessageCircle size={12} />, className: "status-received", label: "Received" },
        };
        const badge = badges[status] || { icon: <Clock size={12} />, className: "status-queued", label: status };
        return (
            <span className={`status-badge ${badge.className}`}>
                {badge.icon}
                {badge.label}
            </span>
        );
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="sms-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h1>SMS Dashboard</h1>
                        <p>Send and monitor text messages via Twilio</p>
                    </div>
                </div>
                <button onClick={refreshData} className="btn-refresh" disabled={isPending}>
                    <RefreshCw size={16} className={isPending ? "spin" : ""} />
                    Refresh
                </button>
            </header>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === "dashboard" ? "active" : ""}`}
                    onClick={() => setActiveTab("dashboard")}
                >
                    <BarChart3 size={16} />
                    Dashboard
                </button>
                <button
                    className={`tab ${activeTab === "conversations" ? "active" : ""}`}
                    onClick={() => setActiveTab("conversations")}
                >
                    <MessageCircle size={16} />
                    Conversations
                </button>
            </div>

            {activeTab === "dashboard" ? (
                <>
                    {/* Stats Row */}
                    <div className="stats-row">
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-primary">
                                <MessageSquare size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.todayCount}</span>
                                <span className="stat-label">Today</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-success">
                                <TrendingUp size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.monthCount}</span>
                                <span className="stat-label">This Month</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-info">
                                <Calendar size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalSegments}</span>
                                <span className="stat-label">Segments</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-warning">
                                <DollarSign size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">${stats.estimatedCost}</span>
                                <span className="stat-label">Est. Cost</span>
                            </div>
                        </div>
                        {stats.failedCount > 0 && (
                            <div className="stat-card stat-card-danger">
                                <div className="stat-icon stat-icon-danger">
                                    <AlertCircle size={20} />
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{stats.failedCount}</span>
                                    <span className="stat-label">Failed</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="content-grid">
                        {/* Send SMS Form */}
                        <section className="card send-card">
                            <div className="card-header">
                                <Send size={18} />
                                <h2>Send SMS</h2>
                            </div>
                            <form onSubmit={handleSendSMS} className="send-form">
                                <div className="form-group">
                                    <label htmlFor="phone">Phone Number</label>
                                    <div className="input-with-icon">
                                        <Phone size={16} />
                                        <input
                                            type="tel"
                                            id="phone"
                                            placeholder="(555) 123-4567"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="message">Message</label>
                                    <textarea
                                        id="message"
                                        placeholder="Enter your message..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={4}
                                        required
                                    />
                                    <span className="char-count">
                                        {message.length} characters
                                        {message.length > 160 && ` (${Math.ceil(message.length / 160)} segments)`}
                                    </span>
                                </div>
                                {sendStatus && (
                                    <div className={`send-status ${sendStatus.type}`}>
                                        {sendStatus.type === "success" ? (
                                            <CheckCircle size={16} />
                                        ) : (
                                            <AlertCircle size={16} />
                                        )}
                                        {sendStatus.message}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="btn-send"
                                    disabled={isSending || !phoneNumber || !message}
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 size={16} className="spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            Send SMS
                                        </>
                                    )}
                                </button>
                            </form>
                        </section>

                        {/* SMS History */}
                        <section className="card history-card">
                            <div className="card-header">
                                <Clock size={18} />
                                <h2>SMS History</h2>
                                <div className="header-actions">
                                    <div className="filter-dropdown">
                                        <Filter size={14} />
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => handleFilterChange(e.target.value)}
                                        >
                                            <option value="">All Status</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="sent">Sent</option>
                                            <option value="queued">Queued</option>
                                            <option value="failed">Failed</option>
                                            <option value="received">Received</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {logs.length === 0 ? (
                                <div className="empty-state">
                                    <MessageSquare size={48} />
                                    <p>No SMS messages found</p>
                                </div>
                            ) : (
                                <>
                                    <div className="sms-table">
                                        <div className="table-header">
                                            <span>Recipient</span>
                                            <span>Message</span>
                                            <span>Status</span>
                                            <span>Sent By</span>
                                            <span>Date</span>
                                        </div>
                                        {logs.map((log) => (
                                            <div key={log.id} className="table-row">
                                                <div className="recipient-cell">
                                                    <Phone size={14} />
                                                    <span>{formatPhone(log.to)}</span>
                                                    {log.direction === "INBOUND" && (
                                                        <span className="direction-badge inbound">IN</span>
                                                    )}
                                                </div>
                                                <div className="message-cell" title={log.message}>
                                                    {log.message.length > 50
                                                        ? log.message.substring(0, 50) + "..."
                                                        : log.message}
                                                </div>
                                                <div className="status-cell">
                                                    {getStatusBadge(log.status)}
                                                    {log.segments > 1 && (
                                                        <span className="segment-badge">{log.segments} seg</span>
                                                    )}
                                                </div>
                                                <div className="sender-cell">
                                                    <User size={12} />
                                                    <span>{log.sentBy?.name || "System"}</span>
                                                </div>
                                                <div className="date-cell">{formatDate(log.createdAt)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="pagination">
                                            <button
                                                onClick={() => handlePageChange(page - 1)}
                                                disabled={page === 0 || isPending}
                                            >
                                                Previous
                                            </button>
                                            <span className="page-info">
                                                Page {page + 1} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(page + 1)}
                                                disabled={page >= totalPages - 1 || isPending}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                </>
            ) : (
                /* Conversations Tab */
                <div className="conversations-container">
                    <div className={`conversations-sidebar ${selectedPhone ? "hidden-mobile" : ""}`}>
                        <div className="conversations-header">
                            <h2>Conversations</h2>
                            <button
                                onClick={loadConversations}
                                className="refresh-conversations"
                                disabled={isLoadingConversations}
                            >
                                <RefreshCw size={16} className={isLoadingConversations ? "spin" : ""} />
                            </button>
                        </div>
                        {isLoadingConversations && conversations.length === 0 ? (
                            <div className="loading-state">
                                <Loader2 size={24} className="spin" />
                                <p>Loading conversations...</p>
                            </div>
                        ) : (
                            <ConversationList
                                conversations={conversations}
                                selectedPhone={selectedPhone}
                                onSelectConversation={handleSelectConversation}
                            />
                        )}
                    </div>
                    <div className={`chat-container ${!selectedPhone ? "hidden-mobile" : ""}`}>
                        {selectedPhone ? (
                            isLoadingMessages ? (
                                <div className="loading-state chat-loading">
                                    <Loader2 size={24} className="spin" />
                                    <p>Loading messages...</p>
                                </div>
                            ) : (
                                <ChatView
                                    phoneNumber={selectedPhone}
                                    messages={conversationMessages}
                                    onSendMessage={handleSendChatMessage}
                                    onBack={handleBackToList}
                                    isSending={isSendingChat}
                                />
                            )
                        ) : (
                            <div className="no-conversation-selected">
                                <MessageCircle size={64} />
                                <h3>Select a conversation</h3>
                                <p>Choose a conversation from the list to start messaging</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .sms-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
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
                    margin-bottom: 0.25rem;
                }

                .page-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .btn-refresh {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-refresh:hover:not(:disabled) {
                    background: var(--bg-hover);
                }

                .btn-refresh:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* Tabs */
                .tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 0;
                }

                .tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: none;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                    margin-bottom: -1px;
                }

                .tab:hover {
                    color: var(--text-primary);
                }

                .tab.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                }

                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                }

                .stat-card-danger {
                    border-color: var(--danger-border);
                    background: linear-gradient(135deg, var(--bg-card) 0%, var(--danger-bg) 100%);
                }

                .stat-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-icon-primary {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .stat-icon-success {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .stat-icon-info {
                    background: var(--info-bg);
                    color: var(--info);
                }

                .stat-icon-warning {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .stat-icon-danger {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .content-grid {
                    display: grid;
                    grid-template-columns: 360px 1fr;
                    gap: 1.5rem;
                }

                .card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                    color: var(--primary);
                }

                .card-header h2 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    flex: 1;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .filter-dropdown {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                }

                .filter-dropdown select {
                    padding: 0.5rem 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    cursor: pointer;
                }

                /* Send Form */
                .send-form {
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

                .input-with-icon {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-with-icon :global(svg) {
                    position: absolute;
                    left: 0.875rem;
                    color: var(--text-muted);
                }

                .input-with-icon input {
                    width: 100%;
                    padding: 0.75rem 0.875rem 0.75rem 2.5rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .input-with-icon input:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px var(--primary-soft);
                }

                .form-group textarea {
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    resize: vertical;
                    font-family: inherit;
                }

                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px var(--primary-soft);
                }

                .char-count {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-align: right;
                }

                .send-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border-radius: var(--radius-md);
                    font-size: 0.8125rem;
                }

                .send-status.success {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .send-status.error {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .btn-send {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.875rem;
                    background: var(--primary);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-send:hover:not(:disabled) {
                    background: var(--primary-hover);
                }

                .btn-send:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* SMS Table */
                .sms-table {
                    display: flex;
                    flex-direction: column;
                }

                .table-header,
                .table-row {
                    display: grid;
                    grid-template-columns: 160px 1fr 120px 120px 100px;
                    gap: 1rem;
                    align-items: center;
                    padding: 0.875rem 1rem;
                }

                .table-header {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .table-row {
                    border-bottom: 1px solid var(--border);
                }

                .table-row:last-child {
                    border-bottom: none;
                }

                .recipient-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-primary);
                    font-weight: 500;
                }

                .recipient-cell :global(svg) {
                    color: var(--text-muted);
                }

                .direction-badge {
                    font-size: 0.5625rem;
                    font-weight: 700;
                    padding: 0.125rem 0.375rem;
                    border-radius: 9999px;
                    text-transform: uppercase;
                }

                .direction-badge.inbound {
                    background: var(--info-bg);
                    color: var(--info);
                }

                .message-cell {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .status-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-delivered,
                .status-sent {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .status-queued {
                    background: var(--info-bg);
                    color: var(--info);
                }

                .status-failed {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .status-received {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .segment-badge {
                    padding: 0.125rem 0.375rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-sm);
                    font-size: 0.625rem;
                    color: var(--text-muted);
                }

                .sender-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }

                .date-cell {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem 0;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 1rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }

                .pagination {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }

                .pagination button {
                    padding: 0.5rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8125rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .pagination button:hover:not(:disabled) {
                    background: var(--bg-hover);
                }

                .pagination button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-info {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }

                /* Conversations Tab */
                .conversations-container {
                    display: grid;
                    grid-template-columns: 360px 1fr;
                    gap: 0;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    height: calc(100vh - 280px);
                    min-height: 500px;
                }

                .conversations-sidebar {
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .conversations-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                }

                .conversations-header h2 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .refresh-conversations {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 0.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .refresh-conversations:hover {
                    color: var(--primary);
                }

                .chat-container {
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--text-muted);
                    gap: 1rem;
                }

                .chat-loading {
                    flex: 1;
                }

                .no-conversation-selected {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    text-align: center;
                    color: var(--text-muted);
                }

                .no-conversation-selected :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 1rem;
                }

                .no-conversation-selected h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .no-conversation-selected p {
                    font-size: 0.875rem;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (max-width: 1024px) {
                    .content-grid {
                        grid-template-columns: 1fr;
                    }

                    .table-header,
                    .table-row {
                        grid-template-columns: 1fr 1fr;
                        gap: 0.5rem;
                    }

                    .table-header span:nth-child(n + 3),
                    .message-cell,
                    .sender-cell,
                    .date-cell {
                        display: none;
                    }

                    .status-cell {
                        justify-content: flex-end;
                    }

                    .conversations-container {
                        grid-template-columns: 1fr;
                    }

                    .conversations-sidebar.hidden-mobile {
                        display: none;
                    }

                    .chat-container.hidden-mobile {
                        display: none;
                    }
                }

                @media (max-width: 640px) {
                    .stats-row {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>
        </div>
    );
}

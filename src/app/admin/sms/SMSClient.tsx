"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { sendCustomSMS, getSMSHistory, getSMSStats } from "@/lib/twilioActions";

interface SMSLog {
    id: string;
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

interface Props {
    initialLogs: SMSLog[];
    totalLogs: number;
    initialStats: SMSStats;
}

export default function SMSClient({ initialLogs, totalLogs, initialStats }: Props) {
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
        } catch (error) {
            setSendStatus({ type: "error", message: "An error occurred while sending SMS" });
        } finally {
            setIsSending(false);
        }
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
                                {sendStatus.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                {sendStatus.message}
                            </div>
                        )}
                        <button type="submit" className="btn-send" disabled={isSending || !phoneNumber || !message}>
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
                                <select value={statusFilter} onChange={(e) => handleFilterChange(e.target.value)}>
                                    <option value="">All Status</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="sent">Sent</option>
                                    <option value="queued">Queued</option>
                                    <option value="failed">Failed</option>
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
                                        </div>
                                        <div className="message-cell" title={log.message}>
                                            {log.message.length > 50 ? log.message.substring(0, 50) + "..." : log.message}
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
                    margin-bottom: 2rem;
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
                    grid-template-columns: 140px 1fr 120px 120px 100px;
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

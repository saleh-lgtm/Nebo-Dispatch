"use client";

import { useState, useTransition } from "react";
import {
    Bell,
    CheckCheck,
    X,
    ArrowRight,
    RefreshCw,
    Clock,
    Calendar,
    ClipboardList,
    BookOpen,
    AlertCircle,
    Trash2,
} from "lucide-react";
import {
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllReadNotifications,
} from "@/lib/notificationActions";
import { NotificationType } from "@prisma/client";
import { useRouter } from "next/navigation";

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    actionUrl: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
}

interface Props {
    initialNotifications: Notification[];
}

export default function NotificationPanel({ initialNotifications }: Props) {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState<"all" | "unread">("all");

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    const filteredNotifications =
        filter === "all" ? notifications : notifications.filter((n) => !n.isRead);

    const handleNotificationClick = async (notification: Notification) => {
        startTransition(async () => {
            if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, isRead: true, readAt: new Date() } : n
                    )
                );
            }

            if (notification.actionUrl) {
                router.push(notification.actionUrl);
            }
        });
    };

    const handleMarkAllRead = async () => {
        startTransition(async () => {
            await markAllNotificationsAsRead();
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
            );
        });
    };

    const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation();
        startTransition(async () => {
            await deleteNotification(notificationId);
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        });
    };

    const handleClearRead = async () => {
        startTransition(async () => {
            await deleteAllReadNotifications();
            setNotifications((prev) => prev.filter((n) => !n.isRead));
        });
    };

    const getNotificationIcon = (type: NotificationType) => {
        switch (type) {
            case "SHIFT_SWAP_REQUEST":
            case "SHIFT_SWAP_RESPONSE":
            case "SHIFT_SWAP_APPROVED":
            case "SHIFT_SWAP_REJECTED":
                return <RefreshCw size={16} />;
            case "TIME_OFF_APPROVED":
            case "TIME_OFF_REJECTED":
                return <Calendar size={16} />;
            case "TASK_ASSIGNED":
            case "TASK_DUE_SOON":
                return <ClipboardList size={16} />;
            case "SCHEDULE_PUBLISHED":
                return <Clock size={16} />;
            case "SOP_REQUIRES_ACK":
                return <BookOpen size={16} />;
            default:
                return <AlertCircle size={16} />;
        }
    };

    const getNotificationColor = (type: NotificationType) => {
        switch (type) {
            case "SHIFT_SWAP_APPROVED":
            case "TIME_OFF_APPROVED":
                return "var(--success)";
            case "SHIFT_SWAP_REJECTED":
            case "TIME_OFF_REJECTED":
                return "var(--danger)";
            case "TASK_ASSIGNED":
            case "TASK_DUE_SOON":
                return "var(--warning)";
            case "SHIFT_SWAP_REQUEST":
            case "SHIFT_SWAP_RESPONSE":
                return "var(--info)";
            default:
                return "var(--primary)";
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    if (notifications.length === 0) {
        return null; // Don't show panel if no notifications
    }

    return (
        <div className="notification-panel">
            <div className="panel-header">
                <div className="header-left">
                    <Bell size={18} className="header-icon" />
                    <h3>Notifications</h3>
                    {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                </div>
                <div className="header-actions">
                    <div className="filter-tabs">
                        <button
                            className={`filter-btn ${filter === "all" ? "active" : ""}`}
                            onClick={() => setFilter("all")}
                        >
                            All
                        </button>
                        <button
                            className={`filter-btn ${filter === "unread" ? "active" : ""}`}
                            onClick={() => setFilter("unread")}
                        >
                            Unread
                        </button>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="action-btn"
                            disabled={isPending}
                            title="Mark all as read"
                        >
                            <CheckCheck size={16} />
                        </button>
                    )}
                    {notifications.some((n) => n.isRead) && (
                        <button
                            onClick={handleClearRead}
                            className="action-btn"
                            disabled={isPending}
                            title="Clear read notifications"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="notifications-list">
                {filteredNotifications.length === 0 ? (
                    <div className="empty-state">
                        <p>No {filter === "unread" ? "unread " : ""}notifications</p>
                    </div>
                ) : (
                    filteredNotifications.slice(0, 5).map((notification) => (
                        <div
                            key={notification.id}
                            className={`notification-item ${notification.isRead ? "read" : "unread"}`}
                            onClick={() => handleNotificationClick(notification)}
                        >
                            <div
                                className="notification-icon"
                                style={{ background: `${getNotificationColor(notification.type)}20`, color: getNotificationColor(notification.type) }}
                            >
                                {getNotificationIcon(notification.type)}
                            </div>
                            <div className="notification-content">
                                <div className="notification-title">{notification.title}</div>
                                <div className="notification-message">{notification.message}</div>
                                <div className="notification-time">
                                    {formatTime(notification.createdAt)}
                                </div>
                            </div>
                            <div className="notification-actions">
                                {notification.actionUrl && (
                                    <ArrowRight size={14} className="arrow-icon" />
                                )}
                                <button
                                    className="delete-btn"
                                    onClick={(e) => handleDeleteNotification(e, notification.id)}
                                    title="Delete"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            {!notification.isRead && <div className="unread-dot" />}
                        </div>
                    ))
                )}
            </div>

            {filteredNotifications.length > 5 && (
                <div className="panel-footer">
                    <button onClick={() => router.push("/notifications")}>
                        View all {filteredNotifications.length} notifications
                    </button>
                </div>
            )}

            <style jsx>{`
                .notification-panel {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--border);
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                }

                .header-left h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .header-left :global(.header-icon) {
                    color: var(--primary);
                }

                .unread-badge {
                    padding: 0.125rem 0.5rem;
                    background: var(--danger);
                    color: white;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    border-radius: 9999px;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .filter-tabs {
                    display: flex;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    padding: 2px;
                }

                .filter-btn {
                    padding: 0.375rem 0.75rem;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    border-radius: var(--radius-sm);
                    transition: all 0.15s;
                }

                .filter-btn.active {
                    background: var(--bg-primary);
                    color: var(--text-primary);
                }

                .filter-btn:hover:not(.active) {
                    color: var(--text-primary);
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .action-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .notifications-list {
                    max-height: 320px;
                    overflow-y: auto;
                }

                .empty-state {
                    padding: 2rem 1rem;
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }

                .notification-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    padding: 1rem 1.25rem;
                    cursor: pointer;
                    transition: background 0.15s;
                    position: relative;
                    border-bottom: 1px solid var(--border);
                }

                .notification-item:last-child {
                    border-bottom: none;
                }

                .notification-item:hover {
                    background: var(--bg-hover);
                }

                .notification-item.unread {
                    background: var(--primary-soft);
                }

                .notification-item.unread:hover {
                    background: rgba(59, 130, 246, 0.12);
                }

                .notification-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-md);
                    flex-shrink: 0;
                }

                .notification-content {
                    flex: 1;
                    min-width: 0;
                }

                .notification-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.125rem;
                }

                .notification-message {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .notification-time {
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                    margin-top: 0.375rem;
                }

                .notification-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .arrow-icon {
                    color: var(--text-muted);
                }

                .delete-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    border-radius: var(--radius-sm);
                    opacity: 0;
                    transition: all 0.15s;
                }

                .notification-item:hover .delete-btn {
                    opacity: 1;
                }

                .delete-btn:hover {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .unread-dot {
                    position: absolute;
                    left: 6px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 6px;
                    height: 6px;
                    background: var(--primary);
                    border-radius: 50%;
                }

                .panel-footer {
                    padding: 0.75rem 1.25rem;
                    border-top: 1px solid var(--border);
                }

                .panel-footer button {
                    width: 100%;
                    padding: 0.625rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .panel-footer button:hover {
                    background: var(--bg-hover);
                    border-color: var(--border-hover);
                }
            `}</style>
        </div>
    );
}

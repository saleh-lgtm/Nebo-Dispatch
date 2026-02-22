"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
    Bell,
    Check,
    CheckCheck,
    X,
    ArrowRight,
    RefreshCw,
    Clock,
    Calendar,
    ClipboardList,
    BookOpen,
    AlertCircle,
} from "lucide-react";
import {
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
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

export default function NotificationBell() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPending, startTransition] = useTransition();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            const [notifs, count] = await Promise.all([
                getMyNotifications({ limit: 20 }),
                getUnreadNotificationCount(),
            ]);
            setNotifications(notifs);
            setUnreadCount(count);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        fetchNotifications();

        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);

        return () => clearInterval(interval);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotificationClick = async (notification: Notification) => {
        startTransition(async () => {
            if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, isRead: true, readAt: new Date() } : n
                    )
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }

            if (notification.actionUrl) {
                router.push(notification.actionUrl);
                setIsOpen(false);
            }
        });
    };

    const handleMarkAllRead = async () => {
        startTransition(async () => {
            await markAllNotificationsAsRead();
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
            );
            setUnreadCount(0);
        });
    };

    const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation();
        startTransition(async () => {
            await deleteNotification(notificationId);
            const deleted = notifications.find((n) => n.id === notificationId);
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
            if (deleted && !deleted.isRead) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
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
        return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    return (
        <div className="notification-bell" ref={dropdownRef}>
            <button
                className="bell-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="dropdown">
                    <div className="dropdown-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="mark-all-btn"
                                disabled={isPending}
                            >
                                <CheckCheck size={14} />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="notifications-list">
                        {notifications.length === 0 ? (
                            <div className="empty-state">
                                <Bell size={32} />
                                <p>No notifications</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${notification.isRead ? "read" : "unread"}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div
                                        className="notification-icon"
                                        style={{ color: getNotificationColor(notification.type) }}
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

                    {notifications.length > 0 && (
                        <div className="dropdown-footer">
                            <button onClick={() => { router.push("/notifications"); setIsOpen(false); }}>
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .notification-bell {
                    position: relative;
                }

                .bell-button {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .bell-button:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                    border-color: var(--border-hover);
                }

                .badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    background: var(--danger);
                    color: white;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    border-radius: 9999px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    width: 360px;
                    max-height: 480px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                    overflow: hidden;
                    animation: dropdownIn 0.2s ease;
                }

                @keyframes dropdownIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .dropdown-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--border);
                }

                .dropdown-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .mark-all-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.75rem;
                    background: transparent;
                    border: none;
                    color: var(--primary);
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    border-radius: var(--radius-md);
                    transition: background 0.15s;
                }

                .mark-all-btn:hover {
                    background: var(--primary-soft);
                }

                .mark-all-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .notifications-list {
                    max-height: 360px;
                    overflow-y: auto;
                }

                .empty-state {
                    padding: 3rem 1rem;
                    text-align: center;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                    margin-bottom: 0.75rem;
                }

                .empty-state p {
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
                    background: rgba(59, 130, 246, 0.15);
                }

                .notification-icon {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    flex-shrink: 0;
                }

                .notification-content {
                    flex: 1;
                    min-width: 0;
                }

                .notification-title {
                    font-size: 0.8125rem;
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

                .dropdown-footer {
                    padding: 0.75rem 1.25rem;
                    border-top: 1px solid var(--border);
                }

                .dropdown-footer button {
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

                .dropdown-footer button:hover {
                    background: var(--bg-hover);
                    border-color: var(--border-hover);
                }

                @media (max-width: 480px) {
                    .dropdown {
                        position: fixed;
                        top: auto;
                        right: 0;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        max-height: 70vh;
                        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                    }
                }
            `}</style>
        </div>
    );
}

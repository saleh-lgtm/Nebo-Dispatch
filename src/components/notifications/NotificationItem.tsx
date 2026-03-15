"use client";

import { X, ArrowRight } from "lucide-react";
import { Notification, getNotificationIcon, formatNotificationTime } from "./types";
import styles from "./NotificationItem.module.css";

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: Notification) => void;
  loading?: boolean;
}

export default function NotificationItem({
  notification,
  onRead,
  onDelete,
  onClick,
  loading = false,
}: NotificationItemProps) {
  const iconConfig = getNotificationIcon(notification.type);
  const Icon = iconConfig.icon;

  const handleClick = () => {
    if (!notification.isRead && onRead) {
      onRead(notification.id);
    }
    onClick?.(notification);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(notification.id);
  };

  return (
    <div
      className={`${styles.item} ${notification.isRead ? styles.read : styles.unread}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div
        className={styles.icon}
        style={{ background: iconConfig.bg, color: iconConfig.color }}
      >
        <Icon size={16} />
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.title}>{notification.title}</span>
          <span className={styles.time}>
            {formatNotificationTime(notification.createdAt)}
          </span>
        </div>
        <p className={styles.message}>{notification.message}</p>
      </div>

      <div className={styles.actions}>
        {notification.actionUrl && (
          <div className={styles.arrow}>
            <ArrowRight size={14} />
          </div>
        )}
        {onDelete && (
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={loading}
            type="button"
            aria-label="Delete notification"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!notification.isRead && <div className={styles.unreadDot} />}
    </div>
  );
}

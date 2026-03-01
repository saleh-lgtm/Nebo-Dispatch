"use client";

import { useState } from "react";
import { Bell, Pin, Check, Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import { acknowledgeAnnouncement } from "@/lib/notesActions";
import type { AnnouncementWithStatus } from "@/types/note";
import styles from "./AnnouncementsCard.module.css";

interface Props {
    announcements: AnnouncementWithStatus[];
    unacknowledgedCount: number;
}

export default function AnnouncementsCard({
    announcements,
    unacknowledgedCount,
}: Props) {
    const [acknowledging, setAcknowledging] = useState<string | null>(null);
    const [localAnnouncements, setLocalAnnouncements] =
        useState(announcements);
    const [localUnacknowledgedCount, setLocalUnacknowledgedCount] =
        useState(unacknowledgedCount);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleAcknowledge = async (id: string) => {
        setAcknowledging(id);
        try {
            await acknowledgeAnnouncement(id);
            setLocalAnnouncements((prev) =>
                prev.map((a) =>
                    a.id === id
                        ? {
                              ...a,
                              readStatus: {
                                  ...a.readStatus,
                                  isRead: true,
                                  isAcknowledged: true,
                                  acknowledgedAt: new Date(),
                              },
                          }
                        : a
                )
            );
            setLocalUnacknowledgedCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Failed to acknowledge:", error);
        } finally {
            setAcknowledging(null);
        }
    };

    const formatDate = (date: Date) =>
        new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Bell size={18} className={styles.headerIcon} />
                    <h3 className={styles.title}>Company Announcements</h3>
                </div>
                {localUnacknowledgedCount > 0 && (
                    <span className={styles.badge}>
                        {localUnacknowledgedCount} new
                    </span>
                )}
            </div>

            <div className={styles.list}>
                {localAnnouncements.length > 0 ? (
                    localAnnouncements.slice(0, 5).map((announcement) => (
                        <div
                            key={announcement.id}
                            className={`${styles.item} ${
                                announcement.isPinned ? styles.pinned : ""
                            } ${
                                !announcement.readStatus.isAcknowledged
                                    ? styles.unread
                                    : ""
                            }`}
                        >
                            <div className={styles.itemHeader}>
                                {announcement.isPinned && (
                                    <Pin size={12} className={styles.pinIcon} />
                                )}
                                <h4 className={styles.itemTitle}>
                                    {announcement.title}
                                </h4>
                            </div>

                            <div className={styles.contentWrapper}>
                                <p className={styles.itemContent}>
                                    {expandedIds.has(announcement.id) || announcement.content.length <= 150
                                        ? announcement.content
                                        : `${announcement.content.slice(0, 150)}...`}
                                </p>
                                {announcement.content.length > 150 && (
                                    <button
                                        onClick={() => toggleExpand(announcement.id)}
                                        className={styles.expandButton}
                                        type="button"
                                    >
                                        {expandedIds.has(announcement.id) ? (
                                            <>
                                                <ChevronUp size={14} />
                                                Show less
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown size={14} />
                                                Read more
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            <div className={styles.itemFooter}>
                                <div className={styles.meta}>
                                    <span>
                                        <User size={10} />{" "}
                                        {announcement.author.name}
                                    </span>
                                    <span>
                                        <Clock size={10} />{" "}
                                        {formatDate(announcement.createdAt)}
                                    </span>
                                </div>

                                {!announcement.readStatus.isAcknowledged ? (
                                    <button
                                        onClick={() =>
                                            handleAcknowledge(announcement.id)
                                        }
                                        disabled={
                                            acknowledging === announcement.id
                                        }
                                        className={styles.ackButton}
                                    >
                                        {acknowledging === announcement.id ? (
                                            "..."
                                        ) : (
                                            <>
                                                <Check size={12} />
                                                Acknowledge
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <span className={styles.acknowledged}>
                                        <Check size={12} /> Acknowledged
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.empty}>
                        <Bell size={32} />
                        <p>No announcements</p>
                    </div>
                )}
            </div>
        </div>
    );
}

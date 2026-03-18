"use client";

import { useState } from "react";
import { MessageSquare, X, Clock, User } from "lucide-react";
import styles from "./HandoffNoteBanner.module.css";

interface HandoffNote {
    id: string;
    handoffNotes: string;
    authorName: string;
    submittedAt: Date | string;
}

interface Props {
    handoffNote: HandoffNote;
}

const DISMISSED_KEY_PREFIX = "handoff-note-dismissed-";

function isDismissed(noteId: string): boolean {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(`${DISMISSED_KEY_PREFIX}${noteId}`) === "true";
}

export default function HandoffNoteBanner({ handoffNote }: Props) {
    const [dismissed, setDismissed] = useState(() => isDismissed(handoffNote.id));

    if (dismissed) return null;

    const handleDismiss = () => {
        sessionStorage.setItem(`${DISMISSED_KEY_PREFIX}${handoffNote.id}`, "true");
        setDismissed(true);
    };

    const submittedAt = new Date(handoffNote.submittedAt);
    const timeStr = submittedAt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });

    return (
        <div className={styles.banner}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.icon}>
                        <MessageSquare size={18} />
                    </div>
                    <div className={styles.meta}>
                        <span className={styles.title}>Shift Handoff</span>
                        <span className={styles.info}>
                            <User size={12} />
                            {handoffNote.authorName}
                            <span className={styles.separator}>·</span>
                            <Clock size={12} />
                            {timeStr}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className={styles.dismissBtn}
                    title="Mark as read"
                >
                    <X size={16} />
                    <span>Mark as Read</span>
                </button>
            </div>
            <p className={styles.content}>{handoffNote.handoffNotes}</p>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Send, Users, MessageSquare, AlertTriangle, CheckCircle } from "lucide-react";
import { getTags } from "@/lib/tagActions";
import { previewBlastSMS, sendBlastSMS } from "@/lib/blastSMSActions";
import styles from "../contacts/Contacts.module.css";

interface TagData {
    id: string;
    name: string;
    color: string;
    _count: { assignments: number };
}

interface Recipient {
    id: string;
    name: string;
    phone: string | null;
    company: string | null;
}

interface BlastResult {
    total: number;
    successful: number;
    failed: number;
}

// Calculate message segments (SMS character limits)
function calculateSegments(message: string): { segments: number; remaining: number } {
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const charsPerSegment = hasUnicode ? 70 : 160;
    const multiSegmentLimit = hasUnicode ? 67 : 153;

    if (message.length <= charsPerSegment) {
        return { segments: 1, remaining: charsPerSegment - message.length };
    }

    const segments = Math.ceil(message.length / multiSegmentLimit);
    const remaining = (segments * multiSegmentLimit) - message.length;
    return { segments, remaining };
}

export default function BlastSMS() {
    const [tags, setTags] = useState<TagData[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<BlastResult | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        try {
            const data = await getTags();
            setTags(data as TagData[]);
        } catch (err) {
            console.error("Failed to load tags:", err);
        }
    };

    const handleTagToggle = (tagId: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagId)
                ? prev.filter((id) => id !== tagId)
                : [...prev, tagId]
        );
        setShowPreview(false);
        setResult(null);
    };

    const handlePreview = async () => {
        if (selectedTags.length === 0) {
            setError("Select at least one tag");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const data = await previewBlastSMS(selectedTags);
            setRecipients(data.recipients as Recipient[]);
            setShowPreview(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to preview recipients");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!message.trim()) {
            setError("Message is required");
            return;
        }

        if (recipients.length === 0) {
            setError("No recipients to send to");
            return;
        }

        if (!confirm(`Send this message to ${recipients.length} contact(s)?`)) {
            return;
        }

        setSending(true);
        setError("");

        try {
            const data = await sendBlastSMS({
                tagIds: selectedTags,
                message: message.trim(),
            });
            setResult({
                total: data.total,
                successful: data.successful,
                failed: data.failed,
            });
            setMessage("");
            setSelectedTags([]);
            setShowPreview(false);
            setRecipients([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send blast");
        } finally {
            setSending(false);
        }
    };

    const { segments, remaining } = calculateSegments(message);
    const isMultiSegment = segments > 1;

    return (
        <div className={styles.blastContainer}>
            {/* Tag Selection */}
            <div className={styles.blastSection}>
                <h3 className={styles.blastSectionTitle}>
                    <Users size={16} style={{ marginRight: "0.5rem" }} />
                    Select Tags
                </h3>
                {tags.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyStateText}>
                            No tags available. Create tags in Admin &gt; Contacts first.
                        </p>
                    </div>
                ) : (
                    <div className={styles.blastTagGrid}>
                        {tags.map((tag) => {
                            const isSelected = selectedTags.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => handleTagToggle(tag.id)}
                                    className={`${styles.blastTagItem} ${isSelected ? styles.blastTagItemSelected : ""}`}
                                    style={
                                        isSelected
                                            ? {
                                                  backgroundColor: `${tag.color}20`,
                                                  borderColor: tag.color,
                                              }
                                            : undefined
                                    }
                                >
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            backgroundColor: tag.color,
                                        }}
                                    />
                                    <span>{tag.name}</span>
                                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                        ({tag._count.assignments})
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Message Composer */}
            <div className={styles.blastSection}>
                <h3 className={styles.blastSectionTitle}>
                    <MessageSquare size={16} style={{ marginRight: "0.5rem" }} />
                    Message
                </h3>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={styles.blastMessageArea}
                    placeholder="Type your message here..."
                    maxLength={1600}
                />
                <div className={styles.blastMessageInfo}>
                    <span>
                        {message.length} / 1600 characters
                    </span>
                    <span className={isMultiSegment ? styles.blastMessageWarning : ""}>
                        {segments} segment{segments !== 1 ? "s" : ""} ({remaining} chars remaining)
                        {isMultiSegment && " - Multi-segment messages cost more"}
                    </span>
                </div>
            </div>

            {/* Preview Button */}
            {selectedTags.length > 0 && !showPreview && (
                <button
                    type="button"
                    onClick={handlePreview}
                    className="btn btn-secondary"
                    disabled={loading}
                >
                    <Users size={16} />
                    {loading ? "Loading..." : "Preview Recipients"}
                </button>
            )}

            {/* Recipients Preview */}
            {showPreview && (
                <div className={styles.blastSection}>
                    <div className={styles.blastPreview}>
                        <div className={styles.blastPreviewCount}>{recipients.length}</div>
                        <div className={styles.blastPreviewLabel}>
                            Contact{recipients.length !== 1 ? "s" : ""} will receive this message
                        </div>
                        {recipients.length > 0 && (
                            <div className={styles.blastRecipientsList}>
                                {recipients.slice(0, 10).map((r) => (
                                    <div key={r.id} className={styles.blastRecipient}>
                                        <span className={styles.blastRecipientName}>
                                            {r.name}
                                            {r.company && (
                                                <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                                                    {" "}- {r.company}
                                                </span>
                                            )}
                                        </span>
                                        <span className={styles.blastRecipientPhone}>{r.phone}</span>
                                    </div>
                                ))}
                                {recipients.length > 10 && (
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>
                                        ... and {recipients.length - 10} more
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem",
                        background: "var(--danger-soft)",
                        borderRadius: "8px",
                        color: "var(--danger)",
                        fontSize: "0.875rem",
                    }}
                >
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {/* Result */}
            {result && (
                <div
                    className={`${styles.blastResults} ${result.failed > 0 ? styles.blastResultsError : styles.blastResultsSuccess}`}
                >
                    <div className={styles.blastResultsTitle}>
                        <CheckCircle size={18} style={{ marginRight: "0.5rem" }} />
                        Blast Sent
                    </div>
                    <div className={styles.blastResultsStats}>
                        <span>Total: {result.total}</span>
                        <span style={{ color: "var(--success)" }}>Successful: {result.successful}</span>
                        {result.failed > 0 && (
                            <span style={{ color: "var(--danger)" }}>Failed: {result.failed}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Send Button */}
            {showPreview && recipients.length > 0 && (
                <div className={styles.blastActions}>
                    <button
                        type="button"
                        onClick={() => {
                            setShowPreview(false);
                            setRecipients([]);
                        }}
                        className="btn btn-secondary"
                        disabled={sending}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        className="btn btn-primary"
                        disabled={sending || !message.trim()}
                    >
                        <Send size={16} />
                        {sending ? "Sending..." : `Send to ${recipients.length} Contact${recipients.length !== 1 ? "s" : ""}`}
                    </button>
                </div>
            )}
        </div>
    );
}

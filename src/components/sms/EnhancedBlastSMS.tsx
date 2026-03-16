"use client";

import { useState } from "react";
import {
    Send,
    MessageSquare,
    Users,
    CheckCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
} from "lucide-react";
import RecipientSelector from "./BlastRecipientSelector";
import { sendEnhancedBlastSMS, type EnhancedBlastResult } from "@/lib/blastSMSActions";
import styles from "../contacts/Contacts.module.css";

type Step = "select" | "compose" | "confirm";

// Calculate message segments (SMS character limits)
function calculateSegments(message: string): { segments: number; remaining: number } {
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const charsPerSegment = hasUnicode ? 70 : 160;
    const multiSegmentLimit = hasUnicode ? 67 : 153;

    if (message.length <= charsPerSegment) {
        return { segments: 1, remaining: charsPerSegment - message.length };
    }

    const segments = Math.ceil(message.length / multiSegmentLimit);
    const remaining = segments * multiSegmentLimit - message.length;
    return { segments, remaining };
}

export default function EnhancedBlastSMS() {
    const [step, setStep] = useState<Step>("select");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<EnhancedBlastResult | null>(null);
    const [error, setError] = useState("");

    const { segments, remaining } = calculateSegments(message);
    const isMultiSegment = segments > 1;

    const selectedContacts = selectedIds.filter((id) => id.startsWith("contact_")).length;
    const selectedAffiliates = selectedIds.filter((id) => id.startsWith("affiliate_")).length;

    const handleNext = () => {
        if (step === "select") {
            if (selectedIds.length === 0) {
                setError("Please select at least one recipient");
                return;
            }
            setError("");
            setStep("compose");
        } else if (step === "compose") {
            if (!message.trim()) {
                setError("Please enter a message");
                return;
            }
            setError("");
            setStep("confirm");
        }
    };

    const handleBack = () => {
        setError("");
        if (step === "compose") {
            setStep("select");
        } else if (step === "confirm") {
            setStep("compose");
        }
    };

    const handleSend = async () => {
        if (!confirm(`Send this message to ${selectedIds.length} recipient(s)?`)) {
            return;
        }

        setSending(true);
        setError("");

        try {
            const result = await sendEnhancedBlastSMS({
                selectedIds,
                message: message.trim(),
            });
            if (!result.success) {
                throw new Error(result.error || "Failed to send blast");
            }
            setResult(result.data ?? null);
            // Reset form
            setSelectedIds([]);
            setMessage("");
            setStep("select");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send blast");
        } finally {
            setSending(false);
        }
    };

    const handleReset = () => {
        setResult(null);
        setError("");
    };

    return (
        <div className={styles.blastContainer}>
            {/* Step Indicator */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                }}
            >
                <StepIndicator
                    number={1}
                    label="Select Recipients"
                    active={step === "select"}
                    completed={step !== "select"}
                />
                <div
                    style={{
                        flex: 1,
                        height: 2,
                        background:
                            step === "select" ? "var(--border)" : "var(--primary)",
                    }}
                />
                <StepIndicator
                    number={2}
                    label="Compose"
                    active={step === "compose"}
                    completed={step === "confirm"}
                />
                <div
                    style={{
                        flex: 1,
                        height: 2,
                        background:
                            step === "confirm" ? "var(--primary)" : "var(--border)",
                    }}
                />
                <StepIndicator
                    number={3}
                    label="Send"
                    active={step === "confirm"}
                    completed={false}
                />
            </div>

            {/* Result Message */}
            {result && (
                <div
                    className={`${styles.blastResults} ${result.failed > 0 ? styles.blastResultsError : styles.blastResultsSuccess}`}
                >
                    <div className={styles.blastResultsTitle}>
                        <CheckCircle size={18} style={{ marginRight: "0.5rem" }} />
                        Blast Sent Successfully
                    </div>
                    <div className={styles.blastResultsStats}>
                        <span>Total: {result.total}</span>
                        <span style={{ color: "var(--success)" }}>
                            Successful: {result.successful}
                        </span>
                        {result.failed > 0 && (
                            <span style={{ color: "var(--danger)" }}>
                                Failed: {result.failed}
                            </span>
                        )}
                    </div>
                    <div
                        style={{
                            marginTop: "0.5rem",
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                        }}
                    >
                        {result.contactCount} contacts, {result.affiliateCount} affiliates
                    </div>
                    <button
                        type="button"
                        onClick={handleReset}
                        className="btn btn-secondary"
                        style={{ marginTop: "1rem" }}
                    >
                        Send Another Blast
                    </button>
                </div>
            )}

            {/* Step Content */}
            {!result && (
                <>
                    {step === "select" && (
                        <div className={styles.blastSection}>
                            <h3 className={styles.blastSectionTitle}>
                                <Users size={16} style={{ marginRight: "0.5rem" }} />
                                Select Recipients
                            </h3>
                            <RecipientSelector
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                            />
                        </div>
                    )}

                    {step === "compose" && (
                        <div className={styles.blastSection}>
                            <h3 className={styles.blastSectionTitle}>
                                <MessageSquare size={16} style={{ marginRight: "0.5rem" }} />
                                Compose Message
                            </h3>
                            <div className={styles.blastPreview} style={{ marginBottom: "1rem" }}>
                                <div className={styles.blastPreviewCount}>
                                    {selectedIds.length}
                                </div>
                                <div className={styles.blastPreviewLabel}>
                                    recipient{selectedIds.length !== 1 ? "s" : ""} selected
                                    <span style={{ marginLeft: "0.5rem" }}>
                                        ({selectedContacts} contacts, {selectedAffiliates}{" "}
                                        affiliates)
                                    </span>
                                </div>
                            </div>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className={styles.blastMessageArea}
                                placeholder="Type your message here..."
                                maxLength={1600}
                                autoFocus
                            />
                            <div className={styles.blastMessageInfo}>
                                <span>{message.length} / 1600 characters</span>
                                <span className={isMultiSegment ? styles.blastMessageWarning : ""}>
                                    {segments} segment{segments !== 1 ? "s" : ""} ({remaining}{" "}
                                    chars remaining)
                                    {isMultiSegment && " - Multi-segment messages cost more"}
                                </span>
                            </div>
                        </div>
                    )}

                    {step === "confirm" && (
                        <div className={styles.blastSection}>
                            <h3 className={styles.blastSectionTitle}>
                                <Send size={16} style={{ marginRight: "0.5rem" }} />
                                Review & Send
                            </h3>
                            <div
                                style={{
                                    padding: "1.5rem",
                                    background: "var(--bg-muted)",
                                    borderRadius: "8px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "1rem",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "var(--text-secondary)",
                                                marginBottom: "0.25rem",
                                            }}
                                        >
                                            Recipients
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "1.25rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {selectedIds.length}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "var(--text-secondary)",
                                            }}
                                        >
                                            {selectedContacts} contacts, {selectedAffiliates}{" "}
                                            affiliates
                                        </div>
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "var(--text-secondary)",
                                                marginBottom: "0.25rem",
                                            }}
                                        >
                                            Message Segments
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "1.25rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {segments}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "var(--text-secondary)",
                                            }}
                                        >
                                            ~${(selectedIds.length * segments * 0.0079).toFixed(2)}{" "}
                                            est. cost
                                        </div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        padding: "1rem",
                                        background: "var(--bg-card)",
                                        borderRadius: "6px",
                                        border: "1px solid var(--border)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-secondary)",
                                            marginBottom: "0.5rem",
                                        }}
                                    >
                                        Message Preview
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.875rem",
                                            color: "var(--text-primary)",
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {message}
                                    </div>
                                </div>
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

                    {/* Navigation */}
                    <div className={styles.blastActions}>
                        {step !== "select" && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="btn btn-secondary"
                                disabled={sending}
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        )}
                        {step !== "confirm" ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="btn btn-primary"
                            >
                                Next
                                <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSend}
                                className="btn btn-primary"
                                disabled={sending}
                            >
                                <Send size={16} />
                                {sending
                                    ? "Sending..."
                                    : `Send to ${selectedIds.length} Recipient${selectedIds.length !== 1 ? "s" : ""}`}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// Step indicator component
function StepIndicator({
    number,
    label,
    active,
    completed,
}: {
    number: number;
    label: string;
    active: boolean;
    completed: boolean;
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.25rem",
            }}
        >
            <div
                style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: active
                        ? "var(--primary)"
                        : completed
                          ? "var(--primary)"
                          : "var(--bg-secondary)",
                    color: active || completed ? "white" : "var(--text-secondary)",
                    border: `2px solid ${active || completed ? "var(--primary)" : "var(--border)"}`,
                }}
            >
                {completed ? <CheckCircle size={14} /> : number}
            </div>
            <span
                style={{
                    fontSize: "0.7rem",
                    color: active ? "var(--primary)" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
        </div>
    );
}

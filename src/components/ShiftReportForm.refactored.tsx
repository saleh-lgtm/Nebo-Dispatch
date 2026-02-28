"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ClipboardCheck, Send, Clock, Phone, Bookmark, TrendingUp, Cloud, CloudOff, Save, RefreshCw } from "lucide-react";
import { toggleTask, saveShiftReport, saveShiftReportDraft, deleteShiftReportDraft, type ShiftReportDraft } from "@/lib/actions";
import { createQuote } from "@/lib/quoteActions";
import { useAutoSave } from "@/hooks/useAutoSave";

// Import extracted components
import {
    MetricCard,
    ReservationSection,
    RetailLeadsSection,
    NarrativeSection,
    TasksChecklist,
    QuotesSection,
} from "./shift-report";
import type { QuoteFormData } from "./shift-report";

// Import shared types
import type {
    ReservationEntry,
    RetailLeadEntry,
    Quote,
    Metrics,
    Narrative,
    ShiftTask,
    ActiveShift,
    Session,
} from "@/types/shift-report";

// Import CSS Module
import styles from "./shift-report/ShiftReport.module.css";

interface ShiftReportProps {
    session: Session;
    activeShift: ActiveShift;
    initialTasks: ShiftTask[];
    initialQuotes?: Quote[];
    initialDraft?: ShiftReportDraft | null;
}

export default function ShiftReportForm({
    session,
    activeShift,
    initialTasks,
    initialQuotes = [],
    initialDraft,
}: ShiftReportProps) {
    // Form state
    const [accepted, setAccepted] = useState<ReservationEntry[]>(initialDraft?.accepted || []);
    const [modified, setModified] = useState<ReservationEntry[]>(initialDraft?.modified || []);
    const [cancelled, setCancelled] = useState<ReservationEntry[]>(initialDraft?.cancelled || []);
    const [retailLeads, setRetailLeads] = useState<RetailLeadEntry[]>(initialDraft?.retailLeads || []);
    const [handoffNotes, setHandoffNotes] = useState(initialDraft?.handoffNotes || "");
    const [metrics, setMetrics] = useState<Metrics>(
        initialDraft?.metrics || {
            calls: 0,
            emails: 0,
            totalReservationsHandled: 0,
        }
    );
    const [narrative, setNarrative] = useState<Narrative>(
        initialDraft?.narrative || {
            comments: "",
            incidents: "",
            ideas: "",
        }
    );
    const [tasks, setTasks] = useState<ShiftTask[]>(initialTasks || []);
    const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDraftRecovery, setShowDraftRecovery] = useState(false);
    const [draftDecisionMade, setDraftDecisionMade] = useState(!!initialDraft);

    // Combine all form data for auto-save
    const formData = useMemo<ShiftReportDraft>(
        () => ({
            shiftId: activeShift?.id || "",
            accepted,
            modified,
            cancelled,
            retailLeads,
            handoffNotes,
            metrics,
            narrative,
        }),
        [activeShift?.id, accepted, modified, cancelled, retailLeads, handoffNotes, metrics, narrative]
    );

    // Server save handler
    const handleServerSave = useCallback(
        async (data: ShiftReportDraft) => {
            if (!activeShift?.id) return;
            try {
                await saveShiftReportDraft(data);
            } catch (error) {
                console.error("Failed to save draft to server:", error);
            }
        },
        [activeShift?.id]
    );

    // Auto-save hook
    const { state: saveState, restoreDraft, clearDraft } = useAutoSave({
        storageKey: `shift-report-draft-${activeShift?.id || "unknown"}`,
        data: formData,
        debounceMs: 1500,
        serverSaveIntervalMs: 30000,
        onServerSave: handleServerSave,
        enabled: !!activeShift?.id,
    });

    // Check for draft on mount
    useEffect(() => {
        if (saveState.hasDraft && !initialDraft && !draftDecisionMade) {
            setShowDraftRecovery(true);
        }
    }, [saveState.hasDraft, initialDraft, draftDecisionMade]);

    // Handle draft restoration
    const handleRestoreDraft = useCallback(() => {
        const draft = restoreDraft();
        if (draft) {
            setAccepted(draft.accepted || []);
            setModified(draft.modified || []);
            setCancelled(draft.cancelled || []);
            setRetailLeads(draft.retailLeads || []);
            setHandoffNotes(draft.handoffNotes || "");
            setMetrics(draft.metrics || { calls: 0, emails: 0, totalReservationsHandled: 0 });
            setNarrative(draft.narrative || { comments: "", incidents: "", ideas: "" });
        }
        setDraftDecisionMade(true);
        setShowDraftRecovery(false);
    }, [restoreDraft]);

    const handleDiscardDraft = useCallback(() => {
        clearDraft();
        setDraftDecisionMade(true);
        setShowDraftRecovery(false);
    }, [clearDraft]);

    // Reservation handlers
    const addReservation = (type: "accepted" | "modified" | "cancelled") => {
        const entry: ReservationEntry = { id: "", notes: "" };
        switch (type) {
            case "accepted":
                setAccepted((prev) => [...prev, entry]);
                break;
            case "modified":
                setModified((prev) => [...prev, entry]);
                break;
            case "cancelled":
                setCancelled((prev) => [...prev, entry]);
                break;
        }
    };

    const updateReservation = (
        type: "accepted" | "modified" | "cancelled",
        index: number,
        field: keyof ReservationEntry,
        value: string | boolean
    ) => {
        const setter = type === "accepted" ? setAccepted : type === "modified" ? setModified : setCancelled;
        setter((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const removeReservation = (type: "accepted" | "modified" | "cancelled", index: number) => {
        const setter = type === "accepted" ? setAccepted : type === "modified" ? setModified : setCancelled;
        setter((prev) => prev.filter((_, i) => i !== index));
    };

    // Task handler
    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        setTasks(tasks.map((t) => (t.id === taskId ? { ...t, isCompleted: !currentStatus } : t)));
        await toggleTask(taskId, !currentStatus);
    };

    // Quote handler
    const handleAddQuote = async (quoteData: QuoteFormData) => {
        try {
            const newQuote = await createQuote({
                ...quoteData,
                shiftId: activeShift.id,
            });
            const quoteForDisplay: Quote = {
                id: newQuote.id,
                clientName: newQuote.clientName,
                clientEmail: newQuote.clientEmail,
                clientPhone: newQuote.clientPhone,
                serviceType: newQuote.serviceType,
                estimatedAmount: newQuote.estimatedAmount,
                notes: newQuote.notes,
                status: newQuote.status,
                createdBy: { id: session.user.id, name: session.user.name || null },
            };
            setQuotes([...quotes, quoteForDisplay]);
        } catch (e) {
            console.error(e);
        }
    };

    // Retail leads handlers
    const handleAddRetailLead = () => {
        setRetailLeads([...retailLeads, { serviceRequested: "", outcome: "WON" }]);
    };

    const handleUpdateRetailLead = (index: number, updates: Partial<RetailLeadEntry>) => {
        setRetailLeads(retailLeads.map((lead, i) => (i === index ? { ...lead, ...updates } : lead)));
    };

    const handleRemoveRetailLead = (index: number) => {
        setRetailLeads(retailLeads.filter((_, i) => i !== index));
    };

    // Submit handler
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Collect flagged reservations
            const flaggedReservations: Array<{
                reservationType: "accepted" | "modified" | "cancelled";
                reservationId: string;
                reservationNotes?: string;
                flagReason?: string;
            }> = [];

            accepted
                .filter((r) => r.flaggedForAccounting && r.id)
                .forEach((r) => {
                    flaggedReservations.push({
                        reservationType: "accepted",
                        reservationId: r.id,
                        reservationNotes: r.notes,
                        flagReason: r.flagReason,
                    });
                });

            modified
                .filter((r) => r.flaggedForAccounting && r.id)
                .forEach((r) => {
                    flaggedReservations.push({
                        reservationType: "modified",
                        reservationId: r.id,
                        reservationNotes: r.notes,
                        flagReason: r.flagReason,
                    });
                });

            cancelled
                .filter((r) => r.flaggedForAccounting && r.id)
                .forEach((r) => {
                    flaggedReservations.push({
                        reservationType: "cancelled",
                        reservationId: r.id,
                        reservationNotes: r.notes,
                        flagReason: r.flagReason,
                    });
                });

            const data = {
                shiftId: activeShift.id,
                userId: session.user.id,
                callsReceived: metrics.calls,
                emailsSent: metrics.emails,
                quotesGiven: quotes.length,
                totalReservationsHandled: metrics.totalReservationsHandled,
                generalComments: narrative.comments || undefined,
                incidents: narrative.incidents || undefined,
                newIdeas: narrative.ideas || undefined,
                handoffNotes: handoffNotes || undefined,
                acceptedReservations: accepted.length > 0 ? accepted : undefined,
                modifiedReservations: modified.length > 0 ? modified : undefined,
                cancelledReservations: cancelled.length > 0 ? cancelled : undefined,
                flaggedReservations: flaggedReservations.length > 0 ? flaggedReservations : undefined,
                retailLeads: retailLeads.length > 0 ? retailLeads : undefined,
                clockOut: true,
            };

            await saveShiftReport(data);

            // Clear draft after successful submission
            clearDraft();
            try {
                await deleteShiftReportDraft(activeShift.id);
            } catch {
                // Ignore draft deletion errors
            }

            window.location.href = "/dashboard";
        } catch (error) {
            console.error("Failed to save shift report:", error);
            setIsSubmitting(false);
            alert("Failed to submit shift report. Please try again.");
        }
    };

    // Format the last saved time
    const formatLastSaved = (date: Date | null) => {
        if (!date) return "";
        return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };

    return (
        <div className={styles.reportPage}>
            {/* Draft Recovery Modal */}
            {showDraftRecovery && (
                <DraftRecoveryModal onRestore={handleRestoreDraft} onDiscard={handleDiscardDraft} />
            )}

            {/* Header */}
            <ReportHeader
                saveState={saveState}
                formatLastSaved={formatLastSaved}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
            />

            <div className={styles.reportLayout}>
                <main className={styles.reportMain}>
                    {/* Communication Metrics */}
                    <section className={styles.reportCard}>
                        <div className={styles.cardHeader}>
                            <div className={`${styles.cardIcon} ${styles.cardIconBlue}`}>
                                <Phone size={18} />
                            </div>
                            <h2 className={styles.cardTitle}>Communication</h2>
                        </div>
                        <div className={styles.metricsRow}>
                            <MetricCard
                                label="Calls Received"
                                value={metrics.calls}
                                onChange={(v) => setMetrics({ ...metrics, calls: v })}
                                icon={<Phone size={20} />}
                                color="blue"
                            />
                            <MetricCard
                                label="Emails Sent"
                                value={metrics.emails}
                                onChange={(v) => setMetrics({ ...metrics, emails: v })}
                                icon={<Phone size={20} />}
                                color="purple"
                            />
                        </div>
                    </section>

                    {/* Quotes */}
                    <QuotesSection quotes={quotes} onAddQuote={handleAddQuote} />

                    {/* Reservations */}
                    <section className={styles.reportCard}>
                        <div className={styles.cardHeader}>
                            <div className={`${styles.cardIcon} ${styles.cardIconAmber}`}>
                                <Bookmark size={18} />
                            </div>
                            <h2 className={styles.cardTitle}>Reservations</h2>
                        </div>
                        <div className={styles.metricsRow} style={{ marginBottom: "1.5rem" }}>
                            <MetricCard
                                label="Total Handled"
                                value={metrics.totalReservationsHandled}
                                onChange={(v) => setMetrics({ ...metrics, totalReservationsHandled: v })}
                                icon={<TrendingUp size={20} />}
                                color="amber"
                            />
                        </div>
                        <div className={styles.reservationsGrid}>
                            <ReservationSection
                                title="Accepted"
                                data={accepted}
                                onAdd={() => addReservation("accepted")}
                                onUpdate={(i, f, v) => updateReservation("accepted", i, f, v)}
                                onRemove={(i) => removeReservation("accepted", i)}
                                color="green"
                            />
                            <ReservationSection
                                title="Modified"
                                data={modified}
                                onAdd={() => addReservation("modified")}
                                onUpdate={(i, f, v) => updateReservation("modified", i, f, v)}
                                onRemove={(i) => removeReservation("modified", i)}
                                color="blue"
                            />
                            <ReservationSection
                                title="Cancelled"
                                data={cancelled}
                                onAdd={() => addReservation("cancelled")}
                                onUpdate={(i, f, v) => updateReservation("cancelled", i, f, v)}
                                onRemove={(i) => removeReservation("cancelled", i)}
                                color="red"
                            />
                        </div>
                    </section>

                    {/* Retail Leads */}
                    <RetailLeadsSection
                        leads={retailLeads}
                        onAdd={handleAddRetailLead}
                        onUpdate={handleUpdateRetailLead}
                        onRemove={handleRemoveRetailLead}
                    />

                    {/* Narrative */}
                    <NarrativeSection
                        narrative={narrative}
                        handoffNotes={handoffNotes}
                        onNarrativeChange={setNarrative}
                        onHandoffNotesChange={setHandoffNotes}
                    />
                </main>

                {/* Sidebar */}
                <aside className={styles.reportSidebar}>
                    <TasksChecklist tasks={tasks} onToggleTask={handleToggleTask} />

                    {/* Mobile Submit */}
                    <div className={styles.mobileSubmit}>
                        <button onClick={handleSubmit} className={`${styles.submitBtn} ${styles.submitBtnFull}`} disabled={isSubmitting}>
                            {isSubmitting ? <span className={styles.spinner} /> : <Send size={18} />}
                            <span>{isSubmitting ? "Submitting..." : "Finalize & Clock Out"}</span>
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}

// Sub-components

interface DraftRecoveryModalProps {
    onRestore: () => void;
    onDiscard: () => void;
}

function DraftRecoveryModal({ onRestore, onDiscard }: DraftRecoveryModalProps) {
    return (
        <div className={styles.draftRecoveryOverlay}>
            <div className={styles.draftRecoveryModal}>
                <div className={styles.draftRecoveryIcon}>
                    <RefreshCw size={32} />
                </div>
                <h3 className={styles.draftRecoveryTitle}>Unsaved Work Found</h3>
                <p className={styles.draftRecoveryText}>We found a previous draft of your shift report. Would you like to restore it?</p>
                <div className={styles.draftRecoveryActions}>
                    <button onClick={onDiscard} className={styles.discardBtn}>
                        Start Fresh
                    </button>
                    <button onClick={onRestore} className={styles.restoreBtn}>
                        Restore Draft
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ReportHeaderProps {
    saveState: {
        status: string;
        lastSaved: Date | null;
        hasUnsavedChanges: boolean;
    };
    formatLastSaved: (date: Date | null) => string;
    isSubmitting: boolean;
    onSubmit: () => void;
}

function ReportHeader({ saveState, formatLastSaved, isSubmitting, onSubmit }: ReportHeaderProps) {
    const getSaveStatusClass = () => {
        const base = styles.saveStatus;
        switch (saveState.status) {
            case "saving": return `${base} ${styles.saveStatusSaving}`;
            case "saved": return `${base} ${styles.saveStatusSaved}`;
            case "error": return `${base} ${styles.saveStatusError}`;
            default: return base;
        }
    };

    return (
        <header className={styles.reportHeader}>
            <div className={styles.headerContent}>
                <div className={styles.headerIcon}>
                    <ClipboardCheck size={24} />
                </div>
                <div>
                    <h1 className={styles.headerTitle}>Shift Report</h1>
                    <p className={styles.headerSubtitle}>
                        <Clock size={14} />
                        <span>
                            {new Date().toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                    </p>
                </div>
            </div>
            <div className={styles.headerActions}>
                <div className={getSaveStatusClass()}>
                    {saveState.status === "saving" && (
                        <>
                            <Cloud size={16} className={styles.pulse} />
                            <span>Saving...</span>
                        </>
                    )}
                    {saveState.status === "saved" && (
                        <>
                            <Cloud size={16} />
                            <span>Saved {formatLastSaved(saveState.lastSaved)}</span>
                        </>
                    )}
                    {saveState.status === "error" && (
                        <>
                            <CloudOff size={16} />
                            <span>Save failed</span>
                        </>
                    )}
                    {saveState.status === "idle" && saveState.hasUnsavedChanges && (
                        <>
                            <Save size={16} />
                            <span>Unsaved changes</span>
                        </>
                    )}
                </div>
                <button onClick={onSubmit} className={styles.submitBtn} disabled={isSubmitting}>
                    {isSubmitting ? <span className={styles.spinner} /> : <Send size={18} />}
                    <span>{isSubmitting ? "Submitting..." : "Finalize & Clock Out"}</span>
                </button>
            </div>
        </header>
    );
}

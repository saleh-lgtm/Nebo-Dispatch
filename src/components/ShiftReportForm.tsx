"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ClipboardCheck, Send, AlertCircle, Bookmark, Phone, Mail, FileText, TrendingUp, Clock, X, DollarSign, User, Cloud, CloudOff, RefreshCw, StickyNote, Bell } from "lucide-react";
import { toggleTask, saveShiftReport, saveShiftReportDraft, deleteShiftReportDraft, type ShiftReportDraft } from "@/lib/actions";
import { createQuote } from "@/lib/domains/quotes";
import { createBillingReviews } from "@/lib/billingReviewActions";
import { useAutoSave } from "@/hooks/useAutoSave";
import AffiliateAuditSection, { type AffiliateAuditEntry } from "./shift-report/AffiliateAuditSection";
import BillingReviewSection, { type BillingReviewEntry } from "./shift-report/BillingReviewSection";
import MetricCard from "./shift-report/MetricCard";
import ReservationSection from "./shift-report/ReservationSection";
import RetailLeadsSection from "./shift-report/RetailLeadsSection";
import NarrativeSection from "./shift-report/NarrativeSection";
import TasksChecklist from "./shift-report/TasksChecklist";
import { BillingReviewReason } from "@prisma/client";

interface ReservationEntry {
    id: string;
    notes: string;
    flaggedForAccounting?: boolean;
    flagReason?: string;
}

type RetailLeadOutcome = "WON" | "NEEDS_FOLLOW_UP" | "LOST";
type LostReason = "VEHICLE_TYPE" | "AVAILABILITY" | "PRICING" | "OTHER";

interface RetailLeadEntry {
    serviceRequested: string;
    outcome: RetailLeadOutcome;
    lostReason?: LostReason;
    lostReasonOther?: string;
    notes?: string;
}

interface Quote {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceType: string;
    estimatedAmount: number | null;
    notes: string | null;
    status: string;
    createdBy: { id: string; name: string | null };
}

interface Metrics {
    calls: number;
    emails: number;
    totalReservationsHandled: number;
}

interface Narrative {
    comments: string;
    incidents: string;
    ideas: string;
}

interface ShiftTask {
    id: string;
    content: string;
    isCompleted: boolean;
    isAdminTask?: boolean;
    assignedById?: string | null;
    priority?: number | null;
}

interface ActiveShift {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    userId: string;
}

interface Session {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        role: string;
    };
}

interface Props {
    session: Session;
    activeShift: ActiveShift;
    initialTasks: ShiftTask[];
    initialQuotes?: Quote[];
    initialDraft?: ShiftReportDraft | null;
    notesCreated?: number;
    announcementsRead?: number;
    initialAffiliateAudits?: AffiliateAuditEntry[];
}

export default function ShiftReportPage({ session, activeShift, initialTasks, initialQuotes = [], initialDraft, notesCreated = 0, announcementsRead = 0, initialAffiliateAudits = [] }: Props) {
    const router = useRouter();
    const [accepted, setAccepted] = useState<ReservationEntry[]>(initialDraft?.accepted || []);
    const [modified, setModified] = useState<ReservationEntry[]>(initialDraft?.modified || []);
    const [cancelled, setCancelled] = useState<ReservationEntry[]>(initialDraft?.cancelled || []);
    const [retailLeads, setRetailLeads] = useState<RetailLeadEntry[]>(initialDraft?.retailLeads || []);
    const [affiliateAudits, setAffiliateAudits] = useState<AffiliateAuditEntry[]>(
        initialDraft?.affiliateAudits || initialAffiliateAudits
    );
    const [billingReviews, setBillingReviews] = useState<BillingReviewEntry[]>(
        (initialDraft?.billingReviews || []).map((r: { tripNumber: string; reason: string; passengerName?: string; tripDate?: string; reasonOther?: string; amount?: number; notes?: string }) => ({ ...r, reason: r.reason as BillingReviewReason }))
    );
    const [handoffNotes, setHandoffNotes] = useState(initialDraft?.handoffNotes || "");
    const [metrics, setMetrics] = useState<Metrics>(initialDraft?.metrics || {
        calls: 0,
        emails: 0,
        totalReservationsHandled: 0
    });
    const [narrative, setNarrative] = useState<Narrative>(initialDraft?.narrative || {
        comments: "",
        incidents: "",
        ideas: ""
    });
    const [tasks, setTasks] = useState(initialTasks || []);
    const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showDraftRecovery, setShowDraftRecovery] = useState(false);
    const [draftDecisionMade, setDraftDecisionMade] = useState(!!initialDraft);

    // Combine all form data for auto-save
    const formData = useMemo<ShiftReportDraft>(() => ({
        shiftId: activeShift?.id || "",
        accepted,
        modified,
        cancelled,
        retailLeads,
        billingReviews,
        affiliateAudits,
        handoffNotes,
        metrics,
        narrative,
    }), [activeShift?.id, accepted, modified, cancelled, retailLeads, billingReviews, affiliateAudits, handoffNotes, metrics, narrative]);

    // Server save handler
    const handleServerSave = useCallback(async (data: ShiftReportDraft) => {
        if (!activeShift?.id) return;
        try {
            await saveShiftReportDraft(data);
        } catch (error) {
            console.error("Failed to save draft to server:", error);
        }
    }, [activeShift?.id]);

    // Auto-save hook - silent mode enabled by default (no visual notifications)
    const { state: saveState, restoreDraft, clearDraft, dismissDraft } = useAutoSave({
        storageKey: `shift-report-draft-${activeShift?.id || "unknown"}`,
        data: formData,
        debounceMs: 3000,
        serverSaveIntervalMs: 60000,
        onServerSave: handleServerSave,
        enabled: !!activeShift?.id,
        silentMode: true, // Don't show saving/saved notifications
    });

    // Check for draft on mount (only if user hasn't already made a decision)
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
            setBillingReviews((draft.billingReviews || []).map(r => ({ ...r, reason: r.reason as BillingReviewReason })));
            setAffiliateAudits(draft.affiliateAudits || initialAffiliateAudits);
            setHandoffNotes(draft.handoffNotes || "");
            setMetrics(draft.metrics || { calls: 0, emails: 0, totalReservationsHandled: 0 });
            setNarrative(draft.narrative || { comments: "", incidents: "", ideas: "" });
        }
        setDraftDecisionMade(true);
        setShowDraftRecovery(false);
    }, [restoreDraft, initialAffiliateAudits]);

    const handleDiscardDraft = useCallback(() => {
        dismissDraft(); // Use dismissDraft to mark as dismissed for this session
        setDraftDecisionMade(true);
        setShowDraftRecovery(false);
    }, [dismissDraft]);

    const addReservation = (setter: React.Dispatch<React.SetStateAction<ReservationEntry[]>>) => {
        setter((prev) => [...prev, { id: "", notes: "" }]);
    };

    const updateReservation = (setter: React.Dispatch<React.SetStateAction<ReservationEntry[]>>, index: number, field: string, value: string | boolean) => {
        setter((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const removeReservation = (setter: React.Dispatch<React.SetStateAction<ReservationEntry[]>>, index: number) => {
        setter((prev) => prev.filter((_, i) => i !== index));
    };

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        setTasks(tasks.map((t) => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTask(taskId, !currentStatus);
    };

    const handleAddQuote = async (quoteData: {
        clientName: string;
        clientEmail?: string;
        clientPhone?: string;
        serviceType: string;
        estimatedAmount?: number;
        notes?: string;
    }) => {
        try {
            const newQuote = await createQuote({
                ...quoteData,
                shiftId: activeShift.id,
            });
            // Add to local state with minimal required fields
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
            setShowQuoteModal(false);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Collect flagged reservations from all categories
            const flaggedReservations: Array<{
                reservationType: "accepted" | "modified" | "cancelled";
                reservationId: string;
                reservationNotes?: string;
                flagReason?: string;
            }> = [];

            accepted.filter(r => r.flaggedForAccounting && r.id).forEach(r => {
                flaggedReservations.push({
                    reservationType: "accepted",
                    reservationId: r.id,
                    reservationNotes: r.notes,
                    flagReason: r.flagReason,
                });
            });

            modified.filter(r => r.flaggedForAccounting && r.id).forEach(r => {
                flaggedReservations.push({
                    reservationType: "modified",
                    reservationId: r.id,
                    reservationNotes: r.notes,
                    flagReason: r.flagReason,
                });
            });

            cancelled.filter(r => r.flaggedForAccounting && r.id).forEach(r => {
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
                clockOut: true
            };

            const result = await saveShiftReport(data);

            if (!result?.success) {
                throw new Error("Failed to save shift report");
            }

            // Save billing reviews if any
            if (billingReviews.length > 0) {
                const validReviews = billingReviews.filter(r => r.tripNumber.trim());
                if (validReviews.length > 0) {
                    const brResult = await createBillingReviews(
                        validReviews.map(r => ({
                            tripNumber: r.tripNumber,
                            passengerName: r.passengerName,
                            tripDate: r.tripDate ? new Date(r.tripDate) : undefined,
                            reason: r.reason,
                            reasonOther: r.reasonOther,
                            amount: r.amount,
                            notes: r.notes,
                        })),
                        activeShift.id
                    );
                    if (!brResult.success) {
                        console.error("Failed to save billing reviews:", brResult.error);
                    }
                }
            }

            // Clear draft after successful submission
            clearDraft();
            try {
                await deleteShiftReportDraft(activeShift.id);
            } catch {
                // Ignore draft deletion errors
            }

            // Use Next.js router for proper navigation
            router.push("/dashboard?submitted=true");
        } catch (error) {
            console.error("Failed to save shift report:", error);
            setIsSubmitting(false);
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : "Failed to submit shift report. Please try again."
            );
            // Auto-clear error after 8 seconds
            setTimeout(() => setSubmitError(null), 8000);
        }
    };


    // Format the last saved time
    const formatLastSaved = (date: Date | null) => {
        if (!date) return "";
        return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };

    return (
        <div className="report-page">
            {/* Draft Recovery Modal */}
            {showDraftRecovery && (
                <div className="draft-recovery-overlay">
                    <div className="draft-recovery-modal">
                        <div className="draft-recovery-icon">
                            <RefreshCw size={32} />
                        </div>
                        <h3>Unsaved Work Found</h3>
                        <p>We found a previous draft of your shift report. Would you like to restore it?</p>
                        <div className="draft-recovery-actions">
                            <button onClick={handleDiscardDraft} className="discard-btn">
                                Start Fresh
                            </button>
                            <button onClick={handleRestoreDraft} className="restore-btn">
                                Restore Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="report-header">
                <div className="header-content">
                    <div className="header-icon">
                        <ClipboardCheck size={24} />
                    </div>
                    <div>
                        <h1 className="header-title">Shift Report</h1>
                        <p className="header-subtitle">
                            <Clock size={14} />
                            <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                        </p>
                    </div>
                </div>
                <div className="header-actions">
                    {/* Save Status Indicator - Only shows errors or last saved time on hover */}
                    <div className={`save-status ${saveState.status}`} title={saveState.lastSaved ? `Last saved: ${formatLastSaved(saveState.lastSaved)}` : undefined}>
                        {saveState.status === "error" && (
                            <>
                                <CloudOff size={16} />
                                <span>Save failed</span>
                            </>
                        )}
                        {saveState.status !== "error" && saveState.lastSaved && (
                            <>
                                <Cloud size={16} />
                                <span className="save-status-subtle">Auto-saved</span>
                            </>
                        )}
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="submit-btn"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="spinner" />
                        ) : (
                            <Send size={18} />
                        )}
                        <span>{isSubmitting ? "Submitting..." : "Finalize & Clock Out"}</span>
                    </button>
                </div>

                {/* Submit Error Toast */}
                {submitError && (
                    <div className="submit-error-toast" role="alert">
                        <AlertCircle size={18} />
                        <span>{submitError}</span>
                        <button onClick={() => setSubmitError(null)} className="error-dismiss" aria-label="Dismiss">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </header>

            <div className="report-layout">
                <main className="report-main">
                    {/* Communication Metrics */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-blue">
                                <Phone size={18} />
                            </div>
                            <h2 className="card-title">Communication</h2>
                        </div>
                        <div className="metrics-row">
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
                                icon={<Mail size={20} />}
                                color="purple"
                            />
                        </div>
                    </section>

                    {/* Notes & Announcements - Read-only metrics */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-amber">
                                <StickyNote size={18} />
                            </div>
                            <h2 className="card-title">Notes & Announcements</h2>
                        </div>
                        <div className="metrics-row">
                            <div className="readonly-metric">
                                <div className="readonly-metric-icon" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                                    <StickyNote size={20} />
                                </div>
                                <div className="readonly-metric-info">
                                    <span className="readonly-metric-value">{notesCreated}</span>
                                    <span className="readonly-metric-label">Notes Created</span>
                                </div>
                            </div>
                            <div className="readonly-metric">
                                <div className="readonly-metric-icon" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                                    <Bell size={20} />
                                </div>
                                <div className="readonly-metric-info">
                                    <span className="readonly-metric-value">{announcementsRead}</span>
                                    <span className="readonly-metric-label">Announcements Acknowledged</span>
                                </div>
                            </div>
                        </div>
                        <p className="metrics-hint">These counts are tracked automatically when you create shift notes or acknowledge announcements on the dashboard.</p>
                    </section>

                    {/* Quotes */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-green">
                                <FileText size={18} />
                            </div>
                            <h2 className="card-title">Quotes</h2>
                            <span className="quote-count">{quotes.length}</span>
                            <button
                                onClick={() => setShowQuoteModal(true)}
                                className="add-quote-btn"
                            >
                                <Plus size={16} />
                                Add Quote
                            </button>
                        </div>

                        {quotes.length === 0 ? (
                            <div className="empty-quotes">
                                <FileText size={32} />
                                <p>No quotes created during this shift</p>
                                <button
                                    onClick={() => setShowQuoteModal(true)}
                                    className="add-quote-btn-large"
                                >
                                    <Plus size={18} />
                                    Create First Quote
                                </button>
                            </div>
                        ) : (
                            <div className="quotes-list">
                                {quotes.map((quote) => (
                                    <div key={quote.id} className="quote-item">
                                        <div className="quote-item-header">
                                            <div className="quote-client">
                                                <User size={14} />
                                                <span>{quote.clientName}</span>
                                            </div>
                                            {quote.estimatedAmount && (
                                                <span className="quote-amount">
                                                    <DollarSign size={12} />
                                                    {quote.estimatedAmount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="quote-details">
                                            <span className="quote-service">{quote.serviceType}</span>
                                            {quote.clientPhone && (
                                                <span className="quote-contact">
                                                    <Phone size={12} />
                                                    {quote.clientPhone}
                                                </span>
                                            )}
                                            {quote.clientEmail && (
                                                <span className="quote-contact">
                                                    <Mail size={12} />
                                                    {quote.clientEmail}
                                                </span>
                                            )}
                                        </div>
                                        {quote.notes && (
                                            <p className="quote-notes">{quote.notes}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Reservation Handling */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-amber">
                                <Bookmark size={18} />
                            </div>
                            <h2 className="card-title">Reservations</h2>
                        </div>
                        <div className="metrics-row" style={{ marginBottom: "1.5rem" }}>
                            <MetricCard
                                label="Total Handled"
                                value={metrics.totalReservationsHandled}
                                onChange={(v) => setMetrics({ ...metrics, totalReservationsHandled: v })}
                                icon={<TrendingUp size={20} />}
                                color="amber"
                            />
                        </div>
                        <div className="reservations-grid">
                            <ReservationSection
                                title="Accepted"
                                data={accepted}
                                onAdd={() => addReservation(setAccepted)}
                                onUpdate={(index, field, value) => updateReservation(setAccepted, index, field, value)}
                                onRemove={(index) => removeReservation(setAccepted, index)}
                                color="green"
                            />
                            <ReservationSection
                                title="Modified"
                                data={modified}
                                onAdd={() => addReservation(setModified)}
                                onUpdate={(index, field, value) => updateReservation(setModified, index, field, value)}
                                onRemove={(index) => removeReservation(setModified, index)}
                                color="blue"
                            />
                            <ReservationSection
                                title="Cancelled"
                                data={cancelled}
                                onAdd={() => addReservation(setCancelled)}
                                onUpdate={(index, field, value) => updateReservation(setCancelled, index, field, value)}
                                onRemove={(index) => removeReservation(setCancelled, index)}
                                color="red"
                            />
                        </div>
                    </section>

                    {/* Retail Calls Section */}
                    <RetailLeadsSection
                        leads={retailLeads}
                        onAdd={() => setRetailLeads([...retailLeads, { serviceRequested: "", outcome: "WON" }])}
                        onUpdate={(index, updates) => {
                            const updated = [...retailLeads];
                            updated[index] = { ...updated[index], ...updates };
                            setRetailLeads(updated);
                        }}
                        onRemove={(index) => setRetailLeads(retailLeads.filter((_, i) => i !== index))}
                    />

                    {/* Billing Review Section */}
                    <BillingReviewSection
                        reviews={billingReviews}
                        onAdd={() => setBillingReviews([...billingReviews, { tripNumber: "", reason: "EXTRA_WAITING_TIME" as const }])}
                        onUpdate={(index, updates) => {
                            const updated = [...billingReviews];
                            updated[index] = { ...updated[index], ...updates };
                            setBillingReviews(updated);
                        }}
                        onRemove={(index) => setBillingReviews(billingReviews.filter((_, i) => i !== index))}
                    />

                    {/* Affiliate Audit Section */}
                    <AffiliateAuditSection
                        audits={affiliateAudits}
                        onUpdate={(index, updates) => {
                            const updated = [...affiliateAudits];
                            updated[index] = { ...updated[index], ...updates };
                            setAffiliateAudits(updated);
                        }}
                    />

                    {/* Notes Section */}
                    <NarrativeSection
                        narrative={narrative}
                        handoffNotes={handoffNotes}
                        onNarrativeChange={setNarrative}
                        onHandoffNotesChange={setHandoffNotes}
                    />
                </main>

                {/* Sidebar */}
                <aside className="report-sidebar">
                    <TasksChecklist
                        tasks={tasks}
                        onToggleTask={handleToggleTask}
                    />

                    {/* Mobile Submit */}
                    <div className="mobile-submit">
                        <button
                            onClick={handleSubmit}
                            className="submit-btn submit-btn-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <span className="spinner" /> : <Send size={18} />}
                            <span>{isSubmitting ? "Submitting..." : "Finalize & Clock Out"}</span>
                        </button>
                    </div>
                </aside>
            </div>

            {/* Add Quote Modal */}
            {showQuoteModal && (
                <AddQuoteModal
                    onClose={() => setShowQuoteModal(false)}
                    onSubmit={handleAddQuote}
                />
            )}

            <style jsx>{`
                .report-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                    position: relative;
                }

                .submit-error-toast {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    color: #f87171;
                    font-size: 0.875rem;
                    animation: slideDown 0.2s ease;
                    z-index: 100;
                    max-width: 400px;
                }

                .submit-error-toast .error-dismiss {
                    background: none;
                    border: none;
                    color: #f87171;
                    cursor: pointer;
                    padding: 0.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                    transition: opacity 0.15s;
                }

                .submit-error-toast .error-dismiss:hover {
                    opacity: 1;
                }

                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, var(--accent) 0%, #d4a853 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #1a1a2e;
                }

                .header-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .header-subtitle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                /* Save Status Indicator */
                .save-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .save-status.saving {
                    color: #60a5fa;
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.2);
                }

                .save-status.saved {
                    color: #4ade80;
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.2);
                }

                .save-status.error {
                    color: #f87171;
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.2);
                }

                .save-status .pulse {
                    animation: pulse 1.5s ease-in-out infinite;
                }

                /* Subtle auto-saved indicator */
                .save-status-subtle {
                    opacity: 0.7;
                    font-size: 0.75rem;
                }

                .save-status.idle {
                    opacity: 0.6;
                }

                .save-status.idle:hover {
                    opacity: 1;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                /* Draft Recovery Modal */
                .draft-recovery-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                    backdrop-filter: blur(4px);
                }

                .draft-recovery-modal {
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.98) 0%, rgba(25, 25, 45, 1) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 20px;
                    padding: 2rem;
                    text-align: center;
                    max-width: 400px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                }

                .draft-recovery-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #60a5fa;
                    margin: 0 auto 1.5rem;
                }

                .draft-recovery-modal h3 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.75rem;
                }

                .draft-recovery-modal p {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-bottom: 1.5rem;
                    line-height: 1.5;
                }

                .draft-recovery-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                .discard-btn {
                    flex: 1;
                    padding: 0.875rem 1rem;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 10px;
                    color: var(--text-secondary);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .discard-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary);
                }

                .restore-btn {
                    flex: 1;
                    padding: 0.875rem 1rem;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }

                .restore-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                }

                .submit-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.875rem 1.5rem;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }

                .submit-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
                }

                .submit-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .submit-btn-full {
                    width: 100%;
                    justify-content: center;
                }

                .spinner {
                    width: 18px;
                    height: 18px;
                    border: 2px solid currentColor;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .report-layout {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 1.5rem;
                }

                .report-main {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .report-card {
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.9) 0%, rgba(25, 25, 45, 0.95) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                }

                .card-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .card-icon-blue {
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
                    color: #60a5fa;
                }

                .card-icon-green {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
                    color: #4ade80;
                }

                .card-icon-amber {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%);
                    color: #fbbf24;
                }

                .card-icon-red {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
                    color: #f87171;
                }

                .card-icon-purple {
                    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%);
                    color: #c084fc;
                }

                .card-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .metrics-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .readonly-metric {
                    display: flex;
                    align-items: center;
                    gap: 0.875rem;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .readonly-metric-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .readonly-metric-info {
                    display: flex;
                    flex-direction: column;
                }

                .readonly-metric-value {
                    font-size: 1.375rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1.2;
                }

                .readonly-metric-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .metrics-hint {
                    margin-top: 0.75rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-style: italic;
                }

                .reservations-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }

                .notes-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .note-field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .note-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .note-label-red {
                    color: #f87171;
                }

                .note-label-accent {
                    color: var(--accent);
                }

                .note-input {
                    width: 100%;
                    padding: 0.875rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    resize: vertical;
                    min-height: 80px;
                    transition: all 0.2s;
                }

                .note-input:focus {
                    outline: none;
                    border-color: var(--accent);
                    background: rgba(255, 255, 255, 0.05);
                }

                .note-input::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                .note-label-warning {
                    color: #fbbf24;
                }

                .note-field-highlight {
                    background: rgba(245, 158, 11, 0.08);
                    border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 12px;
                    padding: 1rem;
                }

                /* Retail Calls Section */
                .retail-count {
                    background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .add-retail-btn {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    background: rgba(168, 85, 247, 0.15);
                    border: 1px solid rgba(168, 85, 247, 0.3);
                    border-radius: 8px;
                    color: #c084fc;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-retail-btn:hover {
                    background: rgba(168, 85, 247, 0.25);
                    transform: translateY(-1px);
                }

                .empty-retail {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem;
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                .empty-retail p {
                    font-size: 0.875rem;
                }

                .add-retail-btn-large {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-retail-btn-large:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
                }

                .retail-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .retail-item {
                    padding: 1rem;
                    background: rgba(168, 85, 247, 0.08);
                    border: 1px solid rgba(168, 85, 247, 0.15);
                    border-radius: 12px;
                }

                .retail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .retail-number {
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: #c084fc;
                }

                .retail-remove {
                    padding: 0.375rem;
                    background: none;
                    border: none;
                    color: #f87171;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s;
                }

                .retail-remove:hover {
                    background: rgba(239, 68, 68, 0.15);
                }

                .retail-field {
                    margin-bottom: 0.75rem;
                }

                .retail-field:last-child {
                    margin-bottom: 0;
                }

                .retail-field label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    margin-bottom: 0.375rem;
                }

                .retail-field input {
                    width: 100%;
                    padding: 0.625rem 0.75rem;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .retail-field input:focus {
                    outline: none;
                    border-color: #c084fc;
                }

                .outcome-buttons {
                    display: flex;
                    gap: 0.5rem;
                }

                .outcome-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    background: rgba(0, 0, 0, 0.2);
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .outcome-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .outcome-won.active {
                    background: rgba(34, 197, 94, 0.2);
                    border-color: rgba(34, 197, 94, 0.4);
                    color: #4ade80;
                }

                .outcome-followup.active {
                    background: rgba(245, 158, 11, 0.2);
                    border-color: rgba(245, 158, 11, 0.4);
                    color: #fbbf24;
                }

                .outcome-lost.active {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: rgba(239, 68, 68, 0.4);
                    color: #f87171;
                }

                .lost-reason-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.375rem;
                    margin-bottom: 0.5rem;
                }

                .reason-btn {
                    padding: 0.375rem 0.75rem;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 6px;
                    background: rgba(0, 0, 0, 0.2);
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .reason-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                }

                .reason-btn.active {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: rgba(239, 68, 68, 0.4);
                    color: #f87171;
                }

                .other-reason-input {
                    margin-top: 0.5rem;
                }

                /* Sidebar */
                .report-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .sidebar-card {
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.9) 0%, rgba(25, 25, 45, 0.95) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 1.25rem;
                    position: sticky;
                    top: 100px;
                }

                .sidebar-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--accent);
                    margin-bottom: 1rem;
                }

                .sidebar-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .progress-section {
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }

                .progress-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .progress-value {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--accent);
                }

                .progress-track {
                    height: 6px;
                    background: rgba(255, 255, 255, 0.06);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent), #d4a853);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .tasks-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .empty-tasks {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1.5rem;
                    color: var(--text-secondary);
                    opacity: 0.5;
                }

                .empty-tasks p {
                    font-size: 0.875rem;
                }

                .task-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem 0.75rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .task-item:hover {
                    background: rgba(255, 255, 255, 0.04);
                }

                .task-checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--accent);
                    cursor: pointer;
                }

                .task-text {
                    font-size: 0.875rem;
                    color: var(--text-primary);
                    transition: all 0.2s;
                }

                .task-completed {
                    color: var(--text-secondary);
                    text-decoration: line-through;
                }

                .mobile-submit {
                    display: none;
                }

                @media (max-width: 1024px) {
                    .report-layout {
                        grid-template-columns: 1fr;
                    }

                    .report-sidebar {
                        order: -1;
                    }

                    .reservations-grid {
                        grid-template-columns: 1fr;
                    }

                    .sidebar-card {
                        position: static;
                    }
                }

                @media (max-width: 640px) {
                    .report-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .report-header .submit-btn {
                        display: none;
                    }

                    .mobile-submit {
                        display: block;
                        margin-top: 0.5rem;
                    }

                    .metrics-row {
                        grid-template-columns: 1fr;
                    }
                }

                /* Quote Section Styles */
                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                }

                .quote-count {
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .add-quote-btn {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 8px;
                    color: #4ade80;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-quote-btn:hover {
                    background: rgba(34, 197, 94, 0.25);
                    transform: translateY(-1px);
                }

                .empty-quotes {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem;
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                .empty-quotes p {
                    font-size: 0.875rem;
                }

                .add-quote-btn-large {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-quote-btn-large:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }

                .quotes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .quote-item {
                    padding: 1rem;
                    background: rgba(34, 197, 94, 0.08);
                    border: 1px solid rgba(34, 197, 94, 0.15);
                    border-radius: 10px;
                }

                .quote-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .quote-client {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .quote-amount {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #4ade80;
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .quote-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .quote-service {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                    padding: 0.125rem 0.5rem;
                    border-radius: 4px;
                    font-weight: 500;
                }

                .quote-contact {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .quote-notes {
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    font-style: italic;
                }
            `}</style>
        </div>
    );
}


// Add Quote Modal Component
function AddQuoteModal({
    onClose,
    onSubmit,
}: {
    onClose: () => void;
    onSubmit: (data: {
        clientName: string;
        clientEmail?: string;
        clientPhone?: string;
        serviceType: string;
        estimatedAmount?: number;
        notes?: string;
    }) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        serviceType: "",
        estimatedAmount: "",
        notes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientName || !form.serviceType) return;

        setLoading(true);
        await onSubmit({
            clientName: form.clientName,
            clientEmail: form.clientEmail || undefined,
            clientPhone: form.clientPhone || undefined,
            serviceType: form.serviceType,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
            notes: form.notes || undefined,
        });
        setLoading(false);
    };

    return (
        <div className="quote-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="quote-modal">
                <div className="quote-modal-header">
                    <h3>Add New Quote</h3>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="quote-form">
                    <div className="form-group">
                        <label>Client Name *</label>
                        <input
                            type="text"
                            value={form.clientName}
                            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={form.clientEmail}
                                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={form.clientPhone}
                                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                                placeholder="+1 234 567 8900"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Service Type *</label>
                            <select
                                value={form.serviceType}
                                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                                required
                            >
                                <option value="">Select service...</option>
                                <option value="Airport Transfer">Airport Transfer</option>
                                <option value="Hourly Service">Hourly Service</option>
                                <option value="Point to Point">Point to Point</option>
                                <option value="City Tour">City Tour</option>
                                <option value="Event Transportation">Event Transportation</option>
                                <option value="Corporate">Corporate</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Estimated Amount</label>
                            <input
                                type="number"
                                value={form.estimatedAmount}
                                onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })}
                                placeholder="$0.00"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notes</label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Additional details about the quote..."
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="cancel-btn">
                            Cancel
                        </button>
                        <button type="submit" className="submit-quote-btn" disabled={loading}>
                            {loading ? "Adding..." : "Add Quote"}
                        </button>
                    </div>
                </form>

                <style jsx>{`
                    .quote-modal-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 100;
                        padding: 1rem;
                    }

                    .quote-modal {
                        background: linear-gradient(135deg, rgba(30, 30, 50, 0.95) 0%, rgba(25, 25, 45, 0.98) 100%);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 16px;
                        width: 100%;
                        max-width: 500px;
                        padding: 1.5rem;
                    }

                    .quote-modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1.5rem;
                    }

                    .quote-modal-header h3 {
                        font-size: 1.25rem;
                        font-weight: 600;
                        color: var(--text-primary);
                    }

                    .close-btn {
                        background: none;
                        border: none;
                        color: var(--text-secondary);
                        cursor: pointer;
                        padding: 0.25rem;
                    }

                    .close-btn:hover {
                        color: var(--text-primary);
                    }

                    .quote-form {
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 0.375rem;
                    }

                    .form-group label {
                        font-size: 0.8rem;
                        color: var(--text-secondary);
                    }

                    .form-group input,
                    .form-group select,
                    .form-group textarea {
                        padding: 0.75rem;
                        background: rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        color: var(--text-primary);
                        font-size: 0.9rem;
                    }

                    .form-group input:focus,
                    .form-group select:focus,
                    .form-group textarea:focus {
                        outline: none;
                        border-color: var(--accent);
                    }

                    .form-group textarea {
                        height: 80px;
                        resize: vertical;
                    }

                    .form-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 1rem;
                    }

                    .form-actions {
                        display: flex;
                        justify-content: flex-end;
                        gap: 0.75rem;
                        margin-top: 0.5rem;
                    }

                    .cancel-btn {
                        padding: 0.75rem 1.25rem;
                        background: transparent;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        color: var(--text-secondary);
                        cursor: pointer;
                        font-size: 0.875rem;
                    }

                    .cancel-btn:hover {
                        background: rgba(255, 255, 255, 0.05);
                    }

                    .submit-quote-btn {
                        padding: 0.75rem 1.25rem;
                        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                        border: none;
                        border-radius: 8px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 0.875rem;
                    }

                    .submit-quote-btn:hover:not(:disabled) {
                        transform: translateY(-1px);
                    }

                    .submit-quote-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    @media (max-width: 500px) {
                        .form-row {
                            grid-template-columns: 1fr;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}

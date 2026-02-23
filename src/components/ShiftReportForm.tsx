"use client";

import { useState, memo } from "react";
import { Plus, Trash2, ClipboardCheck, Send, AlertCircle, Bookmark, Phone, Mail, FileText, TrendingUp, MessageSquare, Lightbulb, Clock, CheckCircle, Minus, X, DollarSign, User, Flag, PhoneCall, ThumbsUp, ThumbsDown, AlertOctagon } from "lucide-react";
import { toggleTask, saveShiftReport } from "@/lib/actions";
import { createQuote } from "@/lib/quoteActions";

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

export default function ShiftReportPage({ session, activeShift, initialTasks, initialQuotes = [] }: any) {
    const [accepted, setAccepted] = useState<ReservationEntry[]>([]);
    const [modified, setModified] = useState<ReservationEntry[]>([]);
    const [cancelled, setCancelled] = useState<ReservationEntry[]>([]);
    const [retailLeads, setRetailLeads] = useState<RetailLeadEntry[]>([]);
    const [handoffNotes, setHandoffNotes] = useState("");
    const [metrics, setMetrics] = useState<Metrics>({
        calls: 0,
        emails: 0,
        totalReservationsHandled: 0
    });
    const [narrative, setNarrative] = useState<Narrative>({
        comments: "",
        incidents: "",
        ideas: ""
    });
    const [tasks, setTasks] = useState(initialTasks || []);
    const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addReservation = (setter: any) => {
        setter((prev: any) => [...prev, { id: "", notes: "" }]);
    };

    const updateReservation = (setter: any, index: number, field: string, value: string) => {
        setter((prev: any) => prev.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item));
    };

    const removeReservation = (setter: any, index: number) => {
        setter((prev: any) => prev.filter((_: any, i: number) => i !== index));
    };

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        setTasks(tasks.map((t: any) => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
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

            await saveShiftReport(data);
            window.location.href = "/dashboard";
        } catch (error) {
            console.error("Failed to save shift report:", error);
            setIsSubmitting(false);
            alert("Failed to submit shift report. Please try again.");
        }
    };

    const completedTasks = tasks.filter((t: any) => t.isCompleted).length;
    const taskProgress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    return (
        <div className="report-page">
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
                                setter={setAccepted}
                                add={() => addReservation(setAccepted)}
                                update={updateReservation}
                                remove={removeReservation}
                                color="green"
                            />
                            <ReservationSection
                                title="Modified"
                                data={modified}
                                setter={setModified}
                                add={() => addReservation(setModified)}
                                update={updateReservation}
                                remove={removeReservation}
                                color="blue"
                            />
                            <ReservationSection
                                title="Cancelled"
                                data={cancelled}
                                setter={setCancelled}
                                add={() => addReservation(setCancelled)}
                                update={updateReservation}
                                remove={removeReservation}
                                color="red"
                            />
                        </div>
                    </section>

                    {/* Retail Calls Section */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-purple">
                                <PhoneCall size={18} />
                            </div>
                            <h2 className="card-title">Retail Calls</h2>
                            <span className="retail-count">{retailLeads.length}</span>
                            <button
                                type="button"
                                onClick={() => setRetailLeads([...retailLeads, { serviceRequested: "", outcome: "WON" }])}
                                className="add-retail-btn"
                            >
                                <Plus size={16} />
                                Add Call
                            </button>
                        </div>

                        {retailLeads.length === 0 ? (
                            <div className="empty-retail">
                                <PhoneCall size={32} />
                                <p>No retail calls logged yet</p>
                                <button
                                    type="button"
                                    onClick={() => setRetailLeads([{ serviceRequested: "", outcome: "WON" }])}
                                    className="add-retail-btn-large"
                                >
                                    <Plus size={18} />
                                    Log First Call
                                </button>
                            </div>
                        ) : (
                            <div className="retail-list">
                                {retailLeads.map((lead, index) => (
                                    <div key={index} className="retail-item">
                                        <div className="retail-header">
                                            <span className="retail-number">Call #{index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => setRetailLeads(retailLeads.filter((_, i) => i !== index))}
                                                className="retail-remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="retail-field">
                                            <label>What did they request?</label>
                                            <input
                                                type="text"
                                                value={lead.serviceRequested}
                                                onChange={(e) => {
                                                    const updated = [...retailLeads];
                                                    updated[index] = { ...lead, serviceRequested: e.target.value };
                                                    setRetailLeads(updated);
                                                }}
                                                placeholder="e.g., Airport transfer, hourly service..."
                                            />
                                        </div>

                                        <div className="retail-field">
                                            <label>Outcome</label>
                                            <div className="outcome-buttons">
                                                <button
                                                    type="button"
                                                    className={`outcome-btn outcome-won ${lead.outcome === "WON" ? "active" : ""}`}
                                                    onClick={() => {
                                                        const updated = [...retailLeads];
                                                        updated[index] = { ...lead, outcome: "WON", lostReason: undefined, lostReasonOther: undefined };
                                                        setRetailLeads(updated);
                                                    }}
                                                >
                                                    <ThumbsUp size={14} />
                                                    <span>Won</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`outcome-btn outcome-followup ${lead.outcome === "NEEDS_FOLLOW_UP" ? "active" : ""}`}
                                                    onClick={() => {
                                                        const updated = [...retailLeads];
                                                        updated[index] = { ...lead, outcome: "NEEDS_FOLLOW_UP", lostReason: undefined, lostReasonOther: undefined };
                                                        setRetailLeads(updated);
                                                    }}
                                                >
                                                    <AlertOctagon size={14} />
                                                    <span>Follow Up</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`outcome-btn outcome-lost ${lead.outcome === "LOST" ? "active" : ""}`}
                                                    onClick={() => {
                                                        const updated = [...retailLeads];
                                                        updated[index] = { ...lead, outcome: "LOST" };
                                                        setRetailLeads(updated);
                                                    }}
                                                >
                                                    <ThumbsDown size={14} />
                                                    <span>Lost</span>
                                                </button>
                                            </div>
                                        </div>

                                        {lead.outcome === "LOST" && (
                                            <div className="retail-field">
                                                <label>Why did we lose it?</label>
                                                <div className="lost-reason-buttons">
                                                    {(["VEHICLE_TYPE", "AVAILABILITY", "PRICING", "OTHER"] as const).map((reason) => (
                                                        <button
                                                            key={reason}
                                                            type="button"
                                                            className={`reason-btn ${lead.lostReason === reason ? "active" : ""}`}
                                                            onClick={() => {
                                                                const updated = [...retailLeads];
                                                                updated[index] = { ...lead, lostReason: reason };
                                                                setRetailLeads(updated);
                                                            }}
                                                        >
                                                            {reason === "VEHICLE_TYPE" && "Vehicle Type"}
                                                            {reason === "AVAILABILITY" && "Availability"}
                                                            {reason === "PRICING" && "Pricing"}
                                                            {reason === "OTHER" && "Other"}
                                                        </button>
                                                    ))}
                                                </div>
                                                {lead.lostReason === "OTHER" && (
                                                    <input
                                                        type="text"
                                                        value={lead.lostReasonOther || ""}
                                                        onChange={(e) => {
                                                            const updated = [...retailLeads];
                                                            updated[index] = { ...lead, lostReasonOther: e.target.value };
                                                            setRetailLeads(updated);
                                                        }}
                                                        placeholder="Specify other reason..."
                                                        className="other-reason-input"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        <div className="retail-field">
                                            <label>Notes (optional)</label>
                                            <input
                                                type="text"
                                                value={lead.notes || ""}
                                                onChange={(e) => {
                                                    const updated = [...retailLeads];
                                                    updated[index] = { ...lead, notes: e.target.value };
                                                    setRetailLeads(updated);
                                                }}
                                                placeholder="Additional details..."
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Notes Section */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-red">
                                <AlertCircle size={18} />
                            </div>
                            <h2 className="card-title">Notes & Feedback</h2>
                        </div>
                        <div className="notes-grid">
                            <div className="note-field note-field-highlight">
                                <label className="note-label note-label-warning">
                                    <MessageSquare size={14} />
                                    <span>Handoff Notes (for next dispatcher)</span>
                                </label>
                                <textarea
                                    className="note-input"
                                    value={handoffNotes}
                                    onChange={(e) => setHandoffNotes(e.target.value)}
                                    placeholder="Important info for the next dispatcher taking over..."
                                />
                            </div>
                            <div className="note-field">
                                <label className="note-label note-label-red">
                                    <AlertCircle size={14} />
                                    <span>Incidents / Deviations</span>
                                </label>
                                <textarea
                                    className="note-input"
                                    value={narrative.incidents}
                                    onChange={(e) => setNarrative({ ...narrative, incidents: e.target.value })}
                                    placeholder="Report any incidents, deviations, or issues..."
                                />
                            </div>
                            <div className="note-field">
                                <label className="note-label">
                                    <MessageSquare size={14} />
                                    <span>General Comments</span>
                                </label>
                                <textarea
                                    className="note-input"
                                    value={narrative.comments}
                                    onChange={(e) => setNarrative({ ...narrative, comments: e.target.value })}
                                    placeholder="Any other comments about your shift..."
                                />
                            </div>
                            <div className="note-field">
                                <label className="note-label note-label-accent">
                                    <Lightbulb size={14} />
                                    <span>Ideas & Suggestions</span>
                                </label>
                                <textarea
                                    className="note-input"
                                    value={narrative.ideas}
                                    onChange={(e) => setNarrative({ ...narrative, ideas: e.target.value })}
                                    placeholder="Ideas to improve processes or service..."
                                />
                            </div>
                        </div>
                    </section>
                </main>

                {/* Sidebar */}
                <aside className="report-sidebar">
                    <div className="sidebar-card">
                        <div className="sidebar-header">
                            <ClipboardCheck size={18} />
                            <h3>Shift Tasks</h3>
                        </div>

                        {tasks.length > 0 && (
                            <div className="progress-section">
                                <div className="progress-header">
                                    <span className="progress-label">Progress</span>
                                    <span className="progress-value">{completedTasks}/{tasks.length}</span>
                                </div>
                                <div className="progress-track">
                                    <div
                                        className="progress-bar"
                                        style={{ width: `${taskProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="tasks-list">
                            {tasks.length === 0 ? (
                                <div className="empty-tasks">
                                    <CheckCircle size={24} />
                                    <p>No tasks assigned</p>
                                </div>
                            ) : (
                                tasks.map((task: any) => (
                                    <label key={task.id} className="task-item">
                                        <input
                                            type="checkbox"
                                            checked={task.isCompleted}
                                            onChange={() => handleToggleTask(task.id, task.isCompleted)}
                                            className="task-checkbox"
                                        />
                                        <span className={`task-text ${task.isCompleted ? "task-completed" : ""}`}>
                                            {task.content}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

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

// Metric Card Component
interface MetricCardProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    icon: React.ReactNode;
    color: "blue" | "green" | "amber" | "purple" | "red";
}

const MetricCard = memo(function MetricCard({ label, value, onChange, icon, color }: MetricCardProps) {
    const colors = {
        blue: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" },
        green: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)", text: "#4ade80" },
        amber: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", text: "#fbbf24" },
        purple: { bg: "rgba(168, 85, 247, 0.1)", border: "rgba(168, 85, 247, 0.2)", text: "#c084fc" },
        red: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)", text: "#f87171" },
    };

    const c = colors[color];

    return (
        <div style={{
            padding: "1rem",
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: "12px",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ color: c.text }}>{icon}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, value - 1))}
                    style={{
                        width: "32px",
                        height: "32px",
                        border: `1px solid ${c.border}`,
                        background: "rgba(0, 0, 0, 0.2)",
                        borderRadius: "8px",
                        color: c.text,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                    }}
                    aria-label={`Decrease ${label}`}
                >
                    <Minus size={16} />
                </button>
                <span style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: value > 0 ? c.text : "var(--text-secondary)",
                }}>
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(value + 1)}
                    style={{
                        width: "32px",
                        height: "32px",
                        border: `1px solid ${c.border}`,
                        background: "rgba(0, 0, 0, 0.2)",
                        borderRadius: "8px",
                        color: c.text,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                    }}
                    aria-label={`Increase ${label}`}
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
});

// Reservation Section Component
function ReservationSection({ title, data, setter, add, update, remove, color }: any) {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
        green: { bg: "rgba(34, 197, 94, 0.05)", border: "rgba(34, 197, 94, 0.15)", text: "#4ade80" },
        blue: { bg: "rgba(59, 130, 246, 0.05)", border: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" },
        red: { bg: "rgba(239, 68, 68, 0.05)", border: "rgba(239, 68, 68, 0.15)", text: "#f87171" },
    };
    const c = colors[color] || colors.blue;

    return (
        <div style={{
            padding: "1rem",
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: "12px",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: c.text }}>{title}</h3>
                <button
                    onClick={add}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        background: "rgba(0, 0, 0, 0.2)",
                        border: `1px solid ${c.border}`,
                        borderRadius: "6px",
                        color: c.text,
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        cursor: "pointer",
                    }}
                >
                    <Plus size={12} /> Add
                </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {data.map((item: any, index: number) => (
                    <div key={index} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                                placeholder="Res #"
                                value={item.id}
                                onChange={(e) => update(setter, index, "id", e.target.value)}
                                style={{
                                    width: "80px",
                                    padding: "0.5rem",
                                    background: "rgba(0, 0, 0, 0.2)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "6px",
                                    color: "var(--text-primary)",
                                    fontSize: "0.8rem",
                                }}
                            />
                            <input
                                placeholder="Notes"
                                value={item.notes}
                                onChange={(e) => update(setter, index, "notes", e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: "0.5rem",
                                    background: "rgba(0, 0, 0, 0.2)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "6px",
                                    color: "var(--text-primary)",
                                    fontSize: "0.8rem",
                                }}
                            />
                            <button
                                onClick={() => update(setter, index, "flaggedForAccounting", !item.flaggedForAccounting)}
                                title={item.flaggedForAccounting ? "Remove accounting flag" : "Flag for accounting review"}
                                style={{
                                    padding: "0.375rem",
                                    background: item.flaggedForAccounting ? "rgba(245, 158, 11, 0.2)" : "none",
                                    border: item.flaggedForAccounting ? "1px solid rgba(245, 158, 11, 0.4)" : "none",
                                    borderRadius: "6px",
                                    color: item.flaggedForAccounting ? "#fbbf24" : "var(--text-secondary)",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                <Flag size={14} />
                            </button>
                            <button
                                onClick={() => remove(setter, index)}
                                style={{
                                    padding: "0.375rem",
                                    background: "none",
                                    border: "none",
                                    color: "#f87171",
                                    cursor: "pointer",
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        {item.flaggedForAccounting && (
                            <input
                                placeholder="Reason for accounting review..."
                                value={item.flagReason || ""}
                                onChange={(e) => update(setter, index, "flagReason", e.target.value)}
                                style={{
                                    padding: "0.5rem",
                                    background: "rgba(245, 158, 11, 0.1)",
                                    border: "1px solid rgba(245, 158, 11, 0.2)",
                                    borderRadius: "6px",
                                    color: "var(--text-primary)",
                                    fontSize: "0.75rem",
                                    marginLeft: "0",
                                }}
                            />
                        )}
                    </div>
                ))}
                {data.length === 0 && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "0.5rem" }}>
                        No entries
                    </p>
                )}
            </div>
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

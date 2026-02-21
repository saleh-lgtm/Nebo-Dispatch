"use client";

import { useState, memo } from "react";
import { Plus, Trash2, ClipboardCheck, Send, AlertCircle, Bookmark, Phone, Mail, FileText, TrendingUp, MessageSquare, Lightbulb, Clock, CheckCircle, Minus } from "lucide-react";
import { toggleTask, saveShiftReport } from "@/lib/actions";

interface ReservationEntry {
    id: string;
    notes: string;
}

interface Metrics {
    calls: number;
    emails: number;
    quotes: number;
    totalReservationsHandled: number;
}

interface Narrative {
    comments: string;
    incidents: string;
    ideas: string;
}

export default function ShiftReportPage({ session, activeShift, initialTasks }: any) {
    const [accepted, setAccepted] = useState<ReservationEntry[]>([]);
    const [modified, setModified] = useState<ReservationEntry[]>([]);
    const [cancelled, setCancelled] = useState<ReservationEntry[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({
        calls: 0,
        emails: 0,
        quotes: 0,
        totalReservationsHandled: 0
    });
    const [narrative, setNarrative] = useState<Narrative>({
        comments: "",
        incidents: "",
        ideas: ""
    });
    const [tasks, setTasks] = useState(initialTasks || []);
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

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const data = {
            shiftId: activeShift.id,
            userId: session.user.id,
            callsReceived: metrics.calls,
            emailsSent: metrics.emails,
            quotesGiven: metrics.quotes,
            totalReservationsHandled: metrics.totalReservationsHandled,
            generalComments: narrative.comments,
            incidents: narrative.incidents,
            newIdeas: narrative.ideas,
            acceptedReservations: accepted,
            modifiedReservations: modified,
            cancelledReservations: cancelled,
            clockOut: true
        };

        await saveShiftReport(data);
        window.location.href = "/dashboard";
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
                        </div>
                        <div className="metrics-row">
                            <MetricCard
                                label="Quotes Given"
                                value={metrics.quotes}
                                onChange={(v) => setMetrics({ ...metrics, quotes: v })}
                                icon={<FileText size={20} />}
                                color="green"
                            />
                        </div>
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

                    {/* Notes Section */}
                    <section className="report-card">
                        <div className="card-header">
                            <div className="card-icon card-icon-red">
                                <AlertCircle size={18} />
                            </div>
                            <h2 className="card-title">Notes & Feedback</h2>
                        </div>
                        <div className="notes-grid">
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {data.map((item: any, index: number) => (
                    <div key={index} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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

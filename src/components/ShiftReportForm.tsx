"use client";

import { useState, memo } from "react";
import { Plus, Trash2, ClipboardCheck, Send, AlertCircle, Bookmark, Phone, Mail, FileText, TrendingUp, MessageSquare, Lightbulb } from "lucide-react";
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

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <header className="shift-report-header">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>Current Shift Report</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Logging shift data for {new Date().toLocaleDateString()}</p>
                </div>
                <button
                    onClick={handleSubmit}
                    className="btn btn-primary"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <span className="animate-spin" style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%" }} />
                    ) : (
                        <Send size={18} />
                    )}
                    <span>{isSubmitting ? "Submitting..." : "Finalize & Clock Out"}</span>
                </button>
            </header>

            <div className="shift-report-layout">
                <div className="flex flex-col gap-6">
                    {/* Communication Metrics */}
                    <section className="glass-card">
                        <SectionHeader icon={<Phone className="text-accent" />} title="Communication Metrics" />
                        <div className="metrics-grid">
                            <MetricInput
                                label="Calls Received"
                                value={metrics.calls}
                                onChange={(v: number) => setMetrics({ ...metrics, calls: v })}
                                icon={<Phone size={16} />}
                            />
                            <MetricInput
                                label="Emails Sent"
                                value={metrics.emails}
                                onChange={(v: number) => setMetrics({ ...metrics, emails: v })}
                                icon={<Mail size={16} />}
                            />
                        </div>
                    </section>

                    {/* Quotes */}
                    <section className="glass-card">
                        <SectionHeader icon={<FileText className="text-accent" />} title="Quotes" />
                        <div className="metrics-grid">
                            <MetricInput
                                label="Quotes Given"
                                value={metrics.quotes}
                                onChange={(v: number) => setMetrics({ ...metrics, quotes: v })}
                                icon={<FileText size={16} />}
                            />
                        </div>
                    </section>

                    {/* Reservation Metrics */}
                    <section className="glass-card">
                        <SectionHeader icon={<Bookmark className="text-accent" />} title="Reservation Handling" />
                        <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
                            <MetricInput
                                label="Total Reservations Handled"
                                value={metrics.totalReservationsHandled}
                                onChange={(v: number) => setMetrics({ ...metrics, totalReservationsHandled: v })}
                                icon={<TrendingUp size={16} />}
                            />
                        </div>
                        <div className="flex flex-col gap-6">
                            <ReservationSection title="Accepted Reservations" data={accepted} setter={setAccepted} add={() => addReservation(setAccepted)} update={updateReservation} remove={removeReservation} />
                            <ReservationSection title="Modified Reservations" data={modified} setter={setModified} add={() => addReservation(setModified)} update={updateReservation} remove={removeReservation} />
                            <ReservationSection title="Cancelled Reservations" data={cancelled} setter={setCancelled} add={() => addReservation(setCancelled)} update={updateReservation} remove={removeReservation} />
                        </div>
                    </section>

                    {/* Incidents & Notes */}
                    <section className="glass-card">
                        <SectionHeader icon={<AlertCircle className="text-accent" />} title="Incidents & Notes" />
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="input-label">
                                    <AlertCircle size={14} style={{ color: "var(--danger)" }} />
                                    <span>Incidents / Deviations</span>
                                </label>
                                <textarea
                                    className="input"
                                    style={{ height: "80px", resize: "vertical" }}
                                    value={narrative.incidents}
                                    onChange={(e) => setNarrative({ ...narrative, incidents: e.target.value })}
                                    placeholder="Any incidents, deviations from normal operations, or issues to report?"
                                />
                            </div>
                            <div>
                                <label className="input-label">
                                    <MessageSquare size={14} />
                                    <span>General Comments</span>
                                </label>
                                <textarea
                                    className="input"
                                    style={{ height: "80px", resize: "vertical" }}
                                    value={narrative.comments}
                                    onChange={(e) => setNarrative({ ...narrative, comments: e.target.value })}
                                    placeholder="Any other comments about your shift?"
                                />
                            </div>
                            <div>
                                <label className="input-label">
                                    <Lightbulb size={14} style={{ color: "var(--accent)" }} />
                                    <span>New Ideas / Suggestions</span>
                                </label>
                                <textarea
                                    className="input"
                                    style={{ height: "80px", resize: "vertical" }}
                                    value={narrative.ideas}
                                    onChange={(e) => setNarrative({ ...narrative, ideas: e.target.value })}
                                    placeholder="Any ideas to improve processes or service?"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Task Checklist Sidebar */}
                <aside className="shift-report-sidebar">
                    <section className="glass-card" style={{ position: "sticky", top: "100px" }}>
                        <SectionHeader icon={<ClipboardCheck className="text-accent" />} title="Shift Tasks" />
                        <div className="flex flex-col gap-2">
                            {tasks.length === 0 ? (
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontStyle: "italic", padding: "0.5rem" }}>No tasks assigned.</p>
                            ) : (
                                tasks.map((task: any) => (
                                    <label key={task.id} className="task-item">
                                        <input
                                            type="checkbox"
                                            checked={task.isCompleted}
                                            onChange={() => handleToggleTask(task.id, task.isCompleted)}
                                            className="task-checkbox"
                                        />
                                        <span className={`task-label ${task.isCompleted ? "completed" : ""}`}>
                                            {task.content}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                        {tasks.length > 0 && (
                            <div className="task-progress">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${(tasks.filter((t: any) => t.isCompleted).length / tasks.length) * 100}%`
                                        }}
                                    />
                                </div>
                                <span className="progress-text">
                                    {tasks.filter((t: any) => t.isCompleted).length} / {tasks.length} completed
                                </span>
                            </div>
                        )}
                    </section>

                    {/* Mobile Submit Button */}
                    <div className="mobile-submit show-mobile">
                        <button
                            onClick={handleSubmit}
                            className="btn btn-primary w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="animate-spin" style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%" }} />
                            ) : (
                                <Send size={18} />
                            )}
                            <span>{isSubmitting ? "Submitting..." : "Finalize & Clock Out"}</span>
                        </button>
                    </div>
                </aside>
            </div>

            <style jsx>{`
                .shift-report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .shift-report-layout {
                    display: grid;
                    grid-template-columns: 1fr 350px;
                    gap: 2rem;
                }

                .shift-report-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }

                .input-label {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .task-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }

                .task-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .task-checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--accent);
                }

                .task-label {
                    font-size: 0.875rem;
                    color: var(--text-primary);
                    transition: all 0.2s;
                }

                .task-label.completed {
                    color: var(--text-secondary);
                    text-decoration: line-through;
                }

                .task-progress {
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }

                .progress-bar {
                    height: 6px;
                    background: var(--bg-secondary);
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                }

                .progress-fill {
                    height: 100%;
                    background: var(--success);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .progress-text {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .mobile-submit {
                    margin-top: 1rem;
                }

                @media (max-width: 1024px) {
                    .shift-report-layout {
                        grid-template-columns: 1fr;
                    }

                    .shift-report-sidebar {
                        order: -1;
                    }

                    .metrics-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 640px) {
                    .shift-report-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .shift-report-header button {
                        display: none;
                    }

                    .metrics-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

function ReservationSection({ title, data, setter, add, update, remove }: any) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{title}</h3>
                <button onClick={add} className="btn-outline" style={{ padding: "0.25rem 0.5rem", borderRadius: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)" }}>
                    <Plus size={14} /> Add
                </button>
            </div>
            <div className="flex flex-col gap-2">
                {data.map((item: any, index: number) => (
                    <div key={index} className="flex gap-2 items-start">
                        <input className="input" placeholder="Res #" style={{ padding: "0.5rem", width: "120px" }} value={item.id} onChange={(e) => update(setter, index, "id", e.target.value)} />
                        <input className="input" placeholder="Notes/Changes" style={{ padding: "0.5rem", flex: 1 }} value={item.notes} onChange={(e) => update(setter, index, "notes", e.target.value)} />
                        <button onClick={() => remove(setter, index)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.5rem" }}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {data.length === 0 && <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontStyle: "italic", padding: "0.5rem" }}>No entries yet.</p>}
            </div>
        </div>
    );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
            {icon}
            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>{title}</h2>
        </div>
    );
}

interface MetricInputProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    icon?: React.ReactNode;
    variant?: "default" | "success" | "warning" | "danger";
}

const MetricInput = memo(function MetricInput({ label, value, onChange, icon, variant = "default" }: MetricInputProps) {
    const variantColors: Record<string, string> = {
        default: "var(--text-secondary)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)"
    };

    const labelColor = variantColors[variant];

    return (
        <div className="flex flex-col gap-1">
            <label style={{
                fontSize: "0.75rem",
                color: labelColor,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "0.375rem"
            }}>
                {icon}
                {label}
            </label>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, value - 1))}
                    className="btn-outline"
                    style={{
                        width: "32px",
                        height: "32px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: "none",
                        color: "white",
                        borderRadius: "0.375rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.25rem",
                        lineHeight: 1
                    }}
                    aria-label={`Decrease ${label}`}
                >
                    -
                </button>
                <span style={{
                    minWidth: "40px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    color: value > 0 ? "var(--text-primary)" : "var(--text-secondary)"
                }}>
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(value + 1)}
                    className="btn-outline"
                    style={{
                        width: "32px",
                        height: "32px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: "none",
                        color: "white",
                        borderRadius: "0.375rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.25rem",
                        lineHeight: 1
                    }}
                    aria-label={`Increase ${label}`}
                >
                    +
                </button>
            </div>
        </div>
    );
});

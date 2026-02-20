"use client";

import { useState } from "react";
import { Plus, Trash2, ClipboardCheck, Send, AlertCircle, Bookmark } from "lucide-react";
import { toggleTask, saveShiftReport } from "@/lib/actions";

interface ReservationEntry {
    id: string;
    notes: string;
}

export default function ShiftReportPage({ session, activeShift, initialTasks }: any) {
    const [accepted, setAccepted] = useState<ReservationEntry[]>([]);
    const [modified, setModified] = useState<ReservationEntry[]>([]);
    const [cancelled, setCancelled] = useState<ReservationEntry[]>([]);
    const [metrics, setMetrics] = useState({ calls: 0, emails: 0, quotes: 0 });
    const [narrative, setNarrative] = useState({ comments: "", incidents: "", ideas: "" });
    const [tasks, setTasks] = useState(initialTasks || []);

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
        const data = {
            shiftId: activeShift.id,
            userId: session.user.id,
            callsReceived: metrics.calls,
            emailsSent: metrics.emails,
            quotesGiven: metrics.quotes,
            generalComments: narrative.comments,
            incidents: narrative.incidents,
            newIdeas: narrative.ideas,
            acceptedReservations: accepted,
            modifiedReservations: modified,
            cancelledReservations: cancelled,
            clockOut: true // Finish shift on report submit
        };

        await saveShiftReport(data);
        window.location.href = "/dashboard";
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>Current Shift Report</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Logging shift data for {new Date().toLocaleDateString()}</p>
                </div>
                <button onClick={handleSubmit} className="btn btn-primary">
                    <Send size={18} />
                    <span>Finalize & Clock Out</span>
                </button>
            </header>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "2rem" }}>
                <div className="flex flex-col gap-6">
                    {/* Reservation Logs */}
                    <section className="glass-card">
                        <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                            <Bookmark className="text-accent" />
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Reservation Logs</h2>
                        </div>

                        <div className="flex flex-col gap-6">
                            <ReservationSection title="Accepted Reservations" data={accepted} setter={setAccepted} add={() => addReservation(setAccepted)} update={updateReservation} remove={removeReservation} />
                            <ReservationSection title="Modified Reservations" data={modified} setter={setModified} add={() => addReservation(setModified)} update={updateReservation} remove={removeReservation} />
                            <ReservationSection title="Cancelled Reservations" data={cancelled} setter={setCancelled} add={() => addReservation(setCancelled)} update={updateReservation} remove={removeReservation} />
                        </div>
                    </section>

                    {/* Metrics & Narrative */}
                    <section className="glass-card">
                        <h2 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Performance & Notes</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
                            <MetricInput label="Calls Received" value={metrics.calls} onChange={(v: number) => setMetrics({ ...metrics, calls: v })} />
                            <MetricInput label="Emails Sent" value={metrics.emails} onChange={(v: number) => setMetrics({ ...metrics, emails: v })} />
                            <MetricInput label="Quotes Given" value={metrics.quotes} onChange={(v: number) => setMetrics({ ...metrics, quotes: v })} />
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem", display: "block" }}>Incidents / Deviations</label>
                                <textarea className="input" style={{ height: "80px", resize: "none" }} value={narrative.incidents} onChange={(e) => setNarrative({ ...narrative, incidents: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem", display: "block" }}>General Comments</label>
                                <textarea className="input" style={{ height: "80px", resize: "none" }} value={narrative.comments} onChange={(e) => setNarrative({ ...narrative, comments: e.target.value })} />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Task Checklist Sidebar */}
                <aside className="flex flex-col gap-6">
                    <section className="glass-card" style={{ position: "sticky", top: "100px" }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                            <ClipboardCheck className="text-accent" />
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Shift Tasks</h2>
                        </div>
                        <div className="flex flex-col gap-2">
                            {tasks.map((task: any) => (
                                <label key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={task.isCompleted}
                                        onChange={() => handleToggleTask(task.id, task.isCompleted)}
                                        style={{ width: "18px", height: "18px" }}
                                    />
                                    <span style={{ fontSize: "0.875rem", color: task.isCompleted ? "var(--text-secondary)" : "var(--text-primary)", textDecoration: task.isCompleted ? "line-through" : "none" }}>
                                        {task.content}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
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

function MetricInput({ label, value, onChange }: any) {
    return (
        <div className="flex flex-col gap-1">
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</label>
            <div className="flex items-center gap-2">
                <button onClick={() => onChange(Math.max(0, value - 1))} className="btn-outline" style={{ width: "32px", height: "32px", border: "1px solid var(--border)", cursor: "pointer", background: "none", color: "white" }}>-</button>
                <span style={{ minWidth: "30px", textAlign: "center", fontWeight: 700 }}>{value}</span>
                <button onClick={() => onChange(value + 1)} className="btn-outline" style={{ width: "32px", height: "32px", border: "1px solid var(--border)", cursor: "pointer", background: "none", color: "white" }}>+</button>
            </div>
        </div>
    );
}

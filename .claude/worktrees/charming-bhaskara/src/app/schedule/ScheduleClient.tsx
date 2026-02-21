"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, Clock, Edit3, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { createSchedulingRequest } from "@/lib/actions";

export default function ScheduleClient({ initialSchedule, session }: any) {
    const [activeTab, setActiveTab] = useState("upcoming");
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requestType, setRequestType] = useState<"HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW">("SCHEDULE_CHANGE");
    const [reason, setReason] = useState("");

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createSchedulingRequest({
            userId: session.user.id,
            type: requestType,
            reason,
        });
        if (res) {
            setShowRequestForm(false);
            setReason("");
            alert("Schedule request submitted to admin.");
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>My Schedule</h1>
                    <p style={{ color: "var(--text-secondary)" }}>View shifts and manage scheduling requests</p>
                </div>
                <button onClick={() => setShowRequestForm(true)} className="btn btn-primary">
                    <Edit3 size={18} />
                    <span>New Request</span>
                </button>
            </header>

            <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab("upcoming")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === "upcoming" ? "text-accent border-b-2 border-accent" : "text-secondary hover:text-white"}`}
                    >
                        Upcoming Shifts
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all ${activeTab === "history" ? "text-accent border-b-2 border-accent" : "text-secondary hover:text-white"}`}
                    >
                        Shift History
                    </button>
                </div>

                <div style={{ padding: "1.5rem" }}>
                    {activeTab === "upcoming" ? (
                        <div className="flex flex-col gap-4">
                            {initialSchedule.length > 0 ? (
                                initialSchedule.map((shift: any) => (
                                    <div key={shift.id} className="flex items-center gap-6 p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex flex-col items-center justify-center bg-accent/20 rounded-lg p-3 min-w-[80px]">
                                            <span className="text-xs uppercase font-bold text-accent">{new Date(shift.shiftStart).toLocaleDateString(undefined, { month: 'short' })}</span>
                                            <span className="text-2xl font-display leading-tight">{new Date(shift.shiftStart).getDate()}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-display" style={{ fontSize: "1.125rem" }}>{new Date(shift.shiftStart).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.shiftEnd).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</h3>
                                            <p className="text-sm text-secondary">Dispatcher Shift</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-success">
                                            <CheckCircle2 size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wide">Confirmed</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <CalendarIcon size={48} className="text-accent opacity-20" />
                                    <p className="text-secondary italic">No upcoming shifts scheduled.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 flex flex-col items-center gap-3">
                            <Clock size={48} className="text-accent opacity-20" />
                            <p className="text-secondary italic">Shift history will appear here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Request Modal */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg animate-scale-in">
                        <div className="flex items-center gap-3 mb-6">
                            <Edit3 className="text-accent" />
                            <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Submit Request</h2>
                        </div>

                        <form onSubmit={handleSubmitRequest} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">Request Type</label>
                                <select
                                    className="input w-full bg-[#1E2430]"
                                    value={requestType}
                                    onChange={(e: any) => setRequestType(e.target.value)}
                                >
                                    <option value="SCHEDULE_CHANGE">Schedule Change (Future)</option>
                                    <option value="HOURS_MODIFICATION">Hours Modification (Past)</option>
                                    <option value="REVIEW">Schedule Review</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">Reason / Explanation</label>
                                <textarea
                                    required
                                    placeholder="Explain your request details here..."
                                    className="input"
                                    style={{ height: "120px" }}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                                <div className="flex items-start gap-2 mt-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
                                    <AlertCircle size={14} className="text-accent mt-0.5" />
                                    <p className="text-[10px] text-secondary leading-normal italic">
                                        Your request will be reviewed by an administrator. You will be notified once a decision is made.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setShowRequestForm(false)} className="btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary flex items-center gap-2">
                                    <Send size={16} />
                                    <span>Submit Request</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

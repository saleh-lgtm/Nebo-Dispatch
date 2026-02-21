"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Clock, Calendar, Shield, TrendingUp, ClipboardList } from "lucide-react";
import { createActiveShift } from "@/lib/actions";
import { useState } from "react";

export default function DashboardClient({ initialStats }: any) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    if (!session) return null;

    const isAdmin = session.user.role === "ADMIN";
    const hasActiveShift = initialStats.activeShift !== null;

    const handleClockToggle = async () => {
        setLoading(true);
        if (hasActiveShift) {
            router.push("/reports/shift");
        } else {
            await createActiveShift(session.user.id);
            router.refresh();
        }
        setLoading(false);
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: "2rem" }}>
                <h1 className="font-display" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                    Welcome, {session.user.name}
                </h1>
                <p style={{ color: "var(--text-secondary)" }}>
                    {isAdmin ? "Administrator Dashboard" : "Dispatcher Portal"} &bull; {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
            </header>

            <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
                <div className="glass-card">
                    <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                        <div style={{ padding: "0.75rem", background: "rgba(183, 175, 163, 0.1)", borderRadius: "0.75rem", color: "var(--accent)" }}>
                            <Clock size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Status</p>
                            <h3 style={{ fontSize: "1.25rem" }}>{hasActiveShift ? "Shift Active" : "Off Duty"}</h3>
                        </div>
                    </div>
                    <button
                        onClick={handleClockToggle}
                        className="btn btn-primary"
                        style={{ width: "100%" }}
                        disabled={loading}
                    >
                        {hasActiveShift ? "Submit Shift Report" : "Clock In"}
                    </button>
                </div>

                <div className="glass-card">
                    <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                        <div style={{ padding: "0.75rem", background: "rgba(16, 185, 129, 0.1)", borderRadius: "0.75rem", color: "var(--success)" }}>
                            <Calendar size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Next Shift</p>
                            <h3 style={{ fontSize: "1.25rem" }}>Today, 4:00 PM</h3>
                        </div>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>8 hours scheduled</p>
                </div>

                {isAdmin && (
                    <div className="glass-card">
                        <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                            <div style={{ padding: "0.75rem", background: "rgba(183, 175, 163, 0.1)", borderRadius: "0.75rem", color: "var(--accent)" }}>
                                <Shield size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total Users</p>
                                <h3 style={{ fontSize: "1.25rem" }}>{initialStats.userCount} Active</h3>
                            </div>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Manage team access</p>
                    </div>
                )}

                <div className="glass-card">
                    <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                        <div style={{ padding: "0.75rem", background: "rgba(139, 92, 246, 0.1)", borderRadius: "0.75rem", color: "#8b5cf6" }}>
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Performance</p>
                            <h3 style={{ fontSize: "1.25rem" }}>N/A</h3>
                        </div>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>0 reports this week</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
                <section className="glass-card">
                    <h2 className="font-display" style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Recent Activity</h2>
                    <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "3rem 0" }}>
                        <ClipboardList size={48} style={{ opacity: 0.2, marginBottom: "1rem" }} />
                        <p>No recent shifts found. Start your first shift to see history.</p>
                    </div>
                </section>

                <section className="glass-card" style={{ background: "var(--bg-secondary)" }}>
                    <h2 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Global Notes</h2>
                    <div className="flex flex-col gap-4">
                        <div style={{ padding: "1rem", borderLeft: "4px solid var(--accent)", background: "var(--bg-primary)", borderRadius: "0.5rem" }}>
                            <h4 style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>Welcome to the Nebo Dispatch Portal</h4>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>The system has been updated with detailed reporting for reservations and shift tasks.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

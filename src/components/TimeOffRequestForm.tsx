"use client";

import { useState } from "react";
import { Calendar, Clock, Send, X } from "lucide-react";
import { requestTimeOff, TimeOffType } from "@/lib/timeOffActions";

interface Props {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function TimeOffRequestForm({ onSuccess, onCancel }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        startDate: "",
        endDate: "",
        type: "VACATION" as TimeOffType,
        reason: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.startDate || !form.endDate) {
            setError("Please select both start and end dates");
            return;
        }

        if (!form.reason.trim()) {
            setError("Please provide a reason for your time off request");
            return;
        }

        setLoading(true);
        try {
            await requestTimeOff(
                new Date(form.startDate),
                new Date(form.endDate),
                form.reason.trim(),
                form.type
            );
            setForm({ startDate: "", endDate: "", type: "VACATION", reason: "" });
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit request");
        }
        setLoading(false);
    };

    const timeOffTypes: { value: TimeOffType; label: string }[] = [
        { value: "VACATION", label: "Vacation" },
        { value: "SICK", label: "Sick Leave" },
        { value: "PERSONAL", label: "Personal" },
        { value: "OTHER", label: "Other" },
    ];

    // Get today's date in YYYY-MM-DD format for min date
    const today = new Date().toISOString().split("T")[0];

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                <Calendar size={20} style={{ color: "var(--accent)" }} />
                <h3 className="font-display" style={{ fontSize: "1.25rem" }}>
                    Request Time Off
                </h3>
            </div>

            {error && (
                <div
                    style={{
                        padding: "0.75rem 1rem",
                        marginBottom: "1rem",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid var(--danger)",
                        borderRadius: "0.5rem",
                        color: "var(--danger)",
                        fontSize: "0.875rem",
                    }}
                >
                    {error}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Date Range */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                        <label
                            style={{
                                fontSize: "0.875rem",
                                color: "var(--text-secondary)",
                                display: "block",
                                marginBottom: "0.5rem",
                            }}
                        >
                            Start Date *
                        </label>
                        <input
                            className="input"
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                            min={today}
                            required
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                fontSize: "0.875rem",
                                color: "var(--text-secondary)",
                                display: "block",
                                marginBottom: "0.5rem",
                            }}
                        >
                            End Date *
                        </label>
                        <input
                            className="input"
                            type="date"
                            value={form.endDate}
                            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                            min={form.startDate || today}
                            required
                            style={{ width: "100%" }}
                        />
                    </div>
                </div>

                {/* Type Selection */}
                <div>
                    <label
                        style={{
                            fontSize: "0.875rem",
                            color: "var(--text-secondary)",
                            display: "block",
                            marginBottom: "0.5rem",
                        }}
                    >
                        Type *
                    </label>
                    <select
                        className="input"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value as TimeOffType })}
                        required
                        style={{ width: "100%" }}
                    >
                        {timeOffTypes.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Reason */}
                <div>
                    <label
                        style={{
                            fontSize: "0.875rem",
                            color: "var(--text-secondary)",
                            display: "block",
                            marginBottom: "0.5rem",
                        }}
                    >
                        Reason *
                    </label>
                    <textarea
                        className="input"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="Please provide details for your time off request..."
                        required
                        style={{ width: "100%", height: "100px", resize: "none" }}
                    />
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                    >
                        {loading ? (
                            <>
                                <Clock size={16} style={{ animation: "spin 1s linear infinite" }} />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Submit Request
                            </>
                        )}
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn btn-secondary"
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                        >
                            <X size={16} />
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </form>
    );
}

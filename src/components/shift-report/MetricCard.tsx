"use client";

import { memo } from "react";
import { Plus, Minus } from "lucide-react";
import { ColorTheme, THEME_COLORS } from "@/types/shift-report";

interface MetricCardProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    icon: React.ReactNode;
    color: ColorTheme;
}

const MetricCard = memo(function MetricCard({ label, value, onChange, icon, color }: MetricCardProps) {
    const c = THEME_COLORS[color];

    return (
        <div
            className="metric-card"
            style={{
                padding: "1rem",
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: "12px",
            }}
        >
            <div className="metric-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ color: c.text }}>{icon}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
            </div>
            <div className="metric-controls" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, value - 1))}
                    className="metric-btn"
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
                <span
                    className="metric-value"
                    style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: "1.75rem",
                        fontWeight: 700,
                        color: value > 0 ? c.text : "var(--text-secondary)",
                    }}
                >
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(value + 1)}
                    className="metric-btn"
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

export default MetricCard;

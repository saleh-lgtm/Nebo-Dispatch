"use client";

import { Plus, Trash2, Flag, AlertOctagon } from "lucide-react";
import { ReservationEntry, FLAG_REASONS, ColorTheme } from "@/types/shift-report";

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    green: { bg: "rgba(34, 197, 94, 0.05)", border: "rgba(34, 197, 94, 0.15)", text: "#4ade80" },
    blue: { bg: "rgba(59, 130, 246, 0.05)", border: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" },
    red: { bg: "rgba(239, 68, 68, 0.05)", border: "rgba(239, 68, 68, 0.15)", text: "#f87171" },
};

interface ReservationSectionProps {
    title: string;
    data: ReservationEntry[];
    onAdd: () => void;
    onUpdate: (index: number, field: keyof ReservationEntry, value: string | boolean) => void;
    onRemove: (index: number) => void;
    color: "green" | "blue" | "red";
}

export default function ReservationSection({
    title,
    data,
    onAdd,
    onUpdate,
    onRemove,
    color,
}: ReservationSectionProps) {
    const c = SECTION_COLORS[color] || SECTION_COLORS.blue;

    return (
        <div
            className="reservation-section"
            style={{
                padding: "1rem",
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: "12px",
            }}
        >
            <div
                className="section-header"
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                }}
            >
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: c.text }}>{title}</h3>
                <button
                    onClick={onAdd}
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

            <div className="entries-list" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {data.map((item, index) => (
                    <ReservationEntryItem
                        key={index}
                        item={item}
                        index={index}
                        onUpdate={onUpdate}
                        onRemove={onRemove}
                        sectionColor={c}
                    />
                ))}
                {data.length === 0 && (
                    <p
                        style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            fontStyle: "italic",
                            textAlign: "center",
                            padding: "0.5rem",
                        }}
                    >
                        No entries
                    </p>
                )}
            </div>
        </div>
    );
}

interface ReservationEntryItemProps {
    item: ReservationEntry;
    index: number;
    onUpdate: (index: number, field: keyof ReservationEntry, value: string | boolean) => void;
    onRemove: (index: number) => void;
    sectionColor: { bg: string; border: string; text: string };
}

function ReservationEntryItem({ item, index, onUpdate, onRemove, sectionColor }: ReservationEntryItemProps) {
    const handleToggleFlag = () => {
        if (item.flaggedForAccounting) {
            onUpdate(index, "flaggedForAccounting", false);
            onUpdate(index, "flagReason", "");
        } else {
            onUpdate(index, "flaggedForAccounting", true);
        }
    };

    return (
        <div
            className="entry-item"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: item.flaggedForAccounting ? "0.75rem" : "0",
                background: item.flaggedForAccounting ? "rgba(245, 158, 11, 0.08)" : "transparent",
                border: item.flaggedForAccounting ? "1px solid rgba(245, 158, 11, 0.25)" : "none",
                borderRadius: "8px",
                transition: "all 0.2s",
            }}
        >
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                    placeholder="Res #"
                    value={item.id}
                    onChange={(e) => onUpdate(index, "id", e.target.value)}
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
                    onChange={(e) => onUpdate(index, "notes", e.target.value)}
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
                    onClick={handleToggleFlag}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.625rem",
                        background: item.flaggedForAccounting
                            ? "rgba(245, 158, 11, 0.25)"
                            : "rgba(255, 255, 255, 0.05)",
                        border: item.flaggedForAccounting
                            ? "1px solid rgba(245, 158, 11, 0.5)"
                            : "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "6px",
                        color: item.flaggedForAccounting ? "#fbbf24" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                    }}
                >
                    <Flag size={12} />
                    {item.flaggedForAccounting ? "Flagged" : "Flag"}
                </button>
                <button
                    onClick={() => onRemove(index)}
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
                <FlagReasonSelector
                    value={item.flagReason || ""}
                    onChange={(value) => onUpdate(index, "flagReason", value)}
                />
            )}
        </div>
    );
}

interface FlagReasonSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

function FlagReasonSelector({ value, onChange }: FlagReasonSelectorProps) {
    const isPresetReason = FLAG_REASONS.includes(value as typeof FLAG_REASONS[number]);
    const selectValue = isPresetReason ? value : (value ? "Other" : "");

    return (
        <div
            className="flag-reason"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                paddingTop: "0.25rem",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.7rem",
                    color: "#fbbf24",
                    fontWeight: 500,
                }}
            >
                <AlertOctagon size={12} />
                <span>Flagged for Accounting Review</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <select
                    value={selectValue}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === "Other") {
                            onChange("");
                        } else {
                            onChange(val);
                        }
                    }}
                    style={{
                        flex: 1,
                        minWidth: "150px",
                        padding: "0.5rem",
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "6px",
                        color: "var(--text-primary)",
                        fontSize: "0.75rem",
                    }}
                >
                    <option value="">Select reason...</option>
                    {FLAG_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                            {reason}
                        </option>
                    ))}
                </select>
                {(!isPresetReason || selectValue === "Other" || !value) && (
                    <input
                        placeholder="Specify reason..."
                        value={isPresetReason ? "" : value}
                        onChange={(e) => onChange(e.target.value)}
                        style={{
                            flex: 2,
                            minWidth: "150px",
                            padding: "0.5rem",
                            background: "rgba(0, 0, 0, 0.3)",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            borderRadius: "6px",
                            color: "var(--text-primary)",
                            fontSize: "0.75rem",
                        }}
                    />
                )}
            </div>
        </div>
    );
}

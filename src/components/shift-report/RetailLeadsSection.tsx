"use client";

import { Plus, Trash2, PhoneCall, ThumbsUp, ThumbsDown, AlertOctagon } from "lucide-react";
import { RetailLeadEntry, RetailLeadOutcome, LostReason } from "@/types/shift-report";

interface RetailLeadsSectionProps {
    leads: RetailLeadEntry[];
    onAdd: () => void;
    onUpdate: (index: number, updates: Partial<RetailLeadEntry>) => void;
    onRemove: (index: number) => void;
}

export default function RetailLeadsSection({
    leads,
    onAdd,
    onUpdate,
    onRemove,
}: RetailLeadsSectionProps) {
    return (
        <section className="report-card">
            <div className="card-header">
                <div className="card-icon card-icon-purple">
                    <PhoneCall size={18} />
                </div>
                <h2 className="card-title">Retail Calls</h2>
                <span className="retail-count">{leads.length}</span>
                <button type="button" onClick={onAdd} className="add-retail-btn">
                    <Plus size={16} />
                    Add Call
                </button>
            </div>

            {leads.length === 0 ? (
                <EmptyState onAdd={onAdd} />
            ) : (
                <div className="retail-list">
                    {leads.map((lead, index) => (
                        <RetailLeadItem
                            key={index}
                            lead={lead}
                            index={index}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                        />
                    ))}
                </div>
            )}

            <style jsx>{`
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

                .card-icon-purple {
                    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%);
                    color: #c084fc;
                }

                .card-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

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

                .retail-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
            `}</style>
        </section>
    );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <>
            <div className="empty-retail">
                <PhoneCall size={32} />
                <p>No retail calls logged yet</p>
                <button type="button" onClick={onAdd} className="add-retail-btn-large">
                    <Plus size={18} />
                    Log First Call
                </button>
            </div>
            <style jsx>{`
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
            `}</style>
        </>
    );
}

interface RetailLeadItemProps {
    lead: RetailLeadEntry;
    index: number;
    onUpdate: (index: number, updates: Partial<RetailLeadEntry>) => void;
    onRemove: (index: number) => void;
}

function RetailLeadItem({ lead, index, onUpdate, onRemove }: RetailLeadItemProps) {
    const handleOutcomeChange = (outcome: RetailLeadOutcome) => {
        if (outcome === "LOST") {
            onUpdate(index, { outcome });
        } else {
            onUpdate(index, { outcome, lostReason: undefined, lostReasonOther: undefined });
        }
    };

    return (
        <>
            <div className="retail-item">
                <div className="retail-header">
                    <span className="retail-number">Call #{index + 1}</span>
                    <button type="button" onClick={() => onRemove(index)} className="retail-remove">
                        <Trash2 size={14} />
                    </button>
                </div>

                <div className="retail-field">
                    <label>What did they request?</label>
                    <input
                        type="text"
                        value={lead.serviceRequested}
                        onChange={(e) => onUpdate(index, { serviceRequested: e.target.value })}
                        placeholder="e.g., Airport transfer, hourly service..."
                    />
                </div>

                <div className="retail-field">
                    <label>Outcome</label>
                    <div className="outcome-buttons">
                        <button
                            type="button"
                            className={`outcome-btn outcome-won ${lead.outcome === "WON" ? "active" : ""}`}
                            onClick={() => handleOutcomeChange("WON")}
                        >
                            <ThumbsUp size={14} />
                            <span>Won</span>
                        </button>
                        <button
                            type="button"
                            className={`outcome-btn outcome-followup ${lead.outcome === "NEEDS_FOLLOW_UP" ? "active" : ""}`}
                            onClick={() => handleOutcomeChange("NEEDS_FOLLOW_UP")}
                        >
                            <AlertOctagon size={14} />
                            <span>Follow Up</span>
                        </button>
                        <button
                            type="button"
                            className={`outcome-btn outcome-lost ${lead.outcome === "LOST" ? "active" : ""}`}
                            onClick={() => handleOutcomeChange("LOST")}
                        >
                            <ThumbsDown size={14} />
                            <span>Lost</span>
                        </button>
                    </div>
                </div>

                {lead.outcome === "LOST" && (
                    <LostReasonSelector
                        reason={lead.lostReason}
                        otherReason={lead.lostReasonOther}
                        onReasonChange={(reason) => onUpdate(index, { lostReason: reason })}
                        onOtherReasonChange={(text) => onUpdate(index, { lostReasonOther: text })}
                    />
                )}

                <div className="retail-field">
                    <label>Notes (optional)</label>
                    <input
                        type="text"
                        value={lead.notes || ""}
                        onChange={(e) => onUpdate(index, { notes: e.target.value })}
                        placeholder="Additional details..."
                    />
                </div>
            </div>

            <style jsx>{`
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
            `}</style>
        </>
    );
}

interface LostReasonSelectorProps {
    reason?: LostReason;
    otherReason?: string;
    onReasonChange: (reason: LostReason) => void;
    onOtherReasonChange: (text: string) => void;
}

function LostReasonSelector({ reason, otherReason, onReasonChange, onOtherReasonChange }: LostReasonSelectorProps) {
    const reasons: LostReason[] = ["VEHICLE_TYPE", "AVAILABILITY", "PRICING", "OTHER"];
    const labels: Record<LostReason, string> = {
        VEHICLE_TYPE: "Vehicle Type",
        AVAILABILITY: "Availability",
        PRICING: "Pricing",
        OTHER: "Other",
    };

    return (
        <>
            <div className="retail-field">
                <label>Why did we lose it?</label>
                <div className="lost-reason-buttons">
                    {reasons.map((r) => (
                        <button
                            key={r}
                            type="button"
                            className={`reason-btn ${reason === r ? "active" : ""}`}
                            onClick={() => onReasonChange(r)}
                        >
                            {labels[r]}
                        </button>
                    ))}
                </div>
                {reason === "OTHER" && (
                    <input
                        type="text"
                        value={otherReason || ""}
                        onChange={(e) => onOtherReasonChange(e.target.value)}
                        placeholder="Specify other reason..."
                        className="other-reason-input"
                    />
                )}
            </div>
            <style jsx>{`
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
                    width: 100%;
                    margin-top: 0.5rem;
                    padding: 0.625rem 0.75rem;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .other-reason-input:focus {
                    outline: none;
                    border-color: #c084fc;
                }
            `}</style>
        </>
    );
}

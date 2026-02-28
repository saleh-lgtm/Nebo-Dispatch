"use client";

import { AlertCircle, MessageSquare, Lightbulb } from "lucide-react";
import { Narrative } from "@/types/shift-report";

interface NarrativeSectionProps {
    narrative: Narrative;
    handoffNotes: string;
    onNarrativeChange: (narrative: Narrative) => void;
    onHandoffNotesChange: (notes: string) => void;
}

export default function NarrativeSection({
    narrative,
    handoffNotes,
    onNarrativeChange,
    onHandoffNotesChange,
}: NarrativeSectionProps) {
    return (
        <section className="report-card">
            <div className="card-header">
                <div className="card-icon card-icon-red">
                    <AlertCircle size={18} />
                </div>
                <h2 className="card-title">Notes & Feedback</h2>
            </div>

            <div className="notes-grid">
                {/* Handoff Notes - Most Important */}
                <div className="note-field note-field-highlight">
                    <label className="note-label note-label-warning">
                        <MessageSquare size={14} />
                        <span>Handoff Notes (for next dispatcher)</span>
                    </label>
                    <textarea
                        className="note-input"
                        value={handoffNotes}
                        onChange={(e) => onHandoffNotesChange(e.target.value)}
                        placeholder="Important info for the next dispatcher taking over..."
                    />
                </div>

                {/* Incidents */}
                <div className="note-field">
                    <label className="note-label note-label-red">
                        <AlertCircle size={14} />
                        <span>Incidents / Deviations</span>
                    </label>
                    <textarea
                        className="note-input"
                        value={narrative.incidents}
                        onChange={(e) => onNarrativeChange({ ...narrative, incidents: e.target.value })}
                        placeholder="Report any incidents, deviations, or issues..."
                    />
                </div>

                {/* General Comments */}
                <div className="note-field">
                    <label className="note-label">
                        <MessageSquare size={14} />
                        <span>General Comments</span>
                    </label>
                    <textarea
                        className="note-input"
                        value={narrative.comments}
                        onChange={(e) => onNarrativeChange({ ...narrative, comments: e.target.value })}
                        placeholder="Any other comments about your shift..."
                    />
                </div>

                {/* Ideas */}
                <div className="note-field">
                    <label className="note-label note-label-accent">
                        <Lightbulb size={14} />
                        <span>Ideas & Suggestions</span>
                    </label>
                    <textarea
                        className="note-input"
                        value={narrative.ideas}
                        onChange={(e) => onNarrativeChange({ ...narrative, ideas: e.target.value })}
                        placeholder="Ideas to improve processes or service..."
                    />
                </div>
            </div>

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

                .card-icon-red {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
                    color: #f87171;
                }

                .card-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
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

                .note-field-highlight {
                    background: rgba(245, 158, 11, 0.08);
                    border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 12px;
                    padding: 1rem;
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

                .note-label-warning {
                    color: #fbbf24;
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
                    font-family: inherit;
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
            `}</style>
        </section>
    );
}

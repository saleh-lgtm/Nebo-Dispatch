"use client";

import { Building2, AlertTriangle, Check, FileSearch } from "lucide-react";

export interface AffiliateAuditEntry {
    affiliateId: string;
    affiliateName: string;
    portalTripCount: number | null;
    laTripCount: number | null;
    hasDiscrepancy: boolean;
    notes: string;
    auditedAt?: string;
}

interface AffiliateAuditSectionProps {
    audits: AffiliateAuditEntry[];
    onUpdate: (index: number, updates: Partial<AffiliateAuditEntry>) => void;
}

export default function AffiliateAuditSection({
    audits,
    onUpdate,
}: AffiliateAuditSectionProps) {
    // Calculate stats
    const totalAudits = audits.length;
    const completedAudits = audits.filter(
        (a) => a.portalTripCount !== null || a.laTripCount !== null
    ).length;
    const discrepancies = audits.filter((a) => a.hasDiscrepancy).length;

    if (totalAudits === 0) {
        return null; // Don't render if no affiliates configured
    }

    return (
        <section className="report-card">
            <div className="card-header">
                <div className="card-icon card-icon-cyan">
                    <FileSearch size={18} />
                </div>
                <h2 className="card-title">Affiliate Portal Audit</h2>
                <span className="audit-progress">
                    {completedAudits}/{totalAudits}
                </span>
                {discrepancies > 0 && (
                    <span className="discrepancy-badge">
                        <AlertTriangle size={12} />
                        {discrepancies} discrepancy{discrepancies > 1 ? "ies" : ""}
                    </span>
                )}
            </div>

            <p className="section-description">
                Compare trip counts between affiliate portals and Limo Anywhere
            </p>

            <div className="audit-list">
                {audits.map((audit, index) => (
                    <AffiliateAuditItem
                        key={audit.affiliateId}
                        audit={audit}
                        index={index}
                        onUpdate={onUpdate}
                    />
                ))}
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
                    margin-bottom: 0.5rem;
                    flex-wrap: wrap;
                }

                .card-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .card-icon-cyan {
                    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%);
                    color: #22d3ee;
                }

                .card-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .audit-progress {
                    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .discrepancy-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.125rem 0.5rem;
                    background: rgba(245, 158, 11, 0.2);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    color: #fbbf24;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-left: auto;
                }

                .section-description {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .audit-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
            `}</style>
        </section>
    );
}

interface AffiliateAuditItemProps {
    audit: AffiliateAuditEntry;
    index: number;
    onUpdate: (index: number, updates: Partial<AffiliateAuditEntry>) => void;
}

function AffiliateAuditItem({ audit, index, onUpdate }: AffiliateAuditItemProps) {
    const handleCountChange = (
        field: "portalTripCount" | "laTripCount",
        value: string
    ) => {
        const numValue = value === "" ? null : parseInt(value, 10);
        if (value !== "" && isNaN(numValue as number)) return;

        // Auto-detect discrepancy
        const otherField = field === "portalTripCount" ? "laTripCount" : "portalTripCount";
        const otherValue = audit[otherField];
        const hasDiscrepancy =
            numValue !== null && otherValue !== null && numValue !== otherValue;

        onUpdate(index, {
            [field]: numValue,
            hasDiscrepancy,
            auditedAt: new Date().toISOString(),
        });
    };

    const isComplete = audit.portalTripCount !== null || audit.laTripCount !== null;
    const isMatched = !audit.hasDiscrepancy && audit.portalTripCount !== null && audit.laTripCount !== null;

    return (
        <div className={`audit-item ${audit.hasDiscrepancy ? "has-discrepancy" : ""}`}>
            <div className="audit-header">
                <Building2 size={16} className="affiliate-icon" />
                <span className="affiliate-name">{audit.affiliateName}</span>
                {audit.hasDiscrepancy && (
                    <span className="status-flag discrepancy">
                        <AlertTriangle size={12} />
                        Discrepancy
                    </span>
                )}
                {isMatched && (
                    <span className="status-flag matched">
                        <Check size={12} />
                        Matched
                    </span>
                )}
            </div>

            <div className="audit-counts">
                <div className="count-field">
                    <label>Portal Count</label>
                    <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={audit.portalTripCount ?? ""}
                        onChange={(e) => handleCountChange("portalTripCount", e.target.value)}
                        placeholder="—"
                    />
                </div>
                <div className="count-separator">vs</div>
                <div className="count-field">
                    <label>LA Count</label>
                    <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={audit.laTripCount ?? ""}
                        onChange={(e) => handleCountChange("laTripCount", e.target.value)}
                        placeholder="—"
                    />
                </div>
            </div>

            <div className="audit-notes">
                <input
                    type="text"
                    value={audit.notes}
                    onChange={(e) => onUpdate(index, { notes: e.target.value })}
                    placeholder="Notes (optional)..."
                />
            </div>

            <style jsx>{`
                .audit-item {
                    padding: 1rem;
                    background: rgba(6, 182, 212, 0.05);
                    border: 1px solid rgba(6, 182, 212, 0.15);
                    border-radius: 12px;
                    transition: all 0.2s;
                }

                .audit-item.has-discrepancy {
                    background: rgba(245, 158, 11, 0.08);
                    border-color: rgba(245, 158, 11, 0.25);
                }

                .audit-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                }

                .audit-header :global(.affiliate-icon) {
                    color: #22d3ee;
                    flex-shrink: 0;
                }

                .affiliate-name {
                    font-weight: 500;
                    color: var(--text-primary);
                    flex: 1;
                }

                .status-flag {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .status-flag.discrepancy {
                    background: rgba(245, 158, 11, 0.2);
                    color: #fbbf24;
                }

                .status-flag.matched {
                    background: rgba(34, 197, 94, 0.2);
                    color: #4ade80;
                }

                .audit-counts {
                    display: flex;
                    align-items: flex-end;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                }

                .count-field {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .count-field label {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .count-field input {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 1rem;
                    font-weight: 500;
                    text-align: center;
                    transition: all 0.2s;
                }

                .count-field input:focus {
                    outline: none;
                    border-color: #22d3ee;
                    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
                }

                .count-field input::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.5;
                }

                .count-separator {
                    padding-bottom: 0.5rem;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }

                .audit-notes input {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    background: rgba(0, 0, 0, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }

                .audit-notes input:focus {
                    outline: none;
                    border-color: rgba(6, 182, 212, 0.5);
                }

                .audit-notes input::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                @media (max-width: 480px) {
                    .audit-counts {
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    .count-separator {
                        display: none;
                    }
                    .count-field input {
                        text-align: left;
                    }
                }
            `}</style>
        </div>
    );
}

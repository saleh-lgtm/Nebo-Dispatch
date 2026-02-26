"use client";

import { Plus, Trash2, Receipt, DollarSign, Clock, MapPin, Calendar } from "lucide-react";
import { BillingReviewReason } from "@prisma/client";

export interface BillingReviewEntry {
    tripNumber: string;
    passengerName?: string;
    tripDate?: string;
    reason: BillingReviewReason;
    reasonOther?: string;
    amount?: number;
    notes?: string;
}

interface BillingReviewSectionProps {
    reviews: BillingReviewEntry[];
    onAdd: () => void;
    onUpdate: (index: number, updates: Partial<BillingReviewEntry>) => void;
    onRemove: (index: number) => void;
}

const BILLING_REASONS: { value: BillingReviewReason; label: string; icon: string }[] = [
    { value: "EXTRA_WAITING_TIME", label: "Extra Waiting Time", icon: "clock" },
    { value: "EXTRA_STOPS", label: "Additional Stops", icon: "map" },
    { value: "ROUTE_CHANGE", label: "Route Change", icon: "map" },
    { value: "TOLL_FEES", label: "Toll Fees", icon: "dollar" },
    { value: "PARKING_FEES", label: "Parking Fees", icon: "dollar" },
    { value: "GRATUITY_ADJUSTMENT", label: "Gratuity Adjustment", icon: "dollar" },
    { value: "PRICE_CORRECTION", label: "Price Correction", icon: "dollar" },
    { value: "NO_SHOW_CHARGE", label: "No-Show Charge", icon: "alert" },
    { value: "CANCELLATION_FEE", label: "Cancellation Fee", icon: "alert" },
    { value: "DAMAGE_CHARGE", label: "Damage/Cleaning", icon: "alert" },
    { value: "AFFILIATE_BILLING", label: "Affiliate Billing", icon: "building" },
    { value: "OTHER", label: "Other", icon: "other" },
];

export default function BillingReviewSection({
    reviews,
    onAdd,
    onUpdate,
    onRemove,
}: BillingReviewSectionProps) {
    return (
        <section className="report-card">
            <div className="card-header">
                <div className="card-icon card-icon-amber">
                    <Receipt size={18} />
                </div>
                <h2 className="card-title">Trips for Billing Review</h2>
                <span className="review-count">{reviews.length}</span>
                <button type="button" onClick={onAdd} className="add-review-btn">
                    <Plus size={16} />
                    Add Trip
                </button>
            </div>

            <p className="section-description">
                Flag trips that need accounting review (extra charges, adjustments, etc.)
            </p>

            {reviews.length === 0 ? (
                <EmptyState onAdd={onAdd} />
            ) : (
                <div className="review-list">
                    {reviews.map((review, index) => (
                        <BillingReviewItem
                            key={index}
                            review={review}
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
                    margin-bottom: 0.5rem;
                }

                .card-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .card-icon-amber {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%);
                    color: #fbbf24;
                }

                .card-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .review-count {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .add-review-btn {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    background: rgba(245, 158, 11, 0.15);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 8px;
                    color: #fbbf24;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-review-btn:hover {
                    background: rgba(245, 158, 11, 0.25);
                    border-color: rgba(245, 158, 11, 0.5);
                }

                .section-description {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .review-list {
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
        <div className="empty-state">
            <div className="empty-icon">
                <Receipt size={32} />
            </div>
            <p>No trips flagged for billing review</p>
            <button type="button" onClick={onAdd} className="empty-add-btn">
                <Plus size={16} />
                Flag a Trip
            </button>

            <style jsx>{`
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 2rem;
                    color: var(--text-secondary);
                    text-align: center;
                }

                .empty-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: rgba(245, 158, 11, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 1rem;
                    color: #fbbf24;
                }

                .empty-state p {
                    margin-bottom: 1rem;
                }

                .empty-add-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 1rem;
                    background: rgba(245, 158, 11, 0.15);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 8px;
                    color: #fbbf24;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .empty-add-btn:hover {
                    background: rgba(245, 158, 11, 0.25);
                }
            `}</style>
        </div>
    );
}

function BillingReviewItem({
    review,
    index,
    onUpdate,
    onRemove,
}: {
    review: BillingReviewEntry;
    index: number;
    onUpdate: (index: number, updates: Partial<BillingReviewEntry>) => void;
    onRemove: (index: number) => void;
}) {
    return (
        <div className="review-item">
            <div className="review-header">
                <span className="review-number">#{index + 1}</span>
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="remove-btn"
                    aria-label="Remove"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="review-grid">
                <div className="field-group">
                    <label className="field-label">
                        <Receipt size={14} />
                        Trip/Confirmation #
                        <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        value={review.tripNumber}
                        onChange={(e) => onUpdate(index, { tripNumber: e.target.value })}
                        placeholder="e.g., 12345 or CONF-ABC"
                        className="field-input"
                        required
                    />
                </div>

                <div className="field-group">
                    <label className="field-label">
                        <Calendar size={14} />
                        Trip Date
                    </label>
                    <input
                        type="date"
                        value={review.tripDate || ""}
                        onChange={(e) => onUpdate(index, { tripDate: e.target.value })}
                        className="field-input"
                    />
                </div>

                <div className="field-group">
                    <label className="field-label">
                        Passenger Name
                    </label>
                    <input
                        type="text"
                        value={review.passengerName || ""}
                        onChange={(e) => onUpdate(index, { passengerName: e.target.value })}
                        placeholder="Optional"
                        className="field-input"
                    />
                </div>

                <div className="field-group">
                    <label className="field-label">
                        <DollarSign size={14} />
                        Amount to Add/Adjust
                    </label>
                    <input
                        type="number"
                        value={review.amount || ""}
                        onChange={(e) => onUpdate(index, { amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="$0.00"
                        className="field-input"
                        step="0.01"
                        min="0"
                    />
                </div>
            </div>

            <div className="field-group reason-group">
                <label className="field-label">
                    Reason for Review
                    <span className="required">*</span>
                </label>
                <div className="reason-grid">
                    {BILLING_REASONS.map((reason) => (
                        <button
                            key={reason.value}
                            type="button"
                            onClick={() => onUpdate(index, { reason: reason.value })}
                            className={`reason-btn ${review.reason === reason.value ? "active" : ""}`}
                        >
                            {reason.value === "EXTRA_WAITING_TIME" && <Clock size={14} />}
                            {(reason.value === "EXTRA_STOPS" || reason.value === "ROUTE_CHANGE") && <MapPin size={14} />}
                            {(reason.value === "TOLL_FEES" || reason.value === "PARKING_FEES" || reason.value === "GRATUITY_ADJUSTMENT" || reason.value === "PRICE_CORRECTION") && <DollarSign size={14} />}
                            {reason.label}
                        </button>
                    ))}
                </div>
            </div>

            {review.reason === "OTHER" && (
                <div className="field-group">
                    <label className="field-label">
                        Specify Reason
                        <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        value={review.reasonOther || ""}
                        onChange={(e) => onUpdate(index, { reasonOther: e.target.value })}
                        placeholder="Please specify..."
                        className="field-input"
                        required
                    />
                </div>
            )}

            <div className="field-group">
                <label className="field-label">Notes</label>
                <textarea
                    value={review.notes || ""}
                    onChange={(e) => onUpdate(index, { notes: e.target.value })}
                    placeholder="Additional details for accounting..."
                    className="field-textarea"
                    rows={2}
                />
            </div>

            <style jsx>{`
                .review-item {
                    background: rgba(245, 158, 11, 0.05);
                    border: 1px solid rgba(245, 158, 11, 0.15);
                    border-radius: 12px;
                    padding: 1rem;
                }

                .review-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .review-number {
                    font-weight: 600;
                    color: #fbbf24;
                    font-size: 0.875rem;
                }

                .remove-btn {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 6px;
                    padding: 0.375rem;
                    color: #f87171;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .remove-btn:hover {
                    background: rgba(239, 68, 68, 0.2);
                }

                .review-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                @media (max-width: 640px) {
                    .review-grid {
                        grid-template-columns: 1fr;
                    }
                }

                .field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .reason-group {
                    margin-bottom: 1rem;
                }

                .field-label {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .required {
                    color: #f87171;
                }

                .field-input {
                    padding: 0.625rem 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }

                .field-input:focus {
                    outline: none;
                    border-color: rgba(245, 158, 11, 0.5);
                    background: rgba(255, 255, 255, 0.08);
                }

                .field-input::placeholder {
                    color: var(--text-tertiary);
                }

                .field-textarea {
                    padding: 0.625rem 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    resize: vertical;
                    font-family: inherit;
                    transition: all 0.2s;
                }

                .field-textarea:focus {
                    outline: none;
                    border-color: rgba(245, 158, 11, 0.5);
                    background: rgba(255, 255, 255, 0.08);
                }

                .field-textarea::placeholder {
                    color: var(--text-tertiary);
                }

                .reason-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                .reason-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.375rem 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .reason-btn:hover {
                    background: rgba(245, 158, 11, 0.1);
                    border-color: rgba(245, 158, 11, 0.3);
                }

                .reason-btn.active {
                    background: rgba(245, 158, 11, 0.2);
                    border-color: rgba(245, 158, 11, 0.5);
                    color: #fbbf24;
                }
            `}</style>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Plus, FileText, DollarSign, User, Phone, Mail, X } from "lucide-react";
import { Quote } from "@/types/shift-report";

interface QuotesSectionProps {
    quotes: Quote[];
    onAddQuote: (quoteData: QuoteFormData) => Promise<void>;
}

export interface QuoteFormData {
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    serviceType: string;
    estimatedAmount?: number;
    notes?: string;
}

export default function QuotesSection({ quotes, onAddQuote }: QuotesSectionProps) {
    const [showModal, setShowModal] = useState(false);

    const handleSubmit = async (data: QuoteFormData) => {
        await onAddQuote(data);
        setShowModal(false);
    };

    return (
        <section className="report-card">
            <div className="card-header">
                <div className="card-icon card-icon-green">
                    <FileText size={18} />
                </div>
                <h2 className="card-title">Quotes</h2>
                <span className="quote-count">{quotes.length}</span>
                <button onClick={() => setShowModal(true)} className="add-quote-btn">
                    <Plus size={16} />
                    Add Quote
                </button>
            </div>

            {quotes.length === 0 ? (
                <div className="empty-quotes">
                    <FileText size={32} />
                    <p>No quotes created during this shift</p>
                    <button onClick={() => setShowModal(true)} className="add-quote-btn-large">
                        <Plus size={18} />
                        Create First Quote
                    </button>
                </div>
            ) : (
                <div className="quotes-list">
                    {quotes.map((quote) => (
                        <QuoteItem key={quote.id} quote={quote} />
                    ))}
                </div>
            )}

            {showModal && (
                <AddQuoteModal onClose={() => setShowModal(false)} onSubmit={handleSubmit} />
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

                .card-icon-green {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
                    color: #4ade80;
                }

                .card-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .quote-count {
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .add-quote-btn {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 8px;
                    color: #4ade80;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-quote-btn:hover {
                    background: rgba(34, 197, 94, 0.25);
                    transform: translateY(-1px);
                }

                .empty-quotes {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem;
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                .empty-quotes p {
                    font-size: 0.875rem;
                }

                .add-quote-btn-large {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-quote-btn-large:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }

                .quotes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
            `}</style>
        </section>
    );
}

function QuoteItem({ quote }: { quote: Quote }) {
    return (
        <>
            <div className="quote-item">
                <div className="quote-item-header">
                    <div className="quote-client">
                        <User size={14} />
                        <span>{quote.clientName}</span>
                    </div>
                    {quote.estimatedAmount && (
                        <span className="quote-amount">
                            <DollarSign size={12} />
                            {quote.estimatedAmount}
                        </span>
                    )}
                </div>
                <div className="quote-details">
                    <span className="quote-service">{quote.serviceType}</span>
                    {quote.clientPhone && (
                        <span className="quote-contact">
                            <Phone size={12} />
                            {quote.clientPhone}
                        </span>
                    )}
                    {quote.clientEmail && (
                        <span className="quote-contact">
                            <Mail size={12} />
                            {quote.clientEmail}
                        </span>
                    )}
                </div>
                {quote.notes && <p className="quote-notes">{quote.notes}</p>}
            </div>
            <style jsx>{`
                .quote-item {
                    padding: 1rem;
                    background: rgba(34, 197, 94, 0.08);
                    border: 1px solid rgba(34, 197, 94, 0.15);
                    border-radius: 10px;
                }

                .quote-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .quote-client {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .quote-amount {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #4ade80;
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .quote-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .quote-service {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                    padding: 0.125rem 0.5rem;
                    border-radius: 4px;
                    font-weight: 500;
                }

                .quote-contact {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .quote-notes {
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    font-style: italic;
                }
            `}</style>
        </>
    );
}

interface AddQuoteModalProps {
    onClose: () => void;
    onSubmit: (data: QuoteFormData) => Promise<void>;
}

function AddQuoteModal({ onClose, onSubmit }: AddQuoteModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        serviceType: "",
        estimatedAmount: "",
        notes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientName || !form.serviceType) return;

        setLoading(true);
        await onSubmit({
            clientName: form.clientName,
            clientEmail: form.clientEmail || undefined,
            clientPhone: form.clientPhone || undefined,
            serviceType: form.serviceType,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
            notes: form.notes || undefined,
        });
        setLoading(false);
    };

    return (
        <>
            <div className="quote-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className="quote-modal">
                    <div className="quote-modal-header">
                        <h3>Add New Quote</h3>
                        <button onClick={onClose} className="close-btn">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="quote-form">
                        <div className="form-group">
                            <label>Client Name *</label>
                            <input
                                type="text"
                                value={form.clientName}
                                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                                placeholder="John Doe"
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={form.clientEmail}
                                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    value={form.clientPhone}
                                    onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Service Type *</label>
                                <select
                                    value={form.serviceType}
                                    onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                                    required
                                >
                                    <option value="">Select service...</option>
                                    <option value="Airport Transfer">Airport Transfer</option>
                                    <option value="Hourly Service">Hourly Service</option>
                                    <option value="Point to Point">Point to Point</option>
                                    <option value="City Tour">City Tour</option>
                                    <option value="Event Transportation">Event Transportation</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Estimated Amount</label>
                                <input
                                    type="number"
                                    value={form.estimatedAmount}
                                    onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })}
                                    placeholder="$0.00"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Additional details about the quote..."
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={onClose} className="cancel-btn">
                                Cancel
                            </button>
                            <button type="submit" className="submit-quote-btn" disabled={loading}>
                                {loading ? "Adding..." : "Add Quote"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .quote-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                }

                .quote-modal {
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.95) 0%, rgba(25, 25, 45, 0.98) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 500px;
                    padding: 1.5rem;
                }

                .quote-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .quote-modal-header h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.25rem;
                }

                .close-btn:hover {
                    color: var(--text-primary);
                }

                .quote-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .form-group label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 0.75rem;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    font-family: inherit;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .form-group textarea {
                    height: 80px;
                    resize: vertical;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }

                .cancel-btn {
                    padding: 0.75rem 1.25rem;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .cancel-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary);
                }

                .submit-quote-btn {
                    padding: 0.75rem 1.25rem;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .submit-quote-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }

                .submit-quote-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
            `}</style>
        </>
    );
}

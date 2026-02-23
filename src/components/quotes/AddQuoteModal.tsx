"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createQuote } from "@/lib/quoteActions";
import { useSession } from "next-auth/react";
import styles from "./AddQuoteModal.module.css";

interface Props {
    onClose: () => void;
}

export default function AddQuoteModal({ onClose }: Props) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        serviceType: "",
        source: "",
        dateOfService: "",
        estimatedAmount: "",
        notes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientName || !form.serviceType) return;

        setLoading(true);
        try {
            await createQuote({
                clientName: form.clientName,
                clientEmail: form.clientEmail || undefined,
                clientPhone: form.clientPhone || undefined,
                serviceType: form.serviceType,
                source: form.source || undefined,
                dateOfService: form.dateOfService ? new Date(form.dateOfService) : undefined,
                estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
                notes: form.notes || undefined,
            });
            router.refresh();
            onClose();
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Add New Quote</h3>
                    <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                </div>

                <div className={styles.creatorInfo}>
                    <div className={styles.creatorAvatar}>
                        {(session?.user?.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className={styles.creatorLabel}>Created by</p>
                        <p className={styles.creatorName}>{session?.user?.name || "You"}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label>Client Name *</label>
                        <input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="John Doe" required />
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Email</label>
                            <input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="john@example.com" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Phone</label>
                            <input type="tel" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="+1 234 567 8900" />
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Service Type *</label>
                            <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} required>
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
                        <div className={styles.formGroup}>
                            <label>Source</label>
                            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                                <option value="">Select source...</option>
                                <option value="Phone">Phone Call</option>
                                <option value="Email">Email</option>
                                <option value="Website">Website</option>
                                <option value="Walk-in">Walk-in</option>
                                <option value="Referral">Referral</option>
                                <option value="Social Media">Social Media</option>
                                <option value="Partner">Partner/Affiliate</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Date of Service</label>
                            <input type="date" value={form.dateOfService} onChange={(e) => setForm({ ...form, dateOfService: e.target.value })} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Estimated Amount</label>
                            <input type="number" value={form.estimatedAmount} onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })} placeholder="0.00" />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Notes</label>
                        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional details..." />
                    </div>

                    <div className={styles.infoBox}>
                        Quote will expire in 72 hours if no action is taken.
                    </div>

                    <div className={styles.formActions}>
                        <button type="submit" className={styles.btnPrimary} disabled={loading}>
                            {loading ? "Adding..." : "Add Quote"}
                        </button>
                        <button type="button" onClick={onClose} className={styles.btnSecondary}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

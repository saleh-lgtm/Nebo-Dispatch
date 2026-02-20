"use client";

import { useState } from "react";
import { Plus, Search, Globe, Mail, MapPin, DollarSign, Info, ShieldCheck } from "lucide-react";
import { submitAffiliate } from "@/lib/actions";

export default function AffiliateClient({ initialAffiliates, session }: any) {
    const [affiliates, setAffiliates] = useState(initialAffiliates);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        market: "",
        cityTransferRate: "",
        notes: ""
    });

    const filtered = affiliates.filter((a: any) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.market.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await submitAffiliate({
            ...formData,
            submittedById: session.user.id
        });
        if (res) {
            setShowForm(false);
            setFormData({ name: "", email: "", market: "", cityTransferRate: "", notes: "" });
            alert("Affiliate submitted for admin approval!");
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>Affiliate Directory</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Manage farm-out partners and network rates</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Add Affiliate</span>
                </button>
            </header>

            <div className="glass-card" style={{ padding: "1rem" }}>
                <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2 border border-white/10">
                    <Search size={18} className="text-accent" />
                    <input
                        type="text"
                        placeholder="Search by name or market..."
                        className="bg-transparent border-none outline-none flex-1 text-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.5rem" }}>
                {filtered.map((affiliate: any) => (
                    <div key={affiliate.id} className="glass-card flex flex-col gap-4 hover-lift">
                        <div className="flex justify-between items-start">
                            <h3 className="font-display" style={{ fontSize: "1.25rem", color: "var(--accent)" }}>{affiliate.name}</h3>
                            <div className="badge badge-success flex items-center gap-1">
                                <ShieldCheck size={12} /> Approved
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm text-secondary">
                                <MapPin size={14} className="text-accent" />
                                <span>{affiliate.market}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-secondary">
                                <Mail size={14} className="text-accent" />
                                <span>{affiliate.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-secondary">
                                <DollarSign size={14} className="text-accent" />
                                <span>Rate: {affiliate.cityTransferRate || "Not specified"}</span>
                            </div>
                        </div>

                        {affiliate.notes && (
                            <div className="bg-white/5 p-3 rounded-lg flex gap-3 items-start">
                                <Info size={16} className="text-accent mt-0.5" />
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{affiliate.notes}</p>
                            </div>
                        )}
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="glass-card text-center py-12" style={{ gridColumn: "1 / -1" }}>
                        <Globe size={48} className="text-accent mx-auto mb-4 opacity-50" />
                        <p style={{ color: "var(--text-secondary)" }}>No affiliates found matching your search.</p>
                    </div>
                )}
            </div>

            {/* Submission Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg animate-scale-in">
                        <h2 className="font-display mb-6" style={{ fontSize: "1.5rem" }}>Submit New Affiliate</h2>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">Company Name</label>
                                <input required className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">Email Address</label>
                                <input required type="email" className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="flex flex-row gap-4">
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-xs text-secondary uppercase tracking-wider font-bold">Market (City/State)</label>
                                    <input required className="input" value={formData.market} onChange={(e) => setFormData({ ...formData, market: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-xs text-secondary uppercase tracking-wider font-bold">Transfer Rate</label>
                                    <input className="input" value={formData.cityTransferRate} onChange={(e) => setFormData({ ...formData, cityTransferRate: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">Additional Notes</label>
                                <textarea className="input" style={{ height: "100px" }} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary">Submit for Approval</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

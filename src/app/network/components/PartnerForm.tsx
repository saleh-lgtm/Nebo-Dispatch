"use client";

import { useState } from "react";
import {
    ArrowDownLeft,
    ArrowUpRight,
    Car,
    Users,
    X,
} from "lucide-react";
import { type PartnerType } from "@/lib/networkActions";

interface PartnerFormData {
    name: string;
    email: string;
    phone?: string;
    type: PartnerType;
    state?: string;
    cities?: string[];
    notes?: string;
    cityTransferRate?: string;
    market?: string;
    employeeId?: string;
}

interface Props {
    onSubmit: (data: PartnerFormData) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
    defaultType?: PartnerType;
    initialData?: Partial<PartnerFormData & { cities: string[] }>;
    isEdit?: boolean;
}

const PARTNER_TYPES: { key: PartnerType; label: string; icon: typeof ArrowUpRight; description: string }[] = [
    { key: "FARM_OUT", label: "Farm Out", icon: ArrowUpRight, description: "Partners we send work to" },
    { key: "FARM_IN", label: "Farm In", icon: ArrowDownLeft, description: "Partners that send work to us" },
    { key: "IOS", label: "IOS", icon: Car, description: "Independent Operators" },
    { key: "HOUSE_CHAUFFEUR", label: "Chauffeur", icon: Users, description: "In-house drivers" },
];

export default function PartnerForm({
    onSubmit,
    onCancel,
    loading,
    defaultType = "FARM_OUT",
    initialData,
    isEdit = false,
}: Props) {
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        type: initialData?.type || defaultType,
        state: initialData?.state || "",
        cities: initialData?.cities || [] as string[],
        cityInput: "",
        cityTransferRate: initialData?.cityTransferRate || "",
        notes: initialData?.notes || "",
        market: initialData?.market || "",
        employeeId: initialData?.employeeId || "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate based on type
        if ((formData.type === "FARM_IN" || formData.type === "FARM_OUT") && formData.cities.length === 0) {
            alert("Please add at least one city");
            return;
        }

        await onSubmit({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || undefined,
            type: formData.type,
            state: formData.state || undefined,
            cities: formData.cities,
            cityTransferRate: formData.cityTransferRate || undefined,
            notes: formData.notes || undefined,
            market: formData.market || undefined,
            employeeId: formData.employeeId || undefined,
        });
    };

    const addCity = () => {
        const city = formData.cityInput.trim();
        if (city && !formData.cities.includes(city)) {
            setFormData({ ...formData, cities: [...formData.cities, city], cityInput: "" });
        }
    };

    const removeCity = (cityToRemove: string) => {
        setFormData({ ...formData, cities: formData.cities.filter(c => c !== cityToRemove) });
    };

    const showFarmFields = formData.type === "FARM_IN" || formData.type === "FARM_OUT";
    const showIOSFields = formData.type === "IOS";
    const showChauffeurFields = formData.type === "HOUSE_CHAUFFEUR";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Partner Type Selection (only for new partners) */}
            {!isEdit && (
                <div className="flex flex-col gap-2">
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Partner Type *
                    </label>
                    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                        {PARTNER_TYPES.map(({ key, label, icon: Icon, description }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFormData({ ...formData, type: key })}
                                className={`btn ${formData.type === key ? "btn-primary" : "btn-ghost"}`}
                                style={{ justifyContent: "flex-start", padding: "0.75rem" }}
                            >
                                <Icon size={16} />
                                <div style={{ textAlign: "left" }}>
                                    <div>{label}</div>
                                    <div style={{ fontSize: "0.65rem", opacity: 0.7 }}>{description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Common Fields */}
            <div className="flex flex-col gap-1">
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {showChauffeurFields ? "Full Name" : "Company Name"} *
                </label>
                <input
                    required
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
            </div>

            <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Email Address *
                    </label>
                    <input
                        required
                        type="email"
                        className="input"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>
                <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        className="input"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>
            </div>

            {/* Farm In/Out Fields */}
            {showFarmFields && (
                <>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                State *
                            </label>
                            <input
                                required
                                className="input"
                                placeholder="e.g., TX, CA, NY"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Transfer Rate
                            </label>
                            <input
                                className="input"
                                placeholder="e.g., $50/hour, 15%"
                                value={formData.cityTransferRate}
                                onChange={(e) => setFormData({ ...formData, cityTransferRate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                            Cities Served *
                        </label>
                        <div className="flex gap-2">
                            <input
                                className="input"
                                style={{ flex: 1 }}
                                placeholder="Enter city name and press Add"
                                value={formData.cityInput}
                                onChange={(e) => setFormData({ ...formData, cityInput: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }}
                            />
                            <button type="button" onClick={addCity} className="btn btn-ghost">
                                Add
                            </button>
                        </div>
                        {formData.cities.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {formData.cities.map((city) => (
                                    <span key={city} style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        {city}
                                        <button type="button" onClick={() => removeCity(city)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, display: "flex" }}>
                                            <X size={14} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* IOS Fields */}
            {showIOSFields && (
                <div className="flex flex-col gap-1">
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Market / Region *
                    </label>
                    <input
                        required
                        className="input"
                        placeholder="e.g., Dallas-Fort Worth, Austin Metro"
                        value={formData.market}
                        onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                    />
                    <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        Vehicle information can be added after approval
                    </p>
                </div>
            )}

            {/* House Chauffeur Fields */}
            {showChauffeurFields && (
                <div className="flex flex-col gap-1">
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                        Employee ID
                    </label>
                    <input
                        className="input"
                        placeholder="e.g., EMP-001"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    />
                    <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        Schedule preferences and vehicle assignments can be configured after approval
                    </p>
                </div>
            )}

            {/* Notes */}
            <div className="flex flex-col gap-1">
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Additional Notes
                </label>
                <textarea
                    className="input"
                    style={{ minHeight: "100px", resize: "vertical" }}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-4 flex-wrap">
                <button type="button" onClick={onCancel} className="btn btn-ghost">
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? (isEdit ? "Saving..." : "Submitting...") : (isEdit ? "Save Changes" : "Submit for Approval")}
                </button>
            </div>
        </form>
    );
}

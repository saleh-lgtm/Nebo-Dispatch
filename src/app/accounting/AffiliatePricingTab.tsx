"use client";

import { useState } from "react";
import {
    DollarSign,
    Building2,
    MapPin,
    Plus,
    Trash2,
    Save,
    X,
    ChevronDown,
    ChevronRight,
    Search,
    Route,
    Car,
} from "lucide-react";
import {
    upsertAffiliatePricing,
    deleteAffiliatePricing,
    upsertAffiliateRoutePrice,
    deleteAffiliateRoutePrice,
} from "@/lib/affiliatePricingActions";
import { SERVICE_TYPES } from "@/lib/affiliatePricingTypes";
import { useRouter } from "next/navigation";

interface PricingEntry {
    id: string;
    serviceType: string;
    flatRate: number;
    notes: string | null;
}

interface RoutePrice {
    id: string;
    pickupLocation: string;
    dropoffLocation: string;
    vehicleType: string | null;
    price: number;
    notes: string | null;
}

interface Affiliate {
    id: string;
    name: string;
    email: string;
    state: string | null;
    cities: string[];
    pricingGrid: PricingEntry[];
    routePricing: RoutePrice[];
}

interface Props {
    affiliates: Affiliate[];
    isAdmin: boolean;
}

export default function AffiliatePricingTab({ affiliates: initialAffiliates, isAdmin }: Props) {
    const router = useRouter();
    const [affiliates, setAffiliates] = useState(initialAffiliates);
    const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    // New flat rate entry state
    const [newFlatRate, setNewFlatRate] = useState<{
        affiliateId: string;
        serviceType: string;
        flatRate: string;
        notes: string;
    } | null>(null);

    // New route price entry state
    const [newRoute, setNewRoute] = useState<{
        affiliateId: string;
        pickupLocation: string;
        dropoffLocation: string;
        vehicleType: string;
        price: string;
        notes: string;
    } | null>(null);

    // Edit states
    const [editingFlatRate, setEditingFlatRate] = useState<string | null>(null);
    const [editingRoute, setEditingRoute] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{
        flatRate?: string;
        price?: string;
        notes?: string;
        pickupLocation?: string;
        dropoffLocation?: string;
        vehicleType?: string;
    }>({});

    const filteredAffiliates = affiliates.filter(
        (a) =>
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.state?.toLowerCase().includes(search.toLowerCase()) ||
            a.cities.some((c) => c.toLowerCase().includes(search.toLowerCase()))
    );

    const toggleAffiliate = (affiliateId: string) => {
        setExpandedAffiliate(expandedAffiliate === affiliateId ? null : affiliateId);
        setNewFlatRate(null);
        setNewRoute(null);
        setEditingFlatRate(null);
        setEditingRoute(null);
    };

    // Flat Rate handlers
    const handleAddFlatRate = async () => {
        if (!newFlatRate || !newFlatRate.serviceType || !newFlatRate.flatRate) return;

        setLoading(true);
        try {
            const result = await upsertAffiliatePricing({
                affiliateId: newFlatRate.affiliateId,
                serviceType: newFlatRate.serviceType,
                flatRate: parseFloat(newFlatRate.flatRate),
                notes: newFlatRate.notes || undefined,
            });

            setAffiliates(
                affiliates.map((a) =>
                    a.id === newFlatRate.affiliateId
                        ? {
                              ...a,
                              pricingGrid: [
                                  ...a.pricingGrid,
                                  {
                                      id: result.id,
                                      serviceType: newFlatRate.serviceType,
                                      flatRate: parseFloat(newFlatRate.flatRate),
                                      notes: newFlatRate.notes || null,
                                  },
                              ],
                          }
                        : a
                )
            );
            setNewFlatRate(null);
            router.refresh();
        } catch (error) {
            console.error("Failed to add flat rate:", error);
            alert("Failed to add flat rate");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFlatRate = async (affiliateId: string, pricingId: string) => {
        if (!confirm("Delete this pricing entry?")) return;

        setLoading(true);
        try {
            await deleteAffiliatePricing(pricingId);
            setAffiliates(
                affiliates.map((a) =>
                    a.id === affiliateId
                        ? { ...a, pricingGrid: a.pricingGrid.filter((p) => p.id !== pricingId) }
                        : a
                )
            );
            router.refresh();
        } catch (error) {
            console.error("Failed to delete:", error);
            alert("Failed to delete");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFlatRate = async (affiliateId: string, entry: PricingEntry) => {
        if (!editValues.flatRate) return;

        setLoading(true);
        try {
            await upsertAffiliatePricing({
                affiliateId,
                serviceType: entry.serviceType,
                flatRate: parseFloat(editValues.flatRate),
                notes: editValues.notes || undefined,
            });

            setAffiliates(
                affiliates.map((a) =>
                    a.id === affiliateId
                        ? {
                              ...a,
                              pricingGrid: a.pricingGrid.map((p) =>
                                  p.id === entry.id
                                      ? {
                                            ...p,
                                            flatRate: parseFloat(editValues.flatRate!),
                                            notes: editValues.notes || null,
                                        }
                                      : p
                              ),
                          }
                        : a
                )
            );
            setEditingFlatRate(null);
            setEditValues({});
            router.refresh();
        } catch (error) {
            console.error("Failed to update:", error);
            alert("Failed to update");
        } finally {
            setLoading(false);
        }
    };

    // Route Price handlers
    const handleAddRoute = async () => {
        if (!newRoute || !newRoute.pickupLocation || !newRoute.dropoffLocation || !newRoute.price) return;

        setLoading(true);
        try {
            const result = await upsertAffiliateRoutePrice({
                affiliateId: newRoute.affiliateId,
                pickupLocation: newRoute.pickupLocation,
                dropoffLocation: newRoute.dropoffLocation,
                vehicleType: newRoute.vehicleType || undefined,
                price: parseFloat(newRoute.price),
                notes: newRoute.notes || undefined,
            });

            setAffiliates(
                affiliates.map((a) =>
                    a.id === newRoute.affiliateId
                        ? {
                              ...a,
                              routePricing: [
                                  ...a.routePricing,
                                  {
                                      id: result.id,
                                      pickupLocation: newRoute.pickupLocation,
                                      dropoffLocation: newRoute.dropoffLocation,
                                      vehicleType: newRoute.vehicleType || null,
                                      price: parseFloat(newRoute.price),
                                      notes: newRoute.notes || null,
                                  },
                              ],
                          }
                        : a
                )
            );
            setNewRoute(null);
            router.refresh();
        } catch (error) {
            console.error("Failed to add route:", error);
            alert("Failed to add route price");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRoute = async (affiliateId: string, routeId: string) => {
        if (!confirm("Delete this route price?")) return;

        setLoading(true);
        try {
            await deleteAffiliateRoutePrice(routeId);
            setAffiliates(
                affiliates.map((a) =>
                    a.id === affiliateId
                        ? { ...a, routePricing: a.routePricing.filter((r) => r.id !== routeId) }
                        : a
                )
            );
            router.refresh();
        } catch (error) {
            console.error("Failed to delete:", error);
            alert("Failed to delete");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRoute = async (affiliateId: string, route: RoutePrice) => {
        if (!editValues.price) return;

        setLoading(true);
        try {
            await upsertAffiliateRoutePrice({
                affiliateId,
                pickupLocation: editValues.pickupLocation || route.pickupLocation,
                dropoffLocation: editValues.dropoffLocation || route.dropoffLocation,
                vehicleType: editValues.vehicleType || route.vehicleType || undefined,
                price: parseFloat(editValues.price),
                notes: editValues.notes || undefined,
            });

            setAffiliates(
                affiliates.map((a) =>
                    a.id === affiliateId
                        ? {
                              ...a,
                              routePricing: a.routePricing.map((r) =>
                                  r.id === route.id
                                      ? {
                                            ...r,
                                            pickupLocation: editValues.pickupLocation || route.pickupLocation,
                                            dropoffLocation: editValues.dropoffLocation || route.dropoffLocation,
                                            vehicleType: editValues.vehicleType || route.vehicleType,
                                            price: parseFloat(editValues.price!),
                                            notes: editValues.notes || null,
                                        }
                                      : r
                              ),
                          }
                        : a
                )
            );
            setEditingRoute(null);
            setEditValues({});
            router.refresh();
        } catch (error) {
            console.error("Failed to update:", error);
            alert("Failed to update");
        } finally {
            setLoading(false);
        }
    };

    const getUsedServiceTypes = (affiliate: Affiliate) =>
        affiliate.pricingGrid.map((p) => p.serviceType);

    return (
        <div className="pricing-tab">
            {/* Search */}
            <div className="search-section">
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search affiliates..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="summary">
                    <span className="summary-item">
                        <Building2 size={14} />
                        {affiliates.length} FARM-IN affiliates
                    </span>
                </div>
            </div>

            {/* Affiliates List */}
            <div className="affiliates-list">
                {filteredAffiliates.length === 0 ? (
                    <div className="empty-state">
                        <Building2 size={48} />
                        <h3>No FARM-IN affiliates</h3>
                        <p>FARM-IN affiliates with pricing will appear here</p>
                    </div>
                ) : (
                    filteredAffiliates.map((affiliate) => {
                        const isExpanded = expandedAffiliate === affiliate.id;
                        const usedServiceTypes = getUsedServiceTypes(affiliate);
                        const availableServiceTypes = SERVICE_TYPES.filter(
                            (st) => !usedServiceTypes.includes(st)
                        );

                        return (
                            <div key={affiliate.id} className="affiliate-card">
                                {/* Affiliate Header */}
                                <button
                                    className="affiliate-header"
                                    onClick={() => toggleAffiliate(affiliate.id)}
                                >
                                    <div className="affiliate-info">
                                        {isExpanded ? (
                                            <ChevronDown size={18} />
                                        ) : (
                                            <ChevronRight size={18} />
                                        )}
                                        <Building2 size={18} className="affiliate-icon" />
                                        <span className="affiliate-name">{affiliate.name}</span>
                                        {affiliate.state && (
                                            <span className="affiliate-location">
                                                <MapPin size={12} />
                                                {affiliate.state}
                                            </span>
                                        )}
                                    </div>
                                    <div className="affiliate-badges">
                                        <span className="badge badge-flat">
                                            <DollarSign size={12} />
                                            {affiliate.pricingGrid.length} flat rates
                                        </span>
                                        <span className="badge badge-route">
                                            <Route size={12} />
                                            {affiliate.routePricing.length} routes
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="affiliate-content">
                                        {/* Flat Rates Section */}
                                        <div className="pricing-section">
                                            <div className="section-header">
                                                <h4>
                                                    <DollarSign size={16} />
                                                    Flat Rates by Service Type
                                                </h4>
                                                {isAdmin && availableServiceTypes.length > 0 && !newFlatRate && (
                                                    <button
                                                        className="add-btn"
                                                        onClick={() =>
                                                            setNewFlatRate({
                                                                affiliateId: affiliate.id,
                                                                serviceType: "",
                                                                flatRate: "",
                                                                notes: "",
                                                            })
                                                        }
                                                    >
                                                        <Plus size={14} />
                                                        Add Rate
                                                    </button>
                                                )}
                                            </div>

                                            <table className="pricing-table">
                                                <thead>
                                                    <tr>
                                                        <th>Service Type</th>
                                                        <th>Rate</th>
                                                        <th>Notes</th>
                                                        {isAdmin && <th>Actions</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {affiliate.pricingGrid.length === 0 && !newFlatRate && (
                                                        <tr>
                                                            <td colSpan={isAdmin ? 4 : 3} className="empty-cell">
                                                                No flat rates configured
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {affiliate.pricingGrid.map((entry) => (
                                                        <tr key={entry.id}>
                                                            <td>{entry.serviceType}</td>
                                                            <td className="rate-cell">
                                                                {editingFlatRate === entry.id ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editValues.flatRate || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                flatRate: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        step="0.01"
                                                                    />
                                                                ) : (
                                                                    <span className="rate-value">
                                                                        ${entry.flatRate.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {editingFlatRate === entry.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editValues.notes || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                notes: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        placeholder="Notes..."
                                                                    />
                                                                ) : (
                                                                    <span className="notes-value">
                                                                        {entry.notes || "-"}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {isAdmin && (
                                                                <td className="actions-cell">
                                                                    {editingFlatRate === entry.id ? (
                                                                        <>
                                                                            <button
                                                                                className="icon-btn save"
                                                                                onClick={() =>
                                                                                    handleSaveFlatRate(
                                                                                        affiliate.id,
                                                                                        entry
                                                                                    )
                                                                                }
                                                                                disabled={loading}
                                                                            >
                                                                                <Save size={14} />
                                                                            </button>
                                                                            <button
                                                                                className="icon-btn cancel"
                                                                                onClick={() => {
                                                                                    setEditingFlatRate(null);
                                                                                    setEditValues({});
                                                                                }}
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                className="icon-btn edit"
                                                                                onClick={() => {
                                                                                    setEditingFlatRate(entry.id);
                                                                                    setEditValues({
                                                                                        flatRate:
                                                                                            entry.flatRate.toString(),
                                                                                        notes: entry.notes || "",
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <DollarSign size={14} />
                                                                            </button>
                                                                            <button
                                                                                className="icon-btn delete"
                                                                                onClick={() =>
                                                                                    handleDeleteFlatRate(
                                                                                        affiliate.id,
                                                                                        entry.id
                                                                                    )
                                                                                }
                                                                                disabled={loading}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}

                                                    {newFlatRate &&
                                                        newFlatRate.affiliateId === affiliate.id && (
                                                            <tr className="new-row">
                                                                <td>
                                                                    <select
                                                                        value={newFlatRate.serviceType}
                                                                        onChange={(e) =>
                                                                            setNewFlatRate({
                                                                                ...newFlatRate,
                                                                                serviceType: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                    >
                                                                        <option value="">Select service...</option>
                                                                        {availableServiceTypes.map((st) => (
                                                                            <option key={st} value={st}>
                                                                                {st}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td>
                                                                    <input
                                                                        type="number"
                                                                        value={newFlatRate.flatRate}
                                                                        onChange={(e) =>
                                                                            setNewFlatRate({
                                                                                ...newFlatRate,
                                                                                flatRate: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        placeholder="0.00"
                                                                        step="0.01"
                                                                    />
                                                                </td>
                                                                <td>
                                                                    <input
                                                                        type="text"
                                                                        value={newFlatRate.notes}
                                                                        onChange={(e) =>
                                                                            setNewFlatRate({
                                                                                ...newFlatRate,
                                                                                notes: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        placeholder="Notes..."
                                                                    />
                                                                </td>
                                                                <td className="actions-cell">
                                                                    <button
                                                                        className="icon-btn save"
                                                                        onClick={handleAddFlatRate}
                                                                        disabled={
                                                                            loading ||
                                                                            !newFlatRate.serviceType ||
                                                                            !newFlatRate.flatRate
                                                                        }
                                                                    >
                                                                        <Save size={14} />
                                                                    </button>
                                                                    <button
                                                                        className="icon-btn cancel"
                                                                        onClick={() => setNewFlatRate(null)}
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Route Pricing Section */}
                                        <div className="pricing-section">
                                            <div className="section-header">
                                                <h4>
                                                    <Route size={16} />
                                                    Route-Based Pricing
                                                </h4>
                                                {isAdmin && !newRoute && (
                                                    <button
                                                        className="add-btn"
                                                        onClick={() =>
                                                            setNewRoute({
                                                                affiliateId: affiliate.id,
                                                                pickupLocation: "",
                                                                dropoffLocation: "",
                                                                vehicleType: "",
                                                                price: "",
                                                                notes: "",
                                                            })
                                                        }
                                                    >
                                                        <Plus size={14} />
                                                        Add Route
                                                    </button>
                                                )}
                                            </div>

                                            <table className="pricing-table">
                                                <thead>
                                                    <tr>
                                                        <th>Pickup</th>
                                                        <th>Dropoff</th>
                                                        <th>Vehicle</th>
                                                        <th>Price</th>
                                                        <th>Notes</th>
                                                        {isAdmin && <th>Actions</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {affiliate.routePricing.length === 0 && !newRoute && (
                                                        <tr>
                                                            <td colSpan={isAdmin ? 6 : 5} className="empty-cell">
                                                                No route pricing configured
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {affiliate.routePricing.map((route) => (
                                                        <tr key={route.id}>
                                                            <td>
                                                                {editingRoute === route.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editValues.pickupLocation || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                pickupLocation: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                    />
                                                                ) : (
                                                                    <span className="location-value">
                                                                        {route.pickupLocation}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {editingRoute === route.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editValues.dropoffLocation || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                dropoffLocation: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                    />
                                                                ) : (
                                                                    <span className="location-value">
                                                                        {route.dropoffLocation}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {editingRoute === route.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editValues.vehicleType || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                vehicleType: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        placeholder="Any"
                                                                    />
                                                                ) : (
                                                                    <span className="vehicle-value">
                                                                        {route.vehicleType || "Any"}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="rate-cell">
                                                                {editingRoute === route.id ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editValues.price || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                price: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        step="0.01"
                                                                    />
                                                                ) : (
                                                                    <span className="rate-value">
                                                                        ${route.price.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {editingRoute === route.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editValues.notes || ""}
                                                                        onChange={(e) =>
                                                                            setEditValues({
                                                                                ...editValues,
                                                                                notes: e.target.value,
                                                                            })
                                                                        }
                                                                        className="edit-input"
                                                                        placeholder="Notes..."
                                                                    />
                                                                ) : (
                                                                    <span className="notes-value">
                                                                        {route.notes || "-"}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {isAdmin && (
                                                                <td className="actions-cell">
                                                                    {editingRoute === route.id ? (
                                                                        <>
                                                                            <button
                                                                                className="icon-btn save"
                                                                                onClick={() =>
                                                                                    handleSaveRoute(
                                                                                        affiliate.id,
                                                                                        route
                                                                                    )
                                                                                }
                                                                                disabled={loading}
                                                                            >
                                                                                <Save size={14} />
                                                                            </button>
                                                                            <button
                                                                                className="icon-btn cancel"
                                                                                onClick={() => {
                                                                                    setEditingRoute(null);
                                                                                    setEditValues({});
                                                                                }}
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                className="icon-btn edit"
                                                                                onClick={() => {
                                                                                    setEditingRoute(route.id);
                                                                                    setEditValues({
                                                                                        pickupLocation:
                                                                                            route.pickupLocation,
                                                                                        dropoffLocation:
                                                                                            route.dropoffLocation,
                                                                                        vehicleType:
                                                                                            route.vehicleType || "",
                                                                                        price: route.price.toString(),
                                                                                        notes: route.notes || "",
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <Route size={14} />
                                                                            </button>
                                                                            <button
                                                                                className="icon-btn delete"
                                                                                onClick={() =>
                                                                                    handleDeleteRoute(
                                                                                        affiliate.id,
                                                                                        route.id
                                                                                    )
                                                                                }
                                                                                disabled={loading}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}

                                                    {newRoute && newRoute.affiliateId === affiliate.id && (
                                                        <tr className="new-row">
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={newRoute.pickupLocation}
                                                                    onChange={(e) =>
                                                                        setNewRoute({
                                                                            ...newRoute,
                                                                            pickupLocation: e.target.value,
                                                                        })
                                                                    }
                                                                    className="edit-input"
                                                                    placeholder="e.g., LAX"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={newRoute.dropoffLocation}
                                                                    onChange={(e) =>
                                                                        setNewRoute({
                                                                            ...newRoute,
                                                                            dropoffLocation: e.target.value,
                                                                        })
                                                                    }
                                                                    className="edit-input"
                                                                    placeholder="e.g., Downtown"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={newRoute.vehicleType}
                                                                    onChange={(e) =>
                                                                        setNewRoute({
                                                                            ...newRoute,
                                                                            vehicleType: e.target.value,
                                                                        })
                                                                    }
                                                                    className="edit-input"
                                                                    placeholder="Any"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={newRoute.price}
                                                                    onChange={(e) =>
                                                                        setNewRoute({
                                                                            ...newRoute,
                                                                            price: e.target.value,
                                                                        })
                                                                    }
                                                                    className="edit-input"
                                                                    placeholder="0.00"
                                                                    step="0.01"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={newRoute.notes}
                                                                    onChange={(e) =>
                                                                        setNewRoute({
                                                                            ...newRoute,
                                                                            notes: e.target.value,
                                                                        })
                                                                    }
                                                                    className="edit-input"
                                                                    placeholder="Notes..."
                                                                />
                                                            </td>
                                                            <td className="actions-cell">
                                                                <button
                                                                    className="icon-btn save"
                                                                    onClick={handleAddRoute}
                                                                    disabled={
                                                                        loading ||
                                                                        !newRoute.pickupLocation ||
                                                                        !newRoute.dropoffLocation ||
                                                                        !newRoute.price
                                                                    }
                                                                >
                                                                    <Save size={14} />
                                                                </button>
                                                                <button
                                                                    className="icon-btn cancel"
                                                                    onClick={() => setNewRoute(null)}
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <style jsx>{`
                .pricing-tab {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .search-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    min-width: 300px;
                }

                .search-box input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .search-box input::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.6;
                }

                .summary {
                    display: flex;
                    gap: 1rem;
                }

                .summary-item {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .affiliates-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    color: var(--text-secondary);
                    gap: 1rem;
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.9) 0%, rgba(25, 25, 45, 0.95) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                }

                .empty-state h3 {
                    font-size: 1.125rem;
                    color: var(--text-primary);
                    margin: 0;
                }

                .empty-state p {
                    font-size: 0.875rem;
                    margin: 0;
                }

                .affiliate-card {
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.9) 0%, rgba(25, 25, 45, 0.95) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .affiliate-header {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .affiliate-header:hover {
                    background: rgba(255, 255, 255, 0.02);
                }

                .affiliate-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--text-primary);
                }

                .affiliate-icon {
                    color: var(--accent);
                }

                .affiliate-name {
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .affiliate-location {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    padding: 0.25rem 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }

                .affiliate-badges {
                    display: flex;
                    gap: 0.5rem;
                }

                .badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.7rem;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                }

                .badge-flat {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                }

                .badge-route {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                }

                .affiliate-content {
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .pricing-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .section-header h4 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .add-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.375rem 0.75rem;
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 6px;
                    color: #4ade80;
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-btn:hover {
                    background: rgba(34, 197, 94, 0.25);
                }

                .pricing-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .pricing-table th {
                    text-align: left;
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding: 0.5rem 0.75rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .pricing-table td {
                    padding: 0.625rem 0.75rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                    font-size: 0.8rem;
                }

                .pricing-table tr:last-child td {
                    border-bottom: none;
                }

                .empty-cell {
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    padding: 1.5rem !important;
                }

                .rate-cell {
                    width: 100px;
                }

                .rate-value {
                    font-weight: 600;
                    color: #4ade80;
                }

                .location-value {
                    color: var(--text-primary);
                }

                .vehicle-value {
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                }

                .notes-value {
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                }

                .actions-cell {
                    width: 80px;
                    display: flex;
                    gap: 0.25rem;
                }

                .icon-btn {
                    padding: 0.375rem;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .icon-btn.edit {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                }

                .icon-btn.edit:hover {
                    background: rgba(59, 130, 246, 0.25);
                }

                .icon-btn.delete {
                    background: rgba(239, 68, 68, 0.15);
                    color: #f87171;
                }

                .icon-btn.delete:hover {
                    background: rgba(239, 68, 68, 0.25);
                }

                .icon-btn.save {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                }

                .icon-btn.save:hover {
                    background: rgba(34, 197, 94, 0.25);
                }

                .icon-btn.cancel {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-secondary);
                }

                .icon-btn.cancel:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .icon-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .edit-input {
                    width: 100%;
                    padding: 0.375rem 0.5rem;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    color: var(--text-primary);
                    font-size: 0.75rem;
                }

                .edit-input:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .new-row {
                    background: rgba(34, 197, 94, 0.05);
                }

                @media (max-width: 768px) {
                    .search-section {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .search-box {
                        min-width: auto;
                    }

                    .affiliate-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.75rem;
                    }

                    .pricing-table {
                        display: block;
                        overflow-x: auto;
                    }
                }
            `}</style>
        </div>
    );
}

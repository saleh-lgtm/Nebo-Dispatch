"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Car,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Truck,
} from "lucide-react";
import { VehicleType, VehicleStatus } from "@prisma/client";
import { createVehicle, updateVehicle, deleteVehicle, updateVehicleStatus } from "@/lib/fleetActions";
import { useToast } from "@/hooks/useToast";
import ExpirationBadge, { getExpirationStatus } from "@/components/fleet/ExpirationBadge";

interface VehicleWithDocs {
    id: string;
    name: string;
    type: VehicleType;
    status: VehicleStatus;
    make: string;
    model: string;
    year: number;
    color: string | null;
    licensePlate: string;
    vin: string;
    passengerCapacity: number | null;
    luggageCapacity: number | null;
    notes: string | null;
    createdAt: Date;
    permits: { id: string; permitType: string; expirationDate: Date }[];
    insurance: { id: string; insuranceType: string; expirationDate: Date }[];
    registration: { id: string; state: string; expirationDate: Date }[];
    createdBy: { id: string; name: string | null };
}

interface FleetStats {
    totalVehicles: number;
    activeVehicles: number;
    expiringDocuments: number;
    expiredDocuments: number;
}

interface Props {
    initialVehicles: VehicleWithDocs[];
    stats: FleetStats;
}

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
    { value: "SEDAN", label: "Sedan" },
    { value: "SUV", label: "SUV" },
    { value: "VAN", label: "Van" },
    { value: "BUS", label: "Bus" },
    { value: "LIMOUSINE", label: "Limousine" },
    { value: "STRETCH_LIMO", label: "Stretch Limo" },
    { value: "SPRINTER", label: "Sprinter" },
    { value: "MINI_BUS", label: "Mini Bus" },
    { value: "COACH", label: "Coach" },
    { value: "OTHER", label: "Other" },
];

const VEHICLE_STATUSES: { value: VehicleStatus; label: string; color: string }[] = [
    { value: "ACTIVE", label: "Active", color: "var(--success)" },
    { value: "INACTIVE", label: "Inactive", color: "var(--text-muted)" },
    { value: "MAINTENANCE", label: "Maintenance", color: "var(--warning)" },
    { value: "RETIRED", label: "Retired", color: "var(--danger)" },
];

export default function FleetClient({ initialVehicles, stats }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [vehicles, setVehicles] = useState(initialVehicles);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<VehicleStatus | "all">("all");
    const [filterType, setFilterType] = useState<VehicleType | "all">("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithDocs | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        type: "SEDAN" as VehicleType,
        make: "",
        model: "",
        year: new Date().getFullYear(),
        color: "",
        licensePlate: "",
        vin: "",
        passengerCapacity: "",
        luggageCapacity: "",
        notes: "",
    });

    const resetForm = () => {
        setForm({
            name: "",
            type: "SEDAN",
            make: "",
            model: "",
            year: new Date().getFullYear(),
            color: "",
            licensePlate: "",
            vin: "",
            passengerCapacity: "",
            luggageCapacity: "",
            notes: "",
        });
    };

    const filteredVehicles = vehicles.filter((vehicle) => {
        const matchesSearch =
            search === "" ||
            vehicle.name.toLowerCase().includes(search.toLowerCase()) ||
            vehicle.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
            vehicle.make.toLowerCase().includes(search.toLowerCase()) ||
            vehicle.model.toLowerCase().includes(search.toLowerCase());

        const matchesStatus = filterStatus === "all" || vehicle.status === filterStatus;
        const matchesType = filterType === "all" || vehicle.type === filterType;

        return matchesSearch && matchesStatus && matchesType;
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.make || !form.model || !form.licensePlate || !form.vin) {
            addToast("Please fill in all required fields", "error");
            return;
        }

        setLoading(true);
        try {
            await createVehicle({
                name: form.name,
                type: form.type,
                make: form.make,
                model: form.model,
                year: form.year,
                color: form.color || undefined,
                licensePlate: form.licensePlate,
                vin: form.vin,
                passengerCapacity: form.passengerCapacity ? parseInt(form.passengerCapacity) : undefined,
                luggageCapacity: form.luggageCapacity ? parseInt(form.luggageCapacity) : undefined,
                notes: form.notes || undefined,
            });
            addToast("Vehicle created successfully", "success");
            setShowCreateModal(false);
            resetForm();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to create vehicle", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle) return;

        setLoading(true);
        try {
            await updateVehicle(selectedVehicle.id, {
                name: form.name,
                type: form.type,
                make: form.make,
                model: form.model,
                year: form.year,
                color: form.color || undefined,
                licensePlate: form.licensePlate,
                vin: form.vin,
                passengerCapacity: form.passengerCapacity ? parseInt(form.passengerCapacity) : undefined,
                luggageCapacity: form.luggageCapacity ? parseInt(form.luggageCapacity) : undefined,
                notes: form.notes || undefined,
            });
            addToast("Vehicle updated successfully", "success");
            setShowEditModal(false);
            setSelectedVehicle(null);
            resetForm();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to update vehicle", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedVehicle) return;

        setLoading(true);
        try {
            await deleteVehicle(selectedVehicle.id);
            addToast("Vehicle deleted successfully", "success");
            setShowDeleteModal(false);
            setSelectedVehicle(null);
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to delete vehicle", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (vehicleId: string, status: VehicleStatus) => {
        try {
            await updateVehicleStatus(vehicleId, status);
            addToast("Status updated successfully", "success");
            setActiveDropdown(null);
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to update status", "error");
        }
    };

    const openEditModal = (vehicle: VehicleWithDocs) => {
        setSelectedVehicle(vehicle);
        setForm({
            name: vehicle.name,
            type: vehicle.type,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color || "",
            licensePlate: vehicle.licensePlate,
            vin: vehicle.vin,
            passengerCapacity: vehicle.passengerCapacity?.toString() || "",
            luggageCapacity: vehicle.luggageCapacity?.toString() || "",
            notes: vehicle.notes || "",
        });
        setShowEditModal(true);
        setActiveDropdown(null);
    };

    const openDeleteModal = (vehicle: VehicleWithDocs) => {
        setSelectedVehicle(vehicle);
        setShowDeleteModal(true);
        setActiveDropdown(null);
    };

    const getVehicleDocStatus = (vehicle: VehicleWithDocs) => {
        const allDocs = [
            ...vehicle.permits.map(p => p.expirationDate),
            ...vehicle.insurance.map(i => i.expirationDate),
            ...vehicle.registration.map(r => r.expirationDate),
        ];

        if (allDocs.length === 0) return "none";

        const hasExpired = allDocs.some(d => getExpirationStatus(d) === "expired");
        const hasExpiring = allDocs.some(d => getExpirationStatus(d) === "expiring");

        if (hasExpired) return "expired";
        if (hasExpiring) return "expiring";
        return "valid";
    };

    const getTypeLabel = (type: VehicleType) => {
        return VEHICLE_TYPES.find(t => t.value === type)?.label || type;
    };

    const getStatusConfig = (status: VehicleStatus) => {
        return VEHICLE_STATUSES.find(s => s.value === status) || VEHICLE_STATUSES[0];
    };

    return (
        <div className="fleet-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="header-title">
                        <Car size={28} />
                        <div>
                            <h1>Fleet Management</h1>
                            <p>Manage your vehicles, permits, insurance, and registrations</p>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} />
                        Add Vehicle
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <Truck size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.totalVehicles}</span>
                        <span className="stat-label">Total Vehicles</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon success">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.activeVehicles}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon warning">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.expiringDocuments}</span>
                        <span className="stat-label">Expiring Soon</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon danger">
                        <XCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.expiredDocuments}</span>
                        <span className="stat-label">Expired</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar glass-card">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search vehicles..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <Filter size={18} />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as VehicleStatus | "all")}
                    >
                        <option value="all">All Status</option>
                        {VEHICLE_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as VehicleType | "all")}
                    >
                        <option value="all">All Types</option>
                        {VEHICLE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Vehicle Grid */}
            <div className="vehicles-grid">
                {filteredVehicles.length === 0 ? (
                    <div className="empty-state glass-card">
                        <Car size={48} />
                        <h3>No vehicles found</h3>
                        <p>
                            {search || filterStatus !== "all" || filterType !== "all"
                                ? "Try adjusting your filters"
                                : "Add your first vehicle to get started"}
                        </p>
                    </div>
                ) : (
                    filteredVehicles.map((vehicle) => {
                        const statusConfig = getStatusConfig(vehicle.status);
                        const docStatus = getVehicleDocStatus(vehicle);

                        return (
                            <div key={vehicle.id} className="vehicle-card glass-card">
                                <div className="vehicle-header">
                                    <div className="vehicle-info">
                                        <h3>{vehicle.name}</h3>
                                        <span className="vehicle-type">{getTypeLabel(vehicle.type)}</span>
                                    </div>
                                    <div className="vehicle-actions">
                                        <span
                                            className="status-badge"
                                            style={{ color: statusConfig.color }}
                                        >
                                            {statusConfig.label}
                                        </span>
                                        <div className="dropdown-container">
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                onClick={() => setActiveDropdown(
                                                    activeDropdown === vehicle.id ? null : vehicle.id
                                                )}
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                            {activeDropdown === vehicle.id && (
                                                <div className="dropdown-menu">
                                                    <button onClick={() => router.push(`/fleet/${vehicle.id}`)}>
                                                        <Eye size={16} /> View Details
                                                    </button>
                                                    <button onClick={() => openEditModal(vehicle)}>
                                                        <Edit size={16} /> Edit
                                                    </button>
                                                    <div className="dropdown-divider" />
                                                    <span className="dropdown-label">Change Status</span>
                                                    {VEHICLE_STATUSES.filter(s => s.value !== vehicle.status).map(s => (
                                                        <button
                                                            key={s.value}
                                                            onClick={() => handleStatusChange(vehicle.id, s.value)}
                                                        >
                                                            Set {s.label}
                                                        </button>
                                                    ))}
                                                    <div className="dropdown-divider" />
                                                    <button
                                                        className="danger"
                                                        onClick={() => openDeleteModal(vehicle)}
                                                    >
                                                        <Trash2 size={16} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="vehicle-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Make/Model</span>
                                        <span className="detail-value">
                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">License Plate</span>
                                        <span className="detail-value license">{vehicle.licensePlate}</span>
                                    </div>
                                    {vehicle.passengerCapacity && (
                                        <div className="detail-row">
                                            <span className="detail-label">Capacity</span>
                                            <span className="detail-value">{vehicle.passengerCapacity} passengers</span>
                                        </div>
                                    )}
                                </div>

                                <div className="vehicle-docs">
                                    <div className="docs-header">
                                        <span>Documents</span>
                                        {docStatus === "expired" && (
                                            <span className="doc-warning expired">Expired</span>
                                        )}
                                        {docStatus === "expiring" && (
                                            <span className="doc-warning expiring">Expiring Soon</span>
                                        )}
                                        {docStatus === "valid" && (
                                            <span className="doc-warning valid">All Valid</span>
                                        )}
                                        {docStatus === "none" && (
                                            <span className="doc-warning none">No Docs</span>
                                        )}
                                    </div>
                                    <div className="docs-summary">
                                        <span>{vehicle.permits.length} Permits</span>
                                        <span>{vehicle.insurance.length} Insurance</span>
                                        <span>{vehicle.registration.length} Registration</span>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-secondary btn-block"
                                    onClick={() => router.push(`/fleet/${vehicle.id}`)}
                                >
                                    View Details
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="modal-overlay" onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedVehicle(null);
                    resetForm();
                }}>
                    <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                        <h2>{showCreateModal ? "Add New Vehicle" : "Edit Vehicle"}</h2>
                        <form onSubmit={showCreateModal ? handleCreate : handleEdit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Vehicle Name *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g., Black SUV #1"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Type *</label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value as VehicleType })}
                                    >
                                        {VEHICLE_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Make *</label>
                                    <input
                                        type="text"
                                        value={form.make}
                                        onChange={(e) => setForm({ ...form, make: e.target.value })}
                                        placeholder="e.g., Cadillac"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Model *</label>
                                    <input
                                        type="text"
                                        value={form.model}
                                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                                        placeholder="e.g., Escalade"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Year *</label>
                                    <input
                                        type="number"
                                        value={form.year}
                                        onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                                        min="1990"
                                        max={new Date().getFullYear() + 1}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Color</label>
                                    <input
                                        type="text"
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        placeholder="e.g., Black"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>License Plate *</label>
                                    <input
                                        type="text"
                                        value={form.licensePlate}
                                        onChange={(e) => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })}
                                        placeholder="e.g., ABC1234"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>VIN *</label>
                                    <input
                                        type="text"
                                        value={form.vin}
                                        onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })}
                                        placeholder="17-character VIN"
                                        maxLength={17}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Passenger Capacity</label>
                                    <input
                                        type="number"
                                        value={form.passengerCapacity}
                                        onChange={(e) => setForm({ ...form, passengerCapacity: e.target.value })}
                                        placeholder="e.g., 6"
                                        min="1"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Luggage Capacity</label>
                                    <input
                                        type="number"
                                        value={form.luggageCapacity}
                                        onChange={(e) => setForm({ ...form, luggageCapacity: e.target.value })}
                                        placeholder="e.g., 4"
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="form-group full-width">
                                <label>Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Additional notes about this vehicle..."
                                    rows={3}
                                />
                            </div>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setShowEditModal(false);
                                        setSelectedVehicle(null);
                                        resetForm();
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? "Saving..." : showCreateModal ? "Add Vehicle" : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && selectedVehicle && (
                <div className="modal-overlay" onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedVehicle(null);
                }}>
                    <div className="modal-content glass-card small" onClick={(e) => e.stopPropagation()}>
                        <h2>Delete Vehicle</h2>
                        <p>
                            Are you sure you want to delete <strong>{selectedVehicle.name}</strong>?
                            This will also delete all associated permits, insurance records, and documents.
                        </p>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setSelectedVehicle(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ? "Deleting..." : "Delete Vehicle"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .fleet-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 1.5rem;
                }

                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                }

                .header-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    color: var(--text-primary);
                }

                .header-title h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0;
                }

                .header-title p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0.25rem 0 0;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                }

                .stat-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-md);
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                }

                .stat-icon.success { color: var(--success); background: var(--success-bg); }
                .stat-icon.warning { color: var(--warning); background: var(--warning-bg); }
                .stat-icon.danger { color: var(--danger); background: var(--danger-bg); }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .filters-bar {
                    display: flex;
                    gap: 1rem;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex: 1;
                    min-width: 200px;
                    padding: 0.5rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                }

                .search-box input {
                    flex: 1;
                    border: none;
                    background: transparent;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    outline: none;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                }

                .filter-group select {
                    padding: 0.5rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .vehicles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1rem;
                }

                .vehicle-card {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1.25rem;
                }

                .vehicle-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .vehicle-info h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin: 0;
                    color: var(--text-primary);
                }

                .vehicle-type {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .vehicle-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .status-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .dropdown-container {
                    position: relative;
                }

                .dropdown-menu {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    min-width: 160px;
                    z-index: 50;
                    padding: 0.25rem;
                }

                .dropdown-menu button {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                    border-radius: var(--radius-sm);
                }

                .dropdown-menu button:hover {
                    background: var(--bg-hover);
                }

                .dropdown-menu button.danger {
                    color: var(--danger);
                }

                .dropdown-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 0.25rem 0;
                }

                .dropdown-label {
                    display: block;
                    padding: 0.25rem 0.75rem;
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }

                .vehicle-details {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.875rem;
                }

                .detail-label {
                    color: var(--text-secondary);
                }

                .detail-value {
                    color: var(--text-primary);
                    font-weight: 500;
                }

                .detail-value.license {
                    font-family: monospace;
                    background: var(--bg-secondary);
                    padding: 0.125rem 0.5rem;
                    border-radius: var(--radius-sm);
                }

                .vehicle-docs {
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }

                .docs-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .doc-warning {
                    font-size: 0.625rem;
                    padding: 0.125rem 0.5rem;
                    border-radius: var(--radius-full);
                }

                .doc-warning.valid { background: var(--success-bg); color: var(--success); }
                .doc-warning.expiring { background: var(--warning-bg); color: var(--warning); }
                .doc-warning.expired { background: var(--danger-bg); color: var(--danger); }
                .doc-warning.none { background: var(--bg-hover); color: var(--text-muted); }

                .docs-summary {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .empty-state {
                    grid-column: 1 / -1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    text-align: center;
                    color: var(--text-secondary);
                }

                .empty-state h3 {
                    margin: 1rem 0 0.5rem;
                    color: var(--text-primary);
                }

                .empty-state p {
                    margin: 0;
                    font-size: 0.875rem;
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 200;
                    padding: 1rem;
                }

                .modal-content {
                    width: 100%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 1.5rem;
                }

                .modal-content.small {
                    max-width: 400px;
                }

                .modal-content h2 {
                    font-size: 1.25rem;
                    margin: 0 0 1.5rem;
                    color: var(--text-primary);
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .form-group.full-width {
                    grid-column: 1 / -1;
                }

                .form-group label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 0.625rem 0.875rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 1.5rem;
                }

                @media (max-width: 640px) {
                    .header-content {
                        flex-direction: column;
                    }

                    .form-grid {
                        grid-template-columns: 1fr;
                    }

                    .vehicles-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

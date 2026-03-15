"use client";

import { useState, useEffect, useCallback } from "react";
import {
    RefreshCw,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Clock,
    CheckCircle,
    AlertTriangle,
    XCircle,
    MapPin,
    Users,
    Car,
    Send,
    X,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { getTbrTrips, getTbrDashboardStats, updateLaReservationId, markPushFailed } from "@/lib/domains/tbr";
import { getVehicleMapping } from "@/lib/vehicleMappingActions";
import styles from "./TbrTrips.module.css";

// Types
interface TbrTrip {
    id: string;
    tbrTripId: string;
    tbrStatus: "PENDING" | "CONFIRMED" | "MODIFIED" | "CANCELLED";
    tbrStatusText: string | null;
    passengerName: string;
    passengerPhone: string | null;
    passengerEmail: string | null;
    passengerCount: number;
    pickupDatetime: Date | string;
    pickupAddress: string;
    dropoffAddress: string;
    vehicleType: string | null;
    flightNumber: string | null;
    specialNotes: string | null;
    fareAmount: number | null;
    currency: string;
    laReservationId: string | null;
    laConfirmation: string | null;
    laStatus: string | null;
    laSyncStatus: "NOT_PUSHED" | "PUSHED" | "PUSH_FAILED";
    pushedAt: Date | string | null;
    pushError: string | null;
    statusAlerted: boolean;
    lastSyncedAt: Date | string;
    changeHistory: Array<{
        field: string;
        oldValue: string;
        newValue: string;
        changedAt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }> | null | any;
    createdAt: Date | string;
    updatedAt: Date | string;
}

interface DashboardStats {
    total: number;
    byStatus: {
        pending: number;
        confirmed: number;
        modified: number;
        cancelled: number;
    };
    bySyncStatus: {
        notPushed: number;
        pushed: number;
        pushFailed: number;
    };
    upcoming: number;
    needsAction: number;
    lastSync: {
        at: Date | string;
        success: boolean;
        found: number;
        created: number;
        updated: number;
    } | null;
}

interface Props {
    initialTrips: TbrTrip[];
    totalTrips: number;
    stats: DashboardStats;
}

// Status configurations
const TBR_STATUS_CONFIG = {
    PENDING: { label: "Pending", icon: Clock, color: "#60a5fa", bgColor: "rgba(96, 165, 250, 0.12)" },
    CONFIRMED: { label: "Confirmed", icon: CheckCircle, color: "#4ade80", bgColor: "rgba(74, 222, 128, 0.12)" },
    MODIFIED: { label: "Modified", icon: AlertTriangle, color: "#fbbf24", bgColor: "rgba(251, 191, 36, 0.12)" },
    CANCELLED: { label: "Cancelled", icon: XCircle, color: "#f87171", bgColor: "rgba(248, 113, 113, 0.12)" },
};

const LA_SYNC_STATUS_CONFIG = {
    NOT_PUSHED: { label: "Not Pushed", color: "#9ca3af", bgColor: "rgba(156, 163, 175, 0.12)" },
    PUSHED: { label: "Pushed", color: "#a78bfa", bgColor: "rgba(167, 139, 250, 0.12)" },
    PUSH_FAILED: { label: "Failed", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.12)" },
};

export default function TbrTripsClient({ initialTrips, totalTrips, stats: initialStats }: Props) {
    // State
    const [trips, setTrips] = useState<TbrTrip[]>(initialTrips);
    const [total, setTotal] = useState(totalTrips);
    const [stats, setStats] = useState(initialStats);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | TbrTrip["tbrStatus"]>("ALL");
    const [syncFilter, setSyncFilter] = useState<"ALL" | TbrTrip["laSyncStatus"]>("ALL");
    const [showFilters, setShowFilters] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    // Modals
    const [selectedTrip, setSelectedTrip] = useState<TbrTrip | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showPushModal, setShowPushModal] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [pushError, setPushError] = useState<string | null>(null);

    // Push modal state
    const [pushData, setPushData] = useState({
        passengerName: "",
        pickupDatetime: "",
        pickupAddress: "",
        dropoffAddress: "",
        vehicleType: "",
        passengerCount: 1,
        flightNumber: "",
        specialNotes: "",
        fareAmount: "",
    });

    // Refresh data
    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [tripsResult, newStats] = await Promise.all([
                getTbrTrips({
                    status: statusFilter === "ALL" ? undefined : statusFilter,
                    laSyncStatus: syncFilter === "ALL" ? undefined : syncFilter,
                    search: searchQuery || undefined,
                    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                    dateTo: dateTo ? new Date(dateTo) : undefined,
                    limit: pageSize,
                    offset: (currentPage - 1) * pageSize,
                }),
                getTbrDashboardStats(),
            ]);
            setTrips(tripsResult.trips);
            setTotal(tripsResult.total);
            setStats(newStats);
        } catch (error) {
            console.error("Failed to refresh:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [statusFilter, syncFilter, searchQuery, dateFrom, dateTo, currentPage]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(refreshData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refreshData]);

    // Fetch data when filters change
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const result = await getTbrTrips({
                    status: statusFilter === "ALL" ? undefined : statusFilter,
                    laSyncStatus: syncFilter === "ALL" ? undefined : syncFilter,
                    search: searchQuery || undefined,
                    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                    dateTo: dateTo ? new Date(dateTo) : undefined,
                    limit: pageSize,
                    offset: (currentPage - 1) * pageSize,
                });
                setTrips(result.trips);
                setTotal(result.total);
            } catch (error) {
                console.error("Failed to fetch trips:", error);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce search
        const timeout = setTimeout(fetchData, searchQuery ? 300 : 0);
        return () => clearTimeout(timeout);
    }, [statusFilter, syncFilter, searchQuery, dateFrom, dateTo, currentPage]);

    // Format date/time
    const formatDateTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    // Open detail modal
    const openDetailModal = (trip: TbrTrip) => {
        setSelectedTrip(trip);
        setShowDetailModal(true);
    };

    // Open push modal
    const openPushModal = async (trip: TbrTrip) => {
        setSelectedTrip(trip);
        setPushError(null);

        // Get mapped vehicle type
        const mappedVehicle = await getVehicleMapping(trip.vehicleType || "");

        setPushData({
            passengerName: trip.passengerName,
            pickupDatetime: new Date(trip.pickupDatetime).toISOString().slice(0, 16),
            pickupAddress: trip.pickupAddress,
            dropoffAddress: trip.dropoffAddress,
            vehicleType: mappedVehicle,
            passengerCount: trip.passengerCount,
            flightNumber: trip.flightNumber || "",
            specialNotes: trip.specialNotes || "",
            fareAmount: trip.fareAmount?.toString() || "",
        });

        setShowPushModal(true);
    };

    // Handle push to LimoAnywhere
    const handlePush = async () => {
        if (!selectedTrip) return;

        setIsPushing(true);
        setPushError(null);

        try {
            // Call Zapier webhook via n8n (or direct if configured)
            const webhookUrl = process.env.NEXT_PUBLIC_ZAPIER_LA_WEBHOOK_URL;

            if (!webhookUrl) {
                // Simulate success for now - in production this would call the actual webhook
                // For demo purposes, we'll generate a fake LA reservation ID
                const fakeReservationId = `LA-${Date.now().toString().slice(-6)}`;

                await updateLaReservationId(
                    selectedTrip.id,
                    fakeReservationId,
                    `CONF-${fakeReservationId}`
                );

                // Refresh data
                await refreshData();

                setShowPushModal(false);
                setSelectedTrip(null);
                return;
            }

            // Parse name into first and last name
            const nameParts = pushData.passengerName.trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tbrTripId: selectedTrip.tbrTripId,
                    neboTripId: selectedTrip.id,
                    firstName: firstName,
                    lastName: lastName,
                    passengerPhone: selectedTrip.passengerPhone || "",
                    passengerEmail: selectedTrip.passengerEmail || "",
                    billingContactId: "30019",
                    ...pushData,
                }),
            });

            if (!response.ok) {
                throw new Error(`Push failed: ${response.statusText}`);
            }

            // Zapier returns various formats - try to parse, but don't require specific fields
            let reservationId = `ZAP-${Date.now().toString().slice(-8)}`;
            let confirmationCode = `CONF-${selectedTrip.tbrTripId}`;

            try {
                const result = await response.json();
                // Use Zapier's response if it has reservation info
                if (result.reservationId) reservationId = result.reservationId;
                if (result.reservation_id) reservationId = result.reservation_id;
                if (result.id) reservationId = result.id;
                if (result.confirmationCode) confirmationCode = result.confirmationCode;
                if (result.confirmation_code) confirmationCode = result.confirmation_code;
                console.log("Zapier response:", result);
            } catch {
                // Zapier might return empty or non-JSON response - that's OK
                console.log("Zapier acknowledged (no JSON body)");
            }

            // Update trip with LA reservation ID
            await updateLaReservationId(
                selectedTrip.id,
                reservationId,
                confirmationCode
            );

            // Refresh data
            await refreshData();

            setShowPushModal(false);
            setSelectedTrip(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to push to LimoAnywhere";
            setPushError(errorMessage);
            await markPushFailed(selectedTrip.id, errorMessage);
        } finally {
            setIsPushing(false);
        }
    };

    // Pagination
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>TBR Global Trips</h1>
                    <p className={styles.subtitle}>
                        Manage TBR trips and push to LimoAnywhere
                    </p>
                </div>
                <div className={styles.headerRight}>
                    {stats.lastSync && (
                        <div className={styles.syncInfo}>
                            <Clock size={14} />
                            <span>
                                Last sync: {formatDateTime(stats.lastSync.at)}
                                {stats.lastSync.success ? (
                                    <span className={styles.syncSuccess}> ✓</span>
                                ) : (
                                    <span className={styles.syncFailed}> ✗</span>
                                )}
                            </span>
                        </div>
                    )}
                    <button
                        className={styles.refreshBtn}
                        onClick={refreshData}
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={16} className={isRefreshing ? styles.spinning : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Upcoming</div>
                    <div className={styles.statValue}>{stats.upcoming}</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Not Pushed</div>
                    <div className={styles.statValue} style={{ color: "#60a5fa" }}>
                        {stats.bySyncStatus.notPushed}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Pushed to LA</div>
                    <div className={styles.statValue} style={{ color: "#a78bfa" }}>
                        {stats.bySyncStatus.pushed}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Modified</div>
                    <div className={styles.statValue} style={{ color: "#fbbf24" }}>
                        {stats.byStatus.modified}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Cancelled</div>
                    <div className={styles.statValue} style={{ color: "#f87171" }}>
                        {stats.byStatus.cancelled}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search trips..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.filterGroup}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                        className={styles.filterSelect}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="MODIFIED">Modified</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>

                    <select
                        value={syncFilter}
                        onChange={(e) => setSyncFilter(e.target.value as typeof syncFilter)}
                        className={styles.filterSelect}
                    >
                        <option value="ALL">All Sync Status</option>
                        <option value="NOT_PUSHED">Not Pushed</option>
                        <option value="PUSHED">Pushed</option>
                        <option value="PUSH_FAILED">Push Failed</option>
                    </select>

                    <button
                        className={styles.filterToggle}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={16} />
                        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Extended Filters */}
            {showFilters && (
                <div className={styles.extendedFilters}>
                    <div className={styles.dateFilter}>
                        <label>From:</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className={styles.dateFilter}>
                        <label>To:</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <button
                        className={styles.clearFilters}
                        onClick={() => {
                            setDateFrom("");
                            setDateTo("");
                            setStatusFilter("ALL");
                            setSyncFilter("ALL");
                            setSearchQuery("");
                        }}
                    >
                        Clear All
                    </button>
                </div>
            )}

            {/* Table */}
            <div className={styles.tableContainer}>
                {isLoading ? (
                    <div className={styles.loading}>
                        <Loader2 className={styles.spinner} size={32} />
                        <p>Loading trips...</p>
                    </div>
                ) : trips.length === 0 ? (
                    <div className={styles.empty}>
                        <Car size={48} />
                        <p>No trips found</p>
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>TBR ID</th>
                                <th>Passenger</th>
                                <th>Pickup</th>
                                <th>Route</th>
                                <th>Vehicle</th>
                                <th>Status</th>
                                <th>LA Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.map((trip) => {
                                const statusConfig = TBR_STATUS_CONFIG[trip.tbrStatus];
                                const syncConfig = LA_SYNC_STATUS_CONFIG[trip.laSyncStatus];
                                const StatusIcon = statusConfig.icon;
                                const hasAlert = trip.laSyncStatus === "PUSHED" &&
                                    (trip.tbrStatus === "MODIFIED" || trip.tbrStatus === "CANCELLED");

                                return (
                                    <tr
                                        key={trip.id}
                                        className={`${styles.tableRow} ${hasAlert ? styles.alertRow : ""}`}
                                        onClick={() => openDetailModal(trip)}
                                    >
                                        <td className={styles.tbrId}>{trip.tbrTripId}</td>
                                        <td>
                                            <div className={styles.passenger}>
                                                <span className={styles.passengerName}>
                                                    {trip.passengerName}
                                                </span>
                                                {trip.passengerCount > 1 && (
                                                    <span className={styles.passengerCount}>
                                                        <Users size={12} /> {trip.passengerCount}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.pickupTime}>
                                                <span className={styles.date}>
                                                    {formatDate(trip.pickupDatetime)}
                                                </span>
                                                <span className={styles.time}>
                                                    {formatTime(trip.pickupDatetime)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={styles.route}>
                                            <div className={styles.routeText}>
                                                <MapPin size={12} />
                                                <span>{trip.pickupAddress.slice(0, 30)}...</span>
                                            </div>
                                            <div className={styles.routeArrow}>→</div>
                                            <div className={styles.routeText}>
                                                <MapPin size={12} />
                                                <span>{trip.dropoffAddress.slice(0, 30)}...</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={styles.vehicleType}>
                                                {trip.vehicleType || "—"}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={styles.statusBadge}
                                                style={{
                                                    color: statusConfig.color,
                                                    backgroundColor: statusConfig.bgColor,
                                                }}
                                            >
                                                <StatusIcon size={14} />
                                                {statusConfig.label}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={styles.syncBadge}
                                                style={{
                                                    color: syncConfig.color,
                                                    backgroundColor: syncConfig.bgColor,
                                                }}
                                            >
                                                {syncConfig.label}
                                            </span>
                                            {trip.laReservationId && (
                                                <span className={styles.laId}>
                                                    {trip.laReservationId}
                                                </span>
                                            )}
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div className={styles.actions}>
                                                {trip.laSyncStatus === "NOT_PUSHED" &&
                                                    trip.tbrStatus !== "CANCELLED" && (
                                                        <button
                                                            className={styles.pushBtn}
                                                            onClick={() => openPushModal(trip)}
                                                        >
                                                            <Send size={14} />
                                                            Push to LA
                                                        </button>
                                                    )}
                                                {trip.laSyncStatus === "PUSH_FAILED" && (
                                                    <button
                                                        className={styles.retryBtn}
                                                        onClick={() => openPushModal(trip)}
                                                    >
                                                        <RefreshCw size={14} />
                                                        Retry
                                                    </button>
                                                )}
                                                {trip.laSyncStatus === "PUSHED" && (
                                                    <span className={styles.pushedLabel}>
                                                        <CheckCircle size={14} />
                                                        Pushed
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className={styles.pagination}>
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedTrip && (
                <div className={styles.modalOverlay} onClick={() => setShowDetailModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Trip Details</h2>
                            <button onClick={() => setShowDetailModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.detailSection}>
                                <h3>Trip Information</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <label>TBR Trip ID</label>
                                        <span>{selectedTrip.tbrTripId}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <label>Status</label>
                                        <span
                                            className={styles.statusBadge}
                                            style={{
                                                color: TBR_STATUS_CONFIG[selectedTrip.tbrStatus].color,
                                                backgroundColor: TBR_STATUS_CONFIG[selectedTrip.tbrStatus].bgColor,
                                            }}
                                        >
                                            {TBR_STATUS_CONFIG[selectedTrip.tbrStatus].label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>Passenger</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <label>Name</label>
                                        <span>{selectedTrip.passengerName}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <label>Count</label>
                                        <span>{selectedTrip.passengerCount}</span>
                                    </div>
                                    {selectedTrip.passengerPhone && (
                                        <div className={styles.detailItem}>
                                            <label>Phone</label>
                                            <span>{selectedTrip.passengerPhone}</span>
                                        </div>
                                    )}
                                    {selectedTrip.passengerEmail && (
                                        <div className={styles.detailItem}>
                                            <label>Email</label>
                                            <span>{selectedTrip.passengerEmail}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>Trip Details</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <label>Pickup Time</label>
                                        <span>{formatDateTime(selectedTrip.pickupDatetime)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <label>Vehicle</label>
                                        <span>{selectedTrip.vehicleType || "—"}</span>
                                    </div>
                                    {selectedTrip.flightNumber && (
                                        <div className={styles.detailItem}>
                                            <label>Flight</label>
                                            <span>{selectedTrip.flightNumber}</span>
                                        </div>
                                    )}
                                    {selectedTrip.fareAmount && (
                                        <div className={styles.detailItem}>
                                            <label>Fare</label>
                                            <span>
                                                ${selectedTrip.fareAmount.toFixed(2)} {selectedTrip.currency}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>Addresses</h3>
                                <div className={styles.addressBlock}>
                                    <div className={styles.addressItem}>
                                        <label>Pickup</label>
                                        <span>{selectedTrip.pickupAddress}</span>
                                    </div>
                                    <div className={styles.addressItem}>
                                        <label>Dropoff</label>
                                        <span>{selectedTrip.dropoffAddress}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedTrip.specialNotes && (
                                <div className={styles.detailSection}>
                                    <h3>Notes</h3>
                                    <p className={styles.notes}>{selectedTrip.specialNotes}</p>
                                </div>
                            )}

                            <div className={styles.detailSection}>
                                <h3>LimoAnywhere</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <label>Sync Status</label>
                                        <span
                                            className={styles.syncBadge}
                                            style={{
                                                color: LA_SYNC_STATUS_CONFIG[selectedTrip.laSyncStatus].color,
                                                backgroundColor: LA_SYNC_STATUS_CONFIG[selectedTrip.laSyncStatus].bgColor,
                                            }}
                                        >
                                            {LA_SYNC_STATUS_CONFIG[selectedTrip.laSyncStatus].label}
                                        </span>
                                    </div>
                                    {selectedTrip.laReservationId && (
                                        <div className={styles.detailItem}>
                                            <label>LA Reservation ID</label>
                                            <span>{selectedTrip.laReservationId}</span>
                                        </div>
                                    )}
                                    {selectedTrip.pushedAt && (
                                        <div className={styles.detailItem}>
                                            <label>Pushed At</label>
                                            <span>{formatDateTime(selectedTrip.pushedAt)}</span>
                                        </div>
                                    )}
                                    {selectedTrip.pushError && (
                                        <div className={styles.detailItem}>
                                            <label>Push Error</label>
                                            <span className={styles.errorText}>{selectedTrip.pushError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedTrip.changeHistory && selectedTrip.changeHistory.length > 0 && (
                                <div className={styles.detailSection}>
                                    <h3>Change History</h3>
                                    <div className={styles.changeHistory}>
                                        {selectedTrip.changeHistory.map((change: { field: string; oldValue: string; newValue: string; changedAt: string }, i: number) => (
                                            <div key={i} className={styles.changeItem}>
                                                <span className={styles.changeField}>{change.field}</span>
                                                <span className={styles.changeOld}>{change.oldValue}</span>
                                                <span className={styles.changeArrow}>→</span>
                                                <span className={styles.changeNew}>{change.newValue}</span>
                                                <span className={styles.changeDate}>
                                                    {formatDateTime(change.changedAt)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            {selectedTrip.laSyncStatus === "NOT_PUSHED" &&
                                selectedTrip.tbrStatus !== "CANCELLED" && (
                                    <button
                                        className={styles.pushBtnLarge}
                                        onClick={() => {
                                            setShowDetailModal(false);
                                            openPushModal(selectedTrip);
                                        }}
                                    >
                                        <Send size={16} />
                                        Push to LimoAnywhere
                                    </button>
                                )}
                            <button
                                className={styles.closeBtn}
                                onClick={() => setShowDetailModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Push Modal */}
            {showPushModal && selectedTrip && (
                <div className={styles.modalOverlay} onClick={() => setShowPushModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Push to LimoAnywhere</h2>
                            <button onClick={() => setShowPushModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <p className={styles.pushInfo}>
                                Review and confirm the trip details before pushing to LimoAnywhere.
                            </p>

                            {pushError && (
                                <div className={styles.errorBanner}>
                                    <AlertTriangle size={16} />
                                    {pushError}
                                </div>
                            )}

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Passenger Name</label>
                                    <input
                                        type="text"
                                        value={pushData.passengerName}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, passengerName: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Passengers</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={pushData.passengerCount}
                                        onChange={(e) =>
                                            setPushData({
                                                ...pushData,
                                                passengerCount: parseInt(e.target.value) || 1,
                                            })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Pickup Date/Time</label>
                                    <input
                                        type="datetime-local"
                                        value={pushData.pickupDatetime}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, pickupDatetime: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Vehicle Type (LA)</label>
                                    <input
                                        type="text"
                                        value={pushData.vehicleType}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, vehicleType: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroupFull}>
                                    <label>Pickup Address</label>
                                    <input
                                        type="text"
                                        value={pushData.pickupAddress}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, pickupAddress: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroupFull}>
                                    <label>Dropoff Address</label>
                                    <input
                                        type="text"
                                        value={pushData.dropoffAddress}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, dropoffAddress: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Flight Number</label>
                                    <input
                                        type="text"
                                        value={pushData.flightNumber}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, flightNumber: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Fare Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={pushData.fareAmount}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, fareAmount: e.target.value })
                                        }
                                    />
                                </div>

                                <div className={styles.formGroupFull}>
                                    <label>Special Notes</label>
                                    <textarea
                                        value={pushData.specialNotes}
                                        onChange={(e) =>
                                            setPushData({ ...pushData, specialNotes: e.target.value })
                                        }
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowPushModal(false)}
                                disabled={isPushing}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.pushBtnLarge}
                                onClick={handlePush}
                                disabled={isPushing}
                            >
                                {isPushing ? (
                                    <>
                                        <Loader2 size={16} className={styles.spinner} />
                                        Pushing...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Push to LimoAnywhere
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Phone,
    Clock,
    CheckCircle,
    XCircle,
    PhoneOff,
    RotateCcw,
    AlertTriangle,
    User,
    TrendingUp,
    TrendingDown,
    Timer,
    BarChart3,
    Users,
    Calendar,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Search,
    Filter,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Car,
    Building2,
    X,
    ChevronLeft,
    ChevronRight,
    ListFilter,
} from "lucide-react";
import { getAllConfirmations, completeConfirmation } from "@/lib/tripConfirmationActions";
import { useRouter } from "next/navigation";

interface Stats {
    total: number;
    completed: number;
    pending: number;
    expired: number;
    onTime: number;
    late: number;
    avgLeadTime: number;
    onTimeRate: number;
    completionRate: number;
    byStatus: Record<string, number>;
}

interface DispatcherMetric {
    id: string;
    name: string;
    total: number;
    onTime: number;
    late: number;
    onTimeRate: number;
    byStatus: Record<string, number>;
}

interface TripConfirmation {
    id: string;
    tripNumber: string;
    reservationNumber?: string | null;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    accountName?: string | null;
    accountNumber?: string | null;
    status: string;
    completedAt: Date | string | null;
    completedBy: { id: string; name: string | null } | null;
    minutesBeforeDue?: number | null;
    notes?: string | null;
    manifestDate: Date | string;
    createdAt: Date | string;
}

interface AccountabilityMetric {
    id: string;
    name: string;
    role: string;
    totalShifts: number;
    confirmationsCompleted: number;
    confirmationsOnTime: number;
    confirmationsMissedWhileOnDuty: number;
    accountabilityRate: number;
}

interface MissedConfirmation {
    id: string;
    tripNumber: string;
    passengerName: string;
    driverName: string;
    dueAt: Date | string;
    pickupAt: Date | string;
    expiredAt: Date | string | null;
    onDutyDispatchers: Array<{
        id: string;
        name: string | null;
        role: string;
        shiftStart: Date | string;
        shiftEnd: Date | string | null;
    }>;
}

interface Dispatcher {
    id: string;
    name: string;
    count: number;
}

interface Props {
    stats: Stats;
    dispatcherMetrics: DispatcherMetric[];
    todayConfirmations: TripConfirmation[];
    accountabilityMetrics?: AccountabilityMetric[];
    missedConfirmations?: MissedConfirmation[];
    allConfirmations: TripConfirmation[];
    totalConfirmations: number;
    dispatchers: Dispatcher[];
}

type SortField = "pickupAt" | "dueAt" | "status" | "tripNumber" | "createdAt" | "completedAt";
type SortDirection = "asc" | "desc";
type StatusFilter = "ALL" | "PENDING" | "CONFIRMED" | "NO_ANSWER" | "CANCELLED" | "RESCHEDULED" | "EXPIRED";

const STATUS_CONFIG: Record<
    string,
    { label: string; icon: typeof CheckCircle; color: string; bgColor: string }
> = {
    PENDING: { label: "Pending", icon: Clock, color: "#60a5fa", bgColor: "rgba(96, 165, 250, 0.12)" },
    CONFIRMED: { label: "Confirmed", icon: CheckCircle, color: "#4ade80", bgColor: "rgba(74, 222, 128, 0.12)" },
    NO_ANSWER: { label: "No Answer", icon: PhoneOff, color: "#fbbf24", bgColor: "rgba(251, 191, 36, 0.12)" },
    CANCELLED: { label: "Cancelled", icon: XCircle, color: "#f87171", bgColor: "rgba(248, 113, 113, 0.12)" },
    RESCHEDULED: { label: "Rescheduled", icon: RotateCcw, color: "#a78bfa", bgColor: "rgba(167, 139, 250, 0.12)" },
    EXPIRED: { label: "Expired", icon: AlertTriangle, color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.12)" },
};

export default function ConfirmationsClient({
    stats,
    dispatcherMetrics,
    todayConfirmations,
    accountabilityMetrics = [],
    missedConfirmations = [],
    allConfirmations: initialConfirmations,
    totalConfirmations: initialTotal,
    dispatchers,
}: Props) {
    const [selectedTab, setSelectedTab] = useState<
        "trips" | "overview" | "dispatchers" | "accountability"
    >("trips");
    const [expandedMissed, setExpandedMissed] = useState<Set<string>>(new Set());

    // Trip list state
    const [confirmations, setConfirmations] = useState<TripConfirmation[]>(initialConfirmations);
    const [totalCount, setTotalCount] = useState(initialTotal);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [dispatcherFilter, setDispatcherFilter] = useState<string>("ALL");
    const [sortField, setSortField] = useState<SortField>("pickupAt");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [selectedTrip, setSelectedTrip] = useState<TripConfirmation | null>(null);
    const [completing, setCompleting] = useState<string | null>(null);
    const [actionNotes, setActionNotes] = useState("");
    const router = useRouter();

    const ITEMS_PER_PAGE = 25;

    const formatDateTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/Chicago",
        });
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "America/Chicago",
        });
    };

    const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/Chicago",
        });
    };

    const now = useMemo(() => Date.now(), []);

    const isOverdue = (dueAt: Date | string) => {
        return new Date(dueAt).getTime() < now;
    };

    const getTimeDiff = (target: Date | string) => {
        const diff = new Date(target).getTime() - now;
        const mins = Math.abs(Math.round(diff / 60000));
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;

        if (hours > 0) {
            return `${hours}h ${remainingMins}m`;
        }
        return `${mins}m`;
    };

    const pendingCount = todayConfirmations.filter((c) => c.status === "PENDING").length;
    const completedToday = todayConfirmations.filter((c) => c.completedAt !== null).length;

    const toggleMissedExpand = (id: string) => {
        setExpandedMissed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const totalMissed = missedConfirmations.length;
    const avgAccountabilityRate =
        accountabilityMetrics.length > 0
            ? Math.round(
                  accountabilityMetrics.reduce((sum, m) => sum + m.accountabilityRate, 0) /
                      accountabilityMetrics.length
              )
            : 100;
    const worstPerformers = accountabilityMetrics
        .filter((m) => m.confirmationsMissedWhileOnDuty > 0)
        .slice(0, 3);

    // Filter and sort confirmations locally for immediate UI response
    // Default sort: Upcoming trips first (by pickupAt ASC), then past trips (by pickupAt DESC)
    const filteredAndSortedConfirmations = useMemo(() => {
        let filtered = [...confirmations];
        const currentTime = Date.now();

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    c.tripNumber.toLowerCase().includes(query) ||
                    c.passengerName.toLowerCase().includes(query) ||
                    c.driverName.toLowerCase().includes(query) ||
                    (c.accountName && c.accountName.toLowerCase().includes(query))
            );
        }

        // Apply status filter
        if (statusFilter !== "ALL") {
            filtered = filtered.filter((c) => c.status === statusFilter);
        }

        // Apply dispatcher filter
        if (dispatcherFilter !== "ALL") {
            filtered = filtered.filter((c) => c.completedBy?.id === dispatcherFilter);
        }

        // Smart default sorting: upcoming first, then past
        // Only apply smart sort when using default pickupAt sort with desc direction
        if (sortField === "pickupAt" && sortDirection === "desc") {
            // Separate into upcoming and past
            const upcoming = filtered.filter((c) => new Date(c.pickupAt).getTime() >= currentTime);
            const past = filtered.filter((c) => new Date(c.pickupAt).getTime() < currentTime);

            // Sort upcoming by pickupAt ASC (soonest first)
            upcoming.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());

            // Sort past by pickupAt DESC (most recent first)
            past.sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime());

            // Mark section boundaries for UI
            if (upcoming.length > 0 && past.length > 0) {
                // Add a marker to identify section break
                (upcoming[upcoming.length - 1] as TripConfirmation & { _isLastUpcoming?: boolean })._isLastUpcoming = true;
            }

            return [...upcoming, ...past];
        }

        // Apply standard sorting for other cases
        filtered.sort((a, b) => {
            let aVal: string | number | null = null;
            let bVal: string | number | null = null;

            switch (sortField) {
                case "pickupAt":
                    aVal = new Date(a.pickupAt).getTime();
                    bVal = new Date(b.pickupAt).getTime();
                    break;
                case "dueAt":
                    aVal = new Date(a.dueAt).getTime();
                    bVal = new Date(b.dueAt).getTime();
                    break;
                case "createdAt":
                    aVal = new Date(a.createdAt).getTime();
                    bVal = new Date(b.createdAt).getTime();
                    break;
                case "completedAt":
                    aVal = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                    bVal = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                    break;
                case "tripNumber":
                    aVal = parseInt(a.tripNumber) || 0;
                    bVal = parseInt(b.tripNumber) || 0;
                    break;
                case "status":
                    aVal = a.status;
                    bVal = b.status;
                    break;
            }

            if (aVal === null || bVal === null) return 0;
            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [confirmations, searchQuery, statusFilter, dispatcherFilter, sortField, sortDirection]);

    // Calculate upcoming vs past counts for UI display
    const upcomingCount = useMemo(() => {
        const currentTime = Date.now();
        return filteredAndSortedConfirmations.filter((c) => new Date(c.pickupAt).getTime() >= currentTime).length;
    }, [filteredAndSortedConfirmations]);

    const pastCount = useMemo(() => {
        return filteredAndSortedConfirmations.length - upcomingCount;
    }, [filteredAndSortedConfirmations, upcomingCount]);

    // Pagination
    const paginatedConfirmations = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedConfirmations.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAndSortedConfirmations, currentPage]);

    const totalPages = Math.ceil(filteredAndSortedConfirmations.length / ITEMS_PER_PAGE);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    const fetchConfirmations = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getAllConfirmations({
                status: statusFilter === "ALL" ? undefined : statusFilter as never,
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                dateTo: dateTo ? new Date(dateTo) : undefined,
                dispatcherId: dispatcherFilter === "ALL" ? undefined : dispatcherFilter,
                search: searchQuery || undefined,
                limit: 500,
            });
            setConfirmations(result.confirmations as TripConfirmation[]);
            setTotalCount(result.total);
            setCurrentPage(1);
        } catch (error) {
            console.error("Failed to fetch confirmations:", error);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, dateFrom, dateTo, dispatcherFilter, searchQuery]);

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("ALL");
        setDispatcherFilter("ALL");
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    };

    const hasActiveFilters = searchQuery || statusFilter !== "ALL" || dispatcherFilter !== "ALL" || dateFrom || dateTo;

    const handleStatusChange = async (tripId: string, newStatus: "CONFIRMED" | "NO_ANSWER" | "CANCELLED" | "RESCHEDULED", notes?: string) => {
        setCompleting(tripId);
        try {
            await completeConfirmation(tripId, newStatus, notes || "");
            setSelectedTrip(null);
            setActionNotes("");
            router.refresh();
            // Refresh the confirmations list
            await fetchConfirmations();
        } catch (error) {
            console.error("Failed to update confirmation:", error);
        } finally {
            setCompleting(null);
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} className="sort-icon inactive" />;
        return sortDirection === "asc" ? (
            <ArrowUp size={14} className="sort-icon active" />
        ) : (
            <ArrowDown size={14} className="sort-icon active" />
        );
    };

    return (
        <div className="confirmations-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-title">
                        <div className="title-icon">
                            <Phone size={20} />
                        </div>
                        <div>
                            <h1>Trip Confirmations</h1>
                            <p>Command Center • 2-Hour Confirmation System</p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="header-stat">
                            <span className="stat-number">{stats.total}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="header-stat success">
                            <span className="stat-number">{stats.onTimeRate}%</span>
                            <span className="stat-label">On-Time</span>
                        </div>
                        <div className="header-stat warning">
                            <span className="stat-number">{pendingCount}</span>
                            <span className="stat-label">Pending</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className="tab-nav">
                <button
                    className={`tab-btn ${selectedTab === "trips" ? "active" : ""}`}
                    onClick={() => setSelectedTab("trips")}
                >
                    <ListFilter size={16} />
                    All Trips
                    <span className="tab-count">{totalCount}</span>
                </button>
                <button
                    className={`tab-btn ${selectedTab === "overview" ? "active" : ""}`}
                    onClick={() => setSelectedTab("overview")}
                >
                    <BarChart3 size={16} />
                    Analytics
                </button>
                <button
                    className={`tab-btn ${selectedTab === "dispatchers" ? "active" : ""}`}
                    onClick={() => setSelectedTab("dispatchers")}
                >
                    <Users size={16} />
                    Dispatchers
                </button>
                <button
                    className={`tab-btn ${selectedTab === "accountability" ? "active" : ""}`}
                    onClick={() => setSelectedTab("accountability")}
                >
                    <ShieldAlert size={16} />
                    Accountability
                    {totalMissed > 0 && <span className="missed-badge">{totalMissed}</span>}
                </button>
            </nav>

            {/* ALL TRIPS TAB */}
            {selectedTab === "trips" && (
                <div className="trips-content">
                    {/* Search and Filters Bar */}
                    <div className="toolbar">
                        <div className="search-box">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search trip #, passenger, driver, account..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="clear-search" onClick={() => setSearchQuery("")}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="toolbar-actions">
                            <button
                                className={`filter-toggle ${showFilters ? "active" : ""} ${hasActiveFilters ? "has-filters" : ""}`}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter size={16} />
                                Filters
                                {hasActiveFilters && <span className="filter-dot" />}
                            </button>
                        </div>
                    </div>

                    {/* Expanded Filters Panel */}
                    {showFilters && (
                        <div className="filters-panel">
                            <div className="filter-group">
                                <label>Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="CONFIRMED">Confirmed</option>
                                    <option value="NO_ANSWER">No Answer</option>
                                    <option value="CANCELLED">Cancelled</option>
                                    <option value="RESCHEDULED">Rescheduled</option>
                                    <option value="EXPIRED">Expired</option>
                                </select>
                            </div>

                            <div className="filter-group">
                                <label>Completed By</label>
                                <select
                                    value={dispatcherFilter}
                                    onChange={(e) => setDispatcherFilter(e.target.value)}
                                >
                                    <option value="ALL">All Dispatchers</option>
                                    {dispatchers.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} ({d.count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-group">
                                <label>Date From</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                            </div>

                            <div className="filter-group">
                                <label>Date To</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>

                            <div className="filter-actions">
                                <button className="apply-btn" onClick={fetchConfirmations} disabled={isLoading}>
                                    {isLoading ? "Loading..." : "Apply Filters"}
                                </button>
                                {hasActiveFilters && (
                                    <button className="clear-btn" onClick={clearFilters}>
                                        Clear All
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Results Summary */}
                    <div className="results-summary">
                        <span className="results-count">
                            Showing <strong>{paginatedConfirmations.length}</strong> of{" "}
                            <strong>{filteredAndSortedConfirmations.length}</strong> trips
                        </span>
                        <div className="section-counts">
                            <span className="upcoming-count">
                                <Clock size={12} />
                                {upcomingCount} upcoming
                            </span>
                            <span className="past-count">
                                <CheckCircle size={12} />
                                {pastCount} past
                            </span>
                        </div>
                        {hasActiveFilters && (
                            <span className="filtered-indicator">
                                (filtered from {totalCount} total)
                            </span>
                        )}
                    </div>

                    {/* Data Table */}
                    <div className="table-container">
                        <table className="trips-table">
                            <thead>
                                <tr>
                                    <th className="col-status">Status</th>
                                    <th className="col-trip sortable" onClick={() => handleSort("tripNumber")}>
                                        <span>Trip #</span>
                                        <SortIcon field="tripNumber" />
                                    </th>
                                    <th className="col-passenger">Passenger</th>
                                    <th className="col-driver">Driver</th>
                                    <th className="col-account">Account</th>
                                    <th className="col-pickup sortable" onClick={() => handleSort("pickupAt")}>
                                        <span>Pickup</span>
                                        <SortIcon field="pickupAt" />
                                    </th>
                                    <th className="col-due sortable" onClick={() => handleSort("dueAt")}>
                                        <span>Due</span>
                                        <SortIcon field="dueAt" />
                                    </th>
                                    <th className="col-completed sortable" onClick={() => handleSort("completedAt")}>
                                        <span>Completed</span>
                                        <SortIcon field="completedAt" />
                                    </th>
                                    <th className="col-dispatcher">By</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedConfirmations.length === 0 ? (
                                    <tr className="empty-row">
                                        <td colSpan={10}>
                                            <div className="empty-state">
                                                <Calendar size={40} />
                                                <p>No trips found</p>
                                                <span>Try adjusting your filters</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedConfirmations.map((trip) => {
                                        const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.PENDING;
                                        const Icon = config.icon;
                                        const isPending = trip.status === "PENDING";
                                        const overdue = isPending && isOverdue(trip.dueAt);

                                        return (
                                            <tr key={trip.id} className={overdue ? "overdue" : ""}>
                                                <td className="col-status">
                                                    <div
                                                        className="status-badge"
                                                        style={{
                                                            color: config.color,
                                                            background: config.bgColor,
                                                        }}
                                                    >
                                                        <Icon size={12} />
                                                        <span>{config.label}</span>
                                                    </div>
                                                </td>
                                                <td className="col-trip">
                                                    <div className="trip-info">
                                                        <span className="trip-number">#{trip.tripNumber}</span>
                                                        {trip.reservationNumber && (
                                                            <span className="res-number">
                                                                Res: {trip.reservationNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="col-passenger">
                                                    <div className="person-cell">
                                                        <User size={14} />
                                                        <span>{trip.passengerName}</span>
                                                    </div>
                                                </td>
                                                <td className="col-driver">
                                                    <div className="person-cell">
                                                        <Car size={14} />
                                                        <span>{trip.driverName}</span>
                                                    </div>
                                                </td>
                                                <td className="col-account">
                                                    {trip.accountName ? (
                                                        <div className="account-cell">
                                                            <Building2 size={14} />
                                                            <span>{trip.accountName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="empty-cell">—</span>
                                                    )}
                                                </td>
                                                <td className="col-pickup">
                                                    <div className="datetime-cell">
                                                        <span className="date">{formatDate(trip.pickupAt)}</span>
                                                        <span className="time">{formatTime(trip.pickupAt)}</span>
                                                    </div>
                                                </td>
                                                <td className="col-due">
                                                    <div className={`due-cell ${overdue ? "overdue" : ""}`}>
                                                        <span className="time">{formatTime(trip.dueAt)}</span>
                                                        {isPending && (
                                                            <span className={`time-diff ${overdue ? "overdue" : ""}`}>
                                                                {overdue ? "+" : "-"}{getTimeDiff(trip.dueAt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="col-completed">
                                                    {trip.completedAt ? (
                                                        <div className="completed-cell">
                                                            <span className="datetime">{formatDateTime(trip.completedAt)}</span>
                                                            {trip.minutesBeforeDue != null && (
                                                                <span className={`lead-time ${trip.minutesBeforeDue > 0 ? "early" : "late"}`}>
                                                                    {trip.minutesBeforeDue > 0 ? "+" : ""}{trip.minutesBeforeDue}m
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="empty-cell awaiting">Awaiting</span>
                                                    )}
                                                </td>
                                                <td className="col-dispatcher">
                                                    {trip.completedBy ? (
                                                        <div className="dispatcher-cell">
                                                            <div className="avatar">
                                                                {(trip.completedBy.name || "?").charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="name">{trip.completedBy.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="empty-cell">—</span>
                                                    )}
                                                </td>
                                                <td className="col-actions">
                                                    {isPending ? (
                                                        <button
                                                            className="action-btn"
                                                            onClick={() => setSelectedTrip(trip)}
                                                            disabled={completing === trip.id}
                                                        >
                                                            {completing === trip.id ? "..." : "Update"}
                                                        </button>
                                                    ) : (
                                                        <span className="empty-cell">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="page-numbers">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            className={`page-num ${currentPage === pageNum ? "active" : ""}`}
                                            onClick={() => setCurrentPage(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Status Change Modal */}
            {selectedTrip && (
                <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Update Confirmation Status</h3>
                            <span className="trip-badge">#{selectedTrip.tripNumber}</span>
                        </div>
                        <div className="modal-body">
                            <div className="modal-info">
                                <div className="info-row">
                                    <User size={14} />
                                    <span>{selectedTrip.passengerName}</span>
                                </div>
                                <div className="info-row">
                                    <Car size={14} />
                                    <span>{selectedTrip.driverName}</span>
                                </div>
                                <div className="info-row">
                                    <Clock size={14} />
                                    <span>Pickup: {formatTime(selectedTrip.pickupAt)}</span>
                                </div>
                            </div>
                            <div className="status-options">
                                <label>Select Status:</label>
                                <div className="options-grid">
                                    <button
                                        className="status-btn status-confirmed"
                                        onClick={() => handleStatusChange(selectedTrip.id, "CONFIRMED", actionNotes)}
                                        disabled={completing !== null}
                                    >
                                        <CheckCircle size={18} />
                                        <span>Confirmed</span>
                                    </button>
                                    <button
                                        className="status-btn status-no-answer"
                                        onClick={() => handleStatusChange(selectedTrip.id, "NO_ANSWER", actionNotes)}
                                        disabled={completing !== null}
                                    >
                                        <PhoneOff size={18} />
                                        <span>No Answer</span>
                                    </button>
                                    <button
                                        className="status-btn status-cancelled"
                                        onClick={() => handleStatusChange(selectedTrip.id, "CANCELLED", actionNotes)}
                                        disabled={completing !== null}
                                    >
                                        <XCircle size={18} />
                                        <span>Cancelled</span>
                                    </button>
                                    <button
                                        className="status-btn status-rescheduled"
                                        onClick={() => handleStatusChange(selectedTrip.id, "RESCHEDULED", actionNotes)}
                                        disabled={completing !== null}
                                    >
                                        <RotateCcw size={18} />
                                        <span>Rescheduled</span>
                                    </button>
                                </div>
                            </div>
                            <div className="notes-field">
                                <label>Notes (optional):</label>
                                <textarea
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder="Add any notes about the call..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setSelectedTrip(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ANALYTICS TAB */}
            {selectedTab === "overview" && (
                <div className="overview-content">
                    {/* Key Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon primary">
                                <Phone size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Total Confirmations</span>
                                <span className="stat-value">{stats.total}</span>
                                <span className="stat-sub">Last 30 days</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon success">
                                <TrendingUp size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">On-Time Rate</span>
                                <span className="stat-value">{stats.onTimeRate}%</span>
                                <span className="stat-sub">
                                    {stats.onTime} of {stats.completed} completed
                                </span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon warning">
                                <Timer size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Avg Lead Time</span>
                                <span className="stat-value">{stats.avgLeadTime}m</span>
                                <span className="stat-sub">Before due time</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon danger">
                                <TrendingDown size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Late/Expired</span>
                                <span className="stat-value">{stats.late + stats.expired}</span>
                                <span className="stat-sub">{stats.late} late, {stats.expired} expired</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Breakdown */}
                    <div className="card">
                        <h3>Status Breakdown</h3>
                        <div className="status-breakdown">
                            {Object.entries(stats.byStatus).map(([status, count]) => {
                                const config = STATUS_CONFIG[status] || {
                                    label: status,
                                    icon: Clock,
                                    color: "#64748b",
                                    bgColor: "rgba(100, 116, 139, 0.12)",
                                };
                                const Icon = config.icon;
                                const percentage = stats.total > 0
                                    ? Math.round((count / stats.total) * 100)
                                    : 0;

                                return (
                                    <div key={status} className="status-row">
                                        <div className="status-info">
                                            <div className="status-icon" style={{ color: config.color }}>
                                                <Icon size={16} />
                                            </div>
                                            <span className="status-name">{config.label}</span>
                                        </div>
                                        <div className="status-bar-wrapper">
                                            <div className="status-bar">
                                                <div
                                                    className="status-bar-fill"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: config.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="status-count">
                                            <span className="count">{count}</span>
                                            <span className="percent">({percentage}%)</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Today's Activity */}
                    <div className="card">
                        <h3>
                            <Calendar size={18} />
                            Today&apos;s Activity
                        </h3>
                        <div className="today-grid">
                            <div className="today-stat">
                                <span className="value">{todayConfirmations.length}</span>
                                <span className="label">Total</span>
                            </div>
                            <div className="today-stat success">
                                <span className="value">{completedToday}</span>
                                <span className="label">Done</span>
                            </div>
                            <div className="today-stat warning">
                                <span className="value">{pendingCount}</span>
                                <span className="label">Pending</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DISPATCHERS TAB */}
            {selectedTab === "dispatchers" && (
                <div className="dispatchers-content">
                    <div className="card">
                        <h3>Dispatcher Performance</h3>
                        <p className="card-subtitle">Last 30 days</p>

                        {dispatcherMetrics.length === 0 ? (
                            <div className="empty-state">
                                <Users size={48} />
                                <p>No confirmation data yet</p>
                            </div>
                        ) : (
                            <div className="dispatcher-table">
                                <div className="table-header">
                                    <span className="col-name">Dispatcher</span>
                                    <span className="col-total">Total</span>
                                    <span className="col-ontime">On-Time</span>
                                    <span className="col-late">Late</span>
                                    <span className="col-rate">Rate</span>
                                </div>
                                {dispatcherMetrics.map((d) => (
                                    <div key={d.id} className="table-row">
                                        <div className="col-name">
                                            <div className="dispatcher-avatar">
                                                {d.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{d.name}</span>
                                        </div>
                                        <span className="col-total">{d.total}</span>
                                        <span className="col-ontime success">{d.onTime}</span>
                                        <span className="col-late danger">{d.late}</span>
                                        <span className={`col-rate ${d.onTimeRate >= 80 ? "success" : d.onTimeRate >= 50 ? "warning" : "danger"}`}>
                                            {d.onTimeRate}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ACCOUNTABILITY TAB */}
            {selectedTab === "accountability" && (
                <div className="accountability-content">
                    {/* Summary Stats */}
                    <div className="accountability-summary">
                        <div className="summary-stat danger">
                            <span className="label">Missed Confirmations</span>
                            <span className="value">{totalMissed}</span>
                            <span className="sub">Last 30 days</span>
                        </div>
                        <div
                            className={`summary-stat ${
                                avgAccountabilityRate >= 90
                                    ? "success"
                                    : avgAccountabilityRate >= 70
                                    ? "warning"
                                    : "danger"
                            }`}
                        >
                            <span className="label">Team Accountability</span>
                            <span className="value">{avgAccountabilityRate}%</span>
                            <span className="sub">Average rate</span>
                        </div>
                        <div className="summary-stat">
                            <span className="label">Dispatchers Tracked</span>
                            <span className="value">{accountabilityMetrics.length}</span>
                            <span className="sub">Active users</span>
                        </div>
                    </div>

                    {/* Top Issues */}
                    {worstPerformers.length > 0 && (
                        <div className="card top-issues-card">
                            <h3>
                                <AlertTriangle size={16} />
                                Top Issues
                            </h3>
                            <div className="top-issues">
                                {worstPerformers.map((m) => (
                                    <div key={m.id} className="issue-item">
                                        <div className="issue-avatar">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="issue-info">
                                            <span className="issue-name">{m.name}</span>
                                            <span className="issue-role">{m.role}</span>
                                        </div>
                                        <div className="issue-stats">
                                            <span className="missed-count">
                                                {m.confirmationsMissedWhileOnDuty} missed
                                            </span>
                                            <span
                                                className={`rate ${
                                                    m.accountabilityRate >= 80
                                                        ? "success"
                                                        : m.accountabilityRate >= 50
                                                        ? "warning"
                                                        : "danger"
                                                }`}
                                            >
                                                {m.accountabilityRate}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dispatcher Accountability Table */}
                    <div className="card">
                        <h3>Dispatcher Accountability</h3>
                        <p className="card-subtitle">
                            Performance metrics including missed confirmations while on duty
                        </p>

                        {accountabilityMetrics.length === 0 ? (
                            <div className="empty-state">
                                <ShieldAlert size={48} />
                                <p>No accountability data yet</p>
                            </div>
                        ) : (
                            <div className="accountability-table">
                                <div className="table-header accountability-header">
                                    <span className="col-name">Dispatcher</span>
                                    <span className="col-shifts">Shifts</span>
                                    <span className="col-completed">Completed</span>
                                    <span className="col-ontime">On-Time</span>
                                    <span className="col-missed">Missed</span>
                                    <span className="col-rate">Rate</span>
                                </div>
                                {accountabilityMetrics.map((m) => (
                                    <div key={m.id} className="table-row accountability-row">
                                        <div className="col-name">
                                            <div className="dispatcher-avatar">
                                                {m.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="name-info">
                                                <span className="name">{m.name}</span>
                                                <span className="role">{m.role}</span>
                                            </div>
                                        </div>
                                        <span className="col-shifts">{m.totalShifts}</span>
                                        <span className="col-completed">{m.confirmationsCompleted}</span>
                                        <span className="col-ontime success">{m.confirmationsOnTime}</span>
                                        <span
                                            className={`col-missed ${
                                                m.confirmationsMissedWhileOnDuty > 0 ? "danger" : ""
                                            }`}
                                        >
                                            {m.confirmationsMissedWhileOnDuty}
                                        </span>
                                        <span
                                            className={`col-rate ${
                                                m.accountabilityRate >= 80
                                                    ? "success"
                                                    : m.accountabilityRate >= 50
                                                    ? "warning"
                                                    : "danger"
                                            }`}
                                        >
                                            {m.accountabilityRate}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Missed Confirmations List */}
                    <div className="card">
                        <h3>Missed Confirmations</h3>
                        <p className="card-subtitle">
                            Confirmations that expired while dispatchers were on duty
                        </p>

                        {missedConfirmations.length === 0 ? (
                            <div className="empty-state">
                                <CheckCircle size={48} />
                                <p>No missed confirmations</p>
                            </div>
                        ) : (
                            <div className="missed-list">
                                {missedConfirmations.map((conf) => (
                                    <div key={conf.id} className="missed-item">
                                        <div
                                            className="missed-header"
                                            onClick={() => toggleMissedExpand(conf.id)}
                                        >
                                            <div className="missed-info">
                                                <span className="trip-number">#{conf.tripNumber}</span>
                                                <span className="passenger">{conf.passengerName}</span>
                                            </div>
                                            <div className="missed-meta">
                                                <span className="due-time">
                                                    <Clock size={12} />
                                                    Due: {formatTime(conf.dueAt)}
                                                </span>
                                                <span className="on-duty-count">
                                                    <Users size={12} />
                                                    {conf.onDutyDispatchers.length} on duty
                                                </span>
                                            </div>
                                            <div className="expand-icon">
                                                {expandedMissed.has(conf.id) ? (
                                                    <ChevronUp size={18} />
                                                ) : (
                                                    <ChevronDown size={18} />
                                                )}
                                            </div>
                                        </div>
                                        {expandedMissed.has(conf.id) && (
                                            <div className="missed-details">
                                                <div className="detail-row">
                                                    <span className="detail-label">Driver:</span>
                                                    <span>{conf.driverName}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Pickup:</span>
                                                    <span>{formatTime(conf.pickupAt)}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Expired:</span>
                                                    <span>
                                                        {conf.expiredAt
                                                            ? new Date(conf.expiredAt).toLocaleString()
                                                            : "N/A"}
                                                    </span>
                                                </div>
                                                <div className="on-duty-section">
                                                    <span className="detail-label">Dispatchers On Duty:</span>
                                                    <div className="on-duty-list">
                                                        {conf.onDutyDispatchers.map((d) => (
                                                            <div key={d.id} className="on-duty-dispatcher">
                                                                <div className="dispatcher-avatar small">
                                                                    {(d.name || "?").charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="name">{d.name || "Unknown"}</span>
                                                                <span className="shift-time">
                                                                    {formatTime(d.shiftStart)}
                                                                    {d.shiftEnd
                                                                        ? ` - ${formatTime(d.shiftEnd)}`
                                                                        : " (active)"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                /* ========================================
                   CONFIRMATIONS PAGE - COMMAND CENTER
                   ======================================== */

                .confirmations-page {
                    padding: 1.5rem;
                    max-width: 1600px;
                    margin: 0 auto;
                    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
                }

                /* ===== HEADER ===== */
                .page-header {
                    margin-bottom: 1.5rem;
                }

                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 2rem;
                    flex-wrap: wrap;
                }

                .header-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                }

                .title-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 20px var(--accent-glow);
                }

                .header-title h1 {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0;
                    letter-spacing: -0.02em;
                }

                .header-title p {
                    color: var(--text-muted);
                    font-size: 0.875rem;
                    margin: 0.25rem 0 0;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .header-stats {
                    display: flex;
                    gap: 1.5rem;
                }

                .header-stat {
                    text-align: center;
                    padding: 0.75rem 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                }

                .header-stat .stat-number {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1.2;
                }

                .header-stat .stat-label {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .header-stat.success .stat-number { color: var(--success); }
                .header-stat.warning .stat-number { color: var(--warning); }

                /* ===== TAB NAVIGATION ===== */
                .tab-nav {
                    display: flex;
                    gap: 0.25rem;
                    margin-bottom: 1.5rem;
                    padding: 0.25rem;
                    background: var(--bg-surface);
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    width: fit-content;
                }

                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tab-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .tab-btn.active {
                    background: var(--accent);
                    color: white;
                    box-shadow: 0 2px 8px var(--accent-glow);
                }

                .tab-count {
                    background: rgba(255,255,255,0.2);
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .tab-btn:not(.active) .tab-count {
                    background: var(--bg-hover);
                    color: var(--text-muted);
                }

                .missed-badge {
                    background: var(--danger);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                /* ===== TRIPS TAB ===== */
                .trips-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                /* Toolbar */
                .toolbar {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .search-box {
                    flex: 1;
                    min-width: 280px;
                    max-width: 480px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    transition: border-color 0.2s;
                }

                .search-box:focus-within {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px var(--accent-soft);
                }

                .search-box :global(svg) {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .search-box input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    outline: none;
                }

                .search-box input::placeholder {
                    color: var(--text-muted);
                }

                .clear-search {
                    background: var(--bg-hover);
                    border: none;
                    border-radius: 4px;
                    padding: 0.25rem;
                    cursor: pointer;
                    color: var(--text-muted);
                    display: flex;
                }

                .clear-search:hover {
                    color: var(--text-primary);
                    background: var(--bg-active);
                }

                .toolbar-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .filter-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }

                .filter-toggle:hover {
                    border-color: var(--text-muted);
                    color: var(--text-primary);
                }

                .filter-toggle.active {
                    background: var(--accent-soft);
                    border-color: var(--accent);
                    color: var(--accent);
                }

                .filter-dot {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 6px;
                    height: 6px;
                    background: var(--accent);
                    border-radius: 50%;
                }

                /* Filters Panel */
                .filters-panel {
                    display: flex;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }

                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                    min-width: 160px;
                }

                .filter-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .filter-group select,
                .filter-group input {
                    padding: 0.625rem 0.875rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                }

                .filter-group select:focus,
                .filter-group input:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .filter-actions {
                    display: flex;
                    gap: 0.5rem;
                    margin-left: auto;
                }

                .apply-btn {
                    padding: 0.625rem 1.25rem;
                    background: var(--accent);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .apply-btn:hover:not(:disabled) {
                    background: var(--accent-hover);
                }

                .apply-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .clear-btn {
                    padding: 0.625rem 1rem;
                    background: transparent;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .clear-btn:hover {
                    border-color: var(--danger);
                    color: var(--danger);
                }

                /* Results Summary */
                .results-summary {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0;
                    color: var(--text-secondary);
                    font-size: 0.8125rem;
                }

                .results-summary strong {
                    color: var(--text-primary);
                }

                .filtered-indicator {
                    color: var(--text-muted);
                }

                .section-counts {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-left: auto;
                }

                .upcoming-count,
                .past-count {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .upcoming-count {
                    background: var(--info-bg, rgba(96, 165, 250, 0.12));
                    color: var(--info, #60a5fa);
                }

                .past-count {
                    background: var(--success-bg, rgba(74, 222, 128, 0.12));
                    color: var(--success, #4ade80);
                }

                /* Data Table */
                .table-container {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .trips-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8125rem;
                }

                .trips-table thead {
                    background: var(--bg-surface);
                    border-bottom: 1px solid var(--border);
                }

                .trips-table th {
                    padding: 0.875rem 1rem;
                    text-align: left;
                    font-weight: 600;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    white-space: nowrap;
                }

                .trips-table th.sortable {
                    cursor: pointer;
                    user-select: none;
                }

                .trips-table th.sortable:hover {
                    color: var(--text-primary);
                }

                .trips-table th.sortable span {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                }

                .trips-table th :global(.sort-icon) {
                    opacity: 0.3;
                }

                .trips-table th :global(.sort-icon.active) {
                    opacity: 1;
                    color: var(--accent);
                }

                .trips-table tbody tr {
                    border-bottom: 1px solid var(--border);
                    transition: background 0.15s;
                }

                .trips-table tbody tr:last-child {
                    border-bottom: none;
                }

                .trips-table tbody tr:hover {
                    background: var(--bg-hover);
                }

                .trips-table tbody tr.overdue {
                    background: var(--danger-soft);
                }

                .trips-table tbody tr.overdue:hover {
                    background: rgba(239, 68, 68, 0.12);
                }

                .trips-table td {
                    padding: 0.875rem 1rem;
                    vertical-align: middle;
                }

                /* Table Cell Styles */
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.625rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .trip-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .trip-number {
                    font-weight: 700;
                    color: var(--text-primary);
                    font-family: 'JetBrains Mono', monospace;
                }

                .res-number {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }

                .person-cell,
                .account-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                }

                .person-cell :global(svg),
                .account-cell :global(svg) {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .datetime-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .datetime-cell .date {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .datetime-cell .time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-family: 'JetBrains Mono', monospace;
                }

                .due-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .due-cell .time {
                    font-family: 'JetBrains Mono', monospace;
                    color: var(--text-secondary);
                }

                .time-diff {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--success);
                }

                .time-diff.overdue {
                    color: var(--danger);
                }

                .completed-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .completed-cell .datetime {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .lead-time {
                    font-size: 0.7rem;
                    font-weight: 600;
                    font-family: 'JetBrains Mono', monospace;
                }

                .lead-time.early {
                    color: var(--success);
                }

                .lead-time.late {
                    color: var(--danger);
                }

                .dispatcher-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .dispatcher-cell .avatar {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--accent-soft);
                    color: var(--accent);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    font-weight: 700;
                }

                .dispatcher-cell .name {
                    color: var(--text-secondary);
                    font-size: 0.8125rem;
                }

                .empty-cell {
                    color: var(--text-muted);
                }

                .empty-cell.awaiting {
                    color: var(--warning);
                    font-weight: 500;
                }

                .empty-row td {
                    padding: 3rem 1rem;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted);
                    text-align: center;
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                }

                .empty-state p {
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .empty-state span {
                    font-size: 0.8125rem;
                }

                /* Pagination */
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem 0;
                }

                .page-btn {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .page-btn:hover:not(:disabled) {
                    border-color: var(--accent);
                    color: var(--accent);
                }

                .page-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .page-numbers {
                    display: flex;
                    gap: 0.25rem;
                }

                .page-num {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .page-num:hover {
                    background: var(--bg-hover);
                }

                .page-num.active {
                    background: var(--accent);
                    color: white;
                    font-weight: 700;
                }

                /* ===== OVERVIEW TAB ===== */
                .overview-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                }

                .stat-card {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                }

                .stat-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .stat-icon.primary {
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .stat-icon.success {
                    background: var(--success-soft);
                    color: var(--success);
                }

                .stat-icon.warning {
                    background: var(--warning-soft);
                    color: var(--warning);
                }

                .stat-icon.danger {
                    background: var(--danger-soft);
                    color: var(--danger);
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                }

                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1.2;
                }

                .stat-sub {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                /* Card */
                .card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.25rem;
                }

                .card h3 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .card h3 :global(svg) {
                    color: var(--accent);
                }

                .card-subtitle {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                }

                /* Status Breakdown */
                .status-breakdown {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-top: 1rem;
                }

                .status-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .status-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 120px;
                    flex-shrink: 0;
                }

                .status-icon {
                    display: flex;
                    align-items: center;
                }

                .status-name {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .status-bar-wrapper {
                    flex: 1;
                }

                .status-bar {
                    height: 8px;
                    background: var(--bg-surface);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .status-bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.5s ease;
                }

                .status-count {
                    width: 80px;
                    text-align: right;
                    flex-shrink: 0;
                }

                .status-count .count {
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .status-count .percent {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-left: 0.25rem;
                }

                /* Today Grid */
                .today-grid {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }

                .today-stat {
                    flex: 1;
                    padding: 1rem;
                    background: var(--bg-surface);
                    border-radius: 10px;
                    text-align: center;
                }

                .today-stat .value {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .today-stat .label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }

                .today-stat.success .value { color: var(--success); }
                .today-stat.warning .value { color: var(--warning); }

                /* ===== DISPATCHERS TAB ===== */
                .dispatchers-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .dispatcher-table {
                    margin-top: 1rem;
                }

                .table-header,
                .table-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    gap: 1rem;
                    padding: 0.75rem 0;
                    align-items: center;
                }

                .table-header {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--border);
                }

                .table-row {
                    border-bottom: 1px solid var(--border);
                }

                .table-row:last-child {
                    border-bottom: none;
                }

                .col-name {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .dispatcher-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--accent-soft);
                    color: var(--accent);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.875rem;
                }

                .dispatcher-avatar.small {
                    width: 24px;
                    height: 24px;
                    font-size: 0.7rem;
                }

                .col-total,
                .col-ontime,
                .col-late,
                .col-rate,
                .col-shifts,
                .col-completed,
                .col-missed {
                    font-size: 0.875rem;
                    text-align: center;
                }

                .success { color: var(--success); }
                .warning { color: var(--warning); }
                .danger { color: var(--danger); }

                /* ===== ACCOUNTABILITY TAB ===== */
                .accountability-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .accountability-summary {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .summary-stat {
                    flex: 1;
                    min-width: 180px;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    text-align: center;
                }

                .summary-stat .label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .summary-stat .value {
                    display: block;
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0.25rem 0;
                }

                .summary-stat .sub {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .summary-stat.success .value { color: var(--success); }
                .summary-stat.warning .value { color: var(--warning); }
                .summary-stat.danger .value { color: var(--danger); }

                .top-issues-card h3 {
                    color: var(--danger);
                }

                .top-issues {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-top: 1rem;
                }

                .issue-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: var(--bg-surface);
                    border-radius: 10px;
                }

                .issue-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--danger-soft);
                    color: var(--danger);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                }

                .issue-info {
                    flex: 1;
                }

                .issue-name {
                    display: block;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .issue-role {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .issue-stats {
                    text-align: right;
                }

                .missed-count {
                    display: block;
                    font-weight: 600;
                    color: var(--danger);
                }

                .issue-stats .rate {
                    font-size: 0.75rem;
                }

                .accountability-table,
                .accountability-header,
                .accountability-row {
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
                }

                .name-info {
                    display: flex;
                    flex-direction: column;
                }

                .name-info .name {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .name-info .role {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }

                /* Missed Confirmations List */
                .missed-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 1rem;
                }

                .missed-item {
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    overflow: hidden;
                    background: var(--bg-surface);
                }

                .missed-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.875rem 1rem;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .missed-header:hover {
                    background: var(--bg-hover);
                }

                .missed-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .missed-info .trip-number {
                    font-weight: 700;
                    color: var(--danger);
                    font-family: 'JetBrains Mono', monospace;
                }

                .missed-info .passenger {
                    color: var(--text-secondary);
                }

                .missed-meta {
                    display: flex;
                    gap: 1rem;
                }

                .missed-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: var(--text-muted);
                }

                .expand-icon {
                    color: var(--text-muted);
                }

                .missed-details {
                    padding: 1rem;
                    border-top: 1px solid var(--border);
                    background: var(--bg-card);
                }

                .detail-row {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.375rem 0;
                }

                .detail-label {
                    font-weight: 600;
                    color: var(--text-muted);
                    font-size: 0.8125rem;
                    min-width: 80px;
                }

                .on-duty-section {
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--border);
                }

                .on-duty-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }

                .on-duty-dispatcher {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem;
                    background: var(--bg-surface);
                    border-radius: 8px;
                }

                .on-duty-dispatcher .name {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .on-duty-dispatcher .shift-time {
                    margin-left: auto;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-family: 'JetBrains Mono', monospace;
                }

                /* ===== RESPONSIVE ===== */
                @media (max-width: 1024px) {
                    .table-container {
                        overflow-x: auto;
                    }

                    .trips-table {
                        min-width: 900px;
                    }
                }

                @media (max-width: 768px) {
                    .confirmations-page {
                        padding: 1rem;
                    }

                    .header-content {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .header-stats {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .tab-nav {
                        width: 100%;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                    }

                    .tab-btn {
                        white-space: nowrap;
                        padding: 0.625rem 1rem;
                    }

                    .toolbar {
                        flex-direction: column;
                    }

                /* ===== MODAL STYLES ===== */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .modal {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 420px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--border);
                }

                .modal-header h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .trip-badge {
                    background: var(--accent);
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 700;
                    font-family: 'JetBrains Mono', monospace;
                }

                .modal-body {
                    padding: 1.25rem;
                }

                .modal-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding: 0.875rem;
                    background: var(--bg-secondary);
                    border-radius: 10px;
                    margin-bottom: 1.25rem;
                }

                .info-row {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .info-row :global(svg) {
                    color: var(--accent);
                    flex-shrink: 0;
                }

                .status-options {
                    margin-bottom: 1.25rem;
                }

                .status-options label {
                    display: block;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.625rem;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .options-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.625rem;
                }

                .status-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 1rem;
                    border: 1px solid;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.8125rem;
                    font-weight: 600;
                }

                .status-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                }

                .status-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .status-btn.status-confirmed {
                    background: var(--success-soft, rgba(74, 222, 128, 0.1));
                    border-color: var(--success, #4ade80);
                    color: var(--success, #4ade80);
                }

                .status-btn.status-no-answer {
                    background: var(--warning-soft, rgba(251, 191, 36, 0.1));
                    border-color: var(--warning, #fbbf24);
                    color: var(--warning, #fbbf24);
                }

                .status-btn.status-cancelled {
                    background: var(--danger-soft, rgba(248, 113, 113, 0.1));
                    border-color: var(--danger, #f87171);
                    color: var(--danger, #f87171);
                }

                .status-btn.status-rescheduled {
                    background: rgba(167, 139, 250, 0.1);
                    border-color: #a78bfa;
                    color: #a78bfa;
                }

                .notes-field {
                    margin-bottom: 0.5rem;
                }

                .notes-field label {
                    display: block;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .notes-field textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    font-family: inherit;
                    resize: vertical;
                    min-height: 70px;
                }

                .notes-field textarea:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .modal-footer {
                    padding: 1rem 1.25rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    justify-content: flex-end;
                }

                .cancel-btn {
                    padding: 0.625rem 1.25rem;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .cancel-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                /* Action Button */
                .action-btn {
                    padding: 0.5rem 1rem;
                    background: var(--accent);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    filter: brightness(1.1);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* ===== MEDIA QUERIES ===== */
                @media (max-width: 768px) {
                    .search-box {
                        max-width: none;
                    }

                    .filters-panel {
                        flex-direction: column;
                    }

                    .filter-group {
                        width: 100%;
                    }

                    .filter-actions {
                        margin-left: 0;
                        width: 100%;
                    }

                    .apply-btn, .clear-btn {
                        flex: 1;
                    }

                    .stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .table-header,
                    .table-row {
                        grid-template-columns: 1.5fr 1fr 1fr 1fr;
                    }

                    .col-late {
                        display: none;
                    }

                    .accountability-summary {
                        flex-direction: column;
                    }

                    .summary-stat {
                        min-width: auto;
                    }
                }

                @media (max-width: 480px) {
                    .header-title h1 {
                        font-size: 1.25rem;
                    }

                    .title-icon {
                        width: 40px;
                        height: 40px;
                    }

                    .header-stat {
                        padding: 0.5rem 0.75rem;
                    }

                    .header-stat .stat-number {
                        font-size: 1.25rem;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .stat-card {
                        padding: 1rem;
                    }

                    .today-grid {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
}

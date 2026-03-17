"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
    Phone,
    Clock,
    CheckCircle,
    TrendingUp,
    TrendingDown,
    Timer,
    BarChart3,
    Users,
    Calendar,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    ListFilter,
    AlertTriangle,
} from "lucide-react";
import { getAllConfirmations, completeConfirmation, getConfirmationTabData } from "@/lib/tripConfirmationActions";
import { useRouter } from "next/navigation";
import ConfirmationModal from "./components/ConfirmationModal";
import TripsToolbarClient from "./components/TripsToolbarClient";
import TripsTableClient from "./components/TripsTableClient";
import { formatTime } from "./components/utils";
import {
    Stats,
    DispatcherMetric,
    TripConfirmation,
    AccountabilityMetric,
    MissedConfirmation,
    Dispatcher,
    SortField,
    SortDirection,
    StatusFilter,
    STATUS_CONFIG,
} from "./types";

interface Props {
    stats: Stats;
    dispatcherMetrics?: DispatcherMetric[];
    todayConfirmations?: TripConfirmation[];
    accountabilityMetrics?: AccountabilityMetric[];
    missedConfirmations?: MissedConfirmation[];
    allConfirmations: TripConfirmation[];
    totalConfirmations: number;
    dispatchers: Dispatcher[];
}

export default function ConfirmationsClient({
    stats,
    dispatcherMetrics = [],
    todayConfirmations = [],
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
    const [now, setNow] = useState(() => Date.now());
    const router = useRouter();

    // Lazy loading state for tabs
    const [lazyDispatcherMetrics, setLazyDispatcherMetrics] = useState<DispatcherMetric[] | null>(null);
    const [lazyTodayConfirmations, setLazyTodayConfirmations] = useState<TripConfirmation[] | null>(null);
    const [lazyAccountabilityMetrics, setLazyAccountabilityMetrics] = useState<AccountabilityMetric[] | null>(null);
    const [lazyMissedConfirmations, setLazyMissedConfirmations] = useState<MissedConfirmation[] | null>(null);
    const [tabLoading, setTabLoading] = useState<string | null>(null);
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(["trips"]));

    // Update time every minute for accurate time displays
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Handle tab selection with lazy loading
    const handleTabSelect = useCallback(async (tab: "trips" | "overview" | "dispatchers" | "accountability") => {
        setSelectedTab(tab);

        // Skip if already loaded or is trips tab (already loaded on server)
        if (loadedTabs.has(tab) || tab === "trips") return;

        // Fetch data for the tab
        setTabLoading(tab);
        try {
            const data = await getConfirmationTabData(tab === "overview" ? "overview" : tab === "dispatchers" ? "dispatchers" : "accountability", 30);

            if (tab === "overview") {
                setLazyTodayConfirmations(data.todayConfirmations || []);
            } else if (tab === "dispatchers") {
                setLazyDispatcherMetrics(data.dispatcherMetrics || []);
            } else if (tab === "accountability") {
                setLazyAccountabilityMetrics(data.accountabilityMetrics || []);
                setLazyMissedConfirmations(data.missedConfirmations || []);
            }

            setLoadedTabs(prev => new Set([...prev, tab]));
        } catch (err) {
            console.error(`Failed to load ${tab} data:`, err);
        } finally {
            setTabLoading(null);
        }
    }, [loadedTabs]);

    // Use lazy-loaded data or fall back to props
    const activeDispatcherMetrics = lazyDispatcherMetrics ?? dispatcherMetrics;
    const activeTodayConfirmations = lazyTodayConfirmations ?? todayConfirmations;
    const activeAccountabilityMetrics = lazyAccountabilityMetrics ?? accountabilityMetrics;
    const activeMissedConfirmations = lazyMissedConfirmations ?? missedConfirmations;

    const ITEMS_PER_PAGE = 25;


    const pendingCount = activeTodayConfirmations.filter((c) => c.status === "PENDING").length;
    const completedToday = activeTodayConfirmations.filter((c) => c.completedAt !== null).length;

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

    const totalMissed = activeMissedConfirmations.length;
    const avgAccountabilityRate =
        activeAccountabilityMetrics.length > 0
            ? Math.round(
                  activeAccountabilityMetrics.reduce((sum, m) => sum + m.accountabilityRate, 0) /
                      activeAccountabilityMetrics.length
              )
            : 100;
    const worstPerformers = activeAccountabilityMetrics
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
                limit: 100, // Optimized: reduced from 500 for better performance
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

    const handleStatusChange = async (tripId: string, newStatus: "PENDING" | "CONFIRMED" | "NO_ANSWER" | "CANCELLED" | "RESCHEDULED", notes?: string) => {
        setCompleting(tripId);
        try {
            await completeConfirmation(tripId, newStatus, notes || "");
            setSelectedTrip(null);
            router.refresh();
            // Refresh the confirmations list
            await fetchConfirmations();
        } catch (err) {
            console.error("Failed to update confirmation:", err);
            // Re-throw so the modal can display the error
            throw err;
        } finally {
            setCompleting(null);
        }
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
                    onClick={() => handleTabSelect("trips")}
                >
                    <ListFilter size={16} />
                    All Trips
                    <span className="tab-count">{totalCount}</span>
                </button>
                <button
                    className={`tab-btn ${selectedTab === "overview" ? "active" : ""}`}
                    onClick={() => handleTabSelect("overview")}
                    disabled={tabLoading === "overview"}
                >
                    <BarChart3 size={16} />
                    Analytics
                    {tabLoading === "overview" && <span className="tab-loading">...</span>}
                </button>
                <button
                    className={`tab-btn ${selectedTab === "dispatchers" ? "active" : ""}`}
                    onClick={() => handleTabSelect("dispatchers")}
                    disabled={tabLoading === "dispatchers"}
                >
                    <Users size={16} />
                    Dispatchers
                    {tabLoading === "dispatchers" && <span className="tab-loading">...</span>}
                </button>
                <button
                    className={`tab-btn ${selectedTab === "accountability" ? "active" : ""}`}
                    onClick={() => handleTabSelect("accountability")}
                    disabled={tabLoading === "accountability"}
                >
                    <ShieldAlert size={16} />
                    Accountability
                    {tabLoading === "accountability" && <span className="tab-loading">...</span>}
                    {totalMissed > 0 && !tabLoading && <span className="missed-badge">{totalMissed}</span>}
                </button>
            </nav>

            {/* ALL TRIPS TAB */}
            {selectedTab === "trips" && (
                <div className="trips-content">
                    <TripsToolbarClient
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        dispatcherFilter={dispatcherFilter}
                        onDispatcherFilterChange={setDispatcherFilter}
                        dateFrom={dateFrom}
                        onDateFromChange={setDateFrom}
                        dateTo={dateTo}
                        onDateToChange={setDateTo}
                        showFilters={showFilters}
                        onToggleFilters={() => setShowFilters(!showFilters)}
                        hasActiveFilters={!!hasActiveFilters}
                        dispatchers={dispatchers}
                        isLoading={isLoading}
                        onApplyFilters={fetchConfirmations}
                        onClearFilters={clearFilters}
                        showing={paginatedConfirmations.length}
                        total={filteredAndSortedConfirmations.length}
                        upcomingCount={upcomingCount}
                        pastCount={pastCount}
                        grandTotal={totalCount}
                    />
                    <TripsTableClient
                        trips={paginatedConfirmations}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        onSelectTrip={setSelectedTrip}
                        completingId={completing}
                        now={now}
                    />
                </div>
            )}

            {/* Status Change Modal */}
            {selectedTrip && (
                <ConfirmationModal
                    trip={selectedTrip}
                    onClose={() => setSelectedTrip(null)}
                    onStatusChange={handleStatusChange}
                    isUpdating={completing !== null}
                />
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
                        {tabLoading === "overview" ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Loading today&apos;s data...</p>
                            </div>
                        ) : (
                            <div className="today-grid">
                                <div className="today-stat">
                                    <span className="value">{activeTodayConfirmations.length}</span>
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
                        )}
                    </div>
                </div>
            )}

            {/* DISPATCHERS TAB */}
            {selectedTab === "dispatchers" && (
                <div className="dispatchers-content">
                    <div className="card">
                        <h3>Dispatcher Performance</h3>
                        <p className="card-subtitle">Last 30 days</p>

                        {tabLoading === "dispatchers" ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Loading dispatcher data...</p>
                            </div>
                        ) : activeDispatcherMetrics.length === 0 ? (
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
                                {activeDispatcherMetrics.map((d) => (
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
                            <span className="value">{activeAccountabilityMetrics.length}</span>
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

                        {tabLoading === "accountability" ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Loading accountability data...</p>
                            </div>
                        ) : activeAccountabilityMetrics.length === 0 ? (
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
                                {activeAccountabilityMetrics.map((m) => (
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

                        {activeMissedConfirmations.length === 0 ? (
                            <div className="empty-state">
                                <CheckCircle size={48} />
                                <p>No missed confirmations</p>
                            </div>
                        ) : (
                            <div className="missed-list">
                                {activeMissedConfirmations.map((conf) => (
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

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem;
                    color: var(--text-muted);
                }

                .loading-state .spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid var(--border-primary);
                    border-top-color: var(--accent-blue);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .tab-loading {
                    font-size: 0.75rem;
                    color: var(--accent-blue);
                    margin-left: 0.25rem;
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

                .error-banner {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: var(--danger-soft, rgba(239, 68, 68, 0.1));
                    border: 1px solid var(--danger, #ef4444);
                    border-radius: 8px;
                    color: var(--danger, #ef4444);
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .error-banner span {
                    flex: 1;
                }

                .error-close {
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 0.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                }

                .error-close:hover {
                    opacity: 1;
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

                .status-btn.status-pending {
                    background: rgba(96, 165, 250, 0.1);
                    border-color: #60a5fa;
                    color: #60a5fa;
                }

                .status-btn.current {
                    opacity: 0.5;
                    cursor: not-allowed;
                    position: relative;
                }

                .status-btn.current::after {
                    content: "Current";
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-size: 0.625rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .current-status {
                    background: var(--bg-tertiary);
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    margin-top: 0.25rem;
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

                /* ===== MEDIA QUERIES ===== */
                @media (max-width: 768px) {
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

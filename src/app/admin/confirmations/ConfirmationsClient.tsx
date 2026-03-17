"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Phone, BarChart3, Users, ShieldAlert, ListFilter } from "lucide-react";
import { getAllConfirmations, completeConfirmation, getConfirmationTabData } from "@/lib/tripConfirmationActions";
import { useRouter } from "next/navigation";
import {
    ConfirmationModal,
    TripsToolbarClient,
    TripsTableClient,
    AnalyticsTabClient,
    DispatchersTabClient,
    AccountabilityTabClient,
} from "./components";
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
} from "./types";
import styles from "./Confirmations.module.css";

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
        if (loadedTabs.has(tab) || tab === "trips") return;

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
    const totalMissed = activeMissedConfirmations.length;

    const toggleMissedExpand = (id: string) => {
        setExpandedMissed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter and sort confirmations locally
    const filteredAndSortedConfirmations = useMemo(() => {
        let filtered = [...confirmations];
        const currentTime = Date.now();

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

        if (statusFilter !== "ALL") {
            filtered = filtered.filter((c) => c.status === statusFilter);
        }

        if (dispatcherFilter !== "ALL") {
            filtered = filtered.filter((c) => c.completedBy?.id === dispatcherFilter);
        }

        if (sortField === "pickupAt" && sortDirection === "desc") {
            const upcoming = filtered.filter((c) => new Date(c.pickupAt).getTime() >= currentTime);
            const past = filtered.filter((c) => new Date(c.pickupAt).getTime() < currentTime);
            upcoming.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
            past.sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime());
            if (upcoming.length > 0 && past.length > 0) {
                (upcoming[upcoming.length - 1] as TripConfirmation & { _isLastUpcoming?: boolean })._isLastUpcoming = true;
            }
            return [...upcoming, ...past];
        }

        filtered.sort((a, b) => {
            let aVal: string | number | null = null;
            let bVal: string | number | null = null;

            switch (sortField) {
                case "pickupAt": aVal = new Date(a.pickupAt).getTime(); bVal = new Date(b.pickupAt).getTime(); break;
                case "dueAt": aVal = new Date(a.dueAt).getTime(); bVal = new Date(b.dueAt).getTime(); break;
                case "createdAt": aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
                case "completedAt": aVal = a.completedAt ? new Date(a.completedAt).getTime() : 0; bVal = b.completedAt ? new Date(b.completedAt).getTime() : 0; break;
                case "tripNumber": aVal = parseInt(a.tripNumber) || 0; bVal = parseInt(b.tripNumber) || 0; break;
                case "status": aVal = a.status; bVal = b.status; break;
            }

            if (aVal === null || bVal === null) return 0;
            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [confirmations, searchQuery, statusFilter, dispatcherFilter, sortField, sortDirection]);

    const upcomingCount = useMemo(() => {
        const currentTime = Date.now();
        return filteredAndSortedConfirmations.filter((c) => new Date(c.pickupAt).getTime() >= currentTime).length;
    }, [filteredAndSortedConfirmations]);

    const pastCount = filteredAndSortedConfirmations.length - upcomingCount;

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
                limit: 100,
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
            await fetchConfirmations();
        } catch (err) {
            console.error("Failed to update confirmation:", err);
            throw err;
        } finally {
            setCompleting(null);
        }
    };

    return (
        <div className={styles.confirmationsPage}>
            {/* Header */}
            <header className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.headerTitle}>
                        <div className={styles.titleIcon}>
                            <Phone size={20} />
                        </div>
                        <div>
                            <h1>Trip Confirmations</h1>
                            <p>Command Center • 2-Hour Confirmation System</p>
                        </div>
                    </div>
                    <div className={styles.headerStats}>
                        <div className={styles.headerStat}>
                            <span className={styles.statNumber}>{stats.total}</span>
                            <span className={styles.statLabel}>Total</span>
                        </div>
                        <div className={`${styles.headerStat} ${styles.headerStatSuccess}`}>
                            <span className={styles.statNumber}>{stats.onTimeRate}%</span>
                            <span className={styles.statLabel}>On-Time</span>
                        </div>
                        <div className={`${styles.headerStat} ${styles.headerStatWarning}`}>
                            <span className={styles.statNumber}>{pendingCount}</span>
                            <span className={styles.statLabel}>Pending</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${selectedTab === "trips" ? styles.tabBtnActive : ""}`}
                    onClick={() => handleTabSelect("trips")}
                >
                    <ListFilter size={16} />
                    All Trips
                    <span className={`${styles.tabCount} ${selectedTab !== "trips" ? styles.tabCountInactive : ""}`}>{totalCount}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${selectedTab === "overview" ? styles.tabBtnActive : ""}`}
                    onClick={() => handleTabSelect("overview")}
                    disabled={tabLoading === "overview"}
                >
                    <BarChart3 size={16} />
                    Analytics
                    {tabLoading === "overview" && <span className={styles.tabLoading}>...</span>}
                </button>
                <button
                    className={`${styles.tabBtn} ${selectedTab === "dispatchers" ? styles.tabBtnActive : ""}`}
                    onClick={() => handleTabSelect("dispatchers")}
                    disabled={tabLoading === "dispatchers"}
                >
                    <Users size={16} />
                    Dispatchers
                    {tabLoading === "dispatchers" && <span className={styles.tabLoading}>...</span>}
                </button>
                <button
                    className={`${styles.tabBtn} ${selectedTab === "accountability" ? styles.tabBtnActive : ""}`}
                    onClick={() => handleTabSelect("accountability")}
                    disabled={tabLoading === "accountability"}
                >
                    <ShieldAlert size={16} />
                    Accountability
                    {tabLoading === "accountability" && <span className={styles.tabLoading}>...</span>}
                    {totalMissed > 0 && !tabLoading && <span className={styles.missedBadge}>{totalMissed}</span>}
                </button>
            </nav>

            {/* ALL TRIPS TAB */}
            {selectedTab === "trips" && (
                <div className={styles.tripsContent}>
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
                <AnalyticsTabClient
                    stats={stats}
                    todayConfirmations={activeTodayConfirmations}
                    pendingCount={pendingCount}
                    completedToday={completedToday}
                    tabLoading={tabLoading}
                />
            )}

            {/* DISPATCHERS TAB */}
            {selectedTab === "dispatchers" && (
                <DispatchersTabClient
                    metrics={activeDispatcherMetrics}
                    tabLoading={tabLoading}
                />
            )}

            {/* ACCOUNTABILITY TAB */}
            {selectedTab === "accountability" && (
                <AccountabilityTabClient
                    accountabilityMetrics={activeAccountabilityMetrics}
                    missedConfirmations={activeMissedConfirmations}
                    tabLoading={tabLoading}
                    expandedMissed={expandedMissed}
                    onToggleMissed={toggleMissedExpand}
                />
            )}
        </div>
    );
}

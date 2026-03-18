"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Phone, BarChart3, Users, ShieldAlert, ListFilter, X } from "lucide-react";
import TabBar from "@/components/ui/TabBar";
import { getAllConfirmations, completeConfirmation, getConfirmationTabData, getNewConfirmationsSince } from "@/lib/tripConfirmationActions";
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
import type { CurrentUser } from "./types";
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
    currentUser: CurrentUser;
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
    currentUser,
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
    const [sortField, setSortField] = useState<SortField>("dueAt");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [selectedTrip, setSelectedTrip] = useState<TripConfirmation | null>(null);
    const [completing, setCompleting] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const router = useRouter();

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Auto-dismiss toast after 5 seconds
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast]);

    // Auto-refresh: poll for new confirmations every 30 seconds
    const lastRefreshRef = useRef(new Date());
    const selectedTabRef = useRef(selectedTab);
    selectedTabRef.current = selectedTab;

    useEffect(() => {
        const poll = async () => {
            if (document.visibilityState === "hidden") return;
            if (selectedTabRef.current !== "trips") return;

            try {
                const result = await getNewConfirmationsSince(lastRefreshRef.current);
                const pollData = result.data ?? { confirmations: [], timestamp: lastRefreshRef.current };
                if (pollData.confirmations.length > 0) {
                    setConfirmations(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const newTrips = pollData.confirmations.filter(c => !existingIds.has(c.id));

                        if (newTrips.length > 0) {
                            setTotalCount(prevCount => prevCount + newTrips.length);
                            setToast({ message: `${newTrips.length} new trip${newTrips.length > 1 ? "s" : ""} added`, type: "success" });
                            return [...(newTrips as TripConfirmation[]), ...prev];
                        }

                        return prev;
                    });
                    lastRefreshRef.current = pollData.timestamp;
                }
            } catch (err) {
                console.error("Auto-refresh failed:", err);
            }
        };

        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, []);

    // Lazy loading state for tabs
    const [lazyDispatcherMetrics, setLazyDispatcherMetrics] = useState<DispatcherMetric[] | null>(null);
    const [lazyTodayConfirmations, setLazyTodayConfirmations] = useState<TripConfirmation[] | null>(null);
    const [lazyAccountabilityMetrics, setLazyAccountabilityMetrics] = useState<AccountabilityMetric[] | null>(null);
    const [lazyMissedConfirmations, setLazyMissedConfirmations] = useState<MissedConfirmation[] | null>(null);
    const [tabLoading, setTabLoading] = useState<string | null>(null);
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(["trips"]));

    // Update time every minute for accurate time displays
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(interval);
    }, []);

    // Handle tab selection with lazy loading
    const handleTabSelect = useCallback(async (tab: "trips" | "overview" | "dispatchers" | "accountability") => {
        setSelectedTab(tab);
        if (loadedTabs.has(tab) || tab === "trips") return;

        setTabLoading(tab);
        try {
            const result = await getConfirmationTabData(tab === "overview" ? "overview" : tab === "dispatchers" ? "dispatchers" : "accountability", 30);
            const data = result.data ?? {};

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

        // Smart sort: dueAt asc groups PENDING first, then completed
        if (sortField === "dueAt" && sortDirection === "asc") {
            const pending = filtered.filter(c => c.status === "PENDING");
            const nonPending = filtered.filter(c => c.status !== "PENDING");

            pending.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

            nonPending.sort((a, b) => {
                const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return bTime - aTime;
            });

            return [...pending, ...nonPending];
        }

        // Legacy smart sort for pickupAt desc
        if (sortField === "pickupAt" && sortDirection === "desc") {
            const currentTime = Date.now();
            const upcoming = filtered.filter((c) => new Date(c.pickupAt).getTime() >= currentTime);
            const past = filtered.filter((c) => new Date(c.pickupAt).getTime() < currentTime);
            upcoming.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
            past.sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime());
            return [...upcoming, ...past];
        }

        // Generic sort
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

    const pendingDividerIndex = useMemo(() => {
        if (sortField !== "dueAt" || sortDirection !== "asc") return undefined;
        const paginated = filteredAndSortedConfirmations.slice(
            (currentPage - 1) * ITEMS_PER_PAGE,
            (currentPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE
        );
        for (let i = 0; i < paginated.length; i++) {
            if (paginated[i].status !== "PENDING" && (i === 0 || paginated[i - 1].status === "PENDING")) {
                return i;
            }
        }
        return undefined;
    }, [filteredAndSortedConfirmations, sortField, sortDirection, currentPage]);

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
            const resultData = result.data ?? { confirmations: [], total: 0 };
            setConfirmations(resultData.confirmations as TripConfirmation[]);
            setTotalCount(resultData.total);
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
            const result = await completeConfirmation(tripId, newStatus, notes || "");
            if (!result.success) throw new Error(result.error);
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

    const handleQuickAction = useCallback(async (
        tripId: string,
        newStatus: "CONFIRMED" | "NO_ANSWER"
    ) => {
        const prevConfirmations = [...confirmations];
        const prevTotalCount = totalCount;

        setConfirmations(prev => prev.map(c =>
            c.id === tripId ? {
                ...c,
                status: newStatus,
                completedAt: new Date().toISOString(),
                completedBy: { id: currentUser.id, name: currentUser.name },
                minutesBeforeDue: Math.round(
                    (new Date(c.dueAt).getTime() - Date.now()) / 60000
                ),
            } : c
        ));
        setCompleting(tripId);

        try {
            const result = await completeConfirmation(tripId, newStatus);
            if (!result.success) throw new Error(result.error);
        } catch {
            setConfirmations(prevConfirmations);
            setTotalCount(prevTotalCount);
            setToast({ message: "Failed to update - please try again", type: "error" });
        } finally {
            setCompleting(null);
        }
    }, [confirmations, totalCount, currentUser]);

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
            <TabBar
                tabs={[
                    { value: "trips", label: "All Trips", icon: <ListFilter size={16} />, count: totalCount },
                    { value: "overview", label: "Analytics", icon: <BarChart3 size={16} />, loading: tabLoading === "overview" },
                    { value: "dispatchers", label: "Dispatchers", icon: <Users size={16} />, loading: tabLoading === "dispatchers" },
                    { value: "accountability", label: "Accountability", icon: <ShieldAlert size={16} />, loading: tabLoading === "accountability", badge: totalMissed },
                ]}
                activeTab={selectedTab}
                onChange={(v) => handleTabSelect(v as "trips" | "overview" | "dispatchers" | "accountability")}
            />

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
                        onQuickAction={handleQuickAction}
                        pendingDividerIndex={pendingDividerIndex}
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

            {/* Toast Notification */}
            {toast && (
                <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
                    <span>{toast.message}</span>
                    <button className={styles.toastDismiss} onClick={() => setToast(null)}>
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

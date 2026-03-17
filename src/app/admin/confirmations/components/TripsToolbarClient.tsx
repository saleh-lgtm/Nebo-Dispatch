"use client";

import { Search, Filter, X, Clock, CheckCircle } from "lucide-react";
import { Dispatcher, StatusFilter } from "../types";
import styles from "./TripsToolbar.module.css";

interface TripsToolbarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    statusFilter: StatusFilter;
    onStatusFilterChange: (value: StatusFilter) => void;
    dispatcherFilter: string;
    onDispatcherFilterChange: (value: string) => void;
    dateFrom: string;
    onDateFromChange: (value: string) => void;
    dateTo: string;
    onDateToChange: (value: string) => void;
    showFilters: boolean;
    onToggleFilters: () => void;
    hasActiveFilters: boolean;
    dispatchers: Dispatcher[];
    isLoading: boolean;
    onApplyFilters: () => void;
    onClearFilters: () => void;
    showing: number;
    total: number;
    upcomingCount: number;
    pastCount: number;
    grandTotal: number;
}

export default function TripsToolbarClient({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    dispatcherFilter,
    onDispatcherFilterChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    showFilters,
    onToggleFilters,
    hasActiveFilters,
    dispatchers,
    isLoading,
    onApplyFilters,
    onClearFilters,
    showing,
    total,
    upcomingCount,
    pastCount,
    grandTotal,
}: TripsToolbarProps) {
    return (
        <>
            {/* Search and Filters Bar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search trip #, passenger, driver, account..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button className={styles.clearSearch} onClick={() => onSearchChange("")}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className={styles.toolbarActions}>
                    <button
                        className={`${styles.filterToggle} ${showFilters ? styles.active : ""} ${hasActiveFilters ? styles.hasFilters : ""}`}
                        onClick={onToggleFilters}
                    >
                        <Filter size={16} />
                        Filters
                        {hasActiveFilters && <span className={styles.filterDot} />}
                    </button>
                </div>
            </div>

            {/* Expanded Filters Panel */}
            {showFilters && (
                <div className={styles.filtersPanel}>
                    <div className={styles.filterGroup}>
                        <label>Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
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

                    <div className={styles.filterGroup}>
                        <label>Completed By</label>
                        <select
                            value={dispatcherFilter}
                            onChange={(e) => onDispatcherFilterChange(e.target.value)}
                        >
                            <option value="ALL">All Dispatchers</option>
                            {dispatchers.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} ({d.count})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Date From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => onDateFromChange(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Date To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => onDateToChange(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterActions}>
                        <button className={styles.applyBtn} onClick={onApplyFilters} disabled={isLoading}>
                            {isLoading ? "Loading..." : "Apply Filters"}
                        </button>
                        {hasActiveFilters && (
                            <button className={styles.clearBtn} onClick={onClearFilters}>
                                Clear All
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Results Summary */}
            <div className={styles.resultsSummary}>
                <span className={styles.resultsCount}>
                    Showing <strong>{showing}</strong> of{" "}
                    <strong>{total}</strong> trips
                </span>
                <div className={styles.sectionCounts}>
                    <span className={styles.upcomingCount}>
                        <Clock size={12} />
                        {upcomingCount} upcoming
                    </span>
                    <span className={styles.pastCount}>
                        <CheckCircle size={12} />
                        {pastCount} past
                    </span>
                </div>
                {hasActiveFilters && (
                    <span className={styles.filteredIndicator}>
                        (filtered from {grandTotal} total)
                    </span>
                )}
            </div>
        </>
    );
}

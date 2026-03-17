"use client";

import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Calendar,
    User,
    Car,
    Building2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { TripConfirmation, SortField, SortDirection, STATUS_CONFIG } from "../types";
import { formatDate, formatTime, formatDateTime, isOverdue, getTimeDiff } from "./utils";
import styles from "./TripsTable.module.css";

interface TripsTableProps {
    trips: TripConfirmation[];
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onSelectTrip: (trip: TripConfirmation) => void;
    completingId: string | null;
    now: number;
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
    if (sortField !== field) return <ArrowUpDown size={14} className={styles.sortIconInactive} />;
    return sortDirection === "asc" ? (
        <ArrowUp size={14} className={styles.sortIconActive} />
    ) : (
        <ArrowDown size={14} className={styles.sortIconActive} />
    );
}

export default function TripsTableClient({
    trips,
    sortField,
    sortDirection,
    onSort,
    currentPage,
    totalPages,
    onPageChange,
    onSelectTrip,
    completingId,
    now,
}: TripsTableProps) {
    return (
        <>
            {/* Data Table */}
            <div className={styles.tableContainer}>
                <table className={styles.tripsTable}>
                    <thead>
                        <tr>
                            <th className={styles.colStatus}>Status</th>
                            <th className={`${styles.colTrip} ${styles.sortable}`} onClick={() => onSort("tripNumber")}>
                                <span>Trip #</span>
                                <SortIcon field="tripNumber" sortField={sortField} sortDirection={sortDirection} />
                            </th>
                            <th className={styles.colPassenger}>Passenger</th>
                            <th className={styles.colDriver}>Driver</th>
                            <th className={styles.colAccount}>Account</th>
                            <th className={`${styles.colPickup} ${styles.sortable}`} onClick={() => onSort("pickupAt")}>
                                <span>Pickup</span>
                                <SortIcon field="pickupAt" sortField={sortField} sortDirection={sortDirection} />
                            </th>
                            <th className={`${styles.colDue} ${styles.sortable}`} onClick={() => onSort("dueAt")}>
                                <span>Due</span>
                                <SortIcon field="dueAt" sortField={sortField} sortDirection={sortDirection} />
                            </th>
                            <th className={`${styles.colCompleted} ${styles.sortable}`} onClick={() => onSort("completedAt")}>
                                <span>Completed</span>
                                <SortIcon field="completedAt" sortField={sortField} sortDirection={sortDirection} />
                            </th>
                            <th className={styles.colDispatcher}>By</th>
                            <th className={styles.colActions}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trips.length === 0 ? (
                            <tr className={styles.emptyRow}>
                                <td colSpan={10}>
                                    <div className={styles.emptyState}>
                                        <Calendar size={40} />
                                        <p>No trips found</p>
                                        <span>Try adjusting your filters</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            trips.map((trip) => {
                                const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.PENDING;
                                const Icon = config.icon;
                                const isPending = trip.status === "PENDING";
                                const overdue = isPending && isOverdue(trip.dueAt, now);

                                return (
                                    <tr key={trip.id} className={overdue ? styles.overdue : ""}>
                                        <td className={styles.colStatus}>
                                            <div
                                                className={styles.statusBadge}
                                                style={{
                                                    color: config.color,
                                                    background: config.bgColor,
                                                }}
                                            >
                                                <Icon size={12} />
                                                <span>{config.label}</span>
                                            </div>
                                        </td>
                                        <td className={styles.colTrip}>
                                            <div className={styles.tripInfo}>
                                                <span className={styles.tripNumber}>#{trip.tripNumber}</span>
                                                {trip.reservationNumber && (
                                                    <span className={styles.resNumber}>
                                                        Res: {trip.reservationNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={styles.colPassenger}>
                                            <div className={styles.personCell}>
                                                <User size={14} />
                                                <span>{trip.passengerName}</span>
                                            </div>
                                        </td>
                                        <td className={styles.colDriver}>
                                            <div className={styles.personCell}>
                                                <Car size={14} />
                                                <span>{trip.driverName}</span>
                                            </div>
                                        </td>
                                        <td className={styles.colAccount}>
                                            {trip.accountName ? (
                                                <div className={styles.accountCell}>
                                                    <Building2 size={14} />
                                                    <span>{trip.accountName}</span>
                                                </div>
                                            ) : (
                                                <span className={styles.emptyCell}>—</span>
                                            )}
                                        </td>
                                        <td className={styles.colPickup}>
                                            <div className={styles.datetimeCell}>
                                                <span className={styles.date}>{formatDate(trip.pickupAt)}</span>
                                                <span className={styles.time}>{formatTime(trip.pickupAt)}</span>
                                            </div>
                                        </td>
                                        <td className={styles.colDue}>
                                            <div className={`${styles.dueCell} ${overdue ? styles.overdue : ""}`}>
                                                <span className={styles.time}>{formatTime(trip.dueAt)}</span>
                                                {isPending && (
                                                    <span className={`${styles.timeDiff} ${overdue ? styles.timeDiffOverdue : ""}`}>
                                                        {overdue ? "+" : "-"}{getTimeDiff(trip.dueAt, now)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={styles.colCompleted}>
                                            {trip.completedAt ? (
                                                <div className={styles.completedCell}>
                                                    <span className={styles.datetime}>{formatDateTime(trip.completedAt)}</span>
                                                    {trip.minutesBeforeDue != null && (
                                                        <span className={`${styles.leadTime} ${trip.minutesBeforeDue > 0 ? styles.early : styles.late}`}>
                                                            {trip.minutesBeforeDue > 0 ? "+" : ""}{trip.minutesBeforeDue}m
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className={`${styles.emptyCell} ${styles.awaiting}`}>Awaiting</span>
                                            )}
                                        </td>
                                        <td className={styles.colDispatcher}>
                                            {trip.completedBy ? (
                                                <div className={styles.dispatcherCell}>
                                                    <div className={styles.avatar}>
                                                        {(trip.completedBy.name || "?").charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={styles.name}>{trip.completedBy.name}</span>
                                                </div>
                                            ) : (
                                                <span className={styles.emptyCell}>—</span>
                                            )}
                                        </td>
                                        <td className={styles.colActions}>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => onSelectTrip(trip)}
                                                disabled={completingId === trip.id}
                                            >
                                                {completingId === trip.id ? "..." : "Edit"}
                                            </button>
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
                <div className={styles.pagination}>
                    <button
                        className={styles.pageBtn}
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div className={styles.pageNumbers}>
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
                                    className={`${styles.pageNum} ${currentPage === pageNum ? styles.pageNumActive : ""}`}
                                    onClick={() => onPageChange(pageNum)}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        className={styles.pageBtn}
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </>
    );
}

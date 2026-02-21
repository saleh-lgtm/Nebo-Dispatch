"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    FileText,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Calendar,
    User,
    Activity,
    Database,
    Clock,
    RefreshCw,
} from "lucide-react";
import { getAuditLogs } from "@/lib/auditActions";
import { useToast } from "@/hooks/useToast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = string | number | boolean | null | { [key: string]: any } | any[];

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entity: string;
    entityId: string | null;
    details: JsonValue;
    ipAddress: string | null;
    createdAt: Date;
    user: {
        id: string;
        name: string | null;
        email: string | null;
    };
}

interface UserData {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
}

interface Stats {
    total: number;
    byAction: Record<string, number>;
    byEntity: Record<string, number>;
    byDay: Record<string, number>;
}

interface Props {
    initialLogs: AuditLog[];
    totalLogs: number;
    stats: Stats;
    users: UserData[];
}

const ACTIONS = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
    "APPROVE",
    "REJECT",
    "CLOCK_IN",
    "CLOCK_OUT",
    "PASSWORD_CHANGE",
    "ROLE_CHANGE",
];

const ENTITIES = [
    "User",
    "Schedule",
    "ShiftReport",
    "Affiliate",
    "GlobalNote",
    "SchedulingRequest",
    "Shift",
];

const ACTION_COLORS: Record<string, string> = {
    CREATE: "var(--success)",
    UPDATE: "var(--accent)",
    DELETE: "#ef4444",
    LOGIN: "#3b82f6",
    LOGOUT: "#6b7280",
    APPROVE: "var(--success)",
    REJECT: "#ef4444",
    CLOCK_IN: "var(--success)",
    CLOCK_OUT: "#f59e0b",
    PASSWORD_CHANGE: "#8b5cf6",
    ROLE_CHANGE: "#ec4899",
};

export default function AuditClient({ initialLogs, totalLogs, stats, users }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [logs, setLogs] = useState(initialLogs);
    const [total, setTotal] = useState(totalLogs);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const [filters, setFilters] = useState({
        userId: "",
        action: "",
        entity: "",
        startDate: "",
        endDate: "",
    });

    const LIMIT = 50;
    const totalPages = Math.ceil(total / LIMIT);

    const fetchLogs = async (newPage: number = 1) => {
        setLoading(true);
        try {
            const result = await getAuditLogs({
                userId: filters.userId || undefined,
                action: filters.action || undefined,
                entity: filters.entity || undefined,
                startDate: filters.startDate ? new Date(filters.startDate) : undefined,
                endDate: filters.endDate ? new Date(filters.endDate + "T23:59:59") : undefined,
                limit: LIMIT,
                offset: (newPage - 1) * LIMIT,
            });
            setLogs(result.logs);
            setTotal(result.total);
            setPage(newPage);
        } catch {
            addToast("Failed to fetch audit logs", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = () => {
        fetchLogs(1);
    };

    const clearFilters = () => {
        setFilters({ userId: "", action: "", entity: "", startDate: "", endDate: "" });
        fetchLogs(1);
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getActionBadge = (action: string) => {
        const color = ACTION_COLORS[action] || "var(--text-secondary)";
        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    background: `${color}20`,
                    color: color,
                }}
            >
                {action.replace("_", " ")}
            </span>
        );
    };

    const getEntityBadge = (entity: string) => {
        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    background: "rgba(255,255,255,0.1)",
                    color: "var(--text-secondary)",
                }}
            >
                <Database size={12} />
                {entity}
            </span>
        );
    };

    // Calculate top stats for quick view
    const topActions = Object.entries(stats.byAction)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    const topEntities = Object.entries(stats.byEntity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    return (
        <div className="animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header style={{ marginBottom: "2rem" }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="font-display flex items-center gap-3" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                            <FileText size={32} className="text-accent" />
                            Audit Log
                        </h1>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Track all system activities and changes
                        </p>
                    </div>
                    <button
                        onClick={() => fetchLogs(page)}
                        disabled={loading}
                        className="btn btn-ghost flex items-center gap-2"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                    <div className="flex items-center gap-3" style={{ marginBottom: "0.75rem" }}>
                        <Activity size={20} className="text-accent" />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total Events (30d)</span>
                    </div>
                    <p style={{ fontSize: "2rem", fontWeight: 600 }}>{stats.total}</p>
                </div>

                <div className="glass-card" style={{ padding: "1.25rem" }}>
                    <div className="flex items-center gap-3" style={{ marginBottom: "0.75rem" }}>
                        <Activity size={20} className="text-accent" />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Top Actions</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {topActions.map(([action, count]) => (
                            <div key={action} className="flex items-center justify-between">
                                <span style={{ fontSize: "0.875rem" }}>{action.replace("_", " ")}</span>
                                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: "1.25rem" }}>
                    <div className="flex items-center gap-3" style={{ marginBottom: "0.75rem" }}>
                        <Database size={20} className="text-accent" />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Top Entities</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {topEntities.map(([entity, count]) => (
                            <div key={entity} className="flex items-center justify-between">
                                <span style={{ fontSize: "0.875rem" }}>{entity}</span>
                                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 w-full"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
                >
                    <Filter size={18} />
                    <span style={{ fontWeight: 500 }}>Filters</span>
                    <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
                        {showFilters ? "Hide" : "Show"}
                    </span>
                </button>

                {showFilters && (
                    <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                User
                            </label>
                            <select
                                value={filters.userId}
                                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                                className="input"
                                style={{ width: "100%" }}
                            >
                                <option value="">All Users</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name || user.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                Action
                            </label>
                            <select
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                                className="input"
                                style={{ width: "100%" }}
                            >
                                <option value="">All Actions</option>
                                {ACTIONS.map((action) => (
                                    <option key={action} value={action}>
                                        {action.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                Entity
                            </label>
                            <select
                                value={filters.entity}
                                onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
                                className="input"
                                style={{ width: "100%" }}
                            >
                                <option value="">All Entities</option>
                                {ENTITIES.map((entity) => (
                                    <option key={entity} value={entity}>
                                        {entity}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="input"
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                End Date
                            </label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="input"
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                onClick={handleFilter}
                                disabled={loading}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                <Search size={16} />
                                Search
                            </button>
                            <button
                                onClick={clearFilters}
                                className="btn btn-ghost"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Results info */}
            <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Showing {logs.length} of {total} entries
                </p>
            </div>

            {/* Logs Table */}
            <div className="glass-card" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>
                                    <Clock size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                                    Time
                                </th>
                                <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>
                                    <User size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                                    User
                                </th>
                                <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>Action</th>
                                <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>Entity</th>
                                <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500 }}>Entity ID</th>
                                <th style={{ padding: "1rem", textAlign: "center", fontWeight: 500 }}>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "1rem", whiteSpace: "nowrap", fontSize: "0.875rem" }}>
                                        {formatDate(log.createdAt)}
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                        <div>
                                            <p style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                                                {log.user.name || "Unknown"}
                                            </p>
                                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                {log.user.email}
                                            </p>
                                        </div>
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                        {getActionBadge(log.action)}
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                        {getEntityBadge(log.entity)}
                                    </td>
                                    <td style={{ padding: "1rem", fontSize: "0.875rem", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                                        {log.entityId ? log.entityId.slice(0, 8) + "..." : "-"}
                                    </td>
                                    <td style={{ padding: "1rem", textAlign: "center" }}>
                                        {log.details !== null ? (
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="btn btn-ghost"
                                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                            >
                                                View
                                            </button>
                                        ) : (
                                            <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                                        No audit logs found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2" style={{ marginTop: "1.5rem" }}>
                    <button
                        onClick={() => fetchLogs(page - 1)}
                        disabled={page === 1 || loading}
                        className="btn btn-ghost"
                        style={{ padding: "0.5rem" }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span style={{ padding: "0 1rem", fontSize: "0.875rem" }}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => fetchLogs(page + 1)}
                        disabled={page === totalPages || loading}
                        className="btn btn-ghost"
                        style={{ padding: "0.5rem" }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* Details Modal */}
            {selectedLog && (
                <div
                    className="modal-overlay"
                    onClick={() => setSelectedLog(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        padding: "1rem",
                    }}
                >
                    <div
                        className="glass-card"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "500px", width: "90%", padding: "1.5rem", maxHeight: "80vh", overflow: "auto" }}
                    >
                        <h2 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                            Audit Log Details
                        </h2>

                        <div className="flex flex-col gap-3">
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                    Action
                                </label>
                                <p>{getActionBadge(selectedLog.action)}</p>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                    Entity
                                </label>
                                <p>{getEntityBadge(selectedLog.entity)}</p>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                    Entity ID
                                </label>
                                <p style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                                    {selectedLog.entityId || "-"}
                                </p>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                    User
                                </label>
                                <p>{selectedLog.user.name} ({selectedLog.user.email})</p>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                    Timestamp
                                </label>
                                <p>{new Date(selectedLog.createdAt).toLocaleString()}</p>
                            </div>

                            {selectedLog.ipAddress && (
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                        IP Address
                                    </label>
                                    <p style={{ fontFamily: "monospace" }}>{selectedLog.ipAddress}</p>
                                </div>
                            )}

                            {selectedLog.details !== null && (
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                        Details
                                    </label>
                                    <pre
                                        style={{
                                            background: "rgba(0,0,0,0.3)",
                                            padding: "1rem",
                                            borderRadius: "0.5rem",
                                            fontSize: "0.75rem",
                                            overflow: "auto",
                                            maxHeight: "200px",
                                        }}
                                    >
                                        {typeof selectedLog.details === "object"
                                            ? JSON.stringify(selectedLog.details, null, 2)
                                            : String(selectedLog.details)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setSelectedLog(null)}
                            className="btn btn-primary"
                            style={{ width: "100%", marginTop: "1.5rem" }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

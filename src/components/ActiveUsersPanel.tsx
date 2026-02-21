"use client";

import { useEffect, useState } from "react";
import { Users, Circle, Clock, MapPin, RefreshCw } from "lucide-react";
import { getOnlineUsers, getActiveShiftUsers, updatePresence } from "@/lib/presenceActions";

interface OnlineUser {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    currentPage?: string | null;
    lastSeenAt?: Date;
    clockIn?: Date;
    shiftId?: string;
}

interface Props {
    initialOnlineUsers: OnlineUser[];
    initialActiveShiftUsers: OnlineUser[];
    currentUserId: string;
}

export default function ActiveUsersPanel({
    initialOnlineUsers,
    initialActiveShiftUsers,
    currentUserId,
}: Props) {
    const [onlineUsers, setOnlineUsers] = useState(initialOnlineUsers);
    const [activeShiftUsers, setActiveShiftUsers] = useState(initialActiveShiftUsers);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // Update presence on mount and periodically
    useEffect(() => {
        const pathname = typeof window !== "undefined" ? window.location.pathname : undefined;
        updatePresence(pathname);

        // Update presence every 2 minutes
        const presenceInterval = setInterval(() => {
            updatePresence(pathname);
        }, 2 * 60 * 1000);

        // Refresh user list every 30 seconds
        const refreshInterval = setInterval(async () => {
            try {
                const [online, active] = await Promise.all([
                    getOnlineUsers(),
                    getActiveShiftUsers(),
                ]);
                setOnlineUsers(online);
                setActiveShiftUsers(active);
                setLastRefresh(new Date());
            } catch (e) {
                console.error("Failed to refresh users:", e);
            }
        }, 30 * 1000);

        // Set offline on window close
        const handleBeforeUnload = () => {
            navigator.sendBeacon("/api/presence/offline", "");
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            clearInterval(presenceInterval);
            clearInterval(refreshInterval);
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    const handleRefresh = async () => {
        try {
            const [online, active] = await Promise.all([
                getOnlineUsers(),
                getActiveShiftUsers(),
            ]);
            setOnlineUsers(online);
            setActiveShiftUsers(active);
            setLastRefresh(new Date());
        } catch (e) {
            console.error("Failed to refresh users:", e);
        }
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const roleColors: Record<string, string> = {
        SUPER_ADMIN: "var(--danger)",
        ADMIN: "var(--warning)",
        DISPATCHER: "var(--success)",
    };

    return (
        <section className="glass-card">
            <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                <div className="flex items-center gap-2">
                    <Users size={20} className="text-accent" />
                    <h2 className="font-display" style={{ fontSize: "1.25rem" }}>Active Users</h2>
                </div>
                <button
                    onClick={handleRefresh}
                    className="icon-btn"
                    style={{ padding: "0.5rem" }}
                    aria-label="Refresh"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Online Now */}
            <div style={{ marginBottom: "1.5rem" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
                    <Circle size={8} fill="var(--success)" color="var(--success)" />
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                        Online Now ({onlineUsers.length})
                    </span>
                </div>

                {onlineUsers.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", paddingLeft: "1rem" }}>
                        No users currently online
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {onlineUsers.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center gap-3"
                                style={{
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    background: user.id === currentUserId ? "rgba(56, 189, 248, 0.1)" : "var(--bg-secondary)",
                                }}
                            >
                                <div
                                    style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        background: `linear-gradient(135deg, ${roleColors[user.role] || "var(--accent)"}, transparent)`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                    }}
                                >
                                    {user.name?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                                        {user.name || "Unknown"}
                                        {user.id === currentUserId && (
                                            <span style={{ fontSize: "0.7rem", color: "var(--accent)", marginLeft: "0.5rem" }}>
                                                (You)
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex items-center gap-2" style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                        <span style={{ color: roleColors[user.role] }}>{user.role}</span>
                                        {user.currentPage && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={10} />
                                                    {user.currentPage}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <Circle size={8} fill="var(--success)" color="var(--success)" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* On Shift */}
            <div>
                <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
                    <Clock size={14} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                        On Shift ({activeShiftUsers.length})
                    </span>
                </div>

                {activeShiftUsers.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", paddingLeft: "1rem" }}>
                        No active shifts
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {activeShiftUsers.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between"
                                style={{
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "var(--bg-secondary)",
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: "0.875rem" }}>{user.name || "Unknown"}</span>
                                    <span style={{ fontSize: "0.7rem", color: roleColors[user.role] }}>
                                        {user.role}
                                    </span>
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                    Since {user.clockIn ? formatTime(user.clockIn) : "—"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "1rem", textAlign: "right" }}>
                Last updated: {formatTime(lastRefresh)}
            </p>
        </section>
    );
}

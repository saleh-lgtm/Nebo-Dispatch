"use client";

import { useState, useTransition } from "react";
import {
    getFrontTeammateMappings,
    createFrontMapping,
    deleteFrontMapping,
} from "@/lib/frontActions";
import type { FrontTeammate } from "@/lib/frontApiClient";
import styles from "./settings.module.css";

interface Mapping {
    id: string;
    userId: string;
    userName: string;
    userEmail: string | null;
    frontTeammateId: string;
    frontName: string;
    frontEmail: string;
}

interface SettingsClientProps {
    initialMappings: Mapping[];
    apiStatus: { connected: boolean; teammateCount: number };
    frontTeammates: FrontTeammate[];
    neboUsers: Array<{ id: string; name: string; email: string; role: string }>;
}

export default function SettingsClient({
    initialMappings,
    apiStatus,
    frontTeammates,
    neboUsers,
}: SettingsClientProps) {
    const [isPending, startTransition] = useTransition();
    const [mappings, setMappings] = useState<Mapping[]>(initialMappings);
    const [error, setError] = useState<string | null>(null);

    // Add form state
    const [selectedNeboUser, setSelectedNeboUser] = useState("");
    const [selectedFrontTeammate, setSelectedFrontTeammate] = useState("");

    // Filter out already-mapped users and teammates
    const mappedUserIds = new Set(mappings.map((m) => m.userId));
    const mappedFrontIds = new Set(mappings.map((m) => m.frontTeammateId));
    const availableNeboUsers = neboUsers.filter((u) => !mappedUserIds.has(u.id));
    const availableFrontTeammates = frontTeammates.filter(
        (t) => !mappedFrontIds.has(t.id)
    );

    async function handleAdd() {
        if (!selectedNeboUser || !selectedFrontTeammate) return;

        const frontTm = frontTeammates.find((t) => t.id === selectedFrontTeammate);
        if (!frontTm) return;

        setError(null);
        startTransition(async () => {
            const result = await createFrontMapping(
                selectedNeboUser,
                selectedFrontTeammate,
                `${frontTm.first_name} ${frontTm.last_name}`,
                frontTm.email
            );

            if (result.success) {
                const refreshed = await getFrontTeammateMappings();
                if (refreshed.success && refreshed.data) {
                    setMappings(refreshed.data);
                }
                setSelectedNeboUser("");
                setSelectedFrontTeammate("");
            } else {
                setError(result.error ?? "Failed to create mapping");
            }
        });
    }

    async function handleRemove(mappingId: string) {
        setError(null);
        startTransition(async () => {
            const result = await deleteFrontMapping(mappingId);
            if (result.success) {
                setMappings((prev) => prev.filter((m) => m.id !== mappingId));
            } else {
                setError(result.error ?? "Failed to remove mapping");
            }
        });
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
                <p className={styles.subtitle}>
                    Front email integration and teammate mappings
                </p>
            </div>

            {/* API Status */}
            <div className={styles.statusCard}>
                <div
                    className={`${styles.statusDot} ${
                        apiStatus.connected ? styles.connected : styles.disconnected
                    }`}
                />
                <span className={styles.statusText}>
                    Front API: {apiStatus.connected ? "Connected" : "Disconnected"}
                </span>
                {apiStatus.connected && (
                    <span className={styles.statusDetail}>
                        {apiStatus.teammateCount} teammate{apiStatus.teammateCount !== 1 ? "s" : ""} found
                    </span>
                )}
            </div>

            {/* Teammate Mappings */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        Front Teammate Mappings ({mappings.length})
                    </h2>
                </div>

                {mappings.length > 0 ? (
                    <table className={styles.mappingTable}>
                        <thead>
                            <tr>
                                <th>NeboOps User</th>
                                <th />
                                <th>Front Teammate</th>
                                <th>Front Email</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {mappings.map((m) => (
                                <tr key={m.id}>
                                    <td>
                                        {m.userName}
                                        {m.userEmail && (
                                            <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                                                {m.userEmail}
                                            </span>
                                        )}
                                    </td>
                                    <td className={styles.mappingArrow}>&rarr;</td>
                                    <td>{m.frontName} ({m.frontTeammateId})</td>
                                    <td style={{ color: "var(--text-secondary)" }}>{m.frontEmail}</td>
                                    <td>
                                        <button
                                            className={styles.removeBtn}
                                            onClick={() => handleRemove(m.id)}
                                            disabled={isPending}
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.emptyState}>
                        No teammate mappings configured. Add one below.
                    </div>
                )}

                {/* Add Form */}
                {apiStatus.connected && availableNeboUsers.length > 0 && availableFrontTeammates.length > 0 && (
                    <div className={styles.addForm}>
                        <select
                            className={styles.select}
                            value={selectedNeboUser}
                            onChange={(e) => setSelectedNeboUser(e.target.value)}
                        >
                            <option value="">Select NeboOps user...</option>
                            {availableNeboUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.email})
                                </option>
                            ))}
                        </select>
                        <select
                            className={styles.select}
                            value={selectedFrontTeammate}
                            onChange={(e) => setSelectedFrontTeammate(e.target.value)}
                        >
                            <option value="">Select Front teammate...</option>
                            {availableFrontTeammates.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.first_name} {t.last_name} ({t.email})
                                </option>
                            ))}
                        </select>
                        <button
                            className={styles.addBtn}
                            onClick={handleAdd}
                            disabled={isPending || !selectedNeboUser || !selectedFrontTeammate}
                        >
                            Add Mapping
                        </button>
                    </div>
                )}

                {error && <div className={styles.error}>{error}</div>}
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    startAccountingReview,
    resolveAccountingFlag,
    getFlaggedReservations,
} from "@/lib/accountingActions";
import TabBar from "@/components/ui/TabBar";
import styles from "../../Accounting.module.css";
import FlagsStats from "./FlagsStats";
import FlagsList from "./FlagsList";
import FlagDetailModal from "./FlagDetailModal";
import ResolveModal from "./ResolveModal";
import type { AccountingFlag, Stats } from "./types";

interface FlagsSectionProps {
    initialStats: Stats;
    initialFlags: AccountingFlag[];
    totalFlags: number;
}

export default function FlagsSection({
    initialStats,
    initialFlags,
    totalFlags,
}: FlagsSectionProps) {
    const router = useRouter();
    const [stats, setStats] = useState(initialStats);
    const [flags, setFlags] = useState(initialFlags);
    const [, setTotal] = useState(totalFlags);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"PENDING" | "IN_REVIEW" | "RESOLVED" | "ALL">("PENDING");
    const [selectedFlag, setSelectedFlag] = useState<AccountingFlag | null>(null);
    const [resolveModal, setResolveModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredFlags = flags.filter((flag) => {
        if (activeTab !== "ALL" && flag.status !== activeTab) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                flag.reservationId.toLowerCase().includes(query) ||
                flag.shiftReport.user.name?.toLowerCase().includes(query) ||
                flag.flagReason?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const handleTabChange = async (tab: typeof activeTab) => {
        setActiveTab(tab);
        setLoading(true);
        try {
            const status = tab === "ALL" ? undefined : tab;
            const result = await getFlaggedReservations({ status, limit: 50 });
            if (result.success && result.data) {
                setFlags(result.data.flags as unknown as AccountingFlag[]);
                setTotal(result.data.total);
            }
        } catch (error) {
            console.error("Failed to fetch flags:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartReview = async (flagId: string) => {
        try {
            await startAccountingReview(flagId);
            setFlags(
                flags.map((f) =>
                    f.id === flagId ? { ...f, status: "IN_REVIEW" as const } : f
                )
            );
            setStats({ ...stats, pending: stats.pending - 1, inReview: stats.inReview + 1 });
            router.refresh();
        } catch (error) {
            console.error("Failed to start review:", error);
        }
    };

    const handleResolve = async (resolution: string, accountingNotes: string) => {
        if (!selectedFlag) return;
        await resolveAccountingFlag(selectedFlag.id, resolution, accountingNotes);
        setFlags(
            flags.map((f) =>
                f.id === selectedFlag.id
                    ? { ...f, status: "RESOLVED" as const, resolution, accountingNotes }
                    : f
            )
        );
        setStats({
            ...stats,
            inReview: stats.inReview - 1,
            resolved: stats.resolved + 1,
        });
        setResolveModal(false);
        setSelectedFlag(null);
        router.refresh();
    };

    return (
        <>
            <FlagsStats stats={stats} />

            {/* Filters */}
            <div className={styles.filtersSection}>
                <TabBar
                    tabs={[
                        { value: "PENDING", label: "Pending", badge: stats.pending > 0 ? stats.pending : undefined },
                        { value: "IN_REVIEW", label: "In Review" },
                        { value: "RESOLVED", label: "Resolved" },
                        { value: "ALL", label: "All" },
                    ]}
                    activeTab={activeTab}
                    onChange={(v) => handleTabChange(v as typeof activeTab)}
                />
                <div className={styles.searchBox}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search by reservation ID, dispatcher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <FlagsList
                flags={filteredFlags}
                loading={loading}
                activeTab={activeTab}
                onSelectFlag={setSelectedFlag}
                onStartReview={handleStartReview}
                onOpenResolve={(flag) => {
                    setSelectedFlag(flag);
                    setResolveModal(true);
                }}
            />

            {/* Detail Modal */}
            {selectedFlag && !resolveModal && (
                <FlagDetailModal
                    flag={selectedFlag}
                    onClose={() => setSelectedFlag(null)}
                    onStartReview={handleStartReview}
                    onOpenResolve={() => setResolveModal(true)}
                />
            )}

            {/* Resolve Modal */}
            {resolveModal && selectedFlag && (
                <ResolveModal
                    flag={selectedFlag}
                    onClose={() => {
                        setResolveModal(false);
                        setSelectedFlag(null);
                    }}
                    onResolve={handleResolve}
                />
            )}
        </>
    );
}

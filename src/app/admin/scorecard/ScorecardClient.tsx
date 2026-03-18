"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ToggleGroup from "@/components/ui/ToggleGroup";
import TabBar from "@/components/ui/TabBar";
import type { DispatcherScorecard } from "@/lib/scorecardActions";
import { getTeamScorecard } from "@/lib/scorecardActions";
import TrendsTabClient from "@/components/scorecard/TrendsTabClient";
import HoursTabClient from "@/components/scorecard/HoursTabClient";
import styles from "./scorecard.module.css";

type TabValue = "scorecard" | "trends" | "hours";

interface ScorecardClientProps {
    initialTab: TabValue;
    initialScorecardData: DispatcherScorecard[];
    initialFrom: string;
    initialTo: string;
}

const TABS = [
    { value: "scorecard", label: "Scorecard" },
    { value: "trends", label: "Trends & Volume" },
    { value: "hours", label: "Hours" },
];

const DATE_PRESETS = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom" },
];

function getDateRange(preset: string): { from: Date; to: Date } {
    const now = new Date();
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    switch (preset) {
        case "today": {
            const from = new Date(now);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
        case "week": {
            const from = new Date(now);
            const day = from.getDay();
            const diff = day === 0 ? 6 : day - 1; // Monday start
            from.setDate(from.getDate() - diff);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
        case "month":
        default: {
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
    }
}

function scoreColor(score: number | null): string {
    if (score === null) return styles.scoreNA;
    if (score >= 90) return styles.scoreGreen;
    if (score >= 70) return styles.scoreAmber;
    return styles.scoreRed;
}

function gradeColor(grade: string): string {
    if (grade === "A") return styles.gradeA;
    if (grade === "B") return styles.gradeB;
    if (grade === "C") return styles.gradeC;
    return styles.gradeD;
}

export default function ScorecardClient({
    initialTab,
    initialScorecardData,
    initialFrom,
    initialTo,
}: ScorecardClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
    const [data, setData] = useState<DispatcherScorecard[]>(initialScorecardData);
    const [preset, setPreset] = useState("month");
    const [customFrom, setCustomFrom] = useState(initialFrom.split("T")[0]);
    const [customTo, setCustomTo] = useState(initialTo.split("T")[0]);

    function handleTabChange(newTab: string) {
        const tab = newTab as TabValue;
        setActiveTab(tab);
        // Update URL search param without full reload
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.push(`/admin/scorecard?${params.toString()}`, { scroll: false });
    }

    async function handlePresetChange(newPreset: string) {
        setPreset(newPreset);
        if (newPreset === "custom") return;

        if (activeTab === "scorecard") {
            const range = getDateRange(newPreset);
            startTransition(async () => {
                const result = await getTeamScorecard(range);
                if (result.success && result.data) {
                    setData(result.data);
                }
            });
        }
    }

    async function handleCustomApply() {
        const from = new Date(customFrom);
        from.setHours(0, 0, 0, 0);
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);

        if (activeTab === "scorecard") {
            startTransition(async () => {
                const result = await getTeamScorecard({ from, to });
                if (result.success && result.data) {
                    setData(result.data);
                }
            });
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Performance Dashboard</h1>
                    <p className={styles.subtitle}>
                        Team performance, trends, and hours tracking
                    </p>
                </div>
            </div>

            <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onChange={handleTabChange}
                variant="underline"
            />

            <div className={styles.controls}>
                <ToggleGroup
                    options={DATE_PRESETS}
                    value={preset}
                    onChange={handlePresetChange}
                    size="sm"
                />
                {preset === "custom" && (
                    <div className={styles.customRange}>
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className={styles.dateInput}
                        />
                        <span className={styles.dateSeparator}>to</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className={styles.dateInput}
                        />
                        <button
                            onClick={handleCustomApply}
                            className={styles.applyBtn}
                            disabled={isPending}
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>

            {isPending && <div className={styles.loadingBar} />}

            {/* Tab 1: Scorecard Leaderboard */}
            {activeTab === "scorecard" && (
                <>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.thRank}>#</th>
                                    <th className={styles.thName}>Dispatcher</th>
                                    <th className={styles.thScore}>Overall</th>
                                    <th className={styles.thGrade}>Grade</th>
                                    <th className={styles.thMetric}>Confirmations</th>
                                    <th className={styles.thMetric}>Comms</th>
                                    <th className={styles.thMetric}>Email</th>
                                    <th className={styles.thMetric}>Punctuality</th>
                                    <th className={styles.thMetric}>Quotes</th>
                                    <th className={styles.thMetric}>Reports</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className={styles.emptyRow}>
                                            No dispatcher data for this period
                                        </td>
                                    </tr>
                                )}
                                {data.map((d, i) => (
                                    <tr
                                        key={d.userId}
                                        className={styles.row}
                                        onClick={() => router.push(`/admin/scorecard/${d.userId}`)}
                                    >
                                        <td className={styles.rank}>
                                            {i === 0 && data.length > 1 ? (
                                                <span className={styles.medal}>1</span>
                                            ) : (
                                                i + 1
                                            )}
                                        </td>
                                        <td className={styles.nameCell}>
                                            <span className={styles.dispatcherName}>{d.userName}</span>
                                            <span className={styles.roleBadge}>{d.role}</span>
                                        </td>
                                        <td className={`${styles.scoreCell} ${scoreColor(d.overallScore)}`}>
                                            {d.overallScore}
                                        </td>
                                        <td className={styles.gradeCell}>
                                            <span className={`${styles.grade} ${gradeColor(d.letterGrade)}`}>
                                                {d.letterGrade}
                                            </span>
                                        </td>
                                        <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.confirmations)}`}>
                                            {d.categoryScores.confirmations ?? "N/A"}
                                            <span className={styles.metricDetail}>
                                                {d.confirmationMetrics.totalHandled > 0 ? `${d.confirmationMetrics.totalHandled} handled` : "—"}
                                            </span>
                                        </td>
                                        <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.communications)}`}>
                                            {d.categoryScores.communications ?? "N/A"}
                                            <span className={styles.metricDetail}>
                                                {d.communicationMetrics.smsSent > 0 ? `${d.communicationMetrics.smsSent} sent` : "—"}
                                            </span>
                                        </td>
                                        <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.email)}`}>
                                            {d.categoryScores.email ?? "N/A"}
                                            <span className={styles.metricDetail}>
                                                {d.emailMetrics && d.emailMetrics.emailsSent > 0
                                                    ? `${d.emailMetrics.emailsSent} sent`
                                                    : "—"}
                                            </span>
                                        </td>
                                        <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.punctuality)}`}>
                                            {d.categoryScores.punctuality ?? "N/A"}
                                            <span className={styles.metricDetail}>
                                                {d.shiftMetrics.totalShifts > 0
                                                    ? d.shiftMetrics.avgPunctualityMinutes > 0
                                                        ? `${d.shiftMetrics.avgPunctualityMinutes}m early`
                                                        : d.shiftMetrics.avgPunctualityMinutes < 0
                                                          ? `${Math.abs(d.shiftMetrics.avgPunctualityMinutes)}m late`
                                                          : "on time"
                                                    : "—"}
                                            </span>
                                        </td>
                                        <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.quotes)}`}>
                                            {d.categoryScores.quotes ?? "N/A"}
                                            <span className={styles.metricDetail}>
                                                {d.quoteMetrics.totalCreated > 0 ? `${d.quoteMetrics.won}/${d.quoteMetrics.totalCreated} won` : "—"}
                                            </span>
                                        </td>
                                        <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.reportCompliance)}`}>
                                            {d.categoryScores.reportCompliance ?? "N/A"}
                                            <span className={styles.metricDetail}>
                                                {d.shiftMetrics.totalShifts > 0 ? `${Math.round(d.shiftMetrics.reportSubmissionRate * 100)}%` : "—"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.legend}>
                        <div className={styles.legendItem}>
                            <span className={`${styles.legendDot} ${styles.scoreGreen}`} />
                            90+ Excellent
                        </div>
                        <div className={styles.legendItem}>
                            <span className={`${styles.legendDot} ${styles.scoreAmber}`} />
                            70-89 Good
                        </div>
                        <div className={styles.legendItem}>
                            <span className={`${styles.legendDot} ${styles.scoreRed}`} />
                            &lt;70 Needs Improvement
                        </div>
                        <div className={styles.weightInfo}>
                            Weights: Confirmations 25% | Comms 15% | Email 15% | Punctuality 20% | Quotes 15% | Reports 10%
                        </div>
                    </div>
                </>
            )}

            {/* Tab 2: Trends & Volume */}
            {activeTab === "trends" && (
                <TrendsTabClient
                    startDate={preset === "custom" ? customFrom : getDateRange(preset).from.toISOString().split("T")[0]}
                    endDate={preset === "custom" ? customTo : getDateRange(preset).to.toISOString().split("T")[0]}
                />
            )}

            {/* Tab 3: Hours */}
            {activeTab === "hours" && (
                <HoursTabClient
                    startDate={preset === "custom" ? customFrom : getDateRange(preset).from.toISOString().split("T")[0]}
                    endDate={preset === "custom" ? customTo : getDateRange(preset).to.toISOString().split("T")[0]}
                />
            )}
        </div>
    );
}

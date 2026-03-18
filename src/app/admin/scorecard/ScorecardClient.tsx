"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ToggleGroup from "@/components/ui/ToggleGroup";
import type { DispatcherScorecard } from "@/lib/scorecardActions";
import { getTeamScorecard } from "@/lib/scorecardActions";
import styles from "./scorecard.module.css";

interface ScorecardClientProps {
    initialData: DispatcherScorecard[];
    initialFrom: string;
    initialTo: string;
}

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

function scoreColor(score: number): string {
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
    initialData,
    initialFrom,
    initialTo,
}: ScorecardClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<DispatcherScorecard[]>(initialData);
    const [preset, setPreset] = useState("month");
    const [customFrom, setCustomFrom] = useState(initialFrom.split("T")[0]);
    const [customTo, setCustomTo] = useState(initialTo.split("T")[0]);

    async function handlePresetChange(newPreset: string) {
        setPreset(newPreset);
        if (newPreset === "custom") return;

        const range = getDateRange(newPreset);
        startTransition(async () => {
            const result = await getTeamScorecard(range);
            if (result.success && result.data) {
                setData(result.data);
            }
        });
    }

    async function handleCustomApply() {
        const from = new Date(customFrom);
        from.setHours(0, 0, 0, 0);
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);

        startTransition(async () => {
            const result = await getTeamScorecard({ from, to });
            if (result.success && result.data) {
                setData(result.data);
            }
        });
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Dispatcher Scorecard</h1>
                    <p className={styles.subtitle}>
                        Team performance leaderboard — {data.length} dispatcher{data.length !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>

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
                                    {d.categoryScores.confirmations}
                                    <span className={styles.metricDetail}>
                                        {d.confirmationMetrics.totalHandled} handled
                                    </span>
                                </td>
                                <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.communications)}`}>
                                    {d.categoryScores.communications}
                                    <span className={styles.metricDetail}>
                                        {d.communicationMetrics.smsSent} sent
                                    </span>
                                </td>
                                <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.email)}`}>
                                    {d.categoryScores.email}
                                    <span className={styles.metricDetail}>
                                        {d.emailMetrics
                                            ? `${d.emailMetrics.emailsSent} sent`
                                            : "—"}
                                    </span>
                                </td>
                                <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.punctuality)}`}>
                                    {d.categoryScores.punctuality}
                                    <span className={styles.metricDetail}>
                                        {d.shiftMetrics.avgPunctualityMinutes > 0
                                            ? `${d.shiftMetrics.avgPunctualityMinutes}m early`
                                            : d.shiftMetrics.avgPunctualityMinutes < 0
                                              ? `${Math.abs(d.shiftMetrics.avgPunctualityMinutes)}m late`
                                              : "on time"}
                                    </span>
                                </td>
                                <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.quotes)}`}>
                                    {d.categoryScores.quotes}
                                    <span className={styles.metricDetail}>
                                        {d.quoteMetrics.won}/{d.quoteMetrics.totalCreated} won
                                    </span>
                                </td>
                                <td className={`${styles.metricCell} ${scoreColor(d.categoryScores.reportCompliance)}`}>
                                    {d.categoryScores.reportCompliance}
                                    <span className={styles.metricDetail}>
                                        {Math.round(d.shiftMetrics.reportSubmissionRate * 100)}%
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
        </div>
    );
}

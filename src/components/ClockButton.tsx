"use client";

import { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, AlertTriangle, CheckCircle, Timer } from "lucide-react";
import { getShiftStatus, clockIn, clockOut, ShiftStatus } from "@/lib/clockActions";
import { useRouter } from "next/navigation";

function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

function getTimeDiffLabel(minutes: number | null): { text: string; color: string } | null {
    if (minutes === null) return null;
    if (minutes > 5) {
        return { text: `${minutes}m early`, color: "#4ade80" };
    } else if (minutes < -5) {
        return { text: `${Math.abs(minutes)}m late`, color: "#f87171" };
    }
    return { text: "On time", color: "#fbbf24" };
}

export default function ClockButton() {
    const router = useRouter();
    const [status, setStatus] = useState<ShiftStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [elapsedTime, setElapsedTime] = useState<string>("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    useEffect(() => {
        if (!status?.isClocked || !status.shift) return;

        const updateElapsed = () => {
            const elapsed = Date.now() - new Date(status.shift!.clockIn).getTime();
            setElapsedTime(formatDuration(elapsed));
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [status]);

    async function loadStatus() {
        try {
            const s = await getShiftStatus();
            setStatus(s);
        } catch (e) {
            console.error("Failed to load shift status:", e);
        } finally {
            setLoading(false);
        }
    }

    async function handleClockIn() {
        setActionLoading(true);
        try {
            const result = await clockIn();
            if (result.success) {
                await loadStatus();
                setShowDropdown(false);
            } else {
                alert(result.error || "Failed to clock in");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to clock in");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleClockOut(force = false) {
        setActionLoading(true);
        try {
            const result = await clockOut(force);
            if (result.success) {
                await loadStatus();
                setShowDropdown(false);
                setShowConfirmModal(false);
            } else if (result.requiresReport) {
                // Show confirmation modal for clocking out without report
                setShowConfirmModal(true);
            } else {
                alert(result.error || "Failed to clock out");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to clock out");
        } finally {
            setActionLoading(false);
        }
    }

    function goToShiftReport() {
        router.push("/reports/shift");
        setShowDropdown(false);
    }

    if (loading) {
        return (
            <div className="clock-btn clock-loading">
                <Clock size={16} className="animate-pulse" />
            </div>
        );
    }

    const isClocked = status?.isClocked;
    const shift = status?.shift;
    const scheduled = status?.scheduledShift;
    const timeDiff = shift ? getTimeDiffLabel(shift.earlyClockIn) : null;

    return (
        <>
            <div className="clock-wrapper">
                <button
                    className={`clock-btn ${isClocked ? "clocked-in" : "clocked-out"}`}
                    onClick={() => setShowDropdown(!showDropdown)}
                    aria-expanded={showDropdown}
                >
                    {isClocked ? (
                        <>
                            <Timer size={16} />
                            <span className="clock-time">{elapsedTime}</span>
                        </>
                    ) : (
                        <>
                            <Clock size={16} />
                            <span>Clock In</span>
                        </>
                    )}
                </button>

                {showDropdown && (
                    <div className="clock-dropdown">
                        {isClocked && shift ? (
                            <>
                                <div className="clock-status">
                                    <div className="status-indicator active" />
                                    <span>On Shift</span>
                                </div>

                                <div className="clock-info">
                                    <div className="info-row">
                                        <span className="info-label">Clocked In</span>
                                        <span className="info-value">{formatTime(shift.clockIn)}</span>
                                    </div>
                                    {timeDiff && (
                                        <div className="info-row">
                                            <span className="info-label">Timing</span>
                                            <span className="info-badge" style={{ color: timeDiff.color }}>
                                                {timeDiff.text}
                                            </span>
                                        </div>
                                    )}
                                    <div className="info-row">
                                        <span className="info-label">Duration</span>
                                        <span className="info-value">{elapsedTime}</span>
                                    </div>
                                    {shift.scheduledEnd && (
                                        <div className="info-row">
                                            <span className="info-label">Scheduled End</span>
                                            <span className="info-value">{formatTime(shift.scheduledEnd)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="clock-divider" />

                                {!status.hasSubmittedReport && (
                                    <button className="clock-action report-btn" onClick={goToShiftReport}>
                                        <CheckCircle size={16} />
                                        <span>Complete Shift Report</span>
                                    </button>
                                )}

                                <button
                                    className="clock-action clockout-btn"
                                    onClick={() => handleClockOut(false)}
                                    disabled={actionLoading}
                                >
                                    <LogOut size={16} />
                                    <span>{actionLoading ? "..." : "Clock Out"}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="clock-status">
                                    <div className="status-indicator inactive" />
                                    <span>Not Clocked In</span>
                                </div>

                                {scheduled && (
                                    <div className="clock-info">
                                        <div className="info-row">
                                            <span className="info-label">Scheduled</span>
                                            <span className="info-value">
                                                {formatTime(scheduled.shiftStart)} - {formatTime(scheduled.shiftEnd)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="clock-divider" />

                                <button
                                    className="clock-action clockin-btn"
                                    onClick={handleClockIn}
                                    disabled={actionLoading}
                                >
                                    <LogIn size={16} />
                                    <span>{actionLoading ? "Clocking in..." : "Clock In Now"}</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Confirmation Modal for clocking out without report */}
            {showConfirmModal && (
                <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon">
                            <AlertTriangle size={32} />
                        </div>
                        <h3>Clock Out Without Report?</h3>
                        <p>
                            You haven&apos;t submitted a shift report yet. This will be flagged for admin review.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={goToShiftReport}>
                                Complete Report
                            </button>
                            <button
                                className="btn-danger"
                                onClick={() => handleClockOut(true)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? "..." : "Clock Out Anyway"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .clock-wrapper {
                    position: relative;
                }

                .clock-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-md);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: 1px solid transparent;
                    background: none;
                    font-family: inherit;
                }

                .clock-btn.clocked-out {
                    background: rgba(34, 197, 94, 0.15);
                    border-color: rgba(34, 197, 94, 0.3);
                    color: #4ade80;
                }

                .clock-btn.clocked-out:hover {
                    background: rgba(34, 197, 94, 0.25);
                }

                .clock-btn.clocked-in {
                    background: rgba(59, 130, 246, 0.15);
                    border-color: rgba(59, 130, 246, 0.3);
                    color: #60a5fa;
                }

                .clock-btn.clocked-in:hover {
                    background: rgba(59, 130, 246, 0.25);
                }

                .clock-btn.clock-loading {
                    background: var(--bg-hover);
                    color: var(--text-secondary);
                }

                .clock-time {
                    font-variant-numeric: tabular-nums;
                }

                .clock-dropdown {
                    position: absolute;
                    top: calc(100% + 0.5rem);
                    right: 0;
                    min-width: 220px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 0.75rem;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    z-index: 50;
                    animation: dropdownFade 0.15s ease;
                }

                @keyframes dropdownFade {
                    from {
                        opacity: 0;
                        transform: translateY(-4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .clock-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.75rem;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-indicator.active {
                    background: #4ade80;
                    box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
                }

                .status-indicator.inactive {
                    background: var(--text-muted);
                }

                .clock-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.75rem;
                }

                .info-label {
                    color: var(--text-secondary);
                }

                .info-value {
                    color: var(--text-primary);
                    font-weight: 500;
                }

                .info-badge {
                    font-weight: 600;
                    font-size: 0.6875rem;
                }

                .clock-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 0.75rem 0;
                }

                .clock-action {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.625rem 0.75rem;
                    border-radius: var(--radius-md);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                    background: none;
                    font-family: inherit;
                }

                .clock-action:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .clockin-btn {
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                }

                .clockin-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }

                .clockout-btn {
                    background: rgba(239, 68, 68, 0.15);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }

                .clockout-btn:hover:not(:disabled) {
                    background: rgba(239, 68, 68, 0.25);
                }

                .report-btn {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    margin-bottom: 0.5rem;
                }

                .report-btn:hover {
                    background: rgba(34, 197, 94, 0.25);
                }

                /* Confirmation Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 200;
                    padding: 1rem;
                }

                .confirm-modal {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 1.5rem;
                    max-width: 400px;
                    text-align: center;
                }

                .modal-icon {
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 1rem;
                    background: rgba(245, 158, 11, 0.15);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fbbf24;
                }

                .confirm-modal h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.5rem;
                }

                .confirm-modal p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 1.5rem;
                }

                .modal-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                .modal-actions button {
                    flex: 1;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    font-family: inherit;
                }

                .btn-secondary {
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                }

                .btn-secondary:hover {
                    background: var(--bg-primary);
                }

                .btn-danger {
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #f87171;
                }

                .btn-danger:hover:not(:disabled) {
                    background: rgba(239, 68, 68, 0.25);
                }

                .btn-danger:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </>
    );
}

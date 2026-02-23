"use client";

import { AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";

type ExpirationStatus = "valid" | "expiring" | "expired";

interface ExpirationBadgeProps {
    expirationDate: Date | string;
    showDate?: boolean;
    size?: "sm" | "md";
}

export function getExpirationStatus(expirationDate: Date | string): ExpirationStatus {
    const date = new Date(expirationDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (date < now) return "expired";
    if (date < thirtyDaysFromNow) return "expiring";
    return "valid";
}

export function getDaysUntilExpiration(expirationDate: Date | string): number {
    const date = new Date(expirationDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default function ExpirationBadge({
    expirationDate,
    showDate = false,
    size = "md",
}: ExpirationBadgeProps) {
    const status = getExpirationStatus(expirationDate);
    const daysUntil = getDaysUntilExpiration(expirationDate);
    const date = new Date(expirationDate);

    const formatDate = (d: Date) => {
        return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const getStatusConfig = () => {
        switch (status) {
            case "expired":
                return {
                    icon: <XCircle size={size === "sm" ? 12 : 14} />,
                    label: "Expired",
                    detail: `${Math.abs(daysUntil)} days ago`,
                    className: "badge-expired",
                };
            case "expiring":
                return {
                    icon: <AlertTriangle size={size === "sm" ? 12 : 14} />,
                    label: "Expiring Soon",
                    detail: daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`,
                    className: "badge-expiring",
                };
            default:
                return {
                    icon: <CheckCircle size={size === "sm" ? 12 : 14} />,
                    label: "Valid",
                    detail: `${daysUntil} days`,
                    className: "badge-valid",
                };
        }
    };

    const config = getStatusConfig();

    return (
        <>
            <span className={`expiration-badge ${config.className} ${size}`}>
                {config.icon}
                <span className="badge-text">
                    {showDate ? formatDate(date) : config.label}
                </span>
                {!showDate && status !== "valid" && (
                    <span className="badge-detail">{config.detail}</span>
                )}
            </span>
            <style jsx>{`
                .expiration-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.25rem 0.625rem;
                    border-radius: var(--radius-full);
                    font-weight: 500;
                    white-space: nowrap;
                }

                .expiration-badge.sm {
                    padding: 0.125rem 0.5rem;
                    font-size: 0.6875rem;
                }

                .expiration-badge.md {
                    font-size: 0.75rem;
                }

                .badge-valid {
                    background: var(--success-bg, rgba(34, 197, 94, 0.1));
                    color: var(--success);
                }

                .badge-expiring {
                    background: var(--warning-bg, rgba(245, 158, 11, 0.1));
                    color: var(--warning);
                }

                .badge-expired {
                    background: var(--danger-bg, rgba(239, 68, 68, 0.1));
                    color: var(--danger);
                }

                .badge-text {
                    line-height: 1;
                }

                .badge-detail {
                    opacity: 0.8;
                    font-size: 0.625rem;
                }
            `}</style>
        </>
    );
}

// Compact version for table cells
export function ExpirationIndicator({ expirationDate }: { expirationDate: Date | string }) {
    const status = getExpirationStatus(expirationDate);
    const daysUntil = getDaysUntilExpiration(expirationDate);

    const getColor = () => {
        switch (status) {
            case "expired": return "var(--danger)";
            case "expiring": return "var(--warning)";
            default: return "var(--success)";
        }
    };

    const getTooltip = () => {
        const date = new Date(expirationDate).toLocaleDateString();
        switch (status) {
            case "expired": return `Expired ${Math.abs(daysUntil)} days ago (${date})`;
            case "expiring": return `Expires in ${daysUntil} days (${date})`;
            default: return `Valid until ${date}`;
        }
    };

    return (
        <>
            <span className="expiration-indicator" title={getTooltip()}>
                <Clock size={14} />
            </span>
            <style jsx>{`
                .expiration-indicator {
                    display: inline-flex;
                    align-items: center;
                    color: ${getColor()};
                }
            `}</style>
        </>
    );
}

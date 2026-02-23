export interface QuoteAction {
    id: string;
    actionType: string;
    notes: string | null;
    createdAt: Date;
    user: { id: string; name: string | null };
}

export interface Quote {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceType: string;
    source: string | null;
    dateOfService: Date | null;
    pickupDate: Date | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    estimatedAmount: number | null;
    notes: string | null;
    status: "PENDING" | "FOLLOWING_UP" | "CONVERTED" | "LOST" | "EXPIRED";
    outcome: "WON" | "LOST" | null;
    outcomeReason: string | null;
    outcomeAt?: Date;
    followUpCount: number;
    lastFollowUp: Date | null;
    nextFollowUp: Date | null;
    lastActionAt: Date | null;
    actionCount: number;
    isFlagged: boolean;
    expiresAt: Date;
    followUpNotes: string | null;
    createdBy: { id: string; name: string | null };
    assignedTo: { id: string; name: string | null } | null;
    createdAt: Date;
    actions?: QuoteAction[];
}

export const statusColors = {
    PENDING: { bg: "var(--warning-bg)", color: "var(--warning)", label: "Needs Follow-up" },
    FOLLOWING_UP: { bg: "var(--info-bg)", color: "var(--info)", label: "Following Up" },
    CONVERTED: { bg: "var(--success-bg)", color: "var(--success)", label: "Won" },
    LOST: { bg: "var(--danger-bg)", color: "var(--danger)", label: "Lost" },
    EXPIRED: { bg: "var(--bg-secondary)", color: "var(--text-muted)", label: "Expired" },
};

export function formatTimeSince(date: Date | null): string {
    if (!date) return "Never";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
}

export function formatTimeUntilExpiry(expiresAt: Date): { text: string; urgent: boolean; expired: boolean } {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return { text: "Expired", urgent: true, expired: true };

    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffHours < 1) return { text: `${diffMins}m left`, urgent: true, expired: false };
    if (diffHours < 24) return { text: `${diffHours}h left`, urgent: diffHours < 12, expired: false };
    return { text: `${Math.floor(diffHours / 24)}d left`, urgent: false, expired: false };
}

export interface AccountingFlag {
    id: string;
    reservationType: string;
    reservationId: string;
    reservationNotes: string | null;
    flagReason: string | null;
    status: "PENDING" | "IN_REVIEW" | "RESOLVED";
    accountingNotes: string | null;
    resolution: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
    shiftReport: {
        id: string;
        createdAt: Date;
        user: { id: string; name: string | null; email: string | null };
        shift: { clockIn: Date; clockOut: Date | null };
    };
    flaggedBy: { id: string; name: string | null };
    reviewedBy: { id: string; name: string | null } | null;
}

export interface Stats {
    pending: number;
    inReview: number;
    resolved: number;
    total: number;
}

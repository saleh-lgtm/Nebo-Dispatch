// Engagement types and constants - separate from server actions

/**
 * Point values for different actions
 * These can be adjusted based on business priorities
 */
export const ENGAGEMENT_POINTS = {
    QUOTE_CREATED: 5,
    TRIP_CONFIRMED: 3,
    SMS_SENT: 2,
    TASK_COMPLETED: 10,
    BILLING_REVIEW: 5,
    SHIFT_NOTE_CREATED: 3,
    ANNOUNCEMENT_ACKNOWLEDGED: 1,
    QUOTE_FOLLOWUP: 2,
    RESERVATION_HANDLED: 2,
} as const;

export type EngagementAction = keyof typeof ENGAGEMENT_POINTS;

export interface DispatcherEngagement {
    userId: string;
    userName: string;
    totalPoints: number;
    totalActions: number;
    breakdown: {
        quotesCreated: number;
        tripsConfirmed: number;
        smsSent: number;
        tasksCompleted: number;
        billingReviews: number;
        shiftNotesCreated: number;
        announcementsAcknowledged: number;
        quoteFollowups: number;
    };
}

export interface DailyEngagement {
    date: string;
    dispatchers: {
        userId: string;
        userName: string;
        actions: number;
        points: number;
    }[];
    totalActions: number;
    totalPoints: number;
}

export interface EngagementReport {
    startDate: string;
    endDate: string;
    dispatchers: DispatcherEngagement[];
    dailyTrend: DailyEngagement[];
    topPerformers: {
        userId: string;
        userName: string;
        totalPoints: number;
        rank: number;
    }[];
}

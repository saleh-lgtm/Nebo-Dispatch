// SMS and messaging types

/**
 * SMS message direction
 */
export type SMSDirection = "inbound" | "outbound";

/**
 * SMS message status
 */
export type SMSStatus = "queued" | "sent" | "delivered" | "failed" | "received";

/**
 * SMS log entry
 */
export interface SMSLog {
    id: string;
    from: string;
    to: string;
    body: string;
    direction: SMSDirection;
    status: SMSStatus;
    twilioSid?: string | null;
    createdAt: Date;
    contactId?: string | null;
}

/**
 * SMS conversation (grouped messages by phone number)
 */
export interface SMSConversation {
    phoneNumber: string;
    contactName?: string | null;
    lastMessage: string;
    lastMessageAt: Date;
    unreadCount: number;
    messages?: SMSLog[];
}

/**
 * Chat message for display
 */
export interface ChatMessage {
    id: string;
    body: string;
    direction: SMSDirection;
    status: SMSStatus;
    createdAt: Date;
    from: string;
    to: string;
}

/**
 * SMS contact
 */
export interface SMSContact {
    id: string;
    phoneNumber: string;
    name: string | null;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

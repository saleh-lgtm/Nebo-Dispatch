/**
 * SMS Domain
 *
 * Unified export for SMS/Twilio communications.
 *
 * Usage:
 *   import { sendSMS, getConversations } from "@/lib/domains/sms";
 */

// ============================================
// TWILIO ACTIONS (twilioActions.ts)
// ============================================

export {
  // Core SMS
  sendSMS,
  sendBulkSMS,
  sendCustomSMS,

  // Reservation notifications
  sendReservationConfirmation,
  sendDriverAssignment,
  sendRideReminder,
  sendDriverEnRoute,
  sendDriverArrived,
  sendRideCompleted,
  sendCancellation,

  // Conversations
  getConversations,
  getConversationMessages,
  sendConversationSMS,

  // History & stats
  getSMSHistory,
  getSMSStats,
} from "../../twilioActions";

// ============================================
// SMS CONTACT ACTIONS (smsContactActions.ts)
// ============================================

export {
  // Contact management
  getOrCreateContact,
  getContactByPhone,
  updateContact,
  getContacts,

  // Contact linking
  linkContactToAffiliate,
  linkContactToQuote,
  unlinkContact,

  // Search for linking
  searchAffiliatesForLinking,
  searchQuotesForLinking,
} from "../../smsContactActions";

// ============================================
// BLAST SMS ACTIONS (blastSMSActions.ts)
// ============================================

export {
  // Blast operations
  previewBlastSMS,
  sendBlastSMS,

  // History & stats
  getBlastSMSHistory,
  getBlastSMSStats,
} from "../../blastSMSActions";

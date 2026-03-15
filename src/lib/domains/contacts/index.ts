/**
 * Contacts Domain
 *
 * Unified export for contact and tag management.
 *
 * Usage:
 *   import { getContacts, createContact, getTags } from "@/lib/domains/contacts";
 */

// ============================================
// CONTACT ACTIONS (contactActions.ts)
// ============================================

export {
  // Contact queries
  getContacts,
  getAllContacts,
  getPendingContacts,
  getMyContacts,
  getContactsWithTags,
  getAllContactsWithTags,
  getContactsByTagFilter,

  // Contact mutations
  createContact,
  updateContact,
  deleteContact,

  // Contact approval
  approveContact,
  rejectContact,
} from "../../contactActions";

// ============================================
// TAG ACTIONS (tagActions.ts)
// ============================================

export {
  // Tag queries
  getTags,
  getTag,
  getContactsByTags,

  // Tag mutations
  createTag,
  updateTag,
  deleteTag,

  // Tag-contact relationships
  assignTagsToContact,
  addTagToContact,
  removeTagFromContact,
} from "../../tagActions";

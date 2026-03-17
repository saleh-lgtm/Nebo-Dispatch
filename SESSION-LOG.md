# SESSION-LOG.md — Nebo Dispatch

Permanent session history. Newest entries at top.

---

### Session — 2026-03-16 ~Late Night (3)
**Focus:** Fix broken edit/delete buttons on Company Announcements page + redesign cards
**Changes:**
- Modified: src/lib/notesActions.ts — `getAllAnnouncementsWithStats` now returns per-announcement `acknowledgedCount` and `totalUsers` (includes reads with acknowledged field, counts active approved users)
- Modified: src/app/admin/notes/page.tsx — passes `totalUsers` prop, removed `currentUserId` prop and `as never` cast
- Rewritten: src/app/admin/notes/NotesClient.tsx — full CSS Modules rewrite, proper modal overlays, icon buttons (Pencil + Trash2), acknowledgment badges
- Created: src/app/admin/notes/NotesClient.module.css — white cards on light gray background, fixed-position modal overlays, badge styles
- Commit: f096f21 fix: notes edit/delete buttons + redesign announcement cards
**Decisions:** Modals must use CSS Modules with explicit `position: fixed` — global CSS lacks Tailwind-style utility classes (fixed, inset-0, z-50, etc.). Light card design (white on #f3f4f6) for announcements page.
**Issues Found:** Modals used nonexistent Tailwind classes (fixed, inset-0, z-50, bg-black/80, backdrop-blur-sm) causing them to render inline instead of as overlays — edit/delete appeared broken because the modal was invisible. All checks pass (TypeScript ✅, ESLint ✅, Build ✅).

---

### Session — 2026-03-16 ~Late Night (2)
**Focus:** Split ConfirmationsClient.tsx into focused sub-components (phase 1 of 2)
**Changes:**
- Created: src/app/admin/confirmations/components/utils.ts — shared format helpers (formatDate, formatTime, formatDateTime, isOverdue, getTimeDiff)
- Created: src/app/admin/confirmations/components/TripsToolbarClient.tsx — search, filters panel, results summary
- Created: src/app/admin/confirmations/components/TripsToolbar.module.css
- Created: src/app/admin/confirmations/components/TripsTableClient.tsx — sortable data table, pagination
- Created: src/app/admin/confirmations/components/TripsTable.module.css
- Modified: src/app/admin/confirmations/ConfirmationsClient.tsx — removed extracted code, imports new sub-components (2865 → 1931 lines)
- Commit: ba8445b refactor: extract TripsToolbar, TripsTable, and utils from ConfirmationsClient (1/2)
**Decisions:** Format helpers take `now` as parameter (not closure) for testability. Sub-components use CSS Modules (not style jsx). Phase 2 will extract AnalyticsTab, DispatchersTab, AccountabilityTab.
**Issues Found:** None — all checks pass (TypeScript ✅, ESLint ✅, Build ✅)

---

### Session — 2026-03-16 ~Late Night
**Focus:** Fix scheduler grid day labels off by one — UTC display bug
**Changes:**
- Modified: src/app/admin/scheduler/CommandSchedulerClient.tsx — `isToday()` and day header use `getUTCDate()`/`getUTCMonth()`/`getUTCFullYear()`, aria-label uses `timeZone: 'UTC'`
- Modified: src/app/admin/scheduler/MobileSchedulerClient.tsx — `formatDateHeader()`, week range, day buttons all use UTC methods
- Commit: a4311b9 fix: scheduler day labels off by one — align column headers with dates
**Decisions:** All scheduler date display must use UTC methods since `getWeekStart()`/`addDays()` use UTC arithmetic. Local `.getDate()` on UTC midnight dates shifts back one day in US Central timezone.
**Issues Found:** The UTC fix from the earlier scheduler session (dbe11a0) converted date arithmetic to UTC but missed the display layer — `.getDate()` and `toLocaleDateString()` without `timeZone: 'UTC'` still used local time. All checks pass (TypeScript ✅, ESLint ✅, Build ✅).

---

### Session — 2026-03-16 ~Evening
**Focus:** Server action hardening — 3 more files (54 functions): notesActions, sopActions, calendarExportActions
**Changes:**
- Modified: src/lib/notesActions.ts (14 functions hardened)
- Modified: src/lib/sopActions.ts (35 functions hardened)
- Modified: src/lib/calendarExportActions.ts (5 functions hardened)
- Modified: src/lib/schemas.ts (~15 new Zod schemas: SOP, announcement, calendar, quiz)
- Modified: 12 consumer files to handle new `{ success, data, error }` return shape:
  - src/app/dashboard/page.tsx
  - src/app/admin/notes/NotesClient.tsx, page.tsx
  - src/app/admin/sops/SOPsAdminClient.tsx, page.tsx
  - src/app/sops/page.tsx, SOPsClient.tsx, [slug]/page.tsx, [slug]/SOPDetailClient.tsx
  - src/components/ShiftNotesCard.tsx
  - src/app/schedule/ScheduleClient.tsx
  - src/app/api/calendar/[userId]/route.ts
- Commit: 01b3a28 fix: harden 3 server action files (23/45) — add Zod, try/catch, return shape
**Decisions:** sopActions is the largest single file (35 functions) — all quiz, version, favorites, search, related SOPs wrapped
**Issues Found:** SOPsAdminClient.tsx needed updates for new return shape (caught by TypeScript). All checks pass (TypeScript ✅, ESLint ✅, Build ✅)

---

### Session — 2026-03-16 ~4pm
**Focus:** Server action hardening — 10 more files (73 functions), Zod validation, try/catch, standard return shape
**Changes:**
- Modified: src/lib/adminDashboardActions.ts (7 functions)
- Modified: src/lib/engagementActions.ts (3 functions)
- Modified: src/lib/portalActions.ts (11 functions)
- Modified: src/lib/blastSMSActions.ts (5 functions)
- Modified: src/lib/vehicleMappingActions.ts (8 functions)
- Modified: src/lib/dispatcherPreferencesActions.ts (8 functions)
- Modified: src/lib/affiliateAuditActions.ts (8 functions)
- Modified: src/lib/tagActions.ts (9 functions)
- Modified: src/lib/hoursActions.ts (5 functions)
- Modified: src/lib/analyticsActions.ts (5 functions)
- Modified: src/lib/schemas.ts (~30 new Zod schemas)
- Modified: 21 page/client files to handle new `{ success, data, error }` return shape
- Commits:
  - 5a6fe04 fix: harden 10 server action files (73 functions) — add Zod, try/catch, return shape (20/45)
**Decisions:** Continue consistent pattern for all server actions. Type assertions needed when extracting .data from result objects.
**Issues Found:** None — all checks pass (TypeScript ✅, ESLint ✅, Build ✅)

---

### Session — 2026-03-16 Night
**Focus:** Sidebar navigation reorganization — data-driven config, role-based groups, badge counts
**Changes:**
- Created: src/config/navigation.ts — centralized navigation config with TypeScript types
- Created: src/lib/navCountsActions.ts — server action for admin badge counts
- Modified: src/components/Sidebar.tsx — complete rewrite with dynamic nav rendering
- Modified: src/components/Sidebar.module.css — added badge, collapsible group styles
- Modified: src/components/AppLayout.tsx — removed Navbar import
- Modified: src/middleware.ts — added ACCOUNTING role access to /admin/pricing, /admin/affiliate-audit
- Modified: src/components/dashboard/index.ts — removed Navbar export
- Deleted: src/components/Navbar.tsx, src/components/Navbar.module.css
- Commits:
  - b554728 feat: reorganize sidebar navigation — data-driven config, role-based groups, badge counts
**Decisions:**
- Navigation is data-driven from src/config/navigation.ts
- Badge counts poll every 60s for ADMIN/SUPER_ADMIN (confirmations, SMS, requests, tasks, TBR)
- System group collapsed by default
- ACCOUNTING role can access /admin/pricing and /admin/affiliate-audit
**Issues Found:**
- SMSLog has no isRead field — using inbound SMS count from last 24h instead
- Dispatcher /confirmations page needs to be created (nav item added, page TODO)

---

### Session — 2026-03-16 Late Evening
**Focus:** Set up persistent session logging with SESSION-LOG.md
**Changes:**
- Created: SESSION-LOG.md — permanent session history file
- Modified: .claude/commands/session-end.md — now appends to SESSION-LOG.md + rewrites PRIMER.md
- Modified: PRIMER.md — new format with "Recent Sessions (last 3)" section
- Commits:
  - ad0a069 chore: add SESSION-LOG.md for persistent history, update session-end flow
**Decisions:** SESSION-LOG.md is append-only (newest at top). PRIMER.md summarizes last 3 sessions.
**Issues Found:** None

---

### Session — 2026-03-16 Evening
**Focus:** Server action hardening — Zod validation, try/catch, standard return shape
**Changes:**
- Modified: src/lib/requestActions.ts (5 functions)
- Modified: src/lib/taskActions.ts (11 functions)
- Modified: src/lib/fleetActions.ts (18 functions)
- Modified: src/lib/driverActions.ts (12 functions)
- Modified: src/lib/affiliatePricingActions.ts (10 functions)
- Modified: src/lib/schemas.ts (~25 new Zod schemas)
- Modified: 9 calling pages to handle new `{ success, data }` return shape
- Commits:
  - 9a900ad fix: add validation and error handling to 5 more server action files
  - a07e4bd fix: add validation and error handling to 5 server action files
  - 35a96e4 perf: add database indexes for Task, SchedulingRequest, Portal, CourtReport, TaskItem
  - 31f13c8 fix: sync ConfirmationStatus type with Prisma schema
  - 8532e45 fix: add authentication to /api/tbr/push-to-la (security critical)
**Decisions:** All server actions must use `{ success: boolean, data?: T, error?: string }` return shape. ZodError uses `.issues` not `.errors` for accessing validation messages.
**Issues Found:** /api/tbr/push-to-la had no authentication — fixed as security-critical.

---

### Session — 2026-03-16 Afternoon
**Focus:** Create comprehensive documentation suite in docs/
**Changes:**
- Created: docs/ARCHITECTURE.md — system overview, data flows, deployment
- Created: docs/DATABASE.md — 71 models, 26 enums, relationships, performance
- Created: docs/API.md — 13 API routes, auth methods, webhooks, cron
- Created: docs/INTEGRATIONS.md — 6 services, setup checklist, env config
- Modified: PRIMER.md — updated with session summary
- Commits:
  - db47902 docs: update PRIMER.md with documentation session summary
  - f7cd301 docs: add INTEGRATIONS.md
  - e4564ce docs: add API.md
  - 9ef7794 docs: add DATABASE.md
  - c3669b9 docs: add ARCHITECTURE.md
**Decisions:** Documentation lives in docs/ folder. Four core docs: ARCHITECTURE, DATABASE, API, INTEGRATIONS.
**Issues Found:** None

---

### Session — 2026-03-16 Morning
**Focus:** Set up Claude Code project rules and slash commands
**Changes:**
- Created: PRIMER.md — session snapshot file
- Created: .claude/commands/session-end.md
- Created: .claude/commands/check.md
- Created: .claude/commands/db-push.md
- Created: .claude/commands/new-page.md
- Created: .claude/commands/new-action.md
- Created: .claude/commands/find-feature.md
- Created: .claude/rules/auth-and-roles.md
- Created: .claude/rules/components.md
- Created: .claude/rules/server-actions.md
- Created: .claude/rules/database.md
- Commits:
  - 81be5bc chore: add PRIMER.md session snapshot and /session-end command
  - ff4a388 chore: add project rules — components, server-actions, database, auth-and-roles
  - 1cec255 chore: add slash commands — check, db-push, new-page, new-action, find-feature
**Decisions:** Use slash commands for common tasks. Project rules enforce conventions automatically.
**Issues Found:** None

---

### Session — 2026-03-15 Evening
**Focus:** Expand CLAUDE.md and remove legacy code
**Changes:**
- Modified: CLAUDE.md — full feature map, integration table, key files
- Deleted: Legacy Zapier integration code
- Removed: Unused code across codebase
- Commits:
  - 236259f chore: expand CLAUDE.md with full feature map and project context
  - 4a83a7d chore: remove unused code and legacy Zapier integration
**Decisions:** CLAUDE.md should contain feature map, external integrations table, and key patterns.
**Issues Found:** Found legacy Zapier integration that was no longer used.

---

### Session — 2026-03-15 Afternoon
**Focus:** Scheduler Phase 2-4 implementation
**Changes:**
- Major feature: Real-time schedule sync
- Major feature: Schedule templates
- Major feature: Conflict detection
- Major feature: Smart suggestions
- Commits:
  - 2dc2e0e Add scheduler Phase 2-4: real-time sync, templates, conflicts, suggestions
**Decisions:** Scheduler uses server actions for mutations, not API routes.
**Issues Found:** None

---

### Session — 2026-03-15 Morning
**Focus:** Build fixes, component extraction, LimoAnywhere integration
**Changes:**
- Fixed: favicon.ico location for Next.js 16 build
- Added: Google Sheets integration for LimoAnywhere push
- Switched: From Zapier to Google Apps Script for Sheet integration
- Extracted: Multiple component modules for reusability
- Added: Geocoding and duplicate prevention for LA push
- Added: E.164 phone number formatting
- Commits:
  - cb4b1fc Trigger redeploy
  - 609688a Move favicon.ico to public folder to fix Next.js 16 build error
  - 94bf58d Switch to Google Apps Script for Sheet integration
  - 0969b7b Enhance notification type icons for all notification types
  - 7a7b80f Add more reusable components for shift-swap and confirmations
  - 0d6d902 Add Google Sheets integration for LimoAnywhere push
  - 2ce0356 Extract component modules and add reusable UI primitives
  - 9fcb3b5 Extract engagement, notifications, and forms components
  - b37b0e2 Format phone number to E.164 for LimoAnywhere
  - e50f272 Extract shift-swap components
  - 2c765bf Add component organization and confirmation extractions
  - da6b415 Add geocoding and duplicate prevention for LA push
  - fb07c8f Add component architecture improvements
  - cd8140b Add foundational error handling, pagination, and UI states
**Decisions:** Use Google Apps Script instead of Zapier for Sheets. Extract reusable components to src/components/ui/.
**Issues Found:** favicon.ico must be in public/ for Next.js 16.

---

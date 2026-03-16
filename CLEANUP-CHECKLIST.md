# Nebo Dispatch - Code Cleanup Checklist

Generated: 2026-03-15

Use this checklist to manually review and clean up unused code. Check off items as you verify and delete them.

---

## 1. UNUSED COMPONENT FILES (High Priority)

These files are not imported anywhere and can be safely deleted:

- [ ] **`src/app/admin/scheduler/SchedulerClient.tsx`** (762 lines)
  - Reason: Replaced by `CommandSchedulerClient.tsx`
  - Verification: `grep -r "SchedulerClient" src/` shows no imports
  - Safe to delete: YES

- [ ] **`src/app/admin/scheduler/NewSchedulerClient.tsx`** (958 lines)
  - Reason: Superseded by `CommandSchedulerClient.tsx`
  - Verification: `grep -r "NewSchedulerClient" src/` shows no imports
  - Safe to delete: YES

- [ ] **`src/app/admin/scheduler/scheduler.css`** (~200 lines)
  - Reason: Only imported by unused `SchedulerClient.tsx`
  - Verification: Will be orphaned after deleting SchedulerClient
  - Safe to delete: YES (after deleting SchedulerClient.tsx)

- [ ] **`src/components/sms/BlastSMS.tsx`** (~200 lines)
  - Reason: Replaced by `EnhancedBlastSMS.tsx`
  - Verification: `grep -r "BlastSMS" src/` - only exported in index.ts, never imported
  - Safe to delete: YES
  - Note: Also update `src/components/sms/index.ts` to remove the export

- [ ] **`src/components/ShiftReportForm.refactored.tsx`** (~50 lines)
  - Reason: Incomplete refactor, never activated
  - Verification: No imports found anywhere
  - Safe to delete: YES

---

## 2. UNUSED SERVER ACTIONS (Medium Priority)

### Full File Removal

- [ ] **`src/lib/affiliateTagActions.ts`** (entire file)
  - Exports: `getAffiliateTags`, `getAffiliateTag`, `createAffiliateTag`, `updateAffiliateTag`, `deleteAffiliateTag`
  - Reason: All 5 functions are exported but never imported by any component
  - Question: Is this a planned feature? Check with team before deleting
  - Safe to delete: VERIFY FIRST

### Partial Cleanup

- [ ] **`src/lib/blastSMSActions.ts`** - Remove legacy functions:
  - [ ] `previewBlastSMS()` - only used by deleted BlastSMS.tsx
  - [ ] `sendBlastSMS()` - only used by deleted BlastSMS.tsx
  - [ ] `getBlastSMSHistory()` - exported but never imported
  - [ ] `getBlastSMSStats()` - exported but never imported
  - Keep: `previewEnhancedBlastSMS`, `sendEnhancedBlastSMS`, `getEnhancedBlastSMSHistory`

---

## 3. ORPHANED CSS FILES (Medium Priority)

- [ ] **`src/app/page.module.css`**
  - Reason: Never imported; `page.tsx` uses inline styles
  - Verification: `grep -r "page.module.css" src/` returns nothing
  - Safe to delete: YES

- [ ] **`src/styles/shared.module.css`** (if exists)
  - Reason: Defined but never imported
  - Verification: Check if intended for future use
  - Safe to delete: VERIFY FIRST

---

## 4. ZAPIER CLEANUP - Legacy Webhook Removal

### Environment Variables (.env)

- [ ] **Remove line 17**: `Zapier_email:manifest.593xk3@zapiermail.com`
- [ ] **Remove lines 29-30**:
  ```
  # Zapier - LimoAnywhere Integration
  NEXT_PUBLIC_ZAPIER_LA_WEBHOOK_URL=https://hooks.zapier.com/...
  ```

### Keep These (Google Sheets Integration):
- `GOOGLE_MAPS_API_KEY` ✓
- `GOOGLE_SHEETS_SPREADSHEET_ID` ✓
- `GOOGLE_APPS_SCRIPT_URL` ✓
- `GOOGLE_APPS_SCRIPT_SECRET` ✓
- `GOOGLE_SHEETS_CREDENTIALS` ✓

### Documentation Files

- [ ] **Delete `docs/n8n-limoanywhere-integration-research.md`**
  - Reason: Outdated architecture documentation for legacy approach
  - Safe to delete: YES

- [ ] **Delete `docs/n8n-hybrid-integration-analysis.md`**
  - Reason: Analysis for alternative approach no longer used
  - Safe to delete: YES

- [ ] **Update `docs/tbr-integration-setup.md`**
  - Remove sections about:
    - "Zapier Integration (for LimoAnywhere push)"
    - `ZAPIER_LA_WEBHOOK_URL` configuration
    - "Step 5: Configure Zapier for LimoAnywhere"
  - Keep sections about Google Apps Script

### Code Comments to Update

- [ ] **`src/app/api/tbr/push-to-la/route.ts` line 28**
  - Change: "(for Zapier trigger)" → "(for Google Apps Script)"

- [ ] **`src/app/tbr-trips/TbrTripsClient.tsx` line 276**
  - Change: "push to Zapier" → "push to Google Sheets"

---

## 5. ORPHANED PUBLIC ASSETS (Low Priority)

Next.js template leftovers - safe to delete:

- [ ] `public/vercel.svg`
- [ ] `public/next.svg`
- [ ] `public/file.svg`
- [ ] `public/globe.svg`
- [ ] `public/window.svg`
- [ ] `public/color-palette.png`

---

## 6. INDEX FILE UPDATES

After deleting components, update these index files:

- [ ] **`src/components/sms/index.ts`**
  - Remove: `export { BlastSMS } from './BlastSMS'`
  - Keep: EnhancedBlastSMS and other exports

---

## 7. VERIFICATION COMMANDS

Run these after cleanup to verify no broken imports:

```bash
# Check for broken imports
npm run build

# Verify no references to deleted files
grep -r "SchedulerClient" src/
grep -r "NewSchedulerClient" src/
grep -r "BlastSMS" src/
grep -r "affiliateTagActions" src/

# Run linter
npm run lint
```

---

## 8. GIT COMMANDS FOR CLEANUP

```bash
# Stage deletions
git rm src/app/admin/scheduler/SchedulerClient.tsx
git rm src/app/admin/scheduler/NewSchedulerClient.tsx
git rm src/app/admin/scheduler/scheduler.css
git rm src/components/sms/BlastSMS.tsx
git rm src/components/ShiftReportForm.refactored.tsx
git rm src/app/page.module.css
git rm docs/n8n-limoanywhere-integration-research.md
git rm docs/n8n-hybrid-integration-analysis.md
git rm public/vercel.svg public/next.svg public/file.svg
git rm public/globe.svg public/window.svg public/color-palette.png

# Commit
git commit -m "chore: remove unused files and legacy Zapier integration

- Remove legacy scheduler components (SchedulerClient, NewSchedulerClient)
- Remove old BlastSMS component (replaced by EnhancedBlastSMS)
- Remove incomplete ShiftReportForm refactor
- Clean up Zapier webhook references (keeping Google Sheets integration)
- Remove orphaned CSS and template assets

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Category | Count | Lines Saved |
|----------|-------|-------------|
| Unused Components | 5 files | ~2,170 |
| Unused Server Actions | 1 file + 4 functions | ~300 |
| Orphaned CSS | 1-2 files | ~50 |
| Zapier Docs | 2 files | ~500 |
| Public Assets | 6 files | N/A |
| **Total** | ~15 items | ~3,000 lines |

---

## Notes

- All npm dependencies are actively used - no packages to remove
- The `unifiedEntityService.ts` and `unifiedEntityTypes.ts` files appear to be infrastructure for future use - keep them
- The scheduler now uses `CommandSchedulerClient.tsx` + `MobileSchedulerClient.tsx` via `SchedulerWrapper.tsx`
- Google Sheets integration is the active Zapier workflow - all direct webhook code is legacy

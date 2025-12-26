# Import System Roadmap: 30/60/90 Days Post-Ship

**Date:** 2025-12-26  
**Baseline:** Pass 15 (SHIPPED)  
**Scope:** Import + data/display ecosystem around bets/inputs/persistence

---

## 1) Current Baseline (What's Solid)

The following is **locked** and should not be disrupted:

1. **Single Classification Owner** — `services/marketClassification.ts` + `.config.ts` is the sole source for `classifyBet()`, `classifyLeg()`, `determineType()`
2. **Single Normalization Owner** — `services/normalizationService.ts` with overlay pattern (base seed + localStorage extensions)
3. **Validation Gate Enforced** — `utils/importValidation.ts` prevents invalid bets from persisting; blockers disable import button
4. **Versioned Persistence** — `services/persistence.ts` uses `{ version, updatedAt, bets[], metadata }` envelope with migration support
5. **Corruption Recovery** — Automatic backup created before reset on detection; `bettracker-backup-*` keys preserved
6. **Two Parsers at Contract Compliance** — FanDuel and DraftKings satisfy `parserContract.ts`; set `entityType` and `marketCategory` correctly
7. **Result<T> Error Model** — Consistent typed errors via `services/errors.ts` throughout pipeline
8. **Deduplication at Parser Layer** — Both FD and DK call `dedupeLegs()` before returning; no display-layer fallback
9. **288 Passing Tests** — Regression suite covers classification, validation, parsing, persistence, transform
10. **Documentation Complete** — Operator guide, dev guide, troubleshooting guide all current

---

## 2) Top Opportunities (Ranked)

| # | Opportunity | Impact | Risk | Effort | Dependencies |
|---|-------------|--------|------|--------|--------------|
| 1 | **Add BetMGM Parser** | HIGH – Major sportsbook coverage | LOW – Uses established contract | MEDIUM (2-3 days) | Collect HTML samples; follow `templateParser.ts` |
| 2 | **CSV Export** | HIGH – User data portability | LOW – Read-only output | LOW (1 day) | None |
| 3 | **Bulk Edit (Multi-Select + Batch)** | MEDIUM – Power user efficiency | LOW – Additive feature | MEDIUM (2-3 days) | None |
| 4 | **Import History Ledger** | MEDIUM – Audit trail, undo context | LOW – Additive metadata | LOW-MEDIUM (1-2 days) | Metadata field in persistence |
| 5 | **Hash-Based Duplicate Fallback** | MEDIUM – Resilience if betId missing | MEDIUM – Must not override prior logic | LOW (1 day) | Content hash utility |
| 6 | **Entity Management UI (Teams/Players)** | MEDIUM – Easier overlay editing | LOW | MEDIUM (2-3 days) | Normalization overlay API exists |
| 7 | **Expanded Stat Type Coverage** | MEDIUM – Better prop classification | LOW | LOW (1 day) | Update `referenceData.ts` |
| 8 | **Search/Filter/Sort UX Polish** | MEDIUM – Daily usability | LOW | LOW (1-2 days) | None |
| 9 | **Add Caesars Parser** | MEDIUM – Coverage expansion | LOW | MEDIUM (2-3 days) | HTML samples |
| 10 | **Optional Cloud Backup (Dropbox/Drive)** | HIGH – Multi-device access | HIGH – External auth, privacy | HIGH (5+ days) | OAuth, file API |
| 11 | **Analytics Dashboard** | HIGH – Value proposition | MEDIUM – New feature area | HIGH (5+ days) | Aggregation utilities |
| 12 | **Mobile-Responsive Table** | MEDIUM – Phone viewing | LOW | MEDIUM (2-3 days) | CSS refactor |
| 13 | **Parser Auto-Update Detection** | LOW – Proactive drift alert | LOW | MEDIUM (2-3 days) | Checksum fixtures |
| 14 | **Multi-Device Sync (WebSocket)** | HIGH – Real-time sync | HIGH – Backend infra | VERY HIGH (2+ weeks) | Server, auth, conflict resolution |

---

## 3) 30-Day Plan (Stability + Small Wins)

Focus: Lock in reliability, quick user wins, no architectural changes.

### Item 3.1: CSV Export

| Field | Value |
|-------|-------|
| **Objective** | Allow users to export all bets as CSV for spreadsheet analysis |
| **Acceptance Criteria** | - Settings > Export offers "Export as CSV" button<br>- Downloads file `bettracker-export-{date}.csv`<br>- Columns: id, book, betId, placedAt, betType, description, odds, stake, payout, result, sport, marketCategory |
| **Owner Modules/Files** | `components/Settings.tsx`, new `utils/csvExport.ts` |
| **Test Additions** | - Unit test for `formatBetAsCSVRow()`<br>- E2E: export button triggers download |

---

### Item 3.2: Expanded Stat Type Coverage

| Field | Value |
|-------|-------|
| **Objective** | Add 15+ missing stat types to improve prop classification hit rate |
| **Acceptance Criteria** | - Add to `data/referenceData.ts`: Blocks, Steals, Doubles, Triples, First TD, Longest Rush, Longest Reception, etc.<br>- Classification tests updated to verify new types |
| **Owner Modules/Files** | `data/referenceData.ts`, `services/marketClassification.config.ts` |
| **Test Additions** | - Add cases to `marketClassification.test.ts` for new stat keywords |

---

### Item 3.3: Search/Filter/Sort UX Polish

| Field | Value |
|-------|-------|
| **Objective** | Improve table usability with column sorting, date range filter, text search |
| **Acceptance Criteria** | - Click column header to sort (ascending/descending toggle)<br>- Date range picker filters bets<br>- Search box filters by description, player, team |
| **Owner Modules/Files** | `views/BetTableView.tsx`, `hooks/useBets.tsx` filter state |
| **Test Additions** | - None required (UI-only); manual verification |

---

### Item 3.4: Import History Ledger (Metadata Only)

| Field | Value |
|-------|-------|
| **Objective** | Track import events for audit trail and potential undo context |
| **Acceptance Criteria** | - On successful import, append to `metadata.importHistory[]`: `{ timestamp, betsAdded, source }`<br>- Viewable in Settings > Data > Import History |
| **Owner Modules/Files** | `services/persistence.ts`, `hooks/useBets.tsx::addBets()`, `components/Settings.tsx` |
| **Test Additions** | - `persistence.test.ts`: verify importHistory appended on save |

---

### Item 3.5: Fixture Drift Checksum

| Field | Value |
|-------|-------|
| **Objective** | Detect when sportsbook HTML structure changes before tests fail unexpectedly |
| **Acceptance Criteria** | - Store SHA256 of fixture files in a manifest<br>- CI check compares manifest; warns if changed without test update |
| **Owner Modules/Files** | `parsing/{sportsbook}/fixtures/`, new `scripts/checkFixtureHash.js` |
| **Test Additions** | - Script-based warning (not test failure) |

---

## 4) 60-Day Plan (Power Features That Don't Break Core)

Focus: Meaningful feature expansion for power users; no backend dependencies.

### Item 4.1: Bulk Edit Tools

| Field | Value |
|-------|-------|
| **Objective** | Allow multi-select and batch operations on bet table rows |
| **Features** | - Checkbox column for multi-select<br>- Toolbar: "Set Sport", "Set Category", "Delete Selected"<br>- Confirmation modal for destructive actions |
| **Acceptance Criteria** | - Select 5 bets → Set Sport to "NFL" → All 5 update in storage<br>- Delete Selected → Confirmation → Removed from storage |
| **Owner Modules/Files** | `views/BetTableView.tsx`, `hooks/useBets.tsx::updateBets()`, `hooks/useBets.tsx::deleteBets()` |
| **Test Additions** | - `useBets.test.ts`: batch update, batch delete scenarios |

---

### Item 4.2: Entity Management UI

| Field | Value |
|-------|-------|
| **Objective** | Dedicated UI for viewing/editing/adding teams, players, stat types |
| **Features** | - Settings > Normalization > Teams: list, add, edit, delete<br>- Same for Players and Stat Types<br>- Search/filter in entity list |
| **Acceptance Criteria** | - Add team alias → Immediately available in normalization<br>- Delete team → Removed from overlay |
| **Owner Modules/Files** | New `views/EntityManagementView.tsx`, `services/normalizationService.ts` overlay APIs |
| **Test Additions** | - Manual verification; service APIs already tested |

---

### Item 4.3: Hash-Based Duplicate Fallback

| Field | Value |
|-------|-------|
| **Objective** | Detect duplicates even if `betId` is missing by hashing key fields |
| **Features** | - If bet.id missing, compute hash from `book + placedAt + stake + odds + description`<br>- Use hash for duplicate check before import |
| **Acceptance Criteria** | - Bet without betId → Duplicate detected by content hash<br>- Original id-based dedup unchanged for normal bets |
| **Owner Modules/Files** | `hooks/useBets.tsx::addBets()`, new `utils/betHash.ts` |
| **Test Additions** | - `importPipeline.test.ts`: duplicate detection by hash scenario |

---

### Item 4.4: Add BetMGM Parser

| Field | Value |
|-------|-------|
| **Objective** | Add third sportsbook parser following established contract |
| **Features** | - Parse singles, parlays, SGP from BetMGM bet history HTML<br>- Set entityType and marketCategory |
| **Acceptance Criteria** | - Select BetMGM → Paste HTML → Bets parsed with 0 blockers<br>- Contract tests pass |
| **Owner Modules/Files** | New `parsing/betmgm/`, update `parsing/parserRegistry.ts` |
| **Test Additions** | - `parsing/betmgm/tests/betmgm.test.ts`<br>- Add BetMGM to `parser-contract.test.ts` |

---

### Item 4.5: Mobile-Responsive Table

| Field | Value |
|-------|-------|
| **Objective** | Optimize bet table for phone/tablet viewing |
| **Features** | - Responsive column hiding (show key columns only on mobile)<br>- Card layout option for narrow screens |
| **Acceptance Criteria** | - At 400px width, table shows: Date, Description, Result, Net<br>- No horizontal scroll required |
| **Owner Modules/Files** | `views/BetTableView.tsx`, CSS media queries |
| **Test Additions** | - Manual visual testing at responsive breakpoints |

---

## 5) 90-Day Plan (Bigger Bets)

Focus: Strategic features that may require backend infrastructure or new domains.

### Item 5.1: Optional Cloud Backup

| Field | Value |
|-------|-------|
| **Objective** | Allow users to sync data to Google Drive or iCloud for cross-device access |
| **Scope** | - OAuth integration with Google Drive API<br>- Periodic backup to user's Drive folder<br>- Restore from cloud on new device |
| **Is It Worth It?** | YES if: >20% users request cross-device sync. NO if: localStorage is sufficient for primary use case. |
| **Risk** | HIGH — OAuth complexity, privacy implications, sync conflicts |
| **Effort** | 5+ days for MVP |

---

### Item 5.2: Analytics Dashboard

| Field | Value |
|-------|-------|
| **Objective** | Visual reporting on betting performance over time |
| **Features** | - Win rate by sport/category/sportsbook<br>- ROI trends over time<br>- Profit/loss by market type<br>- Charts: line, bar, pie |
| **Is It Worth It?** | YES if: Analytics is a key value proposition for the product. NO if: Users primarily use external spreadsheets. |
| **Risk** | MEDIUM — New UI domain, but data already in localStorage |
| **Effort** | 5-7 days for MVP |

---

### Item 5.3: Parser Coverage Expansion (Caesars, PointsBet, FanDuel Sportsbook Variants)

| Field | Value |
|-------|-------|
| **Objective** | Expand sportsbook coverage to capture more market share |
| **Effort per Parser** | 2-3 days using established template |
| **Is It Worth It?** | Evaluate by user request volume and market share of each sportsbook. |

---

### Item 5.4: Multi-Device Real-Time Sync

| Field | Value |
|-------|-------|
| **Objective** | Sync bets across devices in real-time via backend |
| **Scope** | - Backend service (Firebase/Supabase/custom)<br>- User authentication<br>- Real-time conflict resolution |
| **Is It Worth It?** | YES if: Product evolves to multi-platform (mobile app, web). NO if: Remaining as single-user browser tool. |
| **Risk** | VERY HIGH — Requires backend infrastructure, auth, conflict strategy |
| **Effort** | 2+ weeks |

---

### Item 5.5: Advanced Analytics Pipelines

| Field | Value |
|-------|-------|
| **Objective** | Enable complex queries and aggregations for power users |
| **Features** | - Custom report builder<br>- Saved filters/views<br>- Export to analytics platforms |
| **Is It Worth It?** | Depends on user sophistication and whether simpler dashboard suffices. |

---

## 6) Guardrails (Non-Negotiables)

These rules must not be violated by any roadmap item:

### 6.1 Single Ownership Per Concern

- Classification logic lives ONLY in `services/marketClassification.ts`
- Normalization logic lives ONLY in `services/normalizationService.ts`
- Import validation lives ONLY in `utils/importValidation.ts`
- Persistence lives ONLY in `services/persistence.ts`

**Violation:** Creating parallel/duplicate logic in another file

---

### 6.2 Validation Gate Enforcement

- The import button MUST remain disabled when blockers > 0
- `addBets()` MUST filter out bets with blockers before persisting
- Blockers are defined in `utils/importValidation.ts` and nowhere else

**Violation:** Allowing invalid bets to bypass the gate

---

### 6.3 No Wrong-Layer Cleaning

- Display layer (`betToFinalRows.ts`) does NOT clean or fix data
- Storage layer (`useBets.tsx`) does NOT guess entity types
- Parser layer sets `entityType` and `marketCategory` before returning

**Violation:** Adding data-fixing logic to display or storage layers

---

### 6.4 Contract Tests Must Exist

- Every enabled parser MUST pass `parser-contract.test.ts`
- Contract tests verify: required fields, entityType set, marketCategory set
- New parsers must add contract test cases before enabling

**Violation:** Enabling a parser without contract test coverage

---

### 6.5 Migrations Required for Schema Changes

- If `STORAGE_VERSION` changes, a migration function MUST exist in `persistence.ts`
- Old data formats MUST migrate forward; never leave users stranded
- Backups MUST be created before destructive migrations

**Violation:** Changing storage shape without migration code

---

### 6.6 Result<T> Error Handling

- All import pipeline functions return `Result<T>`, not thrown exceptions
- Error codes are defined in `services/errors.ts`
- UI displays user-friendly messages based on error codes

**Violation:** Throwing exceptions in the import pipeline

---

## How to Evaluate "Is It Worth It?"

For any 60-day or 90-day item, answer:

1. **User Signal** — Have >3 users requested this? Is it blocking adoption?
2. **Strategic Fit** — Does it align with product vision (betting analysis tool)?
3. **Opportunity Cost** — What else could be built with the same effort?
4. **Reversibility** — If it fails, can we remove it cleanly?
5. **Maintenance Burden** — Will this create ongoing support overhead?

If 3+ answers are positive, proceed. Otherwise, defer.

---

## Document History

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2025-12-26 | Initial 30/60/90 roadmap post-ship |

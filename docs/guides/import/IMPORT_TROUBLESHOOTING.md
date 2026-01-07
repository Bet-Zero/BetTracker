<!-- PERMANENT DOC - DO NOT DELETE -->

# Import Troubleshooting Guide

> **Symptom-based debugging** for import issues. For workflow help, see [IMPORT_OPERATOR_GUIDE.md](./IMPORT_OPERATOR_GUIDE.md).

---

## Symptom: "No bets found"

### Likely Causes
1. Wrong sportsbook selected
2. HTML from wrong page (not settled bets)
3. Empty or malformed HTML
4. Parser doesn't recognize page structure

### Where to Look
| Location | What to Check |
|----------|---------------|
| `views/ImportView.tsx` | Sportsbook dropdown value |
| `parsing/shared/pageProcessor.ts` | `processPageResult()` return value |
| `parsing/{sportsbook}/parsers/` | Selectors matching HTML structure |

### Fix Steps
1. Verify sportsbook matches the HTML source
2. Confirm HTML is from settled/resolved bets page
3. Check browser console for parse errors
4. If new HTML structure, update parser selectors

---

## Symptom: Import Disabled (Blockers)

### Likely Causes
1. Missing bet ID
2. Invalid `placedAt` date
3. Missing or negative `stake`
4. Missing `result` field
5. Missing `odds` for win bets
6. Net calculation would result in NaN

### Where to Look
| Location | What to Check |
|----------|---------------|
| `components/ImportConfirmationModal.tsx` | Blocker count in header |
| `utils/importValidation.ts` | `validateBetForImport()` blocker conditions |
| Confirmation table | Red row highlighting |

### Fix Steps
1. Expand blocker details in modal header
2. Find bet with blocker (highlighted red)
3. Use inline editing to fix:
   - Set `placedAt` to valid ISO date
   - Set `stake` to positive number
   - Set `result` to win/loss/push/pending
   - Set `odds` for winning bets
4. Blocker count updates live

---

## Symptom: Bets Imported but Not Visible

### Likely Causes
1. Active filter hiding the bet
2. Bet lacks `sport` (filtered out by sport filter)
3. Display transform failing silently

### Where to Look
| Location | What to Check |
|----------|---------------|
| `views/BetTableView.tsx` | Active filter state |
| `parsing/shared/betToFinalRows.ts` | Transform producing rows |
| `hooks/useBets.tsx` | `bets` state contains the bet |

### Fix Steps
1. Clear all filters (reset to "All Sports", "All Categories")
2. Check browser console for transform errors
3. Verify bet exists: `localStorage.getItem('bettracker-state')` → parse → check bets array
4. If bet missing, re-import

---

## Symptom: Duplicates Unexpectedly High

### Likely Causes
1. Re-importing same HTML batch
2. Bet IDs match existing records
3. Date range overlaps previous import

### Where to Look
| Location | What to Check |
|----------|---------------|
| `hooks/useBets.tsx` | `existingBetIds` set |
| `components/ImportConfirmationModal.tsx` | Duplicate count calculation |
| Bet `id` field | Format: `{book}:{betId}:{placedAt}` |

### Fix Steps
1. **This is expected behavior** — duplicates are safely skipped
2. To see what's in storage: `JSON.parse(localStorage.getItem('bettracker-state')).bets`
3. If duplicates are wrong, check if `betId` generation changed in parser

---

## Symptom: Odds/Net is NaN

### Likely Causes
1. Odds couldn't be parsed from HTML
2. Odds stored as string instead of number
3. Zero odds passed to calculation

### Where to Look
| Location | What to Check |
|----------|---------------|
| `parsing/{sportsbook}/parsers/` | Odds extraction logic |
| `utils/importValidation.ts` | `calculateExpectedNet()` |
| `parsing/shared/betToFinalRows.ts` | `calculateNet()`, `calculateRawNet()` |

### Fix Steps
1. Edit odds manually in confirmation modal before import
2. Check raw HTML for odds format
3. If parser bug, update odds extraction regex

---

## Symptom: Corruption Recovery Triggered

### Likely Causes
1. localStorage data manually corrupted
2. Browser storage quota exceeded mid-save
3. Incompatible extension modified storage
4. Version mismatch (newer app version expected)

### Where to Look
| Location | What to Check |
|----------|---------------|
| `services/persistence.ts` | `loadState()`, `migrateIfNeeded()` |
| Browser console | Corruption error details |
| `localStorage` | `bettracker-backup-*` keys |

### Fix Steps
1. **Automatic backup was created** — check `bettracker-backup-corruption-{timestamp}`
2. Fresh default state initialized automatically
3. To recover from backup:
   ```javascript
   // In browser console
   const backup = localStorage.getItem('bettracker-backup-corruption-...');
   const parsed = JSON.parse(backup);
   // Inspect and restore if valid
   localStorage.setItem('bettracker-state', backup);
   location.reload();
   ```

---

## Symptom: Wrong Category/Type Assignment

### Likely Causes
1. Market keywords not matching patterns
2. Sport-specific mapping missing
3. Bet description unclear

### Where to Look
| Location | What to Check |
|----------|---------------|
| `services/marketClassification.ts` | `classifyBet()`, `classifyLeg()` |
| `services/marketClassification.config.ts` | Keyword arrays, `STAT_TYPE_MAPPINGS` |

### Fix Steps
1. Edit category/type in confirmation modal before import
2. Add missing keyword to config:
   ```typescript
   // marketClassification.config.ts
   PROP_KEYWORDS: ['new_keyword', ...existing]
   ```
3. Run tests: `npx vitest run services/marketClassification.test.ts`

---

## Symptom: Player/Team Not Normalized

### Likely Causes
1. Team alias not in reference data
2. Player name variant not recognized
3. Overlay not loaded

### Where to Look
| Location | What to Check |
|----------|---------------|
| `services/normalizationService.ts` | Lookup maps |
| `data/referenceData.ts` | Base team/player data |
| `localStorage` | `bettracker-normalization-teams`, `bettracker-normalization-stattypes` |

### Fix Steps
1. Add alias via Settings → Normalization
2. Or add to base seed in `referenceData.ts`
3. If modified at runtime, call `refreshLookupMaps()`

---

## Symptom: Input Too Large Error

### Likely Causes
1. HTML exceeds 5MB limit (MAX_INPUT_SIZE_CHARS)

### Where to Look
| Location | What to Check |
|----------|---------------|
| `parsing/shared/pageProcessor.ts` | `MAX_INPUT_SIZE_CHARS` constant |
| `services/errors.ts` | `INPUT_TOO_LARGE` error code |

### Fix Steps
1. Copy smaller date range from sportsbook
2. Import in batches
3. If legitimate use case requires larger input, increase `MAX_INPUT_SIZE_CHARS`

---

## Symptom: Parser Not Available Message

### Likely Causes
1. Selected sportsbook has no implemented parser
2. Parser is disabled in registry

### Where to Look
| Location | What to Check |
|----------|---------------|
| `parsing/parserRegistry.ts` | `PARSER_REGISTRY` entries |

### Fix Steps
1. Select FanDuel or DraftKings (currently supported)
2. To implement new parser, follow [IMPORT_DEV_GUIDE.md](./IMPORT_DEV_GUIDE.md)

---

## Quick Diagnostic Commands

```javascript
// Check storage state
JSON.parse(localStorage.getItem('bettracker-state'))

// List all backups
Object.keys(localStorage).filter(k => k.startsWith('bettracker-backup'))

// Check normalization overlays
JSON.parse(localStorage.getItem('bettracker-normalization-teams'))
JSON.parse(localStorage.getItem('bettracker-normalization-stattypes'))

// Clear and reset (DESTRUCTIVE)
localStorage.removeItem('bettracker-state')
location.reload()
```

---

## Symptom: Cross-Sport Collisions

### Likely Causes
1. Team abbreviations match multiple teams across sports (e.g., "ATL" = Atlanta Hawks NBA + Atlanta Falcons NFL)
2. Player names exist in multiple sports (rare but possible)
3. Sport context missing or incorrect during import

### Known Collisions

The following collisions are known to occur when sport context is unavailable or ambiguous:

**Team Abbreviations:**
- **ATL**: Atlanta Hawks (NBA) vs Atlanta Falcons (NFL)
- **NY**: New York Knicks (NBA) vs New York Giants (NFL) vs New York Yankees (MLB) vs New York Rangers (NHL)
- **LAL**: Los Angeles Lakers (NBA) vs Los Angeles Rams (NFL)
- **BOS**: Boston Celtics (NBA) vs Boston Red Sox (MLB) vs New England Patriots (NFL - uses "NE" but "Boston" may appear)
- **CHI**: Chicago Bulls (NBA) vs Chicago Bears (NFL) vs Chicago Cubs (MLB) vs Chicago Blackhawks (NHL)

**Resolution Behavior:**
- When sport context is available, the correct team is matched automatically
- When sport context is missing, the first match in the reference data wins (typically alphabetically first)
- The `ImportConfirmationModal` displays a collision warning when ambiguous matches are detected

### Where to Look
| Location | What to Check |
|----------|---------------|
| `components/ImportConfirmationModal.tsx` | Collision warning banner (yellow alert) |
| `services/normalizationService.ts` | `normalizeTeamNameWithMeta()` collision detection |
| Bet confirmation table | "Collision" badge on affected rows |
| `data/referenceData.ts` | Team alias definitions |

### Fix Steps

**Step 1: Identify the Collision**
1. Look for the yellow collision warning banner at the top of the import confirmation modal
2. Check bet rows for "Collision" badges (yellow badge with tooltip)
3. Hover over the collision badge to see which teams matched

**Step 2: Verify Sport Context**
1. Check the "Sport" column for the affected bet
2. Ensure the sport is correctly set (e.g., "NBA" for Hawks, "NFL" for Falcons)
3. If sport is missing or wrong, click "Edit" on the bet row

**Step 3: Manual Correction (if needed)**
1. Click "Edit" on the bet row with the collision
2. Verify the "Sport" field is correct
3. If sport is correct but collision persists:
   - Click the "+" button next to the team name to add it explicitly
   - Or manually edit the "Name" field to use the full team name (e.g., "Atlanta Hawks" instead of "ATL")
4. Click "Done" to save changes
5. The collision warning should clear once the correct team is identified

**Step 4: Add Missing Sport (if sport is missing)**
1. If the sport dropdown shows "(missing)" or the sport is not in the list:
2. Click the "+" button next to the sport dropdown to add it
3. Select the correct sport from the dropdown
4. The normalization service will re-evaluate the team match with the correct sport context

**Step 5: Verify Resolution**
1. The collision badge should disappear after correction
2. The yellow warning banner will clear when all collisions are resolved
3. Proceed with import once all issues are fixed

### Prevention Tips

- **Always set sport before importing:** Ensure the correct sportsbook is selected (sport is often inferred from sportsbook context)
- **Review team names in confirmation modal:** Check for collision badges before importing
- **Use full team names when ambiguous:** If you know a collision exists, use the full team name in the bet description
- **Add team aliases proactively:** Add common abbreviations to the normalization data with sport-specific aliases

### Example Workflow

**Scenario:** Importing a bet with "ATL -5.5" where sport context is missing.

1. **Detection:** Import confirmation modal shows:
   - Yellow warning banner: "Ambiguous team alias 'ATL' matched multiple teams: Atlanta Hawks, Atlanta Falcons. Using 'Atlanta Hawks'."
   - Bet row shows "Collision" badge

2. **Investigation:** 
   - Check bet description: "ATL -5.5 Spread Betting"
   - Check sport column: "(missing)" or wrong sport

3. **Correction:**
   - Click "Edit" on the bet row
   - Set "Sport" to "NFL" (if it's a Falcons bet) or "NBA" (if it's a Hawks bet)
   - Click "Done"

4. **Verification:**
   - Collision badge disappears
   - Team name resolves correctly
   - Import proceeds normally

### Code References

- Collision detection: `services/normalizationService.ts` - `normalizeTeamNameWithMeta()`
- UI warning: `components/ImportConfirmationModal.tsx` - Collision warning banner (marked with `COLLISION_WARNING_BANNER_START/END` comments) displayed above the bet confirmation table when cross-sport collisions are detected
- Collision badge: `components/ImportConfirmationModal.tsx` - Collision badge (marked with `COLLISION_BADGE_START/END` comments) displayed in the "Name" column of bet rows and parlay leg rows when ambiguous team matches are detected

> **Note:** For historical reference, these UI elements were located at lines 617-629 (warning banner) and 1087-1095 (collision badge) as of the initial implementation. Use the marker comments or semantic descriptions above to locate them in the current codebase.

---

## Related Documentation

- [IMPORT_OPERATOR_GUIDE.md](./IMPORT_OPERATOR_GUIDE.md) — Daily operations
- [IMPORT_DEV_GUIDE.md](./IMPORT_DEV_GUIDE.md) — Architecture & onboarding
- [IMPORT_SYSTEM_GAP_ANALYSIS_V3.md](../../audits/IMPORT_SYSTEM_GAP_ANALYSIS_V3.md) — Foundation audit

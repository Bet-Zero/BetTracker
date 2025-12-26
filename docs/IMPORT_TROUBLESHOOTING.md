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

## Related Documentation

- [IMPORT_OPERATOR_GUIDE.md](./IMPORT_OPERATOR_GUIDE.md) — Daily operations
- [IMPORT_DEV_GUIDE.md](./IMPORT_DEV_GUIDE.md) — Architecture & onboarding
- [IMPORT_SYSTEM_GAP_ANALYSIS_V3.md](../audits/IMPORT_SYSTEM_GAP_ANALYSIS_V3.md) — Foundation audit

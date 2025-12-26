# Import Developer Guide

> **Architecture & Onboarding** for developers extending the import system. For daily operations, see [IMPORT_OPERATOR_GUIDE.md](./IMPORT_OPERATOR_GUIDE.md).

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              INPUT LAYER                                │
│  ImportView.tsx → ManualPasteSourceProvider → PageSourceProvider        │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                            PARSING LAYER                                │
│  pageProcessor.ts → parserRegistry.ts → {FanDuel,DraftKings}/parsers    │
│  Output: Bet[] with marketCategory + entityType assigned                │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                         CONFIRMATION LAYER                              │
│  ImportConfirmationModal.tsx                                            │
│  • Table preview with inline editing                                    │
│  • validateBetsForImport() → blocker/warning counts                     │
│  • Import button disabled when blockers > 0                             │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                          VALIDATION GATE                                │
│  utils/importValidation.ts::validateBetForImport()                      │
│  • BLOCKERS: missing id, invalid date, invalid stake, missing result    │
│  • WARNINGS: missing sport, missing type, no leg details                │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                  │
│  hooks/useBets.tsx::addBets() → services/persistence.ts                 │
│  • Deduplication by bet.id                                              │
│  • Entity processing via entityType (no guessing)                       │
│  • Versioned envelope: { version, updatedAt, bets, metadata }           │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                          DISPLAY LAYER                                  │
│  BetTableView.tsx → parsing/shared/betToFinalRows.ts                    │
│  • Single transform path with raw numeric fields                        │
│  • Uses normalizeCategoryForDisplay(), abbreviateMarket()               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files & Single Sources of Truth

### Classification

| File | Purpose |
|------|---------|
| `services/marketClassification.ts` | **Single owner** — `classifyBet()`, `classifyLeg()`, `determineType()` |
| `services/marketClassification.config.ts` | Keywords, patterns, sport-specific mappings |

### Normalization

| File | Purpose |
|------|---------|
| `services/normalizationService.ts` | **Single owner** — team/player/stat normalization |
| `data/referenceData.ts` | Base seed data (teams, stat types, sports) |
| `localStorage` overlays | User-added aliases via `bettracker-normalization-*` keys |

### Validation

| File | Purpose |
|------|---------|
| `utils/importValidation.ts` | **Import-time validation** — blockers vs warnings |
| `utils/validation.ts` | **Edit-time validation** — field-level checks |

### Persistence

| File | Purpose |
|------|---------|
| `services/persistence.ts` | Versioned storage envelope, migration, corruption recovery |
| `services/errors.ts` | `Result<T>` pattern, typed `ImportError` codes |

Storage schema:
```typescript
{
  version: 1,
  updatedAt: "2025-12-26T12:00:00Z",
  bets: Bet[],
  metadata?: { lastMigration?, previousVersion? }
}
```

### Parser Infrastructure

| File | Purpose |
|------|---------|
| `parsing/parserContract.ts` | Parser function signature, required fields, validation |
| `parsing/parserRegistry.ts` | Centralized parser lookup, enabled/disabled state |
| `parsing/template/templateParser.ts` | Minimal template for new parsers |

---

## How to Add a Sportsbook Parser

### Checklist

- [ ] **1. Collect Sample HTML**
  - Get HTML from settled bets page
  - Save samples to `parsing/{sportsbook}/fixtures/`
  - Include: singles, parlays, SGPs, wins, losses, pushes, pending

- [ ] **2. Create Directory Structure**
  ```
  parsing/{sportsbook}/
  ├── parsers/
  │   ├── index.ts       # Main parser export
  │   ├── single.ts      # Single bet parser
  │   ├── parlay.ts      # Parlay parser
  │   └── common.ts      # Shared utilities
  ├── fixtures/          # Sample HTML files
  └── tests/             # Parser tests
  ```

- [ ] **3. Implement Parser**
  - Copy structure from `parsing/template/templateParser.ts`
  - Satisfy all fields in `parserContract.ts::REQUIRED_BET_FIELDS`
  - Set `entityType` on every leg (`"player"` | `"team"` | `"unknown"`)
  - Set `marketCategory` on every bet
  - Return `Result<Bet[]>` or `Bet[]`

- [ ] **4. Register Parser**
  ```typescript
  // parsing/parserRegistry.ts
  import { parse as parseNewBook } from './newbook/parsers';

  const PARSER_REGISTRY = {
    // ... existing
    'NewBook': {
      parser: parseNewBook,
      enabled: true,
      status: 'implemented',
      notes: 'Full support for singles, parlays'
    }
  };
  ```

- [ ] **5. Add to UI (Optional)**
  - Update `hooks/useInputs.tsx::defaultSportsbooks` if needed

- [ ] **6. Write Contract Tests**
  ```typescript
  // parsing/tests/parser-contract.test.ts
  describe('NewBook Parser Contract', () => {
    it('satisfies bet contract', () => {
      const bets = parseNewBook(sampleHtml);
      for (const bet of bets) {
        const result = validateBetContract(bet, 'NewBook');
        expect(result.isValid).toBe(true);
      }
    });
  });
  ```

- [ ] **7. Update Documentation**
  - Add to this guide's sportsbook table
  - Update `IMPORT_SYSTEM_GAP_ANALYSIS_V3.md` if needed

### Parser Responsibilities

Per `parserContract.ts`:

1. **Deduplication** — Remove duplicate legs before returning
2. **Entity Type** — Set `entityType` on each leg
3. **Market Category** — Set `marketCategory` on each bet
4. **Date normalization** — Parse to ISO 8601
5. **Amount normalization** — Parse currency to numbers
6. **Result detection** — Bet: lowercase, Leg: uppercase
7. **ID generation** — Format: `{book}:{betId}:{placedAt}`
8. **Error handling** — Return `ImportError`, never throw

---

## How to Change Classification/Normalization Safely

### Classification Changes

1. **Modify patterns** in `services/marketClassification.config.ts`
2. **Run tests**: `npx vitest run services/marketClassification.test.ts`
3. **Check existing bets** — changes don't retroactively reclassify

### Normalization Changes

1. **Modify base seed** in `data/referenceData.ts` *or*
2. **Add overlay** via UI (Settings → Normalization)
3. **Call `refreshLookupMaps()`** if modifying at runtime
4. **Run tests**: `npx vitest run services/normalizationService.test.ts`

### Safe Migration Pattern

```typescript
// In persistence.ts when adding new fields
if (raw.version < STORAGE_VERSION) {
  return ok({
    ...raw,
    version: STORAGE_VERSION,
    bets: raw.bets.map(bet => ({
      ...bet,
      newField: inferDefault(bet) // Add defaults for new fields
    }))
  });
}
```

---

## Test Strategy Summary

| Test Suite | Protects |
|------------|----------|
| `marketClassification.test.ts` | Category/type detection (50+ tests) |
| `normalizationService.test.ts` | Team/stat normalization (50+ tests) |
| `importPipeline.test.ts` | Validation gate, blockers (25+ tests) |
| `parser-contract.test.ts` | Parser output validity (per-parser) |
| `persistence.test.ts` | Save/load, migration, corruption (15+ tests) |
| `betToFinalRows.test.ts` | Display transform |

> **Maintenance note:** Keep test file names in this table synchronized with actual files in `services/` and `parsing/tests/`.

Run all: `npx vitest run`

---

## Related Documentation

- [IMPORT_OPERATOR_GUIDE.md](./IMPORT_OPERATOR_GUIDE.md) — Daily operations
- [IMPORT_TROUBLESHOOTING.md](./IMPORT_TROUBLESHOOTING.md) — Symptom-based debugging
- [IMPORT_SYSTEM_GAP_ANALYSIS_V3.md](../audits/IMPORT_SYSTEM_GAP_ANALYSIS_V3.md) — Foundation audit
- [PARSER_TARGET_FIELDS.md](../parsing/PARSER_TARGET_FIELDS.md) — Field extraction reference
- [PARSER_IMPLEMENTATION_CHECKLIST.md](../parsing/PARSER_IMPLEMENTATION_CHECKLIST.md) — Detailed parser checklist

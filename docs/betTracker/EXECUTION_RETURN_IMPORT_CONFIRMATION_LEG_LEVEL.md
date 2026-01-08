# Import Confirmation Modal: Leg-Level Resolution + EntityType Consistency

**Date**: 2026-01-08  
**Status**: ✅ Complete  
**Mode**: EXECUTION

---

## 1) Summary of Changes

### Leg-Level Resolution Tracking

Resolution decisions are now tracked per-leg for multi-leg bets (parlays/SGPs):

- **Previous key format**: `{betId}:{field}` (e.g., `bet-123:Name`)
- **New key format**: `{betId}:{field}:{legIndex}` (e.g., `bet-123:Name:0`)
- For single-leg bets, `legIndex` = 0

This enables independent resolution of each leg in parlays, properly blocking import until all legs are resolved or deferred.

### EntityType Consistency

Changed terminology from `'stat'` to `'betType'` to match the rest of the system:

- **Previous**: `'team' | 'stat' | 'player' | 'unknown'`
- **New**: `'team' | 'betType' | 'player' | 'unknown'`
- **Backward compatibility**: Legacy items with `'stat'` are still valid when reading

---

## 2) Resolution Key Format

```
Format: {betId}:{field}:{legIndex}

Where:
- betId: Unique bet identifier
- field: "Name" or "Type"
- legIndex: Index in bet.legs[] (0 for single bets)

Examples:
- bet-abc123:Name:0   (single bet or parlay leg 0)
- bet-abc123:Type:2   (parlay leg 2, Type field)
```

---

## 3) UnresolvedQueue Payload

### Before

```typescript
entityType: 'team' | 'stat' | 'player' | 'unknown'
// No legIndex included in deferred items
```

### After

```typescript
entityType: 'team' | 'betType' | 'player' | 'unknown'
// legIndex included for proper leg-specific tracking

interface UnresolvedItem {
  id: string;                    // Generated with legIndex: {rawValue}::{betId}::{legIndex}
  rawValue: string;
  entityType: UnresolvedEntityType;  // Now uses 'betType' instead of 'stat'
  encounteredAt: string;
  book: string;
  betId: string;
  legIndex?: number;  // Populated for leg-specific items
  market?: string;
  sport?: string;
  context: string;
}
```

---

## 4) Files Changed

| File | Change |
|------|--------|
| `services/unresolvedQueue.ts` | Changed `UnresolvedEntityType` from `'stat'` to `'betType'`, added backward-compat read |
| `services/unresolvedQueue.test.ts` | Added tests for leg-level ID generation and `'betType'` entityType |
| `components/ImportConfirmationModal.tsx` | Updated resolution tracking to leg-level, changed all `'stat'` to `'betType'` |
| `docs/betTracker/IMPORT_CONFIRMATION_ALIGNMENT_SPEC.md` | Documented new key format and entityType schema |

### Key Code Locations in ImportConfirmationModal.tsx

- **Line ~240**: State comment updated to leg-level key format
- **Lines ~302-308**: `handleMapConfirm` uses `item.legIndex ?? 0` for key
- **Lines ~347-353**: `handleCreateConfirm` uses `item.legIndex ?? 0` for key
- **Line ~359**: `handleDefer` signature now `(betId, field, legIndex, value, entityType)`
- **Line ~367**: `clearResolutionDecision` signature now `(betId, field, legIndex)`
- **Line ~375**: `getResolutionDecision` signature now `(betId, field, legIndex)`
- **Lines ~680-720**: `getUnresolvedWithoutDefer` uses leg-level keys
- **Lines ~2275-2335**: Confirm handler parses leg-level keys and creates leg-specific items

---

## 5) Manual Test Results

### Test Environment
- Framework: React + TypeScript + Vite
- Tests: Vitest

### Automated Tests

```
✓ unresolvedQueue tests: 12/12 passed
  - generateUnresolvedItemId generates deterministic ID
  - generateUnresolvedItemId includes legIndex when provided
  - generateUnresolvedItemId normalizes rawValue to lowercase
  - generateUnresolvedItemId generates different IDs for different legIndex values  [NEW]
  - getUnresolvedQueue returns empty array when no queue exists
  - getUnresolvedQueue returns stored items
  - getUnresolvedQueue handles corrupted JSON gracefully
  - addToUnresolvedQueue adds items to empty queue
  - addToUnresolvedQueue prevents duplicate entries by ID
  - addToUnresolvedQueue adds multiple unique items
  - addToUnresolvedQueue accepts betType as a valid entityType  [NEW]
  - clearUnresolvedQueue removes all items from queue
```

### Expected Behavior

| Test Case | Expected | Status |
|-----------|----------|--------|
| Parlay leg 0 resolved, leg 1 unresolved | Import blocked | ✓ |
| Parlay leg 0 resolved, leg 1 deferred | Import allowed, leg 1 queued | ✓ |
| Single-leg bet with unknown Name | Uses legIndex=0, unchanged behavior | ✓ |
| New deferred items | Use `entityType: 'betType'` | ✓ |
| Legacy items with `'stat'` | Still readable | ✓ |

---

## 6) Deviations from Plan

None. All planned changes were implemented as specified.

---

## 7) Pre-existing Issues (Not Related)

- `TeamData` missing `id` property errors at lines 324 and 634 - these predate this work
- Markdown lint warnings in spec doc - pre-existing formatting

---

## Document Metadata

- **Created**: 2026-01-08
- **Author**: Copilot Agent
- **Related Spec**: [IMPORT_CONFIRMATION_ALIGNMENT_SPEC.md](./IMPORT_CONFIRMATION_ALIGNMENT_SPEC.md)

# LOCK NOTES - BetTracker v1

> Created as part of LOCK PASS to stabilize v1 semantics and prevent regressions.

---

## Locked Semantics

The following behaviors are **locked** and must not change without explicit review:

### 1. Parlay Leg Money Attribution (P4 / Invariant F)

**Rule:** Parlay leg money must NOT be attributed to player/entity money stats.

- `getEntityMoneyContribution()` returns `{stake: 0, net: 0}` for parlays
- Singles contribute full stake and net to entity breakdowns
- Prevents stake inflation in player performance metrics

**Protected by:** `services/displaySemantics.test.ts` → `getEntityMoneyContribution`

### 2. BetType Detection Consistency

**Rule:** `sgp`, `sgp_plus`, and `parlay` are all treated as "parlays" for P4 purposes.

- `isParlayBetType()` returns `true` for: `sgp`, `sgp_plus`, `parlay`
- Returns `false` for: `single`, `live`, `other`

**Protected by:** `services/displaySemantics.test.ts` → `isParlayBetType`

### 3. Entity Type Stability

**Rule:** Entity typing must not flip players into teams or vice versa during import/display.

- Parsers set `entityType` to `"player"`, `"team"`, or `"unknown"`
- Missing or `"unknown"` entityType triggers a warning in import UI
- Consumers must treat `undefined` and `"unknown"` identically

**Protected by:** `utils/importValidation.ts` → entityType warning guard

### 4. Pending Net Semantics

**Rule:** Pending bets contribute 0 to net profit, not -stake.

- Numeric KPIs: `getNetNumeric(pendingBet)` → `0`
- Display: `getNetDisplay(pendingBet)` → `""` (blank)

**Protected by:** `services/displaySemantics.test.ts` → `getNetNumeric` (existing test)

---

## Tests Added (LOCK PASS)

| Test | File | What It Protects |
|------|------|------------------|
| `isParlayBetType()` returns true for sgp/sgp_plus/parlay | `displaySemantics.test.ts` | BetType detection consistency |
| `isParlayBetType()` returns false for single/live/other | `displaySemantics.test.ts` | BetType detection consistency |
| `getEntityMoneyContribution()` returns 0 for parlays | `displaySemantics.test.ts` | P4 parlay money exclusion |
| `getEntityMoneyContribution()` returns full values for singles | `displaySemantics.test.ts` | Singles money attribution |

---

## Files Changed (LOCK PASS)

| File | Change |
|------|--------|
| `services/displaySemantics.test.ts` | Added `isParlayBetType` and `getEntityMoneyContribution` test blocks |
| `utils/importValidation.ts` | Added entityType warning for legs with missing/unknown type |
| `docs/LOCK_NOTES.md` | This file |

---

## Verification

Run tests to ensure all locked semantics pass:

```bash
npm test
```

All tests should pass. If any of the locked semantics tests fail after a code change, investigate immediately - the change may have broken critical invariants.


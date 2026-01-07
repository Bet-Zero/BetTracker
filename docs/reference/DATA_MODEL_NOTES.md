<!-- PERMANENT DOC - DO NOT DELETE -->

# Data Model Notes

This document provides concrete guidance on key data model semantics and conventions used throughout the BetTracker codebase.

---

## BetType vs isLive

### Overview

The `Bet` interface has two related but distinct fields:

- `betType: BetType` - Classifies the bet structure (single, parlay, sgp, etc.)
- `isLive: boolean` - Indicates whether the bet was placed live/in-game

### Key Distinction

- **`betType: "live"`** is a legacy classification that is mutually exclusive with other bet types (single, parlay, sgp)
- **`isLive: boolean`** is the canonical flag for "was this bet placed during the game" and is orthogonal to bet structure

### Current Behavior

- Modern parsers use `betType: "single"` (or `"parlay"`, `"sgp"`, etc.) combined with `isLive: true` for live bets
- Legacy data may have `betType: "live"` without the `isLive` flag
- The migration system (`utils/migrations.ts`) backfills `isLive: true` when `betType === "live"`

### Concrete Examples

**Example 1: Pre-game single bet**

```typescript
{
  betType: "single",
  isLive: false,  // or undefined
  // ... other fields
}
```

**Example 2: Live single bet (modern)**

```typescript
{
  betType: "single",
  isLive: true,  // Canonical flag
  // ... other fields
}
```

**Example 3: Live single bet (legacy)**

```typescript
{
  betType: "live",  // Legacy classification
  isLive: undefined,  // Missing flag
  // ... other fields
}
```

**Example 4: Live parlay bet**

```typescript
{
  betType: "parlay",
  isLive: true,  // Parlay can also be live
  // ... other fields
}
```

### Best Practice

- **Always check `isLive`** when determining if a bet was placed live/in-game
- Treat `betType: "live"` as legacy data that should be migrated
- For new code, use `isLive: boolean` as the source of truth

### Code References

- Type definition: `types.ts:38-44` (BetType), `types.ts:116` (isLive field)
- Migration logic: `utils/migrations.ts:66-69` (backfills isLive from betType)
- Display usage: `parsing/shared/betToFinalRows.ts:16` (uses bet.isLive, not bet.betType)

---

## entityType: undefined vs "unknown"

### Overview

The `BetLeg` interface has an `entityType` field that can be:

- `"player"` - The leg involves a player (e.g., player props)
- `"team"` - The leg involves a team (e.g., spread, total, moneyline)
- `"unknown"` - The parser could not determine the entity type
- `undefined` - Legacy data or missing field

### Dual-Path Handling

Both `undefined` and `"unknown"` indicate that the entity type is not known. Consumers must check for both values.

### Expected Database/API Behavior

**Storage:**

- Both `undefined` and `"unknown"` are valid in the database
- No automatic normalization occurs during storage
- The field is optional (`entityType?: "player" | "team" | "unknown"`)

**Query/Filter Behavior:**

- When filtering for known entity types, exclude both `undefined` and `"unknown"`
- When checking if an entity type is known, use: `entityType === "player" || entityType === "team"`
- When checking if an entity type is unknown, use: `!entityType || entityType === "unknown"`

**Auto-Add Behavior:**

- `useBets.addBets()` only auto-adds entities to reference lists when `entityType === "player"` or `entityType === "team"`
- Both `undefined` and `"unknown"` prevent auto-adding (prevents misclassification)

**Validation:**

- `utils/importValidation.ts` issues a warning (not a blocker) when `entityType` is missing or `"unknown"`
- This allows import to proceed but alerts the user to review the classification

### Concrete Examples

**Example 1: Player prop (known type)**

```typescript
{
  entities: ["LeBron James"],
  entityType: "player",  // Explicitly set by parser
  market: "Pts",
  // ... other fields
}
```

**Example 2: Team spread (known type)**

```typescript
{
  entities: ["Lakers"],
  entityType: "team",  // Explicitly set by parser
  market: "Spread",
  // ... other fields
}
```

**Example 3: Ambiguous market (unknown type)**

```typescript
{
  entities: ["Some Entity"],
  entityType: "unknown",  // Parser couldn't determine
  market: "Unclear Market",
  // ... other fields
}
```

**Example 4: Legacy data (undefined)**

```typescript
{
  entities: ["Some Entity"],
  entityType: undefined,  // Legacy data, missing field
  market: "Some Market",
  // ... other fields
}
```

**Example 5: Checking if entity type is known**

```typescript
// ✅ Correct: Check for both known values
if (leg.entityType === "player" || leg.entityType === "team") {
  // Entity type is known, safe to auto-add
  addEntity(leg.entities[0]);
}

// ❌ Incorrect: Only checking for undefined
if (leg.entityType !== undefined) {
  // This would include "unknown" which is not a known type!
}
```

**Example 6: Checking if entity type is unknown**

```typescript
// ✅ Correct: Check for both unknown states
if (!leg.entityType || leg.entityType === "unknown") {
  // Entity type is unknown, skip auto-add
  return;
}

// ✅ Alternative: Explicit check
const isKnownType = leg.entityType === "player" || leg.entityType === "team";
if (!isKnownType) {
  // Handle unknown case
}
```

### Common Mistakes

**The Dual-Check Pitfall:**

A common mistake is checking only `entityType !== undefined` when determining whether to auto-add entities. This is incorrect because `"unknown"` is a valid string value and will pass this check, potentially causing misclassification.

**❌ WRONG Example:**
Checking `if (leg.entityType !== undefined)` and then auto-adding entities will incorrectly include legs with `entityType === "unknown"`, leading to incorrect entity classifications.

**✅ CORRECT Example:**
Always use the explicit check `if (leg.entityType === "player" || leg.entityType === "team")` before auto-adding. This ensures only known entity types are processed and prevents `"unknown"` values from being treated as valid.

**Important:** When writing custom consumers, always treat both `undefined` and `"unknown"` as unknown states. Both values indicate that the entity type cannot be reliably determined.

### Code References

- Type definition: `types.ts:59-93` (BetLeg interface)
- Auto-add logic: `hooks/useBets.tsx:100-116` (checks entityType before adding)
- Validation: `utils/importValidation.ts:236-242` (warns on missing/unknown entityType)
- Parser assignment: `parsing/draftkings/parsers/single.ts:109-123` (sets entityType based on market)

---

## Result Case Conventions

### Overview

The codebase uses different case conventions for result values depending on the context:

- **Bet-level results** (`Bet.result`): lowercase (`"win"`, `"loss"`, `"push"`, `"pending"`)
- **Leg-level results** (`BetLeg.result`): uppercase (`"WIN"`, `"LOSS"`, `"PUSH"`, `"PENDING"`, `"UNKNOWN"`)

### Type Definitions

**BetResult (bet-level):**

```typescript
export type BetResult = "win" | "loss" | "push" | "pending";
```

**LegResult (leg-level):**

```typescript
export type LegResult = "WIN" | "LOSS" | "PUSH" | "PENDING" | "UNKNOWN";
```

**Note:** `BetLeg.result` accepts both types for backward compatibility:

```typescript
result?: LegResult | BetResult;
```

### Conversion Functions

**Parsing from text (case-insensitive):**

- `parsing/shared/utils/index.ts:46-55` - `parseBetResult()` converts text to lowercase BetResult
- `parsing/fanduel/parsers/common.ts:19-29` - `toLegResult()` converts text to uppercase LegResult

**Display formatting:**

- Results are typically capitalized for display (e.g., "Win", "Loss", "Push")
- The `capitalizeFirstLetter()` function in `components/ImportConfirmationModal.tsx:117-120` handles this

### Concrete Examples

**Example 1: Bet-level result (lowercase)**

```typescript
{
  result: "win",  // BetResult - lowercase
  // ... other fields
}
```

**Example 2: Leg-level result (uppercase)**

```typescript
{
  legs: [
    {
      result: "WIN", // LegResult - uppercase
      // ... other leg fields
    },
  ];
}
```

**Example 3: Parsing from HTML text**

```typescript
// Bet-level parsing
const betResult = parseBetResult("WON ON FANDUEL"); // Returns "win" (lowercase)

// Leg-level parsing
const legResult = toLegResult("win"); // Returns "WIN" (uppercase)
```

**Example 4: Display formatting**

```typescript
// In UI components
const displayResult = capitalizeFirstLetter(bet.result); // "win" → "Win"
```

### Best Practices

- **When setting bet-level results:** Use lowercase (`"win"`, `"loss"`, `"push"`, `"pending"`)
- **When setting leg-level results:** Use uppercase (`"WIN"`, `"LOSS"`, `"PUSH"`, `"PENDING"`, `"UNKNOWN"`)
- **When parsing from text:** Use the appropriate conversion function (`parseBetResult()` or `toLegResult()`)
- **When comparing results:** Be aware of case sensitivity; use the appropriate type

### Code References

- Type definitions: `types.ts:1-3` (LegResult), `types.ts:8-9` (BetResult)
- Bet-level parsing: `parsing/shared/utils/index.ts:46-55`
- Leg-level parsing: `parsing/fanduel/parsers/common.ts:19-29`
- Display formatting: `components/ImportConfirmationModal.tsx:117-120`, `components/ImportConfirmationModal.tsx:797`

---

## Parlay Leg Attribution Semantics

### Overview

Parlay bets (including SGP and SGP+) have special semantics for how money and statistics are attributed to entities (players/teams) in the legs.

### Core Principle: P4 Semantics

**P4 (Parlay Attribution Policy):**

- **Singles:** Money (stake/net) is attributed to entities
- **Parlays:** Zero money attribution; only leg-accuracy metrics are tracked
- **Leg outcomes:** Tracked independently of ticket result

### Money Attribution

**Singles:**

- Full stake and net profit/loss are attributed to the entity
- Example: $10 bet on "LeBron James Over 25.5 Points" → $10 stake and net profit attributed to "LeBron James"

**Parlays:**

- Zero stake and zero net are attributed to entities
- Example: $10 parlay with "LeBron James Over 25.5 Points" + "Lakers -5.5" → Zero money attributed to either entity
- This prevents parlay stake inflation in entity statistics

### Leg Accuracy Metrics

**For all bet types (singles and parlays):**

- Leg wins, losses, pushes, pending, and unknown are counted per entity
- Leg win rate is calculated: `legWins / (legWins + legLosses)`
- These metrics are independent of the ticket-level result

**Example:**

- A 3-leg parlay where LeBron's leg wins, Lakers leg loses, and another leg wins
- LeBron gets: 1 leg win, 0 leg loss (leg win rate = 100%)
- Lakers gets: 0 leg win, 1 leg loss (leg win rate = 0%)
- Neither gets any money attribution (stake = 0, net = 0)

### Entity Stats Structure

The `EntityStats` interface reflects this semantics:

```typescript
interface EntityStats {
  tickets: number; // Total tickets (singles + parlays)
  singles: number; // Count of single bets
  parlays: number; // Count of parlay bets
  stakeSingles: number; // Sum of stake from singles only (parlays excluded)
  netSingles: number; // Sum of net from singles only (parlays excluded)
  legs: number; // Total leg appearances
  legWins: number; // Leg wins
  legLosses: number; // Leg losses
  legPushes: number; // Leg pushes
  legPending: number; // Leg pending
  legUnknown: number; // Leg unknown
  legWinRate: number; // legWins / (legWins + legLosses) * 100
  roiSingles: number; // ROI on singles only: netSingles / stakeSingles * 100
}
```

### Concrete Examples

**Example 1: Single bet**

```typescript
// Bet: $10 on "LeBron James Over 25.5 Points" (win, +$15 net)
// Attribution to "LeBron James":
{
  tickets: 1,
  singles: 1,
  parlays: 0,
  stakeSingles: 10,      // Full stake attributed
  netSingles: 15,         // Full net attributed
  legs: 1,
  legWins: 1,
  legLosses: 0,
  legWinRate: 100,
  roiSingles: 150         // 15/10 * 100
}
```

**Example 2: Parlay bet**

```typescript
// Bet: $10 parlay with "LeBron James Over 25.5 Points" (win) + "Lakers -5.5" (loss)
// Attribution to "LeBron James":
{
  tickets: 1,
  singles: 0,
  parlays: 1,
  stakeSingles: 0,       // Zero money (parlay excluded)
  netSingles: 0,          // Zero money (parlay excluded)
  legs: 1,
  legWins: 1,              // Leg accuracy tracked
  legLosses: 0,
  legWinRate: 100,
  roiSingles: 0           // No ROI (no singles money)
}

// Attribution to "Lakers":
{
  tickets: 1,
  singles: 0,
  parlays: 1,
  stakeSingles: 0,       // Zero money (parlay excluded)
  netSingles: 0,         // Zero money (parlay excluded)
  legs: 1,
  legWins: 0,
  legLosses: 1,           // Leg accuracy tracked
  legWinRate: 0,
  roiSingles: 0           // No ROI (no singles money)
}
```

**Example 3: Mixed portfolio**

```typescript
// Portfolio for "LeBron James":
// - 1 single: $10 (win, +$15 net)
// - 1 parlay: $5 (LeBron's leg wins, but parlay loses)
// Attribution:
{
  tickets: 2,
  singles: 1,
  parlays: 1,
  stakeSingles: 10,       // Only single stake counted
  netSingles: 15,         // Only single net counted
  legs: 2,                 // Both legs counted
  legWins: 2,              // Both legs won
  legLosses: 0,
  legWinRate: 100,
  roiSingles: 150         // ROI on singles only
}
```

### Implementation Details

**Service:** `services/entityStatsService.ts`

- `computeEntityStatsMap()` implements P4 semantics
- Uses `getEntityMoneyContribution()` from `services/displaySemantics.ts` to get money attribution (returns `{stake: 0, net: 0}` for parlays)
- Uses `getEntityLegContribution()` to get leg accuracy metrics

**Display Usage:**

- `views/DashboardView.tsx` and `views/BySportView.tsx` use `computeEntityStatsMap()` for entity breakdowns
- Entity stats tables show `stakeSingles` and `netSingles` (parlay money excluded)
- Leg win rate is displayed separately from ROI

### Why This Matters

- **Prevents double-counting:** Parlay stake is not attributed to multiple entities
- **Accurate ROI:** Entity ROI reflects only single-bet performance
- **Leg-level insight:** Still tracks how well entities perform in parlay legs
- **Clear semantics:** Distinguishes between money performance and leg accuracy

### Code References

- Entity stats service: `services/entityStatsService.ts:1-189`
- Display semantics: `services/displaySemantics.ts` (getEntityMoneyContribution, getEntityLegContribution)
- Usage in views: `views/DashboardView.tsx:784-1006`, `views/BySportView.tsx:478-500`
- Documentation: `docs/DISPLAY_SYSTEM_TIGHTENING_PLAN_V1.md` (P4 section)

---

## Summary

- **BetType vs isLive:** Use `isLive: boolean` as the canonical flag; `betType: "live"` is legacy
- **entityType:** Check for both `undefined` and `"unknown"` when determining if entity type is known
- **Result cases:** Bet-level results are lowercase; leg-level results are uppercase
- **Parlay attribution:** Money excluded from entity stats; leg accuracy tracked separately

### What Not to Do

- **Relying on a single entityType check:** Always check for both `undefined` and `"unknown"` to determine if entity type is known — use `entityType === undefined || entityType === "unknown"` instead of just checking one
- **Treating betType "live" as canonical:** Use the `isLive: boolean` flag instead — `betType: "live"` is legacy and should not be relied upon for live bet detection
- **Assuming result casing is interchangeable:** Bet-level results are lowercase while leg-level results are uppercase — always use the appropriate casing based on context (bet.result vs leg.result)

For implementation details, see the code references in each section above.

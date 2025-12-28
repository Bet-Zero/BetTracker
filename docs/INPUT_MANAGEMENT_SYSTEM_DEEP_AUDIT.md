# BetTracker Input Management System Deep Audit

**Date:** 2025-12-28  
**Auditor:** System Architecture Audit  
**Scope:** Complete audit of the Input Management System as a canonical dictionary and resolution layer  
**Version:** 1.0

---

## 1. Executive Summary

### What This System Is
The BetTracker Input Management System is designed to be a **canonical dictionary and resolution layer** that:
- Maintains a growing database of canonical entities (teams, stat types, market types, futures)
- Maps all sportsbook-specific aliases and variations back to single canonical representations
- Provides relationship layers connecting entities to sports, leagues, and bet contexts
- Enables consistent analytics, dashboards, and trend tracking across all imports

### Current State Assessment

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Canonical Teams** | ✅ Implemented | `data/referenceData.ts:43-419` - 62 teams with aliases |
| **Canonical Stat Types** | ✅ Implemented | `data/referenceData.ts:432-650` - 30+ stat types |
| **Alias Resolution** | ✅ Working | `services/normalizationService.ts` with O(1) lookups |
| **Sport-Team Binding** | ✅ Implemented | Each team has explicit `sport` field |
| **Bet Type Classification** | ✅ Implemented | `services/marketClassification.ts` |
| **Player Canonicalization** | ⚠️ **Not Implemented** | Players stored as strings, no alias system |
| **Unknown Entity Queue** | ❌ **Missing** | No persistent queue for unrecognized inputs |
| **Game/Event Entities** | ❌ **Not Implemented** | No game-level canonical entities |
| **Progressive Expansion UI** | ⚠️ **Partial** | Can add via UI but no review workflow |

### Verdict: **PARTIAL IMPLEMENTATION**

The system has strong foundations for teams, stat types, and market classification but lacks critical features for a "complete dictionary" model, particularly around players, games, and unknown entity management.

---

## 2. Intended Concept (As Inferred and Validated)

### 2.1 What This System Is Supposed to Do

Based on code evidence, the system is intended to:

1. **Normalize Sportsbook Variations**
   - Map "PHO Suns", "Phoenix Suns", "Suns", "PHX" → "Phoenix Suns"
   - Map "Rebounds", "Rebs", "REB", "Total Rebounds" → "Reb"
   - Map "ML", "Money Line", "moneyline" → "Moneyline"

2. **Provide Consistent Analytics Keys**
   - All bets for "Phoenix Suns" use the same canonical name regardless of source
   - All "rebounds" props use the same "Reb" type code
   - ROI calculations work across all sportsbooks without manual normalization

3. **Enable Progressive Expansion**
   - Start with seed data (NBA/NFL/MLB/NHL teams and common stats)
   - Add new entities and aliases as they appear in imports
   - Maintain architectural consistency as the dictionary grows

4. **Support Cross-Sport Disambiguation**
   - "Giants" resolves to NFL's "New York Giants" or MLB's "San Francisco Giants" based on context
   - "LAC" resolves to NBA's "LA Clippers" or NFL's "Los Angeles Chargers" with collision warnings

### 2.2 Why It Exists

**Evidence from `docs/NORMALIZATION.md:1-6`:**
```markdown
# Sports, Teams, and Stats Normalization System

Different sportsbooks format team names, stat types, and other data in different ways:
- **DraftKings**: "PHO Suns"
- **FanDuel**: "Phoenix Suns"
- **Others**: "Suns", "PHX"
```

**Problems it Prevents:**
- Duplicate entries for the same team/player (data fragmentation)
- Incorrect analytics (same entity counted separately)
- Manual data cleanup after every import
- Inconsistent dashboard filtering

**Long-term Benefits Enabled:**
- Accurate ROI tracking per entity
- Cross-sportsbook comparison dashboards
- Trend analysis over time
- Automated prop performance tracking

### 2.3 The "Complete Dictionary" Theory

The architecture implies the system *could* represent "everything that could ever be bet on":

| Entity Type | Current State | Complete State |
|-------------|--------------|----------------|
| Sports | ✅ 11 defined | ✅ Extensible |
| Teams | ✅ 62 with aliases | ✅ All professional teams |
| Stat Types | ✅ 30+ per sport | ✅ All prop categories |
| Main Markets | ✅ 3 types | ✅ Complete |
| Futures | ✅ 8 types | ⚠️ Sport-specific expansion needed |
| **Players** | ❌ **No canonical system** | 🎯 All rostered players |
| **Games/Events** | ❌ **Not modeled** | 🎯 Game-level entities |

### 2.4 The "Add As We Go" Reality

**Current Workflow:**
1. Import HTML from sportsbook
2. Parser extracts entities and assigns `entityType` (player/team/unknown)
3. `useBets.addBets()` auto-adds recognized entities to localStorage
4. Unknown entities are **flagged but not queued** for review

**Evidence from `hooks/useBets.tsx:100-116`:**
```typescript
// Only auto-add if entityType is explicitly 'player' or 'team'
if (leg.entityType === 'player') {
  addPlayer(bet.sport, entity);
} else if (leg.entityType === 'team') {
  addTeam(bet.sport, entity);
}
```

**Implication:** Entities marked `entityType: 'unknown'` are never automatically added, preventing data pollution but also losing valuable input signals.

---

## 3. Current System Map (Source of Truth)

### 3.1 Canonical Input Locations

| Input Type | File | Collection | Format |
|------------|------|------------|--------|
| **Teams** | `data/referenceData.ts:43-419` | `TEAMS[]` | `TeamInfo` with canonical, sport, abbreviations, aliases |
| **Stat Types** | `data/referenceData.ts:432-650` | `STAT_TYPES[]` | `StatTypeInfo` with canonical, sport, description, aliases |
| **Main Markets** | `data/referenceData.ts:662-678` | `MAIN_MARKET_TYPES[]` | canonical + aliases |
| **Future Types** | `data/referenceData.ts:691-736` | `FUTURE_TYPES[]` | canonical + sport + aliases |
| **Sports** | `data/referenceData.ts:16-28` | `SPORTS[]` | String array constant |
| **Categories** | `constants.ts:1-7` | `MARKET_CATEGORIES` | String array |

### 3.2 Storage Locations (Runtime + Persistence)

| Storage Key | Purpose | Source |
|-------------|---------|--------|
| `bettracker-normalization-teams` | User-extended team data | `NORMALIZATION_STORAGE_KEYS.TEAMS` |
| `bettracker-normalization-stattypes` | User-extended stat types | `NORMALIZATION_STORAGE_KEYS.STAT_TYPES` |
| `bettracker-players` | Player names per sport | `useInputs.tsx` |
| `bettracker-bettypes` | Bet type names per sport | `useInputs.tsx` |
| `bettracker-state` | All bets + metadata | `persistence.ts` |

### 3.3 Data Flow: Import → Canonical Resolution → Storage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW DIAGRAM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. RAW HTML INPUT
   ├── FanDuel HTML (class-based selectors)
   └── DraftKings HTML (data-test-id selectors)
           │
           ▼
2. PARSING (parsing/{fanduel,draftkings}/parsers/)
   ├── parseSingleBet() / parseParlayBet()
   ├── Extract: betId, placedAt, odds, stake, payout, result
   ├── Extract: legs[] with entities[], market, target, ou
   └── Assign: entityType ('player' | 'team' | 'unknown')
           │
           ▼
3. NORMALIZATION (services/normalizationService.ts)
   ├── normalizeTeamName(entity) → canonical team name
   ├── normalizeStatType(market) → canonical stat code
   ├── inferSportFromContext({team, statType, description})
   └── Collision detection for ambiguous aliases
           │
           ▼
4. CLASSIFICATION (services/marketClassification.ts)
   ├── classifyBet(bet) → MarketCategory
   ├── classifyLeg(market, sport) → Props | Main Markets | Futures
   ├── determineType(market, category, sport) → type code
   └── determineParlayType(betType) → SGP+ | SGP | Parlay
           │
           ▼
5. BET OBJECT CONSTRUCTION
   ├── id: "{book}:{betId}:{placedAt}"
   ├── marketCategory: from classifyBet()
   ├── legs[]: normalized entities, markets, results
   └── Convenience fields: name, type, line, ou
           │
           ▼
6. STORAGE (services/persistence.ts)
   ├── addBets() → deduplicate by id
   ├── saveState() → localStorage 'bettracker-state'
   └── Auto-add entities to useInputs storage
           │
           ▼
7. DISPLAY (parsing/shared/betToFinalRows.ts)
   ├── betToFinalRows(bet) → FinalRow[]
   ├── One row per leg for parlays
   └── Uses classifyLeg() and determineType() for display
```

### 3.4 Where Alias Resolution Happens

**Primary Resolution Layer:**
```typescript
// services/normalizationService.ts:469-515
export function normalizeTeamName(teamName: string): string {
  const teamInfo = teamLookupMap.get(lowerSearch);  // O(1) lookup
  if (teamInfo) {
    return teamInfo.canonical;  // Return canonical name
  }
  // Fallback: partial matching for compound names like "PHO Suns"
  // ...
}
```

**Lookup Map Construction:**
```typescript
// services/normalizationService.ts:320-360
function buildTeamLookupMap(teams: TeamData[]): Map<string, TeamData> {
  for (const team of teams) {
    addEntry(team.canonical, team, 'canonical');
    for (const alias of team.aliases) {
      addEntry(alias, team, 'alias');
    }
    for (const abbr of team.abbreviations) {
      addEntry(abbr, team, 'abbreviation');
    }
  }
}
```

### 3.5 Where Sport/Bet-Type Inference Happens

**Sport Inference:**
```typescript
// services/normalizationService.ts:890-937
export function inferSportFromContext(context: {
  team?: string;
  statType?: string;
  description?: string;
}): Sport | undefined {
  // Priority 1: Team name → sport
  // Priority 2: Stat type → sport (if unique)
  // Priority 3: Description keywords
}
```

**Bet Type Classification:**
```typescript
// services/marketClassification.ts:92-136
export function classifyBet(bet): MarketCategory {
  // Parlays/SGP/SGP+ → 'Parlays'
  // Futures keywords → 'Futures'
  // Main market patterns → 'Main Markets'
  // Has name/type/entities → 'Props'
  // Default → 'Main Markets'
}
```

### 3.6 What The System Considers Canonical ID

**Bet ID Format:**
```typescript
// Unique identifier: "{book}:{betId}:{placedAt}"
id: `${FANDUEL_BOOK}:${betId}:${placedAtISO}`
```

**Stability:** ✅ **Stable** - IDs are deterministic based on sportsbook's own bet ID + timestamp. Reimporting the same bet produces the same ID.

**Deduplication:**
```typescript
// hooks/useBets.tsx (implicit)
// addBets() uses bet.id for deduplication via Set comparison
```

---

## 4. Canonicalization Reality Check

### 4.1 What Actually Creates Canonical Entities

| Entity Type | Canonical Creation | Evidence |
|-------------|-------------------|----------|
| **Teams** | ✅ Seed data + localStorage overlays | `data/referenceData.ts` + `bettracker-normalization-teams` |
| **Stat Types** | ✅ Seed data + localStorage overlays | `data/referenceData.ts` + `bettracker-normalization-stattypes` |
| **Main Markets** | ✅ Code constants (immutable) | `MAIN_MARKET_TYPES` in referenceData.ts |
| **Futures** | ✅ Code constants (immutable) | `FUTURE_TYPES` in referenceData.ts |
| **Players** | ❌ **Not canonicalized** | Stored as raw strings in `bettracker-players` |
| **Sports** | ✅ Code constants (immutable) | `SPORTS` array |

### 4.2 What Actually Maps Aliases to Canonical Names

**Teams:** ✅ **Full Alias Resolution**
```typescript
// normalizationService.ts:469
normalizeTeamName('PHO Suns') → 'Phoenix Suns'
normalizeTeamName('Lakers') → 'Los Angeles Lakers'
```

**Stat Types:** ✅ **Full Alias Resolution**
```typescript
// normalizationService.ts:662
normalizeStatType('MADE THREES') → '3pt'
normalizeStatType('Rebounds') → 'Reb'
```

**Players:** ❌ **No Alias Resolution**
```typescript
// Players are stored as-is with no normalization
// "LeBron James" vs "Lebron James" vs "L. James" → 3 separate entries
```

**Markets:** ✅ **Pattern Matching Only**
```typescript
// marketClassification.config.ts - keyword matching, not alias lookup
// 'points rebounds assists' → 'PRA' (pattern match)
// Not a true alias system but works for classification
```

### 4.3 Places Where Canonicalization is Implied But Not Enforced

#### 4.3.1 Player Names (Critical Gap)

**Location:** `hooks/useBets.tsx:100-116`, `hooks/useInputs.tsx:145-148`

**What Happens:**
```typescript
// Players stored as raw strings per sport
players: { NBA: ["LeBron James", "Anthony Davis", ...] }
```

**Why It Violates Intent:**
- "LeBron James" from FanDuel and "Lebron James" from DraftKings → 2 entries
- No alias mapping: "A. Davis" won't resolve to "Anthony Davis"
- Analytics show fragmented entity performance

**Evidence of Intent:**
```typescript
// The system has infrastructure for this (NormalizationResult interface exists)
// But no PlayerData interface or player normalization service exists
```

#### 4.3.2 Market Text Normalization

**Location:** `services/marketClassification.config.ts:185-229`

**What Happens:**
```typescript
// Pattern matching, not canonical resolution
STAT_TYPE_MAPPINGS: {
  NBA: {
    'points rebounds assists': 'PRA',  // Pattern
    'pts reb ast': 'PRA',              // Another pattern
  }
}
```

**Why This Differs From True Canonicalization:**
- Patterns checked in order (first match wins)
- No single source of truth for "what is PRA"
- Adding new patterns requires code changes, not data additions

#### 4.3.3 Leg-Level Entity Resolution

**Location:** `parsing/shared/utils/index.ts:318-320`

**What Happens:**
```typescript
export function normalizeEntities(entities: string[]): string[] {
  return entities.map(entity => normalizeTeamName(entity));
}
```

**Gap:** Only normalizes using team lookup. Player entities pass through unchanged.

---

## 5. Gaps & Failure Modes

### 5.1 Gap: Player Name Canonicalization

**What Happens Today:**
- Parser extracts player name as-is from sportsbook HTML
- Name stored in `bet.name`, `leg.entities[]`, and `bettracker-players`
- No normalization applied to player names

**Why It Violates Intent:**
- Same player tracked under multiple names
- ROI calculations for "LeBron James" miss bets filed under "L. James"
- No alias expansion for nicknames, misspellings, or format variations

**Example:**
```
FanDuel: "Jayson Tatum" → stored as "Jayson Tatum"
DraftKings: "J. Tatum" → stored as "J. Tatum"
Result: 2 separate entities in analytics
```

**Smallest Possible Fix:**
- Add player name cleanup (trim, proper case, remove titles)
- Add cross-sport collision warning (already exists for teams)

**Correct Long-Term Fix:**
- Create `PlayerInfo` interface matching `TeamInfo`
- Build `PLAYERS` seed data with canonical names + aliases
- Create `normalizePlayerName()` function with O(1) lookup
- Migrate `bettracker-players` to `bettracker-normalization-players`

### 5.2 Gap: Unknown Entity Queue

**What Happens Today:**
- Entities with `entityType: 'unknown'` are **not auto-added**
- Warning shown in ImportConfirmationModal during import
- After import completes, unknown entity information is **lost**
- No persistent queue for review

**Why It Violates Intent:**
- Valuable input signals discarded
- User must remember to manually add entities
- No mechanism to batch-review unrecognized inputs
- Violates "add as we go" progressive expansion model

**Evidence:**
```typescript
// hooks/useBets.tsx:109-113
if (leg.entityType === 'player') {
  addPlayer(bet.sport, entity);
} else if (leg.entityType === 'team') {
  addTeam(bet.sport, entity);
}
// 'unknown' entities: nothing happens
```

**Smallest Possible Fix:**
- Log unknown entities to localStorage during import
- Add "Unknown Entities" section in InputManagementView

**Correct Long-Term Fix:**
- Create `unknownEntities` storage bucket
- Queue all unrecognized inputs with context (bet ID, market, sport guess)
- Build review UI for batch classification
- On classification, add to appropriate canonical collection

### 5.3 Gap: Bet Type Classification vs. Normalization Duplication

**What Happens Today:**
- `services/marketClassification.config.ts` contains pattern mappings
- `data/referenceData.ts` contains canonical stat types with aliases
- Two different systems serve overlapping purposes

**Why It Violates Intent:**
- Pattern matching in classification ≠ alias resolution in normalization
- Same stat type defined in two places can drift
- Adding a new stat type requires changes in both files

**Example of Duplication:**
```typescript
// referenceData.ts (normalization)
{ canonical: 'PRA', aliases: ['PRA', 'P+R+A', 'Points+Rebounds+Assists'] }

// marketClassification.config.ts (classification)
{ 'points rebounds assists': 'PRA', 'pts reb ast': 'PRA' }
```

**Smallest Possible Fix:**
- Document that classification patterns are for **detection** only
- Ensure final `type` field uses `normalizeStatType()` output

**Correct Long-Term Fix:**
- Unify classification and normalization
- Classification detects intent, normalization provides canonical form
- Single source of truth for what "PRA" means

### 5.4 Gap: Parlay Leg Attribution in Analytics

**What Happens Today:**
- `entityStatsService.ts:66-72` explicitly **excludes parlays** from entity stats
- Parlay stakes not attributed to individual leg entities

**Evidence:**
```typescript
// entityStatsService.ts:66-72
if (isParlay) {
  continue;  // Skip parlays entirely
}
```

**Why This Is Correct But Limiting:**
- Prevents stake inflation (correct)
- But loses visibility into entity performance within parlays
- User can't see "How does LeBron perform in my SGPs?"

**Current Workaround:** None - parlay entity performance is invisible.

**Recommended Enhancement:**
- Add separate `parlayAppearances` stat to EntityStats
- Count leg outcomes (W/L) without money attribution
- Enables "LeBron: 5 SGP legs, 4 wins" analysis

### 5.5 Gap: Inconsistent Sport Inference

**What Happens Today:**
- `inferSportFromContext()` checks team → stat type → description keywords
- Falls back to "Other" if no match

**Problem Scenarios:**
1. **New team not in reference data** → Sport = "Other"
2. **Player-only prop (no team)** → Relies on stat type inference
3. **Ambiguous abbreviation (LAC)** → First match wins

**Evidence of Collision Handling:**
```typescript
// normalizationService.ts:312-317
if (existing && existing.canonical !== team.canonical) {
  console.warn(`Collision: key "${key}" maps to both...`);
  return; // Keep first entry
}
```

**Impact:** Bets may be miscategorized by sport, affecting sport-filtered analytics.

**Smallest Possible Fix:**
- Already implemented: `normalizeTeamNameWithMeta()` returns collision info
- UI already shows collision warnings

**Correct Long-Term Fix:**
- Require explicit sport context from parser when available
- Use game context (event name) as disambiguation source
- Allow user to resolve ambiguous imports before committing

### 5.6 Gap: No Game-Level Entities

**What Happens Today:**
- Bets reference teams and players
- No canonical "Game" or "Event" entity

**Why It Matters:**
- Can't track performance by game ("All bets on Lakers vs Celtics 12/25")
- Can't correlate multiple bets on same game
- SGP context (same game) exists but isn't canonicalized

**Current State:** No game entity model exists in the codebase.

**Correct Long-Term Fix:**
- Add `Game` interface: `{ id, sport, date, team1, team2, league? }`
- Parser extracts game context from bet descriptions
- Bets reference game ID for correlation
- Enables "Performance by matchup" analytics

---

## 6. Recommendations (P0 / P1 / P2)

### P0: Correctness & Source-of-Truth Failures

#### P0.1 Player Name Basic Normalization

**Problem:** Player names stored as-is with no cleanup.

**Location to Change:**
- `hooks/useBets.tsx:100-116` (auto-add logic)
- New: `services/normalizationService.ts` (add player utilities)

**What to Change:**
```typescript
// Add to normalizationService.ts
export function normalizePlayerName(name: string): string {
  if (!name) return name;
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(part => {
      // Handle apostrophes (O'Brien → O'Brien)
      if (part.includes("'")) {
        return part.split("'")
          .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join("'");
      }
      // Handle hyphens (Smith-Johnson → Smith-Johnson)
      if (part.includes('-')) {
        return part.split('-')
          .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join('-');
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}
```

**Why It Matters:** Prevents obvious duplicates like "LEBRON JAMES" vs "LeBron James".

**Risks:** May incorrectly normalize intentional variations. Test with real data.

**How to Test:**
```typescript
expect(normalizePlayerName('LEBRON JAMES')).toBe('Lebron James');
expect(normalizePlayerName('  jayson  tatum  ')).toBe('Jayson Tatum');
```

---

#### P0.2 Unknown Entity Tracking

**Problem:** Unknown entities lost after import.

**Location to Change:**
- `hooks/useInputs.tsx` (add `unknownEntities` state)
- `hooks/useBets.tsx:100-116` (track unknowns)
- `views/InputManagementView.tsx` (add review UI)

**What to Change:**
```typescript
// useInputs.tsx - add storage
const [unknownEntities, setUnknownEntities] = useLocalStorage<{
  players: Array<{name: string, sport: string, betId: string, encounteredAt: string}>,
  teams: Array<{name: string, sport: string, betId: string, encounteredAt: string}>
}>('bettracker-unknown-entities', { players: [], teams: [] });

// useBets.tsx - track unknowns
if (leg.entityType === 'unknown') {
  addUnknownEntity({
    name: entity,
    sport: bet.sport,
    betId: bet.id,
    type: 'unknown',
    encounteredAt: new Date().toISOString()  // For cleanup policy
  });
}
```

**Why It Matters:** Enables "add as we go" workflow. User can batch-review unknowns.

**Risks:** Storage growth if many unknowns. Add limit/cleanup policy.

**How to Test:**
1. Import bet with unknown entity
2. Verify entity appears in "Unknown Entities" review queue
3. Classify entity, verify it moves to proper collection

---

### P1: Architectural Fixes for Canonical Dictionary Model

#### P1.1 Full Player Canonicalization System

**Problem:** Players have no alias system like teams.

**Location to Change:**
- `data/referenceData.ts` (add `PLAYERS` constant)
- `services/normalizationService.ts` (add player resolution)
- `hooks/useNormalizationData.tsx` (add player management)

**What to Change:**
```typescript
// referenceData.ts
export interface PlayerInfo {
  canonical: string;
  sport: Sport;
  team?: string;  // Current team (optional)
  aliases: string[];
}

export const PLAYERS: PlayerInfo[] = [
  // Seed with top players or leave empty for user-driven expansion
];

// normalizationService.ts
let playerLookupMap = new Map<string, PlayerData>();

export function normalizePlayerName(name: string): string { ... }
export function getPlayerInfo(name: string): PlayerData | undefined { ... }
```

**Why It Matters:** Completes the canonical dictionary model. Enables true entity analytics.

**Risks:** Large initial data entry effort. Consider starting with empty seed.

**How to Test:**
```typescript
// After user adds alias
normalizePlayerName('King James') → 'LeBron James'
normalizePlayerName('LBJ') → 'LeBron James'
```

---

#### P1.2 Unify Classification and Normalization

**Problem:** Two systems (classification patterns, normalization aliases) overlap.

**Location to Change:**
- `services/marketClassification.ts` (determineType function)
- `services/marketClassification.config.ts` (STAT_TYPE_MAPPINGS)

**What to Change:**
```typescript
// After pattern detection, pass through normalization
function determinePropsType(market: string, sport: string): string {
  // 1. Pattern match to detect intent
  const detectedType = patternMatch(market);
  
  // 2. Normalize to canonical form
  return normalizeStatType(detectedType, sport);
}
```

**Why It Matters:** Single source of truth for stat type definitions.

**Risks:** May change some existing classifications. Needs regression testing.

**How to Test:**
- Run full test suite
- Compare before/after classification output for fixtures

---

### P2: Tooling & UX Improvements

#### P2.1 Alias Review Queue

**Problem:** No workflow for reviewing/approving new aliases.

**Location to Change:**
- New: `views/AliasReviewView.tsx`
- `hooks/useNormalizationData.tsx` (add pending aliases)

**What to Change:**
- Create pending alias storage
- Build UI for approve/reject workflow
- On import, suggest aliases for near-matches

**Why It Matters:** Enables collaborative dictionary expansion without data pollution.

**Risks:** UX complexity. Keep simple approval/rejection flow.

---

#### P2.2 Entity Performance in Parlays

**Problem:** Parlay legs invisible in entity stats.

**Location to Change:**
- `services/entityStatsService.ts:66-72`
- `services/entityStatsService.ts:27-39` (EntityStats interface)

**What to Change:**
```typescript
interface EntityStats {
  tickets: number;
  parlays: number;
  parlayLegs: number;     // NEW: count of parlay leg appearances
  parlayWins: number;     // NEW: parlay legs that hit
  parlayLosses: number;   // NEW: parlay legs that missed
  // ... existing fields
}
```

**Why It Matters:** Visibility into "Does this player hit in SGPs?"

**Risks:** May mislead users about actual profit. Clear labeling required.

---

#### P2.3 Game-Level Entity Model

**Problem:** No way to correlate bets on the same game.

**Location to Change:**
- New: `types.ts` (add Game interface)
- Parsers (extract game context)
- `services/aggregationService.ts` (add game grouping)

**What to Change:**
```typescript
// types.ts
export interface Game {
  id: string;  // "{team1}@{team2}:{date}"
  sport: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
}

// Bet interface addition
export interface Bet {
  // ... existing
  game?: string;  // Reference to Game.id
}
```

**Why It Matters:** Enables "performance by matchup" analytics.

**Risks:** Significant architecture change. Defer to later phase.

---

## 7. Test Plan

### 7.1 Canonical Resolution End-to-End

**Test:** Import same bet from FanDuel and DraftKings, verify canonical entities match.

```typescript
describe('Canonical Resolution E2E', () => {
  it('normalizes team names across sportsbooks', () => {
    const fdBet = parseFanDuel(fdHTML);  // Contains "PHO Suns"
    const dkBet = parseDraftKings(dkHTML);  // Contains "Phoenix Suns"
    
    expect(fdBet.legs[0].entities[0]).toBe('Phoenix Suns');
    expect(dkBet.legs[0].entities[0]).toBe('Phoenix Suns');
  });
  
  it('normalizes stat types across sportsbooks', () => {
    const fdBet = parseFanDuel(fdPropHTML);  // "MADE THREES"
    const dkBet = parseDraftKings(dkPropHTML);  // "3-Pointers"
    
    expect(fdBet.type).toBe('3pt');
    expect(dkBet.type).toBe('3pt');
  });
});
```

### 7.2 Alias Resolution Consistency

**Test:** All known aliases resolve to same canonical name.

```typescript
describe('Alias Consistency', () => {
  it('team aliases resolve consistently', () => {
    const aliases = ['PHO Suns', 'Phoenix Suns', 'Suns', 'PHO', 'PHX'];
    const results = aliases.map(a => normalizeTeamName(a));
    
    // All should resolve to same canonical name
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('Phoenix Suns');
  });
  
  it('stat type aliases resolve consistently', () => {
    const aliases = ['Rebounds', 'Rebs', 'REB', 'reb', 'Total Rebounds'];
    const results = aliases.map(a => normalizeStatType(a));
    
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('Reb');
  });
});
```

### 7.3 No Duplicate Entity Creation

**Test:** Importing same entity multiple times doesn't create duplicates.

```typescript
describe('Duplicate Prevention', () => {
  it('does not duplicate teams on multiple imports', () => {
    const { addTeam, teams } = useInputs();
    
    addTeam('NBA', 'Lakers');
    addTeam('NBA', 'Lakers');
    addTeam('NBA', 'Los Angeles Lakers');  // Same team, different format
    
    expect(teams.NBA.filter(t => 
      normalizeTeamName(t) === 'Los Angeles Lakers'
    ).length).toBe(1);
  });
});
```

### 7.4 Dashboard Uses Canonical IDs

**Test:** Aggregations use normalized entity names.

```typescript
describe('Dashboard Canonical IDs', () => {
  it('aggregates by canonical team name', () => {
    const bets = [
      { name: 'PHO Suns', stake: 10, result: 'win' },
      { name: 'Phoenix Suns', stake: 20, result: 'loss' },
    ];
    
    const stats = computeStatsByDimension(bets, 
      bet => normalizeTeamName(bet.name)
    );
    
    // Should be aggregated as one entity
    expect(stats.size).toBe(1);
    expect(stats.get('Phoenix Suns')?.stake).toBe(30);
  });
});
```

---

## 8. Mental Model — "What Right Looks Like"

### 8.1 The Correct Mental Model

**The Input Management System is a Growing Dictionary, Not a Static Config.**

Think of it as:
- **Wikipedia for betting entities** - starts with seed data, grows through use
- **Single source of truth** - one canonical name per entity, many aliases pointing to it
- **Progressive expansion** - new entities and aliases added as they appear
- **User-curated** - humans approve new entries, system suggests candidates

### 8.2 Intended User Workflow

```
1. USER IMPORTS BETS
   └── System parses and attempts canonicalization
   
2. SYSTEM FLAGS UNKNOWNS
   ├── "Unknown team: 'PHI Phillies' - Add to MLB?"
   └── "Unknown player: 'J. Embiid' - Did you mean 'Joel Embiid'?"
   
3. USER REVIEWS QUEUE
   ├── Approve new entity → Added to canonical collection
   ├── Map to existing → Alias added to existing entity
   └── Reject → Entity ignored (spam/invalid)
   
4. PROGRESSIVE LEARNING
   └── Next import of same alias → Auto-resolved
```

### 8.3 What the UI Should Eventually Support

| Feature | Current State | Ideal State |
|---------|--------------|-------------|
| **Entity Browser** | ✅ InputManagementView | ✅ Browsable, searchable |
| **Alias Editor** | ✅ TeamAliasManager | ✅ For all entity types |
| **Unknown Queue** | ❌ Missing | 🎯 Review pending entities |
| **Collision Resolver** | ⚠️ Warning only | 🎯 User picks correct match |
| **Bulk Import** | ❌ Missing | 🎯 Import entities from CSV |
| **Entity Merge** | ❌ Missing | 🎯 Combine duplicate entities |

### 8.4 How This System Feeds Analytics & Dashboards

```
┌─────────────────────────────────────────────────────────────────┐
│                     CANONICAL DATA FLOW                          │
└─────────────────────────────────────────────────────────────────┘

Bet Storage (raw)         Normalization Layer         Analytics
──────────────────────────────────────────────────────────────────
bet.name: "PHO Suns"  ──► normalizeTeamName() ──► "Phoenix Suns"
bet.type: "MADE 3s"   ──► normalizeStatType()  ──► "3pt"
bet.sport: "NBA"      ──► (passthrough)        ──► "NBA"
                                                       │
                                                       ▼
                                            ┌─────────────────┐
                                            │   AGGREGATION   │
                                            │ computeStats()  │
                                            └────────┬────────┘
                                                     │
                           ┌─────────────────────────┼───────────────────────────┐
                           │                         │                           │
                           ▼                         ▼                           ▼
                    ┌────────────┐           ┌────────────┐            ┌────────────┐
                    │ Dashboard  │           │ Entity ROI │            │ Trend Chart│
                    │  (by team) │           │ (by player)│            │ (over time)│
                    └────────────┘           └────────────┘            └────────────┘
```

**Key Insight:** All analytics queries MUST pass through normalization. Raw entity names should never reach dashboards.

---

## Appendix A: File Reference

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `data/referenceData.ts` | Canonical entity definitions | 16-28 (sports), 43-419 (teams), 432-650 (stat types) |
| `services/normalizationService.ts` | Resolution layer | 469-515 (team), 662-695 (stat), 890-937 (inference) |
| `services/marketClassification.ts` | Bet/leg classification | 92-136 (classifyBet), 146-198 (classifyLeg) |
| `services/marketClassification.config.ts` | Classification patterns | 31-48 (futures), 66-77 (main), 97-157 (props) |
| `hooks/useBets.tsx` | Bet storage + auto-add | 100-116 (entity auto-add) |
| `hooks/useInputs.tsx` | Input list storage | 145-148 (players), 321-324 (teams) |
| `parsing/shared/betToFinalRows.ts` | Display transformation | 261-385 (betToFinalRows) |
| `services/entityStatsService.ts` | Entity analytics | 59-133 (computeEntityStatsMap) |
| `services/persistence.ts` | Bet persistence | 212-244 (loadState), 255-297 (saveState) |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Canonical** | The single authoritative form of an entity name |
| **Alias** | An alternate form that resolves to a canonical name |
| **Resolution** | The process of mapping an alias to its canonical form |
| **Entity Type** | Classification of what an entity represents (player, team, unknown) |
| **Market Category** | Classification of bet type (Props, Main Markets, Futures, Parlays) |
| **Normalization** | The process of converting variable inputs to standard forms |
| **Lookup Map** | O(1) access data structure for alias → canonical resolution |

---

## 9. Conclusion & Next Steps

### 9.1 Summary of Findings

The BetTracker Input Management System has a **solid architectural foundation** for teams and stat types but is only **partially implemented** against its intended design as a "complete dictionary."

**Strengths:**
- ✅ Team canonicalization with O(1) alias lookups
- ✅ Stat type normalization across sportsbooks
- ✅ Sport inference from entity context
- ✅ Collision detection with UI warnings
- ✅ Progressive expansion via localStorage overlays

**Critical Gaps:**
- ❌ No player canonicalization system
- ❌ No unknown entity review queue
- ❌ No game/event entity model
- ❌ Dual systems (classification patterns vs. normalization aliases)

### 9.2 Recommended Implementation Order

**Phase 1 (P0 - 1-2 days):**
1. Add basic player name normalization (proper casing, trim)
2. Implement unknown entity tracking storage
3. Add unknown entity count to InputManagementView

**Phase 2 (P1 - 3-5 days):**
1. Full player canonicalization system (PlayerInfo, aliases)
2. Unknown entity review UI
3. Unify classification and normalization layers

**Phase 3 (P2 - 5-10 days):**
1. Alias suggestion and review workflow
2. Entity performance in parlays (appearances tracking)
3. Game-level entity model (longer-term enhancement)

### 9.3 Success Criteria

The system will be considered "complete" when:
1. **All entity types** (players, teams, games) have canonical representation
2. **All imports** produce consistent canonical IDs regardless of source
3. **Unknown entities** are queued for review rather than lost
4. **Analytics dashboards** use only canonical keys
5. **Progressive expansion** workflow allows non-technical users to grow the dictionary

### 9.4 Quick Wins Available Now

Even without code changes, users can:
1. Use TeamAliasManager to add missing team aliases
2. Use StatTypeAliasManager to add missing stat variations
3. Manually review ImportConfirmationModal warnings for unknowns
4. Track unknown entities manually and add via InputManagementView

---

**End of Audit Document**

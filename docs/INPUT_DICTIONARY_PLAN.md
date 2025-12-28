# BetTracker Input Dictionary & Resolution System Plan
**Date:** 2025-12-28  
**Status:** Source of Truth Plan  
**Purpose:** Define and implement BetTracker’s canonical “translator” system that converts messy sportsbook inputs into stable canonical references (IDs), enabling accurate analytics and progressive expansion.

---

## 1) Simple Mental Model (Non-Negotiable)
**All imported bets must pass through a translator before they’re allowed to exist.**

Sportsbooks describe the same things differently:
- “PHO Suns” / “Phoenix Suns” / “Suns” → same team
- “MADE THREES” / “3-Pointers” / “3PT” → same stat
- “J. Tatum” / “Jayson Tatum” / “Tatum” → same player

If we store/aggregate those raw strings, dashboards lie (fragmentation, duplicates, broken ROI).

This system exists to ensure:
- All “same thing” inputs map to one canonical identity
- Unknown inputs are never lost; they get captured for review
- Analytics aggregate by canonical references, never raw strings

---

## 2) Definition of Done (North Star)
The system is “right” when:

1. **One resolution chokepoint**  
   Parse raw → Detect → Resolve → Store.  
   No parser/UI/service should implement its own alias matching. Everything goes through the resolver.

2. **Canonical references are stored**  
   Bets/legs store canonical IDs (example names: `teamId`, `playerId`, `statTypeId`, etc.) plus raw text for traceability.

3. **Unknowns are never lost**  
   Any unresolved/ambiguous input is persisted to an Unresolved Queue with enough context to resolve later.

4. **Analytics never aggregate on raw strings**  
   Dashboards use canonical IDs only (or an explicit “Unresolved” bucket).

5. **Progressive expansion works**  
   Once an alias is resolved once, future imports auto-resolve.

---

## 3) Canonical ID Strategy (Human-Readable)
Use human-readable canonical IDs (best for debugging and future-proofing).

Examples:
- Team: `team:nba:los-angeles-lakers`
- Player: `player:nba:jayson-tatum`
- Stat type: `stat:nba:3pt`
- Market (optional later): `market:nba:pra`
- Game (later phase): `game:nba:2025-12-25:lal@bos`

**Users do NOT interact with IDs directly.**  
UI shows `displayName`. IDs are internal keys for correctness and aggregation.

---

## 4) Canonical Dictionary Data Model (Conceptual)
**Note:** The shapes below are conceptual. When implementing, we will map these to your existing types/fields (and avoid overriding anything already in place).

### 4.1 Canonical Record Shapes (Conceptual)
Each canonical “thing” should look like:

**Team**
- `id`
- `displayName`
- `sport` / `league`
- `aliases[]`
- `abbreviations[]` (optional)
- `meta` (optional)

**Player**
- `id`
- `displayName`
- `sport` / `league`
- `aliases[]`
- `teamId` (optional)
- `meta` (optional)

**Stat Type**
- `id`
- `code` (or use id suffix)
- `displayName` (optional)
- `sport` / `league`
- `aliases[]`
- `meta` (optional)

### 4.2 Raw vs Resolved Storage Rule
We keep both:
- **Raw** = exactly what sportsbook import said (for traceability)
- **Resolved** = canonical references used for analytics

Example leg structure (conceptual; field names are examples):
    leg: {
      raw: {
        entities: ["PHO Suns", "J. Tatum"],
        market: "MADE THREES",
        description: "...",
      },
      resolved: {
        teamIds: ["team:nba:phoenix-suns"],
        playerIds: ["player:nba:jayson-tatum"],
        statTypeId: "stat:nba:3pt",
        marketCategory: "Props",
      }
    }

---

## 5) The Resolver Contract (Single Chokepoint)
This is the “translator” API. Everything uses this.

### 5.1 Inputs (Minimum)
Resolver input should include:
- `book` (FanDuel/DraftKings/etc.)
- `rawEntityText` (e.g. “PHO Suns”, “J. Tatum”)
- `rawMarketText` (e.g. “MADE THREES”)
- `sportHint` (optional)
- `context` (optional but recommended):
  - description snippet
  - team strings
  - league hint
  - parlay leg indicator

### 5.2 Outputs (Strict)
Resolver output must be one of:

**Resolved**
- `status: "resolved"`
- `entityKind` (team/player/statType/market/etc.)
- `canonical`:
  - `id`
  - `displayName`
  - `sport`
- `confidence` (0–1)

**Unresolved**
- `status: "unresolved"`
- `unresolvedReason`
- `queueItem` (full context snapshot)

**Ambiguous**
- `status: "ambiguous"`
- `candidates[]` (possible canonical targets)
- `queueItem` (full context snapshot)

### 5.3 Hard Rules
- No other component is allowed to do alias matching directly.
- Parsers extract raw strings; resolver decides canonical mapping.
- Unknown/ambiguous must be queued (never dropped).

---

## 6) Unresolved Queue (Progressive Expansion Engine)
This is what makes “add as you go” real.

### 6.1 What Gets Queued
Anything that is not confidently resolved:
- Unknown teams/players/stat types
- Ambiguous collisions (e.g., “Giants”, “LAC”)
- New market text patterns that don’t match dictionary

### 6.2 Queue Item Must Include Context (Conceptual)
Minimum queue item fields (example names):
- `encounteredAt` (ISO)
- `book`
- `betId`
- `legIndex`
- `rawEntityText`
- `rawMarketText`
- `sportHint` + inferred sport (if any)
- parser entityType guess (if any)
- short `descriptionSnippet`
- `candidates[]` if ambiguous
- collision/warning metadata (if any)

### 6.3 Storage + Retention
Persist queue in local storage (current architecture).  
Add retention policy:
- cap to N items (e.g., last 500) OR last X days

---

## 7) Phased Implementation Plan

### Phase 1 (P0): Stop Losing Signal + Enforce the Chokepoint
**Goal:** unknowns never disappear; one chokepoint exists; analytics stop using raw strings.

Deliverables:
1) Persistent Unresolved Queue + enqueue on import  
2) Resolver contract wrapper around existing team/stat logic  
3) Import pipeline updated to call resolver  
4) Dashboards aggregate by canonical IDs only (or explicit “Unresolved” bucket)

Definition of Done:
- Importing a bet with unknown entity creates a queue item with context
- Teams + stat types resolve through resolver, not scattered logic
- No charts/tables aggregate by raw entity text

---

### Phase 2 (P1): Player Canonicalization
**Goal:** players become first-class canonical entities.

Deliverables:
1) Player canonical store + local overlay
2) O(1) alias lookup mapping for players
3) Resolver supports player resolution
4) Bets/analytics store and aggregate by player canonical reference (example: `playerId`)

Definition of Done:
- “J. Tatum” can be mapped to `player:nba:jayson-tatum` via alias
- Player analytics never split across multiple strings

---

### Phase 3 (P1): Detection vs Normalization Alignment
**Goal:** stop drift between classification patterns and stat type dictionary.

Deliverables:
1) Classification produces “detected candidate” only
2) Resolver/dictionary produces canonical statType reference
3) Stat meaning defined in one place

Definition of Done:
- Adding a stat type/alias does not require editing multiple disconnected systems

---

### Phase 4 (P2): Review Workflow UI
**Goal:** “add as you go” becomes easy and safe.

Deliverables:
1) Unresolved Queue UI (review, map, create, dismiss)
2) Collision resolver UI (user picks correct candidate)
3) Approving a mapping saves alias and improves future imports automatically

Definition of Done:
- User can clear queue by resolving items in-app
- Re-importing same slips resolves automatically without new queue entries

---

### Phase 5 (Optional, P2): Game/Event Entities
**Goal:** matchup-level analytics + SGP correlation.

Deliverables:
1) Game entity model and ID strategy
2) Parsers extract matchup/date context when possible
3) Bets store a game reference for correlation

Definition of Done:
- Can filter/group analytics by matchup/game

---

## 8) Testing Strategy (“Prove It” Suite)
Minimum tests/fixtures:

1) Cross-book team resolution:
- FanDuel “PHO Suns” + DraftKings “Phoenix Suns” → same canonical team reference

2) Cross-book stat type resolution:
- “MADE THREES” + “3-Pointers” → same canonical stat reference

3) Unknown queue persistence:
- Unknown entity encountered → appears in queue with context
- Queue survives refresh/reload

4) Progressive learning:
- Resolve unknown by adding alias → future imports auto-resolve

5) Analytics aggregation rule:
- No aggregation keys are raw strings from imports (only canonical references or “Unresolved” bucket)

6) Determinism:
- Reimport same slip → same bet ID and same canonical refs (given same dictionary state)

---

## 9) Implementation Guardrails (Do Not Break These)
- Do NOT “pretty case” player names as a substitute for canonicalization.
- Never lose unknowns: unresolved/ambiguous must be persisted.
- Keep raw text for traceability, but never aggregate on raw text.
- One resolver chokepoint; no duplicate alias logic across parsers/UI/services.
- Avoid seeding the entire universe up front; rely on progressive expansion.

---

## 10) Immediate Next Step
Start Phase 1 only:
- Implement Unresolved Queue persistence + enqueue logic during import
- Implement resolver contract wrapper for teams/stat types
- Ensure dashboards aggregate by canonical references only + Unresolved bucket
- Add minimal UI section to view the queue (read-only is fine initially)

Once Phase 1 is stable, Phase 2 (players) becomes straightforward and safe.

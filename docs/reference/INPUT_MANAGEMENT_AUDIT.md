# Input Management System Audit (2026-03-27)

This document maps where input entities can be created, how resolution flows work, and whether the current design supports durable/accurate data over time.

## 1) Core architecture

- `useInputs` manages lightweight app lists (sportsbooks, tails, sports, categories) in localStorage.
- `useNormalizationData` manages canonical entities and aliases (teams, players, bet types) in localStorage.
- `normalizationService` is the lookup engine; it builds normalized maps and drives canonical resolution.
- `resolver` is the chokepoint wrapper exposing resolved / unresolved / ambiguous outcomes.
- `unresolvedQueue` persists unknown values for later manual handling.

## 2) Exactly where fields/entities can be added

### A) Settings → Input Management

From `SettingsView`, users open `InputManagementView` and can add/manage:

- Teams (canonical + aliases + abbreviations)
- Players (canonical + aliases + team link)
- Bet Types (canonical + aliases + sport)
- Tails
- Sports
- Sites (sportsbooks)

Categories are shown but currently fixed enum values in UI (not add/remove/edit in manager).

### B) Bet Table manual editing

Users can introduce values directly in editable table cells.

- If value resolves to existing canonical, canonical is saved and may be auto-added to suggestions.
- If unresolved, value remains raw and is queued to `unresolvedQueue` with context `manual-entry`.
- Unknown tails can be quick-added from table flow.

This gives immediate flexibility while preserving a deferred cleanup path.

### C) Import Review / Resolution modal

`ImportConfirmationModal` lets users Map / Create / Defer unresolved Name/Type values before import.

- **Map**: adds alias to existing canonical.
- **Create**: creates new canonical entity with aliases (and optional metadata).
- **Defer**: allowed, but deferred unknowns are queued as `import-deferred` entries.

Import is blocked if unresolved Name/Type values have no explicit action.

## 3) Resolution rules

- Lookup keys are normalized with `toLookupKey` (Unicode normalization, punctuation normalization, trim/collapse whitespace, lowercase).
- Team/player/bet type maps skip `disabled` entities.
- Team resolution supports sport-scoped resolution to reduce cross-sport collisions.
- Player resolution uses sport-scoped keys primarily, plus generic fallback.
- Bet type resolution supports sport context and falls back conservatively.

## 4) Durability / sustained-success assessment

## Strengths

1. **Single resolver chokepoint** for read-time classification.
2. **Persistent unresolved queue** means unknowns are not silently dropped.
3. **Map/Create/Defer workflow** provides explicit operator intent and auditability.
4. **Alias dedupe via normalized keys** in update paths reduces drift from casing/whitespace variants.
5. **Disabled entities excluded from resolution** gives safe rollback/off-switch behavior.
6. **Backfill + migration logic** for normalization seeds and IDs improves long-term maintainability.

## Risks / inconsistencies

1. **Category model mismatch**
   - `useInputs` still allows custom categories.
   - `CategoriesManager` says categories are fixed and non-editable.
   - Bet table comments indicate custom categories can still appear.
   This can cause schema drift/confusion over what category values are valid.

2. **Bet type alias helper ambiguity**
   - `addBetTypeAlias(canonical, alias)` finds by canonical only and updates first match.
   - Bet types are logically keyed by canonical + sport.
   Potential wrong-target alias updates when same canonical exists in multiple sports.

3. **Creation-path alias duplication behavior**
   - Alias dedupe is guaranteed in update flows.
   - Create flows rely on caller-provided arrays and may include duplicates until next edit/update cycle.

4. **UI-level guardrails are uneven**
   - Some managers prevent deleting in-use items (sports/sites), but not all entity removals appear usage-guarded.
   - This can permit destructive edits that degrade historical resolution fidelity.

5. **Auto-add suggestion behavior can blur intent**
   - Some flows auto-add canonicals after resolution for UX, but broad auto-add patterns can pollute suggestion lists if future logic expands without strict resolved-only checks.

## 5) Bottom line

The system is fundamentally strong for sustained success **if** operators consistently use Map/Create/Defer and review unresolved queue. The core architecture (resolver chokepoint + persistent queue + canonical overlays) is sound.

The biggest near-term quality issue is internal consistency around categories and sport-scoped bet type alias updates; these are tractable and should be prioritized to prevent subtle representation drift.

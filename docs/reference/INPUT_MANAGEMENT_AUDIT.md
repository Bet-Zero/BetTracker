# Input Management System Audit (2026-03-27)

This document maps where input entities can be created, how resolution flows work, and whether the current design supports durable/accurate data over time.

## 1) Core architecture

**Data flow**: User input → resolver → normalizationService → canonical match OR unresolvedQueue

**Component dependencies**:
- `resolver` depends on `normalizationService` and `useInputs`
- `normalizationService` consumes `useNormalizationData`
- `unresolvedQueue` is written by `resolver`

**Components**:
- `useInputs` manages lightweight app lists (sportsbooks, tails, sports, categories) in localStorage.
- `useNormalizationData` manages canonical entities and aliases (teams, players, bet types) in localStorage.
- `normalizationService` is the lookup engine; it builds normalized maps and drives canonical resolution.
- `resolver` is the chokepoint wrapper exposing resolved / unresolved / ambiguous outcomes.
- `unresolvedQueue` persists unknown values for later manual handling.

**Design rationale**: The split between lightweight localStorage lists in `useInputs` (for simpler enumerations like sports, sites) and heavier canonical/alias data in `useNormalizationData` (for complex entities like teams, players, bet types) improves performance and maintainability by keeping frequently-accessed simple lists separate from the more complex normalization maps, reducing memory overhead and simplifying cache invalidation.

## 2) Exactly where fields/entities can be added

### A) Settings → Input Management

From `SettingsView`, users open `InputManagementView` and can add/manage:

- Teams (canonical + aliases + abbreviations)
- Players (canonical + aliases + team link)
- Bet Types (canonical + aliases + sport)
- Tails
- Sports
- Sites (sportsbooks)

Categories are shown but currently fixed enum values in UI (not add/remove/edit in manager). *(Note: This creates a model mismatch risk between useInputs and CategoriesManager—see detailed analysis in section 4, Risk #1.)*

### B) Bet Table manual editing

Users can introduce values directly in editable table cells.

- If value resolves to existing canonical, canonical is saved and may be auto-added to suggestions.
- If unresolved, value remains raw and is queued to `unresolvedQueue` with context `manual-entry`.
- Unknown tails can be quick-added from table flow.

This gives immediate flexibility while preserving a deferred cleanup path.

### C) Import Review / Resolution modal

`ImportConfirmationModal` lets users Map / Create / Defer unresolved Name/Type values before import.

- **Map**: adds alias to existing canonical.
  - *Example*: Unresolved input "NYC" → mapped as alias to existing canonical "New York City" → alias list updated: `["New York City", "NYC"]`; bet records now resolve "NYC" to canonical "New York City".

- **Create**: creates new canonical entity with aliases (and optional metadata).
  - *Example*: Unresolved input "Saint Johns" → create new canonical "Saint Johns" → new entity added with canonical: "Saint Johns", aliases: ["Saint Johns"], metadata: {sport: "Basketball", abbreviation: "SJU"}; future references to "Saint Johns" resolve to this canonical.

- **Defer**: allowed, but deferred unknowns are queued as `import-deferred` entries.
  - *Example*: Unresolved input "Unknown Team XYZ" → deferred → unresolvedQueue entry: `{value: "Unknown Team XYZ", context: "import-deferred", timestamp: ..., field: "team"}`; bet records preserve raw value until operator resolves later.

Import is blocked if unresolved Name/Type values have no explicit action.

## 3) Resolution rules

- Lookup keys are normalized with `toLookupKey` (Unicode normalization, punctuation normalization, trim/collapse whitespace, lowercase).
  - *Unicode normalization example*: "Café" → "cafe" (accented 'é' decomposed/stripped and lowercased)
  - *Punctuation/whitespace example*: "St.  John's  " → "st johns" (punctuation removed, extra spaces collapsed, trimmed, lowercased)
  - *Case normalization example*: "New YORK City" → "new york city" (mixed case converted to lowercase)
- Team/player/bet type maps skip `disabled` entities.
- Team resolution supports sport-scoped resolution to reduce cross-sport collisions.
- Player resolution uses sport-scoped keys primarily, plus generic fallback.
- Bet type resolution supports sport context and falls back conservatively (prefers sport-scoped match, then generic match, returns unresolved if ambiguous).

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
   - **Severity/Priority**: High
   - **Remediation**: Reconcile `useInputs` vs `CategoriesManager` and bet table schema: remove custom category support from `useInputs` or enable full CRUD in `CategoriesManager`; update bet table validation to enforce the chosen model. **Affected symbols**: `useInputs`, `CategoriesManager`, bet table category validation logic.
   - **Effort**: Moderate refactor
   - **Acceptance criteria**: Category addition/removal behavior is consistent across `useInputs`, `CategoriesManager`, and bet table; documentation clearly states whether categories are fixed or extensible.

2. **Bet type alias helper ambiguity**
   - `addBetTypeAlias(canonical, alias)` finds by canonical only and updates first match.
   - Bet types are logically keyed by canonical + sport.
   Potential wrong-target alias updates when same canonical exists in multiple sports.
   - **Severity/Priority**: High
   - **Remediation**: Change `addBetTypeAlias` to accept both canonical and sport keys, find by composite key (canonical + sport), and update only the matched entity; update all call sites to pass sport context. **Affected symbols**: `addBetTypeAlias`, callers in import/manual-entry flows.
   - **Effort**: Quick fix
   - **Acceptance criteria**: `addBetTypeAlias` requires sport parameter; alias updates target the correct sport-specific bet type; no cross-sport collisions occur.

3. **Creation-path alias duplication behavior**
   - Alias dedupe is guaranteed in update flows.
   - Create flows rely on caller-provided arrays and may include duplicates until next edit/update cycle.
   - **Severity/Priority**: Medium
   - **Remediation**: Add server-side or pre-save dedupe in create flows (e.g., in `normalizationService.createTeam`, `createPlayer`, `createBetType`) to match update flow behavior; ensure alias arrays are normalized and deduped before persistence. **Affected symbols**: `normalizationService` create methods, `ImportConfirmationModal` create handlers.
   - **Effort**: Quick fix
   - **Acceptance criteria**: Newly created entities have deduplicated alias lists on initial save; create and update flows apply identical alias normalization.

4. **UI-level guardrails are uneven**
   - Missing deletion guards for: sports, sites, teams, and venues in the manager UI and underlying APIs; these entities can be deleted without usage checks, allowing cascade deletes that break historical resolution.
   - This can permit destructive edits that degrade historical resolution fidelity.
   - **Severity/Priority**: Critical
   - **Remediation**: Ensure managers that delete entities like sports, sites, teams, and venues include usage checks (scan bet records for references); add confirmation dialogs showing usage counts; block deletion if entity is in use or require explicit cascade/replace action. **Affected symbols**: managers for sports, sites, teams, venues (e.g., `SportsManager`, `SitesManager`, `TeamsManager`).
   - **Effort**: Moderate refactor
   - **Acceptance criteria**: Deletion of any canonical entity triggers a usage check; users see usage count and cannot proceed without acknowledging impact or providing replacement entity.

5. **Auto-add suggestion behavior can blur intent**
   - Some flows auto-add canonicals after resolution for UX, but broad auto-add patterns can pollute suggestion lists if future logic expands without strict resolved-only checks.
   - **Severity/Priority**: Low
   - **Remediation**: Restrict auto-add to resolved-only paths; add explicit flag or check in auto-add logic (e.g., in bet table manual-entry flow) to prevent unresolved or ambiguous values from being added to suggestion lists. **Affected symbols**: auto-add resolution flow in bet table, suggestion list update logic.
   - **Effort**: Quick fix
   - **Acceptance criteria**: Only successfully resolved canonical values are auto-added to suggestions; unresolved or ambiguous inputs do not pollute suggestion lists.

## 5) Bottom line

The system is fundamentally strong for sustained success **if** operators consistently use Map/Create/Defer and review unresolved queue. The core architecture (resolver chokepoint + persistent queue + canonical overlays) is sound.

The biggest near-term quality issue is internal consistency around categories and sport-scoped bet type alias updates; these are tractable and should be prioritized to prevent subtle representation drift.

### Next steps

1. **Assign ownership and deadline**: Assign an engineering owner to resolve "categories and sport-scoped bet type alias updates" (Risks #1 and #2) with a 2-week deadline; create tracking ticket with acceptance criteria (category model reconciled, `addBetTypeAlias` updated to use composite keys).

2. **Operator training and recurring tasks**: Mandate operator training on Map/Create/Defer workflows; update documentation to enforce proper usage; add a recurring weekly task to review and resolve items in the `unresolvedQueue`.

3. **Automated consistency checks**: Add a CI job or monitoring alert to validate canonical overlays against bet records, detecting representation drift (e.g., orphaned aliases, mismatched sport scopes, duplicate canonicals); alert on anomalies.

4. **Track progress visibly**: Use a project board to track remediation progress for all five risks; tie each item to the "resolver chokepoint + persistent queue + canonical overlays" architecture with clear acceptance criteria and completion status.
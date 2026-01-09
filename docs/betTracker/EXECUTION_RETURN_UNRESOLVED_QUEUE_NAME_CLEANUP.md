# EXECUTION RETURN - Unresolved Queue Cleanup on Name Edit

Date: 2026-01-09

## Summary of Changes
- Added name edit cleanup that removes the previous unresolvedQueue entry before enqueueing a new unresolved value.
- Reused the badge resolver logic for unresolved detection on name commits.
- Applied the cleanup flow to name, totals name2, and parlay leg name edits with correct legIndex handling.

## Exact Logic (Change Detection + Queue Cleanup)
1. Normalize previous and new values using trimmed, case-insensitive comparison.
2. If normalized values match: no queue changes.
3. If previous value is non-empty:
   - prevQueueId = generateUnresolvedItemId(prevName, betId, legIndex)
   - removeFromUnresolvedQueue([prevQueueId])
4. If new value is empty: stop.
5. If sport is missing: stop.
6. Resolve using getNameResolutionStatus (same logic as badges):
   - If status is "resolved": do not enqueue.
   - If status is not "resolved": enqueue with generateUnresolvedItemId(newName, betId, legIndex).

## Fields and Contexts Covered
- Single bet name (name, legIndex = 0)
- Totals team names (name and name2, legIndex = 0)
- Parlay leg name (leg.entities[0], legIndex = actual leg index)

## Files Changed
- views/BetTableView.tsx
- docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md
- docs/betTracker/EXECUTION_RETURN_UNRESOLVED_QUEUE_NAME_CLEANUP.md

## Manual Test Results
1) Create bet (sport set), set Name to "ABCD" -> Not run (manual UI validation not performed in this environment).
2) Edit same cell to "LeBron James" -> Not run (manual UI validation not performed in this environment).
3) Totals name2 change "WXYZ" -> "Hawks" -> Not run (manual UI validation not performed in this environment).
4) Parlay leg name change (legIndex != 0) -> Not run (manual UI validation not performed in this environment).

## Deviations
- Manual UI tests were not executed in this environment.

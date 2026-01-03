# Dashboard UI Clarity + Debug Overlay — Phase "Dashboard UI"

**Date:** 2026-01-03  
**Status:** ✅ COMPLETE  
**Tests:** All 62 Phase 2B tests pass  
**Build:** ✅ Production build succeeds

---

## 1) What Changed

### New Files

| Path | Purpose |
|------|---------|
| `components/debug/DashboardTruthOverlay.tsx` | DEV-ONLY debug panel showing bet counts, filter state, and reconciliation ✅/❌ |
| `components/debug/InfoTooltip.tsx` | Reusable hover tooltip for micro-explainers |

### Modified Files

| Path | Changes |
|------|---------|
| `views/DashboardView.tsx` | Added overlay, scope labels ("Global"/"Filtered"), micro-explainer tooltips |
| `docs/betTracker/BET_TRACKER_BACKEND_DATA_WIRING_AUDIT_PHASE_1.md` | Appended Dashboard UI Phase section |

---

## 2) Screenshots / UI Placement

### Truth Overlay (DEV-ONLY)
- **Position:** Fixed top-right corner of Dashboard
- **Content:** 
  - Bet counts (`All Bets` / `Filtered Bets`)
  - Filter state (dateRange, betType, category, entity)
  - Reconciliation check comparing `sum(getNetNumeric)` with `computeOverallStats().netProfit`
  - Shows `RECONCILES ✅` when equal, `RECONCILES ❌` when divergent
- **Behavior:** Collapsible with local state toggle
- **Visibility:** Only in dev mode (`import.meta.env.DEV === true`)

### Scope Labels
- **QuickStatCards section:** Blue badge "Global (ignores filters)" with info tooltip
  - Tooltip: "These stats use ALL bets with time windows only. They don't change when you filter by category, bet type, or entity."
- **Main KPI StatCards section:** Purple badge "Filtered view" with info tooltip
  - Tooltip: "These stats reflect bets matching your current filters above."

### Micro-Explainer Tooltips
- **Near filtered KPIs:** "Pending = $0" note with tooltip explaining pending bets contribute $0 to net totals
- **Player/Team Performance header:** Info icon with tooltip: "Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns (prevents double-counting)."
- **Date filter controls:** Info icon with tooltip: "Filters use placed date (not settled date)."

---

## 3) How to Verify

### Automated Tests

```bash
npm test -- --run src/tests/
# Expected: 62 tests pass
```

### Manual Verification

1. **Start dev server:** `npm run dev`
2. **Open Dashboard** in browser
3. **Truth Overlay:**
   - Look for yellow "🔍 Truth Overlay" panel in top-right
   - Verify it shows bet counts and filter state
   - Verify reconciliation shows ✅ (with normal data)
   - Click header to collapse/expand
   - Change filters → verify overlay updates live
4. **Scope Labels:**
   - Verify "Global (ignores filters)" badge above QuickStatCards
   - Verify "Filtered view" badge above main KPI cards
   - Hover badges to see tooltips
5. **Micro-Explainers:**
   - Hover info icons near date filter, Net Profit area, Player/Team table
   - Verify tooltip text matches documented rules

### Production Build Verification (Optional)

```bash
npm run build
# then serve dist/ and verify overlay does NOT appear
```

---

## 4) Notes / Follow-ups

### Task D Decision (Optional Toggle)
**NOT IMPLEMENTED.** Rationale:
- Scope labels + tooltips provide sufficient clarity
- QuickStats global scope is intentional (per Issue #5 in audit doc)
- Adding toggle increases UI complexity for edge case users

### Technical Notes
- `StatsTableProps.title` changed from `string` to `React.ReactNode` to accept JSX tooltips
- Added `/// <reference types="vite/client" />` to DashboardTruthOverlay for TypeScript `import.meta.env` support

### UI Debt Noticed (Not Addressed)
- Chunk size warning in production build (949KB) is pre-existing, not introduced by this phase
- Could consider moving debug components to lazy-loaded chunk in future

---

## 5) What Was NOT Changed

- ✅ No changes to `services/aggregationService.ts`
- ✅ No changes to `services/displaySemantics.ts`
- ✅ No changes to `services/entityStatsService.ts`
- ✅ No changes to `utils/filterPredicates.ts`
- ✅ No new "alternative" net calculations added
- ✅ No changes to KPI reconciliation against FinalRows (remains display-only)
- ✅ All Phase 2B test invariants preserved

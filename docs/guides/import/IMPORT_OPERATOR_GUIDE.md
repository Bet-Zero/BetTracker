<!-- PERMANENT DOC - DO NOT DELETE -->

# Import Operator Guide

> **Quick Reference** for daily import operations. For technical details, see [IMPORT_DEV_GUIDE.md](./IMPORT_DEV_GUIDE.md).

---

## What This System Does

The BetTracker import system converts raw HTML from sportsbook bet history pages (FanDuel, DraftKings) into structured, validated bet records stored locally in your browser. The system parses the HTML, classifies bets by market type, normalizes player/team names, and validates all data before storage.

**Key principle:** Invalid data never enters storage. All bets must pass validation before import.

---

## Supported Sportsbooks

| Sportsbook | Status | Notes |
|------------|--------|-------|
| **FanDuel** | ✅ Fully supported | Singles, parlays, SGP, SGP+ |
| **DraftKings** | ✅ Fully supported | Singles, parlays, SGP, SGP+ |
| **Other** | ❌ Not implemented | Placeholder only |

**"Supported" means:**
- Parser extracts all bet details automatically
- Bet types correctly classified (single, parlay, SGP)
- Player/team entities identified
- Market categories assigned (Props, Main, Futures)

---

## Step-by-Step Import Workflow

### 1. Paste HTML
1. Go to your sportsbook's settled bets page *(Note: HTML must be under 5MB)*
2. Right-click → "View Page Source" (or Ctrl+U / Cmd+Option+U)
3. Copy entire page source
4. Select sportsbook in dropdown
5. Paste into textarea

### 2. Parse
- Click **"Parse & Review Bets"**
- System extracts bet data from HTML
- Status changes to "X bets ready for review"

### 3. Review
The confirmation modal shows:
- **Parsed count** — Total bets found
- **Blockers** — Bets that CANNOT import (missing required data)
- **Warnings** — Minor issues (can still import)
- **Duplicates** — Already in storage (will skip)
- **Will Import** — Net-new valid bets

### 4. Resolve Blockers
If blockers exist, the Import button is **disabled**. Common blockers:
- Missing bet ID
- Invalid date
- Missing stake/odds for wins
- Missing result

Use inline editing in the modal table to fix issues.

### 5. Import
Click **"Import X Bets"** when blockers = 0. Bets save to localStorage.

---

## Key Concepts

### Blockers vs Warnings vs Duplicates

| Type | Impact | Example |
|------|--------|---------|
| **Blocker** | ❌ Cannot import | Missing stake, invalid date |
| **Warning** | ⚠️ Can import | Missing sport, no leg details |
| **Duplicate** | 🔁 Skipped | Same bet ID already in storage |

### Entity Types

Each bet leg has an `entityType`:
- **`player`** — Player prop (e.g., "LeBron 25+ pts")
- **`team`** — Team-level bet (spread, moneyline)
- **`unknown`** — Ambiguous market (manual review needed)

Parsers set this automatically. Storage layer trusts the parser.

### Market Categories

| Category | Description |
|----------|-------------|
| **Props** | Player/team props, stat bets |
| **Main Markets** | Spreads, moneylines, totals |
| **Futures** | Season-long bets (MVP, championship) |
| **SGP/SGP+** | Same-game parlays |
| **Parlays** | Multi-game parlays |

---

## Overlays: Adding Teams/Players/Stat Types

User additions extend (don't replace) base data.

### Adding a Team
1. Settings → Normalization → Teams
2. Click "Add Team"
3. Enter: canonical name, sport, abbreviations, aliases
4. Save → stored in `localStorage` under `bettracker-normalization-teams`

### Adding a Player
1. Settings → Normalization → Players
2. Add player with sport association
3. Saved to normalization overlay

### Adding a Stat Type
1. Settings → Normalization → Stat Types
2. Enter canonical code (e.g., "Pts"), sport, aliases
3. Stored in `bettracker-normalization-stattypes`

**After adding, overlays take effect immediately** — no restart needed.

---

## "What to Do If…" Quick Fixes

### 1. "No bets found"
- **Cause:** Wrong sportsbook selected, or HTML from wrong page
- **Fix:** Verify you're on settled bets page, confirm sportsbook matches

### 2. Import button is disabled
- **Cause:** Blockers exist
- **Fix:** Check blocker summary, use inline editing to fix fields

### 3. Bets imported but not visible in table
- **Cause:** Filter active, or bet lacks required display fields
- **Fix:** Clear filters, check if sport is set

### 4. High duplicate count
- **Cause:** Re-importing same HTML
- **Fix:** This is expected behavior — duplicates are safely skipped

### 5. Odds shows NaN
- **Cause:** Odds couldn't be parsed from HTML
- **Fix:** Edit odds manually in confirmation modal before import

### 6. Wrong player/team name
- **Cause:** Normalization alias missing
- **Fix:** Add alias in Settings → Normalization

### 7. "Corruption recovery triggered"
- **Cause:** localStorage data was malformed
- **Fix:** Automatic backup created at `bettracker-backup-corruption-{timestamp}`. Fresh state initialized.

### 8. Input too large error
- **Cause:** Pasted HTML exceeds 5MB limit
- **Fix:** Copy smaller date range from sportsbook

### 9. Wrong bet type (single shows as parlay)
- **Cause:** Parser misclassification
- **Fix:** Edit `betType` in modal, or report as bug

### 10. Missing sport on all bets
- **Cause:** Sport couldn't be inferred from HTML
- **Fix:** Set sport manually in modal or post-import in table

---

## Backup & Export

### Automatic Backups
Created automatically when:
- Corruption detected → `bettracker-backup-corruption-{timestamp}`
- Clear all bets → `bettracker-backup-clear-{timestamp}`
- Migration issues → `bettracker-backup-legacy-corruption-{timestamp}`

### Manual Export
Settings → Data Management → **Export Full Backup (JSON)**
- Exports complete state with version metadata
- Can be used to restore via developer tools

### Recovery from Backup
1. Open browser DevTools → Console
2. **List available backups:**
   ```javascript
   Object.keys(localStorage).filter(k => k.startsWith('bettracker-backup-'))
   ```
3. Pick the appropriate backup key from the list (e.g., the most recent timestamp)
4. Get backup: `const backupData = localStorage.getItem('bettracker-backup-...')`
5. Parse and validate: `const parsed = JSON.parse(backupData); console.log(parsed)`
6. If valid, restore: `localStorage.setItem('bettracker-state', backupData)`
7. Refresh page

---

## Related Documentation

- [IMPORT_DEV_GUIDE.md](./IMPORT_DEV_GUIDE.md) — Architecture & developer onboarding
- [IMPORT_TROUBLESHOOTING.md](./IMPORT_TROUBLESHOOTING.md) — Symptom-based debugging guide
- [IMPORT_SYSTEM_GAP_ANALYSIS_V3.md](../../audits/IMPORT_SYSTEM_GAP_ANALYSIS_V3.md) — Foundation audit (technical reference)

<!-- PERMANENT DOC - DO NOT DELETE -->

# Normalization System - Practical Examples

This document provides practical examples of how the normalization system solves real-world problems when tracking bets across multiple sportsbooks.

## Problem Statement

Different sportsbooks format data differently, making it difficult to:
1. Aggregate statistics across books
2. Detect duplicate bets
3. Analyze performance by team or stat type
4. Automatically determine the sport from bet data

## Solution: Canonical Mapping

The normalization system maps all variations to a single canonical form.

---

## Example 1: Team Name Variations

### Scenario
You place bets on the Phoenix Suns across three sportsbooks:

**DraftKings HTML:**
```html
<span>PHO Suns</span>
```

**FanDuel HTML:**
```html
<span>Phoenix Suns</span>
```

**Caesars HTML:**
```html
<span>Suns</span>
```

### Without Normalization
Your data would look like:
```typescript
[
  { team: "PHO Suns", wins: 5, losses: 3 },
  { team: "Phoenix Suns", wins: 4, losses: 2 },
  { team: "Suns", wins: 3, losses: 1 }
]
```

**Problem**: Can't aggregate stats for the same team!

### With Normalization
```typescript
import { normalizeTeamName } from './services/normalizationService';

const teams = ["PHO Suns", "Phoenix Suns", "Suns", "PHX"];
const normalized = teams.map(t => normalizeTeamName(t));
// All return: "Phoenix Suns"
```

Your data becomes:
```typescript
[
  { team: "Phoenix Suns", wins: 12, losses: 6 }
]
```

**Benefit**: Easy aggregation and analysis!

---

## Example 2: Stat Type Variations

### Scenario
You track player prop bets for rebounds across sportsbooks:

**DraftKings:** "Reb"
**FanDuel:** "Rebounds"
**BetMGM:** "Rebs"
**Caesars:** "Total Rebounds"

### Without Normalization
```typescript
[
  { player: "Domantas Sabonis", stat: "Reb", line: 12.5 },
  { player: "Domantas Sabonis", stat: "Rebounds", line: 13.5 },
  { player: "Domantas Sabonis", stat: "Rebs", line: 12.5 }
]
```

**Problem**: Can't analyze performance on "Rebounds" as a category!

### With Normalization
```typescript
import { normalizeStatType } from './services/normalizationService';

const stats = ["Reb", "Rebounds", "Rebs", "Total Rebounds", "REB"];
const normalized = stats.map(s => normalizeStatType(s));
// All return: "Reb"
```

Your data becomes:
```typescript
[
  { player: "Domantas Sabonis", stat: "Reb", line: 12.5 },
  { player: "Domantas Sabonis", stat: "Reb", line: 13.5 },
  { player: "Domantas Sabonis", stat: "Reb", line: 12.5 }
]
```

**Benefit**: Can now filter/analyze all rebound bets together!

---

## Example 3: Sport Detection from Team Names

### Scenario
Parsing a bet slip that doesn't explicitly state "NBA" or "NFL":

**DraftKings Parlay:**
```
LAL Lakers vs PHO Suns
Total Points Over 225.5
```

### Without Normalization
```typescript
// Have to guess the sport from keywords or manually tag it
function guessSport(description: string): string {
  if (description.includes("basketball") || description.includes("points")) {
    return "NBA"; // Unreliable!
  }
  return "Unknown";
}
```

**Problem**: Unreliable detection, "points" appears in many sports!

### With Normalization
```typescript
import { getSportForTeam } from './services/normalizationService';

const teams = ["LAL Lakers", "PHO Suns"];
const sport1 = getSportForTeam(teams[0]); // → "NBA"
const sport2 = getSportForTeam(teams[1]); // → "NBA"
```

**Benefit**: Reliable sport detection from team names!

---

## Example 4: Combined Context Detection

### Scenario
Parsing a prop bet with minimal context:

```
Kelce
Receiving Yards
Over 70.5
```

Who is Kelce? Travis Kelce (NFL) or Jason Kelce (retired)?

### With Normalization
```typescript
import { inferSportFromContext } from './services/normalizationService';

const sport = inferSportFromContext({
  statType: "Receiving Yards"  // NFL-specific stat
});
// Returns: "NFL"
```

**Benefit**: Context-aware sport detection!

---

## Example 5: Cross-Sportsbook Bet Comparison

### Scenario
You want to find the best line for a bet across sportsbooks:

**Raw Data:**
```typescript
[
  { book: "DraftKings", team: "PHO Suns", stat: "3pt", player: "Devin Booker", line: 2.5 },
  { book: "FanDuel", team: "Phoenix Suns", stat: "MADE THREES", player: "Devin Booker", line: 2.5 },
  { book: "BetMGM", team: "Suns", stat: "Threes", player: "Devin Booker", line: 3.5 }
]
```

### With Normalization
```typescript
import { normalizeTeamName, normalizeStatType } from './services/normalizationService';

const bets = rawBets.map(bet => ({
  ...bet,
  team: normalizeTeamName(bet.team),
  stat: normalizeStatType(bet.stat)
}));

// Now can easily group and compare:
const bookerThrees = bets.filter(b => 
  b.team === "Phoenix Suns" && 
  b.stat === "3pt" && 
  b.player === "Devin Booker"
);
// Returns all 3 bets, can compare lines!
```

**Benefit**: Easy comparison and line shopping!

---

## Example 6: Automatic Categorization

### Scenario
Import a CSV of bets and automatically categorize them:

```csv
Date,Book,Description,Stake,Payout
11/15/24,DK,"LAL Lakers ML",$50,$45
11/15/24,FD,"LeBron James Over 25.5 Points",$25,$57.50
11/16/24,MGM,"KC Chiefs vs BUF Bills Parlay",$10,$35
```

### With Normalization
```typescript
import { inferSportFromContext, normalizeTeamName } from './services/normalizationService';

function categorizeBet(description: string) {
  // Extract team names (simplified)
  const teams = extractTeams(description);
  
  if (teams.length > 0) {
    const sport = inferSportFromContext({ team: teams[0] });
    const normalizedTeam = normalizeTeamName(teams[0]);
    
    return { sport, team: normalizedTeam };
  }
  
  return { sport: "Unknown", team: null };
}

categorizeBet("LAL Lakers ML");
// → { sport: "NBA", team: "Los Angeles Lakers" }

categorizeBet("KC Chiefs vs BUF Bills Parlay");
// → { sport: "NFL", team: "Kansas City Chiefs" }
```

**Benefit**: Automatic sport and team detection for imports!

---

## Example 7: Duplicate Detection

### Scenario
Check if you've already logged a bet to avoid duplicates:

```typescript
import { normalizeTeamName, normalizeStatType } from './services/normalizationService';

function isDuplicate(newBet: Bet, existingBets: Bet[]): boolean {
  const normalizedNew = {
    team: normalizeTeamName(newBet.team),
    stat: normalizeStatType(newBet.stat),
    line: newBet.line,
    date: newBet.date
  };
  
  return existingBets.some(existing => {
    const normalizedExisting = {
      team: normalizeTeamName(existing.team),
      stat: normalizeStatType(existing.stat),
      line: existing.line,
      date: existing.date
    };
    
    return (
      normalizedNew.team === normalizedExisting.team &&
      normalizedNew.stat === normalizedExisting.stat &&
      normalizedNew.line === normalizedExisting.line &&
      normalizedNew.date === normalizedExisting.date
    );
  });
}

// Example usage:
const newBet = { team: "PHO Suns", stat: "Rebounds", line: 12.5, date: "2024-11-15" };
const existing = [
  { team: "Phoenix Suns", stat: "Reb", line: 12.5, date: "2024-11-15" }
];

isDuplicate(newBet, existing); // → true (same bet, different formatting!)
```

**Benefit**: Accurate duplicate detection across different sportsbook formats!

---

## Example 8: Analytics Dashboard

### Scenario
Build a dashboard showing performance by sport and team:

```typescript
import { normalizeTeamName, getSportForTeam } from './services/normalizationService';

function aggregateByTeam(bets: Bet[]) {
  const teamStats = new Map();
  
  for (const bet of bets) {
    const normalizedTeam = normalizeTeamName(bet.team);
    const sport = getSportForTeam(normalizedTeam);
    
    const key = `${sport}-${normalizedTeam}`;
    
    if (!teamStats.has(key)) {
      teamStats.set(key, { 
        sport, 
        team: normalizedTeam, 
        wins: 0, 
        losses: 0,
        profit: 0 
      });
    }
    
    const stats = teamStats.get(key);
    if (bet.result === 'win') {
      stats.wins++;
      stats.profit += bet.payout - bet.stake;
    } else if (bet.result === 'loss') {
      stats.losses++;
      stats.profit -= bet.stake;
    }
  }
  
  return Array.from(teamStats.values());
}

// Result:
[
  { sport: "NBA", team: "Phoenix Suns", wins: 12, losses: 6, profit: 150.50 },
  { sport: "NFL", team: "Kansas City Chiefs", wins: 8, losses: 4, profit: 95.25 }
]
```

**Benefit**: Clean, aggregated data for analytics!

---

## Summary

The normalization system provides:

1. **Consistency** - All data stored in canonical form
2. **Aggregation** - Easy grouping and analysis
3. **Comparison** - Simple cross-sportsbook comparison
4. **Detection** - Automatic duplicate and sport detection
5. **Maintainability** - Add new aliases without touching parser code

## Key Functions

- `normalizeTeamName()` - Team name variations → canonical name
- `normalizeStatType()` - Stat type variations → canonical code
- `getSportForTeam()` - Team name → sport
- `inferSportFromContext()` - Multiple clues → sport
- `normalizeMainMarketType()` - Market type variations → canonical
- `normalizeFutureType()` - Future bet variations → canonical

All functions handle case insensitivity and common formatting variations automatically.

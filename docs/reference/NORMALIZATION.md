<!-- PERMANENT DOC - DO NOT DELETE -->

# Sports, Teams, and Stats Normalization System

This document describes the normalization system for standardizing sports, teams, and stat types across different sportsbooks.

## Overview

Different sportsbooks format team names, stat types, and other data in different ways:
- **DraftKings**: "PHO Suns"
- **FanDuel**: "Phoenix Suns"
- **Others**: "Suns", "PHX"

The normalization system provides:
1. **Reference Data** (`data/referenceData.ts`) - Canonical names and alias mappings for sports, teams, stat types, etc.
2. **Normalization Service** (`services/normalizationService.ts`) - Functions to convert aliases to canonical forms
3. **Integration** - Utilities to apply normalization during parsing

## Reference Data Structure

### Sports Index
```typescript
const SPORTS = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'UFC', 'PGA', 'Soccer', 'Tennis', 'Other'];
```

### Team Mappings
Each team has:
- **Canonical Name**: Official display name (e.g., "Phoenix Suns")
- **Sport**: Associated sport (e.g., "NBA")
- **Abbreviations**: Short forms (e.g., ["PHO", "PHX"])
- **Aliases**: All possible variations (e.g., ["PHO Suns", "Phoenix Suns", "Suns", "PHO", "PHX", "Phoenix"])

Example:
```typescript
{
  canonical: 'Phoenix Suns',
  sport: 'NBA',
  abbreviations: ['PHO', 'PHX'],
  aliases: ['PHO Suns', 'PHX Suns', 'Suns', 'PHO', 'PHX', 'Phoenix']
}
```

### Stat Type Mappings
Each stat type has:
- **Canonical**: Standard display code (e.g., "Pts", "Reb", "3pt")
- **Sport**: Associated sport
- **Description**: Human-readable description
- **Aliases**: All possible variations

Example:
```typescript
{
  canonical: 'Reb',
  sport: 'NBA',
  description: 'Rebounds',
  aliases: ['Reb', 'Rebs', 'Rebounds', 'Total Rebounds', 'REB', 'reb', 'rebounds']
}
```

## Using the Normalization Service

### Team Name Normalization

```typescript
import { normalizeTeamName, getSportForTeam } from './services/normalizationService';

// All of these return "Phoenix Suns"
normalizeTeamName('PHO Suns');      // → "Phoenix Suns"
normalizeTeamName('Phoenix Suns');  // → "Phoenix Suns"
normalizeTeamName('Suns');          // → "Phoenix Suns"
normalizeTeamName('PHO');           // → "Phoenix Suns"
normalizeTeamName('PHX');           // → "Phoenix Suns"

// Get sport from team name
getSportForTeam('PHO Suns');        // → "NBA"
getSportForTeam('Chiefs');          // → "NFL"
```

### Stat Type Normalization

```typescript
import { normalizeStatType } from './services/normalizationService';

// All of these return "Reb"
normalizeStatType('Reb');           // → "Reb"
normalizeStatType('Rebs');          // → "Reb"
normalizeStatType('Rebounds');      // → "Reb"
normalizeStatType('REB');           // → "Reb"

// All of these return "3pt"
normalizeStatType('3pt');           // → "3pt"
normalizeStatType('MADE THREES');   // → "3pt"
normalizeStatType('Threes');        // → "3pt"
normalizeStatType('3-Pointers');    // → "3pt"

// Normalize with sport context
normalizeStatType('Points', 'NBA'); // → "Pts"
```

### Sport Detection

```typescript
import { inferSportFromContext } from './services/normalizationService';

// Infer from team
inferSportFromContext({ team: 'Lakers' });           // → "NBA"
inferSportFromContext({ team: 'Chiefs' });           // → "NFL"

// Infer from stat type
inferSportFromContext({ statType: 'Pass Yds' });     // → "NFL"
inferSportFromContext({ statType: 'Home Runs' });    // → "MLB"

// Infer from description
inferSportFromContext({ description: 'NBA game' });  // → "NBA"

// Multiple context clues (team takes priority)
inferSportFromContext({ 
  team: 'Lakers', 
  statType: 'Points',
  description: 'Tonight\'s game'
}); // → "NBA"
```

### Main Market Types

```typescript
import { normalizeMainMarketType } from './services/normalizationService';

normalizeMainMarketType('ML');              // → "Moneyline"
normalizeMainMarketType('Money Line');      // → "Moneyline"
normalizeMainMarketType('Point Spread');    // → "Spread"
normalizeMainMarketType('O/U');             // → "Total"
```

### Future Types

```typescript
import { normalizeFutureType } from './services/normalizationService';

normalizeFutureType('To Win NBA Finals');   // → "NBA Finals"
normalizeFutureType('NBA Championship');    // → "NBA Finals"
normalizeFutureType('To Win Super Bowl');   // → "Super Bowl"
normalizeFutureType('Season Wins');         // → "Win Total"
```

## Integration with Parsers

The normalization service is integrated into the shared parsing utilities:

```typescript
// In parsing/shared/utils/index.ts
import { normalizeTeamName, normalizeStatType } from '../../../services/normalizationService';

// Helper functions available for use in parsers
export function normalizeEntities(entities: string[]): string[] {
  return entities.map(entity => normalizeTeamName(entity));
}

export function normalizeType(type: string, sport?: string): string {
  return normalizeStatType(type, sport as any);
}
```

Example usage in a parser:

```typescript
import { normalizeEntities, normalizeType } from '../shared/utils';

// Normalize team names in bet legs
const normalizedEntities = normalizeEntities(['PHO Suns', 'LAL Lakers']);
// → ['Phoenix Suns', 'Los Angeles Lakers']

// Normalize stat type
const normalizedType = normalizeType('Rebs', 'NBA');
// → 'Reb'
```

## Benefits

1. **Consistency**: All team names and stat types are stored in canonical form
2. **Data Quality**: Easier to aggregate and analyze bets across sportsbooks
3. **Sport Detection**: Automatically detect sport from team names
4. **Maintainability**: Centralized mapping makes it easy to add new aliases
5. **Flexibility**: Easy to add new teams, stats, or sports as needed

## Adding New Mappings

### Adding a New Team

Edit `data/referenceData.ts` and add to the `TEAMS` array:

```typescript
{
  canonical: 'Seattle Kraken',
  sport: 'NHL',
  abbreviations: ['SEA'],
  aliases: ['SEA Kraken', 'Kraken', 'SEA', 'Seattle']
}
```

### Adding a New Stat Type

Edit `data/referenceData.ts` and add to the `STAT_TYPES` array:

```typescript
{
  canonical: 'Dunks',
  sport: 'NBA',
  description: 'Dunks',
  aliases: ['Dunks', 'Dunk', 'dunks', 'dunk']
}
```

### Adding a New Sport

1. Add to the `SPORTS` array in `data/referenceData.ts`
2. Add teams for that sport to `TEAMS`
3. Add stat types for that sport to `STAT_TYPES`
4. Update keyword mappings in `inferSportFromContext` if needed

## Testing

The normalization service has comprehensive tests in `services/normalizationService.test.ts`.

Run tests:
```bash
npm test -- services/normalizationService.test.ts
```

## Future Enhancements

Potential areas for expansion:
- Player name normalization (for misspellings)
- League/competition mappings (e.g., "Premier League", "EPL", "English Premier League")
- Venue/stadium normalization
- Bet type synonyms (e.g., "SGP", "Same Game Parlay")
- International team names (e.g., supporting multiple languages)

/**
 * Normalization service for standardizing sports, teams, and stat types across sportsbooks.
 * 
 * This service provides lookup functions that map various aliases and formats to canonical names,
 * ensuring consistent data representation regardless of how different sportsbooks format their data.
 */

import { 
  TEAMS, 
  STAT_TYPES, 
  MAIN_MARKET_TYPES, 
  FUTURE_TYPES,
  TeamInfo, 
  StatTypeInfo,
  Sport 
} from '../data/referenceData';

// ============================================================================
// TEAM NORMALIZATION
// ============================================================================

/**
 * Normalizes a team name to its canonical form.
 * Handles various formats like "PHO Suns", "Phoenix Suns", "Suns", "PHX" → "Phoenix Suns"
 * 
 * @param teamName - The team name as it appears in the sportsbook data
 * @returns The canonical team name, or the original if no match found
 */
export function normalizeTeamName(teamName: string): string {
  if (!teamName) return teamName;
  
  const normalized = teamName.trim();
  const lowerSearch = normalized.toLowerCase();
  
  // Try exact match first (case-insensitive)
  for (const team of TEAMS) {
    if (team.canonical.toLowerCase() === lowerSearch) {
      return team.canonical;
    }
    
    // Check all aliases
    for (const alias of team.aliases) {
      if (alias.toLowerCase() === lowerSearch) {
        return team.canonical;
      }
    }
    
    // Check abbreviations
    for (const abbr of team.abbreviations) {
      if (abbr.toLowerCase() === lowerSearch) {
        return team.canonical;
      }
    }
  }
  
  // If no exact match, try partial matching for compound names
  // e.g., "PHO Suns" should match "Phoenix Suns"
  for (const team of TEAMS) {
    // Check if the input contains a team abbreviation + nickname pattern
    for (const abbr of team.abbreviations) {
      const pattern1 = new RegExp(`^${abbr}\\s+`, 'i'); // "PHO Suns"
      const pattern2 = new RegExp(`\\s+${abbr}$`, 'i'); // "Suns PHO"
      
      if (pattern1.test(normalized) || pattern2.test(normalized)) {
        // Extract the nickname part
        const parts = normalized.split(/\s+/);
        for (const part of parts) {
          if (part.toLowerCase() !== abbr.toLowerCase()) {
            // Check if this part matches one of the team's aliases
            for (const alias of team.aliases) {
              if (alias.toLowerCase().includes(part.toLowerCase()) || 
                  part.toLowerCase().includes(alias.toLowerCase())) {
                return team.canonical;
              }
            }
          }
        }
      }
    }
  }
  
  // Return original if no match found
  return normalized;
}

/**
 * Gets the sport for a given team name.
 * 
 * @param teamName - The team name (can be in any format)
 * @returns The sport the team belongs to, or undefined if not found
 */
export function getSportForTeam(teamName: string): Sport | undefined {
  if (!teamName) return undefined;
  
  const canonical = normalizeTeamName(teamName);
  
  for (const team of TEAMS) {
    if (team.canonical === canonical) {
      return team.sport;
    }
  }
  
  return undefined;
}

/**
 * Gets team information for a given team name.
 * 
 * @param teamName - The team name (can be in any format)
 * @returns The team info object, or undefined if not found
 */
export function getTeamInfo(teamName: string): TeamInfo | undefined {
  if (!teamName) return undefined;
  
  const canonical = normalizeTeamName(teamName);
  
  for (const team of TEAMS) {
    if (team.canonical === canonical) {
      return team;
    }
  }
  
  return undefined;
}

// ============================================================================
// STAT TYPE NORMALIZATION
// ============================================================================

/**
 * Normalizes a stat type to its canonical form.
 * Handles various formats like "Reb", "Rebs", "Rebounds" → "Reb"
 * 
 * @param statType - The stat type as it appears in the sportsbook data
 * @param sport - Optional sport context to help with ambiguous cases
 * @returns The canonical stat type code, or the original if no match found
 */
export function normalizeStatType(statType: string, sport?: Sport): string {
  if (!statType) return statType;
  
  const normalized = statType.trim();
  const lowerSearch = normalized.toLowerCase();
  
  // Filter by sport if provided
  const relevantStats = sport 
    ? STAT_TYPES.filter(s => s.sport === sport)
    : STAT_TYPES;
  
  // Try exact match first (case-insensitive)
  for (const stat of relevantStats) {
    if (stat.canonical.toLowerCase() === lowerSearch) {
      return stat.canonical;
    }
    
    // Check all aliases
    for (const alias of stat.aliases) {
      if (alias.toLowerCase() === lowerSearch) {
        return stat.canonical;
      }
    }
  }
  
  // If sport not provided or not found, check all sports
  if (sport) {
    for (const stat of STAT_TYPES) {
      if (stat.canonical.toLowerCase() === lowerSearch) {
        return stat.canonical;
      }
      
      for (const alias of stat.aliases) {
        if (alias.toLowerCase() === lowerSearch) {
          return stat.canonical;
        }
      }
    }
  }
  
  // Return original if no match found
  return normalized;
}

/**
 * Gets stat type information for a given stat type.
 * 
 * @param statType - The stat type (can be in any format)
 * @param sport - Optional sport context
 * @returns The stat type info object, or undefined if not found
 */
export function getStatTypeInfo(statType: string, sport?: Sport): StatTypeInfo | undefined {
  if (!statType) return undefined;
  
  const canonical = normalizeStatType(statType, sport);
  
  const relevantStats = sport 
    ? STAT_TYPES.filter(s => s.sport === sport)
    : STAT_TYPES;
  
  for (const stat of relevantStats) {
    if (stat.canonical === canonical) {
      return stat;
    }
  }
  
  // Check all sports if not found
  if (sport) {
    for (const stat of STAT_TYPES) {
      if (stat.canonical === canonical) {
        return stat;
      }
    }
  }
  
  return undefined;
}

/**
 * Gets the sport(s) associated with a stat type.
 * 
 * @param statType - The stat type (can be in any format)
 * @returns Array of sports that use this stat type
 */
export function getSportsForStatType(statType: string): Sport[] {
  if (!statType) return [];
  
  const canonical = normalizeStatType(statType);
  const sports: Sport[] = [];
  
  for (const stat of STAT_TYPES) {
    if (stat.canonical === canonical && !sports.includes(stat.sport)) {
      sports.push(stat.sport);
    }
  }
  
  return sports;
}

// ============================================================================
// MAIN MARKET TYPE NORMALIZATION
// ============================================================================

/**
 * Normalizes a main market type to its canonical form.
 * Handles various formats like "ML", "Money Line", "moneyline" → "Moneyline"
 * 
 * @param marketType - The market type as it appears in the sportsbook data
 * @returns The canonical market type, or the original if no match found
 */
export function normalizeMainMarketType(marketType: string): string {
  if (!marketType) return marketType;
  
  const normalized = marketType.trim();
  const lowerSearch = normalized.toLowerCase();
  
  for (const market of MAIN_MARKET_TYPES) {
    if (market.canonical.toLowerCase() === lowerSearch) {
      return market.canonical;
    }
    
    for (const alias of market.aliases) {
      if (alias.toLowerCase() === lowerSearch) {
        return market.canonical;
      }
    }
  }
  
  return normalized;
}

// ============================================================================
// FUTURE TYPE NORMALIZATION
// ============================================================================

/**
 * Normalizes a future type to its canonical form.
 * Handles various formats like "To Win NBA Finals", "NBA Championship" → "NBA Finals"
 * 
 * @param futureType - The future type as it appears in the sportsbook data
 * @param sport - Optional sport context
 * @returns The canonical future type, or the original if no match found
 */
export function normalizeFutureType(futureType: string, sport?: Sport): string {
  if (!futureType) return futureType;
  
  const normalized = futureType.trim();
  const lowerSearch = normalized.toLowerCase();
  
  // Filter by sport if provided
  const relevantFutures = sport 
    ? FUTURE_TYPES.filter(f => !f.sport || f.sport === sport)
    : FUTURE_TYPES;
  
  for (const future of relevantFutures) {
    if (future.canonical.toLowerCase() === lowerSearch) {
      return future.canonical;
    }
    
    for (const alias of future.aliases) {
      if (alias.toLowerCase() === lowerSearch) {
        return future.canonical;
      }
    }
  }
  
  // If sport not provided or not found, check all futures
  if (sport) {
    for (const future of FUTURE_TYPES) {
      if (future.canonical.toLowerCase() === lowerSearch) {
        return future.canonical;
      }
      
      for (const alias of future.aliases) {
        if (alias.toLowerCase() === lowerSearch) {
          return future.canonical;
        }
      }
    }
  }
  
  return normalized;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Attempts to infer the sport from various context clues.
 * Checks team names, stat types, and description keywords.
 * 
 * @param context - Object with optional team, statType, and description fields
 * @returns The inferred sport, or undefined if unable to determine
 */
export function inferSportFromContext(context: {
  team?: string;
  statType?: string;
  description?: string;
}): Sport | undefined {
  // Try team name first (most reliable)
  if (context.team) {
    const sport = getSportForTeam(context.team);
    if (sport) return sport;
  }
  
  // Try stat type
  if (context.statType) {
    const sports = getSportsForStatType(context.statType);
    if (sports.length === 1) {
      return sports[0];
    }
    // If multiple sports use this stat, can't be certain
  }
  
  // Try description keywords as last resort
  if (context.description) {
    const lower = context.description.toLowerCase();
    
    // Sport-specific keywords
    const sportKeywords: { [key in Sport]?: string[] } = {
      NBA: ['nba', 'basketball'],
      NFL: ['nfl', 'football'],
      MLB: ['mlb', 'baseball'],
      NHL: ['nhl', 'hockey'],
      NCAAB: ['ncaab', 'college basketball', 'march madness'],
      NCAAF: ['ncaaf', 'college football'],
      UFC: ['ufc', 'mma', 'mixed martial arts'],
      Soccer: ['soccer', 'football', 'premier league', 'champions league', 'mls'],
      Tennis: ['tennis', 'wimbledon', 'us open', 'french open', 'australian open'],
    };
    
    for (const [sport, keywords] of Object.entries(sportKeywords)) {
      if (keywords && keywords.some(kw => lower.includes(kw))) {
        return sport as Sport;
      }
    }
  }
  
  return undefined;
}

/**
 * Checks if a team name is recognized in the system.
 * 
 * @param teamName - The team name to check
 * @returns True if the team is recognized
 */
export function isKnownTeam(teamName: string): boolean {
  return getTeamInfo(teamName) !== undefined;
}

/**
 * Checks if a stat type is recognized in the system.
 * 
 * @param statType - The stat type to check
 * @returns True if the stat type is recognized
 */
export function isKnownStatType(statType: string): boolean {
  return getStatTypeInfo(statType) !== undefined;
}

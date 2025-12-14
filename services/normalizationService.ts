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
// LOOKUP MAPS (Performance Optimization)
// ============================================================================

// Build lookup maps on initialization for O(1) lookups
const teamLookupMap = new Map<string, TeamInfo>();
const statTypeLookupMap = new Map<string, StatTypeInfo>();

// Initialize team lookup map
for (const team of TEAMS) {
  // Add canonical name
  teamLookupMap.set(team.canonical.toLowerCase(), team);
  
  // Add all aliases
  for (const alias of team.aliases) {
    teamLookupMap.set(alias.toLowerCase(), team);
  }
  
  // Add all abbreviations
  for (const abbr of team.abbreviations) {
    teamLookupMap.set(abbr.toLowerCase(), team);
  }
}

// Initialize stat type lookup map
for (const stat of STAT_TYPES) {
  // Add canonical name
  statTypeLookupMap.set(stat.canonical.toLowerCase(), stat);
  
  // Add all aliases
  for (const alias of stat.aliases) {
    statTypeLookupMap.set(alias.toLowerCase(), stat);
  }
}

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
  
  // Try exact match using lookup map (O(1) performance)
  const teamInfo = teamLookupMap.get(lowerSearch);
  if (teamInfo) {
    return teamInfo.canonical;
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
  
  const lowerSearch = teamName.trim().toLowerCase();
  const teamInfo = teamLookupMap.get(lowerSearch);
  
  if (teamInfo) {
    return teamInfo.sport;
  }
  
  // Fallback to full normalization if not found in lookup
  const canonical = normalizeTeamName(teamName);
  const canonicalInfo = teamLookupMap.get(canonical.toLowerCase());
  
  return canonicalInfo?.sport;
}

/**
 * Gets team information for a given team name.
 * 
 * @param teamName - The team name (can be in any format)
 * @returns The team info object, or undefined if not found
 */
export function getTeamInfo(teamName: string): TeamInfo | undefined {
  if (!teamName) return undefined;
  
  const lowerSearch = teamName.trim().toLowerCase();
  const teamInfo = teamLookupMap.get(lowerSearch);
  
  if (teamInfo) {
    return teamInfo;
  }
  
  // Fallback to full normalization if not found in lookup
  const canonical = normalizeTeamName(teamName);
  return teamLookupMap.get(canonical.toLowerCase());
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
  
  // Try exact match using lookup map (O(1) performance)
  const statInfo = statTypeLookupMap.get(lowerSearch);
  
  // If sport context provided, verify the stat matches the sport
  if (statInfo) {
    if (sport && statInfo.sport !== sport) {
      // Look for a sport-specific match
      for (const stat of STAT_TYPES) {
        if (stat.sport === sport) {
          if (stat.canonical.toLowerCase() === lowerSearch || 
              stat.aliases.some(a => a.toLowerCase() === lowerSearch)) {
            return stat.canonical;
          }
        }
      }
    }
    return statInfo.canonical;
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
  
  const lowerSearch = statType.trim().toLowerCase();
  const statInfo = statTypeLookupMap.get(lowerSearch);
  
  // If sport context provided, verify the stat matches the sport
  if (statInfo) {
    if (sport && statInfo.sport !== sport) {
      // Look for a sport-specific match
      for (const stat of STAT_TYPES) {
        if (stat.sport === sport && stat.canonical.toLowerCase() === lowerSearch) {
          return stat;
        }
      }
    }
    return statInfo;
  }
  
  // Fallback to normalization
  const canonical = normalizeStatType(statType, sport);
  return statTypeLookupMap.get(canonical.toLowerCase());
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

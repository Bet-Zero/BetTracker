/**
 * Dynamic normalization service that reads from localStorage instead of hardcoded data.
 * This allows users to manage teams, stat types, and their aliases through the UI.
 */

import { Sport } from '../data/referenceData';
import { TeamData, StatTypeData } from '../hooks/useNormalizationData';

// ============================================================================
// DYNAMIC LOOKUP MAPS
// ============================================================================

let teamLookupMap = new Map<string, TeamData>();
let statTypeLookupMap = new Map<string, StatTypeData>();
let initialized = false;

/**
 * Initialize or refresh lookup maps from localStorage
 */
export function initializeLookupMaps(): void {
  try {
    // Load teams from localStorage
    const teamsJson = localStorage.getItem('bettracker-normalization-teams');
    const teams: TeamData[] = teamsJson ? JSON.parse(teamsJson) : [];
    
    // Rebuild team lookup map
    teamLookupMap.clear();
    for (const team of teams) {
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
    
    // Load stat types from localStorage
    const statTypesJson = localStorage.getItem('bettracker-normalization-stattypes');
    const statTypes: StatTypeData[] = statTypesJson ? JSON.parse(statTypesJson) : [];
    
    // Rebuild stat type lookup map
    statTypeLookupMap.clear();
    for (const stat of statTypes) {
      // Add canonical name
      statTypeLookupMap.set(stat.canonical.toLowerCase(), stat);
      
      // Add all aliases
      for (const alias of stat.aliases) {
        statTypeLookupMap.set(alias.toLowerCase(), stat);
      }
    }
    
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize lookup maps:', error);
  }
}

/**
 * Ensure lookup maps are initialized
 */
function ensureInitialized(): void {
  if (!initialized) {
    initializeLookupMaps();
  }
}

// ============================================================================
// TEAM NORMALIZATION
// ============================================================================

/**
 * Normalizes a team name to its canonical form.
 * Handles various formats like "PHO Suns", "Phoenix Suns", "Suns", "PHX" → "Phoenix Suns"
 */
export function normalizeTeamName(teamName: string): string {
  if (!teamName) return teamName;
  
  ensureInitialized();
  
  const normalized = teamName.trim();
  const lowerSearch = normalized.toLowerCase();
  
  // Try exact match using lookup map (O(1) performance)
  const teamInfo = teamLookupMap.get(lowerSearch);
  if (teamInfo) {
    return teamInfo.canonical;
  }
  
  // If no exact match, try partial matching for compound names
  const teams = Array.from(teamLookupMap.values());
  const uniqueTeams = Array.from(new Map(teams.map(t => [t.canonical, t])).values());
  
  for (const team of uniqueTeams) {
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
 */
export function getSportForTeam(teamName: string): Sport | undefined {
  if (!teamName) return undefined;
  
  ensureInitialized();
  
  const lowerSearch = teamName.trim().toLowerCase();
  const teamInfo = teamLookupMap.get(lowerSearch);
  
  if (teamInfo) {
    return teamInfo.sport as Sport;
  }
  
  // Fallback to full normalization if not found in lookup
  const canonical = normalizeTeamName(teamName);
  const canonicalInfo = teamLookupMap.get(canonical.toLowerCase());
  
  return canonicalInfo?.sport as Sport | undefined;
}

/**
 * Gets team information for a given team name.
 */
export function getTeamInfo(teamName: string): TeamData | undefined {
  if (!teamName) return undefined;
  
  ensureInitialized();
  
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
 */
export function normalizeStatType(statType: string, sport?: Sport): string {
  if (!statType) return statType;
  
  ensureInitialized();
  
  const normalized = statType.trim();
  const lowerSearch = normalized.toLowerCase();
  
  // Try exact match using lookup map (O(1) performance)
  const statInfo = statTypeLookupMap.get(lowerSearch);
  
  // If sport context provided, verify the stat matches the sport
  if (statInfo) {
    if (sport && statInfo.sport !== sport) {
      // Look for a sport-specific match
      const statTypes = Array.from(statTypeLookupMap.values());
      const uniqueStatTypes = Array.from(new Map(statTypes.map(st => [st.canonical + st.sport, st])).values());
      
      for (const stat of uniqueStatTypes) {
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
 */
export function getStatTypeInfo(statType: string, sport?: Sport): StatTypeData | undefined {
  if (!statType) return undefined;
  
  ensureInitialized();
  
  const lowerSearch = statType.trim().toLowerCase();
  const statInfo = statTypeLookupMap.get(lowerSearch);
  
  // If sport context provided, verify the stat matches the sport
  if (statInfo) {
    if (sport && statInfo.sport !== sport) {
      // Look for a sport-specific match
      const statTypes = Array.from(statTypeLookupMap.values());
      const uniqueStatTypes = Array.from(new Map(statTypes.map(st => [st.canonical + st.sport, st])).values());
      
      for (const stat of uniqueStatTypes) {
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
 */
export function getSportsForStatType(statType: string): Sport[] {
  if (!statType) return [];
  
  ensureInitialized();
  
  const canonical = normalizeStatType(statType);
  const sports: Sport[] = [];
  
  const statTypes = Array.from(statTypeLookupMap.values());
  const uniqueStatTypes = Array.from(new Map(statTypes.map(st => [st.canonical + st.sport, st])).values());
  
  for (const stat of uniqueStatTypes) {
    if (stat.canonical === canonical && !sports.includes(stat.sport as Sport)) {
      sports.push(stat.sport as Sport);
    }
  }
  
  return sports;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Attempts to infer the sport from various context clues.
 */
export function inferSportFromContext(context: {
  team?: string;
  statType?: string;
  description?: string;
}): Sport | undefined {
  ensureInitialized();
  
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
  }
  
  // Try description keywords as last resort
  if (context.description) {
    const lower = context.description.toLowerCase();
    
    const sportKeywords = new Map<Sport, string[]>([
      ['NBA', ['nba', 'basketball']],
      ['NFL', ['nfl', 'football']],
      ['MLB', ['mlb', 'baseball']],
      ['NHL', ['nhl', 'hockey']],
      ['NCAAB', ['ncaab', 'college basketball', 'march madness']],
      ['NCAAF', ['ncaaf', 'college football']],
      ['UFC', ['ufc', 'mma', 'mixed martial arts']],
      ['Soccer', ['soccer', 'football', 'premier league', 'champions league', 'mls']],
      ['Tennis', ['tennis', 'wimbledon', 'us open', 'french open', 'australian open']],
    ]);
    
    for (const [sport, keywords] of sportKeywords.entries()) {
      if (keywords.some(kw => lower.includes(kw))) {
        return sport;
      }
    }
  }
  
  return undefined;
}

/**
 * Checks if a team name is recognized in the system.
 */
export function isKnownTeam(teamName: string): boolean {
  return getTeamInfo(teamName) !== undefined;
}

/**
 * Checks if a stat type is recognized in the system.
 */
export function isKnownStatType(statType: string): boolean {
  return getStatTypeInfo(statType) !== undefined;
}

// Main market and future type normalization remain unchanged for now
// as they don't need the same level of customization

export function normalizeMainMarketType(marketType: string): string {
  // Simple mapping for now
  const mappings: {[key: string]: string} = {
    'ml': 'Moneyline',
    'money line': 'Moneyline',
    'moneyline': 'Moneyline',
    'point spread': 'Spread',
    'spread': 'Spread',
    'o/u': 'Total',
    'total': 'Total',
    'totals': 'Total',
    'over/under': 'Total'
  };
  
  return mappings[marketType.toLowerCase()] || marketType;
}

export function normalizeFutureType(futureType: string, sport?: Sport): string {
  // Simple mapping for now
  return futureType;
}

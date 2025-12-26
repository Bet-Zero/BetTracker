/**
 * Parser Registry - Centralized Parser Registration and Discovery
 * 
 * This module provides a single source of truth for all registered sportsbook parsers.
 * It manages parser availability, enabling the UI to show only parsers that actually work.
 * 
 * @module parsing/parserRegistry
 */

import { SportsbookName } from '../types';
import { ParserFunction } from './parserContract';
import { parse as parseFanDuel } from './fanduel/fanduel';
import { parse as parseDraftKings } from './draftkings/parsers';

// ============================================================================
// PARSER REGISTRATION
// ============================================================================

/**
 * Parser registration entry.
 */
export interface ParserEntry {
  /** The parser function */
  parser: ParserFunction;
  /** Whether the parser is fully implemented and enabled */
  enabled: boolean;
  /** Human-readable description of parser status */
  status: 'implemented' | 'in_progress' | 'template' | 'disabled';
  /** Optional notes about the parser */
  notes?: string;
}

/**
 * Registry of all sportsbook parsers.
 * 
 * IMPORTANT: Only add parsers here that are actually implemented.
 * Parsers with enabled=false will show a clear "not available" message.
 * 
 * To add a new sportsbook:
 * 1. Create parser in parsing/{sportsbook}/parsers/index.ts
 * 2. Import the parser here
 * 3. Add entry to PARSER_REGISTRY with enabled=true once implemented
 * 4. Update useInputs.tsx defaultSportsbooks if needed
 */
const PARSER_REGISTRY: Record<string, ParserEntry> = {
  'FanDuel': {
    parser: parseFanDuel,
    enabled: true,
    status: 'implemented',
    notes: 'Full support for singles, parlays, SGP, SGP+'
  },
  'DraftKings': {
    parser: parseDraftKings,
    enabled: true,
    status: 'implemented',
    notes: 'Full support for singles, parlays, SGP, SGP+'
  },
  // Template entry for "Other" - serves as documentation for unsupported sportsbooks
  'Other': {
    parser: () => [], // Placeholder - returns empty array
    enabled: false,
    status: 'disabled',
    notes: 'No parser implemented. Use this to track unsupported sportsbooks.'
  }
};

// ============================================================================
// REGISTRY FUNCTIONS
// ============================================================================

/**
 * Gets all registered sportsbook names.
 * Includes both enabled and disabled parsers.
 */
export function getRegisteredSportsbooks(): string[] {
  return Object.keys(PARSER_REGISTRY);
}

/**
 * Gets all sportsbooks with enabled (working) parsers.
 * Use this to populate UI dropdowns when you only want working options.
 */
export function getEnabledSportsbooks(): string[] {
  return Object.entries(PARSER_REGISTRY)
    .filter(([_, entry]) => entry.enabled)
    .map(([name]) => name);
}

/**
 * Gets all sportsbooks with their enabled status.
 * Use this to show all options with availability indicators.
 */
export function getSportsbookStatus(): Array<{
  name: string;
  enabled: boolean;
  status: ParserEntry['status'];
  notes?: string;
}> {
  return Object.entries(PARSER_REGISTRY).map(([name, entry]) => ({
    name,
    enabled: entry.enabled,
    status: entry.status,
    notes: entry.notes
  }));
}

/**
 * Checks if a parser is registered and enabled for the given sportsbook.
 * 
 * @param sportsbook - The sportsbook name to check
 * @returns true if parser exists and is enabled
 */
export function isParserEnabled(sportsbook: SportsbookName): boolean {
  const entry = PARSER_REGISTRY[sportsbook];
  return entry?.enabled === true;
}

/**
 * Checks if a sportsbook is registered (regardless of enabled status).
 * 
 * @param sportsbook - The sportsbook name to check
 * @returns true if sportsbook is in the registry
 */
export function isParserRegistered(sportsbook: SportsbookName): boolean {
  return sportsbook in PARSER_REGISTRY;
}

/**
 * Gets the parser function for a sportsbook.
 * Returns null if sportsbook is not registered.
 * 
 * IMPORTANT: Check isParserEnabled() before calling this if you need a working parser.
 * 
 * @param sportsbook - The sportsbook name
 * @returns Parser function or null if not found
 */
export function getParser(sportsbook: SportsbookName): ParserFunction | null {
  const entry = PARSER_REGISTRY[sportsbook];
  return entry?.parser ?? null;
}

/**
 * Gets the full parser entry for a sportsbook.
 * Includes parser function, enabled status, and metadata.
 * 
 * @param sportsbook - The sportsbook name
 * @returns Parser entry or null if not found
 */
export function getParserEntry(sportsbook: SportsbookName): ParserEntry | null {
  return PARSER_REGISTRY[sportsbook] ?? null;
}

/**
 * Gets a user-friendly message explaining why a sportsbook parser is unavailable.
 * 
 * @param sportsbook - The sportsbook name
 * @returns Message string suitable for UI display
 */
export function getParserUnavailableMessage(sportsbook: SportsbookName): string {
  const entry = PARSER_REGISTRY[sportsbook];
  
  if (!entry) {
    return `No parser has been created for "${sportsbook}". Only FanDuel and DraftKings are currently supported.`;
  }
  
  switch (entry.status) {
    case 'in_progress':
      return `The parser for "${sportsbook}" is currently in development. Please check back later.`;
    case 'template':
      return `"${sportsbook}" is a template parser for demonstration purposes only.`;
    case 'disabled':
      return `Parsing for "${sportsbook}" is not yet implemented. ${entry.notes || ''}`.trim();
    default:
      return `Parser for "${sportsbook}" is currently unavailable.`;
  }
}

// ============================================================================
// TYPE EXPORTS FOR CONSUMERS
// ============================================================================

export type { ParserEntry };

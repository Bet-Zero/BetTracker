/**
 * Alias-Aware Matching Utility
 * 
 * Provides functions for matching user input against options that have
 * multiple search terms (value, label, aliases).
 * 
 * Used by TypableDropdown for smart typeahead where users can search
 * by full names/aliases but the stored value is a short code.
 */

/**
 * Structured option for dropdown with alias support.
 */
export interface DropdownOption {
  value: string;      // Stored in cell (e.g., "DK", "Pts")
  label: string;      // Human-readable display (e.g., "DraftKings", "Points")
  aliases: string[];  // Additional search terms
}

/**
 * Scoring constants for match types (higher = better match).
 */
const SCORE = {
  EXACT_VALUE:     100,  // Exact match on value (code)
  EXACT_LABEL:      90,  // Exact match on label
  EXACT_ALIAS:      80,  // Exact match on alias
  PREFIX_LABEL:     70,  // Prefix match on label
  PREFIX_ALIAS:     60,  // Prefix match on alias
  WORD_BOUNDARY:    40,  // Query matches a whole token in label/alias
  SUBSTRING:        10,  // Substring match anywhere (weakest)
  NO_MATCH:          0,
};

/**
 * Normalize a string for search comparison.
 * - Lowercase
 * - Trim whitespace
 * - Remove common punctuation
 * 
 * @param str - Input string to normalize
 * @returns Normalized string
 */
export function normalizeForSearch(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[.\-_']/g, "")  // Remove dots, dashes, underscores, apostrophes
    .replace(/\s+/g, " ");    // Normalize multiple spaces to single
}

/**
 * Tokenize a string into words for word-boundary matching.
 */
function tokenize(str: string): string[] {
  return normalizeForSearch(str).split(/\s+/).filter(Boolean);
}

/**
 * Count words/tokens in a string.
 */
function wordCount(str: string): number {
  return tokenize(str).length;
}

/**
 * Check if query matches as a word boundary in the target string.
 * Word boundary = query matches a complete token in the target.
 */
function isWordBoundaryMatch(normalizedQuery: string, normalizedTarget: string): boolean {
  const tokens = normalizedTarget.split(/\s+/);
  return tokens.some(token => token === normalizedQuery);
}

/**
 * Score how well a query matches a single string target.
 * @returns Score: exact(100/90/80), prefix(70/60), word_boundary(40), substring(10), or 0
 */
function scoreStringMatch(
  normalizedQuery: string,
  normalizedTarget: string,
  exactScore: number,
  prefixScore: number
): number {
  if (!normalizedTarget) return SCORE.NO_MATCH;
  
  // Exact match
  if (normalizedTarget === normalizedQuery) {
    return exactScore;
  }
  
  // Prefix match
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return prefixScore;
  }
  
  // Word-boundary match
  if (isWordBoundaryMatch(normalizedQuery, normalizedTarget)) {
    return SCORE.WORD_BOUNDARY;
  }
  
  // Substring match
  if (normalizedTarget.includes(normalizedQuery)) {
    return SCORE.SUBSTRING;
  }
  
  return SCORE.NO_MATCH;
}

/**
 * Score how well a query matches an option.
 * Returns the best (highest) score across value, label, and aliases.
 * 
 * @param query - User's search input
 * @param option - Option to score
 * @returns Numeric score (higher = better match, 0 = no match)
 */
export function scoreMatch(query: string, option: DropdownOption): number {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return SCORE.EXACT_VALUE; // Empty query matches all with max score
  
  let bestScore = SCORE.NO_MATCH;
  
  // Score against value (code) - highest priority for exact/prefix
  const valueScore = scoreStringMatch(
    normalizedQuery,
    normalizeForSearch(option.value),
    SCORE.EXACT_VALUE,
    SCORE.PREFIX_LABEL  // Prefix on value treated same as prefix on label
  );
  bestScore = Math.max(bestScore, valueScore);
  
  // Score against label
  const labelScore = scoreStringMatch(
    normalizedQuery,
    normalizeForSearch(option.label),
    SCORE.EXACT_LABEL,
    SCORE.PREFIX_LABEL
  );
  bestScore = Math.max(bestScore, labelScore);
  
  // Score against each alias
  for (const alias of option.aliases) {
    const aliasScore = scoreStringMatch(
      normalizedQuery,
      normalizeForSearch(alias),
      SCORE.EXACT_ALIAS,
      SCORE.PREFIX_ALIAS
    );
    bestScore = Math.max(bestScore, aliasScore);
  }
  
  return bestScore;
}

/**
 * Check if a query matches an option.
 * Matches if the normalized query is a prefix or substring of:
 * - The value (code)
 * - The label (full name)
 * - Any alias
 * 
 * @param query - User's search input
 * @param option - Option to check against
 * @returns true if query matches
 */
export function matchesOption(query: string, option: DropdownOption): boolean {
  return scoreMatch(query, option) > SCORE.NO_MATCH;
}

/**
 * Compare two options for sorting by match score and tie-breakers.
 * 
 * Tie-breakers (in order):
 * A) Prefer shorter label length
 * B) Prefer fewer words/tokens in label
 * C) Prefer shorter value/code length
 * D) Stable alphabetical by label/value
 */
function compareOptions(
  a: { option: DropdownOption; score: number },
  b: { option: DropdownOption; score: number }
): number {
  // Primary: higher score wins
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  
  // Tie-breaker A: shorter label
  const aLabelLen = a.option.label.length;
  const bLabelLen = b.option.label.length;
  if (aLabelLen !== bLabelLen) {
    return aLabelLen - bLabelLen;
  }
  
  // Tie-breaker B: fewer words in label
  const aWordCount = wordCount(a.option.label);
  const bWordCount = wordCount(b.option.label);
  if (aWordCount !== bWordCount) {
    return aWordCount - bWordCount;
  }
  
  // Tie-breaker C: shorter value
  const aValueLen = a.option.value.length;
  const bValueLen = b.option.value.length;
  if (aValueLen !== bValueLen) {
    return aValueLen - bValueLen;
  }
  
  // Tie-breaker D: alphabetical by label, then value
  const labelCmp = a.option.label.localeCompare(b.option.label);
  if (labelCmp !== 0) return labelCmp;
  
  return a.option.value.localeCompare(b.option.value);
}

/**
 * Filter and rank options by a search query using alias matching.
 * Returns options sorted by match quality (best first).
 * 
 * @param query - User's search input
 * @param options - Array of options to filter and rank
 * @returns Filtered and sorted options (best match first)
 */
export function filterOptionsByQuery(
  query: string,
  options: DropdownOption[]
): DropdownOption[] {
  if (!query || !query.trim()) return options;
  
  // Score all options
  const scored = options.map(option => ({
    option,
    score: scoreMatch(query, option)
  }));
  
  // Filter to matches only
  const matches = scored.filter(s => s.score > SCORE.NO_MATCH);
  
  // Sort by score and tie-breakers
  matches.sort(compareOptions);
  
  // Return just the options
  return matches.map(s => s.option);
}

/**
 * Format an option for display in dropdown.
 * Shows as "value — label" (e.g., "DK — DraftKings")
 * 
 * @param option - Option to format
 * @returns Display string
 */
export function formatOptionDisplay(option: DropdownOption): string {
  if (option.label && option.label !== option.value) {
    return `${option.value} — ${option.label}`;
  }
  return option.value;
}

/**
 * Find an option by its value.
 * 
 * @param value - Value to search for
 * @param options - Options to search in
 * @returns The matching option or undefined
 */
export function findOptionByValue(
  value: string,
  options: DropdownOption[]
): DropdownOption | undefined {
  const normalizedValue = normalizeForSearch(value);
  return options.find(
    (opt) => normalizeForSearch(opt.value) === normalizedValue
  );
}

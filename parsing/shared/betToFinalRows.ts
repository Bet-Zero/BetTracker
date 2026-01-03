/**
 * Bet to FinalRow Converter
 *
 * This module converts Bet objects (from parsers) into FinalRow format
 * for display and editing in the spreadsheet-like UI.
 *
 * KEY PRINCIPLES:
 * - Name: SUBJECT ONLY (player/team name from entities/leg.name)
 * - Type: Depends on Category:
 *   - Props → stat type code (Pts, Ast, 3pt, Reb, PRA, etc.) from market text
 *   - Main → {Spread, Total, Moneyline} from market text
 *   - Futures → {Win Total, NBA Finals, Super Bowl, etc.} from market text
 *   - Type must NEVER contain bet form concepts (single/parlay/sgp/etc.)
 * - One FinalRow per leg for multi-leg bets (parlays/SGPs produce multiple rows)
 * - Over/Under: "1"/"0" flags (or "" when not applicable)
 * - Live: "1" or "" flag (uses bet.isLive boolean, not bet.betType)
 * 
 * CLASSIFICATION: All market classification logic has been moved to
 * services/marketClassification.ts. This module imports and uses that service.
 */

import {
  Bet,
  BetLeg,
  FinalRow,
  LegResult,
  BetResult,
  OverUnderFlag,
} from "../../types";
import {
  toFinalResult,
  toOverUnderFlag,
  toSingleFlag,
  formatOdds as formatOddsValidator,
  formatAmount,
  formatNet,
  calculateFormattedNet,
} from "./finalRowValidators";
import { classifyLeg, determineType, determineParlayType, normalizeCategoryForDisplay } from "../../services/marketClassification";
import { formatDateShortWithYear } from "../../utils/formatters";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of legs to process per bet.
 * 
 * This limit prevents parser errors from creating excessive rows that could
 * degrade UI performance. Bets with more legs than this are logged as errors
 * and truncated.
 * 
 * @constant {number}
 */
const MAX_LEGS_PER_BET = 10;

/**
 * Character indicator for milestone bets (e.g., "30+ points").
 * 
 * When a target value contains this character, it indicates a milestone bet
 * which is treated as an Over bet (player must exceed the threshold).
 * 
 * Examples:
 * - "25+ Points" → Over bet
 * - "3+ Made Threes" → Over bet
 * 
 * @constant {string}
 */
const MILESTONE_INDICATOR = '+';

/**
 * Category and type information for bet classification.
 */
interface CategoryAndType {
  category: string;
  type: string;
}

/**
 * NOTE: STAT_TYPE_MAPPINGS, MAIN_MARKET_TYPES, FUTURES_TYPES, and classifyLegCategory
 * have been removed from this file. All classification logic is now in
 * services/marketClassification.ts. Import and use classifyLeg() and determineType()
 * from that service instead.
 */

/**
 * Merges two result values, preferring win > loss > push > pending.
 * @param result1 - First result value
 * @param result2 - Second result value
 * @returns The preferred result value, or undefined if both inputs are undefined
 */
function mergeResults(
  result1?: LegResult | BetResult,
  result2?: LegResult | BetResult
): LegResult | BetResult | undefined {
  const priority: Record<string, number> = {
    win: 4,
    loss: 3,
    push: 2,
    pending: 1,
  };

  const getPriority = (r?: LegResult | BetResult): number => {
    if (!r) return 0;
    // Both LegResult and BetResult are string literal unions, so r is a string here
    if (typeof r !== "string") {
      console.error(`mergeResults: Expected string but got ${typeof r}: ${r}`);
      return 0;
    }
    const rLower = r.toLowerCase();
    const priorityValue = priority[rLower];
    // Detect when r is defined but not present in the priority map
    if (priorityValue === undefined) {
      console.error(
        `mergeResults: Unexpected result value "${r}" (normalized: "${rLower}") not found in priority map. Keys: ${Object.keys(priority).join(',')}`
      );
    }
    return priorityValue ?? 0;
  };

  const p1 = getPriority(result1);
  const p2 = getPriority(result2);

  return p1 >= p2 ? result1 : result2;
}

/**
 * Normalizes odds value: converts 0 or undefined to undefined.
 * Treats 0 as missing since 0 is not a valid American odds value.
 * Only accepts whole-number American odds (integers); rejects decimal odds.
 * @param odds - The odds value to normalize (number | undefined)
 * @param context - Optional context information for warning messages
 * @returns undefined if odds is 0, undefined, or non-integer; otherwise returns the number
 */
function normalizeOdds(
  odds: number | undefined,
  context?: string
): number | undefined {
  if (odds === undefined || odds === 0) {
    return undefined;
  }
  if (!Number.isInteger(odds)) {
    const contextMsg = context ? ` (${context})` : "";
    console.warn(
      `Non-integer odds detected: ${odds}${contextMsg}. Only whole-number American odds are accepted.`
    );
    return undefined;
  }
  return odds;
}

/**
 * Merges two odds values by normalizing both and returning the first non-undefined result.
 * Treats 0 as missing (normalized to undefined) before merging.
 * @param odds1 - First odds value to merge
 * @param odds2 - Second odds value to merge
 * @returns The first normalized non-undefined odds value, or undefined if both normalize to undefined
 */
function mergeOdds(
  odds1: number | undefined,
  odds2: number | undefined
): number | undefined {
  const normalized1 = normalizeOdds(odds1);
  if (normalized1 !== undefined) {
    return normalized1;
  }
  return normalizeOdds(odds2);
}


/**
 * Gets the parlay label based on bet type.
 */
function getParlayLabel(bet: Bet): string {
  if (bet.betType === "sgp_plus") return "SGP+";
  if (bet.betType === "sgp") return "SGP";
  return "Parlay";
}

/**
 * Classifies a leg and extracts entity names.
 * @returns Object with category, type, name, and name2 (for totals)
 */
function classifyAndExtractLegData(
  leg: BetLeg,
  sport: string
): {
  category: string;
  type: string;
  name: string;
  name2: string | undefined;
} {
  // Classify category and type using unified classification service
  const category = classifyLeg(leg.market || "", sport);
  const type = determineType(leg.market || "", category, sport);

  // Totals bets (e.g., "Lakers vs Celtics Total Points") need both team names
  // so we extract entities[0] for Name and entities[1] for Name2
  const isTotalsBet = category === "Main Markets" && type === "Total";

  // Extract names: for totals, use both entities if available
  const name = leg.entities?.[0] || "";
  const name2 =
    isTotalsBet && leg.entities && leg.entities.length >= 2
      ? leg.entities[1]
      : undefined;

  return { category, type, name, name2 };
}

/**
 * Creates a FinalRow for a single leg.
 * Handles both parlay and non-parlay legs with appropriate metadata.
 */
function createLegRow(
  bet: Bet,
  leg: BetLeg,
  sport: string,
  index: number,
  isParlay: boolean,
  parlayGroupId: string | null
): FinalRow {
  const { category, type, name, name2 } = classifyAndExtractLegData(leg, sport);

  const contextInfo = `betId=${bet.id}, market=${leg.market || "N/A"}, entity=${
    name || "N/A"
  }`;
  return createFinalRow(
    bet,
    {
      name: name,
      name2: name2,
      market: leg.market,
      target: leg.target,
      ou: leg.ou,
      result: leg.result,
      odds: normalizeOdds(leg.odds, contextInfo), // Normalize: convert 0 to undefined, reject non-integer odds
    },
    {
      parlayGroupId: isParlay ? parlayGroupId : null,
      legIndex: isParlay ? index + 1 : null,
      legCount: null,
      isParlayHeader: false,
      isParlayChild: isParlay,
      showMonetaryValues: !isParlay,
    },
    {
      category: category,
      type: type,
    }
  );
}

/**
 * Converts a Bet to one or more FinalRow objects.
 * Multi-leg bets produce one FinalRow per leg.
 *
 * @param bet - The Bet object from the parser
 * @returns Array of FinalRow objects (one per leg, or one for single bets)
 */
export function betToFinalRows(bet: Bet): FinalRow[] {
  const rows: FinalRow[] = [];

  // Determine if we have legs to process
  const hasLegs = bet.legs && bet.legs.length > 0;

  // Drop placeholder SGP container legs that don't have entities/children,
  // then flatten group legs (SGP+ inner SGP) so UI shows the actual selections.
  const normalizedLegs = hasLegs
    ? bet.legs!.filter((leg) => {
        const market = (leg.market || "").toLowerCase();
        const isSgpPlaceholder =
          market.includes("same game parlay") &&
          (!leg.entities || !leg.entities.length) &&
          (!leg.children || !leg.children.length);
        return !isSgpPlaceholder;
      })
    : [];

  const expandedLegs = normalizedLegs.flatMap((leg) => {
    if (leg.isGroupLeg) {
      // If we have children, use them; if not, drop the placeholder leg entirely
      return leg.children && leg.children.length ? leg.children : [];
    }
    return leg;
  });

  // Parsers are responsible for deduplicating legs.
  // FanDuel and DraftKings parsers both call dedupeLegs() before returning.
  const isParlay = hasLegs && expandedLegs.length > 1;
  const parlayGroupId = isParlay ? bet.id : null;

  if (!hasLegs) {
    // Single bet without structured legs - use bet-level fields
    const row = createFinalRow(
      bet,
      {
        name: bet.name || "",
        market: bet.type || "",
        target: bet.line,
        ou: bet.ou,
        result: bet.result,
      },
      {
        parlayGroupId: null,
        legIndex: null,
        legCount: null,
        isParlayHeader: false,
        isParlayChild: false,
        showMonetaryValues: true,
      },
      undefined // No pre-determined category/type for single bets
    );
    rows.push(row);
  } else {
    // Bet with structured legs - create one row per leg
    // Safety check: Limit legs to prevent parsing errors from creating thousands of rows
    const legsToProcess =
      expandedLegs.length > MAX_LEGS_PER_BET
        ? expandedLegs.slice(0, MAX_LEGS_PER_BET)
        : expandedLegs;

    if (expandedLegs.length > MAX_LEGS_PER_BET) {
      console.error(
        `betToFinalRows: Bet ${bet.betId} has ${expandedLegs.length} legs - limiting to ${MAX_LEGS_PER_BET} to prevent excessive rows`
      );
    }

    if (isParlay) {
      // For parlays, create a separate header row that doesn't consume any leg
      const headerRow = createFinalRow(
        bet,
        {
          name: `${getParlayLabel(bet)} (${legsToProcess.length})`,
          name2: undefined,
          market: "",
          target: undefined,
          ou: undefined,
          result: bet.result,
        },
        {
          parlayGroupId: parlayGroupId,
          legIndex: null,
          legCount: Math.min(expandedLegs.length, MAX_LEGS_PER_BET),
          isParlayHeader: true,
          isParlayChild: false,
          showMonetaryValues: true,
        },
        {
          category: "Parlays",
          type: determineParlayType(bet.betType),
        }
      );
      rows.push(headerRow);

      // Now create rows for all legs as child rows
      legsToProcess.forEach((leg, index) => {
        const row = createLegRow(
          bet,
          leg,
          bet.sport || "",
          index,
          isParlay,
          parlayGroupId
        );
        rows.push(row);
      });
    } else {
      // For non-parlay bets with legs, create one row per leg (no header)
      legsToProcess.forEach((leg, index) => {
        const row = createLegRow(
          bet,
          leg,
          bet.sport || "",
          index,
          isParlay,
          parlayGroupId
        );
        rows.push(row);
      });
    }
  }

  return rows;
}

/**
 * Creates a single FinalRow from a Bet and leg data.
 * @param metadata - Parlay metadata and display flags
 * @param categoryAndType - Optional pre-determined category and type (used for parlay legs)
 */
function createFinalRow(
  bet: Bet,
  legData: {
    name: string;
    name2?: string;
    market: string;
    target?: string | number;
    ou?: "Over" | "Under";
    result: string;
    odds?: number; // Leg odds - undefined or valid odds (0 treated as missing and normalized to undefined)
  },
  metadata: {
    parlayGroupId: string | null;
    legIndex: number | null;
    legCount: number | null;
    isParlayHeader: boolean;
    isParlayChild: boolean;
    showMonetaryValues: boolean;
  },
  categoryAndType?: CategoryAndType
): FinalRow {
  // Format date to MM/DD/YY (formatDateShortWithYear handles null/invalid input safely)
  const date = formatDateShortWithYear(bet.placedAt);

  // Site abbreviation or full name
  const site = bet.book;

  // Sport
  const sport = bet.sport || "";

  // Determine category and type
  let category: string;
  let type: string;

  if (categoryAndType) {
    // Use caller-provided category and type (caller is single source of truth)
    category = categoryAndType.category;
    type = categoryAndType.type;
  } else {
    // Compute from bet-level data when categoryAndType not provided
    category = normalizeCategoryForDisplay(bet.marketCategory);
    // determineType expects 'Main Markets' but normalize returns 'Main'
    const typeCategory = category === "Main" ? "Main Markets" : category;
    type = determineType(legData.market, typeCategory, bet.sport || "");
  }

  // Name: SUBJECT ONLY (player/team from entities)
  const name = legData.name;
  const name2 = legData.name2;

  // Over/Under flags
  const { over, under } = determineOverUnder(legData.ou, legData.target);

  // Line
  const line = formatLine(legData.target);

  // Odds: For parlay children, use leg odds if available; otherwise use bet odds for headers
  let odds;
  if (
    metadata.isParlayChild &&
    legData.odds !== undefined &&
    legData.odds !== null
  ) {
    // For parlay children, show individual leg odds if available
    // (0 is already normalized to undefined at call sites, so this check is sufficient)
    odds = formatOddsValidator(legData.odds);
  } else if (metadata.showMonetaryValues) {
    // For headers and non-parlay bets, show bet-level odds
    odds = formatOddsValidator(bet.odds ?? undefined);
  } else {
    odds = formatOddsValidator(undefined);
  }

  // Monetary values - only show on header rows for parlays
  const betAmount = metadata.showMonetaryValues
    ? formatAmount(bet.stake)
    : formatAmount(undefined);
  const toWin = metadata.showMonetaryValues
    ? formatAmount(calculateToWin(bet.stake, bet.odds, bet.payout))
    : formatAmount(undefined);

  // Result - header shows bet.result, children show leg.result
  const resultValue = metadata.isParlayHeader ? bet.result : legData.result;
  const result = toFinalResult(resultValue);

  // Net (profit/loss) - only on header rows, use bet result for parlays
  // NOTE: For parlay children, showMonetaryValues is false, so this code path
  // is not hit. If that ever changes, the logic here uses bet.result (the overall
  // parlay result) rather than the leg's individual result. This is intentional
  // because parlay net depends on the overall outcome, not individual legs.
  // See Issue #8 in backend_data_wiring_audit.md for discussion.
  let net;
  if (metadata.showMonetaryValues) {
    const netResult = metadata.isParlayChild ? bet.result : legData.result;
    net = calculateFormattedNet(netResult, bet.stake, bet.odds, bet.payout);
  } else {
    net = formatNet(undefined);
  }

  // Live flag (uses isLive boolean field on Bet, not betType which is 'single'|'parlay'|'sgp'|'live'|'other')
  const live = toSingleFlag(bet.isLive);

  // Tail
  const tail = toSingleFlag(!!bet.tail);

  // Calculate raw numeric values for editing/calculations
  // These avoid string parsing in BetTableView
  let rawOdds: number | undefined;
  if (
    metadata.isParlayChild &&
    legData.odds !== undefined &&
    legData.odds !== null
  ) {
    rawOdds = legData.odds;
  } else if (metadata.showMonetaryValues) {
    rawOdds = bet.odds ?? undefined;
  }

  const rawBet = metadata.showMonetaryValues ? bet.stake : undefined;
  const rawToWin = metadata.showMonetaryValues
    ? calculateToWin(bet.stake, bet.odds, bet.payout)
    : undefined;

  // Calculate raw net value
  let rawNet: number | undefined;
  if (metadata.showMonetaryValues) {
    const netResult = metadata.isParlayChild ? bet.result : legData.result;
    rawNet = calculateRawNet(netResult, bet.stake, bet.odds, bet.payout);
  }

  return {
    Date: date,
    Site: site,
    Sport: sport,
    Category: category,
    Type: type,
    Name: name,
    Name2: name2,
    Over: over,
    Under: under,
    Line: line,
    Odds: odds,
    Bet: betAmount,
    "To Win": toWin,
    Result: result,
    Net: net,
    Live: live,
    Tail: tail,
    _parlayGroupId: metadata.parlayGroupId,
    _legIndex: metadata.legIndex,
    _legCount: metadata.legCount,
    _isParlayHeader: metadata.isParlayHeader,
    _isParlayChild: metadata.isParlayChild,
    // Raw numeric values for editing/calculations
    _rawOdds: rawOdds,
    _rawBet: rawBet,
    _rawToWin: rawToWin,
    _rawNet: rawNet,
  };
}

/**
 * NOTE: normalizeCategory has been removed from this file.
 * Use normalizeCategoryForDisplay from services/marketClassification.ts instead.
 * 
 * NOTE: determineType has been removed from this file.
 * Use determineType from services/marketClassification.ts instead.
 */

/**
 * Determines Over/Under flags based on leg data.
 */
function determineOverUnder(
  ou?: "Over" | "Under",
  target?: string | number
): { over: OverUnderFlag; under: OverUnderFlag } {
  if (ou === "Over") {
    return { over: toOverUnderFlag(true), under: toOverUnderFlag(false) };
  }
  if (ou === "Under") {
    return { over: toOverUnderFlag(false), under: toOverUnderFlag(true) };
  }

  // Check if target has "+" (milestone bet)
  if (target && target.toString().includes(MILESTONE_INDICATOR)) {
    return { over: toOverUnderFlag(true), under: toOverUnderFlag(false) };
  }

  // Default: both blank for non-O/U bets
  return {
    over: toOverUnderFlag(undefined),
    under: toOverUnderFlag(undefined),
  };
}

/**
 * Formats line value.
 * Treats 0 and "0" as valid values (not empty).
 */
function formatLine(target?: string | number): string {
  if (target === undefined || target === null || target === "") {
    return "";
  }
  return target.toString();
}

/**
 * Formats odds with appropriate sign.
 * @deprecated Use formatOddsValidator from finalRowValidators instead.
 * This function is kept for backward compatibility but should be replaced.
 */
function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

/**
 * Calculates To Win amount (stake + potential profit).
 */
function calculateToWin(
  stake: number,
  odds?: number | null,
  payout?: number
): number | undefined {
  if (payout !== undefined && payout > 0) {
    return payout;
  }

  if (odds === undefined || odds === null) {
    return undefined;
  }

  const numericOdds = Number(odds);
  if (Number.isNaN(numericOdds)) {
    return undefined;
  }

  let profit = 0;

  if (numericOdds > 0) {
    profit = stake * (numericOdds / 100);
  } else if (numericOdds < 0) {
    profit = stake / (Math.abs(numericOdds) / 100);
  }

  return stake + profit;
}

/**
 * Calculates Net profit/loss.
 */
/**
 * Calculates Net profit or loss value as a number.
 * Shared helper for both formatted string output and raw numeric output.
 * @returns number representing profit/loss, or undefined if calculation not possible
 */
function computeNetNumeric(
  result: string,
  stake: number,
  odds?: number | null,
  payout?: number
): number | undefined {
  const resultLower = result.toLowerCase();

  if (resultLower === "win") {
    // Use payout if available, otherwise calculate from odds
    if (payout !== undefined && payout > 0) {
      return payout - stake;
    }

    // Calculate from odds
    if (odds === undefined || odds === null) {
      return undefined;
    }

    const numericOdds = Number(odds);
    if (Number.isNaN(numericOdds)) {
      return undefined;
    }

    let profit = 0;
    if (numericOdds > 0) {
      profit = stake * (numericOdds / 100);
    } else if (numericOdds < 0) {
      profit = stake / (Math.abs(numericOdds) / 100);
    }
    return profit;
  }

  if (resultLower === "loss") {
    return -stake;
  }

  if (resultLower === "push") {
    return 0;
  }

  // INTENTIONAL DIVERGENCE from displaySemantics.getNetNumeric():
  // This function returns `undefined` for pending bets (for display as empty string),
  // while displaySemantics.getNetNumeric() returns 0 for pending (for KPI calculations).
  // This is correct: pending bets should show blank in the table but contribute 0 to totals.
  // See Issue #1 in backend_data_wiring_audit.md for discussion.
  return undefined;
}

/**
 * Calculates Net profit/loss.
 */
function calculateNet(
  result: string,
  stake: number,
  odds?: number | null,
  payout?: number
): string {
  const net = computeNetNumeric(result, stake, odds, payout);
  if (net === undefined) {
    return "";
  }
  return net.toFixed(2);
}

/**
 * Calculates raw Net profit/loss as a number.
 * Returns undefined for pending bets or when calculation is not possible.
 */
function calculateRawNet(
  result: string,
  stake: number,
  odds?: number | null,
  payout?: number
): number | undefined {
  return computeNetNumeric(result, stake, odds, payout);
}



/**
 * Capitalizes first letter of a string.
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

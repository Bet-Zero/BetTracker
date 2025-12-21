import { Bet, BetLeg, BetResult } from "../../../types";
import { collectLeafLegs } from "../../utils/legs";
import {
  FooterMeta,
  HeaderInfo,
  normalizeSpaces,
  parseMoney,
  extractLeagueFromEventCard,
  extractNameAndType,
  extractLineAndOu,
  extractTeamNamesFromEventCard,
  extractTeamNickname,
} from "./common";

export interface ParlayBetContext {
  element: Element;
  header: HeaderInfo;
  footer: FooterMeta;
  betType?: "parlay" | "sgp" | "sgp_plus";
}

const isBetResult = (value: unknown): value is BetResult =>
  value === "win" ||
  value === "loss" ||
  value === "push" ||
  value === "pending";

/**
 * Defensive runtime validation to ensure required DraftKings parlay context
 * fields are present before parsing.
 */
function assertValidParlayBetContext(
  ctx: ParlayBetContext | null | undefined
): asserts ctx is ParlayBetContext {
  if (!ctx) {
    throw new Error("ParlayBetContext is required");
  }

  const { element, header, footer } = ctx;

  if (!element || typeof element.querySelector !== "function") {
    throw new Error(
      "ParlayBetContext.element is required and must be a DOM Element"
    );
  }

  if (!header || typeof header !== "object") {
    throw new Error("ParlayBetContext.header is required");
  }
  if (!header.betId || typeof header.betId !== "string") {
    throw new Error("ParlayBetContext.header.betId is required");
  }
  if (!header.placedAt || typeof header.placedAt !== "string") {
    throw new Error("ParlayBetContext.header.placedAt is required");
  }

  if (!footer || typeof footer !== "object") {
    throw new Error("ParlayBetContext.footer is required");
  }

  const isNumberOrNull = (value: unknown): value is number | null =>
    typeof value === "number" || value === null;

  if (!isNumberOrNull(footer.stake)) {
    throw new Error("ParlayBetContext.footer.stake must be a number or null");
  }
  if (!isNumberOrNull(footer.payout)) {
    throw new Error("ParlayBetContext.footer.payout must be a number or null");
  }
  if (footer.result !== null && !isBetResult(footer.result)) {
    throw new Error(
      "ParlayBetContext.footer.result must be a BetResult or null"
    );
  }
}

// Maximum recursion depth to prevent stack overflow
const MAX_RECURSION_DEPTH = 10;

// Sentinel value for max depth recursion guard
const MAX_DEPTH_MARKET = "__MAX_DEPTH__";

// Fallback literals centralized for maintenance
const UNKNOWN_SPORT = "Unknown";
const MARKET_CATEGORY_SGP = "SGP/SGP+";
const MARKET_CATEGORY_PARLAY = "Parlays";

function determineBetType(
  element: Element,
  topLevelLegs: BetLeg[],
  betType?: "parlay" | "sgp" | "sgp_plus"
): "parlay" | "sgp" | "sgp_plus" {
  const cardText = element.textContent || "";
  if (/sgpx/i.test(cardText)) {
    return "sgp_plus";
  }
  if (topLevelLegs.some((leg) => leg.isGroupLeg)) {
    return "sgp_plus";
  }
  if (betType === "sgp") {
    return "sgp";
  }
  if (element.querySelector('[data-test-id^="sgp-"]')) {
    return "sgp";
  }
  return "parlay";
}

/**
 * Parses odds text by normalizing spaces, converting unicode minus to ASCII,
 * stripping plus signs, and parsing to integer.
 * @param oddsText - The raw odds text to parse
 * @returns The parsed integer odds, or undefined if parsing fails
 */
function parseOddsText(oddsText: string): number | undefined {
  const normalized = normalizeSpaces(oddsText)
    .replace(/\u2212/g, "-") // Normalize Unicode minus (U+2212) to ASCII minus
    .replace(/\+/g, ""); // Remove all plus signs
  const parsed = parseInt(normalized, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Extracts a single BetLeg from a DOM element. Nested recursion for SGPx.
 * @param legEl - The DOM element containing the leg data
 * @param defaultResult - Default result to use if not found in element
 * @param depth - Current recursion depth (default: 0)
 */
function extractLegFromElement(
  legEl: Element,
  defaultResult: BetResult,
  depth: number = 0
): BetLeg {
  // Enforce maximum depth to prevent stack overflow
  if (depth >= MAX_RECURSION_DEPTH) {
    // Extract minimal identifier for logging context
    const nodeId =
      legEl.getAttribute("data-test-id") ||
      legEl.querySelector("[data-test-id]")?.getAttribute("data-test-id") ||
      legEl.textContent?.slice(0, 30).trim() ||
      "unknown";
    console.warn(
      `[DraftKings parlay parser] Max recursion depth (${depth}) reached at node: ${nodeId}`
    );
    return {
      market: MAX_DEPTH_MARKET,
      result: defaultResult || "pending",
      odds: undefined,
    };
  }

  const leg: BetLeg = {
    market: "",
    result: "pending",
    odds: undefined,
  };

  // 1. Check for Nested Items (Group Leg for SGPx/SGP+)
  // Structure: div class="dkcss-bq9exg" or just checking for nested selection-list-items
  // In Sample:
  // <div data-test-id="selection-list-item"> -> "2 Pick SGP"
  //    <div class="dkcss-bq9exg"> -> Contains nested items

  // Prefer stable data-test-id selector first
  let nestedContainer: Element | null = null;

  const primaryNestedItem = legEl.querySelector(
    'div[data-test-id="selection-list-item"]'
  );

  if (
    primaryNestedItem?.parentElement &&
    primaryNestedItem.parentElement !== legEl
  ) {
    const children = primaryNestedItem.parentElement.querySelectorAll(
      ':scope > div[data-test-id="selection-list-item"]'
    );
    if (children.length > 0) {
      nestedContainer = primaryNestedItem.parentElement;
    }
  }

  // Fallback: try the class-based container if present
  if (!nestedContainer) {
    const classBasedContainer = legEl.querySelector('div[class*="dkcss-"]');
    if (classBasedContainer) {
      const children = classBasedContainer.querySelectorAll(
        ':scope > div[data-test-id="selection-list-item"]'
      );
      if (children.length > 0) {
        nestedContainer = classBasedContainer;
      }
    }
  }

  // Final fallback: find the first parent that directly contains selection-list-item children
  if (!nestedContainer) {
    const allNestedItems = legEl.querySelectorAll(
      'div[data-test-id="selection-list-item"]'
    );
    for (const item of Array.from(allNestedItems)) {
      const parent = item.parentElement;
      if (!parent || parent === legEl) continue;
      const children = parent.querySelectorAll(
        ':scope > div[data-test-id="selection-list-item"]'
      );
      if (children.length > 0 && parent === item.parentElement) {
        nestedContainer = parent;
        break;
      }
    }
  }

  if (nestedContainer) {
    // Validate structure before marking as group leg
    const nChildren = nestedContainer.querySelectorAll(
      ':scope > div[data-test-id="selection-list-item"]'
    );

    if (nChildren.length > 0) {
      leg.isGroupLeg = true;
      leg.children = [];
      nChildren.forEach((child) => {
        leg.children?.push(
          extractLegFromElement(child, defaultResult, depth + 1)
        );
      });
    }
  }

  // 2. Extract Basic Info (Selection / Header)
  // Note: Empty-string fallbacks are intentional when subEl/titleEl are missing.
  // These will be reconciled later (lines ~143-159) with fallback handling, so no action needed here.
  let selectionText = "";
  let targetText = "";

  // Selection/Market Name: div[data-test-id^="bet-selection-subtitle-"] -> "Jordan Hawkins Points"
  const subEl = legEl.querySelector(
    'div[data-test-id^="bet-selection-subtitle-"]'
  );
  if (subEl) {
    selectionText = normalizeSpaces(subEl.textContent || "");
  }

  // If it's a Group Leg, the "Selection" might be the header title (e.g. "2 Pick SGP")
  // In sample: <div data-test-id="bet-selection-title-...">2 Pick SGP</div>
  const titleEl = legEl.querySelector(
    'div[data-test-id^="bet-selection-title-"]'
  );
  if (titleEl) {
    // Distinguish if title is "25+" (target) or "2 Pick SGP" (market for group)
    const t = normalizeSpaces(titleEl.textContent || "");
    if (leg.isGroupLeg) {
      selectionText = t; // "2 Pick SGP"
    } else {
      targetText = t; // "25+" or "18+"
    }
  }

  // For non-group legs, extract player name and stat type from the selection
  if (!leg.isGroupLeg && selectionText) {
    const { name, type } = extractNameAndType(selectionText, targetText);
    if (name) {
      leg.entities = [name];
    }
    // Use the parsed type as market (e.g., "Pts" instead of "Jordan Hawkins Points")
    // Fall back to original text if type extraction fails
    leg.market = type || selectionText;

    // For Total legs, extract both team names from the event card
    if (leg.market.toLowerCase() === "total" || selectionText.toLowerCase().includes("total")) {
      // Find the closest event card to get team names
      const eventCard = legEl.closest('[data-test-id="event-card"]') || 
                        legEl.querySelector('[data-test-id="event-card"]') ||
                        legEl.parentElement?.closest('[data-test-id="event-card"]');
      
      if (eventCard) {
        const [team1, team2] = extractTeamNamesFromEventCard(eventCard);
        if (team1 && team2) {
          const nickname1 = extractTeamNickname(team1);
          const nickname2 = extractTeamNickname(team2);
          leg.entities = [nickname1, nickname2];
          leg.market = "Total"; // Normalize market name
        }
      }
    }
  } else {
    leg.market = selectionText || "Unknown Market";
  }

  // Set target for non-group legs
  if (targetText && !leg.isGroupLeg) {
    leg.target = targetText;
  }

  // 3. Extract Odds (often present on Group Header or single legs)
  const oddsEl = legEl.querySelector(
    'div[data-test-id^="bet-selection-displayOdds-"]'
  );
  if (oddsEl) {
    const oddsValue = parseOddsText(oddsEl.textContent || "");
    if (oddsValue !== undefined) {
      leg.odds = oddsValue;
    }
  }

  // Leaf child odds are cleared because SGP+ groups expose combined odds at the parent level
  // Only clear children when the parent leg's odds are present and valid (combined-odds format)
  if (leg.isGroupLeg && leg.children && leg.odds !== undefined) {
    leg.children = leg.children.map((child) => ({
      ...child,
      // Only clear leaf children; preserve nested group legs' odds
      odds: child.isGroupLeg ? child.odds : undefined,
    }));
  }

  // 4. Extract Result (Icon)
  const icon = legEl.querySelector("svg title");
  const iconCircle = legEl.querySelector("svg circle");

  const classText = [
    legEl.getAttribute("class") || "",
    icon?.parentElement?.getAttribute("class") || "",
    icon?.getAttribute("class") || "",
  ]
    .join(" ")
    .toLowerCase();
  const ariaText = [
    legEl.getAttribute("aria-label") || "",
    legEl.getAttribute("title") || "",
    icon?.parentElement?.getAttribute("aria-label") || "",
    icon?.parentElement?.getAttribute("title") || "",
    icon?.textContent || "",
  ]
    .join(" ")
    .toLowerCase();

  const semanticWin =
    /\b(win|success)\b/.test(classText) || /\b(win|success)\b/.test(ariaText);
  const semanticLoss =
    /\b(loss|error)\b/.test(classText) ||
    /\b(loss|error)\b/.test(ariaText) ||
    ariaText.includes("x sign");
  const semanticPending = /\bpending\b/.test(classText + " " + ariaText);

  if (semanticLoss) {
    leg.result = "loss";
  } else if (semanticWin) {
    leg.result = "win";
  } else if (semanticPending) {
    leg.result = "pending";
  } else {
    const normalizeColor = (value?: string | null) =>
      (value || "").trim().toLowerCase();
    const circleStroke = normalizeColor(iconCircle?.getAttribute("stroke"));
    const circleFill = normalizeColor(iconCircle?.getAttribute("fill"));
    const winColors = new Set(["#53d337", "rgb(83, 211, 55)"]);
    const lossColors = new Set(["#e9344a", "rgb(233, 52, 74)"]);

    const colorWin = [circleStroke, circleFill].some((color) =>
      winColors.has(color)
    );
    const colorLoss = [circleStroke, circleFill].some((color) =>
      lossColors.has(color)
    );

    if (colorLoss) {
      // Color fallback only: red (#e9344a/rgb(233, 52, 74)) means loss, green (#53d337/rgb(83, 211, 55)) means win
      leg.result = "loss";
    } else if (colorWin) {
      leg.result = "win";
    } else {
      // Inherit from parent/default
      leg.result = defaultResult || "pending";
    }
  }

  // For group legs, aggregate result from children with proper handling of push and mixed outcomes
  if (leg.isGroupLeg && leg.children && leg.children.length > 0) {
    const childResults = leg.children.map((c) => c.result);

    // (1) Return 'loss' if any child is 'loss'
    if (childResults.some((r) => r === "loss")) {
      leg.result = "loss";
    }
    // (2) Return 'pending' if any child is 'pending'
    else if (childResults.some((r) => r === "pending")) {
      leg.result = "pending";
    }
    // (3) Return 'push' if all children are 'push'
    else if (childResults.every((r) => r === "push")) {
      leg.result = "push";
    }
    // (4) Return 'win' if all children are either 'win' or 'push' and at least one is 'win'
    else if (
      childResults.every((r) => r === "win" || r === "push") &&
      childResults.some((r) => r === "win")
    ) {
      leg.result = "win";
    }
  }

  return leg;
}

/**
 * Parse a DraftKings parlay card. Throws explicit errors when required context
 * fields are missing so downstream parsing can safely assume presence.
 */
export const parseParlayBet = (ctx: ParlayBetContext): Bet => {
  assertValidParlayBetContext(ctx);

  const { element, header, footer, betType } = ctx;

  // Find top-level leg containers.
  // The structure is: div[id$="-body"] containing direct children "selection-list-item"
  // We need to be careful not to select nested ones.
  const body = element.querySelector('div[id$="-body"]');
  const allLegs = body
    ? Array.from(
        body.querySelectorAll('div[data-test-id="selection-list-item"]')
      )
    : [];

  const topLevelLegs: BetLeg[] = [];

  // Filter for top-level legs only (direct children of body)
  allLegs.forEach((el) => {
    const parent = el.parentElement;
    // Top-level items are direct children of the body div
    if (parent && parent.id && parent.id.endsWith("-body")) {
      topLevelLegs.push(extractLegFromElement(el, footer.result || "pending"));
    }
  });

  // Fallback: Handle SGP bets with collapsed/unexpanded leg views
  // When the bet card is collapsed, legs aren't in selection-list-items but in the subtitle
  // Example: subtitle shows "18+, 9+" instead of full player names and markets
  if (topLevelLegs.length === 0) {
    const subtitleEl = element.querySelector(
      'span[data-test-id^="bet-details-subtitle-"]'
    );
    if (subtitleEl) {
      const subtitle = normalizeSpaces(subtitleEl.textContent || "");
      // Parse legs from subtitle like "18+, 9+" or "Pts 25+, Ast 4+"
      const legParts = subtitle
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

      if (legParts.length > 0) {
        // Try to extract more info from the title
        const titleEl = element.querySelector(
          'span[data-test-id^="bet-details-title-"]'
        );
        const title = titleEl ? normalizeSpaces(titleEl.textContent || "") : "";

        // Parse each leg part
        legParts.forEach((legText) => {
          // Try to extract market type and target
          // Patterns: "18+", "Pts 18+", "Ast 9+", "47.5", "-1.5", "O 47.5", "U 47.5"
          // Accept decimals, optional signs, optional +, and O/U prefixes
          const match = legText.match(
            /^(?:([A-Za-z]+)\s+)?([+-]?\d+(?:\.\d+)?\+?)$/
          );
          if (match) {
            const marketPrefix = match[1];
            const target = match[2];

            // Infer market type from prefix
            let market = "Unknown";
            if (marketPrefix) {
              const prefix = marketPrefix.toUpperCase();
              // Normalize O/U to a standard market name
              if (prefix === "O" || prefix === "OVER") {
                market = "O/U";
              } else if (prefix === "U" || prefix === "UNDER") {
                market = "O/U";
              } else {
                market = prefix; // Use the prefix as market name (e.g., "PTS", "AST")
              }
            }

            topLevelLegs.push({
              market,
              target,
              result: footer.result || "pending",
              odds: undefined, // SGP legs don't show individual odds
            });
          }
        });
      }
    }
  }

  // Collect all leaf legs for description (flatten structure)
  const flatLegs = topLevelLegs.flatMap(collectLeafLegs);

  // Construct description from leaf legs
  const description = flatLegs
    .map((l) => {
      let desc = l.market;
      if (l.target) desc += ` ${l.target}`;
      return desc;
    })
    .join(", ");

  // Get total odds from header (bet-level odds)
  const oddsEl = element.querySelector(
    'span[data-test-id^="bet-details-displayOdds-"]'
  );
  let odds: number | undefined;
  if (oddsEl) {
    const parsedOdds = parseOddsText(oddsEl.textContent || "");
    if (parsedOdds !== undefined) {
      odds = parsedOdds;
    } else {
      console.warn(
        `[DraftKings parlay parser] Failed to parse bet odds for ${header.betId}`
      );
    }
  }

  // Determine bet type: SGPx (sgp_plus), SGP, or regular parlay
  // Use centralized normalization logic
  const computedBetType = determineBetType(element, topLevelLegs, betType);

  // Extract league from the first event card
  const eventCard = element.querySelector('div[data-test-id="event-card"]');
  const sport = eventCard
    ? extractLeagueFromEventCard(eventCard)
    : UNKNOWN_SPORT;

  // Determine market category
  // For DraftKings, check if it's a same-game parlay (SGP or SGP+)
  const isSameGameParlay =
    computedBetType === "sgp" || computedBetType === "sgp_plus";
  const marketCategory = isSameGameParlay
    ? MARKET_CATEGORY_SGP
    : MARKET_CATEGORY_PARLAY;

  return {
    id: header.betId,
    betId: header.betId,
    book: "DraftKings",
    placedAt: header.placedAt,
    stake: footer.stake || 0,
    payout: footer.payout || 0,
    result: footer.result || "pending",
    betType: computedBetType,
    marketCategory,
    sport,
    description,
    odds,
    legs: topLevelLegs,
  };
};

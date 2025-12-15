import { Bet, BetResult, BetType, SportsbookName } from "../../../types";
import {
  FD_DEBUG,
  fdDebug,
  FooterMeta,
  extractHeaderInfo,
  findLegRows,
  PLAYER_NAME_PATTERN,
  parseMoney,
  buildLegsFromRows,
  formatDescription,
  formatLegSummary,
} from "./common";
import { parseSingleBet } from "./single";
import { parseParlayBet } from "./parlay";

const FANDUEL_BOOK: SportsbookName = "FanDuel";
const SGP_INCLUDES_PATTERN = /includes:\s*\d+\s+same\s+game\s+parlay/i;

/**
 * Detects whether a FanDuel bet card represents a Same Game Parlay Plus bet.
 * Returns true when the header text contains SGP+ indicators.
 * @param fullText Raw header text of the bet card; treated as absent when null or blank.
 */
const isSGPPlusBet = (fullText: string | null | undefined): boolean => {
  if (!fullText || !fullText.trim()) {
    return false;
  }

  const normalized = fullText.toLowerCase();

  if (
    normalized.includes("same game parlay plus") ||
    normalized.includes("same game parlay+")
  ) {
    return true;
  }

  if (normalized.includes("includes:")) {
    return SGP_INCLUDES_PATTERN.test(normalized);
  }

  return false;
};

/**
 * Public entry: parse FanDuel HTML into Bet[]
 */
export const parseFanDuel = (htmlContent: string): Bet[] => {
  if (!htmlContent || !htmlContent.trim()) {
    fdDebug("FanDuel parser: Empty HTML content.");
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // The main list on the My Bets page
  const ul =
    doc.querySelector<HTMLElement>("ul.t.h.di") ??
    doc.querySelector<HTMLElement>("ul");

  if (!ul) {
    fdDebug("FanDuel parser: No <ul> container found.");
    return [];
  }

  const liNodes = Array.from(ul.querySelectorAll<HTMLElement>("li"));
  if (!liNodes.length) {
    fdDebug("FanDuel parser: No <li> bet cards found.");
    return [];
  }

  // Footers: <li> that contain BET ID:
  const footerLis = liNodes.filter((li) =>
    (li.textContent ?? "").includes("BET ID:")
  );

  fdDebug(`Found ${footerLis.length} footer cards with BET ID.`);

  const bets: Bet[] = [];

  for (const footerLi of footerLis) {
    const meta = extractFooterMeta(footerLi);
    if (!meta.betId) {
      fdDebug("Skipping footer with no betId.");
      continue;
    }

    fdDebug(`Processing footer for betId ${meta.betId}`);

    // Check if this footer also contains the header (parlay case)
    const footerText = (footerLi.textContent ?? "").toLowerCase();
    const isParlayFooter = /\d+\s+leg\s+parlay/i.test(footerText);

    let headerLi: HTMLElement | null = null;

    if (isParlayFooter) {
      // For parlays, the header and footer are often in the same <li>
      fdDebug(
        `Footer for betId ${meta.betId} appears to be a parlay - using same element as header`
      );
      headerLi = footerLi;
    } else {
      // The header card is expected to be the previous <li> sibling.
      // For parlays, we need to look further back past other footers.
      // Also try searching all liNodes if backward search fails
      headerLi = findHeaderLiForFooter(footerLi, meta.betId, liNodes);
    }

    if (!headerLi) {
      fdDebug("No header <li> found for betId", meta.betId);
      continue;
    }

    fdDebug(
      `Found header for betId ${meta.betId}, header text preview:`,
      (headerLi.textContent ?? "").substring(0, 100)
    );

    // Gather leg rows to classify bet type structurally
    const legRows = findLegRows(headerLi);
    let betType = inferBetType(headerLi, legRows.length);

    // Check if a parlay with single leg is actually an SGP+ case
    // SGP+ can have a single SGP leg that contains multiple selections
    if (betType === "parlay" || betType === "sgp_plus") {
      const fullText = (headerLi.textContent ?? "").replace(/\s+/g, " ").trim();
      const isSGPPlus = isSGPPlusBet(fullText);

      // If it's SGP+ with only 1 leg row, it might be a nested SGP that wasn't fully expanded
      // Mark it as sgp_plus - the nested structure will be handled in parsing
      if (isSGPPlus && legRows.length === 1) {
        fdDebug("Detected SGP+ with single leg row - may contain nested SGP");
        betType = "sgp_plus";
      }
    }

    const result = inferResult(
      meta.stake,
      meta.payout,
      footerLi,
      meta.hasWonOnFanDuel
    );

    const placedAtRaw = meta.placedAtRaw ?? "";
    const betId = meta.betId;

    // Normalize date to ISO format if possible
    let placedAtISO = placedAtRaw;
    if (placedAtRaw) {
      // Try to parse formats like "11/18/2025 11:09PM ET" or "11/18/2025 11:09 PM ET"
      const dateMatch = placedAtRaw.match(
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)\s+ET/i
      );
      if (dateMatch) {
        const [, month, day, year, hour12, minute, ampm] = dateMatch;
        let hour24 = parseInt(hour12, 10);
        if (ampm.toUpperCase() === "PM" && hour24 !== 12) {
          hour24 += 12;
        } else if (ampm.toUpperCase() === "AM" && hour24 === 12) {
          hour24 = 0;
        }
        // Assume ET timezone (UTC-5)
        const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
          2,
          "0"
        )}T${hour24.toString().padStart(2, "0")}:${minute}:00-05:00`;
        placedAtISO = isoDate;
      }
    }

    const headerInfo = extractHeaderInfo(headerLi, betType);

    // For singles with a single structured leg row, backfill missing fields from that leg
    if (betType === "single" && legRows.length === 1) {
      const leg = buildLegsFromRows(legRows, {
        result: "PENDING",
        fallbackOdds: headerInfo.odds ?? undefined,
      })[0];
      if (leg) {
        headerInfo.name = headerInfo.name || leg.entities?.[0];
        headerInfo.type = headerInfo.type || leg.market;
        headerInfo.line =
          headerInfo.line ||
          (leg.target !== undefined ? String(leg.target) : undefined);
        headerInfo.ou = headerInfo.ou || leg.ou;
        headerInfo.odds = leg.odds ?? headerInfo.odds ?? undefined;

        // If description is generic, rebuild from leg
        if (
          !headerInfo.description ||
          /Spread BETTING|Total Points|Moneyline/i.test(headerInfo.description)
        ) {
          const legDesc = formatLegSummary(leg);
          headerInfo.description = formatDescription(
            legDesc,
            headerInfo.type,
            headerInfo.name,
            headerInfo.line,
            headerInfo.ou,
            betType
          );
        }
      }
    }

    // Build bet via the single/parlay branches
    const bet =
      betType === "single"
        ? parseSingleBet({
            headerLi,
            betId,
            placedAtISO,
            meta,
            result,
            book: FANDUEL_BOOK,
            headerInfo,
          })
        : parseParlayBet({
            headerLi,
            legRows,
            betId,
            placedAtISO,
            meta,
            result,
            betType,
            book: FANDUEL_BOOK,
            headerInfo,
          });

    if (bet) {
      bets.push(bet);
    }
  }

  fdDebug("FanDuel parser produced bets:", bets);
  return bets;
};

// keep your old `parse(...)` entrypoint name if code expects that
export const parse = parseFanDuel;

/* -------------------------------------------------------------------------- */
/*                              FOOTER EXTRACTION                             */
/* -------------------------------------------------------------------------- */

const extractFooterMeta = (footerLi: HTMLElement): FooterMeta => {
  const rawText = (footerLi.textContent ?? "").replace(/\s+/g, " ").trim();

  // Match bet ID - try multiple patterns for flexibility
  // Also handle cases where there's no space after colon
  let betId: string | null = null;
  const betIdPatterns = [
    /BET ID:\s*([A-Z0-9/]+)(?=\s*PLACED)/i,
    /BET ID:\s*([A-Z0-9/]+)/i,
    /BET\s*ID[:\s]+([A-Z0-9/]+)/i,
    /BET\s*ID:([A-Z0-9/]+)/i, // No space after colon
  ];

  for (const pattern of betIdPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      betId = match[1].trim();
      break;
    }
  }

  // Match placed date - try multiple patterns
  // The date is in the last span: "PLACED: 11/18/2025 11:09PM ET"
  let placedAtRaw: string | null = null;

  // First try to extract from spans directly
  const spans = Array.from(footerLi.querySelectorAll("span"));
  const placedSpan = spans.find((s) => {
    const text = (s.textContent ?? "").trim();
    return text.startsWith("PLACED:") || text.includes("PLACED:");
  });

  if (placedSpan) {
    const spanText = (placedSpan.textContent ?? "").trim();
    const dateMatch = spanText.match(/PLACED:\s*(.+?)(?:\s*$|BET ID)/i);
    if (dateMatch && dateMatch[1]) {
      placedAtRaw = dateMatch[1].trim();
    }
  }

  // Fallback: try patterns in raw text
  if (!placedAtRaw) {
    const placedPatterns = [
      /PLACED:\s*([^\n]+?)(?:\s*$|\s*BET ID|\n)/i,
      /PLACED:\s*([^\n]+?)(?:\s*$|\s*BET ID|\n)/i,
      /PLACED[:\s]+([^\n]+?)(?:\s*$|\s*BET ID|\n)/i,
      /PLACED:\s*([^]+?)$/i,
    ];

    for (const pattern of placedPatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        placedAtRaw = match[1].trim();
        break;
      }
    }
  }

  // Extract amounts with multiple label variations for robustness
  const stake =
    extractLabeledAmount(footerLi, "TOTAL WAGER") ||
    extractLabeledAmount(footerLi, "WAGER") ||
    extractLabeledAmount(footerLi, "STAKE");

  // Can be "WON ON FANDUEL" or "RETURNED" for losers/pushes.
  const payoutWon =
    extractLabeledAmount(footerLi, "WON ON FANDUEL") ||
    extractLabeledAmount(footerLi, "WON") ||
    extractLabeledAmount(footerLi, "PAID");

  const payoutReturned =
    extractLabeledAmount(footerLi, "RETURNED") ||
    extractLabeledAmount(footerLi, "REFUNDED");

  const hasWonOnFanDuel = payoutWon !== null;

  // If "RETURNED" shows $0.00, that's a loss (payout = 0)
  // If "RETURNED" shows the stake amount, that's a push (payout = stake)
  // If "WON ON FANDUEL" shows an amount, that's a win (payout = that amount)
  const payout =
    payoutWon !== null
      ? payoutWon
      : payoutReturned !== null
      ? payoutReturned
      : null;

  return {
    betId,
    placedAtRaw,
    stake,
    payout,
    hasWonOnFanDuel,
    rawText,
  };
};

/**
 * In the footer card, amounts are rendered in various ways:
 *
 * Pattern 1:
 * <div class="v w x y t h by">
 *   <div class="v z x as t h">
 *     <span>$1.02</span>
 *   </div>
 *   <span>TOTAL WAGER</span>
 * </div>
 *
 * Pattern 2 (alternative structure):
 * <div>
 *   <span>$1.02</span>
 *   <span>TOTAL WAGER</span>
 * </div>
 *
 * We try multiple strategies to find the amount.
 */
const extractLabeledAmount = (
  root: HTMLElement,
  label: string
): number | null => {
  const spans = Array.from(root.querySelectorAll("span"));
  const labelUpper = label.toUpperCase();

  const labelSpan = spans.find(
    (s) => (s.textContent ?? "").trim().toUpperCase() === labelUpper
  );
  if (!labelSpan) return null;

  const parent = labelSpan.parentElement;
  if (parent) {
    const directChildren = Array.from(parent.children);
    const labelIdx = directChildren.indexOf(labelSpan);

    // First try spans that come after the label in the same parent (most reliable)
    for (let i = labelIdx + 1; i < directChildren.length; i++) {
      const child = directChildren[i];
      const span =
        child.querySelector("span") ||
        (child.tagName === "SPAN" ? child : null);
      if (span) {
        const text = span.textContent ?? "";
        if (text.includes("$")) {
          const amount = parseMoney(text);
          if (amount !== null) return amount;
        }
      }
    }
    // If nothing after, check spans before the label in the same parent (some layouts put the number before the label)
    for (let i = labelIdx - 1; i >= 0; i--) {
      const child = directChildren[i];
      const span =
        child.querySelector("span") ||
        (child.tagName === "SPAN" ? child : null);
      if (span) {
        const text = span.textContent ?? "";
        if (text.includes("$")) {
          const amount = parseMoney(text);
          if (amount !== null) return amount;
        }
      }
    }
    // Fallback: check all spans after the label within parent (including nested)
    const siblingSpans = Array.from(parent.querySelectorAll("span")).filter(
      (s) => {
        const idx = directChildren.indexOf(s as any);
        return idx === -1 ? true : idx > labelIdx;
      }
    );
    for (const span of siblingSpans) {
      if (span === labelSpan) continue;
      const text = span.textContent ?? "";
      if (text.includes("$")) {
        const amount = parseMoney(text);
        if (amount !== null) return amount;
      }
    }
  }

  // Strategy 2: Look for sibling spans with dollar amounts (fallback)
  // The amount is often in a span before or after the label span
  const allSpans = Array.from(root.querySelectorAll("span"));
  const labelIndex = allSpans.indexOf(labelSpan);

  // Check spans near the label (before and after)
  for (
    let i = Math.max(0, labelIndex - 3);
    i < Math.min(allSpans.length, labelIndex + 3);
    i++
  ) {
    if (i === labelIndex) continue;
    const span = allSpans[i];
    const text = span.textContent ?? "";
    if (text.includes("$")) {
      const amount = parseMoney(text);
      if (amount !== null) return amount;
    }
  }

  // Strategy 3: Get parent container, then look in sibling divs
  let container = labelSpan.parentElement as HTMLElement | null;
  if (container) {
    // Look in all divs in the container for dollar amounts
    const divs = Array.from(container.querySelectorAll("div"));
    for (const div of divs) {
      const valueSpan = div.querySelector<HTMLElement>("span");
      if (valueSpan) {
        const text = valueSpan.textContent ?? "";
        if (text.includes("$")) {
          const amount = parseMoney(text);
          if (amount !== null) return amount;
        }
      }
    }

    // Also check first child div's first span (original strategy)
    const amountDiv = container.querySelector<HTMLElement>("div");
    if (amountDiv) {
      const valueSpan = amountDiv.querySelector<HTMLElement>("span");
      if (valueSpan) {
        const amount = parseMoney(valueSpan.textContent ?? "");
        if (amount !== null) return amount;
      }
    }
  }

  // Strategy 4: Look for previous sibling with amount (broader sweep)
  let prevSibling = labelSpan.previousElementSibling as HTMLElement | null;
  while (prevSibling) {
    const text = prevSibling.textContent ?? "";
    if (text.includes("$")) {
      const amount = parseMoney(text);
      if (amount !== null) return amount;
    }
    prevSibling = prevSibling.previousElementSibling as HTMLElement | null;
  }

  // Strategy 4: Search all spans in container for dollar amounts near the label
  if (container) {
    const allText = container.textContent ?? "";
    // Look for pattern like "$X.XX TOTAL WAGER" or "TOTAL WAGER $X.XX"
    const patterns = [
      new RegExp(`\\$([0-9,]+(?:\\.[0-9]{2})?)\\s*${labelUpper}`, "i"),
      new RegExp(`${labelUpper}\\s*\\$([0-9,]+(?:\\.[0-9]{2})?)`, "i"),
    ];

    for (const pattern of patterns) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        const amount = parseMoney(match[1]);
        if (amount !== null) return amount;
      }
    }
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/*                          BET TYPE / CATEGORY / SPORT                       */
/* -------------------------------------------------------------------------- */

const inferBetType = (headerLi: HTMLElement, legCount: number): BetType => {
  const text = (headerLi.textContent ?? "").toLowerCase();
  const ariaLabel =
    headerLi
      .querySelector("[aria-label]")
      ?.getAttribute("aria-label")
      ?.toLowerCase() || "";

  fdDebug("inferBetType - checking text:", text.substring(0, 200));

  // Check for "same game parlay" - need to check both text content and raw HTML
  // Even if aria-label says "same game parlay available", the raw text often contains actual bet legs
  const fullText = (headerLi.textContent ?? "").replace(/\s+/g, " ").trim();
  // SGP+ (multi-game combo) – explicit detection for Same Game Parlay+
  // SGP+ contains SGP(s) as legs, where each SGP has multiple players/teams but one combined odds value
  const isSGPPlus =
    text.includes("same game parlay plus") ||
    fullText.toLowerCase().includes("same game parlay+") ||
    (fullText.toLowerCase().includes("includes:") &&
      /includes:\s*\d+\s+same\s+game\s+parlay/i.test(fullText));

  if (isSGPPlus) {
    fdDebug("Detected SGP+ (Same Game Parlay Plus)");
    return "sgp_plus"; // SGP+ has nested SGP legs plus extra selections
  }
  const hasSGPText =
    text.includes("same game parlay") || fullText.includes("Same Game Parlay");
  const sgpIsPromoOnly =
    (text.includes("parlay available") ||
      ariaLabel.includes("parlay available")) &&
    !/To Record|To Score|Made Threes|Spread Betting|Moneyline|Total|Receptions|Yards|Pass Attempts|Assists|Points/i.test(
      fullText
    );

  // Check if there are actual bet legs in the raw content (not just "available")
  // Look for patterns like "Player To Record X+ Stat" or "Player Name X+ Made Threes"
  const betLegs = fullText.match(
    new RegExp(
      `(${PLAYER_NAME_PATTERN}\\s+(?:To Record|To Score)\\s+\\d+\\+\\s+\\w+)`,
      "g"
    )
  );
  const hasMultipleBetLegs = betLegs && betLegs.length >= 2;
  const hasAnyLegIndicators =
    (betLegs && betLegs.length > 0) ||
    /To Record|To Score|Made Threes|Spread Betting|Moneyline|Total|Receptions|Yards|Assists|Points/i.test(
      fullText
    );

  if (hasSGPText && !sgpIsPromoOnly) {
    // Default SGP when we see explicit SGP text, even if we fail to pull multiple legs.
    if (hasMultipleBetLegs) {
      fdDebug("Detected SGP from SGP text with multiple legs");
      return "sgp";
    }
    fdDebug("Detected SGP from SGP text (no legs parsed yet)");
    return "sgp";
  }

  // Check for parlay indicators - but be careful about "same game parlay available" which is just promotional text.

  // Check for explicit "X leg parlay" pattern (most reliable)
  if (text.includes("leg parlay") && /\d+\s+leg\s+parlay/i.test(text)) {
    // If also SGP text is present, treat as SGP
    if (hasSGPText && !sgpIsPromoOnly) {
      fdDebug("Detected SGP from 'X leg parlay' with SGP marker");
      return "sgp";
    }
    fdDebug("Detected parlay from 'X leg parlay' text");
    return "parlay";
  }

  // Check aria-label for parlay indicators (but exclude "available")
  if (
    ariaLabel.includes("leg parlay") &&
    /\d+\s+leg\s+parlay/i.test(ariaLabel)
  ) {
    fdDebug("Detected parlay from aria-label");
    return "parlay";
  }

  // Generic "parlay" check - but only if it's not just promotional text and we have some structure
  if (
    (text.includes("parlay") || ariaLabel.includes("parlay")) &&
    !text.includes("parlay available") &&
    !ariaLabel.includes("parlay available") &&
    legCount >= 2
  ) {
    // Check if there are multiple bets (commas, multiple team names, etc.)
    const hasMultipleBets =
      (text.match(/,/g) || []).length >= 2 || text.match(/\d+\s+leg/i) !== null;
    if (hasMultipleBets) {
      fdDebug("Detected parlay from multiple bets pattern");
      return text.includes("same game") ? "sgp" : "parlay";
    }
  }

  // Also check for parlay text in all spans (e.g., "2 leg parlay")
  const allSpans = Array.from(headerLi.querySelectorAll("span"));
  for (const span of allSpans) {
    const spanText = (span.textContent || "").toLowerCase();
    if (
      spanText.includes("leg parlay") ||
      (spanText.includes("parlay") && spanText.includes("leg"))
    ) {
      fdDebug("Detected parlay from span:", spanText.substring(0, 50));
      return "parlay";
    }
  }

  // Check if description contains multiple bets (parlay indicator)
  const descText = headerLi.textContent || "";
  if (
    descText.includes("Spread Betting") &&
    descText.split("Spread Betting").length > 2 &&
    legCount >= 2
  ) {
    fdDebug("Detected parlay from multiple Spread Betting");
    return "parlay";
  }

  // Fallback: treat as single
  fdDebug("Treating as single bet");
  return "single";
};

/* -------------------------------------------------------------------------- */
/*                                  RESULTS                                   */
/* -------------------------------------------------------------------------- */

const inferResult = (
  stake: number | null,
  payout: number | null,
  footerLi: HTMLElement,
  hasWonOnFanDuel: boolean
): BetResult => {
  const text = (footerLi.textContent ?? "").toLowerCase();

  // If "WON ON FANDUEL" is present, it's a win
  if (hasWonOnFanDuel) return "win";

  // Check if bet is settled (has "Finished" or "Settled" text, or has a result indicator)
  const isSettled =
    text.includes("finished") ||
    text.includes("settled") ||
    text.includes("returned") ||
    text.includes("won on fanduel") ||
    payout !== null;

  // If "RETURNED" is present
  if (text.includes("returned")) {
    // If payout equals stake (within small tolerance), it's a push
    if (
      stake !== null &&
      payout !== null &&
      payout > 0 &&
      Math.abs(payout - stake) < 0.0001
    ) {
      return "push";
    }
    // If payout is 0 or null, it's a loss
    if (payout === null || payout === 0) {
      return "loss";
    }
  }

  // If it's settled and has zero payout, treat as loss
  if (isSettled && payout !== null && payout === 0) {
    return "loss";
  }

  // If it's settled and payout is null (no "WON ON FANDUEL" and no "RETURNED"), it's a loss
  if (isSettled && payout === null && !text.includes("returned")) {
    return "loss";
  }

  // If we have a payout that's greater than stake, it's a win (fallback)
  if (stake !== null && payout !== null && payout > stake) {
    return "win";
  }

  // If we have a payout that equals stake, it's a push
  if (stake !== null && payout !== null && Math.abs(payout - stake) < 0.0001) {
    return "push";
  }

  return "pending";
};

/* -------------------------------------------------------------------------- */
/*                                    UTILS                                   */
/* -------------------------------------------------------------------------- */

const findHeaderLiForFooter = (
  footerLi: HTMLElement,
  betId: string,
  allLiNodes?: HTMLElement[]
): HTMLElement | null => {
  // Prefer the nearest previous non-footer <li>. This prevents cross-linking to distant parlay headers.
  let prev = footerLi.previousElementSibling as HTMLElement | null;
  while (prev) {
    if (prev.tagName?.toLowerCase() === "li") {
      const text = (prev.textContent ?? "").toLowerCase();
      const isFooterLike =
        text.includes("bet id") ||
        (text.includes("total wager") && text.includes("won on fanduel"));
      if (!isFooterLike) {
        return prev;
      }
    }
    prev = prev.previousElementSibling as HTMLElement | null;
  }

  // Fallback: scan earlier <li> nodes in the provided list to find the closest non-footer candidate
  if (allLiNodes && allLiNodes.length) {
    const idx = allLiNodes.indexOf(footerLi);
    for (let i = idx - 1; i >= 0; i--) {
      const candidate = allLiNodes[i];
      if (!candidate || candidate.tagName?.toLowerCase() !== "li") continue;
      const text = (candidate.textContent ?? "").toLowerCase();
      const isFooterLike =
        text.includes("bet id") ||
        (text.includes("total wager") && text.includes("won on fanduel")) ||
        text.includes("placed:");
      if (!isFooterLike) {
        return candidate;
      }
    }
  }

  return null;
};

export default parseFanDuel;

import { Bet, BetLeg, BetResult, BetType, SportsbookName } from "../../types";
import {
  HeaderInfo,
  buildLegsFromDescription,
  buildLegsFromRows,
  dedupeLegs,
  buildLegsFromStatText,
  buildLegsFromSpans,
  dropGenericDuplicateLegs,
  filterMeaningfulLegs,
  formatDescription,
  formatParlayDescriptionFromLegs,
  inferMarketCategory,
  isSGPPlus,
  aggregateChildResults,
  extractOdds,
  findLegRows,
  normalizeSpaces,
} from "./common";

export interface ParlayBetParams {
  headerLi: HTMLElement;
  legRows: HTMLElement[];
  betId: string;
  placedAtISO: string;
  meta: {
    stake: number | null;
    payout: number | null;
    rawText: string;
  };
  result: BetResult;
  betType: BetType;
  book: SportsbookName;
  headerInfo: HeaderInfo;
}

export const parseParlayBet = ({
  headerLi,
  legRows,
  betId,
  placedAtISO,
  meta,
  result,
  betType,
  book,
  headerInfo,
}: ParlayBetParams): Bet => {
  const marketCategory = inferMarketCategory(betType, headerInfo.type);
  const isSGPPlusStructure =
    betType === "sgp_plus" || isSGPPlus(headerInfo.rawText);

  // Bet-level odds are shown once at the top of the parlay card
  const betOdds = headerInfo.odds ?? 0;

  // SGP modeling:
  // - Standard SGP bets keep each inner selection as a flat leg with odds set to null when hidden.
  // - SGP+ bets add a group leg (isGroupLeg=true) that carries the nested SGP combined odds
  //   and exposes the inner selections as children (with null odds), alongside any extra legs.

  const skipLegOdds = betType === "sgp";

  const legKey = (leg: BetLeg): string =>
    [
      (leg.entities?.[0] || "").toLowerCase(),
      (leg.market || "").toLowerCase(),
      String(leg.target ?? ""),
    ].join("|");

  const buildCombinedLegs = (rows: HTMLElement[]): BetLeg[] => {
    const useSkipLegOdds = skipLegOdds && !isSGPPlusStructure;

    // Build legs from structured rows and textual description together
    const legsFromRows = buildLegsFromRows(rows, "PENDING", useSkipLegOdds);
    const legsFromDescription = headerInfo.description
      ? buildLegsFromDescription(
          headerInfo.description,
          "PENDING",
          useSkipLegOdds
        )
      : [];

    // Always try to extract from raw text; helpful when FanDuel hides leg odds/results
    const legsFromStatText = buildLegsFromStatText(
      headerInfo.rawText,
      "PENDING"
    );
    const legsFromSpans = buildLegsFromSpans(headerLi, "PENDING");

    const fallbackHeaderLegs =
      !legsFromRows.length && !legsFromStatText.length && !legsFromSpans.length
        ? buildLegsFromRows([headerLi], "PENDING", useSkipLegOdds)
        : [];

    const combined = dedupeLegs(
      dropGenericDuplicateLegs(
        filterMeaningfulLegs([
          ...legsFromRows,
          ...legsFromDescription,
          ...legsFromStatText,
          ...legsFromSpans,
          ...fallbackHeaderLegs,
        ])
      )
    );

    // For SGP bets, inner legs never show per-leg odds
    if (skipLegOdds) {
      return combined.map((leg) => ({ ...leg, odds: leg.odds ?? null }));
    }

    return combined;
  };

  const { groupLegs, consumedRows } = isSGPPlusStructure
    ? buildSGPPlusGroupLegs(headerLi, result)
    : { groupLegs: [] as BetLeg[], consumedRows: new Set<HTMLElement>() };

  const remainingRows = legRows.filter((row) => !consumedRows.has(row));
  const extraLegs = buildCombinedLegs(remainingRows);

  // Avoid duplicating inner SGP legs outside the group container
  const childKeys = new Set<string>();
  groupLegs.forEach((group) =>
    (group.children || []).forEach((child) => childKeys.add(legKey(child)))
  );
  const filteredExtras = extraLegs.filter((leg) => !childKeys.has(legKey(leg)));

  const legs = [...groupLegs, ...filteredExtras];

  const description = legs.length
    ? formatParlayDescriptionFromLegs(legs)
    : formatDescription(
        headerInfo.description,
        headerInfo.type,
        headerInfo.name,
        headerInfo.line,
        headerInfo.ou,
        betType
      );

  // Give SGPs an explicit short name so UI doesn't fall back to generic header text.
  const legCount = legs.length || legRows.length || undefined;
  const betName =
    betType === "sgp"
      ? legCount
        ? `SGP (${legCount} legs)`
        : "SGP"
      : betType === "sgp_plus"
      ? "SGP+"
      : undefined;

  // If the description is still just generic SGP text, fall back to leg summary when available.
  const finalDescription =
    legs.length && /same game parlay/i.test(description)
      ? formatParlayDescriptionFromLegs(legs)
      : description;

  const bet: Bet = {
    id: `${book}:${betId}:${placedAtISO}`,
    book,
    betId,
    placedAt: placedAtISO,
    settledAt: undefined,
    betType,
    marketCategory,
    sport: headerInfo.sport ?? "",
    description: finalDescription,
    name: betName, // keep singles blank; SGPs get explicit label
    odds: betOdds,
    stake: meta.stake ?? 0,
    payout: meta.payout ?? 0,
    result,
    type: undefined,
    line: undefined,
    ou: undefined,
    legs: legs.length ? legs : undefined,
    tail: "",
    raw: `${headerInfo.rawText}\n----\n${meta.rawText}`,
    isLive: headerInfo.isLive,
    isSample: false,
  };

  return bet;
};

const findSGPGroupContainers = (root: HTMLElement): HTMLElement[] => {
  const divs = Array.from(root.querySelectorAll<HTMLElement>("div"));
  const candidates = divs.filter((div) => {
    const text = normalizeSpaces(div.textContent || "").toLowerCase();
    // Check for "same game parlay" (handle trademark symbol variations)
    const hasSGPText = text.includes("same game parlay") || 
                       text.includes("same game parlay™") ||
                       text.includes("same game parlaytm");
    if (!hasSGPText) return false;
    
    // Exclude SGP+ parent containers
    if (text.includes("parlay+") || text.includes("parlay plus")) return false;
    if (text.includes("includes:")) return false;
    
    // Must have an odds span to be a real SGP block
    // Also check for role="button" which is common in SGP containers
    const hasOdds = !!div.querySelector('span[aria-label^="Odds"]');
    const hasButtonRole = div.getAttribute("role") === "button" || 
                         div.querySelector('[role="button"]') !== null;
    
    // SGP containers typically have either odds or are button-like containers
    // Also check if this div contains leg rows (aria-label elements with market text)
    const hasLegRows = Array.from(div.querySelectorAll('[aria-label]')).some((el) => {
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return /to record|to score|\d+\+\s+(yards|receptions|points|assists|made threes|triple double)/i.test(aria);
    });
    
    // Also check for leg-row class or divs with player names + market text
    const hasLegRowClass = div.querySelector('.leg-row') !== null;
    const hasPlayerMarketPattern = /[A-Z][a-z]+\s+[A-Z][a-z]+.*to\s+(record|score).*(triple double|double double|\d+\+\s+\w+)/i.test(text);
    
    return hasOdds || (hasButtonRole && (hasLegRows || hasLegRowClass)) || (hasLegRows && hasPlayerMarketPattern);
  });

  // Prefer the most specific containers (innermost SGP blocks)
  // The key is to find the div that is the actual SGP container, not a parent that contains multiple SGPs
  // An SGP container should:
  // 1. Have "Same Game Parlay" text
  // 2. Have odds
  // 3. Be the innermost div that contains both the header AND its legs
  // 4. NOT contain other SGP containers (that would be the SGP+ parent)
  
  const containers = candidates.filter((div) => {
    // Exclude if this div contains another candidate (it's a parent, not the actual SGP container)
    const containsOtherSGP = candidates.some((other) => {
      if (other === div) return false;
      return div.contains(other);
    });
    if (containsOtherSGP) return false;
    
    // Exclude if this div is contained within another candidate that has the same characteristics
    const isContained = candidates.some((other) => {
      if (other === div || !other.contains(div)) return false;
      // Both have odds and SGP text, prefer the inner one
      const divHasOdds = !!div.querySelector('span[aria-label^="Odds"]');
      const otherHasOdds = !!other.querySelector('span[aria-label^="Odds"]');
      if (divHasOdds && otherHasOdds) {
        // Prefer the one with more direct leg children (more specific)
        const divLegCount = Array.from(div.querySelectorAll('.leg-row, [aria-label*="To Record"], [aria-label*="To Score"]')).length;
        const otherLegCount = Array.from(other.querySelectorAll('.leg-row, [aria-label*="To Record"], [aria-label*="To Score"]')).length;
        return divLegCount <= otherLegCount;
      }
      return false;
    });
    return !isContained;
  });

  return containers;
};

// Extract team names/matchup from a container or row to identify which game it belongs to
const extractGameMatchup = (element: HTMLElement): string | null => {
  const text = normalizeSpaces(element.textContent || "");
  const aria = normalizeSpaces(element.getAttribute("aria-label") || "");
  const combined = `${text} ${aria}`;
  
  // Look for team name patterns (e.g., "Detroit Pistons", "Atlanta Hawks")
  // Common NBA team patterns
  const teamPatterns = [
    /(Detroit\s+Pistons|Atlanta\s+Hawks|Orlando\s+Magic|Phoenix\s+Suns|Portland\s+Trail\s+Blazers|Utah\s+Jazz|Los\s+Angeles\s+Lakers|Golden\s+State\s+Warriors|New\s+Orleans\s+Pelicans|Chicago\s+Bulls|Dallas\s+Mavericks)/gi,
    /(Cleveland\s+Browns|Denver\s+Broncos|Los\s+Angeles\s+Rams|Arizona\s+Cardinals|San\s+Francisco\s+49ers|Seattle\s+Seahawks|Baltimore\s+Ravens)/gi,
  ];
  
  const teams: string[] = [];
  for (const pattern of teamPatterns) {
    const matches = combined.match(pattern);
    if (matches) {
      teams.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  // Also look for "@" pattern (e.g., "Team @ Team")
  const atMatch = combined.match(/([A-Z][A-Za-z\s]+)\s+@\s+([A-Z][A-Za-z\s]+)/);
  if (atMatch) {
    teams.push(atMatch[1].toLowerCase().trim(), atMatch[2].toLowerCase().trim());
  }
  
  // Return a normalized matchup key (sorted team names)
  if (teams.length >= 2) {
    const uniqueTeams = [...new Set(teams)].sort();
    return uniqueTeams.join(" vs ");
  }
  
  return null;
};

const buildSGPPlusGroupLegs = (
  root: HTMLElement,
  betResult: BetResult
): { groupLegs: BetLeg[]; consumedRows: Set<HTMLElement> } => {
  const containers = findSGPGroupContainers(root);
  const groupLegs: BetLeg[] = [];
  const consumedRows = new Set<HTMLElement>();

  for (const container of containers) {
    consumedRows.add(container);
    
    const childRows = findLegRowsWithin(container).filter((row) => {
      const isContainer = row === container;
      if (!isContainer) consumedRows.add(row);
      return !isContainer;
    });

    if (!childRows.length) continue;

    const children = buildLegsFromRows(childRows, "PENDING", true).map(
      (child) => ({ ...child, odds: child.odds ?? null })
    );

    // Extract odds from the container - look for odds span within the SGP container
    // The odds are typically in a span with aria-label="Odds +XXXX" within the container
    let odds = extractOdds(container);
    
    // If not found, try looking in child divs that contain "Same Game Parlay" text
    if (!odds) {
      const childDivs = Array.from(container.querySelectorAll<HTMLElement>("div"));
      for (const div of childDivs) {
        const divText = normalizeSpaces(div.textContent || "").toLowerCase();
        if (divText.includes("same game parlay") && !divText.includes("parlay+") && !divText.includes("includes:")) {
          const divOdds = extractOdds(div);
          if (divOdds) {
            odds = divOdds;
            break;
          }
        }
      }
    }

    const groupLeg: BetLeg = {
      market: "Same Game Parlay",
      odds: odds ?? null,
      result: aggregateChildResults(children, betResult),
      isGroupLeg: true,
      children,
    };

    groupLegs.push(groupLeg);
  }

  return { groupLegs, consumedRows };
};

// A scoped leg-row finder that stays within the SGP container.
// CRITICAL: Only finds legs that are direct children/descendants of THIS specific container.
// Must NOT find legs from sibling SGP containers or parent SGP+ containers.
const findLegRowsWithin = (container: HTMLElement): HTMLElement[] => {
  const candidates: HTMLElement[] = [];

  // CRITICAL: Only search within this container, not in parent or sibling elements
  // The container should be the innermost div that contains the SGP header and its legs
  
  // First, look for elements with class="leg-row" that are direct descendants
  const legRows = Array.from(container.querySelectorAll<HTMLElement>(".leg-row"));
  candidates.push(...legRows);

  // Also look for elements with aria-label that contain leg information
  // But ONLY if they are within this container's DOM tree
  candidates.push(
    ...Array.from(
      container.querySelectorAll<HTMLElement>("[aria-label]")
    ).filter((el) => {
      const tagName = el.tagName.toLowerCase();
      // Exclude spans, but include divs and other elements
      if (tagName === "span") return false;
      
      // Exclude the SGP header itself
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      if (aria.includes("same game parlay") && !aria.includes("to record") && !aria.includes("to score") && !aria.includes("triple double")) {
        return false;
      }
      
      // The element should be contained within the container
      // querySelectorAll already ensures this, but we need to make sure
      // we're not picking up elements from sibling SGP containers
      // Check if there's another SGP container between el and container
      let current: HTMLElement | null = el.parentElement;
      while (current && current !== container) {
        const currentText = normalizeSpaces(current.textContent || "").toLowerCase();
        // If we hit another SGP container (not the one we're looking for), this element is in the wrong container
        if (currentText.includes("same game parlay") && 
            !currentText.includes("parlay+") && 
            !currentText.includes("includes:") &&
            current !== container) {
          // Check if this is a different SGP container (has its own odds)
          const hasOwnOdds = !!current.querySelector('span[aria-label^="Odds"]');
          if (hasOwnOdds) {
            // This element belongs to a different SGP container
            return false;
          }
        }
        current = current.parentElement;
      }
      
      return true;
    })
  );

  // Also check for divs that are parents of odds spans
  const oddsSpans = Array.from(
    container.querySelectorAll<HTMLElement>('span[aria-label^="Odds"]')
  );
  for (const span of oddsSpans) {
    const parentDiv = span.closest<HTMLElement>("div");
    if (parentDiv && !candidates.includes(parentDiv)) {
      // Make sure it's not the SGP container itself
      const parentAria = (parentDiv.getAttribute("aria-label") || "").toLowerCase();
      if (!parentAria.includes("same game parlay") || parentAria.includes("to record") || parentAria.includes("to score") || parentAria.includes("triple double")) {
        candidates.push(parentDiv);
      }
    }
  }
  
  // Also look for divs that contain player names + "To Record" or "To Score" patterns
  // This catches legs that might not have aria-labels or leg-row class
  const allDivs = Array.from(container.querySelectorAll<HTMLElement>("div"));
  for (const div of allDivs) {
    if (candidates.includes(div)) continue;
    
    const text = normalizeSpaces(div.textContent || "");
    const aria = normalizeSpaces(div.getAttribute("aria-label") || "");
    const combined = `${text} ${aria}`.toLowerCase();
    
    // Look for pattern: Player Name + "To Record" or "To Score" + market type
    const hasPlayerAndMarket = /[A-Z][a-z]+\s+[A-Z][a-z]+.*to\s+(record|score).*(triple double|double double|\d+\+\s+(assists|points|rebounds|yards|receptions|made threes))/i.test(combined);
    
    if (hasPlayerAndMarket) {
      // Make sure it's not the container itself or a header
      if (div !== container && !combined.includes("same game parlay") && !combined.includes("includes:")) {
        candidates.push(div);
      }
    }
  }

  const marketPattern =
    /SPREAD BETTING|MONEYLINE|TOTAL|TO RECORD|TO SCORE|MADE THREES|ASSISTS|REBOUNDS|POINTS|OVER|UNDER|YARDS|RECEPTIONS|REC\b|YDS|TRIPLE DOUBLE|DOUBLE DOUBLE/i;

  const filtered = candidates.filter((node) => {
    const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
    const text = normalizeSpaces(node.textContent || "");
    const hasOdds = !!node.querySelector<HTMLElement>(
      'span[aria-label^="Odds"]'
    );
    const hasMarket = marketPattern.test(aria) || marketPattern.test(text);
    const isFooterLike =
      /TOTAL WAGER|BET ID|PLACED:/i.test(text) || /TOTAL WAGER/i.test(aria);
    const hasLetters = /[A-Za-z]{3,}/.test(aria || text);
    
    // Exclude SGP header text (but allow if it has market indicators)
    const isSGPHeader = /^same\s+game\s+parlay/i.test(aria) && !hasMarket;
    
    // Check if this looks like a player name + market (common pattern in SGP legs)
    const hasPlayerNamePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/i.test(aria || text);
    const hasPlayerAndMarket = hasPlayerNamePattern && hasMarket;

    if (isFooterLike) return false;
    if (isSGPHeader) return false;
    if (!hasLetters) return false;
    
    // For SGP inner legs, accept if:
    // 1. Has odds (individual leg with odds)
    // 2. Has market text (leg with market indicator)
    // 3. Has player name + market pattern (player name followed by market)
    return hasOdds || hasMarket || hasPlayerAndMarket;
  });

  // Deduplicate by containment to keep top-level rows only
  // But be careful - we want to keep all distinct legs, even if one contains another
  // (e.g., a parent div might contain a leg-row child)
  const unique: HTMLElement[] = [];
  const seenText = new Set<string>();
  
  for (const node of filtered) {
    const text = normalizeSpaces(node.textContent || "");
    const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
    
    // Create a signature based on player name + market to identify unique legs
    const playerMatch = (text || aria).match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    const marketMatch = (text || aria).match(/(to\s+record|to\s+score|triple\s+double|\d+\+\s+(assists|points|rebounds|yards|receptions|made\s+threes))/i);
    
    if (playerMatch && marketMatch) {
      const signature = `${playerMatch[1]}_${marketMatch[1]}`.toLowerCase();
      if (seenText.has(signature)) continue;
      seenText.add(signature);
    }
    
    // Also check if this node is contained within another candidate
    // Only exclude if it's truly a duplicate (same content)
    const isContained = filtered.some((other) => {
      if (other === node || !other.contains(node)) return false;
      const otherText = normalizeSpaces(other.textContent || "");
      const otherAria = normalizeSpaces(other.getAttribute("aria-label") || "");
      // If the containing node has the same player+market, it's a duplicate
      return (text && otherText.includes(text)) || (aria && otherAria.includes(aria));
    });
    
    if (!isContained) {
      unique.push(node);
    }
  }

  return unique;
};

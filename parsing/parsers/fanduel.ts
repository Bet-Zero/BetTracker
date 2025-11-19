/**
 * FanDuel Parser V2 - Simplified Architecture
 *
 * This parser directly converts HTML to Bet objects, eliminating unnecessary intermediate steps.
 * Flow: HTML → Bet (single transformation)
 *
 * Uses robust text-based traversal instead of fragile CSS class selectors.
 */

import { Bet, BetResult, BetType, BetLeg } from "../../types";

/**
 * Parses raw HTML content from a FanDuel settled bets page.
 * Returns Bet objects directly for internal storage.
 */
export const parse = (htmlContent: string): Bet[] => {
  console.log("Starting FanDuel parse (v2)...");
  const bets: Bet[] = [];

  if (!htmlContent || !htmlContent.trim()) {
    console.warn("FanDuel parser: Empty HTML content provided.");
    return bets;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // Find all BET ID patterns
    const betIdPattern = /BET ID:\s*([^\s<]+)/g;
    const htmlText = doc.documentElement.innerHTML;
    const betIdMatches = Array.from(htmlText.matchAll(betIdPattern));

    console.log(
      `FanDuel parser: Found ${betIdMatches.length} BET ID patterns.`
    );

    const seenBetIds = new Set<string>();

    // Find BET ID text nodes in the DOM
    const betIdTextNodes: Array<{ node: Node; betId: string }> = [];
    const walker = doc.createTreeWalker(
      doc.body || doc.documentElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes("BET ID:")) {
        const match = node.textContent.match(/BET ID:\s*([^\s<]+)/);
        if (match && match[1]) {
          betIdTextNodes.push({ node, betId: match[1] });
        }
      }
    }

    console.log(
      `FanDuel parser: Found ${betIdTextNodes.length} BET ID text nodes.`
    );

    for (const { node: betIdNode, betId } of betIdTextNodes) {
      try {
        // Deduplicate
        if (seenBetIds.has(betId)) {
          console.warn(`FanDuel parser: Duplicate bet ID ${betId}, skipping.`);
          continue;
        }
        seenBetIds.add(betId);

        // Find the bet card containing this BET ID
        const betCard = findBetCard(doc, betId);
        if (!betCard) {
          console.warn(
            `FanDuel parser: Could not find bet card for BET ID ${betId}`
          );
          continue;
        }

        // Extract bet from the card
        const bet = extractBet(betId, betCard);
        if (bet) {
          bets.push(bet);
          console.log(`FanDuel parser: Successfully parsed bet ${betId}`);
        } else {
          console.warn(`FanDuel parser: Failed to extract bet ${betId}`);
        }
      } catch (error) {
        console.warn(`FanDuel parser: Error parsing bet:`, error);
      }
    }

    console.log(`FanDuel parser: Successfully parsed ${bets.length} bets.`);
  } catch (error) {
    console.error("FanDuel parser: Error parsing HTML:", error);
  }

  return bets;
};

/**
 * Finds the bet card element containing the given bet ID.
 * Uses text-based traversal to find the <li> containing the BET ID.
 */
function findBetCard(doc: Document, betId: string): Element | null {
  const allLis = Array.from(doc.querySelectorAll("li"));

  // Find the <li> that contains this BET ID and has substantial content
  for (const li of allLis) {
    const text = li.textContent || "";
    if (text.includes(`BET ID: ${betId}`) && text.length > 200) {
      return li;
    }
  }

  // If not found, try to find any element with this BET ID
  for (const li of allLis) {
    const text = li.textContent || "";
    if (text.includes(`BET ID: ${betId}`)) {
      return li;
    }
  }

  return null;
}

/**
 * Extracts a Bet object from a bet card element.
 * Uses robust text-based traversal instead of fragile CSS classes.
 */
function extractBet(betId: string, betCard: Element): Bet | null {
  try {
    const cardText = betCard.textContent || "";

    // Extract odds using aria-label (stable attribute)
    const oddsSpan = betCard.querySelector('span[aria-label^="Odds"]');
    let odds = 0;
    if (oddsSpan) {
      const ariaLabel = oddsSpan.getAttribute("aria-label") || "";
      const oddsMatch = ariaLabel.match(/Odds\s*([+-]\d+)/);
      if (oddsMatch) {
        odds = parseInt(oddsMatch[1], 10);
      }
    }

    // Extract wager and returned amounts using text-based pattern matching
    // Pattern: $X.XX appears BEFORE the label "TOTAL WAGER"
    const wagerMatch = cardText.match(/\$([\d.]+)[^\$]*TOTAL WAGER/);
    const returnedMatch = cardText.match(/\$([\d.]+)[^\$]*RETURNED/);
    const stake = wagerMatch ? parseFloat(wagerMatch[1]) : 0;
    const payout = returnedMatch ? parseFloat(returnedMatch[1]) : 0;

    // Determine result
    let result: BetResult = "pending";
    if (payout === 0 && stake > 0) {
      result = "loss";
    } else if (payout > stake) {
      result = "win";
    } else if (payout === stake && stake > 0) {
      result = "push";
    }

    // Extract placed date
    const placedMatch = cardText.match(/PLACED:\s*([^<\n]+)/);
    const placedAt = placedMatch
      ? parseDateToISO(placedMatch[1].trim())
      : new Date().toISOString();
    const settledAt = result !== "pending" ? placedAt : undefined;

    // Check if it's a multi-leg bet (SGP/parlay)
    const isSGP =
      cardText.includes("Same Game Parlay") || cardText.includes("SGP");
    const resultIcons = betCard.querySelectorAll(
      'svg[id*="tick"], svg[id*="cross"]'
    );
    const isMultiLeg = isSGP || resultIcons.length > 1;

    // Extract sport from team names or market keywords
    const sport = inferSport(cardText);

    // Extract legs using robust traversal
    const legs: BetLeg[] = extractLegs(betCard, isMultiLeg, result);

    // Determine bet type
    const betType: BetType = isMultiLeg ? "sgp" : "single";

    // Check for live bet
    const isLive =
      cardText.toLowerCase().includes("live") ||
      cardText.toLowerCase().includes("in-game");

    // Build description
    let description = "";
    if (isMultiLeg && legs.length > 0) {
      description = `SGP: ${legs
        .map((leg) => `${leg.entities?.[0] || ""} ${leg.market}`)
        .join(" / ")}`;
    } else if (legs.length > 0) {
      const leg = legs[0];
      description = `${leg.entities?.[0] || ""}: ${leg.market} ${
        leg.target || ""
      }`.trim();
    } else {
      description = `Bet ${betId}`;
    }

    // Classify market category
    const marketCategory = legs.length > 0 ? "Props" : "Other";

    // Generate unique ID
    const id = `FanDuel-${betId}-${placedAt}`;

    // Populate convenience fields from first leg
    const firstLeg = legs.length > 0 ? legs[0] : null;
    const name = firstLeg?.entities?.[0];
    const type = firstLeg?.market;
    const line = firstLeg?.target?.toString();
    const ou = firstLeg?.ou;

    const bet: Bet = {
      id,
      book: "FanDuel",
      betId,
      placedAt,
      settledAt,
      betType,
      marketCategory,
      sport,
      description,
      odds,
      stake,
      payout,
      result,
      legs: legs.length > 0 ? legs : undefined,
      isLive,
      name,
      type,
      line,
      ou,
    };

    return bet;
  } catch (error) {
    console.warn(`FanDuel parser: Error extracting bet for ${betId}:`, error);
    return null;
  }
}

/**
 * Extracts legs from a bet card using robust text-based traversal.
 * Finds player names and market text by searching for patterns in the DOM structure.
 */
function extractLegs(
  betCard: Element,
  isMultiLeg: boolean,
  betResult: BetResult
): BetLeg[] {
  const legs: BetLeg[] = [];

  if (isMultiLeg) {
    // For multi-leg bets, find all leg containers
    // Look for elements that contain player images and market text
    // Strategy: Find all img elements with headshots, then find nearby player names and markets

    const headshotImages = betCard.querySelectorAll('img[src*="headshots"]');
    const legContainers: Element[] = [];
    const seenContainers = new Set<Element>(); // Deduplicate containers

    // For each headshot, find its containing leg element
    headshotImages.forEach((img) => {
      // Walk up the DOM to find a container that likely holds a leg
      let container: Element | null = img.parentElement;
      let depth = 0;
      while (container && depth < 10) {
        const text = container.textContent || "";
        // Look for containers that have both a player name pattern and market text
        if (text.length > 20 && text.length < 500) {
          // Check if this looks like a leg container
          const hasPlayerName = /[A-Z][a-z]+ [A-Z][a-z]+/.test(text);
          const hasMarketText =
            /(Made Threes|Assists|Points|Rebounds|Steals|Blocks|To Record)/i.test(
              text
            );

          if (hasPlayerName && hasMarketText) {
            // Only add if we haven't seen this container before
            if (!seenContainers.has(container)) {
              legContainers.push(container);
              seenContainers.add(container);
            }
            break;
          }
        }
        container = container.parentElement;
        depth++;
      }
    });

    // Extract leg data from each container
    for (const container of legContainers) {
      const leg = extractLegFromContainer(container, betCard);
      if (leg) {
        legs.push(leg);
      }
    }
  } else {
    // For single bets, extract from the entire card
    const leg = extractLegFromContainer(betCard, betCard);
    if (leg) {
      legs.push(leg);
    }
  }

  return legs;
}

/**
 * Extracts a single leg from a container element.
 * Uses text-based patterns to find player names and market text.
 */
function extractLegFromContainer(
  container: Element,
  betCard: Element
): BetLeg | null {
  const containerText = container.textContent || "";

  // Find player name - look for text patterns that look like names
  // Pattern: "FirstName LastName" (capitalized words)
  const nameMatch = containerText.match(
    /([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
  );
  const playerName = nameMatch ? normalizeText(nameMatch[1]) : "";

  if (!playerName) {
    return null;
  }

  // Find market text - look for spans or text containing market keywords
  // Try to find market text near the player name
  const marketPatterns = [
    /(\d+\+\s*(?:Made Threes|Assists|Points|Rebounds|Steals|Blocks))/i,
    /(To Record\s+\d+\+\s*(?:Assists|Points|Rebounds|Steals|Blocks))/i,
    /(\d+\.\d+\s*(?:Points|Rebounds|Assists|Steals|Blocks))/i,
  ];

  let marketText = "";
  for (const pattern of marketPatterns) {
    const match = containerText.match(pattern);
    if (match) {
      marketText = match[1];
      break;
    }
  }

  // If no pattern match, try to find text that looks like a market
  if (!marketText) {
    // Look for spans that might contain market text
    const allSpans = container.querySelectorAll("span");
    for (const span of allSpans) {
      const spanText = span.textContent || "";
      if (
        spanText.length > 5 &&
        spanText.length < 50 &&
        /(Made|Record|Points|Assists|Rebounds|Steals|Blocks|Threes)/i.test(
          spanText
        )
      ) {
        marketText = spanText;
        break;
      }
    }
  }

  if (!marketText) {
    return null;
  }

  // Determine leg result from icon
  const hasWinIcon = container.querySelector('svg[id*="tick"]') !== null;
  const hasLossIcon = container.querySelector('svg[id*="cross"]') !== null;
  const legResult: BetResult = hasWinIcon
    ? "win"
    : hasLossIcon
    ? "loss"
    : "pending";

  // Parse market to extract type and target
  const { market, target, ou } = parseMarket(marketText);

  return {
    entities: [playerName],
    market,
    target,
    ou,
    result: legResult,
  };
}

/**
 * Infers sport from card text using team names and market keywords.
 * Returns sport abbreviation or 'Unknown' if cannot determine.
 */
function inferSport(cardText: string): string {
  // Check for explicit sport indicators in team names
  const nbaTeams = [
    "Warriors",
    "Lakers",
    "Celtics",
    "Heat",
    "Bulls",
    "Knicks",
    "Mavericks",
    "Nuggets",
    "76ers",
    "Bucks",
    "Suns",
    "Clippers",
    "Nets",
    "Pelicans",
    "Jazz",
    "Rockets",
    "Spurs",
    "Thunder",
    "Trail Blazers",
    "Kings",
    "Timberwolves",
    "Hornets",
    "Pistons",
    "Magic",
    "Pacers",
    "Hawks",
    "Wizards",
    "Raptors",
    "Cavaliers",
    "Grizzlies",
  ];

  const nflTeams = [
    "Chiefs",
    "Patriots",
    "Packers",
    "Cowboys",
    "Steelers",
    "49ers",
    "Ravens",
    "Bills",
    "Dolphins",
    "Jets",
    "Browns",
    "Bengals",
    "Titans",
    "Colts",
    "Texans",
    "Jaguars",
    "Raiders",
    "Chargers",
    "Broncos",
    "Giants",
    "Eagles",
    "Commanders",
    "Bears",
    "Lions",
    "Vikings",
    "Falcons",
    "Panthers",
    "Saints",
    "Buccaneers",
    "Cardinals",
    "Rams",
    "Seahawks",
  ];

  const mlbTeams = [
    "Yankees",
    "Red Sox",
    "Dodgers",
    "Giants",
    "Cubs",
    "Cardinals",
    "Astros",
    "Braves",
    "Mets",
    "Phillies",
    "Nationals",
    "Marlins",
    "Brewers",
    "Reds",
    "Pirates",
    "Rockies",
    "Diamondbacks",
    "Padres",
    "Angels",
    "Athletics",
    "Mariners",
    "Rangers",
    "Twins",
    "White Sox",
    "Indians",
    "Guardians",
    "Royals",
    "Tigers",
    "Orioles",
    "Blue Jays",
    "Rays",
    "Rangers",
  ];

  // Check for market keywords FIRST (most reliable indicator)
  // This avoids misclassifying ambiguous team names like "Giants" and "Cardinals"
  const marketKeywords: Record<string, string[]> = {
    NBA: [
      "Made Threes",
      "Rebounds",
      "Assists",
      "Points",
      "Steals",
      "Blocks",
      "Triple-Double",
    ],
    NFL: [
      "Touchdowns",
      "Passing Yards",
      "Rushing Yards",
      "Receiving Yards",
      "Receptions",
    ],
    MLB: ["Hits", "Home Runs", "Strikeouts", "RBIs", "Runs"],
    NHL: ["Goals", "Assists", "Saves", "Shots"],
  };

  for (const [sport, keywords] of Object.entries(marketKeywords)) {
    if (keywords.some((keyword) => cardText.includes(keyword))) {
      return sport;
    }
  }

  // Check for NBA teams
  if (nbaTeams.some((team) => cardText.includes(team))) {
    return "NBA";
  }

  // Check for MLB teams BEFORE NFL to handle ambiguous team names
  // (e.g., "Giants" and "Cardinals" exist in both leagues)
  if (mlbTeams.some((team) => cardText.includes(team))) {
    return "MLB";
  }

  // Check for NFL teams (after MLB to avoid misclassifying ambiguous names)
  if (nflTeams.some((team) => cardText.includes(team))) {
    return "NFL";
  }

  // Default to unknown if we can't determine
  return "Unknown";
}

/**
 * Parses market text to extract market type, target, and over/under.
 * Examples: "3+ Made Threes" → { market: "3pt", target: "3+", ou: undefined }
 *           "Over 25.5 Points" → { market: "Pts", target: "25.5", ou: "Over" }
 */
function parseMarket(marketText: string): {
  market: string;
  target?: string;
  ou?: "Over" | "Under";
} {
  const text = marketText.toLowerCase();

  // Extract over/under
  let ou: "Over" | "Under" | undefined;
  if (text.includes("over")) {
    ou = "Over";
  } else if (text.includes("under")) {
    ou = "Under";
  }

  // Extract line/target (e.g., "3+", "25.5")
  const lineMatch = marketText.match(/(\d+(?:\.\d+)?)\+?/);
  const target = lineMatch
    ? lineMatch[1] + (marketText.includes("+") ? "+" : "")
    : undefined;

  // Determine market type
  if (
    text.includes("made threes") ||
    text.includes("3-pointers") ||
    text.includes("threes")
  ) {
    return { market: "3pt", target, ou };
  }
  if (text.includes("points") || text.includes("pts")) {
    return { market: "Pts", target, ou };
  }
  if (text.includes("rebounds") || text.includes("reb")) {
    return { market: "Reb", target, ou };
  }
  if (text.includes("assists") || text.includes("ast")) {
    return { market: "Ast", target, ou };
  }
  if (text.includes("steals") || text.includes("stl")) {
    return { market: "Stl", target, ou };
  }
  if (text.includes("blocks") || text.includes("blk")) {
    return { market: "Blk", target, ou };
  }

  // Default: use the first meaningful word
  const words = marketText.split(/\s+/);
  const market =
    words.find((w) => w.length > 2 && !/^\d/.test(w)) || marketText;

  return { market, target, ou };
}

/**
 * Normalizes text by removing extra whitespace.
 */
function normalizeText(text: string | null): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parses date string to ISO timestamp.
 * Handles format: "11/16/2025 7:09PM ET"
 */
function parseDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Parse MM/DD/YYYY H:MMAM/PM format
  const match = dateStr.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)/i
  );
  if (match) {
    const [, month, day, year, hour, minute, ampm] = match;
    let hourNum = parseInt(hour, 10);
    if (ampm.toUpperCase() === "PM" && hourNum !== 12) {
      hourNum += 12;
    } else if (ampm.toUpperCase() === "AM" && hourNum === 12) {
      hourNum = 0;
    }
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      hourNum,
      parseInt(minute, 10)
    );
    return date.toISOString();
  }

  return new Date().toISOString();
}

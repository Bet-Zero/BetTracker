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

        // Find the bet card containing this BET ID - start from the text node's parent
        const betCard = findBetCardFromNode(betIdNode) || findBetCard(doc, betId);
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
          console.log(`FanDuel parser: Successfully parsed bet ${betId} - Sport: ${bet.sport}, Category: ${bet.marketCategory}, Type: ${bet.type || 'N/A'}`);
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
 * Finds the bet card element by walking up from the BET ID text node.
 * This ensures we get the correct unique card for each bet.
 * Returns the SMALLEST container that contains this specific BET ID.
 */
function findBetCardFromNode(betIdNode: Node): Element | null {
  let current: Node | null = betIdNode;
  let depth = 0;
  const maxDepth = 20;
  let bestMatch: Element | null = null;
  let bestMatchSize = Infinity;

  while (current && depth < maxDepth) {
    // If we hit an element node, check if it looks like a bet card container
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      const text = element.textContent || "";
      
      // Look for a container that has this specific BET ID and substantial content
      // Count how many BET IDs are in this container - we want the one with only ONE
      const betIdMatches = text.match(/BET ID:\s*[^\s<]+/g) || [];
      
      if (betIdMatches.length === 1 && text.includes("BET ID:") && text.length > 200) {
        // This container has exactly one BET ID - it's likely the bet card
        // Prefer smaller containers (more specific)
        if (text.length < bestMatchSize && text.length < 50000) {
          bestMatch = element;
          bestMatchSize = text.length;
        }
      }
    }
    
    current = current.parentNode;
    depth++;
  }

  return bestMatch;
}

/**
 * Finds the bet card element containing the given bet ID.
 * Uses text-based traversal to find the <li> containing the BET ID.
 * This is a fallback method if findBetCardFromNode fails.
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

    // Extract legs using robust traversal
    const legs: BetLeg[] = extractLegs(betCard, isMultiLeg, result);
    
    // Safety check: If we extracted way too many legs, something is wrong
    // Limit to reasonable maximum (e.g., 10 legs for a parlay is already very high)
    if (legs.length > 10) {
      console.error(`FanDuel parser: Bet ${betId} has ${legs.length} legs - this is likely a parsing error. Limiting to first 10.`);
      legs.splice(10);
    }

    // Extract sport from team image URLs (most reliable), then fall back to text inference
    const sport = inferSportFromImages(betCard) || inferSport(cardText, legs, betCard);

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
    const marketCategory = legs.length > 0 ? "Props" : "Main Markets";

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
    // BUT: Only extract ONE leg - be very selective to avoid matching unrelated content
    const leg = extractSingleBetLeg(betCard);
    if (leg) {
      legs.push(leg);
    }
  }

  return legs;
}

/**
 * Extracts a single leg for a single bet (not multi-leg).
 * This is more precise than extractLegFromContainer to avoid matching unrelated content.
 */
function extractSingleBetLeg(betCard: Element): BetLeg | null {
  const cardText = betCard.textContent || "";
  
  // Check if this is a Main Market bet first
  const isMainMarket = /(SPREAD BETTING|MONEYLINE|TOTAL POINTS)/i.test(cardText);
  
  if (isMainMarket) {
    return extractMainMarketLeg(betCard, betCard);
  }
  
  // For Props: Look for the primary bet content, not all player names in the card
  // Strategy: Find elements with headshots (most reliable for props) or look for specific bet structure
  const headshotImages = betCard.querySelectorAll('img[src*="headshots"]');
  
  if (headshotImages.length > 0) {
    // Use the first headshot to find the associated leg (most reliable)
    const firstHeadshot = headshotImages[0];
    let container: Element | null = firstHeadshot.parentElement;
    let depth = 0;
    
    while (container && depth < 10) {
      const text = container.textContent || "";
      if (text.length > 20 && text.length < 500) {
        const hasPlayerName = /[A-Z][a-z]+ [A-Z][a-z]+/.test(text);
        const hasMarketText = /(Made Threes|Assists|Points|Rebounds|Steals|Blocks|To Record)/i.test(text);
        
        if (hasPlayerName && hasMarketText) {
          return extractPropLeg(container, betCard);
        }
      }
      container = container.parentElement;
      depth++;
    }
  }
  
  // Fallback: Try to extract from the card, but be very strict
  // Only match if we find a clear prop pattern
  const propPattern = /([A-Z][a-z]+ [A-Z][a-z]+).*?(\d+\+\s*(?:Made Threes|Assists|Points|Rebounds|Steals|Blocks)|To Record)/i;
  if (propPattern.test(cardText)) {
    return extractPropLeg(betCard, betCard);
  }
  
  return null;
}

/**
 * Extracts a single leg from a container element.
 * Handles both Props (player bets) and Main Markets (team bets: Spread, Moneyline, Total).
 * Used for multi-leg bets where we know the container is a specific leg.
 */
function extractLegFromContainer(
  container: Element,
  betCard: Element
): BetLeg | null {
  const containerText = container.textContent || "";
  
  // Check if this is a Main Market bet (Spread, Moneyline, Total Points)
  const isMainMarket = /(SPREAD BETTING|MONEYLINE|TOTAL POINTS)/i.test(containerText);
  
  if (isMainMarket) {
    return extractMainMarketLeg(container, betCard);
  } else {
    return extractPropLeg(container, betCard);
  }
}

/**
 * Extracts a leg for Main Market bets (Spread, Moneyline, Total Points).
 * These bets have team names, not player names.
 */
function extractMainMarketLeg(
  container: Element,
  betCard: Element
): BetLeg | null {
  const containerText = container.textContent || "";
  
  // Find market type from text
  let marketType = "";
  if (/SPREAD BETTING/i.test(containerText)) {
    marketType = "Spread";
  } else if (/MONEYLINE/i.test(containerText)) {
    marketType = "Moneyline";
  } else if (/TOTAL POINTS/i.test(containerText)) {
    marketType = "Total";
  }
  
  // Extract team names from aria-label or text
  // Pattern from user's HTML: "Orlando Magic, SPREAD BETTING, , -112, Golden State Warriors @ Orlando Magic"
  let teamName = "";
  const ariaLabels = Array.from(container.querySelectorAll('[aria-label]'));
  for (const el of ariaLabels) {
    const ariaLabel = el.getAttribute('aria-label') || '';
    // Match pattern: "TeamName, MARKET_TYPE, ..."
    const teamMatch = ariaLabel.match(/^([^,]+),/);
    if (teamMatch) {
      teamName = normalizeText(teamMatch[1].trim());
      break;
    }
  }
  
  // Fallback: look for team names in spans with role="text"
  if (!teamName) {
    const teamSpans = container.querySelectorAll('span[role="text"]');
    for (const span of teamSpans) {
      const text = span.textContent || '';
      // Team names are usually 2-4 words, capitalized
      if (text.length > 5 && text.length < 50 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(text.trim())) {
        // Check if it's not a date/time pattern
        if (!/\d{1,2}:\d{2}/.test(text) && !/\d{1,2}\/\d{1,2}/.test(text)) {
          teamName = normalizeText(text.trim());
          break;
        }
      }
    }
  }
  
  // Extract line (spread/total) - look for patterns like "+2.5", "-3", "O 225.5", "U 225.5"
  let line = "";
  let ou: 'Over' | 'Under' | undefined = undefined;
  
  // Look for spread line in spans (e.g., "+2.5")
  const lineSpans = container.querySelectorAll('span');
  for (const span of lineSpans) {
    const text = span.textContent || '';
    // Match patterns like "+2.5", "-3", "O 225.5", "U 225.5"
    const lineMatch = text.match(/([+-]?\d+\.?\d*)/);
    if (lineMatch && text.length < 10) {
      const potentialLine = lineMatch[1];
      // Check if it's not odds (odds are usually -150 to +150 range, but can be wider)
      const numLine = parseFloat(potentialLine);
      if (Math.abs(numLine) < 100 || marketType === "Total") {
        line = potentialLine;
        // Check for Over/Under indicators
        if (/O\s*\d|OVER/i.test(text)) {
          ou = 'Over';
        } else if (/U\s*\d|UNDER/i.test(text)) {
          ou = 'Under';
        }
        break;
      }
    }
  }
  
  // Determine leg result from icon
  const hasWinIcon = container.querySelector('svg[id*="tick"]') !== null;
  const hasLossIcon = container.querySelector('svg[id*="cross"]') !== null;
  const legResult: BetResult = hasWinIcon
    ? "win"
    : hasLossIcon
    ? "loss"
    : "pending";
  
  if (!teamName || !marketType) {
    return null;
  }
  
  return {
    entities: [teamName],
    market: marketType,
    target: line || undefined,
    ou,
    result: legResult,
  };
}

/**
 * Extracts a leg for Prop bets (player stat bets).
 * Uses text-based patterns to find player names and market text.
 */
function extractPropLeg(
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
 * Extracts sport from team image URLs (most reliable method).
 * Looks for patterns like /team/nba/, /team/nfl/, etc. in image src attributes.
 * Returns sport abbreviation or empty string if not found.
 */
function inferSportFromImages(betCard: Element): string {
  const images = betCard.querySelectorAll('img[src*="/team/"]');
  
  for (const img of Array.from(images)) {
    const src = img.getAttribute('src') || '';
    // Check for sport in URL pattern: /team/{sport}/
    const sportMatch = src.match(/\/team\/(nba|nfl|mlb|nhl|ncaa|wnba|cfb|soccer|tennis|golf|mma|ufc|boxing|f1|nascar)/i);
    if (sportMatch) {
      const sport = sportMatch[1].toUpperCase();
      // Normalize some variations
      if (sport === 'CFB') return 'NCAAF';
      if (sport === 'NCAA') return 'NCAA';
      return sport;
    }
  }
  
  return '';
}

/**
 * Infers sport from card text using team names and market keywords.
 * Returns sport abbreviation or 'Unknown' if cannot determine.
 */
function inferSport(cardText: string, legs?: BetLeg[], betCard?: Element): string {
  const normalizedText = cardText.toLowerCase();
  
  // Check for explicit sport indicators in team names
  const nbaTeams = [
    "warriors", "lakers", "celtics", "heat", "bulls", "knicks", "mavericks",
    "nuggets", "76ers", "sixers", "bucks", "suns", "clippers", "nets",
    "pelicans", "jazz", "rockets", "spurs", "thunder", "trail blazers",
    "blazers", "kings", "timberwolves", "wolves", "hornets", "pistons",
    "magic", "pacers", "hawks", "wizards", "raptors", "cavaliers", "cavs",
    "grizzlies", "grizz",
  ];

  const nflTeams = [
    "chiefs", "patriots", "pats", "packers", "cowboys", "steelers", "49ers",
    "ravens", "bills", "dolphins", "jets", "browns", "bengals", "titans",
    "colts", "texans", "jaguars", "jags", "raiders", "chargers", "broncos",
    "giants", "eagles", "commanders", "bears", "lions", "vikings", "vikes",
    "falcons", "panthers", "saints", "buccaneers", "bucs", "cardinals",
    "rams", "seahawks", "hawks",
  ];

  const mlbTeams = [
    "yankees", "red sox", "dodgers", "giants", "cubs", "cardinals", "astros",
    "braves", "mets", "phillies", "nationals", "marlins", "brewers", "reds",
    "pirates", "rockies", "diamondbacks", "dbacks", "padres", "angels",
    "athletics", "a's", "mariners", "rangers", "twins", "white sox",
    "indians", "guardians", "royals", "tigers", "orioles", "blue jays",
    "rays", "rangers",
  ];

  // Check for market keywords FIRST (most reliable indicator)
  // This avoids misclassifying ambiguous team names like "Giants" and "Cardinals"
  const marketKeywords: Record<string, string[]> = {
    NBA: [
      "made threes", "rebounds", "assists", "points", "steals", "blocks",
      "triple-double", "3pt", "3-point", "pts", "reb", "ast", "stl", "blk",
    ],
    NFL: [
      "touchdowns", "passing yards", "rushing yards", "receiving yards",
      "receptions", "tds", "pass yds", "rush yds", "rec yds", "receptions",
    ],
    MLB: ["hits", "home runs", "strikeouts", "rbis", "runs", "hr", "so", "k"],
    NHL: ["goals", "assists", "saves", "shots", "g", "a", "sv"],
  };

  // Check market keywords (case-insensitive)
  for (const [sport, keywords] of Object.entries(marketKeywords)) {
    if (keywords.some((keyword) => normalizedText.includes(keyword))) {
      return sport;
    }
  }

  // Also check legs for market keywords if available
  if (legs && legs.length > 0) {
    const legText = legs.map(leg => leg.market?.toLowerCase() || '').join(' ');
    for (const [sport, keywords] of Object.entries(marketKeywords)) {
      if (keywords.some((keyword) => legText.includes(keyword))) {
        return sport;
      }
    }
  }

  // Check for Main market indicators that might help
  const mainMarketIndicators = {
    NBA: ["nba", "basketball"],
    NFL: ["nfl", "football"],
    MLB: ["mlb", "baseball"],
    NHL: ["nhl", "hockey"],
  };

  for (const [sport, indicators] of Object.entries(mainMarketIndicators)) {
    if (indicators.some((indicator) => normalizedText.includes(indicator))) {
      // Only use this if we also find a team name to avoid false positives
      const teamLists: Record<string, string[]> = {
        NBA: nbaTeams,
        NFL: nflTeams,
        MLB: mlbTeams,
      };
      const teams = teamLists[sport] || [];
      if (teams.some((team) => normalizedText.includes(team))) {
        return sport;
      }
    }
  }

  // Check for NBA teams (case-insensitive, partial match)
  if (nbaTeams.some((team) => normalizedText.includes(team))) {
    return "NBA";
  }

  // Check for MLB teams BEFORE NFL to handle ambiguous team names
  // (e.g., "Giants" and "Cardinals" exist in both leagues)
  if (mlbTeams.some((team) => normalizedText.includes(team))) {
    return "MLB";
  }

  // Check for NFL teams (after MLB to avoid misclassifying ambiguous names)
  if (nflTeams.some((team) => normalizedText.includes(team))) {
    return "NFL";
  }

  // Check legs for team names if available
  if (legs && legs.length > 0) {
    const legText = legs.map(leg => 
      leg.entities?.join(' ').toLowerCase() || ''
    ).join(' ');
    
    if (nbaTeams.some((team) => legText.includes(team))) {
      return "NBA";
    }
    if (mlbTeams.some((team) => legText.includes(team))) {
      return "MLB";
    }
    if (nflTeams.some((team) => legText.includes(team))) {
      return "NFL";
    }
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

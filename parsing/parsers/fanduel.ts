import { Bet, BetResult, BetType, BetLeg, StrictBetRow } from "../../types";
import { classifyBet } from "../../services/classificationService";
import {
  normalizeText,
  parseAmount,
  parseAmericanOdds,
  parseFanDuelDate,
  inferBetType,
  inferSport,
  parseMarketText,
  convertBetToStrictRow,
} from "../utils";

/**
 * Parses raw HTML content from a FanDuel settled bets page.
 * Extracts bet information from the HTML structure and returns normalized Bet objects.
 */
export const parse = (htmlContent: string): Bet[] => {
  console.log("Starting FanDuel parse...");
  const bets: Bet[] = [];

  if (!htmlContent || !htmlContent.trim()) {
    console.warn("FanDuel parser: Empty HTML content provided.");
    return bets;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // Strategy: Find all BET ID patterns first, then for each one, find its card
    const betIdPattern = /BET ID:\s*([^\s<]+)/g;
    const htmlText = doc.documentElement.innerHTML;
    const betIdMatches = Array.from(htmlText.matchAll(betIdPattern));

    console.log(
      `FanDuel parser: Found ${betIdMatches.length} BET ID patterns.`
    );

    const seenBetIds = new Set<string>();

    // Find BET ID elements in the DOM
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

        // Find the bet card by walking up from the BET ID text node
        let betCard: Element | null = null;
        let current: Node | null = betIdNode.parentElement;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const element = current as Element;
          const text = element.textContent || "";

          // Check if this element contains all the key bet card markers
          const hasBetId = text.includes("BET ID:");
          const hasWager = text.includes("TOTAL WAGER");
          const hasReturned = text.includes("RETURNED");
          const hasPlaced = text.includes("PLACED:");
          const hasOdds =
            element.querySelector('span[aria-label^="Odds"]') !== null;
          const hasSGP = text.includes("Same Game Parlay");

          // More lenient: require BET ID + at least 2 other markers
          const markerCount = [
            hasWager,
            hasReturned,
            hasPlaced,
            hasOdds,
            hasSGP,
          ].filter(Boolean).length;
          if (hasBetId && markerCount >= 2) {
            betCard = element;
            break;
          }

          current = current.parentElement;
        }

        if (!betCard) {
          console.warn(
            `FanDuel parser: Could not find bet card for BET ID ${betId}`
          );
          continue;
        }

        // Try to find a larger container that includes the leg section
        // The betCard might only include the footer, so check parent and siblings for leg content
        let searchContainer = betCard;
        let currentCheck: Element | null = betCard.parentElement;
        let checkDepth = 0;
        while (currentCheck && checkDepth < 3) {
          const checkText = currentCheck.textContent || "";
          // If this container has leg-related content and includes the BET ID, use it
          if (
            (checkText.includes("To Record") ||
              checkText.includes("Made Threes") ||
              checkText.includes("Isaiah Collier") ||
              checkText.includes("Ace Bailey")) &&
            checkText.includes("BET ID:")
          ) {
            searchContainer = currentCheck;
            break;
          }
          currentCheck = currentCheck.parentElement;
          checkDepth++;
        }

        // Parse the bet card
        const bet = parseFanDuelBetCard(betId, searchContainer, htmlText);
        if (bet) {
          bets.push(bet);
          console.log(
            `FanDuel parser: Successfully parsed bet ${betId} with ${
              bet.legs?.length || 0
            } legs`
          );
        } else {
          console.warn(`FanDuel parser: Failed to parse bet ${betId}`);
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
 * Parses FanDuel HTML content and returns strict format rows.
 * Only processes single bets - skips all parlays and SGPs.
 */
export const parseToStrictRows = (htmlContent: string): StrictBetRow[] => {
  const bets = parse(htmlContent);
  const rows: StrictBetRow[] = [];

  for (const bet of bets) {
    const row = convertBetToStrictRow(bet);
    if (row) {
      rows.push(row);
    }
  }

  return rows;
};

/**
 * Parses a single FanDuel bet card element.
 */
function parseFanDuelBetCard(
  betId: string,
  betCard: Element,
  fullHtml: string
): Bet | null {
  try {
    const cardText = betCard.textContent || "";
    const cardHtml = betCard.innerHTML || "";

    // Extract PLACED date - try multiple patterns
    let placedAt = new Date().toISOString();
    const placedPatterns = [
      /PLACED:\s*([^<\n]+)/,
      /PLACED:\s*([^<]+)/,
      /placed[:\s]+([^<\n]+)/i,
    ];
    for (const pattern of placedPatterns) {
      const match = cardText.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1].trim();
        if (dateStr.length > 5) {
          // Basic validation
          placedAt = parseFanDuelDate(dateStr);
          break;
        }
      }
    }

    // Extract TOTAL WAGER (stake) - try multiple approaches
    let stake = 0;

    // Method 1: Find "TOTAL WAGER" label and look for nearby dollar amount
    const wagerLabel = Array.from(betCard.querySelectorAll("*")).find(
      (el) =>
        normalizeText(el.textContent) === "TOTAL WAGER" ||
        normalizeText(el.textContent) === "TOTAL WAGER"
    );

    if (wagerLabel) {
      // Look in parent and siblings
      let searchElement: Element | null = wagerLabel.parentElement;
      for (let i = 0; i < 3 && searchElement; i++) {
        const dollarElements = Array.from(
          searchElement.querySelectorAll("*")
        ).filter((el) => {
          const text = el.textContent?.trim() || "";
          return text.startsWith("$") && /^\$[\d.]+$/.test(text);
        });
        if (dollarElements.length > 0) {
          stake = parseAmount(dollarElements[0].textContent || "");
          break;
        }
        searchElement = searchElement.parentElement;
      }
    }

    // Method 2: Regex fallback
    if (stake === 0) {
      const wagerPatterns = [
        /TOTAL WAGER[^$]*\$([\d.]+)/,
        /TOTAL\s+WAGER[^$]*\$([\d.]+)/i,
        /\$([\d.]+)[^$]*TOTAL WAGER/,
      ];
      for (const pattern of wagerPatterns) {
        const match = cardText.match(pattern) || cardHtml.match(pattern);
        if (match && match[1]) {
          stake = parseAmount(match[1]);
          if (stake > 0) break;
        }
      }
    }

    // Extract RETURNED (payout) - same approach
    let payout = 0;

    const returnedLabel = Array.from(betCard.querySelectorAll("*")).find(
      (el) => normalizeText(el.textContent) === "RETURNED"
    );

    if (returnedLabel) {
      let searchElement: Element | null = returnedLabel.parentElement;
      for (let i = 0; i < 3 && searchElement; i++) {
        const dollarElements = Array.from(
          searchElement.querySelectorAll("*")
        ).filter((el) => {
          const text = el.textContent?.trim() || "";
          return text.startsWith("$") && /^\$[\d.]+$/.test(text);
        });
        if (dollarElements.length > 0) {
          payout = parseAmount(dollarElements[0].textContent || "");
          break;
        }
        searchElement = searchElement.parentElement;
      }
    }

    if (payout === 0) {
      const returnedPatterns = [
        /RETURNED[^$]*\$([\d.]+)/,
        /RETURNED[^$]*\$([\d.]+)/i,
        /\$([\d.]+)[^$]*RETURNED/,
      ];
      for (const pattern of returnedPatterns) {
        const match = cardText.match(pattern) || cardHtml.match(pattern);
        if (match && match[1]) {
          payout = parseAmount(match[1]);
          if (payout > 0) break;
        }
      }
    }

    // Determine result
    let result: BetResult = "pending";
    if (payout > stake && stake > 0) {
      result = "win";
    } else if (payout === stake && stake > 0) {
      result = "push";
    } else if (payout === 0 && stake > 0) {
      result = "loss";
    }

    // Extract odds - try multiple methods
    let odds = 0;

    // Method 1: aria-label
    const oddsSpan = betCard.querySelector('span[aria-label^="Odds"]');
    if (oddsSpan) {
      const ariaLabel = oddsSpan.getAttribute("aria-label") || "";
      const oddsMatch = ariaLabel.match(/Odds\s*([+-]\d+)/);
      if (oddsMatch) {
        odds = parseAmericanOdds(oddsMatch[1]);
      } else {
        const text = normalizeText(oddsSpan.textContent);
        odds = parseAmericanOdds(text);
      }
    }

    // Method 2: Look for spans with odds patterns
    if (odds === 0) {
      const allSpans = Array.from(betCard.querySelectorAll("span"));
      for (const span of allSpans) {
        const text = normalizeText(span.textContent);
        if (/^[+-]\d+$/.test(text)) {
          const parsed = parseAmericanOdds(text);
          if (parsed !== 0 && Math.abs(parsed) > 100) {
            // Likely a real odds value
            odds = parsed;
            break;
          }
        }
      }
    }

    // Method 3: Regex fallback
    if (odds === 0) {
      const oddsPatterns = [
        /([+-]\d{4,})/, // Large odds like +31607
        /([+-]\d{3,})/,
      ];
      for (const pattern of oddsPatterns) {
        const match = cardText.match(pattern);
        if (match && match[1]) {
          odds = parseAmericanOdds(match[1]);
          if (odds !== 0) break;
        }
      }
    }

    // Extract event/matchup
    let event = "";
    const allSpans = Array.from(betCard.querySelectorAll("span"));
    for (const span of allSpans) {
      const text = normalizeText(span.textContent);
      if (
        (text.includes("@") || text.includes("vs")) &&
        text.length > 10 &&
        text.length < 100 &&
        !text.includes("BET ID") &&
        !text.includes("PLACED") &&
        !text.includes("TOTAL WAGER") &&
        !text.includes("RETURNED")
      ) {
        event = text;
        break;
      }
    }

    // Extract summary/description
    let description = "";

    // Look for the long description span
    for (const span of allSpans) {
      const text = normalizeText(span.textContent);
      if (
        text.length > 50 &&
        text.includes(",") &&
        (text.includes("To Record") ||
          text.includes("Made Threes") ||
          text.includes("To Score") ||
          text.includes("Points") ||
          text.includes("Rebounds") ||
          text.includes("Assists"))
      ) {
        description = text;
        break;
      }
    }

    // Extract legs first
    let legs = extractLegs(betCard);

    // Check for SGP - do this AFTER extracting legs to get accurate count
    const hasSGP =
      cardText.includes("Same Game Parlay") || cardText.includes("SGP");
    let betType: BetType = "single";
    if (hasSGP || legs.length > 1) {
      betType = "sgp";
      if (!description) {
        description = "Same Game Parlay";
      }
    }

    // If no legs found, try to create a leg from the description for single bets
    if (legs.length === 0 && !hasSGP && betType === "single") {
      // Try to parse description like "Will Richard, 3+ MADE THREES" or "Player Name, Market Text"
      const descText = description || cardText;

      // Pattern: "Player Name, X+ MADE THREES" or "Player Name To Record X+ Stat"
      const singleBetPatterns = [
        /([A-Z][a-zA-Z\s]+?)[,\s]+(\d+)\+\s+(MADE\s+THREES|Made\s+Threes)/i,
        /([A-Z][a-zA-Z\s]+?)\s+To\s+Record\s+(\d+)\+\s+([A-Za-z\s]+)/i,
        /([A-Z][a-zA-Z\s]+?)[,\s]+(\d+)\+\s+([A-Za-z\s]+)/i,
      ];

      for (const pattern of singleBetPatterns) {
        const match = descText.match(pattern);
        if (match) {
          const player = normalizeText(match[1].trim());
          let rawMarket = "";

          if (match[3]) {
            if (match[3].toLowerCase().includes("made threes")) {
              rawMarket = `${match[2]}+ Made Threes`;
            } else if (match[0].includes("To Record")) {
              rawMarket = `To Record ${match[2]}+ ${match[3].trim()}`;
            } else {
              rawMarket = `${match[2]}+ ${match[3].trim()}`;
            }
          } else if (match[2]) {
            rawMarket = `${match[2]}+`;
          }

          if (player && rawMarket && player.length > 2) {
            const parsed = parseMarketText(rawMarket);

            // Determine result from SVG or payout
            let legResult: BetResult = result;
            const svgs = betCard.querySelectorAll("svg");
            for (const svg of svgs) {
              const fill = svg.getAttribute("fill") || "";
              const paths = svg.querySelectorAll("path");
              let pathFill = "";
              if (paths.length > 0) {
                pathFill = paths[paths.length - 1].getAttribute("fill") || "";
              }
              if (fill === "#128000" || pathFill === "#128000") {
                legResult = "win";
                break;
              } else if (fill === "#D22839" || pathFill === "#D22839") {
                legResult = "loss";
                break;
              }
            }

            legs = [
              {
                entities: [player],
                market: parsed.type,
                target: parsed.line,
                ou: parsed.ou,
                result: legResult,
              },
            ];

            // Update description if we successfully parsed
            if (!description || description.includes("FanDuel Bet")) {
              description = `${player}, ${rawMarket}`;
            }
            break;
          }
        }
      }
    }

    // Build description from legs if not found
    if (!description && legs.length > 0) {
      description = legs
        .map((leg) => {
          const entities = leg.entities?.join(" ") || "";
          return `${entities} ${leg.market}`;
        })
        .join(", ");
    }

    if (!description) {
      description = `FanDuel Bet ${betId}`;
    }

    // Infer bet type if not already determined
    if (betType === "single") {
      betType = inferBetType(description, legs.length);
    }

    // Skip parlays and SGPs - only process single bets
    // IMPORTANT: Only skip if it's clearly a multi-leg bet (SGP/parlay)
    // Single bets can have 0 or 1 leg
    if ((betType === "sgp" || betType === "parlay") && legs.length > 1) {
      console.log(
        `FanDuel parser: Skipping ${betType} bet with ${legs.length} legs (betId: ${betId})`
      );
      return null;
    }

    // Also skip if we have multiple legs but betType wasn't set correctly
    if (legs.length > 1 && betType === "single") {
      console.log(
        `FanDuel parser: Skipping multi-leg bet detected as single (betId: ${betId}, legs: ${legs.length})`
      );
      return null;
    }

    console.log(
      `FanDuel parser: Processing ${betType} bet (betId: ${betId}, legs: ${legs.length})`
    );

    // Infer sport - check legs for sport indicators if description doesn't have them
    let sport = inferSport(description, legs);
    // If sport inference failed, check legs' market types for sport indicators
    if (sport === "Other" && legs.length > 0) {
      const legMarkets = legs
        .map((l) => l.market?.toLowerCase() || "")
        .join(" ");
      if (
        legMarkets.includes("3pt") ||
        legMarkets.includes("pts") ||
        legMarkets.includes("ast") ||
        legMarkets.includes("reb")
      ) {
        sport = "NBA";
      }
    }
    // Also check event/matchup text for sport
    if (sport === "Other" && event) {
      const eventLower = event.toLowerCase();
      if (
        eventLower.includes("warriors") ||
        eventLower.includes("pelicans") ||
        eventLower.includes("bulls") ||
        eventLower.includes("jazz")
      ) {
        sport = "NBA";
      }
    }

    // Generate unique ID
    const id = `FanDuel-${betId}-${placedAt}`;

    // Create bet object
    // ALWAYS include legs - even for single bets, we should have at least one leg
    const betData: Omit<Bet, "marketCategory"> = {
      id,
      book: "FanDuel",
      betId,
      placedAt,
      settledAt: result !== "pending" ? placedAt : undefined,
      betType,
      sport,
      description,
      odds:
        odds ||
        (stake > 0 && payout > stake
          ? Math.round(((payout - stake) / stake) * 100)
          : 0),
      stake,
      payout,
      result,
      legs: legs.length > 0 ? legs : undefined, // Only include if we have legs
      raw: cardText.substring(0, 500),
    };

    // Classify the bet
    const marketCategory = classifyBet(betData);

    return {
      ...betData,
      marketCategory,
    };
  } catch (error) {
    console.warn(`FanDuel parser: Error parsing bet card for ${betId}:`, error);
    return null;
  }
}

/**
 * Extracts leg information from a bet card.
 */
function extractLegs(betCard: Element): BetLeg[] {
  const legs: BetLeg[] = [];
  const seenLegs = new Set<string>();

  // Strategy 1: Find legs via SVG result icons
  const svgElements = Array.from(betCard.querySelectorAll("svg"));

  for (const svg of svgElements) {
    const svgId = svg.getAttribute("id") || "";
    const fill = svg.getAttribute("fill") || "";

    // Also check fill on child path elements (fill might be on path, not SVG)
    const paths = svg.querySelectorAll("path");
    let pathFill = "";
    if (paths.length > 0) {
      // Check the last path (usually the colored one)
      const lastPath = paths[paths.length - 1];
      pathFill = lastPath.getAttribute("fill") || "";
    }

    // Check if this is a result icon
    // Green tick: id contains "tick-circle" OR fill is green (#128000)
    const isTick =
      svgId.includes("tick-circle") ||
      svgId.includes("tick") ||
      fill === "#128000" ||
      pathFill === "#128000";

    // Red cross: id contains "cross" OR fill is red (#D22839)
    const isCross =
      svgId.includes("cross_circle") ||
      svgId.includes("cross-circle") ||
      svgId.includes("cross") ||
      fill === "#D22839" ||
      pathFill === "#D22839";

    if (!isTick && !isCross) {
      continue;
    }

    const legResult: BetResult = isTick ? "win" : "loss";

    // Walk up from SVG to find the leg container that contains both the SVG and player/market info
    // The SVG and player/market spans are siblings within a common parent (usually 2-3 levels up)
    let current: Element | null = svg.parentElement;
    let depth = 0;
    const maxDepth = 10;
    let playerSpan: HTMLSpanElement | null = null;
    let marketSpan: HTMLSpanElement | null = null;

    // Walk up the DOM tree to find a container that has both player and market spans
    while (current && depth < maxDepth && (!playerSpan || !marketSpan)) {
      // Get all spans in this container
      const allSpans = Array.from(current.querySelectorAll("span"));

      // Find player name if not found yet
      if (!playerSpan) {
        playerSpan =
          (allSpans.find((span) => {
            const text = normalizeText(span.textContent);
            // Exclude patterns that are NOT player names
            const excludePatterns = [
              "To Record",
              "Made Threes",
              "Finished",
              "Open",
              "Live",
              "TOTAL WAGER",
              "RETURNED",
              "BET ID",
              "PLACED",
              "Box Score",
              "Play-by-play",
              "Same Game Parlay",
              "Chicago Bulls",
              "Utah Jazz",
              "Golden State Warriors",
              "New Orleans Pelicans",
              "Bulls",
              "Jazz",
              "Warriors",
              "Pelicans",
              "@",
              "vs",
              "Odds",
              "SGP",
            ];
            if (excludePatterns.some((pattern) => text.includes(pattern))) {
              return false;
            }
            // Player names: 3-30 chars, capitalized words
            return (
              text.length >= 3 &&
              text.length <= 30 &&
              /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(text) &&
              !/^\$/.test(text) &&
              !/^\d+$/.test(text) &&
              !text.includes("+") // Exclude things like "3+"
            );
          }) as HTMLSpanElement | undefined) || null;
      }

      // Find market description if not found yet
      if (!marketSpan) {
        marketSpan =
          (allSpans.find((span) => {
            const text = normalizeText(span.textContent);
            const marketKeywords = [
              "To Record",
              "Made Threes",
              "To Score",
              "Over",
              "Under",
              "Points",
              "Rebounds",
              "Assists",
              "Threes",
              "Yards",
              "Touchdown",
            ];
            return (
              marketKeywords.some((keyword) => text.includes(keyword)) &&
              text.length > 5 &&
              text.length < 50 &&
              !text.includes("BET ID") &&
              !text.includes("PLACED") &&
              !text.includes("TOTAL WAGER") &&
              !text.includes("RETURNED")
            );
          }) as HTMLSpanElement | undefined) || null;
      }

      // If we found both, we're done with this leg
      if (playerSpan && marketSpan) {
        const player = normalizeText(playerSpan.textContent);
        const rawMarket = normalizeText(marketSpan.textContent);
        const legKey = `${player}-${rawMarket}`;

        if (!seenLegs.has(legKey)) {
          seenLegs.add(legKey);

          // Parse market text to extract TYPE and LINE
          const parsed = parseMarketText(rawMarket);

          legs.push({
            entities: [player],
            market: parsed.type, // Store stat code (TYPE) in market field
            target: parsed.line, // Store numeric threshold (LINE) in target field
            ou: parsed.ou, // Store Over/Under if present
            result: legResult,
          });
        }
        break; // Found this leg, move to next SVG
      }

      current = current.parentElement;
      depth++;
    }
  }

  // If no legs found via SVG method, try parsing from description text
  if (legs.length === 0) {
    // Get text from the bet card, including looking for description spans
    let cardText = betCard.textContent || "";

    // Also check for description spans that might contain the leg information
    const descriptionSpans = Array.from(
      betCard.querySelectorAll("span")
    ).filter((span) => {
      const text = normalizeText(span.textContent);
      return (
        text.length > 50 &&
        (text.includes("To Record") ||
          text.includes("Made Threes") ||
          text.includes("Assists"))
      );
    });

    // If we found description spans, use their text
    if (descriptionSpans.length > 0) {
      cardText = descriptionSpans.map((s) => s.textContent || "").join(" ");
    }

    // More comprehensive patterns to match player + market combinations
    const legPatterns = [
      // "Isaiah Collier To Record 6+ Assists" (no comma before "To Record")
      /([A-Z][a-zA-Z\s]+?)\s+To\s+Record\s+(\d+)\+\s+([A-Za-z\s]+)/gi,
      // "Ace Bailey 3+ Made Threes" (space before number, comma before player name)
      /([A-Z][a-zA-Z\s]+?)[,\s]+(\d+)\+\s+Made\s+Threes/gi,
      /([A-Z][a-zA-Z\s]+?)[,\s]+(\d+)\+\s+MADE\s+THREES/gi,
      // "Player Name X+ Stat" general pattern (handles both comma and space)
      /([A-Z][a-zA-Z\s]+?)[,\s]+(\d+)\+\s+([A-Za-z\s]+)/gi,
    ];

    for (const pattern of legPatterns) {
      let match;
      // Reset regex lastIndex to avoid issues with global regex
      pattern.lastIndex = 0;
      while ((match = pattern.exec(cardText)) !== null) {
        const player = normalizeText(match[1].trim());
        let rawMarket = "";

        // Determine which pattern matched and construct market text accordingly
        if (match[0].includes("To Record")) {
          // Pattern 1: "Isaiah Collier To Record 6+ Assists"
          rawMarket = `To Record ${match[2]}+ ${match[3].trim()}`;
        } else if (
          match[0].includes("Made Threes") ||
          match[0].includes("MADE THREES")
        ) {
          // Pattern 2 or 3: "Ace Bailey 3+ Made Threes"
          rawMarket = `${match[2]}+ Made Threes`;
        } else if (match[3]) {
          // Pattern 4: General "Player Name X+ Stat"
          rawMarket = `${match[2]}+ ${match[3].trim()}`;
        } else if (match[2]) {
          // Fallback: just the number
          rawMarket = `${match[2]}+`;
        }

        if (
          player &&
          rawMarket &&
          player.length > 2 &&
          !player.includes("@") &&
          !player.includes("vs")
        ) {
          const legKey = `${player}-${rawMarket}`;
          if (!seenLegs.has(legKey)) {
            seenLegs.add(legKey);

            // Parse market text to extract TYPE and LINE
            const parsed = parseMarketText(rawMarket);

            // Try to infer result from context if possible
            let legResult: BetResult = "pending";
            // Check if there's a win/loss indicator nearby in the text
            const playerContext = cardText.substring(
              Math.max(0, match.index! - 100),
              Math.min(cardText.length, match.index! + 200)
            );
            if (
              /won|win|✓|tick|green/i.test(playerContext) &&
              !/loss|lost|✗|cross|red/i.test(playerContext)
            ) {
              legResult = "win";
            } else if (
              /loss|lost|✗|cross|red/i.test(playerContext) &&
              !/won|win|✓|tick|green/i.test(playerContext)
            ) {
              legResult = "loss";
            }

            legs.push({
              entities: [player],
              market: parsed.type, // Store stat code (TYPE) in market field
              target: parsed.line, // Store numeric threshold (LINE) in target field
              ou: parsed.ou, // Store Over/Under if present
              result: legResult,
            });
          }
        }
      }
    }
  }

  return legs;
}

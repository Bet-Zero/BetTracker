/**
 * FanDuel Parser - Stage A: Raw Extraction Only
 *
 * This parser ONLY extracts raw data from HTML.
 * No interpretation, no mapping, no logic.
 * All logic happens in normalizeBet.ts
 */

import { FinalRow } from "../../types";
import { RawBet } from "../rawBetTypes";
import { normalizeBet } from "../normalizeBet";
import { normalizeText } from "../utils";

/**
 * Parses raw HTML content from a FanDuel settled bets page.
 * Extracts RawBet objects and normalizes them to FinalRow[].
 */
export const parse = (htmlContent: string): FinalRow[] => {
  console.log("Starting FanDuel parse...");
  const rows: FinalRow[] = [];

  if (!htmlContent || !htmlContent.trim()) {
    console.warn("FanDuel parser: Empty HTML content provided.");
    return rows;
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

        // Find the bet card by searching ALL <li> elements for one that contains this BET ID
        // Strategy: Search all <li> elements, find ones with this BET ID, pick the one with market content
        let betCard: Element | null = null;

        // Search ALL <li> elements in the document
        // Structure: Each bet has TWO <li> elements:
        //   1. Header <li>: Contains player name, market text, odds, game info
        //   2. Footer <li>: Contains TOTAL WAGER, RETURNED, BET ID, PLACED
        const allLis = Array.from(doc.querySelectorAll("li"));

        for (const li of allLis) {
          const text = li.textContent || "";
          const hasBetId = text.includes(`BET ID: ${betId}`);

          if (!hasBetId) continue;

          // Check for market content indicators
          const hasOdds = li.querySelector('span[aria-label^="Odds"]') !== null;
          const hasMarketText =
            text.includes("To Record") ||
            text.includes("Made Threes") ||
            text.includes("MADE THREES") ||
            text.match(/\d+\+\s+(Made|MADE|Points|Rebounds|Assists)/i) ||
            /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text);
          const hasGame =
            (text.includes("@") || text.includes("vs")) && text.length > 50;

          // If this <li> has the BET ID AND has substantial content (odds, market text, or game), use it
          if ((hasOdds || hasMarketText || hasGame) && text.length > 200) {
            betCard = li;
            console.log(
              `FanDuel parser: Found full bet card for ${betId} with ${text.length} chars`
            );
            break;
          }

          // If this <li> has BET ID but is small (footer), check the PREVIOUS sibling (header)
          if (text.length < 200 && li.previousElementSibling) {
            const prevSibling = li.previousElementSibling;
            const prevText = prevSibling.textContent || "";
            const prevHasOdds = prevSibling.querySelector('span[aria-label^="Odds"]') !== null;
            const prevHasMarketText =
              prevText.includes("To Record") ||
              prevText.includes("Made Threes") ||
              prevText.includes("MADE THREES") ||
              prevText.match(/\d+\+\s+(Made|MADE|Points|Rebounds|Assists)/i);

            // If previous sibling has market content, use the PREVIOUS sibling (header)
            if (prevHasOdds || prevHasMarketText) {
              betCard = prevSibling;
              console.log(
                `FanDuel parser: Found header <li> (previous sibling) for ${betId} with ${prevText.length} chars`
              );
              break;
            }
          }
        }

        // If we didn't find a good one, use the first <li> that contains the BET ID (fallback)
        if (!betCard) {
          for (const li of allLis) {
            const text = li.textContent || "";
            if (text.includes(`BET ID: ${betId}`)) {
              betCard = li;
              console.warn(
                `FanDuel parser: Using fallback <li> for ${betId} (only ${text.length} chars - may be collapsed)`
              );
              break;
            }
          }
        }

        // If still no <li>, fallback to finding element with bet card markers
        if (!betCard) {
          let fallbackCurrent: Node | null = betIdNode.parentElement;
          while (
            fallbackCurrent &&
            fallbackCurrent.nodeType === Node.ELEMENT_NODE
          ) {
            const element = fallbackCurrent as Element;
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

            fallbackCurrent = fallbackCurrent.parentElement;
          }
        }

        if (!betCard) {
          console.warn(
            `FanDuel parser: Could not find bet card for BET ID ${betId}`
          );
          continue;
        }

        // Use betCard directly - if it's an <li>, it should have everything
        // The extractRawBet function will handle finding the <li> if needed
        let searchContainer = betCard;

        // Debug: Log what container we're using and check for siblings/parents
        let containerText = searchContainer.textContent || "";
        console.log(`FanDuel parser: Using container for bet ${betId}:`, {
          tagName: searchContainer.tagName,
          className: searchContainer.className,
          textLength: containerText.length,
          textPreview: containerText.substring(0, 150),
          hasOdds:
            searchContainer.querySelector('span[aria-label^="Odds"]') !== null,
          parentTag: searchContainer.parentElement?.tagName,
          siblingCount: searchContainer.parentElement?.children.length || 0,
        });

        // If the container is too small, try to find a sibling <li> with market content
        // The bet cards might be split: one <li> for header, one for footer
        if (containerText.length < 200 && searchContainer.parentElement) {
          const parent = searchContainer.parentElement;
          
          // If parent is a <ul>, search its children for an <li> with market content
          if (parent.tagName === 'UL') {
            const siblingLis = Array.from(parent.querySelectorAll('li'));
            for (const siblingLi of siblingLis) {
              const siblingText = siblingLi.textContent || "";
              const hasBetId = siblingText.includes(`BET ID: ${betId}`);
              const hasOdds = siblingLi.querySelector('span[aria-label^="Odds"]') !== null;
              const hasMarketText = 
                siblingText.includes("To Record") ||
                siblingText.includes("Made Threes") ||
                siblingText.includes("MADE THREES") ||
                siblingText.match(/\d+\+\s+(Made|MADE|Points|Rebounds|Assists)/i);
              
              // If this sibling has the BET ID AND has market content, use it
              if (hasBetId && (hasOdds || hasMarketText) && siblingText.length > 200) {
                console.log(`FanDuel parser: Found sibling <li> with market content for ${betId} (${siblingText.length} chars)`);
                searchContainer = siblingLi;
                containerText = siblingText;
                break;
              }
            }
          }
          
          // If still small and parent is not UL, try parent
          if (containerText.length < 200 && parent.tagName !== 'UL') {
            let currentParent: Element | null = parent;
            for (let i = 0; i < 2 && currentParent; i++) {
              const parentText = currentParent.textContent || "";
              if (
                parentText.length > containerText.length &&
                parentText.includes(`BET ID: ${betId}`) &&
                currentParent.tagName !== 'UL' // Don't use UL - it contains all bets
              ) {
                console.log(
                  `FanDuel parser: Found larger parent container for ${betId} (${parentText.length} chars, tag: ${currentParent.tagName})`
                );
                searchContainer = currentParent;
                containerText = parentText;
                break;
              }
              currentParent = currentParent.parentElement;
            }
          }
        }

        // Extract RawBet from the bet card
        const rawBet = extractRawBet(betId, searchContainer, htmlText);
        if (rawBet) {
          console.log(`FanDuel parser: Extracted raw bet ${betId}:`, {
            rawMarketText: rawBet.rawMarketText?.substring(0, 50) || "(empty)",
            playerName: rawBet.playerName || "(none)",
            odds: rawBet.odds || "(none)",
            wager: rawBet.wager || "(none)",
            returned: rawBet.returned || "(none)",
            isMultiLeg: rawBet.isMultiLeg,
          });

          // Normalize the raw bet
          const finalRow = normalizeBet(rawBet);
          if (finalRow) {
            rows.push(finalRow);
            console.log(
              `FanDuel parser: Successfully parsed bet ${betId} -> ${finalRow.Category}/${finalRow.Type}`
            );
          } else {
            console.log(
              `FanDuel parser: Normalizer returned null for bet ${betId} (likely multi-leg or invalid category)`
            );
          }
        } else {
          console.warn(`FanDuel parser: Failed to extract raw bet ${betId}`);
        }
      } catch (error) {
        console.warn(`FanDuel parser: Error parsing bet:`, error);
      }
    }

    console.log(`FanDuel parser: Successfully parsed ${rows.length} bets.`);
  } catch (error) {
    console.error("FanDuel parser: Error parsing HTML:", error);
  }

  return rows;
};

/**
 * Extracts raw bet data from a FanDuel bet card element.
 * NO interpretation, NO mapping, just raw text extraction.
 */
function extractRawBet(
  betId: string,
  betCard: Element,
  fullHtml: string
): RawBet | null {
  try {
    // Always try to find the <li> element that contains the full bet card
    // The betCard parameter might be a footer div or UL, so we need to find the right <li>
    let searchElement: Element = betCard;

    // If betCard is already an <li>, use it
    if (betCard.tagName === "LI") {
      searchElement = betCard;
      
      // Check if this <li> is the header (has odds/market) - footer info might be in next sibling
      const hasOdds = betCard.querySelector('span[aria-label^="Odds"]') !== null;
      const hasMarketText = (betCard.textContent || "").includes("MADE THREES") || 
                            (betCard.textContent || "").includes("To Record");
      
      // If this is the header <li>, we'll search it for market content
      // The footer info (wager, returned) will be extracted from this <li> or next sibling if needed
      if (hasOdds || hasMarketText) {
        console.log(`FanDuel parser: Using header <li> for extraction (has odds: ${hasOdds}, has market: ${hasMarketText})`);
      }
    } else if (betCard.tagName === "UL") {
      // If betCard is a <ul>, search for the <li> that contains this BET ID and has market content
      const lis = Array.from(betCard.querySelectorAll("li"));
      for (const li of lis) {
        const text = li.textContent || "";
        const hasBetId = text.includes(`BET ID: ${betId}`);
        const hasOdds = li.querySelector('span[aria-label^="Odds"]') !== null;
        const hasMarketText = 
          text.includes("To Record") ||
          text.includes("Made Threes") ||
          text.includes("MADE THREES") ||
          text.match(/\d+\+\s+(Made|MADE|Points|Rebounds|Assists)/i);
        
        if (hasBetId && (hasOdds || hasMarketText) && text.length > 200) {
          searchElement = li;
          console.log(`FanDuel parser: Found <li> within <ul> for ${betId} (${text.length} chars)`);
          break;
        }
      }
      // If no good <li> found, use the first one with this BET ID
      if (searchElement === betCard) {
        for (const li of lis) {
          const text = li.textContent || "";
          if (text.includes(`BET ID: ${betId}`)) {
            searchElement = li;
            break;
          }
        }
      }
    } else {
      // Walk up the DOM tree to find the <li> element
      let current: Element | null = betCard;
      let foundLi = false;
      while (current && current.parentElement) {
        if (current.tagName === "LI") {
          searchElement = current;
          foundLi = true;
          break;
        }
        current = current.parentElement;
      }

      // If we didn't find an <li>, use the original betCard but log a warning
      if (!foundLi) {
        console.warn(
          `FanDuel parser: Could not find <li> parent for bet ${betId}, using provided element (tag: ${betCard.tagName})`
        );
      }
    }

    const cardText = searchElement.textContent || "";
    const cardHtml = searchElement.innerHTML || "";

    // Debug: Log what we're searching in
    if (cardText.length < 200) {
      console.warn(
        `FanDuel parser: Warning - cardText is very short (${cardText.length} chars) for bet ${betId}. May not have found full bet card.`
      );
    }

    // Find the footer element that contains TOTAL WAGER, RETURNED, BET ID, and PLACED
    // The footer is typically a <div> within the same <li> parent
    let footerElement: Element | null = null;
    
    // Strategy 1: Search within the <li> for a <div> containing "TOTAL WAGER"
    if (searchElement.tagName === "LI") {
      const footerDivs = Array.from(searchElement.querySelectorAll("div"));
      for (const div of footerDivs) {
        const divText = div.textContent || "";
        if (divText.includes("TOTAL WAGER") && divText.includes("RETURNED")) {
          footerElement = div;
          console.log(`FanDuel parser: Found footer <div> for bet ${betId}`);
          break;
        }
      }
    }
    
    // Strategy 2: If not found, search parent containers
    if (!footerElement && searchElement.parentElement) {
      let current: Element | null = searchElement.parentElement;
      for (let i = 0; i < 3 && current; i++) {
        const footerDivs = Array.from(current.querySelectorAll("div"));
        for (const div of footerDivs) {
          const divText = div.textContent || "";
          if (divText.includes("TOTAL WAGER") && divText.includes("RETURNED") && divText.includes(`BET ID: ${betId}`)) {
            footerElement = div;
            console.log(`FanDuel parser: Found footer <div> in parent for bet ${betId}`);
            break;
          }
        }
        if (footerElement) break;
        current = current.parentElement;
      }
    }
    
    // Fallback: Use searchElement if footer not found separately
    const elementToSearchForWager = footerElement || searchElement;

    // Extract PLACED date - raw string
    let placedAt = "";
    const placedPatterns = [
      /PLACED:\s*([^<\n]+)/,
      /PLACED:\s*([^<]+)/,
      /placed[:\s]+([^<\n]+)/i,
    ];
    for (const pattern of placedPatterns) {
      const match = cardText.match(pattern);
      if (match && match[1]) {
        placedAt = match[1].trim();
        break;
      }
    }

    // Extract TOTAL WAGER - raw string (from footer if available)
    let wager = "";
    const wagerLabel = Array.from(elementToSearchForWager.querySelectorAll("*")).find(
      (el) =>
        normalizeText(el.textContent) === "TOTAL WAGER" ||
        normalizeText(el.textContent) === "TOTAL WAGER"
    );

    if (wagerLabel) {
      let wagerSearchElement: Element | null = wagerLabel.parentElement;
      for (let i = 0; i < 3 && wagerSearchElement; i++) {
        const dollarElements = Array.from(
          wagerSearchElement.querySelectorAll("*")
        ).filter((el) => {
          const text = el.textContent?.trim() || "";
          return text.startsWith("$") && /^\$[\d.]+$/.test(text);
        });
        if (dollarElements.length > 0) {
          wager = (dollarElements[0].textContent || "").trim();
          break;
        }
        wagerSearchElement = wagerSearchElement.parentElement;
      }
    }

    // Regex fallback for wager
    if (!wager) {
      const footerText = footerElement ? (footerElement.textContent || "") : "";
      const footerHtml = footerElement ? (footerElement.innerHTML || "") : "";
      const wagerPatterns = [
        /TOTAL WAGER[^$]*\$([\d.]+)/,
        /TOTAL\s+WAGER[^$]*\$([\d.]+)/i,
        /\$([\d.]+)[^$]*TOTAL WAGER/,
      ];
      for (const pattern of wagerPatterns) {
        const match = footerText.match(pattern) || footerHtml.match(pattern) || 
                      cardText.match(pattern) || cardHtml.match(pattern);
        if (match && match[1]) {
          wager = `$${match[1]}`;
          break;
        }
      }
    }

    // Extract RETURNED - raw string (from footer if available)
    let returned = "";
    const elementToSearchForReturned = footerElement || searchElement;
    const returnedLabel = Array.from(elementToSearchForReturned.querySelectorAll("*")).find(
      (el) => normalizeText(el.textContent) === "RETURNED"
    );

    if (returnedLabel) {
      let returnedSearchElement: Element | null = returnedLabel.parentElement;
      for (let i = 0; i < 3 && returnedSearchElement; i++) {
        const dollarElements = Array.from(
          returnedSearchElement.querySelectorAll("*")
        ).filter((el) => {
          const text = el.textContent?.trim() || "";
          return text.startsWith("$") && /^\$[\d.]+$/.test(text);
        });
        if (dollarElements.length > 0) {
          returned = (dollarElements[0].textContent || "").trim();
          break;
        }
        returnedSearchElement = returnedSearchElement.parentElement;
      }
    }

    // Regex fallback for returned
    if (!returned) {
      const footerText = footerElement ? (footerElement.textContent || "") : "";
      const footerHtml = footerElement ? (footerElement.innerHTML || "") : "";
      const returnedPatterns = [
        /RETURNED[^$]*\$([\d.]+)/,
        /RETURNED[^$]*\$([\d.]+)/i,
        /\$([\d.]+)[^$]*RETURNED/,
      ];
      for (const pattern of returnedPatterns) {
        const match = footerText.match(pattern) || footerHtml.match(pattern) || 
                      cardText.match(pattern) || cardHtml.match(pattern);
        if (match && match[1]) {
          returned = `$${match[1]}`;
          break;
        }
      }
    }

    // Extract odds - raw string
    let odds = "";
    const oddsSpan = searchElement.querySelector('span[aria-label^="Odds"]');
    if (oddsSpan) {
      const ariaLabel = oddsSpan.getAttribute("aria-label") || "";
      const oddsMatch = ariaLabel.match(/Odds\s*([+-]\d+)/);
      if (oddsMatch) {
        odds = oddsMatch[1];
      } else {
        const text = normalizeText(oddsSpan.textContent);
        if (/^[+-]\d+$/.test(text)) {
          odds = text;
        }
      }
    }

    // Fallback: look for spans with odds patterns
    if (!odds) {
      const allSpans = Array.from(betCard.querySelectorAll("span"));
      for (const span of allSpans) {
        const text = normalizeText(span.textContent);
        if (/^[+-]\d+$/.test(text)) {
          odds = text;
          break;
        }
      }
    }

    // Extract event/matchup
    let game = "";
    const allSpans = Array.from(searchElement.querySelectorAll("span"));
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
        game = text;
        break;
      }
    }

    // Extract raw market text and player name
    let rawMarketText = "";
    let playerName = "";
    const teamNames: string[] = [];

    // Strategy 1: Look for description spans with market text
    // First, try to find the combined "Player Name, Market" span or "Player Name Market" span
    for (const span of allSpans) {
      const text = normalizeText(span.textContent);
      // Look for spans that contain market keywords
      if (
        text.length > 10 &&
        (text.includes("To Record") ||
          text.includes("Made Threes") ||
          text.includes("MADE THREES") ||
          text.includes("To Score") ||
          text.includes("Points") ||
          text.includes("Rebounds") ||
          text.includes("Assists") ||
          text.match(/\d+\s*\+/) ||
          text.match(/\+\s*\d+/))
      ) {
        rawMarketText = text;
        break;
      }
    }
    
    // Strategy 2: If not found in spans, search the entire card text for market patterns
    if (!rawMarketText) {
      const cardTextLower = cardText.toLowerCase();
      // Look for patterns like "3+ MADE THREES" or "X+ Made Threes" in the card text
      const marketPatterns = [
        /(\d+\+\s*MADE\s*THREES)/i,
        /(\d+\+\s*Made\s*Threes)/i,
        /(\d+\+\s*THREES)/i,
        /(\d+\+\s*Points)/i,
        /(\d+\+\s*Rebounds)/i,
        /(\d+\+\s*Assists)/i,
        /(To\s+Record\s+\d+\+)/i,
      ];
      
      for (const pattern of marketPatterns) {
        const match = cardText.match(pattern);
        if (match && match[1]) {
          rawMarketText = match[1].trim();
          break;
        }
      }
    }

    // Extract player name from market text if it's combined
    // Patterns: "Will Richard, 3+ MADE THREES" or "Will Richard 3+ MADE THREES" or "Will Richard+3603+ MADE THREES"
    if (rawMarketText) {
      // Try to extract player name from the beginning (comma-separated)
      const commaMatch = rawMarketText.match(/^([A-Z][a-zA-Z\s]+?),\s*(.+)/);
      if (commaMatch && commaMatch[1] && commaMatch[2]) {
        playerName = commaMatch[1].trim();
        rawMarketText = commaMatch[2].trim();
      } else {
        // Try "Player Name To Record X+ Stat" pattern
        const toRecordMatch = rawMarketText.match(
          /^([A-Z][a-zA-Z\s]+?)\s+To\s+Record\s+(.+)/i
        );
        if (toRecordMatch && toRecordMatch[1] && toRecordMatch[2]) {
          playerName = toRecordMatch[1].trim();
          rawMarketText = `To Record ${toRecordMatch[2].trim()}`;
        } else {
          // Try pattern where player name is concatenated: "Will Richard3+ MADE THREES" or "Will Richard+3603+ MADE THREES"
          // Extract just the market part (X+ MADE THREES, etc.)
          const marketOnlyMatch = rawMarketText.match(/(\d+\+\s*(?:MADE\s*THREES|Made\s*Threes|THREES|Points|Rebounds|Assists))/i);
          if (marketOnlyMatch && marketOnlyMatch[1]) {
            rawMarketText = marketOnlyMatch[1].trim();
          }
        }
      }
    }
    
    // If we still don't have rawMarketText but we have playerName, try extracting from card text
    if (!rawMarketText && playerName) {
      // Look for market text near the player name in the card text
      const playerNameEscaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const combinedPattern = new RegExp(`${playerNameEscaped}[^\\w]*?(\\d+\\+\\s*(?:MADE\\s*THREES|Made\\s*Threes|THREES|Points|Rebounds|Assists))`, 'i');
      const match = cardText.match(combinedPattern);
      if (match && match[1]) {
        rawMarketText = match[1].trim();
      }
    }

    // Also look for player name in separate spans
    if (!playerName) {
      for (const span of allSpans) {
        const text = normalizeText(span.textContent);
        // Player names: 3-30 chars, capitalized words, not common labels
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
          "@",
          "vs",
          "Odds",
          "SGP",
        ];
        if (excludePatterns.some((pattern) => text.includes(pattern))) {
          continue;
        }
        if (
          text.length >= 3 &&
          text.length <= 30 &&
          /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(text) &&
          !/^\$/.test(text) &&
          !/^\d+$/.test(text) &&
          !text.includes("+")
        ) {
          playerName = text;
          break;
        }
      }
    }

    // Check for multi-leg (SGP/parlay)
    const isMultiLeg =
      cardText.includes("Same Game Parlay") ||
      cardText.includes("SGP") ||
      // Count SVG result icons - if more than 1, it's multi-leg
      searchElement.querySelectorAll('svg[id*="tick"], svg[id*="cross"]')
        .length > 1;

    // Check for live bet
    const isLive =
      cardText.toLowerCase().includes("live") ||
      cardText.toLowerCase().includes("in-game");

    // Check for tail
    const isTail = false; // TODO: detect tailing if needed

    // Extract event date/time if available
    let eventDateTime = "";
    // Try to extract from game text or other context
    if (game) {
      // Could parse date from game context if available
    }

    // Debug: Log what we found
    if (!rawMarketText && !playerName && !game) {
      console.warn(`FanDuel parser: Insufficient data for bet ${betId}:`, {
        rawMarketText: rawMarketText || "(empty)",
        playerName: playerName || "(empty)",
        game: game || "(empty)",
        cardTextLength: cardText.length,
        cardTextPreview: cardText.substring(0, 200),
      });
      return null;
    }

    return {
      site: "FanDuel",
      rawMarketText: rawMarketText || "",
      playerName: playerName || undefined,
      teamNames: teamNames.length > 0 ? teamNames : undefined,
      game: game || undefined,
      eventDateTime: eventDateTime || undefined,
      placedAt: placedAt || undefined,
      odds: odds || undefined,
      wager: wager || undefined,
      returned: returned || undefined,
      betId: betId,
      isMultiLeg,
      isLive,
      isTail,
    };
  } catch (error) {
    console.warn(
      `FanDuel parser: Error extracting raw bet for ${betId}:`,
      error
    );
    return null;
  }
}

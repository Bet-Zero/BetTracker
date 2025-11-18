/**
 * FanDuel Parser V2 - Simplified Architecture
 * 
 * This parser directly converts HTML to Bet objects, eliminating unnecessary intermediate steps.
 * Flow: HTML → Bet (single transformation)
 */

import { Bet, BetResult, BetType, BetLeg } from '../../types';

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

    console.log(`FanDuel parser: Found ${betIdMatches.length} BET ID patterns.`);

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

    console.log(`FanDuel parser: Found ${betIdTextNodes.length} BET ID text nodes.`);

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
          console.warn(`FanDuel parser: Could not find bet card for BET ID ${betId}`);
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
 */
function extractBet(betId: string, betCard: Element): Bet | null {
  try {
    const cardText = betCard.textContent || "";
    
    // Extract odds
    const oddsSpan = betCard.querySelector('span[aria-label^="Odds"]');
    let odds = 0;
    if (oddsSpan) {
      const ariaLabel = oddsSpan.getAttribute("aria-label") || "";
      const oddsMatch = ariaLabel.match(/Odds\s*([+-]\d+)/);
      if (oddsMatch) {
        odds = parseInt(oddsMatch[1], 10);
      }
    }
    
    // Extract wager and returned amounts
    // Pattern: $X.XX appears BEFORE the label "TOTAL WAGER"
    const wagerMatch = cardText.match(/\$([\d.]+)[^\$]*TOTAL WAGER/);
    const returnedMatch = cardText.match(/\$([\d.]+)[^\$]*RETURNED/);
    const stake = wagerMatch ? parseFloat(wagerMatch[1]) : 0;
    const payout = returnedMatch ? parseFloat(returnedMatch[1]) : 0;
    
    // Determine result
    let result: BetResult = 'pending';
    if (payout === 0 && stake > 0) {
      result = 'loss';
    } else if (payout > stake) {
      result = 'win';
    } else if (payout === stake && stake > 0) {
      result = 'push';
    }
    
    // Extract placed date
    const placedMatch = cardText.match(/PLACED:\s*([^<\n]+)/);
    const placedAt = placedMatch ? parseDateToISO(placedMatch[1].trim()) : new Date().toISOString();
    const settledAt = result !== 'pending' ? placedAt : undefined;
    
    // Check if it's a multi-leg bet (SGP/parlay)
    const isSGP = cardText.includes("Same Game Parlay") || cardText.includes("SGP");
    const resultIcons = betCard.querySelectorAll('svg[id*="tick"], svg[id*="cross"]');
    const isMultiLeg = isSGP || resultIcons.length > 1;
    
    // Extract player names and markets for legs
    const legs: BetLeg[] = [];
    
    if (isMultiLeg) {
      // For multi-leg bets, extract each leg
      const legElements = betCard.querySelectorAll('.v.z.x.y.cq.cr.t.h.ad, .v.z.x.as.cq.cr.t.h');
      
      for (const legElement of legElements) {
        const legText = legElement.textContent || "";
        
        // Skip if this doesn't look like a leg (no player name or market)
        if (legText.length < 10) continue;
        
        // Extract player name
        const playerSpan = legElement.querySelector('.ag.bn.av.bb');
        const playerName = playerSpan ? normalizeText(playerSpan.textContent) : '';
        
        if (!playerName) continue;
        
        // Extract market text
        const marketSpan = legElement.querySelector('.fr.ba.fw.ha.av.hb, .fr.ba.ha.av.hb');
        const marketText = marketSpan ? normalizeText(marketSpan.textContent) : '';
        
        if (!marketText) continue;
        
        // Determine leg result from icon
        const legContainer = legElement.closest('.v.z.x.y.t.cs.h');
        const hasWinIcon = legContainer?.querySelector('svg[id*="tick"]') !== null;
        const hasLossIcon = legContainer?.querySelector('svg[id*="cross"]') !== null;
        
        const legResult: BetResult = hasWinIcon ? 'win' : hasLossIcon ? 'loss' : 'pending';
        
        // Parse market to extract type and target
        const { market, target } = parseMarket(marketText);
        
        legs.push({
          entities: [playerName],
          market,
          target,
          result: legResult,
        });
      }
    } else {
      // For single bets, create one leg
      // The leg result should match the overall bet result
      const playerSpan = betCard.querySelector('.ag.bn.av.bb');
      const playerName = playerSpan ? normalizeText(playerSpan.textContent) : '';
      
      const marketSpan = betCard.querySelector('.fr.ba.fw.ha.av.hb, .fr.ba.ha.av.hb');
      const marketText = marketSpan ? normalizeText(marketSpan.textContent) : '';
      
      if (playerName && marketText) {
        const { market, target } = parseMarket(marketText);
        
        legs.push({
          entities: [playerName],
          market,
          target,
          result, // For single bets, leg result = bet result
        });
      }
    }
    
    // Determine bet type
    const betType: BetType = isMultiLeg ? 'sgp' : 'single';
    
    // Build description
    let description = '';
    if (isMultiLeg) {
      description = `SGP: ${legs.map(leg => `${leg.entities?.[0]} ${leg.market}`).join(' / ')}`;
    } else if (legs.length > 0) {
      const leg = legs[0];
      description = `${leg.entities?.[0]}: ${leg.market} ${leg.target || ''}`.trim();
    } else {
      description = `Bet ${betId}`;
    }
    
    // Infer sport (for now, default to NBA for prop bets)
    const sport = 'NBA';
    
    // Classify market category
    const marketCategory = legs.length > 0 ? 'Props' : 'Other';
    
    // Generate unique ID
    const id = `FanDuel-${betId}-${placedAt}`;
    
    const bet: Bet = {
      id,
      book: 'FanDuel',
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
    };
    
    return bet;
  } catch (error) {
    console.warn(`FanDuel parser: Error extracting bet for ${betId}:`, error);
    return null;
  }
}

/**
 * Parses market text to extract market type and target.
 * Examples: "3+ Made Threes" → { market: "3pt", target: "3+" }
 */
function parseMarket(marketText: string): { market: string; target?: string } {
  const text = marketText.toLowerCase();
  
  // Extract line (e.g., "3+", "25.5")
  const lineMatch = marketText.match(/(\d+(?:\.\d+)?)\+?/);
  const target = lineMatch ? lineMatch[1] + (marketText.includes('+') ? '+' : '') : undefined;
  
  // Determine market type
  if (text.includes('made threes') || text.includes('3-pointers') || text.includes('threes')) {
    return { market: '3pt', target };
  }
  if (text.includes('points') || text.includes('pts')) {
    return { market: 'Pts', target };
  }
  if (text.includes('rebounds') || text.includes('reb')) {
    return { market: 'Reb', target };
  }
  if (text.includes('assists') || text.includes('ast')) {
    return { market: 'Ast', target };
  }
  if (text.includes('steals') || text.includes('stl')) {
    return { market: 'Stl', target };
  }
  if (text.includes('blocks') || text.includes('blk')) {
    return { market: 'Blk', target };
  }
  
  // Default: use the first meaningful word
  const words = marketText.split(/\s+/);
  const market = words.find(w => w.length > 2 && !/^\d/.test(w)) || marketText;
  
  return { market, target };
}

/**
 * Normalizes text by removing extra whitespace.
 */
function normalizeText(text: string | null): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parses date string to ISO timestamp.
 * Handles format: "11/16/2025 7:09PM ET"
 */
function parseDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // Parse MM/DD/YYYY H:MMAM/PM format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)/i);
  if (match) {
    const [, month, day, year, hour, minute, ampm] = match;
    let hourNum = parseInt(hour, 10);
    if (ampm.toUpperCase() === 'PM' && hourNum !== 12) {
      hourNum += 12;
    } else if (ampm.toUpperCase() === 'AM' && hourNum === 12) {
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

import { Bet, BetLeg, BetResult } from '../../../types';
import { FooterMeta, HeaderInfo, normalizeSpaces, parseMoney, extractLeagueFromEventCard, extractNameAndType, extractLineAndOu } from './common';

export interface ParlayBetContext {
  element: Element;
  header: HeaderInfo;
  footer: FooterMeta;
  betType?: 'parlay' | 'sgp' | 'sgp_plus';
}

/**
 * Extracts a single BetLeg from a DOM element. Nested recursion for SGPx.
 */
function extractLegFromElement(legEl: Element, defaultResult: BetResult): BetLeg {
    const leg: BetLeg = {
        market: '',
        result: 'pending',
        odds: undefined,
    };

    // 1. Check for Nested Items (Group Leg for SGPx/SGP+)
    // Structure: div class="dkcss-bq9exg" or just checking for nested selection-list-items
    // In Sample:
    // <div data-test-id="selection-list-item"> -> "2 Pick SGP"
    //    <div class="dkcss-bq9exg"> -> Contains nested items
    const nestedContainer = legEl.querySelector('div[class*="dkcss-"] > div[data-test-id="selection-list-item"]')?.parentElement;
    
    if (nestedContainer) {
        leg.isGroupLeg = true;
        leg.children = [];
        const nChildren = nestedContainer.querySelectorAll(':scope > div[data-test-id="selection-list-item"]');
        nChildren.forEach(child => {
            leg.children?.push(extractLegFromElement(child, defaultResult));
        });
    }

    // 2. Extract Basic Info (Selection / Header)
    let selectionText = '';
    let targetText = '';
    
    // Selection/Market Name: div[data-test-id^="bet-selection-subtitle-"] -> "Jordan Hawkins Points"
    const subEl = legEl.querySelector('div[data-test-id^="bet-selection-subtitle-"]');
    if (subEl) {
        selectionText = normalizeSpaces(subEl.textContent || '');
    }
    
    // If it's a Group Leg, the "Selection" might be the header title (e.g. "2 Pick SGP")
    // In sample: <div data-test-id="bet-selection-title-...">2 Pick SGP</div>
    const titleEl = legEl.querySelector('div[data-test-id^="bet-selection-title-"]');
    if (titleEl) {
        // Distinguish if title is "25+" (target) or "2 Pick SGP" (market for group)
        const t = normalizeSpaces(titleEl.textContent || '');
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
    } else {
        leg.market = selectionText || 'Unknown Market';
    }
    
    // Set target for non-group legs
    if (targetText && !leg.isGroupLeg) {
        leg.target = targetText;
    }

    // 3. Extract Odds (often present on Group Header or single legs)
    const oddsEl = legEl.querySelector('div[data-test-id^="bet-selection-displayOdds-"]');
    if (oddsEl) {
        // Replace unicode minus (−) with ASCII minus (-) for consistent parsing
        const oddsText = normalizeSpaces(oddsEl.textContent || '')
            .replace('−', '-')  // Unicode minus to ASCII minus
            .replace('+', '');   // Remove plus sign prefix
        const oddsValue = parseInt(oddsText, 10);
        if (!isNaN(oddsValue)) {
            leg.odds = oddsValue;
        }
    }

    // For group legs in SGP+, set odds to null for children (they share the group's combined odds)
    if (leg.isGroupLeg && leg.children) {
        leg.children = leg.children.map(child => ({
            ...child,
            odds: null
        }));
    }

    // 4. Extract Result (Icon)
    const icon = legEl.querySelector('svg title');
    const iconCircle = legEl.querySelector('svg circle');

    // Success: green circle or checkmark (#53D337)
    const isWin = iconCircle?.getAttribute('stroke') === '#53D337' || iconCircle?.getAttribute('fill') === '#53D337';
    // Failure: red circle or X (#E9344A)
    const isLoss = icon?.textContent?.includes('X sign') || 
                   iconCircle?.getAttribute('stroke') === '#E9344A' || 
                   iconCircle?.getAttribute('fill') === '#E9344A';

    if (isLoss) {
        leg.result = 'loss';
    } else if (isWin) {
        leg.result = 'win';
    } else {
        // Inherit from parent/default
        leg.result = defaultResult || 'pending';
    }

    // For group legs, aggregate result from children
    if (leg.isGroupLeg && leg.children && leg.children.length > 0) {
        const childResults = leg.children.map(c => c.result);
        if (childResults.some(r => r === 'loss')) {
            leg.result = 'loss';
        } else if (childResults.every(r => r === 'win')) {
            leg.result = 'win';
        } else if (childResults.some(r => r === 'pending')) {
            leg.result = 'pending';
        }
    }

    return leg;
}



export const parseParlayBet = (ctx: ParlayBetContext): Bet => {
  const { element, header, footer, betType } = ctx;
  
  // Find top-level leg containers.
  // The structure is: div[id$="-body"] containing direct children "selection-list-item"
  // We need to be careful not to select nested ones.
  const body = element.querySelector('div[id$="-body"]');
  const allLegs = body ? Array.from(body.querySelectorAll('div[data-test-id="selection-list-item"]')) : [];
  
  const topLevelLegs: BetLeg[] = [];
  
  // Filter for top-level legs only (direct children of body)
  allLegs.forEach(el => {
      const parent = el.parentElement;
      // Top-level items are direct children of the body div
      if (parent && parent.id && parent.id.endsWith('-body')) {
          topLevelLegs.push(extractLegFromElement(el, footer.result || 'pending'));
      }
  });

  // Fallback: Handle SGP bets with collapsed/unexpanded leg views
  // When the bet card is collapsed, legs aren't in selection-list-items but in the subtitle
  // Example: subtitle shows "18+, 9+" instead of full player names and markets
  if (topLevelLegs.length === 0) {
    const subtitleEl = element.querySelector('span[data-test-id^="bet-details-subtitle-"]');
    if (subtitleEl) {
      const subtitle = normalizeSpaces(subtitleEl.textContent || '');
      // Parse legs from subtitle like "18+, 9+" or "Pts 25+, Ast 4+"
      const legParts = subtitle.split(',').map(s => s.trim()).filter(s => s);
      
      if (legParts.length > 0) {
        // Try to extract more info from the title
        const titleEl = element.querySelector('span[data-test-id^="bet-details-title-"]');
        const title = titleEl ? normalizeSpaces(titleEl.textContent || '') : '';
        
        // Parse each leg part
        legParts.forEach(legText => {
          // Try to extract market type and target
          // Patterns: "18+", "Pts 18+", "Ast 9+"
          const match = legText.match(/^(?:([A-Za-z]+)\s+)?(\d+\+?)$/);
          if (match) {
            const marketPrefix = match[1];
            const target = match[2];
            
            // Infer market type from prefix or default to unknown
            let market = 'Unknown';
            if (marketPrefix) {
              market = marketPrefix; // "Pts", "Ast", etc.
            }
            
            topLevelLegs.push({
              market,
              target,
              result: footer.result || 'pending',
              odds: undefined, // SGP legs don't show individual odds
            });
          }
        });
      }
    }
  }

  // Collect all leaf legs for description (flatten structure)
  const collectLeafs = (l: BetLeg): BetLeg[] => {
      if (l.isGroupLeg && l.children) {
          return l.children.flatMap(collectLeafs);
      }
      return [l];
  };
  const flatLegs = topLevelLegs.flatMap(collectLeafs);

  // Construct description from leaf legs
  const description = flatLegs.map(l => {
      let desc = l.market;
      if (l.target) desc += ` ${l.target}`;
      return desc;
  }).join(', ');

  // Get total odds from header (bet-level odds)
  const oddsEl = element.querySelector('span[data-test-id^="bet-details-displayOdds-"]');
  let odds = 0;
  if (oddsEl) {
      const oddsText = normalizeSpaces(oddsEl.textContent || '').replace(/[+−]/g, (match) => match === '−' ? '-' : '');
      odds = parseInt(oddsText, 10) || 0;
  }

  // Determine bet type: SGPx (sgp_plus), SGP, or regular parlay
  let computedBetType = betType;
  
  // Check for SGPx (DraftKings' name for SGP+)
  const cardText = element.textContent || '';
  if (cardText.includes('SGPx') || cardText.toLowerCase().includes('sgpx')) {
    computedBetType = 'sgp_plus';
  }
  // Check if it has group legs (indicates SGP+ structure with nested SGPs)
  else if (topLevelLegs.some(leg => leg.isGroupLeg)) {
    computedBetType = 'sgp_plus';
  }
  // For DraftKings, simple SGPs (without nested structure) are treated as regular parlays
  // Only multi-group SGPs (SGPx) get the sgp_plus designation
  else if (!computedBetType || computedBetType === 'sgp') {
    computedBetType = 'parlay';
  }

  // Default to parlay if still not determined
  if (!computedBetType) {
    computedBetType = 'parlay';
  }

  // Extract league from the first event card
  const eventCard = element.querySelector('div[data-test-id="event-card"]');
  const sport = eventCard ? extractLeagueFromEventCard(eventCard) : 'Unknown';

  // Determine market category
  // For DraftKings, check if it's a same-game parlay (from SGP test-id or betType hint)
  const hasSGPIndicator = element.querySelector('[data-test-id^="sgp-"]') !== null;
  const isSameGameParlay = hasSGPIndicator || computedBetType === 'sgp' || computedBetType === 'sgp_plus' || betType === 'sgp' || betType === 'sgp_plus';
  const marketCategory = isSameGameParlay ? 'SGP/SGP+' : 'Parlays';

  return {
    id: header.betId,
    betId: header.betId,
    book: 'DraftKings',
    placedAt: header.placedAt,
    stake: footer.stake || 0,
    payout: footer.payout || 0,
    result: footer.result || 'pending',
    betType: computedBetType,
    marketCategory,
    sport,
    description,
    odds,
    legs: topLevelLegs,
  };
};

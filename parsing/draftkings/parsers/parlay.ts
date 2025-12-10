import { Bet, BetLeg, BetResult } from '../../../types';
import { FooterMeta, HeaderInfo, normalizeSpaces, parseMoney } from './common';

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
        odds: 0,
        // sport, league, team1, team2 omitted from object (not in interface), kept local if needed
    };

    // 1. Check for Nested Items (Group Leg)
    // Structure: div class="dkcss-bq9exg" or just checking for nested selection-list-items
    // But importantly, they are usually SIBLINGS in the same container or nested in a wrapper.
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
    
    leg.market = selectionText || 'Unknown Market';
    if (targetText && !leg.isGroupLeg) leg.target = targetText;

    // 3. Extract Odds (often present on Group Header or single legs)
    const oddsEl = legEl.querySelector('div[data-test-id^="bet-selection-displayOdds-"]');
    if (oddsEl) {
        const o = normalizeSpaces(oddsEl.textContent || '').replace('+', '');
        leg.odds = parseInt(o, 10) || 0;
    }

    // 4. Extract Result (Icon)
    const icon = legEl.querySelector('svg title');
    const iconCircle = legEl.querySelector('svg circle');
    const iconPath = legEl.querySelector('svg path'); // sometimes stroke is on path

    // Success: green circle or checkmark
    const isWin = iconCircle?.getAttribute('stroke') === '#53D337' || iconCircle?.getAttribute('fill') === '#53D337';
    // Failure: red circle or X
    const isLoss = icon?.textContent?.includes('X sign') || 
                   iconCircle?.getAttribute('stroke') === '#E9344A' || 
                   iconCircle?.getAttribute('fill') === '#E9344A';

    if (isLoss) leg.result = 'loss';
    else if (isWin) leg.result = 'win';
    else if (defaultResult === 'win') leg.result = 'win'; // fallback inheritance

    return leg;
}


export const parseParlayBet = (ctx: ParlayBetContext): Bet => {
  const { element, header, footer, betType } = ctx;
  
  // Find top-level leg containers.
  // The structure is: div[id$="-body"] containing direct children "selection-list-item"
  // We need to be careful not to select nested ones.
  const body = element.querySelector('div[id$="-body"]');
  const allLegs = body ? Array.from(body.querySelectorAll('div[data-test-id="selection-list-item"]')) : [];
  
  // Filter for top-level only. valid top-level items are direct children of the body wrapper (ignoring separator)
  // Or check if they are contained in a "dkcss-bq9exg" (nested container)
  // If parent has class "dkcss-kn5exb" (body class in sample) -> Top Level
  // If parent has class "dkcss-bq9exg" -> Nested
  // We can just iterate all and skip those that are inside another selection-list-item? 
  // Easier: recursive function that consumes the DOM. But DOM operations like this are simpler with specific selectors.
  
  const topLevelLegs: BetLeg[] = [];
  
  // Workaround: Iterate all, check parent.
  allLegs.forEach(el => {
      const parent = el.parentElement;
      // In SGPx sample, top-level items are direct children of div#618-body (class dkcss-kn5exb)
      // Nested items are children of div (class dkcss-bq9exg)
      // Since class names are hashed/unreliable, checking "data-test-id" of grandparent might be safer, but simpler:
      // If parent is the Body, it's top level.
      if (parent && parent.id && parent.id.endsWith('-body')) {
          topLevelLegs.push(extractLegFromElement(el, footer.result || 'pending'));
      }
  });


  // Collect all leaf legs for description (flatten structure)
  const collectLeafs = (l: BetLeg): BetLeg[] => {
      if (l.isGroupLeg && l.children) {
          return l.children.flatMap(collectLeafs);
      }
      return [l];
  };
  const flatLegs = topLevelLegs.flatMap(collectLeafs);

  // Construct description
  const description = flatLegs.map(l => {
      let desc = l.market;
      if (l.target) desc += ` ${l.target}`;
      return desc;
  }).join(', ');

  // Get total odds from header
  const oddsEl = element.querySelector('span[data-test-id^="bet-details-displayOdds-"]');
  let odds = 0;
  if (oddsEl) {
      const oddsText = normalizeSpaces(oddsEl.textContent || '').replace('−', '-').replace('+', '');
      odds = parseInt(oddsText, 10) || 0;
  }

  // Determine SGPx vs SGP
  // header info might say "SGPx"
  let computedBetType = betType;
  if (element.textContent?.includes('SGPx')) computedBetType = 'sgp_plus';

  return {
    id: header.betId,
    betId: header.betId,
    book: 'DraftKings',
    placedAt: header.placedAt,
    stake: footer.stake || 0,
    payout: footer.payout || 0,
    result: footer.result || 'pending',
    betType: computedBetType || 'parlay',
    marketCategory: 'SGP/SGP+',
    sport: 'mixed', // TODO: Infer from first leg's event card if possible
    description,
    odds,
    legs: topLevelLegs,
  };
};

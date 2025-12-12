import { Bet, BetLeg } from '../../../types';
import { FooterMeta, HeaderInfo, normalizeSpaces, extractLeagueFromEventCard, extractNameAndType, extractLineAndOu } from './common';

export interface SingleBetContext {
  element: Element;
  header: HeaderInfo;
  footer: FooterMeta;
}

export const parseSingleBet = (ctx: SingleBetContext): Bet => {
  const { element, header, footer } = ctx;

  const leg: BetLeg = {
    market: '',
    odds: 0,
    result: footer.result || 'pending',
    target: '',
  };

  // Selection: span[data-test-id^="bet-details-title-"] -> "PHO Suns +2.5"
  let isLive = false;
  const titleEl = element.querySelector('span[data-test-id^="bet-details-title-"]');
  const subtitleEl = element.querySelector('span[data-test-id^="bet-details-subtitle-"]');

  if (subtitleEl) {
    let rawMarket = normalizeSpaces(subtitleEl.textContent || '');
    // Check for Live
    if (rawMarket.includes('Live')) {
        isLive = true;
        rawMarket = rawMarket.replace(/Live Betting/i, '').replace(/Live/i, '').trim();
    }
    leg.market = rawMarket;

    if (titleEl) {
      leg.target = normalizeSpaces(titleEl.textContent || '');
    }
  } else if (titleEl) {
    let rawMarket = normalizeSpaces(titleEl.textContent || '');
     if (rawMarket.includes('Live')) {
        isLive = true;
        rawMarket = rawMarket.replace(/Live Betting/i, '').replace(/Live/i, '').trim();
    }
    leg.market = rawMarket;
  }

  // Odds: span[data-test-id^="bet-details-displayOdds-"] -> "−112"
  const oddsEl = element.querySelector('span[data-test-id^="bet-details-displayOdds-"]');
  if (oddsEl) {
      const oddsText = normalizeSpaces(oddsEl.textContent || '').replace('−', '-').replace('+', '');
      leg.odds = parseInt(oddsText, 10) || 0;
  }

  // Determine Result
  // Look for status div
  const statusEl = element.querySelector('div[data-test-id^="bet-details-status-"]');
  if (statusEl) {
      const statusText = normalizeSpaces(statusEl.textContent || '').toLowerCase();
      if (statusText === 'won') leg.result = 'win';
      else if (statusText === 'lost') leg.result = 'loss';
      else if (statusText === 'void') leg.result = 'push';
  } else {
     // Fallback to footer result if individual leg status not found (unlikely for single)
     if (footer.result === 'win') leg.result = 'win';
     else if (footer.result === 'loss') leg.result = 'loss';
     else if (footer.result === 'push') leg.result = 'push';
  }

  // Event Info - Extract league from logo URLs
  const eventCard = element.querySelector('div[data-test-id="event-card"]');
  let sport = 'Unknown';
  
  if (eventCard) {
    sport = extractLeagueFromEventCard(eventCard);
  }

  // Extract name and type from market/target
  const { name, type } = extractNameAndType(leg.market, leg.target as string);
  
  // Extract line and over/under from target
  const { line, ou } = extractLineAndOu(leg.target as string);

  // Build a more descriptive description
  // For spreads/totals: just the market type
  // For props: use the market description
  let description = type || leg.market;
  
  // For better descriptions, use the market name when available
  if (type && ['Spread', 'Total', 'Moneyline'].includes(type)) {
    description = type;
  } else if (leg.market && leg.market !== type) {
    // For props, use the full market description if different from type
    description = leg.market;
  }

  return {
    id: header.betId,
    betId: header.betId,
    book: 'DraftKings',
    placedAt: header.placedAt,
    stake: footer.stake || 0,
    payout: footer.payout || 0,
    result: footer.result || 'pending',
    betType: 'single',
    marketCategory: ['Spread', 'Total', 'Moneyline', 'Money Line'].includes(type) ? 'Main Markets' : 'Props',
    isLive: isLive,
    sport: sport,
    description: description,
    name: name || undefined,
    type: type || undefined,
    line: line || undefined,
    ou: ou,
    odds: leg.odds || 0,
    legs: [leg],
  };
};

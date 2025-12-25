import { Bet, BetLeg } from '../../../types';
import { FooterMeta, HeaderInfo, normalizeSpaces, extractLeagueFromEventCard, extractNameAndType, extractLineAndOu, extractTeamNamesFromEventCard, extractTeamNickname, isPlayerStatType, isTeamPropType } from './common';

export interface SingleBetContext {
  element: Element;
  header: HeaderInfo;
  footer: FooterMeta;
}

export const parseSingleBet = (ctx: SingleBetContext): Bet => {
  const { element, header, footer } = ctx;

  const leg: BetLeg = {
    market: '',
    entityType: 'unknown', // Will be set based on detected market type
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
      else if (statusText === 'void' || statusText === 'push') leg.result = 'push';
  } else {
     // Fallback to footer result if individual leg status not found (unlikely for single)
     if (footer.result === 'win') leg.result = 'win';
     else if (footer.result === 'loss') leg.result = 'loss';
     else if (footer.result === 'push' || footer.result === 'void') leg.result = 'push';
  }

  // Event Info - Extract league from logo URLs
  const eventCard = element.querySelector('div[data-test-id="event-card"]');
  let sport = 'Unknown';
  
  if (eventCard) {
    sport = extractLeagueFromEventCard(eventCard);
  }

  // Extract name and type from market/target
  const { name: extractedName, type: rawType } = extractNameAndType(leg.market, leg.target as string);
  
  // Normalize type variants: "Money Line" → "Moneyline"
  const MAIN_MARKET_TYPES = ['Spread', 'Total', 'Moneyline'];
  let type = rawType;
  if (rawType === 'Money Line') {
    type = 'Moneyline';
  }
  
  // Extract line and over/under from target
  const { line, ou } = extractLineAndOu(leg.target as string);

  // For Total bets, extract both team names and convert to nicknames
  // This enables the UI to display "Suns / Blazers" instead of just blank
  let name = extractedName;
  if (type === 'Total' && eventCard) {
    const [team1, team2] = extractTeamNamesFromEventCard(eventCard);
    if (team1 && team2) {
      // Convert to nicknames for compact display
      const nickname1 = extractTeamNickname(team1);
      const nickname2 = extractTeamNickname(team2);
      // Populate entities with nicknames for the transformation layer
      leg.entities = [nickname1, nickname2];
      // Set name to first team's nickname for display (Name2 comes from entities[1])
      name = nickname1;
    }
  }

  // Set entityType based on detected market type
  // Main market types (Spread, Total, Moneyline) are team bets
  // Props dispatch to helper functions for correct classification
  if (MAIN_MARKET_TYPES.includes(type)) {
    leg.entityType = 'team';
  } else if (type) {
    // Non-empty type detected - classify based on prop type
    if (isPlayerStatType(type)) {
      leg.entityType = 'player';
    } else if (isTeamPropType(type)) {
      leg.entityType = 'team';
    } else {
      // Unrecognized prop type - mark as unknown for future handling
      leg.entityType = 'unknown';
    }
  } else {
    leg.entityType = 'unknown';
  }

  // Build a more descriptive description
  // For spreads/totals/moneylines: just the market type
  // For props: use the market description
  let description = type || leg.market;
  
  // For better descriptions, use the canonical market name
  if (type && MAIN_MARKET_TYPES.includes(type)) {
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
    marketCategory: MAIN_MARKET_TYPES.includes(type) ? 'Main Markets' : 'Props',
    isLive: isLive,
    sport: sport,
    description: description,
    name: name || undefined,
    type: type || undefined,
    line: line || undefined,
    ou: ou || undefined,
    odds: leg.odds || 0,
    legs: [leg],
  };
};

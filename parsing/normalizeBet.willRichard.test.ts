import { describe, it, expect } from 'vitest';
import { normalizeBet } from './normalizeBet';
import { RawBet } from './rawBetTypes';

describe('normalizeBet - Will Richard Golden Test', () => {
  it('should produce exact output for Will Richard 3+ MADE THREES bet', () => {
    // Input: Will Richard bet that lost
    const rawBet: RawBet = {
      site: 'FanDuel',
      rawMarketText: '3+ MADE THREES',
      playerName: 'Will Richard',
      teamNames: undefined,
      game: 'Golden State Warriors @ New Orleans Pelicans',
      eventDateTime: undefined,
      placedAt: '11/16/2025 7:09PM ET',
      odds: '+360',
      wager: '$1.00',
      returned: '$0.00',
      betId: 'O/0242888/0027982',
      isMultiLeg: false,
      isLive: false,
      isTail: false,
    };

    const result = normalizeBet(rawBet);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      Date: '11/16/25',
      Site: 'FanDuel',
      Sport: 'NBA',
      Category: 'Props',
      Type: '3pt',
      Name: 'Will Richard',
      Over: '1',
      Under: '0',
      Line: '3+',
      Odds: '+360',
      Bet: '1.00',
      'To Win': '3.60',
      Result: 'Loss',
      Net: '-1.00',
      Live: '',
      Tail: '',
    });
  });
});


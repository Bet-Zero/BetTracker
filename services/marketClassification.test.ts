import { describe, it, expect } from 'vitest';
import { classifyBet, classifyLeg, determineType } from './marketClassification';
import { Bet } from '../types';

describe('marketClassification', () => {
  describe('classifyLeg', () => {
    describe('Props classification', () => {
      it('should classify player stat props correctly', () => {
        expect(classifyLeg('Player Points', 'NBA')).toBe('Props');
        expect(classifyLeg('Points', 'NBA')).toBe('Props');
        expect(classifyLeg('Rebounds', 'NBA')).toBe('Props');
        expect(classifyLeg('Assists', 'NBA')).toBe('Props');
        expect(classifyLeg('Pts', 'NBA')).toBe('Props');
        expect(classifyLeg('Reb', 'NBA')).toBe('Props');
        expect(classifyLeg('Ast', 'NBA')).toBe('Props');
      });

      it('should classify combined stat props correctly', () => {
        expect(classifyLeg('Points Rebounds Assists', 'NBA')).toBe('Props');
        expect(classifyLeg('PRA', 'NBA')).toBe('Props');
        expect(classifyLeg('Points Rebounds', 'NBA')).toBe('Props');
        expect(classifyLeg('Steals Blocks', 'NBA')).toBe('Props');
      });

      it('should classify special props correctly', () => {
        expect(classifyLeg('Triple Double', 'NBA')).toBe('Props');
        expect(classifyLeg('Triple-Double', 'NBA')).toBe('Props');
        expect(classifyLeg('Double Double', 'NBA')).toBe('Props');
        expect(classifyLeg('Double-Double', 'NBA')).toBe('Props');
        expect(classifyLeg('First Basket', 'NBA')).toBe('Props');
        expect(classifyLeg('First Field Goal', 'NBA')).toBe('Props');
        expect(classifyLeg('Top Scorer', 'NBA')).toBe('Props');
        expect(classifyLeg('Top Points', 'NBA')).toBe('Props');
      });

      it('should classify Made Threes props correctly', () => {
        expect(classifyLeg('Made Threes', 'NBA')).toBe('Props');
        expect(classifyLeg('3-Pointers', 'NBA')).toBe('Props');
        expect(classifyLeg('Threes', 'NBA')).toBe('Props');
        expect(classifyLeg('3pt', 'NBA')).toBe('Props');
      });

      it('should classify NFL props correctly', () => {
        expect(classifyLeg('Passing Yards', 'NFL')).toBe('Props');
        expect(classifyLeg('Rushing Yards', 'NFL')).toBe('Props');
        expect(classifyLeg('Receiving Yards', 'NFL')).toBe('Props');
        expect(classifyLeg('Touchdown', 'NFL')).toBe('Props');
      });
    });

    describe('Main Markets classification', () => {
      it('should classify spread bets correctly', () => {
        expect(classifyLeg('Spread', 'NBA')).toBe('Main Markets');
        expect(classifyLeg('Point Spread', 'NBA')).toBe('Main Markets');
      });

      it('should classify total bets correctly', () => {
        expect(classifyLeg('Total', 'NBA')).toBe('Main Markets');
        expect(classifyLeg('Over', 'NBA')).toBe('Main Markets');
        expect(classifyLeg('Under', 'NBA')).toBe('Main Markets');
      });

      it('should classify moneyline bets correctly', () => {
        expect(classifyLeg('Moneyline', 'NBA')).toBe('Main Markets');
        expect(classifyLeg('ML', 'NBA')).toBe('Main Markets');
      });

      it('should not misclassify player props as main markets', () => {
        expect(classifyLeg('Player Points Total', 'NBA')).toBe('Props');
        expect(classifyLeg('Player Prop Total', 'NBA')).toBe('Props');
      });
    });

    describe('Futures classification', () => {
      it('should classify championship futures correctly', () => {
        expect(classifyLeg('To Win NBA Finals', 'NBA')).toBe('Futures');
        expect(classifyLeg('To Win Super Bowl', 'NFL')).toBe('Futures');
        expect(classifyLeg('NBA Finals', 'NBA')).toBe('Futures');
        expect(classifyLeg('Super Bowl', 'NFL')).toBe('Futures');
      });

      it('should classify award futures correctly', () => {
        expect(classifyLeg('MVP Award', 'NBA')).toBe('Futures');
        expect(classifyLeg('MVP', 'NBA')).toBe('Futures');
        expect(classifyLeg('DPOY', 'NBA')).toBe('Futures');
        expect(classifyLeg('ROY', 'NBA')).toBe('Futures');
      });

      it('should classify win total futures correctly', () => {
        expect(classifyLeg('Win Total', 'NBA')).toBe('Futures');
        expect(classifyLeg('Win Totals', 'NBA')).toBe('Futures');
        expect(classifyLeg('Make Playoffs', 'NBA')).toBe('Futures');
        expect(classifyLeg('Miss Playoffs', 'NBA')).toBe('Futures');
      });

      it('should classify outright winners correctly', () => {
        expect(classifyLeg('Outright Winner', 'NBA')).toBe('Futures');
        expect(classifyLeg('Champion', 'NBA')).toBe('Futures');
      });
    });

    describe('Edge cases', () => {
      it('should default to Props for empty market', () => {
        expect(classifyLeg('', 'NBA')).toBe('Props');
      });

      it('should default to Props for unknown market type', () => {
        expect(classifyLeg('Unknown Market Type', 'NBA')).toBe('Props');
      });

      it('should handle case insensitivity', () => {
        expect(classifyLeg('POINTS', 'NBA')).toBe('Props');
        expect(classifyLeg('SPREAD', 'NBA')).toBe('Main Markets');
        expect(classifyLeg('MVP', 'NBA')).toBe('Futures');
      });
    });

    describe('Sport-specific TD handling', () => {
      it('should classify TD as triple-double prop in basketball', () => {
        expect(classifyLeg('td', 'NBA')).toBe('Props');
        expect(classifyLeg('TD', 'NBA')).toBe('Props');
        expect(classifyLeg('player td', 'NBA')).toBe('Props');
      });

      it('should classify TD as touchdown prop in football', () => {
        expect(classifyLeg('td', 'NFL')).toBe('Props');
        expect(classifyLeg('TD', 'NFL')).toBe('Props');
        expect(classifyLeg('player td', 'NFL')).toBe('Props');
      });

      it('should handle TD in other basketball leagues', () => {
        expect(classifyLeg('td', 'WNBA')).toBe('Props');
        expect(classifyLeg('td', 'CBB')).toBe('Props');
        expect(classifyLeg('td', 'NCAAB')).toBe('Props');
      });
    });
  });

  describe('determineType', () => {
    describe('Props types', () => {
      it('should determine individual stat types correctly', () => {
        expect(determineType('Points', 'Props', 'NBA')).toBe('Pts');
        expect(determineType('Rebounds', 'Props', 'NBA')).toBe('Reb');
        expect(determineType('Assists', 'Props', 'NBA')).toBe('Ast');
        expect(determineType('Steals', 'Props', 'NBA')).toBe('Stl');
        expect(determineType('Blocks', 'Props', 'NBA')).toBe('Blk');
      });

      it('should determine combined stat types correctly', () => {
        expect(determineType('Points Rebounds Assists', 'Props', 'NBA')).toBe('PRA');
        expect(determineType('Points Rebounds', 'Props', 'NBA')).toBe('PR');
        expect(determineType('Rebounds Assists', 'Props', 'NBA')).toBe('RA');
        expect(determineType('Points Assists', 'Props', 'NBA')).toBe('PA');
        expect(determineType('Steals Blocks', 'Props', 'NBA')).toBe('Stocks');
      });

      it('should determine special prop types correctly', () => {
        expect(determineType('First Basket', 'Props', 'NBA')).toBe('FB');
        expect(determineType('First Field Goal', 'Props', 'NBA')).toBe('FB');
        expect(determineType('Top Scorer', 'Props', 'NBA')).toBe('Top Pts');
        expect(determineType('Double Double', 'Props', 'NBA')).toBe('DD');
        expect(determineType('Triple Double', 'Props', 'NBA')).toBe('TD');
      });

      it('should determine made threes type correctly', () => {
        expect(determineType('Made Threes', 'Props', 'NBA')).toBe('3pt');
        expect(determineType('3-Pointers', 'Props', 'NBA')).toBe('3pt');
        expect(determineType('Threes', 'Props', 'NBA')).toBe('3pt');
      });

      it('should return empty string for unknown prop types', () => {
        expect(determineType('Unknown Stat', 'Props', 'NBA')).toBe('');
      });

      it('should handle sport-specific TD types', () => {
        expect(determineType('td', 'Props', 'NBA')).toBe('TD');
        expect(determineType('TD', 'Props', 'NBA')).toBe('TD');
        expect(determineType('td', 'Props', 'NFL')).toBe('');
      });
    });

    describe('Main Markets types', () => {
      it('should determine main market types correctly', () => {
        expect(determineType('Spread', 'Main Markets', 'NBA')).toBe('Spread');
        expect(determineType('Point Spread', 'Main Markets', 'NBA')).toBe('Spread');
        expect(determineType('Total', 'Main Markets', 'NBA')).toBe('Total');
        expect(determineType('Over', 'Main Markets', 'NBA')).toBe('Total');
        expect(determineType('Under', 'Main Markets', 'NBA')).toBe('Total');
        expect(determineType('Moneyline', 'Main Markets', 'NBA')).toBe('Moneyline');
        expect(determineType('ML', 'Main Markets', 'NBA')).toBe('Moneyline');
      });

      it('should default to Spread for unknown main markets', () => {
        expect(determineType('Unknown Market', 'Main Markets', 'NBA')).toBe('Spread');
      });
    });

    describe('Futures types', () => {
      it('should determine championship futures types correctly', () => {
        expect(determineType('NBA Finals', 'Futures', 'NBA')).toBe('NBA Finals');
        expect(determineType('Super Bowl', 'Futures', 'NFL')).toBe('Super Bowl');
      });

      it('should determine award futures types correctly', () => {
        expect(determineType('MVP', 'Futures', 'NBA')).toBe('MVP');
        expect(determineType('DPOY', 'Futures', 'NBA')).toBe('DPOY');
        expect(determineType('ROY', 'Futures', 'NBA')).toBe('ROY');
      });

      it('should determine win total types correctly', () => {
        expect(determineType('Win Total', 'Futures', 'NBA')).toBe('Win Total');
        expect(determineType('Make Playoffs', 'Futures', 'NBA')).toBe('Make Playoffs');
      });

      it('should default to Future for unknown futures', () => {
        expect(determineType('Unknown Future', 'Futures', 'NBA')).toBe('Future');
      });
    });
  });

  describe('classifyBet', () => {
    const createTestBet = (overrides: Partial<Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>>): Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'> => ({
      betId: 'test-bet-id',
      book: 'FanDuel',
      sport: 'NBA',
      description: 'Test Bet',
      betType: 'single',
      placedAt: '2024-01-01T00:00:00Z',
      stake: 10,
      odds: -110,
      result: 'pending',
      payout: 0,
      isLive: false,
      ...overrides,
    });

    describe('Parlay classification', () => {
      it('should classify parlay bets as Parlays', () => {
        const bet = createTestBet({ betType: 'parlay' });
        expect(classifyBet(bet)).toBe('Parlays');
      });
    });

    describe('SGP classification', () => {
      it('should classify SGP bets as SGP/SGP+', () => {
        const bet = createTestBet({ betType: 'sgp' });
        expect(classifyBet(bet)).toBe('SGP/SGP+');
      });

      it('should classify SGP+ bets as SGP/SGP+', () => {
        const bet = createTestBet({ betType: 'sgp_plus' });
        expect(classifyBet(bet)).toBe('SGP/SGP+');
      });
    });

    describe('Props classification', () => {
      it('should classify bets with name as Props', () => {
        const bet = createTestBet({
          betType: 'single',
          name: 'LeBron James',
          description: 'LeBron James Points',
        });
        expect(classifyBet(bet)).toBe('Props');
      });

      it('should classify bets with type as Props', () => {
        const bet = createTestBet({
          betType: 'single',
          type: 'Pts',
          description: 'Player Points',
        });
        expect(classifyBet(bet)).toBe('Props');
      });

      it('should classify bets with prop keywords in description as Props', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Player Points 25.5',
        });
        expect(classifyBet(bet)).toBe('Props');
      });

      it('should classify bets with legs containing entities as Props', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Player Bet',
          legs: [{
            entities: ['LeBron James'],
            market: 'Points',
            result: 'pending',
          }],
        });
        expect(classifyBet(bet)).toBe('Props');
      });
    });

    describe('Main Markets classification', () => {
      it('should classify spread bets as Main Markets', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Lakers Spread -7.5',
        });
        expect(classifyBet(bet)).toBe('Main Markets');
      });

      it('should classify moneyline bets as Main Markets', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Lakers Moneyline',
        });
        expect(classifyBet(bet)).toBe('Main Markets');
      });

      it('should classify total bets as Main Markets', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Total Over 220.5',
        });
        expect(classifyBet(bet)).toBe('Main Markets');
      });

      it('should classify bets with spread pattern as Main Markets', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Lakers -7.5',
        });
        expect(classifyBet(bet)).toBe('Main Markets');
      });
    });

    describe('Futures classification', () => {
      it('should classify championship futures as Futures', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Lakers to win NBA Finals',
        });
        expect(classifyBet(bet)).toBe('Futures');
      });

      it('should classify award futures as Futures', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'LeBron James MVP',
        });
        expect(classifyBet(bet)).toBe('Futures');
      });

      it('should classify win total futures as Futures', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Lakers Win Total Over 52.5',
        });
        expect(classifyBet(bet)).toBe('Futures');
      });
    });

    describe('Fallback behavior', () => {
      it('should default to Main Markets for unclear single bets', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Unclear Bet Type',
        });
        expect(classifyBet(bet)).toBe('Main Markets');
      });

      it('should classify as Props if name or type is present', () => {
        const bet = createTestBet({
          betType: 'other',
          name: 'Player Name',
          description: 'Some Bet',
        });
        expect(classifyBet(bet)).toBe('Props');
      });
    });

    describe('Priority order', () => {
      it('should prioritize betType over description', () => {
        const bet = createTestBet({
          betType: 'parlay',
          description: 'Lakers Spread -7.5',
        });
        expect(classifyBet(bet)).toBe('Parlays');
      });

      it('should prioritize futures keywords over main market keywords', () => {
        const bet = createTestBet({
          betType: 'single',
          description: 'Total Wins Champion',
        });
        expect(classifyBet(bet)).toBe('Futures');
      });
    });
  });

  describe('Integration tests', () => {
    it('should maintain consistency between classifyLeg and determineType', () => {
      const testMarkets = [
        { market: 'Points', sport: 'NBA' },
        { market: 'Spread', sport: 'NBA' },
        { market: 'NBA Finals', sport: 'NBA' },
        { market: 'Triple Double', sport: 'NBA' },
      ];

      testMarkets.forEach(({ market, sport }) => {
        const category = classifyLeg(market, sport);
        const type = determineType(market, category, sport);
        
        // Type should not be empty for known markets
        if (['Points', 'Spread', 'NBA Finals', 'Triple Double'].includes(market)) {
          expect(type).not.toBe('');
        }
      });
    });

    it('should handle full classification workflow', () => {
      // Simulate a full bet classification
      const bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'> = {
        betId: 'workflow-test',
        book: 'FanDuel',
        sport: 'NBA',
        description: 'Same Game Parlay',
        betType: 'sgp',
        placedAt: '2024-01-01T00:00:00Z',
        stake: 10,
        odds: +400,
        result: 'pending',
        payout: 0,
        isLive: false,
        legs: [
          {
            entities: ['LeBron James'],
            market: 'Points',
            target: '25.5',
            ou: 'Over',
            result: 'pending',
          },
          {
            entities: ['Anthony Davis'],
            market: 'Rebounds',
            target: '10.5',
            ou: 'Over',
            result: 'pending',
          },
        ],
      };

      // Bet-level classification
      const betCategory = classifyBet(bet);
      expect(betCategory).toBe('SGP/SGP+');

      // Leg-level classification
      const leg1Category = classifyLeg(bet.legs![0].market, bet.sport);
      const leg1Type = determineType(bet.legs![0].market, leg1Category, bet.sport);
      expect(leg1Category).toBe('Props');
      expect(leg1Type).toBe('Pts');

      const leg2Category = classifyLeg(bet.legs![1].market, bet.sport);
      const leg2Type = determineType(bet.legs![1].market, leg2Category, bet.sport);
      expect(leg2Category).toBe('Props');
      expect(leg2Type).toBe('Reb');
    });
  });
});

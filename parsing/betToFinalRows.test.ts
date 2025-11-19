import { describe, it, expect } from 'vitest';
import { betToFinalRows } from './betToFinalRows';
import { Bet } from '../types';

describe('betToFinalRows', () => {
  describe('single bet without legs', () => {
    it('should convert a simple single bet to FinalRow', () => {
      const bet: Bet = {
        id: 'test-1',
        book: 'FanDuel',
        betId: 'ABC123',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Will Richard: 3+ Made Threes',
        name: 'Will Richard',
        odds: 360,
        stake: 1.0,
        payout: 4.6,
        result: 'win',
        type: '3pt',
        line: '3+',
        ou: 'Over',
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        Date: '11/18/24',
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
        'To Win': '4.60',
        Result: 'Win',
        Net: '3.60',
        Live: '',
        Tail: '',
      });
    });

    it('should handle negative odds', () => {
      const bet: Bet = {
        id: 'test-2',
        book: 'FanDuel',
        betId: 'ABC124',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Player Points',
        name: 'LeBron James',
        odds: -120,
        stake: 12.0,
        payout: 0,
        result: 'loss',
        type: 'Pts',
        line: '25.5',
        ou: 'Over',
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Odds).toBe('-120');
      expect(rows[0].Result).toBe('Loss');
      expect(rows[0].Net).toBe('-12.00');
    });

    it('should handle push result', () => {
      const bet: Bet = {
        id: 'test-3',
        book: 'FanDuel',
        betId: 'ABC125',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Main Markets',
        sport: 'NBA',
        description: 'Spread',
        name: 'Lakers',
        odds: -110,
        stake: 10.0,
        payout: 10.0,
        result: 'push',
        type: 'Spread',
        line: '-5.5',
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Result).toBe('Push');
      expect(rows[0].Net).toBe('0.00');
    });

    it('should set Live flag for live bets', () => {
      const bet: Bet = {
        id: 'test-4',
        book: 'FanDuel',
        betId: 'ABC126',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Live bet',
        name: 'Player',
        odds: 200,
        stake: 5.0,
        payout: 0,
        result: 'pending',
        isLive: true,
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Live).toBe('1');
    });

    it('should set Tail flag when tail is present', () => {
      const bet: Bet = {
        id: 'test-5',
        book: 'FanDuel',
        betId: 'ABC127',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Tailed bet',
        name: 'Player',
        odds: 150,
        stake: 2.0,
        payout: 0,
        result: 'pending',
        tail: 'Expert123',
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Tail).toBe('1');
    });
  });

  describe('multi-leg bets (SGP/Parlay)', () => {
    it('should create one FinalRow per leg', () => {
      const bet: Bet = {
        id: 'sgp-1',
        book: 'FanDuel',
        betId: 'SGP123',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'sgp',
        marketCategory: 'SGP/SGP+',
        sport: 'NBA',
        description: 'SGP: Player A 3pt / Player B Pts',
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: 'loss',
        legs: [
          {
            entities: ['Player A'],
            market: '3pt',
            target: '3+',
            result: 'win',
          },
          {
            entities: ['Player B'],
            market: 'Pts',
            target: '25.5',
            ou: 'Over',
            result: 'loss',
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(2);
      
      // First leg
      expect(rows[0].Name).toBe('Player A');
      expect(rows[0].Type).toBe('3pt');
      expect(rows[0].Line).toBe('3+');
      expect(rows[0].Result).toBe('Win');
      expect(rows[0].Over).toBe('1'); // "+" implies Over
      
      // Second leg
      expect(rows[1].Name).toBe('Player B');
      expect(rows[1].Type).toBe('Pts');
      expect(rows[1].Line).toBe('25.5');
      expect(rows[1].Result).toBe('Loss');
      expect(rows[1].Over).toBe('1');
      expect(rows[1].Under).toBe('0');
      
      // Both legs share the same bet/odds/toWin
      expect(rows[0].Bet).toBe('5.00');
      expect(rows[1].Bet).toBe('5.00');
      expect(rows[0].Odds).toBe('+500');
      expect(rows[1].Odds).toBe('+500');
    });

    it('should calculate Net based on bet result for multi-leg bets, not individual leg results', () => {
      const bet: Bet = {
        id: 'sgp-2',
        book: 'FanDuel',
        betId: 'SGP456',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'sgp',
        marketCategory: 'SGP/SGP+',
        sport: 'NBA',
        description: 'SGP with mixed leg results',
        odds: 500,
        stake: 10.0,
        payout: 0, // Lost overall
        result: 'loss', // Overall bet lost
        legs: [
          {
            entities: ['Player A'],
            market: '3pt',
            target: '3+',
            result: 'win', // This leg won
          },
          {
            entities: ['Player B'],
            market: 'Pts',
            target: '25.5',
            ou: 'Over',
            result: 'loss', // This leg lost
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(2);
      
      // Both legs should show the bet loss (not the individual leg results)
      // because stake/odds/payout are at bet level
      expect(rows[0].Net).toBe('-10.00'); // Loss, not win
      expect(rows[1].Net).toBe('-10.00'); // Both legs reflect actual bankroll impact
      
      // But individual leg results are still shown in Result column
      expect(rows[0].Result).toBe('Win');
      expect(rows[1].Result).toBe('Loss');
    });

    it('should handle single-leg bets with legs structure correctly', () => {
      // FanDuel parser creates legs even for single bets
      const bet: Bet = {
        id: 'single-with-leg',
        book: 'FanDuel',
        betId: 'SINGLE123',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Single bet with leg structure',
        odds: 200,
        stake: 5.0,
        payout: 15.0,
        result: 'win',
        legs: [
          {
            entities: ['Player Name'],
            market: 'Pts',
            target: '25.5',
            ou: 'Over',
            result: 'win',
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      
      // For single-leg bet, Net should still be based on leg result
      // (which matches bet result anyway)
      expect(rows[0].Net).toBe('10.00'); // Payout - stake
      expect(rows[0].Result).toBe('Win');
      expect(rows[0].Name).toBe('Player Name');
      expect(rows[0].Type).toBe('Pts');
    });
  });

  describe('Category normalization', () => {
    it('should normalize Props category', () => {
      const bet: Bet = {
        id: 'test-6',
        book: 'FanDuel',
        betId: 'ABC128',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        name: 'Player',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Category).toBe('Props');
    });

    it('should normalize Main Markets category', () => {
      const bet: Bet = {
        id: 'test-7',
        book: 'FanDuel',
        betId: 'ABC129',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Main Markets',
        sport: 'NBA',
        description: 'Test',
        name: 'Team',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Category).toBe('Main');
    });

    it('should normalize Futures category', () => {
      const bet: Bet = {
        id: 'test-8',
        book: 'FanDuel',
        betId: 'ABC130',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Futures',
        sport: 'NBA',
        description: 'Test',
        name: 'Team',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Category).toBe('Futures');
    });
  });

  describe('Type detection based on Category', () => {
    it('should map Props stat types correctly', () => {
      const testCases = [
        { market: 'made threes', expected: '3pt' },
        { market: 'points', expected: 'Pts' },
        { market: 'rebounds', expected: 'Reb' },
        { market: 'assists', expected: 'Ast' },
        { market: 'steals', expected: 'Stl' },
        { market: 'blocks', expected: 'Blk' },
        { market: 'points rebounds assists', expected: 'PRA' },
        { market: 'points rebounds', expected: 'PR' },
      ];

      testCases.forEach(({ market, expected }) => {
        const bet: Bet = {
          id: 'test',
          book: 'FanDuel',
          betId: 'TEST',
          placedAt: '2024-11-18T19:00:00.000Z',
          betType: 'single',
          marketCategory: 'Props',
          sport: 'NBA',
          description: market,
          name: 'Player',
          odds: 100,
          stake: 1.0,
          payout: 0,
          result: 'pending',
          type: market,
        };

        const rows = betToFinalRows(bet);
        expect(rows[0].Type).toBe(expected);
      });
    });

    it('should return empty Type for unmapped Props', () => {
      const bet: Bet = {
        id: 'test-9',
        book: 'FanDuel',
        betId: 'ABC131',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Unknown stat',
        name: 'Player',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
        type: 'unknown stat type',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).toBe('');
    });

    it('should map Main Markets types correctly', () => {
      const testCases = [
        { market: 'spread', expected: 'Spread' },
        { market: 'total', expected: 'Total' },
        { market: 'over', expected: 'Total' },
        { market: 'under', expected: 'Total' },
        { market: 'moneyline', expected: 'Moneyline' },
      ];

      testCases.forEach(({ market, expected }) => {
        const bet: Bet = {
          id: 'test',
          book: 'FanDuel',
          betId: 'TEST',
          placedAt: '2024-11-18T19:00:00.000Z',
          betType: 'single',
          marketCategory: 'Main Markets',
          sport: 'NBA',
          description: market,
          name: 'Team',
          odds: 100,
          stake: 1.0,
          payout: 0,
          result: 'pending',
          type: market,
        };

        const rows = betToFinalRows(bet);
        expect(rows[0].Type).toBe(expected);
      });
    });
  });

  describe('Over/Under detection', () => {
    it('should set Over=1/Under=0 for Over bets', () => {
      const bet: Bet = {
        id: 'test-10',
        book: 'FanDuel',
        betId: 'ABC132',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        name: 'Player',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
        ou: 'Over',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe('1');
      expect(rows[0].Under).toBe('0');
    });

    it('should set Over=0/Under=1 for Under bets', () => {
      const bet: Bet = {
        id: 'test-11',
        book: 'FanDuel',
        betId: 'ABC133',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        name: 'Player',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
        ou: 'Under',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe('0');
      expect(rows[0].Under).toBe('1');
    });

    it('should set Over=1/Under=0 for milestone bets (X+)', () => {
      const bet: Bet = {
        id: 'test-12',
        book: 'FanDuel',
        betId: 'ABC134',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        name: 'Player',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
        line: '3+',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe('1');
      expect(rows[0].Under).toBe('0');
    });

    it('should set both blank for non-O/U bets', () => {
      const bet: Bet = {
        id: 'test-13',
        book: 'FanDuel',
        betId: 'ABC135',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Main Markets',
        sport: 'NBA',
        description: 'Moneyline',
        name: 'Team',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
        type: 'Moneyline',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe('');
      expect(rows[0].Under).toBe('');
    });
  });

  describe('betType should never appear in Type field', () => {
    it('should not use betType=single in Type field', () => {
      const bet: Bet = {
        id: 'test-14',
        book: 'FanDuel',
        betId: 'ABC136',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        name: 'Player',
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: 'pending',
        type: 'Pts',
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).not.toBe('single');
      expect(rows[0].Type).toBe('Pts');
    });

    it('should not use betType=parlay in Type field', () => {
      const bet: Bet = {
        id: 'test-15',
        book: 'FanDuel',
        betId: 'ABC137',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'parlay',
        marketCategory: 'Parlays',
        sport: 'NBA',
        description: 'Parlay',
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: 'pending',
        legs: [
          {
            entities: ['Player A'],
            market: 'Pts',
            target: '25.5',
            result: 'pending',
          },
        ],
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).not.toBe('parlay');
      expect(rows[0].Type).toBe('Pts');
    });

    it('should not use betType=sgp in Type field', () => {
      const bet: Bet = {
        id: 'test-16',
        book: 'FanDuel',
        betId: 'ABC138',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'sgp',
        marketCategory: 'SGP/SGP+',
        sport: 'NBA',
        description: 'SGP',
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: 'pending',
        legs: [
          {
            entities: ['Player A'],
            market: 'Reb',
            target: '10.5',
            result: 'pending',
          },
        ],
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).not.toBe('sgp');
      expect(rows[0].Type).toBe('Reb');
    });
  });
});

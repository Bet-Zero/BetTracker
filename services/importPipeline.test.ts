/**
 * Import Pipeline Tests - Pass 6 Minimal Test Suite
 * 
 * High-value tests that protect the core import pipeline from regression.
 * These tests focus on:
 * - Result/Error model consistency
 * - Validation gate behavior (blockers vs warnings)
 * - Parser smoke tests (required fields present)
 * - Display transform stability
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { 
  ok, 
  err, 
  createImportError, 
  getErrorMessage,
  ImportError,
  Result
} from './errors';
import { validateBetForImport, validateBetsForImport } from '../utils/importValidation';
import { processPageResult, processPage } from '../parsing/shared/pageProcessor';
import { parse as parseFanDuel } from '../parsing/fanduel/fanduel';
import { parse as parseDraftKings } from '../parsing/draftkings/parsers';
import { betToFinalRows } from '../parsing/shared/betToFinalRows';
import { Bet } from '../types';

/**
 * Helper to load fixture files with improved error handling.
 * Resolves the absolute path and provides clear error messages if file is missing.
 * 
 * @param relativePath - Path relative to the project root (e.g., 'parsing/draftkings/fixtures/file.html')
 * @returns The file contents as a string
 * @throws Error with clear context if file cannot be read
 */
const loadFixture = (relativePath: string): string => {
  const absolutePath = resolve(__dirname, '..', relativePath);
  
  if (!existsSync(absolutePath)) {
    throw new Error(
      `Fixture file not found: ${relativePath}\n` +
      `Resolved path: ${absolutePath}\n` +
      `Ensure the fixture exists in the repository.`
    );
  }
  
  try {
    return readFileSync(absolutePath, 'utf-8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read fixture file: ${relativePath}\n` +
      `Resolved path: ${absolutePath}\n` +
      `Error: ${errorMessage}`
    );
  }
};

describe('Import Pipeline - Result/Error Model', () => {
  describe('Result type helpers', () => {
    it('ok() creates a successful result', () => {
      const result = ok<number>(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('err() creates a failed result', () => {
      const error = createImportError('EMPTY_HTML', 'Test error');
      const result = err<number>(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_HTML');
        expect(result.error.message).toBe('Test error');
      }
    });

    it('createImportError() creates proper ImportError shape', () => {
      const error = createImportError('PARSER_FAILED', 'User message', 'Debug details');
      expect(error.code).toBe('PARSER_FAILED');
      expect(error.message).toBe('User message');
      expect(error.details).toBe('Debug details');
    });

    it('getErrorMessage() returns user-friendly messages', () => {
      expect(getErrorMessage('EMPTY_HTML')).toContain('empty');
      expect(getErrorMessage('NO_BETS_FOUND')).toContain('found');
      expect(getErrorMessage('PARSER_FAILED')).toContain('error');
    });
  });
});

describe('Import Pipeline - Validation Gate', () => {
  describe('blockers vs warnings classification', () => {
    it('missing bet.id is a blocker', () => {
      const bet: Bet = {
        id: '', // Missing ID - blocker
        betId: 'test',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test bet',
        stake: 10,
        odds: -110,
        result: 'win',
        payout: 19.09,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers.some(b => b.field === 'id')).toBe(true);
    });

    it('missing stake is a blocker', () => {
      const bet: Bet = {
        id: 'test-id',
        betId: 'test',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test bet',
        stake: NaN, // Invalid stake - blocker
        odds: -110,
        result: 'win',
        payout: 0,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(false);
      expect(result.blockers.some(b => b.field === 'stake')).toBe(true);
    });

    it('missing odds for win is a blocker', () => {
      const bet: Bet = {
        id: 'test-id',
        betId: 'test',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test bet',
        stake: 10,
        odds: null, // Missing odds for win - blocker
        result: 'win',
        payout: 0,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(false);
      expect(result.blockers.some(b => b.field === 'odds')).toBe(true);
    });

    it('zero stake is valid (free bet scenario)', () => {
      const bet: Bet = {
        id: 'free-bet-id',
        betId: 'free-bet',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Free bet promotion',
        stake: 0, // Zero stake for free bet - should be valid
        odds: -110,
        result: 'win',
        payout: 10.0,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(true);
      expect(result.blockers.some(b => b.field === 'stake')).toBe(false);
    });

    it('missing odds is OK for loss result', () => {
      const bet: Bet = {
        id: 'loss-no-odds-id',
        betId: 'loss-no-odds',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Lost bet without odds',
        stake: 10,
        odds: null, // Missing odds - OK for loss since net = -stake
        result: 'loss',
        payout: 0,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(true);
      expect(result.blockers.some(b => b.field === 'odds')).toBe(false);
    });

    it('missing odds is OK for push result', () => {
      const bet: Bet = {
        id: 'push-no-odds-id',
        betId: 'push-no-odds',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Push bet without odds',
        stake: 10,
        odds: null, // Missing odds - OK for push since net = 0
        result: 'push',
        payout: 10.0,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(true);
      expect(result.blockers.some(b => b.field === 'odds')).toBe(false);
    });

    it('missing sport is a warning (not blocker)', () => {
      const bet: Bet = {
        id: 'test-id',
        betId: 'test',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: '', // Missing sport - warning only
        description: 'Test bet',
        stake: 10,
        odds: -110,
        result: 'loss',
        payout: 0,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(true); // Still valid
      expect(result.warnings.some(w => w.field === 'sport')).toBe(true);
    });

    it('valid bet passes validation', () => {
      const bet: Bet = {
        id: 'valid-bet-id',
        betId: 'valid-bet',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'LeBron James Points',
        name: 'LeBron James',
        type: 'Pts',
        stake: 10,
        odds: -110,
        result: 'win',
        payout: 19.09,
      };

      const result = validateBetForImport(bet);
      expect(result.valid).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe('batch validation', () => {
    it('validateBetsForImport aggregates results correctly', () => {
      const validBet: Bet = {
        id: 'valid-1',
        betId: 'v1',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        odds: -110,
        result: 'loss',
        payout: 0,
      };

      const invalidBet: Bet = {
        id: '', // Blocker
        betId: 'inv1',
        book: 'FanDuel',
        placedAt: '2024-01-01T00:00:00Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        odds: -110,
        result: 'loss',
        payout: 0,
      };

      const summary = validateBetsForImport([validBet, invalidBet]);
      
      expect(summary.validBets).toHaveLength(1);
      expect(summary.invalidBets).toHaveLength(1);
      expect(summary.betsWithBlockers).toBe(1);
      expect(summary.totalBlockers).toBeGreaterThan(0);
    });
  });
});

describe('Import Pipeline - pageProcessor', () => {
  describe('processPageResult error handling', () => {
    it('returns EMPTY_HTML error for empty string', () => {
      const result = processPageResult('FanDuel', '');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_HTML');
      }
    });

    it('returns EMPTY_HTML error for whitespace-only string', () => {
      const result = processPageResult('FanDuel', '   \n\t  ');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_HTML');
      }
    });

    it('returns PARSER_NOT_AVAILABLE for "Other" sportsbook', () => {
      const result = processPageResult('Other', '<html>content</html>');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PARSER_NOT_AVAILABLE');
      }
    });

    it('returns PARSER_NOT_AVAILABLE for unknown sportsbook', () => {
      const result = processPageResult('UnknownBook' as any, '<html>content</html>');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PARSER_NOT_AVAILABLE');
      }
    });

    it('returns NO_BETS_FOUND for valid HTML with no bet cards', () => {
      const result = processPageResult('FanDuel', '<html><body>No bets here</body></html>');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NO_BETS_FOUND');
      }
    });
  });

  describe('legacy processPage compatibility', () => {
    it('returns bets array and no error on success simulation', () => {
      // This tests the backward-compatible wrapper
      const result = processPage('FanDuel', '<html>no bets</html>');
      expect(result.error).toBeDefined(); // No bets found
      expect(result.bets).toHaveLength(0);
    });

    it('returns error string for failures', () => {
      const result = processPage('FanDuel', '');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('empty');
      expect(result.bets).toHaveLength(0);
    });
  });
});

describe('Import Pipeline - Parser Smoke Tests', () => {
  describe('DraftKings parser', () => {
    it('parses fixture HTML and returns Bet[] with required fields', () => {
      const html = loadFixture('parsing/draftkings/fixtures/combined_rendered_stubs.html');
      const bets = parseDraftKings(html);
      
      // Should find bets
      expect(bets.length).toBeGreaterThan(0);
      
      // Every bet should have required fields
      bets.forEach((bet, index) => {
        expect(bet.id, `bet[${index}].id`).toBeTruthy();
        expect(bet.betId, `bet[${index}].betId`).toBeTruthy();
        expect(bet.book, `bet[${index}].book`).toBe('DraftKings');
        expect(bet.placedAt, `bet[${index}].placedAt`).toBeTruthy();
        expect(typeof bet.stake, `bet[${index}].stake`).toBe('number');
        expect(bet.stake, `bet[${index}].stake >= 0`).toBeGreaterThanOrEqual(0);
        expect(['win', 'loss', 'push', 'pending'], `bet[${index}].result`).toContain(bet.result);
        expect(['single', 'parlay', 'sgp', 'sgp_plus', 'live', 'other'], `bet[${index}].betType`).toContain(bet.betType);
      });
    });

    it('parsed bets pass validation gate', () => {
      const html = loadFixture('parsing/draftkings/fixtures/combined_rendered_stubs.html');
      const bets = parseDraftKings(html);
      
      const summary = validateBetsForImport(bets);
      
      // All parsed bets should be valid (no blockers)
      expect(summary.betsWithBlockers).toBe(0);
      expect(summary.validBets.length).toBe(bets.length);
    });

    // Deterministic count assertion to catch regressions.
    // Expected count: 6 bets from combined_rendered_stubs.html
    // Update this value if the fixture is intentionally modified.
    it('parses expected number of bets from fixture (regression guard)', () => {
      const html = loadFixture('parsing/draftkings/fixtures/combined_rendered_stubs.html');
      const bets = parseDraftKings(html);
      
      expect(bets.length).toBe(6);
    });
  });

  describe('FanDuel parser', () => {
    it('parses SGP sample and returns Bet[] with required fields', () => {
      const html = loadFixture('parsing/fanduel/fixtures/sgp_sample.html');
      const bets = parseFanDuel(html);
      
      // Should find bets
      expect(bets.length).toBeGreaterThan(0);
      
      // Every bet should have required fields
      bets.forEach((bet, index) => {
        expect(bet.id, `bet[${index}].id`).toBeTruthy();
        expect(bet.betId, `bet[${index}].betId`).toBeTruthy();
        expect(bet.book, `bet[${index}].book`).toBe('FanDuel');
        expect(bet.placedAt, `bet[${index}].placedAt`).toBeTruthy();
        expect(typeof bet.stake, `bet[${index}].stake`).toBe('number');
        expect(bet.stake, `bet[${index}].stake >= 0`).toBeGreaterThanOrEqual(0);
        expect(['win', 'loss', 'push', 'pending'], `bet[${index}].result`).toContain(bet.result);
        expect(['single', 'parlay', 'sgp', 'sgp_plus', 'live', 'other'], `bet[${index}].betType`).toContain(bet.betType);
      });
    });

    it('parsed FanDuel bets pass validation gate', () => {
      const html = loadFixture('parsing/fanduel/fixtures/sgp_sample.html');
      const bets = parseFanDuel(html);
      
      const summary = validateBetsForImport(bets);
      
      // All parsed bets should be valid (no blockers)
      expect(summary.betsWithBlockers).toBe(0);
      expect(summary.validBets.length).toBe(bets.length);
    });

    // Deterministic count assertion to catch regressions.
    // Expected count: 1 bet from sgp_sample.html
    // Update this value if the fixture is intentionally modified.
    it('parses expected number of bets from fixture (regression guard)', () => {
      const html = loadFixture('parsing/fanduel/fixtures/sgp_sample.html');
      const bets = parseFanDuel(html);
      
      expect(bets.length).toBe(1);
    });
  });
});

describe('Import Pipeline - Display Transform', () => {
  describe('betToFinalRows stability', () => {
    it('transforms single bet to FinalRow with required fields', () => {
      const singleBet: Bet = {
        id: 'single-test-1',
        book: 'FanDuel',
        betId: 'SINGLE123',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'LeBron James Points',
        name: 'LeBron James',
        odds: -110,
        stake: 10.0,
        payout: 19.09,
        result: 'win',
        type: 'Pts',
        line: '25.5',
        ou: 'Over',
      };

      const rows = betToFinalRows(singleBet);

      // Should produce exactly 1 row for single bet
      expect(rows).toHaveLength(1);

      // Required fields should be present
      const row = rows[0];
      expect(row.Date).toBeTruthy();
      expect(row.Site).toBe('FanDuel');
      expect(row.Sport).toBe('NBA');
      expect(row.Name).toBe('LeBron James');
      expect(row.Result).toBe('Win');
      expect(row.Bet).toBe('10.00');
      expect(row.Net).toBe('9.09'); // win: payout - stake
      
      // Parlay metadata for single should be null/false
      expect(row._isParlayHeader).toBe(false);
      expect(row._isParlayChild).toBe(false);
    });

    it('transforms parlay bet to FinalRow header + leg rows', () => {
      const parlayBet: Bet = {
        id: 'parlay-test-1',
        book: 'DraftKings',
        betId: 'PARLAY123',
        placedAt: '2024-11-18T19:00:00.000Z',
        betType: 'parlay',
        marketCategory: 'Parlays',
        sport: 'NBA',
        description: 'Multi-leg parlay',
        odds: 500,
        stake: 5.0,
        payout: 30.0,
        result: 'win',
        legs: [
          {
            entities: ['LeBron James'],
            market: 'Pts',
            target: '25.5',
            ou: 'Over',
            result: 'WIN',
          },
          {
            entities: ['Stephen Curry'],
            market: '3pt',
            target: '4.5',
            ou: 'Over',
            result: 'WIN',
          },
        ],
      };

      const rows = betToFinalRows(parlayBet);

      // Should produce header + 2 leg rows
      expect(rows).toHaveLength(3);

      // Header row
      expect(rows[0]._isParlayHeader).toBe(true);
      expect(rows[0].Name).toContain('Parlay');
      expect(rows[0].Category).toBe('Parlays');
      expect(rows[0].Bet).toBe('5.00');
      expect(rows[0].Result).toBe('Win');

      // Leg rows
      expect(rows[1]._isParlayChild).toBe(true);
      expect(rows[1].Name).toBe('LeBron James');
      expect(rows[1].Bet).toBe(''); // Leg rows don't show bet amount

      expect(rows[2]._isParlayChild).toBe(true);
      expect(rows[2].Name).toBe('Stephen Curry');
    });
  });
});

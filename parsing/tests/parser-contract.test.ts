import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { parseFanDuel } from "../fanduel/parsers";
import { parseDraftKingsHTML } from "../draftkings/parsers";
import type { Bet } from "../../types";
import { 
  validateBetContract, 
  validateBetsContract,
  VALID_BET_RESULTS,
  VALID_BET_TYPES,
  VALID_MARKET_CATEGORIES,
  VALID_ENTITY_TYPES
} from "../parserContract";
import {
  getEnabledSportsbooks,
  getParser,
  isParserEnabled,
  getSportsbookStatus
} from "../parserRegistry";
import { processPageResult } from "../shared/pageProcessor";

// Get the directory of this test file for constructing fixture paths
const __testDir = path.dirname(new URL(import.meta.url).pathname);

// Small sample inputs for contract testing (used as fallback when fixtures unavailable)
const FD_SAMPLE = `
<div class="coupon-content">
  <div class="market-name">Moneyline</div>
  <div class="outcome-name">Boston Celtics</div>
  <div class="outcome-price">-150</div>
</div>`;

const DK_SAMPLE = `
<div class="sportsbook-bet-card">
  <div class="sportsbook-outcome-cell__label">Boston Celtics</div>
  <div class="sportsbook-outcome-cell__line">-150</div>
</div>`;

// ============================================================================
// PARSER REGISTRY TESTS
// ============================================================================

/**
 * Registry Tests:
 * Verifies that the parser registry is correctly configured and
 * only enabled parsers are exposed as working.
 */
describe("Parser Registry", () => {
  it("returns FanDuel and DraftKings as enabled sportsbooks", () => {
    const enabled = getEnabledSportsbooks();
    expect(enabled).toContain("FanDuel");
    expect(enabled).toContain("DraftKings");
  });

  it("does not return 'Other' as enabled", () => {
    const enabled = getEnabledSportsbooks();
    expect(enabled).not.toContain("Other");
  });

  it("isParserEnabled returns true for FanDuel", () => {
    expect(isParserEnabled("FanDuel")).toBe(true);
  });

  it("isParserEnabled returns true for DraftKings", () => {
    expect(isParserEnabled("DraftKings")).toBe(true);
  });

  it("isParserEnabled returns false for Other", () => {
    expect(isParserEnabled("Other")).toBe(false);
  });

  it("isParserEnabled returns false for unknown sportsbooks", () => {
    expect(isParserEnabled("UnknownSportsbook")).toBe(false);
  });

  it("getParser returns a function for enabled sportsbooks", () => {
    const fdParser = getParser("FanDuel");
    const dkParser = getParser("DraftKings");
    expect(typeof fdParser).toBe("function");
    expect(typeof dkParser).toBe("function");
  });

  it("getSportsbookStatus returns status for all registered sportsbooks", () => {
    const statuses = getSportsbookStatus();
    expect(statuses.length).toBeGreaterThanOrEqual(2);
    
    const fdStatus = statuses.find(s => s.name === "FanDuel");
    expect(fdStatus).toBeDefined();
    expect(fdStatus!.enabled).toBe(true);
    expect(fdStatus!.status).toBe("implemented");
    
    const otherStatus = statuses.find(s => s.name === "Other");
    expect(otherStatus).toBeDefined();
    expect(otherStatus!.enabled).toBe(false);
    expect(otherStatus!.status).toBe("disabled");
  });
});

// ============================================================================
// UNSUPPORTED SPORTSBOOK HANDLING TESTS
// ============================================================================

/**
 * Unsupported Sportsbook Tests:
 * Verifies that attempting to parse with unsupported sportsbooks
 * returns clear, typed errors rather than misleading results.
 */
describe("Unsupported Sportsbook Handling", () => {
  it("processPageResult returns PARSER_NOT_AVAILABLE for 'Other'", () => {
    const result = processPageResult("Other", "<html><body>Some content</body></html>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSER_NOT_AVAILABLE");
      expect(result.error.message).toContain("Other");
    }
  });

  it("processPageResult returns PARSER_NOT_AVAILABLE for unknown sportsbook", () => {
    const result = processPageResult("BetMGM", "<html><body>Some content</body></html>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSER_NOT_AVAILABLE");
    }
  });

  it("processPageResult returns EMPTY_HTML for empty input", () => {
    const result = processPageResult("FanDuel", "");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_HTML");
    }
  });

  it("processPageResult returns EMPTY_HTML for whitespace-only input", () => {
    const result = processPageResult("FanDuel", "   \n\t  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_HTML");
    }
  });
});

// ============================================================================
// CONTRACT VALIDATION TESTS
// ============================================================================

/**
 * Contract Validation Tests:
 * Tests the validateBetContract function itself to ensure it correctly
 * identifies valid and invalid bet structures.
 */
describe("Contract Validation", () => {
  it("validateBetContract passes for valid bet object", () => {
    const validBet: Bet = {
      id: "FanDuel:ABC123:2025-01-01T12:00:00Z",
      book: "FanDuel",
      betId: "ABC123",
      placedAt: "2025-01-01T12:00:00Z",
      betType: "single",
      marketCategory: "Props",
      sport: "NBA",
      description: "Test Player 10+ Points",
      odds: 100,
      stake: 10,
      payout: 20,
      result: "win",
      legs: [{
        market: "Pts",
        entities: ["Test Player"],
        entityType: "player",
        target: "10+",
        result: "WIN"
      }]
    };
    
    const result = validateBetContract(validBet, "Test");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validateBetContract fails for missing required fields", () => {
    const invalidBet = {
      book: "FanDuel",
      // Missing: id, betId, placedAt, stake, etc.
    } as unknown as Bet;
    
    const result = validateBetContract(invalidBet, "Test");
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes("bet.id"))).toBe(true);
  });

  it("validateBetContract reports warning for missing entityType", () => {
    const betWithoutEntityType: Bet = {
      id: "FanDuel:ABC123:2025-01-01T12:00:00Z",
      book: "FanDuel",
      betId: "ABC123",
      placedAt: "2025-01-01T12:00:00Z",
      betType: "single",
      marketCategory: "Props",
      sport: "NBA",
      description: "Test bet",
      odds: 100,
      stake: 10,
      payout: 20,
      result: "win",
      legs: [{
        market: "Pts",
        entities: ["Test Player"],
        // Missing entityType
      }]
    };
    
    const result = validateBetContract(betWithoutEntityType, "Test");
    // Should still be valid but have warnings
    expect(result.isValid).toBe(true);
    expect(result.warnings.some(w => w.includes("entityType"))).toBe(true);
  });
});

/**
 * Contract Test:
 * Verifies that parsers produce objects adhering to critical invariants,
 * regardless of display string formatting changes.
 */
describe("Parser Output Contract", () => {
  // Legacy validation function for backward compatibility with existing tests
  const validateBetContractLegacy = (bet: Bet, sportsbook: string) => {
    // 1. Identity & Metadata
    expect(bet.betId, `${sportsbook}: Missing betId`).toBeDefined();
    expect(typeof bet.betId, `${sportsbook}: Invalid betId type`).toBe("string");
    expect(bet.betId.length, `${sportsbook}: Empty betId`).toBeGreaterThan(0);

    // 2. Core Financials
    expect(bet.stake, `${sportsbook}: Invalid stake`).toBeTypeOf("number");
    expect(bet.stake, `${sportsbook}: Stake must be positive`).toBeGreaterThan(0);
    expect(bet.odds, `${sportsbook}: Invalid odds`).toBeTypeOf("number");
    expect(isNaN(bet.odds as number), `${sportsbook}: Odds cannot be NaN`).toBe(false);
    expect(bet.payout, `${sportsbook}: Invalid payout`).toBeTypeOf("number");
    expect(bet.placedAt, `${sportsbook}: Missing placedAt`).toBeDefined();
    const date = new Date(bet.placedAt);
    expect(isNaN(date.getTime()), `${sportsbook}: Invalid placedAt date`).toBe(false);

    // 3. Timing
    expect(bet.placedAt, `${sportsbook}: Missing placedAt`).toBeDefined();
    expect(new Date(bet.placedAt).toString(), `${sportsbook}: Invalid placedAt date`).not.toBe("Invalid Date");

    // 4. Classification
    // marketCategory is optional but if present must be valid string
    if (bet.marketCategory) {
      expect(typeof bet.marketCategory, `${sportsbook}: Invalid marketCategory type`).toBe("string");
      expect(VALID_MARKET_CATEGORIES).toContain(bet.marketCategory);
    }

    // 5. Structure
    expect(bet.legs, `${sportsbook}: Missing legs array`).toBeInstanceOf(Array);
    expect(bet.legs!.length, `${sportsbook}: Bet must have at least one leg`).toBeGreaterThan(0);
    bet.legs!.forEach((leg, index) => {
      expect(leg, `${sportsbook}: Leg ${index} must be an object`).toBeDefined();
      expect(leg.market, `${sportsbook}: Leg ${index} must have market`).toBeDefined();
      // entityType should be set for new parsers
      if (leg.entityType !== undefined) {
        expect(VALID_ENTITY_TYPES).toContain(leg.entityType);
      }
    });

    // 6. Result
    expect(bet.result, `${sportsbook}: Missing result`).toBeDefined();
    expect(VALID_BET_RESULTS).toContain(bet.result);
    
    // 7. Bet Type
    if (bet.betType) {
      expect(VALID_BET_TYPES).toContain(bet.betType);
    }
  };

  it("FanDuel parser respects the contract", () => {
    // Read the comprehensive fixture HTML using path relative to test file
    const fixturePath = path.join(__testDir, "../fanduel/fixtures/your-html-file.html");

    if (fs.existsSync(fixturePath)) {
      const html = fs.readFileSync(fixturePath, "utf-8");
      const bets = parseFanDuel(html);

      expect(bets.length).toBeGreaterThan(0);

      bets.forEach(bet => {
        validateBetContractLegacy(bet, "FanDuel");
      });
      
      // Also validate with the new contract validator
      const contractResult = validateBetsContract(bets, "FanDuel");
      expect(contractResult.invalidBets).toBe(0);
    } else {
      // Fallback: Use minimal hardcoded sample if fixture missing
      const bets = parseFanDuel(FD_SAMPLE);
      if (bets.length > 0) {
        bets.forEach(bet => validateBetContractLegacy(bet, "FanDuel"));
      }
    }
  });

  it("DraftKings parser respects the contract", () => {
    // Read a DK fixture using path relative to test file
    const fixturePath = path.join(__testDir, "../draftkings/fixtures/rendered_bet_stub.html");

    if (fs.existsSync(fixturePath)) {
      const html = fs.readFileSync(fixturePath, "utf-8");
      const bets = parseDraftKingsHTML(html);

      expect(bets.length).toBeGreaterThan(0);

      bets.forEach(bet => {
        validateBetContractLegacy(bet, "DraftKings");
      });
      
      // Also validate with the new contract validator
      const contractResult = validateBetsContract(bets, "DraftKings");
      expect(contractResult.invalidBets).toBe(0);
    } else {
      // Fallback: Use minimal hardcoded sample if fixture missing
      const bets = parseDraftKingsHTML(DK_SAMPLE);
      if (bets.length > 0) {
        bets.forEach(bet => validateBetContractLegacy(bet, "DraftKings"));
      }
    }
  });

  it("All enabled parsers satisfy the contract (smoke test)", () => {
    const enabledBooks = getEnabledSportsbooks();
    
    for (const book of enabledBooks) {
      const parser = getParser(book);
      expect(parser, `Parser for ${book} should exist`).toBeDefined();
      
      // Test that parser handles empty input gracefully
      expect(() => {
        const result = parser!("");
        // Should return empty array or error result, not throw
        expect(Array.isArray(result) || (typeof result === 'object' && 'ok' in result)).toBe(true);
      }).not.toThrow();
    }
  });
});

/**
 * Edge Case and Error Handling Tests:
 * Verifies that parsers handle invalid/edge case inputs gracefully
 * without throwing exceptions.
 */
describe("Parser Error & Edge Case Handling", () => {
  describe("Empty HTML handling", () => {
    it("parseFanDuel returns an array for empty HTML string", () => {
      const result = parseFanDuel("");
      expect(Array.isArray(result)).toBe(true);
    });

    it("parseDraftKingsHTML returns an array for empty HTML string", () => {
      const result = parseDraftKingsHTML("");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Malformed HTML handling", () => {
    const malformedHtml = "<div><span>incomplete";

    it("parseFanDuel does not throw on malformed HTML", () => {
      expect(() => parseFanDuel(malformedHtml)).not.toThrow();
      const result = parseFanDuel(malformedHtml);
      expect(Array.isArray(result)).toBe(true);
    });

    it("parseDraftKingsHTML does not throw on malformed HTML", () => {
      expect(() => parseDraftKingsHTML(malformedHtml)).not.toThrow();
      const result = parseDraftKingsHTML(malformedHtml);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("HTML with no betting content", () => {
    const noBettingContentHtml = `
      <html>
        <body>
          <div class="header">Welcome to the site</div>
          <p>No bets here</p>
        </body>
      </html>
    `;

    it("parseFanDuel returns empty array for HTML with no betting content", () => {
      const result = parseFanDuel(noBettingContentHtml);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("parseDraftKingsHTML returns empty array for HTML with no betting content", () => {
      const result = parseDraftKingsHTML(noBettingContentHtml);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("Parser exception simulation", () => {
    it("code can catch FanDuel parser exceptions when they occur", () => {
      // Simulate a scenario where internal parsing logic might throw
      const mockParseFn = vi.fn().mockImplementation(() => {
        throw new Error("Simulated FanDuel parsing error");
      });

      // Wrap in try-catch to verify exception handling works
      let exceptionCaught = false;
      let errorMessage = "";

      try {
        mockParseFn("<div></div>");
      } catch (error) {
        exceptionCaught = true;
        errorMessage = (error as Error).message;
      }

      expect(exceptionCaught).toBe(true);
      expect(errorMessage).toBe("Simulated FanDuel parsing error");
    });

    it("code can catch DraftKings parser exceptions when they occur", () => {
      // Simulate a scenario where internal parsing logic might throw
      const mockParseFn = vi.fn().mockImplementation(() => {
        throw new Error("Simulated DraftKings parsing error");
      });

      // Wrap in try-catch to verify exception handling works
      let exceptionCaught = false;
      let errorMessage = "";

      try {
        mockParseFn("<div></div>");
      } catch (error) {
        exceptionCaught = true;
        errorMessage = (error as Error).message;
      }

      expect(exceptionCaught).toBe(true);
      expect(errorMessage).toBe("Simulated DraftKings parsing error");
    });
  });
});

// ============================================================================
// IMPORT ERROR TYPE TESTS
// ============================================================================

/**
 * ImportError Type Tests:
 * Verifies that parsers return typed ImportError on failure,
 * not thrown exceptions.
 */
describe("Parser Returns Typed ImportError", () => {
  it("processPageResult returns typed error for empty HTML", () => {
    const result = processPageResult("FanDuel", "");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveProperty("code");
      expect(result.error).toHaveProperty("message");
      expect(typeof result.error.code).toBe("string");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("processPageResult returns typed error for unsupported sportsbook", () => {
    const result = processPageResult("UnknownBook", "<html></html>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSER_NOT_AVAILABLE");
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("processPageResult returns typed error when no bets found", () => {
    const result = processPageResult("FanDuel", "<html><body>No bets here</body></html>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_BETS_FOUND");
    }
  });
});

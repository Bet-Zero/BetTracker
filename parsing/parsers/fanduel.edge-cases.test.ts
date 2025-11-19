import { describe, it, expect } from 'vitest';
import { parse } from './fanduel';

describe('FanDuel Parser - Edge Cases', () => {
  it('should handle empty HTML', () => {
    const bets = parse('');
    expect(bets).toHaveLength(0);
  });

  it('should handle HTML with no bets', () => {
    const html = '<html><body><div>No bets here</div></body></html>';
    const bets = parse(html);
    expect(bets).toHaveLength(0);
  });

  it('should handle bet card missing odds aria-label', () => {
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: TEST123</span>
              <span>+150</span>
              <div>$10.00 TOTAL WAGER</div>
              <div>$25.00 RETURNED</div>
              <div>PLACED: 11/19/2025 12:00PM ET</div>
              <span>Player Name, 10+ Points</span>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    // Should still parse even without aria-label
    expect(bets).toHaveLength(1);
  });

  it('should handle bet card with missing wager/returned amounts', () => {
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: TEST456</span>
              <span aria-label="Odds +200">+200</span>
              <div>PLACED: 11/19/2025 12:00PM ET</div>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    // Should still parse with 0 stake/payout
    expect(bets).toHaveLength(1);
    if (bets.length > 0) {
      expect(bets[0].stake).toBe(0);
      expect(bets[0].payout).toBe(0);
    }
  });

  it('should handle malformed date strings', () => {
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: TEST789</span>
              <span aria-label="Odds +100">+100</span>
              <div>$5.00 TOTAL WAGER</div>
              <div>$10.00 RETURNED</div>
              <div>PLACED: Invalid Date</div>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    expect(bets).toHaveLength(1);
    if (bets.length > 0) {
      // Should fall back to current date
      expect(bets[0].placedAt).toBeDefined();
    }
  });

  it('should handle bet cards with no player names', () => {
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: TEST999</span>
              <span aria-label="Odds -110">-110</span>
              <div>$20.00 TOTAL WAGER</div>
              <div>$38.18 RETURNED</div>
              <div>PLACED: 11/19/2025 3:00PM ET</div>
              <span>Golden State Warriors</span>
              <span>Moneyline</span>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    expect(bets).toHaveLength(1);
    // Should not extract legs if no player names found
  });

  it('should handle different odds formats', () => {
    // Test with odds that don't have + sign
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: TEST111</span>
              <span aria-label="Odds -150">-150</span>
              <div>$10.00 TOTAL WAGER</div>
              <div>$16.67 RETURNED</div>
              <div>PLACED: 11/19/2025 12:00PM ET</div>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    expect(bets).toHaveLength(1);
    if (bets.length > 0) {
      expect(bets[0].odds).toBe(-150);
    }
  });

  it('should deduplicate duplicate bet IDs', () => {
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: DUPLICATE</span>
              <span aria-label="Odds +100">+100</span>
              <div>$10.00 TOTAL WAGER</div>
              <div>$20.00 RETURNED</div>
              <div>PLACED: 11/19/2025 12:00PM ET</div>
            </div>
          </li>
          <li>
            <div>
              <span>BET ID: DUPLICATE</span>
              <span aria-label="Odds +100">+100</span>
              <div>$10.00 TOTAL WAGER</div>
              <div>$20.00 RETURNED</div>
              <div>PLACED: 11/19/2025 12:00PM ET</div>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    // Should only return 1 bet, not 2
    expect(bets).toHaveLength(1);
  });

  it('should handle push results correctly', () => {
    const html = `
      <main class="t h" id="main">
        <ul>
          <li>
            <div>
              <span>BET ID: PUSH123</span>
              <span aria-label="Odds +100">+100</span>
              <div>$10.00 TOTAL WAGER</div>
              <div>$10.00 RETURNED</div>
              <div>PLACED: 11/19/2025 12:00PM ET</div>
            </div>
          </li>
        </ul>
      </main>
    `;
    const bets = parse(html);
    expect(bets).toHaveLength(1);
    if (bets.length > 0) {
      expect(bets[0].result).toBe('push');
      expect(bets[0].stake).toBe(10.00);
      expect(bets[0].payout).toBe(10.00);
    }
  });

  it('should handle HTML without proper structure (plain text)', () => {
    // User accidentally copies visible text instead of HTML source
    const text = 'BET ID: TEST999 $50.00 TOTAL WAGER Golden State Warriors';
    const bets = parse(text);
    // Should return empty array with error message
    expect(bets).toHaveLength(0);
  });

  it('should handle HTML from wrong page (no BET IDs)', () => {
    const html = `
      <html>
        <body>
          <h1>Welcome to FanDuel</h1>
          <p>Place your bets!</p>
          <button>Login</button>
        </body>
      </html>
    `;
    const bets = parse(html);
    // Should return empty array with warning
    expect(bets).toHaveLength(0);
  });

  it('should handle extremely minimal bet card', () => {
    // Absolute minimum structure with just BET ID
    const html = `
      <html>
        <body>
          <div>BET ID: MINIMAL123</div>
        </body>
      </html>
    `;
    const bets = parse(html);
    // Parser requires proper bet card structure, so minimal HTML won't parse
    // This is expected behavior - better to return nothing than incorrect data
    expect(bets).toHaveLength(0);
  });
});

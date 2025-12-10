/**
 * Test script to debug FanDuel parser with real HTML
 * Usage: npx tsx test-fanduel-parser.ts [path-to-html-file]
 */

import { readFileSync, existsSync } from 'fs';
import { JSDOM } from 'jsdom';
import { parseFanDuel } from './parsing/parsers/fanduel';

// Set up DOM environment
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;

// Enable debug mode
const htmlPath = process.argv[2];

if (!htmlPath || !existsSync(htmlPath)) {
  console.error('❌ Please provide a valid HTML file path');
  console.error('Usage: npx tsx test-fanduel-parser.ts <path-to-html>');
  process.exit(1);
}

console.log(`Reading HTML from: ${htmlPath}\n`);
const html = readFileSync(htmlPath, 'utf-8');

console.log(`HTML length: ${html.length} characters\n`);

// Enable debug by temporarily modifying the parser
// We'll need to enable FD_DEBUG in the parser file first
console.log('=== Parsing with debug enabled ===\n');

const bets = parseFanDuel(html);

console.log(`\n=== Results ===`);
console.log(`Total bets parsed: ${bets.length}\n`);

if (bets.length === 0) {
  console.log('❌ No bets were parsed!');
  console.log('\nChecking HTML structure...\n');
  
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ul = doc.querySelector('ul.t.h.di') ?? doc.querySelector('ul');
  console.log(`UL found: ${ul ? 'YES' : 'NO'}`);
  
  if (ul) {
    const lis = Array.from(ul.querySelectorAll('li'));
    console.log(`Total <li> elements: ${lis.length}`);
    const betIdLis = lis.filter(li => (li.textContent ?? '').includes('BET ID:'));
    console.log(`<li> with "BET ID:": ${betIdLis.length}`);
  }
  
  process.exit(1);
}

// Analyze the parsed bets
console.log('=== Bet Analysis ===\n');

const issues: string[] = [];
const byType: Record<string, number> = {};
const byResult: Record<string, number> = {};

bets.forEach((bet, i) => {
  // Count by type
  byType[bet.betType] = (byType[bet.betType] || 0) + 1;
  byResult[bet.result] = (byResult[bet.result] || 0) + 1;
  
  // Check for issues
  if (!bet.betId) issues.push(`Bet ${i}: Missing betId`);
  if (!bet.description || bet.description.trim() === '') {
    issues.push(`Bet ${i} (${bet.betId}): Missing description`);
  }
  if (bet.odds === 0 && bet.betType !== 'parlay' && bet.betType !== 'sgp') {
    issues.push(`Bet ${i} (${bet.betId}): Odds is 0`);
  }
  if (bet.stake === 0) {
    issues.push(`Bet ${i} (${bet.betId}): Stake is 0`);
  }
  if (bet.payout === null || bet.payout === undefined) {
    issues.push(`Bet ${i} (${bet.betId}): Payout is null/undefined`);
  }
});

console.log('Bet types:', byType);
console.log('Results:', byResult);

if (issues.length > 0) {
  console.log(`\n⚠️  Found ${issues.length} potential issues:`);
  issues.slice(0, 10).forEach(issue => console.log(`  - ${issue}`));
  if (issues.length > 10) {
    console.log(`  ... and ${issues.length - 10} more`);
  }
} else {
  console.log('\n✅ No obvious issues found');
}

// Show sample bets
console.log('\n=== Sample Bets (first 5) ===\n');
bets.slice(0, 5).forEach((bet, i) => {
  console.log(`Bet ${i + 1}:`);
  console.log(`  ID: ${bet.betId}`);
  console.log(`  Type: ${bet.betType}`);
  console.log(`  Description: ${bet.description || '(empty)'}`);
  console.log(`  Odds: ${bet.odds}`);
  console.log(`  Stake: $${bet.stake}`);
  console.log(`  Payout: $${bet.payout ?? 'null'}`);
  console.log(`  Result: ${bet.result}`);
  console.log(`  Market: ${bet.type || '(none)'}`);
  console.log(`  Name: ${bet.name || '(none)'}`);
  console.log(`  Line: ${bet.line || '(none)'}`);
  console.log('');
});


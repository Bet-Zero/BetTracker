/**
 * Test script to debug parser issues (v2)
 */
import { readFileSync } from 'fs';
import { parse } from './parsers/fanduel-v2';

const fixturePath = './parsing/fixtures/fanduel_single_example.html';
const html = readFileSync(fixturePath, 'utf-8');

console.log('Testing FanDuel parser V2 with fixture...');
console.log(`HTML length: ${html.length}`);

const results = parse(html);
console.log(`\nFound ${results.length} bets:`);
results.forEach((bet, i) => {
  console.log(`\nBet ${i + 1}:`);
  console.log(JSON.stringify(bet, null, 2));
});


/**
 * Test script to debug parser issues
 */
import { readFileSync } from 'fs';
import { parse } from './parsers/fanduel';

const fixturePath = './parsing/fixtures/fanduel_single_example.html';
const html = readFileSync(fixturePath, 'utf-8');

console.log('Testing FanDuel parser with fixture...');
console.log(`HTML length: ${html.length}`);

const results = parse(html);
console.log(`\nFound ${results.length} bets:`);
results.forEach((row, i) => {
  console.log(`\nBet ${i + 1}:`);
  console.log(JSON.stringify(row, null, 2));
});


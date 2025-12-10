import { readFileSync, existsSync } from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get HTML file path from command line or try defaults
const htmlPathArg = process.argv[2];
const possiblePaths = htmlPathArg 
  ? [htmlPathArg]
  : [
      join(__dirname, 'data', 'fanduel_sample.html'),
      join(__dirname, 'fanduel_real.html'),
      join(__dirname, 'real-fanduel.html'),
      join(__dirname, '..', 'data', 'fanduel_sample.html'),
    ];

let htmlPath: string | null = null;
for (const path of possiblePaths) {
  try {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      if (content.trim().length > 0) {
        htmlPath = path;
        break;
      }
    }
  } catch {
    // Continue
  }
}

if (!htmlPath) {
  console.error('❌ Could not find a valid HTML file.');
  console.error('\nUsage: npx tsx debug-fanduel-structure.ts [path-to-html-file]');
  console.error('\nOr place your HTML file in one of these locations:');
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

console.log(`Reading HTML from: ${htmlPath}`);
const html = readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const doc = dom.window.document;

// Check for the main container
const ul = doc.querySelector('ul.t.h.di') ?? doc.querySelector('ul');
console.log('\n=== Container Check ===');
console.log('Found UL:', ul ? 'YES' : 'NO');
if (ul) {
  console.log('UL classes:', ul.className);
  console.log('UL tag:', ul.tagName);
} else {
  console.log('ERROR: No UL found!');
  process.exit(1);
}

// Check for list items
const lis = Array.from(doc.querySelectorAll('li'));
console.log(`\n=== List Items ===`);
console.log(`Total <li> elements: ${lis.length}`);

// Check for BET ID patterns
const betIdLis = lis.filter(li => 
  (li.textContent ?? '').includes('BET ID:')
);
console.log(`<li> with "BET ID:": ${betIdLis.length}`);

if (betIdLis.length === 0) {
  console.log('\n⚠️  WARNING: No footers found with "BET ID:" pattern');
  console.log('Checking for alternative patterns...');
  
  // Try other patterns
  const altPatterns = ['BET ID', 'bet id', 'Bet ID', 'BetId'];
  for (const pattern of altPatterns) {
    const matches = lis.filter(li => 
      (li.textContent ?? '').includes(pattern)
    );
    if (matches.length > 0) {
      console.log(`  Found ${matches.length} with pattern "${pattern}"`);
    }
  }
}

// Sample a few footers
console.log('\n=== Sample Footer Structures ===');
betIdLis.slice(0, 3).forEach((li, i) => {
  const text = li.textContent?.substring(0, 300) || '';
  console.log(`\nFooter ${i + 1}:`);
  console.log(`  Text preview: ${text.replace(/\s+/g, ' ')}`);
  console.log(`  Has "TOTAL WAGER": ${text.includes('TOTAL WAGER')}`);
  console.log(`  Has "WON ON FANDUEL": ${text.includes('WON ON FANDUEL')}`);
  console.log(`  Has "RETURNED": ${text.includes('RETURNED')}`);
  
  // Check structure
  const spans = Array.from(li.querySelectorAll('span'));
  console.log(`  Total spans: ${spans.length}`);
  const totalWagerSpan = spans.find(s => 
    s.textContent?.trim().toUpperCase() === 'TOTAL WAGER'
  );
  console.log(`  Found "TOTAL WAGER" span: ${totalWagerSpan ? 'YES' : 'NO'}`);
  
  if (totalWagerSpan) {
    const container = totalWagerSpan.parentElement?.parentElement;
    console.log(`  Container structure:`, container?.tagName, container?.className);
    const amountDiv = container?.querySelector('div');
    const amountSpan = amountDiv?.querySelector('span');
    console.log(`  Amount span found: ${amountSpan ? 'YES' : 'NO'}`);
    if (amountSpan) {
      console.log(`  Amount text: "${amountSpan.textContent}"`);
    }
  }
  
  // Check for bet ID extraction
  const betIdMatch = text.match(/BET ID:\s*([A-Z0-9/]+)/i);
  console.log(`  Bet ID match: ${betIdMatch ? betIdMatch[1] : 'NOT FOUND'}`);
});

// Check for headers (look for odds patterns)
console.log('\n=== Sample Header Structures ===');
const headerCandidates = lis.filter(li => {
  const text = li.textContent || '';
  return !text.includes('BET ID:') && 
         !text.includes('TOTAL WAGER') &&
         (text.includes('+') || text.includes('-')) &&
         /\d{3,}/.test(text); // Has 3+ digit numbers (odds)
});

console.log(`Found ${headerCandidates.length} header candidates`);

headerCandidates.slice(0, 3).forEach((li, i) => {
  const text = li.textContent?.substring(0, 300) || '';
  console.log(`\nHeader candidate ${i + 1}:`);
  console.log(`  Text preview: ${text.replace(/\s+/g, ' ')}`);
  
  // Check for aria-label
  const ariaLabel = li.querySelector('[aria-label]');
  console.log(`  Has aria-label: ${ariaLabel ? 'YES' : 'NO'}`);
  if (ariaLabel) {
    const ariaText = ariaLabel.getAttribute('aria-label')?.substring(0, 150) || '';
    console.log(`  Aria-label: ${ariaText}`);
  }
  
  // Check for odds span
  const oddsSpan = li.querySelector('span[aria-label^="Odds"]');
  console.log(`  Has odds span: ${oddsSpan ? 'YES' : 'NO'}`);
  if (oddsSpan) {
    console.log(`  Odds text: "${oddsSpan.textContent}"`);
  }
  
  // Check for parlay text
  const hasParlay = text.toLowerCase().includes('parlay') || text.toLowerCase().includes('leg');
  console.log(`  Has parlay text: ${hasParlay}`);
});

// Check header/footer relationships
console.log('\n=== Header/Footer Relationships ===');
if (betIdLis.length > 0 && headerCandidates.length > 0) {
  const firstFooter = betIdLis[0];
  const footerIndex = lis.indexOf(firstFooter);
  console.log(`First footer at index: ${footerIndex}`);
  
  if (footerIndex > 0) {
    const prevLi = lis[footerIndex - 1];
    console.log(`Previous LI (index ${footerIndex - 1}):`);
    const prevText = prevLi.textContent?.substring(0, 200) || '';
    console.log(`  Text: ${prevText.replace(/\s+/g, ' ')}`);
    console.log(`  Is header candidate: ${headerCandidates.includes(prevLi)}`);
  }
}

console.log('\n=== Summary ===');
console.log(`Total bets expected: ~80`);
console.log(`Footers found: ${betIdLis.length}`);
console.log(`Header candidates: ${headerCandidates.length}`);
console.log(`\nStatus: ${betIdLis.length > 0 ? '✅ Found footers' : '❌ No footers found'}`);


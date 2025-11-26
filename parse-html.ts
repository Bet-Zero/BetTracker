import { readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { parseFanDuel } from './parsing/parsers/fanduel';

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;

const html = readFileSync('your-html-file.html', 'utf-8');
const bets = parseFanDuel(html);
writeFileSync('your-html-file_parsed_new.json', JSON.stringify(bets, null, 2));
console.log('Parsed', bets.length, 'bets to your-html-file_parsed_new.json');

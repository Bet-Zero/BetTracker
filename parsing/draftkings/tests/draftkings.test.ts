import { describe, it, expect, beforeAll } from 'vitest';
import { parseDraftKingsHTML } from '../parsers/index';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

describe('DraftKings Parser', () => {
  beforeAll(() => {
    // Setup JSDOM
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.DOMParser = dom.window.DOMParser;
    global.Element = dom.window.Element;
  });

  it('handles empty HTML gracefully', () => {
    const bets = parseDraftKingsHTML('');
    expect(bets).toEqual([]);
  });

  it('parses a single bet correctly', () => {
    const htmlPath = path.join(__dirname, '../../fixtures/draftkings/rendered_bet_stub.html');
    const jsonPath = path.join(__dirname, '../../fixtures/draftkings/expected_draftkings_bets.json');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsonPath)) {
      console.warn('Skipping test: Fixtures not found. Please ensure rendered_bet_stub.html and expected_draftkings_bets.json exist.');
      return;
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const expected = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    const result = parseDraftKingsHTML(html);
    expect(result).toHaveLength(1);
    
    // Normalize date for comparison if strictly checking strings that might change
    // But since we use static fixtures, direct comparison should work if our parser is deterministic
    expect(result[0]).toEqual(expected[0]);
  });

  it('parses a parlay/SGP bet correctly', () => {
    const htmlPath = path.join(__dirname, '../../fixtures/draftkings/rendered_parlay_stub.html');
    const jsonPath = path.join(__dirname, '../../fixtures/draftkings/expected_draftkings_bets.json');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsonPath)) {
      console.warn('Skipping test: Fixtures not found.');
      return;
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const expected = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // The expected JSON file now contains ARRAY of bets [single, parlay]. 
    // We should parse the parlay stub and compare against expected[1]
    const result = parseDraftKingsHTML(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expected[1]);
  });

  it('parses an SGPx (SGP+) bet correctly', () => {
    const htmlPath = path.join(__dirname, '../../fixtures/draftkings/rendered_sgpx_stub.html');
    const jsonPath = path.join(__dirname, '../../fixtures/draftkings/expected_draftkings_bets.json');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsonPath)) {
      console.warn('Skipping test: Fixtures not found.');
      return;
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const expected = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // expected[2] should correspond to the SGPx bet
    const result = parseDraftKingsHTML(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expected[2]); 
  });
});

import { describe, it, expect } from 'vitest';
import { toLookupKey } from './normalizationService';

describe('toLookupKey', () => {
  describe('basic normalization', () => {
    it('trims leading and trailing whitespace', () => {
      expect(toLookupKey('  Phoenix Suns  ')).toBe('phoenix suns');
    });

    it('collapses internal double spaces', () => {
      expect(toLookupKey('LeBron  James')).toBe('lebron james');
    });

    it('collapses tabs and newlines', () => {
      expect(toLookupKey('LeBron\t\nJames')).toBe('lebron james');
    });

    it('collapses mixed whitespace characters', () => {
      expect(toLookupKey('Los  \t Angeles   Lakers')).toBe('los angeles lakers');
    });

    it('lowercases all characters', () => {
      expect(toLookupKey('PHOENIX SUNS')).toBe('phoenix suns');
      expect(toLookupKey('Phoenix Suns')).toBe('phoenix suns');
      expect(toLookupKey('phoenix suns')).toBe('phoenix suns');
    });
  });

  describe('punctuation preservation', () => {
    it("preserves apostrophes in names", () => {
      expect(toLookupKey("O'Brien")).toBe("o'brien");
      expect(toLookupKey("O'Neal")).toBe("o'neal");
    });

    it('preserves periods', () => {
      expect(toLookupKey('St. Louis Cardinals')).toBe('st. louis cardinals');
      expect(toLookupKey('Jr.')).toBe('jr.');
    });

    it('preserves hyphens', () => {
      expect(toLookupKey('Saint-Étienne')).toBe('saint-étienne');
      expect(toLookupKey('Three-Pointers')).toBe('three-pointers');
    });

    it('preserves other punctuation', () => {
      expect(toLookupKey('A&M')).toBe('a&m');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(toLookupKey('')).toBe('');
    });

    it('returns empty string for null-ish input', () => {
      expect(toLookupKey(null as unknown as string)).toBe('');
      expect(toLookupKey(undefined as unknown as string)).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(toLookupKey('   ')).toBe('');
      expect(toLookupKey('\t\n')).toBe('');
      expect(toLookupKey('  \t  \n  ')).toBe('');
    });

    it('handles single character input', () => {
      expect(toLookupKey('A')).toBe('a');
      expect(toLookupKey(' A ')).toBe('a');
    });
  });

  describe('real-world examples', () => {
    it('normalizes team names with extra whitespace', () => {
      expect(toLookupKey('  Phoenix Suns  ')).toBe('phoenix suns');
      expect(toLookupKey('Los Angeles  Lakers')).toBe('los angeles lakers');
      expect(toLookupKey(' KC Chiefs ')).toBe('kc chiefs');
    });

    it('normalizes player names with extra whitespace', () => {
      expect(toLookupKey('  LeBron James  ')).toBe('lebron james');
      expect(toLookupKey('LeBron  James')).toBe('lebron james');
      expect(toLookupKey("Shaquille  O'Neal")).toBe("shaquille o'neal");
    });

    it('normalizes stat types with extra whitespace', () => {
      expect(toLookupKey('  Points  ')).toBe('points');
      expect(toLookupKey('Pass  Yds')).toBe('pass yds');
    });
  });
});

// ============================================================================
// PHASE 3.3: UNICODE NORMALIZATION + SMART PUNCTUATION HARDENING
// ============================================================================

describe("Phase 3.3: Unicode normalization", () => {
  it("normalizes composed and decomposed accents to same key", () => {
    const composed = "Jokić"; // ć = U+0107
    const decomposed = "Jokic\u0301"; // c + combining acute
    expect(toLookupKey(composed)).toBe(toLookupKey(decomposed));
  });

  it("preserves accents in output (does NOT strip)", () => {
    expect(toLookupKey("Jokić")).toBe("jokić");
    expect(toLookupKey("José")).toBe("josé");
    expect(toLookupKey("José")).not.toBe("jose"); // Would be a bug if accents were stripped
  });

  it("handles various accented characters correctly", () => {
    expect(toLookupKey("Müller")).toBe("müller");
    expect(toLookupKey("Özil")).toBe("özil");
    expect(toLookupKey("Piñata")).toBe("piñata");
  });
});

describe("Phase 3.3: Smart punctuation conversion", () => {
  describe("apostrophes", () => {
    it("converts smart right single quote to ASCII apostrophe", () => {
      // U+2019 → U+0027
      expect(toLookupKey("O\u2019Brien")).toBe("o'brien");
    });

    it("converts smart left single quote to ASCII apostrophe", () => {
      // U+2018 → U+0027
      expect(toLookupKey("O\u2018Brien")).toBe("o'brien");
    });

    it("keeps ASCII apostrophe unchanged", () => {
      expect(toLookupKey("O'Brien")).toBe("o'brien");
    });

    it("unifies smart and ASCII apostrophe variants", () => {
      const ascii = "O'Brien"; // U+0027
      const smart = "O\u2019Brien"; // U+2019 (right single quote)
      expect(toLookupKey(ascii)).toBe(toLookupKey(smart));
    });

    it("handles D'Angelo Russell variants", () => {
      const ascii = "D'Angelo Russell";
      const smartRight = "D\u2019Angelo Russell"; // U+2019
      const smartLeft = "D\u2018Angelo Russell"; // U+2018
      expect(toLookupKey(ascii)).toBe("d'angelo russell");
      expect(toLookupKey(smartRight)).toBe("d'angelo russell");
      expect(toLookupKey(smartLeft)).toBe("d'angelo russell");
      expect(toLookupKey(ascii)).toBe(toLookupKey(smartRight));
    });

    it("converts prime mark to ASCII apostrophe", () => {
      // U+2032 (prime) → U+0027
      expect(toLookupKey("O\u2032Brien")).toBe("o'brien");
    });
  });

  describe("double quotes", () => {
    it("converts smart left double quote to ASCII", () => {
      // U+201C → U+0022
      expect(toLookupKey("\u201CPoints\u201D")).toBe('"points"');
    });

    it("converts smart right double quote to ASCII", () => {
      // U+201D → U+0022
      expect(toLookupKey("\u201DPoints\u201C")).toBe('"points"');
    });

    it("keeps ASCII double quote unchanged", () => {
      expect(toLookupKey('"Points"')).toBe('"points"');
    });
  });

  describe("dashes", () => {
    it("converts em-dash to hyphen", () => {
      // U+2014 → U+002D
      expect(toLookupKey("Lakers \u2014 Total")).toBe("lakers - total");
    });

    it("converts en-dash to hyphen", () => {
      // U+2013 → U+002D
      expect(toLookupKey("Lakers \u2013 Total")).toBe("lakers - total");
    });

    it("converts figure dash to hyphen", () => {
      // U+2012 → U+002D
      expect(toLookupKey("Lakers \u2012 Total")).toBe("lakers - total");
    });

    it("converts minus sign to hyphen", () => {
      // U+2212 → U+002D
      expect(toLookupKey("Lakers \u2212 Total")).toBe("lakers - total");
    });

    it("keeps ASCII hyphen unchanged", () => {
      expect(toLookupKey("Lakers - Total")).toBe("lakers - total");
    });

    it("unifies all dash variants", () => {
      const emDash = "LA Clippers \u2014 Team Total"; // em-dash
      const enDash = "LA Clippers \u2013 Team Total"; // en-dash
      const hyphen = "LA Clippers - Team Total"; // ASCII hyphen
      const figureDash = "LA Clippers \u2012 Team Total"; // figure dash
      const minusSign = "LA Clippers \u2212 Team Total"; // minus sign

      const expected = "la clippers - team total";
      expect(toLookupKey(emDash)).toBe(expected);
      expect(toLookupKey(enDash)).toBe(expected);
      expect(toLookupKey(hyphen)).toBe(expected);
      expect(toLookupKey(figureDash)).toBe(expected);
      expect(toLookupKey(minusSign)).toBe(expected);
    });
  });

  describe("spaces", () => {
    it("converts non-breaking space to regular space", () => {
      // U+00A0 → U+0020
      const nbsp = "LeBron\u00A0James";
      const regular = "LeBron James";
      expect(toLookupKey(nbsp)).toBe(toLookupKey(regular));
      expect(toLookupKey(nbsp)).toBe("lebron james");
    });

    it("converts narrow no-break space to regular space", () => {
      // U+202F → U+0020
      const narrowNbsp = "LeBron\u202FJames";
      expect(toLookupKey(narrowNbsp)).toBe("lebron james");
    });

    it("collapses multiple NBSP to single space", () => {
      const multiNbsp = "LeBron\u00A0\u00A0James";
      expect(toLookupKey(multiNbsp)).toBe("lebron james");
    });
  });
});

describe("Phase 3.3: Regression guardrails", () => {
  it("preserves existing ASCII behavior", () => {
    // All of these must produce identical output to Phase 3.P1
    expect(toLookupKey("  Phoenix Suns  ")).toBe("phoenix suns");
    expect(toLookupKey("LeBron  James")).toBe("lebron james");
    expect(toLookupKey("O'Brien")).toBe("o'brien");
    expect(toLookupKey("St. Louis Cardinals")).toBe("st. louis cardinals");
    expect(toLookupKey("Three-Pointers")).toBe("three-pointers");
    expect(toLookupKey("A&M")).toBe("a&m");
  });

  it("does NOT strip accents", () => {
    expect(toLookupKey("José")).toBe("josé");
    expect(toLookupKey("Jokić")).toBe("jokić");
    expect(toLookupKey("Müller")).not.toBe("muller");
  });

  it("does NOT remove periods", () => {
    expect(toLookupKey("St. Louis")).toBe("st. louis");
    expect(toLookupKey("Jr.")).toBe("jr.");
    expect(toLookupKey("D.J. Moore")).toBe("d.j. moore");
  });

  it("does NOT remove punctuation broadly", () => {
    expect(toLookupKey("O'Brien")).toBe("o'brien");
    expect(toLookupKey("A&M")).toBe("a&m");
    expect(toLookupKey("3-Pointers")).toBe("3-pointers");
  });
});


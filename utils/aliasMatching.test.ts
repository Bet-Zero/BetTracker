import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  matchesOption,
  filterOptionsByQuery,
  formatOptionDisplay,
  findOptionByValue,
  scoreMatch,
  DropdownOption,
} from "./aliasMatching";

describe("normalizeForSearch", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeForSearch("")).toBe("");
    expect(normalizeForSearch(null as any)).toBe("");
    expect(normalizeForSearch(undefined as any)).toBe("");
  });

  it("lowercases and trims", () => {
    expect(normalizeForSearch("  DraftKings  ")).toBe("draftkings");
    expect(normalizeForSearch("NBA")).toBe("nba");
  });

  it("removes punctuation", () => {
    expect(normalizeForSearch("3-Pointers")).toBe("3pointers");
    expect(normalizeForSearch("O'Brien")).toBe("obrien");
    expect(normalizeForSearch("under_score")).toBe("underscore");
  });

  it("normalizes multiple spaces", () => {
    expect(normalizeForSearch("Draft  Kings")).toBe("draft kings");
  });
});

describe("matchesOption", () => {
  const dkOption: DropdownOption = {
    value: "DK",
    label: "DraftKings",
    aliases: ["draftkings", "draft kings", "dk sportsbook"],
  };

  it("matches on value", () => {
    expect(matchesOption("DK", dkOption)).toBe(true);
    expect(matchesOption("dk", dkOption)).toBe(true);
  });

  it("matches on label", () => {
    expect(matchesOption("Draft", dkOption)).toBe(true);
    expect(matchesOption("DraftKings", dkOption)).toBe(true);
  });

  it("matches on aliases", () => {
    expect(matchesOption("draft kings", dkOption)).toBe(true);
    expect(matchesOption("sportsbook", dkOption)).toBe(true);
  });

  it("returns false for non-matching query", () => {
    expect(matchesOption("FanDuel", dkOption)).toBe(false);
    expect(matchesOption("ZZZ", dkOption)).toBe(false);
  });

  it("empty query matches all", () => {
    expect(matchesOption("", dkOption)).toBe(true);
    expect(matchesOption("  ", dkOption)).toBe(true);
  });
});

describe("filterOptionsByQuery", () => {
  const options: DropdownOption[] = [
    {
      value: "DK",
      label: "DraftKings",
      aliases: ["draftkings", "draft kings"],
    },
    {
      value: "FD",
      label: "FanDuel",
      aliases: ["fanduel", "fan duel"],
    },
    {
      value: "CZ",
      label: "Caesars",
      aliases: ["caesars", "caesars sportsbook", "czrs"],
    },
  ];

  it("returns all options for empty query", () => {
    expect(filterOptionsByQuery("", options)).toHaveLength(3);
  });

  it("filters by exact value", () => {
    const result = filterOptionsByQuery("DK", options);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("DK");
  });

  it("filters by partial label", () => {
    const result = filterOptionsByQuery("Dra", options);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("DK");
  });

  it("filters by alias", () => {
    const result = filterOptionsByQuery("caesars sport", options);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("CZ");
  });

  it("returns empty array for no matches", () => {
    const result = filterOptionsByQuery("ZZZ", options);
    expect(result).toHaveLength(0);
  });
});

describe("formatOptionDisplay", () => {
  it("shows value and label separated by dash", () => {
    const opt: DropdownOption = { value: "DK", label: "DraftKings", aliases: [] };
    expect(formatOptionDisplay(opt)).toBe("DK — DraftKings");
  });

  it("shows only value if label equals value", () => {
    const opt: DropdownOption = { value: "Pts", label: "Pts", aliases: [] };
    expect(formatOptionDisplay(opt)).toBe("Pts");
  });

  it("shows only value if label is empty", () => {
    const opt: DropdownOption = { value: "DK", label: "", aliases: [] };
    expect(formatOptionDisplay(opt)).toBe("DK");
  });
});

describe("findOptionByValue", () => {
  const options: DropdownOption[] = [
    { value: "DK", label: "DraftKings", aliases: [] },
    { value: "FD", label: "FanDuel", aliases: [] },
  ];

  it("finds option by exact value", () => {
    const result = findOptionByValue("DK", options);
    expect(result?.label).toBe("DraftKings");
  });

  it("finds option case-insensitively", () => {
    const result = findOptionByValue("dk", options);
    expect(result?.label).toBe("DraftKings");
  });

  it("returns undefined for non-existent value", () => {
    expect(findOptionByValue("CZ", options)).toBeUndefined();
  });
});

describe("scoreMatch", () => {
  it("scores exact value match highest", () => {
    const opt: DropdownOption = { value: "DK", label: "DraftKings", aliases: [] };
    expect(scoreMatch("DK", opt)).toBe(100);
  });

  it("scores exact label match second highest", () => {
    const opt: DropdownOption = { value: "Pts", label: "Points", aliases: [] };
    expect(scoreMatch("Points", opt)).toBe(90);
  });

  it("scores exact alias match third", () => {
    const opt: DropdownOption = { value: "3pt", label: "3-Pointers", aliases: ["threes"] };
    expect(scoreMatch("threes", opt)).toBe(80);
  });

  it("scores prefix on label", () => {
    const opt: DropdownOption = { value: "DK", label: "DraftKings", aliases: [] };
    expect(scoreMatch("Draft", opt)).toBe(70);
  });

  it("scores prefix on alias", () => {
    // Use an alias prefix that doesn't match the label
    const opt: DropdownOption = { value: "DK", label: "DraftKings", aliases: ["dk sportsbook"] };
    expect(scoreMatch("dk sp", opt)).toBe(60);
  });

  it("scores substring match lowest", () => {
    const opt: DropdownOption = { value: "PA", label: "Points + Assists", aliases: [] };
    expect(scoreMatch("sist", opt)).toBe(10);
  });

  it("returns 0 for no match", () => {
    const opt: DropdownOption = { value: "DK", label: "DraftKings", aliases: [] };
    expect(scoreMatch("ZZZ", opt)).toBe(0);
  });
});

describe("ranking - Type options", () => {
  const typeOptions: DropdownOption[] = [
    { value: "Pts", label: "Points", aliases: ["points"] },
    { value: "PA", label: "Points + Assists", aliases: ["points + assists", "pts + ast"] },
    { value: "PRA", label: "Points + Rebounds + Assists", aliases: ["pra"] },
    { value: "Ast", label: "Assists", aliases: ["assists", "dimes"] },
    { value: "TD", label: "Triple Double", aliases: ["triple double"] },
    { value: "3pt", label: "3-Pointers", aliases: ["threes", "treys", "3 pointers"] },
  ];

  it("'Points' -> top is 'Pts — Points', not 'PA'", () => {
    const result = filterOptionsByQuery("Points", typeOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("Pts");
  });

  it("'Pts' -> top is 'Pts — Points'", () => {
    const result = filterOptionsByQuery("Pts", typeOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("Pts");
  });

  it("'Triple Double' -> top is 'TD — Triple Double'", () => {
    const result = filterOptionsByQuery("Triple Double", typeOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("TD");
  });

  it("'Threes' -> top is '3pt — 3-Pointers'", () => {
    const result = filterOptionsByQuery("Threes", typeOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("3pt");
  });

  it("'Assists' -> top is 'Ast — Assists'", () => {
    const result = filterOptionsByQuery("Assists", typeOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("Ast");
  });

  it("'Points + Assists' -> top is 'PA — Points + Assists'", () => {
    const result = filterOptionsByQuery("Points + Assists", typeOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("PA");
  });
});

describe("ranking - Site options", () => {
  const siteOptions: DropdownOption[] = [
    { value: "DK", label: "DraftKings", aliases: ["draftkings", "draft kings"] },
    { value: "FD", label: "FanDuel", aliases: ["fanduel", "fan duel"] },
    { value: "CZ", label: "Caesars", aliases: ["caesars", "caesars sportsbook"] },
  ];

  it("'Draft' -> top is 'DK — DraftKings'", () => {
    const result = filterOptionsByQuery("Draft", siteOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("DK");
  });

  it("'Fan' -> top is 'FD — FanDuel'", () => {
    const result = filterOptionsByQuery("Fan", siteOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("FD");
  });

  it("'DK' -> top is 'DK — DraftKings'", () => {
    const result = filterOptionsByQuery("DK", siteOptions);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe("DK");
  });
});

describe("ranking - tie-breakers", () => {
  it("prefers shorter label when scores are equal", () => {
    const options: DropdownOption[] = [
      { value: "A", label: "Points Long Name", aliases: [] },
      { value: "B", label: "Points", aliases: [] },
    ];
    const result = filterOptionsByQuery("Points", options);
    expect(result[0].value).toBe("B"); // Shorter label wins
  });

  it("prefers fewer words when label length is equal", () => {
    const options: DropdownOption[] = [
      { value: "A", label: "Two Words", aliases: [] },
      { value: "B", label: "OneWord12", aliases: [] },
    ];
    const result = filterOptionsByQuery("wo", options);
    // Both match "wo" as substring, same label length (9 chars)
    expect(result[0].value).toBe("B"); // Fewer words wins
  });

  it("prefers shorter value when other tie-breakers are equal", () => {
    const options: DropdownOption[] = [
      { value: "ABC", label: "Test", aliases: [] },
      { value: "AB", label: "Test", aliases: [] },
    ];
    const result = filterOptionsByQuery("Test", options);
    expect(result[0].value).toBe("AB"); // Shorter value wins
  });
});

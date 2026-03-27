/**
 * Tests validating the architectural claims in docs/reference/INPUT_MANAGEMENT_AUDIT.md
 *
 * This file serves as an executable specification for the claims made in the audit
 * document. Each describe block maps to a section of the audit. Tests ensure the
 * documented behaviors are accurate and remain accurate as the codebase evolves.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Architectural module imports (Section 1: Core architecture) ───────────
import { toLookupKey, NORMALIZATION_STORAGE_KEYS, initializeLookupMaps, BetTypeData } from "./normalizationService";
import { resolveTeam, resolveBetType, resolvePlayer, ResolverResult, ResolverStatus } from "./resolver";
import {
  addToUnresolvedQueue,
  getUnresolvedQueue,
  clearUnresolvedQueue,
  removeFromUnresolvedQueue,
  getUnresolvedQueueCount,
  generateUnresolvedItemId,
  UNRESOLVED_QUEUE_KEY,
  UnresolvedItem,
} from "./unresolvedQueue";

// ─── localStorage mock ────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

// ─── Shared helpers ───────────────────────────────────────────────────────
function makeItem(overrides: Partial<UnresolvedItem> = {}): UnresolvedItem {
  return {
    id: overrides.id ?? "item-001",
    rawValue: overrides.rawValue ?? "Unknown Entity",
    entityType: overrides.entityType ?? "team",
    encounteredAt: overrides.encounteredAt ?? "2026-03-27T00:00:00Z",
    book: overrides.book ?? "FanDuel",
    betId: overrides.betId ?? "bet-001",
    ...overrides,
  };
}

// ─── Section 1: Core architecture ─────────────────────────────────────────

describe("Audit §1 – Core architecture: module exports", () => {
  it("normalizationService exports toLookupKey", () => {
    expect(typeof toLookupKey).toBe("function");
  });

  it("normalizationService exports NORMALIZATION_STORAGE_KEYS with TEAMS, BET_TYPES, PLAYERS", () => {
    expect(NORMALIZATION_STORAGE_KEYS.TEAMS).toBe("bettracker-normalization-teams");
    expect(NORMALIZATION_STORAGE_KEYS.BET_TYPES).toBe("bettracker-normalization-bettypes");
    expect(NORMALIZATION_STORAGE_KEYS.PLAYERS).toBe("bettracker-normalization-players");
  });

  it("resolver exports the three-state resolution functions", () => {
    expect(typeof resolveTeam).toBe("function");
    expect(typeof resolveBetType).toBe("function");
    expect(typeof resolvePlayer).toBe("function");
  });

  it("unresolvedQueue exports all documented queue operations", () => {
    expect(typeof addToUnresolvedQueue).toBe("function");
    expect(typeof getUnresolvedQueue).toBe("function");
    expect(typeof clearUnresolvedQueue).toBe("function");
    expect(typeof removeFromUnresolvedQueue).toBe("function");
    expect(typeof getUnresolvedQueueCount).toBe("function");
    expect(typeof generateUnresolvedItemId).toBe("function");
  });

  it("unresolvedQueue uses the documented localStorage key", () => {
    expect(UNRESOLVED_QUEUE_KEY).toBe("bettracker-unresolved-queue");
  });
});

// ─── Section 3: Resolution rules – resolver status outcomes ────────────────

describe("Audit §3 – Resolution rules: resolver exposes resolved / unresolved / ambiguous outcomes", () => {
  it("resolveTeam returns 'resolved' status for a known team", () => {
    const result: ResolverResult = resolveTeam("Phoenix Suns");
    expect(result.status).toBe<ResolverStatus>("resolved");
    expect(result.canonical).toBe("Phoenix Suns");
    expect(result.raw).toBeDefined();
  });

  it("resolveTeam returns 'unresolved' status for an unknown team", () => {
    const result: ResolverResult = resolveTeam("Completely Unknown FC ZZZZ");
    expect(result.status).toBe<ResolverStatus>("unresolved");
    expect(result.canonical).toBe("Completely Unknown FC ZZZZ");
  });

  it("ResolverResult always carries both canonical and raw fields", () => {
    const resolved = resolveTeam("Lakers");
    expect(resolved).toHaveProperty("status");
    expect(resolved).toHaveProperty("canonical");
    expect(resolved).toHaveProperty("raw");
  });

  it("resolveBetType returns 'resolved' for a known bet type", () => {
    const result = resolveBetType("Points");
    expect(result.status).toBe("resolved");
  });

  it("resolveBetType returns 'unresolved' for an unknown bet type", () => {
    const result = resolveBetType("ZZZ Unknown Prop QQQQ");
    expect(result.status).toBe("unresolved");
  });

  it("resolveBetType accepts optional sport context without throwing", () => {
    expect(() => resolveBetType("Points", "NBA")).not.toThrow();
  });
});

// ─── Section 3: Resolution rules – toLookupKey claimed behaviors ───────────

describe("Audit §3 – Resolution rules: toLookupKey normalization pipeline", () => {
  it("applies lowercase as the final step", () => {
    expect(toLookupKey("UPPERCASE")).toBe("uppercase");
    expect(toLookupKey("MixedCase")).toBe("mixedcase");
  });

  it("trims and collapses whitespace", () => {
    expect(toLookupKey("  Team  Name  ")).toBe("team name");
    expect(toLookupKey("Team\t\nName")).toBe("team name");
  });

  it("applies Unicode NFKC normalization (composed == decomposed)", () => {
    const composed = "Joki\u0107";      // ć as single codepoint
    const decomposed = "Jokic\u0301";  // c + combining acute accent
    expect(toLookupKey(composed)).toBe(toLookupKey(decomposed));
  });

  it("converts smart punctuation to ASCII equivalents (audit: punctuation normalization)", () => {
    // em-dash → hyphen
    expect(toLookupKey("Team \u2014 Total")).toBe("team - total");
    // smart right single quote → apostrophe
    expect(toLookupKey("D\u2019Angelo")).toBe("d'angelo");
    // non-breaking space → regular space
    expect(toLookupKey("LeBron\u00A0James")).toBe("lebron james");
  });

  it("does NOT strip accents (audit: accents are preserved)", () => {
    expect(toLookupKey("Jos\u00E9")).toBe("jos\u00E9");
    expect(toLookupKey("Jos\u00E9")).not.toBe("jose");
  });

  it("returns empty string for null/undefined/empty (boundary case)", () => {
    expect(toLookupKey("")).toBe("");
    expect(toLookupKey(null as unknown as string)).toBe("");
    expect(toLookupKey(undefined as unknown as string)).toBe("");
  });
});

// ─── Section 3: Disabled entities excluded from resolution ─────────────────

describe("Audit §3 – Resolution rules: disabled BetType entities excluded from resolution", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("disabled bet type is not resolved even when its canonical is used", () => {
    const betTypes: BetTypeData[] = [
      {
        canonical: "Active Prop",
        sport: "NBA",
        description: "Active prop bet",
        aliases: ["Active Alias"],
        disabled: false,
      },
      {
        canonical: "Disabled Prop",
        sport: "NBA",
        description: "Disabled prop bet",
        aliases: ["Disabled Alias"],
        disabled: true,
      },
    ];

    localStorage.setItem(NORMALIZATION_STORAGE_KEYS.BET_TYPES, JSON.stringify(betTypes));
    initializeLookupMaps();

    // Active bet type resolves
    expect(resolveBetType("Active Prop").status).toBe("resolved");
    expect(resolveBetType("Active Alias").status).toBe("resolved");

    // Disabled bet type does NOT resolve
    expect(resolveBetType("Disabled Prop").status).toBe("unresolved");
    expect(resolveBetType("Disabled Alias").status).toBe("unresolved");
  });

  it("re-enabling a bet type (disabled: false) makes it resolvable again", () => {
    const disabled: BetTypeData[] = [
      {
        canonical: "Toggled Prop",
        sport: "NBA",
        description: "Toggled",
        aliases: [],
        disabled: true,
      },
    ];
    localStorage.setItem(NORMALIZATION_STORAGE_KEYS.BET_TYPES, JSON.stringify(disabled));
    initializeLookupMaps();
    expect(resolveBetType("Toggled Prop").status).toBe("unresolved");

    const enabled: BetTypeData[] = [
      {
        canonical: "Toggled Prop",
        sport: "NBA",
        description: "Toggled",
        aliases: [],
        disabled: false,
      },
    ];
    localStorage.setItem(NORMALIZATION_STORAGE_KEYS.BET_TYPES, JSON.stringify(enabled));
    initializeLookupMaps();
    expect(resolveBetType("Toggled Prop").status).toBe("resolved");
  });
});

// ─── Section 2B/C: Unresolved queue context values ─────────────────────────

describe("Audit §2 – Unresolved queue context field values", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("accepts context value 'manual-entry' (Bet Table manual editing flow)", () => {
    const item = makeItem({ id: "me-001", context: "manual-entry" });
    addToUnresolvedQueue([item]);
    const queue = getUnresolvedQueue();
    expect(queue[0].context).toBe("manual-entry");
  });

  it("accepts context value 'import-deferred' (Import Review Defer flow)", () => {
    const item = makeItem({ id: "id-001", context: "import-deferred" });
    addToUnresolvedQueue([item]);
    const queue = getUnresolvedQueue();
    expect(queue[0].context).toBe("import-deferred");
  });

  it("context field is optional and can be omitted", () => {
    const item = makeItem({ id: "no-ctx-001" });
    delete (item as Partial<UnresolvedItem>).context;
    addToUnresolvedQueue([item]);
    const queue = getUnresolvedQueue();
    expect(queue[0].context).toBeUndefined();
  });

  it("items queued from different context values are stored independently", () => {
    const manualItem = makeItem({ id: "manual-001", rawValue: "Raw Team A", context: "manual-entry" });
    const deferredItem = makeItem({ id: "deferred-001", rawValue: "Raw Team B", context: "import-deferred" });

    addToUnresolvedQueue([manualItem, deferredItem]);
    const queue = getUnresolvedQueue();

    expect(queue).toHaveLength(2);
    const contexts = queue.map((i) => i.context);
    expect(contexts).toContain("manual-entry");
    expect(contexts).toContain("import-deferred");
  });
});

// ─── removeFromUnresolvedQueue (referenced in audit as resolution path) ────

describe("Audit §1 – unresolvedQueue: removeFromUnresolvedQueue (item resolution path)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("removes an existing item by ID and returns count removed", () => {
    const item = makeItem({ id: "remove-001" });
    addToUnresolvedQueue([item]);
    expect(getUnresolvedQueue()).toHaveLength(1);

    const removed = removeFromUnresolvedQueue(["remove-001"]);
    expect(removed).toBe(1);
    expect(getUnresolvedQueue()).toHaveLength(0);
  });

  it("returns 0 when attempting to remove an ID that does not exist", () => {
    const item = makeItem({ id: "keep-001" });
    addToUnresolvedQueue([item]);

    const removed = removeFromUnresolvedQueue(["nonexistent-id"]);
    expect(removed).toBe(0);
    expect(getUnresolvedQueue()).toHaveLength(1);
  });

  it("removes only matching IDs from a mixed queue (partial removal)", () => {
    const items = [
      makeItem({ id: "r-001", rawValue: "Team A" }),
      makeItem({ id: "r-002", rawValue: "Team B" }),
      makeItem({ id: "r-003", rawValue: "Team C" }),
    ];
    addToUnresolvedQueue(items);
    expect(getUnresolvedQueue()).toHaveLength(3);

    const removed = removeFromUnresolvedQueue(["r-001", "r-003"]);
    expect(removed).toBe(2);

    const remaining = getUnresolvedQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("r-002");
  });

  it("returns 0 and leaves queue intact when called with empty array", () => {
    const item = makeItem({ id: "intact-001" });
    addToUnresolvedQueue([item]);

    const removed = removeFromUnresolvedQueue([]);
    expect(removed).toBe(0);
    expect(getUnresolvedQueue()).toHaveLength(1);
  });
});

// ─── getUnresolvedQueueCount ───────────────────────────────────────────────

describe("Audit §1 – unresolvedQueue: getUnresolvedQueueCount", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns 0 for an empty queue", () => {
    expect(getUnresolvedQueueCount()).toBe(0);
  });

  it("returns the correct count after adding items", () => {
    addToUnresolvedQueue([
      makeItem({ id: "cnt-001" }),
      makeItem({ id: "cnt-002" }),
      makeItem({ id: "cnt-003" }),
    ]);
    expect(getUnresolvedQueueCount()).toBe(3);
  });

  it("decrements correctly after removal", () => {
    addToUnresolvedQueue([makeItem({ id: "dec-001" }), makeItem({ id: "dec-002" })]);
    removeFromUnresolvedQueue(["dec-001"]);
    expect(getUnresolvedQueueCount()).toBe(1);
  });

  it("returns 0 after clearing the queue", () => {
    addToUnresolvedQueue([makeItem({ id: "clr-001" })]);
    clearUnresolvedQueue();
    expect(getUnresolvedQueueCount()).toBe(0);
  });
});

// ─── Risk §2: generateUnresolvedItemId uses normalized (toLookupKey) value ──

describe("Audit Risk §2 – generateUnresolvedItemId uses toLookupKey normalization for dedup", () => {
  it("same raw value with different casing produces the same ID (dedup via normalization)", () => {
    const id1 = generateUnresolvedItemId("Unknown Team", "bet-001");
    const id2 = generateUnresolvedItemId("UNKNOWN TEAM", "bet-001");
    const id3 = generateUnresolvedItemId("unknown team", "bet-001");
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  it("ID includes betId component to distinguish same value across different bets", () => {
    const idA = generateUnresolvedItemId("Team X", "bet-A");
    const idB = generateUnresolvedItemId("Team X", "bet-B");
    expect(idA).not.toBe(idB);
  });

  it("ID includes legIndex when provided, differs from no-legIndex form", () => {
    const withLeg = generateUnresolvedItemId("Team X", "bet-001", 0);
    const withoutLeg = generateUnresolvedItemId("Team X", "bet-001");
    expect(withLeg).not.toBe(withoutLeg);
  });

  it("ID separates components with '::' as documented (format: normalized::betId[::legIndex])", () => {
    const id = generateUnresolvedItemId("Team X", "bet-001");
    expect(id).toContain("::");
    const parts = id.split("::");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]).toBe(toLookupKey("Team X"));
    expect(parts[1]).toBe("bet-001");
  });

  it("ID format with legIndex has three '::'-separated components", () => {
    const id = generateUnresolvedItemId("Team X", "bet-001", 2);
    const parts = id.split("::");
    expect(parts).toHaveLength(3);
    expect(parts[2]).toBe("2");
  });
});

// ─── Audit document structure validation ──────────────────────────────────

describe("Audit document structure: docs/reference/INPUT_MANAGEMENT_AUDIT.md", () => {
  let content: string;

  beforeEach(() => {
    const docPath = resolve(__dirname, "../docs/reference/INPUT_MANAGEMENT_AUDIT.md");
    content = readFileSync(docPath, "utf-8");
  });

  it("document file exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it("contains the required section: Core architecture (§1)", () => {
    expect(content).toMatch(/##\s+1\)/);
    expect(content).toMatch(/Core architecture/i);
  });

  it("contains the required section: Exactly where fields/entities can be added (§2)", () => {
    expect(content).toMatch(/##\s+2\)/);
    expect(content).toMatch(/where fields\/entities can be added/i);
  });

  it("contains the required section: Resolution rules (§3)", () => {
    expect(content).toMatch(/##\s+3\)/);
    expect(content).toMatch(/Resolution rules/i);
  });

  it("contains the required section: Durability assessment (§4)", () => {
    expect(content).toMatch(/##\s+4\)/);
    expect(content).toMatch(/Durability/i);
  });

  it("contains the required section: Bottom line (§5)", () => {
    expect(content).toMatch(/##\s+5\)/);
    expect(content).toMatch(/Bottom line/i);
  });

  it("documents the five core architectural components", () => {
    expect(content).toMatch(/`useInputs`/);
    expect(content).toMatch(/`useNormalizationData`/);
    expect(content).toMatch(/`normalizationService`/);
    expect(content).toMatch(/`resolver`/);
    expect(content).toMatch(/`unresolvedQueue`/);
  });

  it("documents the three resolver outcome statuses", () => {
    expect(content).toMatch(/resolved/);
    expect(content).toMatch(/unresolved/);
    expect(content).toMatch(/ambiguous/);
  });

  it("documents the two unresolved queue context values", () => {
    expect(content).toMatch(/manual-entry/);
    expect(content).toMatch(/import-deferred/);
  });

  it("documents the Map/Create/Defer workflow", () => {
    expect(content).toMatch(/\*\*Map\*\*/);
    expect(content).toMatch(/\*\*Create\*\*/);
    expect(content).toMatch(/\*\*Defer\*\*/);
  });

  it("documents the toLookupKey function", () => {
    expect(content).toMatch(/`toLookupKey`/);
  });

  it("documents the risks and inconsistencies section", () => {
    expect(content).toMatch(/Risks/i);
    expect(content).toMatch(/inconsistencies/i);
  });

  it("documents the bet type alias ambiguity risk (Risk §2)", () => {
    expect(content).toMatch(/addBetTypeAlias/);
    expect(content).toMatch(/canonical \+ sport/i);
  });

  it("documents disabled entity behavior", () => {
    expect(content).toMatch(/disabled/i);
  });
});
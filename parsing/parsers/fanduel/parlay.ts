import {
  Bet,
  BetLeg,
  BetResult,
  BetType,
  LegResult,
  SportsbookName,
} from "../../types";
import {
  HeaderInfo,
  buildLegsFromDescription,
  buildLegsFromRows,
  dedupeLegs,
  buildLegsFromStatText,
  buildLegsFromSpans,
  dropGenericDuplicateLegs,
  filterMeaningfulLegs,
  formatDescription,
  formatParlayDescriptionFromLegs,
  inferMarketCategory,
  isSGPPlus,
  aggregateChildResults,
  extractOdds,
  findLegRows,
  normalizeSpaces,
  fdDebug,
  stripDateTimeNoise,
  stripScoreboardText,
  toLegResult,
  inferMatchupFromTeams,
} from "./common";

const inferMatchupForEntity = (
  rawText: string,
  entity: string | undefined
): string | null => {
  if (!rawText || !entity) return null;
  const lower = rawText.toLowerCase();
  const idx = lower.indexOf(entity.toLowerCase());
  if (idx !== -1) {
    const slice = rawText.slice(Math.max(0, idx - 40), idx + 140);
    const matchup = cleanMatchupTarget(slice) || findMatchupInText(slice);
    if (matchup) return normalizeSpaces(matchup);
  }
  return null;
};

const extractOddsMatchups = (text: string): Map<number, string> => {
  const map = new Map<number, string>();
  if (!text) return map;
  const normalized = normalizeSpaces(text);
  
  // Pattern 1: SGP odds followed by matchup
  const sgpPattern =
    /Same Game Parlay™\s*\+?(-?\d+)\s+([A-Z][A-Za-z'\s]+@\s+[A-Z][A-Za-z'\s]+)/gi;
  for (const match of normalized.matchAll(sgpPattern)) {
    const oddsVal = parseInt(match[1], 10);
    const matchup = normalizeSpaces(match[2]);
    if (!Number.isNaN(oddsVal)) map.set(oddsVal, matchup);
  }

  // Pattern 2: Odds after player + market, followed by matchup
  // Example: "Deni Avdija +1200 To Record A Triple Double Phoenix Suns ... Portland Trail Blazers"
  const playerOddsPattern =
    /\b([+\-]\d{2,5})\s+(?:To Record|To Score|Made Threes|MADE THREES)[^]+?([A-Z][A-Za-z'\s]+?)\s+\d{8,}\s+\d+\s+([A-Z][A-Za-z'\s]+?)\s+\d{8,}/gi;
  for (const match of normalized.matchAll(playerOddsPattern)) {
    const oddsVal = parseInt(match[1], 10);
    const team1 = normalizeSpaces(match[2]);
    const team2 = normalizeSpaces(match[3]);
    if (!Number.isNaN(oddsVal) && !map.has(oddsVal) && team1 && team2) {
      map.set(oddsVal, `${team1} @ ${team2}`);
    }
  }

  // Pattern 3: Generic odds followed by matchup (fallback)
  const genericPattern =
    /([+\-]?\d{2,5})[^\n]{0,60}?([A-Z][A-Za-z'\s]+@\s+[A-Z][A-Za-z'\s]+)/gi;
  for (const match of normalized.matchAll(genericPattern)) {
    const oddsVal = parseInt(match[1], 10);
    const matchup = normalizeSpaces(match[2]);
    if (!Number.isNaN(oddsVal) && !map.has(oddsVal)) {
      map.set(oddsVal, matchup);
    }
  }

  return map;
};

export interface ParlayBetParams {
  headerLi: HTMLElement;
  legRows: HTMLElement[];
  betId: string;
  placedAtISO: string;
  meta: {
    stake: number | null;
    payout: number | null;
    rawText: string;
  };
  result: BetResult;
  betType: BetType;
  book: SportsbookName;
  headerInfo: HeaderInfo;
}

export const parseParlayBet = ({
  headerLi,
  legRows,
  betId,
  placedAtISO,
  meta,
  result,
  betType,
  book,
  headerInfo,
}: ParlayBetParams): Bet => {
  const marketCategory = inferMarketCategory(betType, headerInfo.type);
  const isSGPPlusStructure =
    betType === "sgp_plus" || isSGPPlus(headerInfo.rawText);

  // Bet-level odds are shown once at the top of the parlay card
  const betOdds = headerInfo.odds ?? 0;

  // SGP modeling:
  // - Standard SGP bets keep each inner selection as a flat leg with odds set to null when hidden.
  // - SGP+ bets add a group leg (isGroupLeg=true) that carries the nested SGP combined odds
  //   and exposes the inner selections as children (with null odds), alongside any extra legs.

  const skipLegOdds = betType === "sgp";

  const legKey = (leg: BetLeg): string =>
    [
      (leg.entities?.[0] || "").toLowerCase(),
      (leg.market || "").toLowerCase(),
      String(leg.target ?? ""),
    ].join("|");

  const buildCombinedLegs = (rows: HTMLElement[]): BetLeg[] => {
    const useSkipLegOdds = skipLegOdds && !isSGPPlusStructure;
    const legFallbackResult = (result || "pending").toUpperCase() as LegResult;

    // Build legs from structured rows and textual description together
    const legsFromRows = buildLegsFromRows(rows, {
      result: legFallbackResult,
      skipOdds: useSkipLegOdds,
      fallbackOdds: null,
      parentForResultLookup: headerLi,
    });
    const legsFromDescription = headerInfo.description
      ? buildLegsFromDescription(
          headerInfo.description,
          legFallbackResult,
          useSkipLegOdds
        )
      : [];

    // Always try to extract from raw text; helpful when FanDuel hides leg odds/results
    const legsFromStatText = buildLegsFromStatText(headerInfo.rawText, legFallbackResult);
    const legsFromSpans = buildLegsFromSpans(headerLi, legFallbackResult);

    const fallbackHeaderLegs =
      !legsFromRows.length && !legsFromStatText.length && !legsFromSpans.length
        ? buildLegsFromRows([headerLi], {
            result: legFallbackResult,
            skipOdds: useSkipLegOdds,
            fallbackOdds: null,
            parentForResultLookup: headerLi,
          })
        : [];

    const combined = dedupeLegs(
      dropGenericDuplicateLegs(
        filterMeaningfulLegs([
          ...legsFromRows,
          ...legsFromDescription,
          ...legsFromStatText,
          ...legsFromSpans,
          ...fallbackHeaderLegs,
        ])
      )
    );

    // For SGP bets, inner legs never show per-leg odds
    if (skipLegOdds) {
      return combined.map((leg) => ({ ...leg, odds: null }));
    }

    return combined;
  };

  let groupLegs: BetLeg[] = [];
  let consumedRows = new Set<HTMLElement>();

  if (betType === "sgp") {
    ({ groupLegs, consumedRows } = buildSGPGroupLegs(
      headerLi,
      legRows,
      result,
      betOdds
    ));
  } else if (isSGPPlusStructure) {
    ({ groupLegs, consumedRows } = buildSGPPlusGroupLegs(headerLi, result));
  }

  // Fallback grouping for SGP+ when structural grouping failed: cluster legs by shared odds.
  if (betType === "sgp_plus" && groupLegs.length === 0 && legRows.length) {
    const perRowLegs = legRows
      .map((row) => {
        const leg = buildLegsFromRows([row], {
          result: toLegResult(result),
          skipOdds: false,
          fallbackOdds: null,
          parentForResultLookup: headerLi,
        })[0];
        return leg ? { row, leg } : null;
      })
      .filter(
        (entry): entry is { row: HTMLElement; leg: BetLeg } => entry !== null
      );

    const groupedByOdds = new Map<
      number,
      { rows: HTMLElement[]; legs: BetLeg[] }
    >();

    for (const entry of perRowLegs) {
      const oddsVal = entry.leg.odds;
      if (oddsVal == null) continue;
      const rowText = normalizeSpaces(entry.row.textContent || "");
      const hasStatPair = /\b\d{1,3}\s+\d{1,3}\b/.test(rowText);
      if (entry.leg.result === "WIN" && !hasStatPair) {
        entry.leg.result = toLegResult(result);
      }
      const bucket =
        groupedByOdds.get(oddsVal) ?? { rows: [], legs: [] as BetLeg[] };
      bucket.rows.push(entry.row);
      bucket.legs.push({ ...entry.leg, odds: null });
      groupedByOdds.set(oddsVal, bucket);
    }

    const deriveMatchup = (oddsValue: number): string | undefined => {
      const oddsText = String(oddsValue);
      const idx = headerInfo.rawText.indexOf(oddsText);
      if (idx !== -1) {
        const slice = headerInfo.rawText.slice(
          Math.max(0, idx - 100),
          Math.min(headerInfo.rawText.length, idx + 140)
        );
        const matchup = findMatchupInText(slice);
        if (matchup) return matchup;
      }
      const combinedText = `${headerInfo.rawText} ${normalizeSpaces(
        headerLi.textContent || ""
      )}`;
      const fallbackMatchup = cleanMatchupTarget(
        findMatchupInText(combinedText) ?? combinedText
      );
      return fallbackMatchup ? normalizeSpaces(fallbackMatchup) : undefined;
    };

    for (const [oddsValue, bucket] of groupedByOdds) {
      if (bucket.legs.length < 2) continue;
      bucket.rows.forEach((row) => consumedRows.add(row));
      groupLegs.push({
        market: "Same Game Parlay",
        target: deriveMatchup(oddsValue),
        odds: oddsValue,
        result: aggregateChildResults(bucket.legs, result),
        isGroupLeg: true,
        children: bucket.legs,
      });
    }
  }

  const remainingRows =
    betType === "sgp"
      ? []
      : legRows.filter((row) => !consumedRows.has(row));
  const extraLegs = remainingRows.length ? buildCombinedLegs(remainingRows) : [];

  // Avoid duplicating inner SGP legs outside the group container
  const childKeys = new Set<string>();
  groupLegs.forEach((group) =>
    (group.children || []).forEach((child) => childKeys.add(legKey(child)))
  );
  const filteredExtras = extraLegs.filter((leg) => !childKeys.has(legKey(leg)));

  // For SGP+ bets, ensure we extract all additional selections from raw text
  // This catches cases where additional selections aren't in the DOM structure
  let additionalLegsFromText: BetLeg[] = [];
  if (isSGPPlusStructure) {
    // Check if description mentions additional selections (e.g., "Includes: 1 Same Game Parlay™ + 1 selection")
    const descriptionText = headerInfo.description || headerInfo.rawText || "";
    const hasAdditionalSelections = /includes:\s*\d+\s+same\s+game\s+parlay\s*\+\s*\d+\s+selection/i.test(descriptionText) ||
                                     /includes:\s*\d+\s+same\s+game\s+parlay.*\+.*selection/i.test(descriptionText);
    
    // Extract all legs from raw text if we have few/no extra legs or description indicates additional selections
    if (filteredExtras.length === 0 || hasAdditionalSelections) {
      const allLegsFromText = buildLegsFromStatText(headerInfo.rawText, "PENDING");
      
      // Filter out legs that are already in group legs' children
      const allGroupChildKeys = new Set<string>();
      groupLegs.forEach((group) => {
        (group.children || []).forEach((child) => {
          allGroupChildKeys.add(legKey(child));
        });
      });
      
      // Also check against filteredExtras to avoid duplicates
      const extraKeys = new Set(filteredExtras.map(legKey));
      
      additionalLegsFromText = allLegsFromText.filter((leg) => {
        const key = legKey(leg);
        return !allGroupChildKeys.has(key) && !extraKeys.has(key);
      });
      
      // Only keep legs that have odds (additional selections typically have odds)
      // or are clearly additional selections (not part of SGP groups)
      additionalLegsFromText = additionalLegsFromText.filter((leg) => {
        // If it has odds, it's likely an additional selection
        if (leg.odds !== null && leg.odds !== undefined) return true;
        // If it doesn't have a target that matches a group leg's target, it's likely additional
        const legTarget = leg.target || "";
        const isInGroupTarget = groupLegs.some((group) => {
          const groupTarget = group.target || "";
          return groupTarget && legTarget && groupTarget.includes(legTarget);
        });
        return !isInGroupTarget;
      });
    }
  }

  const legs = [...groupLegs, ...filteredExtras, ...additionalLegsFromText];
  const oddsMatchups = extractOddsMatchups(headerInfo.rawText);

  legs.forEach((leg) => {
    if (leg.isGroupLeg) {
      const cleanedTarget =
        cleanMatchupTarget(
          leg.target ??
            normalizeSpaces(
              `${headerInfo.rawText} ${headerLi.textContent || ""}`
            )
        ) || leg.target;
      if (cleanedTarget) {
        leg.target = cleanedTarget;
      }
    } else {
      // For non-group legs, we need to separate the bet-specific target (like "5+")
      // from the game matchup. The target should be the line/value, and game should
      // be the matchup.
      
      // First, try to extract the game matchup from odds or entity
      let gameMatchup: string | undefined;
      
      if (leg.odds != null && oddsMatchups.has(leg.odds)) {
        gameMatchup = oddsMatchups.get(leg.odds);
      }
      
      if (!gameMatchup) {
        const entity = leg.entities?.[0];
        gameMatchup =
          inferMatchupForEntity(headerInfo.rawText, entity) ||
          inferMatchupFromTeams(headerInfo.rawText);
      }
      
      // Clean the matchup if found
      if (gameMatchup) {
        gameMatchup = cleanMatchupTarget(gameMatchup) || gameMatchup;
        // Remove any market text prefixes that might have gotten into the matchup
        gameMatchup = gameMatchup.replace(/^(Made Threes|Threes|Points|Rebounds|Assists|Yards|Receptions)\s+/i, "");
        (leg as any).game = gameMatchup;
      }
      
      // Handle the target field: if it looks like a matchup, clear it and use game instead
      // Target should only be the bet line (like "5+", "30+", etc.) or undefined for simple bets
      if (leg.target) {
        const targetStr = String(leg.target);
        // If target looks like a matchup (contains @, team names, or noise like "Finished"),
        // it should be moved to game field and target should be undefined
        const looksLikeMatchup = /@/.test(targetStr) || 
                                 /Finished|Box Score|Play-by-play/i.test(targetStr) ||
                                 /Double|Triple|Lakers|Pistons|Hawks|Suns|Jazz|Warriors|Pelicans/i.test(targetStr);
        
        if (looksLikeMatchup) {
          // Try to extract a clean matchup from this target
          const cleanedMatchup = cleanMatchupTarget(targetStr);
          if (cleanedMatchup && !gameMatchup) {
            (leg as any).game = cleanedMatchup;
          }
          // Clear target for TD/DD and other non-line bets
          if (leg.market === "TD" || leg.market === "DD" || leg.market === "Moneyline") {
            leg.target = undefined;
          }
        }
      }
    }
  });

  if ((betType === "sgp" || betType === "sgp_plus") && legs.length) {
    const childResult = toLegResult(result);
    legs.forEach((leg) => {
      if (leg.children) {
        // First check if ANY child has VOID/PUSH result
        const hasVoidSibling = leg.children.some((child) => {
          const r = String(child.result || "").toUpperCase();
          return r === "VOID" || r === "PUSH";
        });
        
        // Don't overwrite VOID/PUSH results - they're already correctly set
        // Also, if any sibling is VOID, all siblings should be PUSH
        leg.children = leg.children.map((child) => {
          const currentResultStr = String(child.result || "").toUpperCase();
          const currentResult = toLegResult(child.result);
          
          // Keep VOID as is (it will be displayed as VOID in output)
          if (currentResultStr === "VOID") {
            return child;
          }
          // If child already has PUSH, keep it
          if (currentResult === "PUSH") {
            return child;
          }
          // If any sibling is voided, this child should be PUSH too
          if (hasVoidSibling) {
            return {
              ...child,
              result: "PUSH" as LegResult,
            };
          }
          return {
            ...child,
            result: childResult,
          };
        });
      }
      if (leg.isGroupLeg && leg.children) {
        leg.result = aggregateChildResults(leg.children, childResult);
      }
    });
  }

  // Validate result consistency: for SGP bets, if all legs show WIN, the bet should be WIN
  // (unless there are missing legs, in which case the footer result is the source of truth)
  if ((betType === "sgp" || betType === "sgp_plus") && legs.length > 0) {
    const allLegResults: string[] = [];
    
    // Collect all leg results (including children of group legs)
    legs.forEach((leg) => {
      if (leg.isGroupLeg && leg.children) {
        leg.children.forEach((child) => {
          if (child.result) allLegResults.push(child.result);
        });
        // Also include the group leg result itself
        if (leg.result) allLegResults.push(leg.result);
      } else {
        if (leg.result) allLegResults.push(leg.result);
      }
    });
    
    // Check if all non-pending legs are WIN
    const settledLegs = allLegResults.filter((r) => 
      r && r !== "PENDING" && r !== "pending" && r !== "UNKNOWN" && r !== "unknown"
    );
    const allWins = settledLegs.length > 0 && settledLegs.every((r) => 
      r === "WIN" || r === "win"
    );
    
    // If all legs won but bet shows loss, this might indicate missing legs
    // Log a debug message but keep the footer result as source of truth
    if (allWins && result === "loss" && settledLegs.length > 0) {
      fdDebug(
        `Warning: Bet ${betId} shows LOSS but all ${settledLegs.length} parsed legs show WIN. ` +
        `This may indicate missing legs. Footer result (${result}) is kept as source of truth.`
      );
    }
  }

  if (betType === "parlay" && legs.length) {
    const legResult = toLegResult(result);
    legs.forEach((leg) => {
      leg.result = legResult;
      if (leg.children) {
        leg.children = leg.children.map((child) => ({
          ...child,
          result: legResult,
        }));
      }
    });
  }

  const shouldCondenseGroupDescription =
    betType === "sgp" &&
    legs.length === 1 &&
    legs[0].isGroupLeg &&
    Array.isArray(legs[0].children) &&
    legs[0].children.length <= 3;

  // Build description based on bet type
  let description: string;
  
  if (betType === "sgp_plus" && legs.length) {
    // Format SGP+ description: "X-leg Same Game Parlay Plus: SGP (...) + selection"
    const totalLegs = legs.reduce((count, leg) => {
      if (leg.isGroupLeg && leg.children) {
        return count + leg.children.length;
      }
      return count + 1;
    }, 0);
    
    const parts: string[] = [];
    legs.forEach((leg) => {
      if (leg.isGroupLeg && leg.children) {
        // Format SGP group: "SGP (ShortMatchup)" - just the matchup, no children details
        let matchup = leg.target || "";
        if (matchup) {
          // Simplify matchup: shorten city + team to just city for longer names
          // Keep both words for short team names (Utah Jazz, etc.)
          matchup = matchup
            .replace(/\bDetroit\s+Pistons\b/gi, "Detroit")
            .replace(/\bGolden\s+State\s+Warriors\b/gi, "Golden State")
            .replace(/\bNew\s+Orleans\s+Pelicans\b/gi, "New Orleans")
            .replace(/\bPortland\s+Trail\s+Blazers\b/gi, "Portland Trail Blazers")
            .replace(/\bSeattle\s+Seahawks\b/gi, "Seattle Seahawks")
            .replace(/\bLos\s+Angeles\s+Rams\b/gi, "Los Angeles Rams")
            .replace(/\bLos\s+Angeles\s+Lakers\b/gi, "Los Angeles Lakers")
            .replace(/\bSan\s+Francisco\s+49ers\b/gi, "San Francisco 49ers")
            // Keep these unchanged - they're already short or should stay full
            // Utah Jazz, Phoenix Suns, Atlanta Hawks, Chicago Bulls, etc.
        }
        parts.push(`SGP (${matchup})`);
      } else {
        // Format regular selection: "Player Target Market" with full name
        const entity = leg.entities?.[0] || "";
        const market = leg.market || "";
        const target = leg.target;
        // Include target for props (like "5+" for "5+ 3pt")
        if (target && /^\d+\+?$/.test(String(target))) {
          parts.push(`${entity} ${target} ${market}`);
        } else {
          parts.push(`${entity} ${market}`);
        }
      }
    });
    
    description = `${totalLegs}-leg Same Game Parlay Plus: ${parts.join(" + ")}`;
    
    description = `${totalLegs}-leg Same Game Parlay Plus: ${parts.join(" + ")}`;
  } else if (legs.length) {
    description = shouldCondenseGroupDescription
      ? `${formatParlayDescriptionFromLegs(legs[0].children || [])}${
          legs[0].target ? ` ${legs[0].target}` : ""
        }`.trim()
      : formatParlayDescriptionFromLegs(legs);
  } else {
    description = formatDescription(
      headerInfo.description,
      headerInfo.type,
      headerInfo.name,
      headerInfo.line,
      headerInfo.ou,
      betType
    );
  }

  // Give SGPs an explicit short name so UI doesn't fall back to generic header text.
  const groupChildCount =
    betType === "sgp" &&
    legs.length === 1 &&
    legs[0].isGroupLeg &&
    Array.isArray(legs[0].children)
      ? legs[0].children!.length
      : null;
  const legCount =
    betType === "sgp" && groupChildCount
      ? groupChildCount
      : legs.length || legRows.length || undefined;
  const betName =
    betType === "sgp"
      ? legCount && legCount >= 4
        ? `SGP (${legCount} legs)`
        : "SGP"
      : betType === "sgp_plus"
      ? "SGP+"
      : betType === "parlay"
      ? legCount
        ? `Parlay (${legCount})`
        : "Parlay"
      : undefined;

  // If the description is still just generic SGP text, fall back to leg summary when available.
  // But don't override our custom SGP+ format
  const finalDescription =
    legs.length && 
    /^same game parlay[^+]/i.test(description) &&  // Only match if NOT "Same Game Parlay Plus"
    !/\d+-leg Same Game Parlay Plus/i.test(description)  // Don't override our custom format
      ? formatParlayDescriptionFromLegs(legs)
      : description;

  const bet: Bet = {
    id: `${book}:${betId}:${placedAtISO}`,
    book,
    betId,
    placedAt: placedAtISO,
    settledAt: undefined,
    betType,
    marketCategory,
    sport: headerInfo.sport ?? "",
    description: finalDescription,
    name: betName, // keep singles blank; SGPs get explicit label
    odds: betOdds,
    stake: meta.stake ?? 0,
    payout: meta.payout ?? 0,
    result,
    type: undefined,
    line: undefined,
    ou: undefined,
    legs: legs.length ? legs : undefined,
    tail: "",
    raw: `${headerInfo.rawText}\n----\n${meta.rawText}`,
    isLive: headerInfo.isLive,
    isSample: false,
  };

  return bet;
};

const findSGPGroupContainers = (root: HTMLElement): HTMLElement[] => {
  const divs = Array.from(root.querySelectorAll<HTMLElement>("div"));
  const candidates = divs.filter((div) => {
    const text = normalizeSpaces(div.textContent || "").toLowerCase();
    // Check for "same game parlay" (handle trademark symbol variations)
    const hasSGPText = text.includes("same game parlay") || 
                       text.includes("same game parlay™") ||
                       text.includes("same game parlaytm");
    if (!hasSGPText) return false;
    
    // Exclude SGP+ parent containers
    if (text.includes("parlay+") || text.includes("parlay plus")) return false;
    if (text.includes("includes:")) return false;
    
    // Must have an odds span to be a real SGP block
    // Also check for role="button" which is common in SGP containers
    const hasOdds = !!div.querySelector('span[aria-label^="Odds"]');
    const hasLegCards =
      div.querySelector("div.v.z.x.y.jk.t.ab.h") !== null;
    const hasButtonRole = div.getAttribute("role") === "button" || 
                         div.querySelector('[role="button"]') !== null;
    
    // SGP containers typically have either odds or are button-like containers
    // Also check if this div contains leg rows (aria-label elements with market text)
    const hasLegRows = Array.from(div.querySelectorAll('[aria-label]')).some((el) => {
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return /to record|to score|\d+\+\s+(yards|receptions|points|assists|made threes|triple double)/i.test(aria);
    });
    
    // Also check for leg-row class or divs with player names + market text
    const hasLegRowClass = div.querySelector('.leg-row') !== null;
    const hasPlayerMarketPattern = /[A-Z][a-z]+\s+[A-Z][a-z]+.*to\s+(record|score).*(triple double|double double|\d+\+\s+\w+)/i.test(text);
    
    return (
      hasOdds ||
      hasLegCards ||
      (hasButtonRole && (hasLegRows || hasLegRowClass)) ||
      (hasLegRows && hasPlayerMarketPattern)
    );
  });

  // Prefer the most specific containers (innermost SGP blocks)
  // The key is to find the div that is the actual SGP container, not a parent that contains multiple SGPs
  // An SGP container should:
  // 1. Have "Same Game Parlay" text
  // 2. Have odds
  // 3. Be the innermost div that contains both the header AND its legs
  // 4. NOT contain other SGP containers (that would be the SGP+ parent)
  
  const containers = candidates.filter((div) => {
    // Exclude if this div contains another candidate (it's a parent, not the actual SGP container)
    const containsOtherSGP = candidates.some((other) => {
      if (other === div) return false;
      return div.contains(other);
    });
    if (containsOtherSGP) return false;
    
    // Exclude if this div is contained within another candidate that has the same characteristics
    const isContained = candidates.some((other) => {
      if (other === div || !other.contains(div)) return false;
      // Both have odds and SGP text, prefer the inner one
      const divHasOdds = !!div.querySelector('span[aria-label^="Odds"]');
      const otherHasOdds = !!other.querySelector('span[aria-label^="Odds"]');
      if (divHasOdds && otherHasOdds) {
        // Prefer the one with more direct leg children (more specific)
        const divLegCount = Array.from(div.querySelectorAll('.leg-row, [aria-label*="To Record"], [aria-label*="To Score"]')).length;
        const otherLegCount = Array.from(other.querySelectorAll('.leg-row, [aria-label*="To Record"], [aria-label*="To Score"]')).length;
        return divLegCount <= otherLegCount;
      }
      return false;
    });
    return !isContained;
  });

  if (!containers.length) {
    return candidates;
  }

  return containers;
};

const findMatchupInText = (text: string): string | null => {
  const cleaned = stripScoreboardText(text.replace(/Finished/gi, " "));
  
  // First try to find matchup patterns in the text
  // Standard pattern for team names starting with capital letters
  const pattern =
    /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})\s+@\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/g;
  let best: string | null = null;

  for (const match of cleaned.matchAll(pattern)) {
    const candidate = normalizeSpaces(`${match[1]} @ ${match[2]}`);
    // Skip if it contains stat/market keywords or looks malformed
    if (/(Rebounds|Record|Assists|Points|Made|Threes|Yards|Receptions)/i.test(candidate)) continue;
    // Skip if team names are too short (likely fragments)
    const teams = candidate.split('@').map(t => t.trim());
    if (teams.some(t => t.length < 4)) continue;
    
    if (!best || candidate.length < best.length) {
      best = candidate;
    }
  }
  
  // Also try pattern for teams starting with digits (like "49ers")
  if (!best) {
    const digitTeamPattern =
      /(\d+[A-Za-z]+(?:\s+[A-Z][A-Za-z']+){0,2})\s+@\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/g;
    for (const match of cleaned.matchAll(digitTeamPattern)) {
      const candidate = normalizeSpaces(`${match[1]} @ ${match[2]}`);
      if (/(Rebounds|Record|Assists|Points|Made|Threes|Yards|Receptions)/i.test(candidate)) continue;
      const teams = candidate.split('@').map(t => t.trim());
      if (teams.some(t => t.length < 4)) continue;
      
      if (!best || candidate.length < best.length) {
        best = candidate;
      }
    }
  }

  if (best) return best;

  const vsPattern =
    /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})\s+vs\.?\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/gi;
  for (const match of cleaned.matchAll(vsPattern)) {
    const candidate = normalizeSpaces(`${match[1]} vs ${match[2]}`);
    if (/(Rebounds|Record|Assists|Points|Made|Threes)/i.test(candidate)) continue;
    const teams = candidate.split(/\s+vs\s+/i).map(t => t.trim());
    if (teams.some(t => t.length < 4)) continue;
    
    if (!best || candidate.length < best.length) {
      best = candidate;
    }
  }

  return best;
};

const cleanMatchupTarget = (
  text: string | null | undefined
): string | undefined => {
  if (!text) return text ?? undefined;
  let normalized = normalizeSpaces(text);

  // Remove common prefixes and noise
  normalized = normalized.replace(
    /^(Same Game Parlay|Parlay|Threes|Made Threes|Double|Triple|TD|DD)\s+/i,
    ""
  );
  
  // Remove "Finished" and related noise
  normalized = normalized.replace(/\s*Finished\s*/gi, " ");
  normalized = normalized.replace(/\s*FinishedFinished\s*/gi, " ");
  normalized = normalized.replace(/\s*Box\s+Score.*$/i, "");
  normalized = normalized.replace(/\s*Play-by-play.*$/i, "");
  
  // Remove trailing player names or fragments (e.g., "Lakers @ Deni Avdija" -> "Lakers @")
  // But DON'T remove team names like "Jazz", "Suns", "Browns", "Broncos"
  // Pattern: "Team1 @ Team2 PlayerFirstname" where PlayerFirstname is a single capitalized word
  // that doesn't look like a team name (3-10 letters, not ending in common team suffixes)
  normalized = normalized.replace(/(@\s+[A-Z][A-Za-z'\s]+?)\s+([A-Z][a-z]{3,10})$/, (match, beforeName, name) => {
    // If it looks like a team name (ends in s, or is a known fragment), keep it
    const teamSuffixes = ['s', 'ers', 'ks'];
    const knownTeamWords = new Set(['jazz', 'heat', 'magic', 'bulls', 'suns', 'hawks', 'nets', '49ers', 'browns', 'broncos', 'chiefs', 'ravens', 'rams']);
    if (teamSuffixes.some(suffix => name.toLowerCase().endsWith(suffix)) || knownTeamWords.has(name.toLowerCase())) {
      return match; // Keep the full match
    }
    // Otherwise it's likely a player name, remove it
    return beforeName;
  });
  
  // Fix partial team names (e.g., "ers @ Arizona Cardinals" -> undefined to force re-extraction)
  // Check if matchup starts with lowercase or looks incomplete
  // Handle special case: "49ers" might become "ers" if digits are stripped
  if (/^[a-z]/.test(normalized) || /^\w{1,3}\s+@/.test(normalized)) {
    // Check if this could be a truncated "49ers"
    if (/^ers\s+@/i.test(normalized)) {
      // Try to reconstruct "San Francisco 49ers"
      const afterAt = normalized.replace(/^ers\s+@\s*/i, "").trim();
      if (afterAt) {
        return `San Francisco 49ers @ ${afterAt}`;
      }
    }
    return undefined;
  }
  
  // Handle "49ers @" without "San Francisco" prefix
  if (/^49ers\s+@/i.test(normalized)) {
    const afterAt = normalized.replace(/^49ers\s+@\s*/i, "").trim();
    if (afterAt) {
      // Don't strip known team city/name combinations
      const knownTeamParts = ['Cardinals', 'Cardinals', 'Broncos', 'Browns', 'Rams', 'Chiefs', 'Ravens'];
      let cleanedAfter = afterAt;
      
      // Only strip if it doesn't contain known team parts
      const containsTeam = knownTeamParts.some(t => afterAt.toLowerCase().includes(t.toLowerCase()));
      if (!containsTeam) {
        cleanedAfter = afterAt.replace(/\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/, "").trim();
      }
      
      return `San Francisco 49ers @ ${cleanedAfter || afterAt}`;
    }
  }
  
  // If we end with "@ " with no team after, it's malformed - try to extract just the first team
  if (/@\s*$/.test(normalized)) {
    const firstTeamMatch = normalized.match(/^([A-Z][A-Za-z'\s]+?)\s+@/);
    if (firstTeamMatch) {
      // We have an incomplete matchup, return undefined to let other logic handle it
      return undefined;
    }
  }

  const direct = findMatchupInText(normalized);
  if (direct) return normalizeSpaces(direct);

  const scorePattern =
    /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})\s+\d{2,}(?:\s+\d{2,})*\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/;
  const scoreMatch = normalized.match(scorePattern);
  if (scoreMatch) {
    return `${normalizeSpaces(scoreMatch[1])} @ ${normalizeSpaces(
      scoreMatch[2]
    )}`;
  }

  const teamMatchup = inferMatchupFromTeams(normalized);
  if (teamMatchup) return teamMatchup;

  return undefined;
};

// Extract team names/matchup from a container or row to identify which game it belongs to
const extractGameMatchup = (element: HTMLElement): string | null => {
  const candidates: HTMLElement[] = [element];
  candidates.push(...Array.from(element.querySelectorAll<HTMLElement>("span, div")));

  for (const candidate of candidates) {
    const text = normalizeSpaces(candidate.textContent || "");
    const aria = normalizeSpaces(candidate.getAttribute("aria-label") || "");
    const combined = `${text} ${aria}`.trim();
    if (!combined) continue;

    const matchup = findMatchupInText(combined);
    if (matchup) return matchup;
  }

  return null;
};

const buildGroupLegFromContainer = (
  container: HTMLElement,
  childRows: HTMLElement[],
  betResult: BetResult,
  headerOdds?: number | null,
  fallbackEventRoot?: HTMLElement
): BetLeg | null => {
  if (!childRows.length) return null;

  const defaultChildResult = (betResult || "pending").toUpperCase() as LegResult;
  let children = buildLegsFromRows(childRows, {
    result: defaultChildResult,
    skipOdds: true,
    fallbackOdds: null,
    parentForResultLookup: container,
  }).map((child) => ({ ...child, odds: null }));
  
  fdDebug(`Built ${children.length} children from rows, results: ${children.map(c => `${c.entities?.[0]}=${c.result}`).join(', ')}`);

  // If any child is VOID (which maps to PUSH), all children in the same SGP should be PUSH
  // This is because when one leg of an SGP is voided, the entire SGP is typically voided
  const hasVoidChild = children.some((child) => {
    const resultStr = String(child.result || "").toUpperCase();
    const isVoid = resultStr === "VOID" || resultStr === "PUSH" || resultStr.includes("VOID");
    if (isVoid) {
      fdDebug(`Found void child in SGP: ${child.entities?.[0]}, result=${child.result}`);
    }
    return isVoid;
  });
  if (hasVoidChild) {
    fdDebug(`Setting all ${children.length} children to PUSH due to void leg`);
    children = children.map((child) => ({
      ...child,
      result: "PUSH" as LegResult,
    }));
  }

  const odds = extractOdds(container) ?? headerOdds ?? null;
  let eventText =
    extractGameMatchup(container) ||
    (fallbackEventRoot ? extractGameMatchup(fallbackEventRoot) : null) ||
    extractGameMatchup(childRows[0]);

  if (!eventText) {
    const combinedText = normalizeSpaces(
      `${container.textContent || ""} ${fallbackEventRoot?.textContent || ""}`
    );
    const match = combinedText.match(
      /(?:^|\s)([A-Za-z][A-Za-z'.\s]+?\s+@\s+[A-Za-z][A-Za-z'.\s]+?)(?:\s|$)/
    );
    if (match && match[1]) {
      eventText = normalizeSpaces(match[1]);
    }
  }

  if (eventText) {
    eventText = normalizeSpaces(stripDateTimeNoise(eventText));
    // Strip stray month tokens that sometimes cling to matchups (e.g., "JazzNov")
    eventText = eventText.replace(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?/gi,
      ""
    );
    const matchupOnly = eventText.match(
      /([A-Z][A-Za-z']+(?:\\s+[A-Z][A-Za-z']+){0,2}\\s+@\\s+[A-Z][A-Za-z']+(?:\\s+[A-Z][A-Za-z']+){0,2})/
    );
    if (matchupOnly && matchupOnly[1]) {
      eventText = matchupOnly[1];
    }
    const refined = cleanMatchupTarget(eventText);
    eventText = refined ? normalizeSpaces(refined) : normalizeSpaces(eventText);
  } else {
    const fallback = cleanMatchupTarget(
      normalizeSpaces(
        `${container.textContent || ""} ${fallbackEventRoot?.textContent || ""}`
      )
    );
    if (fallback) {
      eventText = fallback;
    }
  }

  return {
    market: "Same Game Parlay",
    target: eventText || undefined,
    odds,
    result: aggregateChildResults(children, betResult),
    isGroupLeg: true,
    children,
  };
};

const buildSGPPlusGroupLegs = (
  root: HTMLElement,
  betResult: BetResult
): { groupLegs: BetLeg[]; consumedRows: Set<HTMLElement> } => {
  const containers = findSGPGroupContainers(root);
  const groupLegs: BetLeg[] = [];
  const consumedRows = new Set<HTMLElement>();
  const seenGroupKeys = new Set<string>();

  const containerInfos = containers.map((container) => {
    let childRows = findLegRowsWithin(container);
    if (!childRows.length) {
      childRows = findLegRows(container);
    }
    const odds = extractOdds(container);
    const eventHint =
      extractGameMatchup(container) ||
      (childRows[0] ? extractGameMatchup(childRows[0]) : null) ||
      null;

    return { container, childRows, odds, eventHint };
  });

  const bestByKey = new Map<
    string,
    {
      container: HTMLElement;
      childRows: HTMLElement[];
      odds: number | null | undefined;
      eventHint: string | null;
    }
  >();

  for (const info of containerInfos) {
    const key = `${info.odds ?? "no-odds"}`;
    const existing = bestByKey.get(key);
    if (!existing || info.childRows.length < existing.childRows.length) {
      bestByKey.set(key, info);
    }
  }

  for (const info of bestByKey.values()) {
    const { container, childRows, odds, eventHint } = info;
    consumedRows.add(container);
    childRows.forEach((row) => consumedRows.add(row));

    const childSignature = childRows
      .map((row) => normalizeSpaces(row.textContent || ""))
      .join("|");
    const groupKey = `${odds ?? "no-odds"}|${eventHint ?? ""}|${
      childRows.length
    }|${childSignature.length}`;
    if (seenGroupKeys.has(groupKey)) continue;

    const groupLeg = buildGroupLegFromContainer(
      container,
      childRows,
      betResult,
      odds ?? null,
      root
    );
    if (groupLeg) {
      seenGroupKeys.add(groupKey);
      groupLegs.push(groupLeg);
    }
  }

  return { groupLegs, consumedRows };
};

const buildSGPGroupLegs = (
  headerLi: HTMLElement,
  legRows: HTMLElement[],
  betResult: BetResult,
  headerOdds?: number | null
): { groupLegs: BetLeg[]; consumedRows: Set<HTMLElement> } => {
  const containers = findSGPGroupContainers(headerLi);
  const container = containers[0] ?? headerLi;
  const consumedRows = new Set<HTMLElement>();
  consumedRows.add(container);

  let childRows = findLegRowsWithin(container);
  if (!childRows.length || (legRows.length && childRows.length < legRows.length)) {
    childRows = legRows;
  }
  childRows.forEach((row) => consumedRows.add(row));

  const groupLeg = buildGroupLegFromContainer(
    container,
    childRows,
    betResult,
    extractOdds(container) ?? headerOdds ?? null,
    headerLi
  );

  return {
    groupLegs: groupLeg ? [groupLeg] : [],
    consumedRows,
  };
};

// A scoped leg-row finder that stays within the SGP container.
// CRITICAL: Only finds legs that are direct children/descendants of THIS specific container.
// Must NOT find legs from sibling SGP containers or parent SGP+ containers.
const findLegRowsWithin = (container: HTMLElement): HTMLElement[] => {
  const candidates: HTMLElement[] = [];

  // FanDuel leg cards often render as generic divs with this class cluster (no aria-label/odds).
  // Capture them up front so we don't miss SGP selections that hide deeper in the DOM.
  candidates.push(
    ...Array.from(
      container.querySelectorAll<HTMLElement>("div.v.z.x.y.jk.t.ab.h")
    )
  );

  // CRITICAL: Only search within this container, not in parent or sibling elements
  // The container should be the innermost div that contains the SGP header and its legs
  
  // First, look for elements with class="leg-row" that are direct descendants
  const legRows = Array.from(container.querySelectorAll<HTMLElement>(".leg-row"));
  candidates.push(...legRows);

  // Also look for elements with aria-label that contain leg information
  // But ONLY if they are within this container's DOM tree
  candidates.push(
    ...Array.from(
      container.querySelectorAll<HTMLElement>("[aria-label]")
    ).filter((el) => {
      const tagName = el.tagName.toLowerCase();
      // Exclude spans, but include divs and other elements
      if (tagName === "span") return false;
      
      // Exclude the SGP header itself
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      if (aria.includes("same game parlay") && !aria.includes("to record") && !aria.includes("to score") && !aria.includes("triple double")) {
        return false;
      }
      
      // The element should be contained within the container
      // querySelectorAll already ensures this, but we need to make sure
      // we're not picking up elements from sibling SGP containers
      // Check if there's another SGP container between el and container
      let current: HTMLElement | null = el.parentElement;
      while (current && current !== container) {
        const currentText = normalizeSpaces(current.textContent || "").toLowerCase();
        // If we hit another SGP container (not the one we're looking for), this element is in the wrong container
        if (currentText.includes("same game parlay") && 
            !currentText.includes("parlay+") && 
            !currentText.includes("includes:") &&
            current !== container) {
          // Check if this is a different SGP container (has its own odds)
          const hasOwnOdds = !!current.querySelector('span[aria-label^="Odds"]');
          if (hasOwnOdds) {
            // This element belongs to a different SGP container
            return false;
          }
        }
        current = current.parentElement;
      }
      
      return true;
    })
  );

  // Also check for divs that are parents of odds spans
  const oddsSpans = Array.from(
    container.querySelectorAll<HTMLElement>('span[aria-label^="Odds"]')
  );
  for (const span of oddsSpans) {
    const parentDiv = span.closest<HTMLElement>("div");
    if (parentDiv && !candidates.includes(parentDiv)) {
      // Make sure it's not the SGP container itself
      const parentAria = (parentDiv.getAttribute("aria-label") || "").toLowerCase();
      if (!parentAria.includes("same game parlay") || parentAria.includes("to record") || parentAria.includes("to score") || parentAria.includes("triple double")) {
        candidates.push(parentDiv);
      }
    }
  }
  
  // Also look for divs that contain player names + "To Record" or "To Score" patterns
  // This catches legs that might not have aria-labels or leg-row class
  const allDivs = Array.from(container.querySelectorAll<HTMLElement>("div"));
  for (const div of allDivs) {
    if (candidates.includes(div)) continue;
    
    const text = normalizeSpaces(div.textContent || "");
    const aria = normalizeSpaces(div.getAttribute("aria-label") || "");
    const combined = `${text} ${aria}`.toLowerCase();
    
    // Look for pattern: Player Name + "To Record" or "To Score" + market type
    const hasPlayerAndMarket = /[A-Z][a-z]+\s+[A-Z][a-z]+.*to\s+(record|score).*(triple double|double double|\d+\+\s+(assists|points|rebounds|yards|receptions|made threes))/i.test(combined);
    
    if (hasPlayerAndMarket) {
      // Make sure it's not the container itself or a header
      if (div !== container && !combined.includes("same game parlay") && !combined.includes("includes:")) {
        candidates.push(div);
      }
    }
  }

  const marketPattern =
    /SPREAD BETTING|MONEYLINE|TOTAL|TO RECORD|TO SCORE|MADE THREES|ASSISTS|REBOUNDS|POINTS|OVER|UNDER|YARDS|RECEPTIONS|REC\b|YDS|TRIPLE DOUBLE|DOUBLE DOUBLE/i;

  const filtered = candidates.filter((node) => {
    const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
    const text = normalizeSpaces(node.textContent || "");
    const hasOdds = !!node.querySelector<HTMLElement>(
      'span[aria-label^="Odds"]'
    );
    const hasMarket = marketPattern.test(aria) || marketPattern.test(text);
    const isFooterLike =
      /TOTAL WAGER|BET ID|PLACED:/i.test(text) || /TOTAL WAGER/i.test(aria);
    const hasLetters = /[A-Za-z]{3,}/.test(aria || text);
    
    // Exclude SGP header text (but allow if it has market indicators)
    const isSGPHeader = /^same\s+game\s+parlay/i.test(aria) && !hasMarket;
    
    // Check if this looks like a player name + market (common pattern in SGP legs)
    const hasPlayerNamePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/i.test(aria || text);
    const hasPlayerAndMarket = hasPlayerNamePattern && hasMarket;

    if (isFooterLike) return false;
    if (isSGPHeader) return false;
    if (!hasLetters) return false;
    
    // For SGP inner legs, accept if:
    // 1. Has odds (individual leg with odds)
    // 2. Has market text (leg with market indicator)
    // 3. Has player name + market pattern (player name followed by market)
    return hasOdds || hasMarket || hasPlayerAndMarket;
  });

  // Deduplicate by containment to keep top-level rows only
  // But be careful - we want to keep all distinct legs, even if one contains another
  // (e.g., a parent div might contain a leg-row child)
  const unique: HTMLElement[] = [];
  const seenText = new Set<string>();
  
  for (const node of filtered) {
    const text = normalizeSpaces(node.textContent || "");
    const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
    
    // Create a signature based on player name + market to identify unique legs
    const playerMatch = (text || aria).match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    const marketMatch = (text || aria).match(/(to\s+record|to\s+score|triple\s+double|\d+\+\s+(assists|points|rebounds|yards|receptions|made\s+threes))/i);
    
    if (playerMatch && marketMatch) {
      const signature = `${playerMatch[1]}_${marketMatch[1]}`.toLowerCase();
      if (seenText.has(signature)) continue;
      seenText.add(signature);
    }
    
    // Also check if this node is contained within another candidate
    // Only exclude if it's truly a duplicate (same content)
    const isContained = filtered.some((other) => {
      if (other === node || !other.contains(node)) return false;
      const otherText = normalizeSpaces(other.textContent || "");
      const otherAria = normalizeSpaces(other.getAttribute("aria-label") || "");
      // If the containing node has the same player+market, it's a duplicate
      return (text && otherText.includes(text)) || (aria && otherAria.includes(aria));
    });
    
    if (!isContained) {
      unique.push(node);
    }
  }

  return unique;
};

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
  formatLegSummary,
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

const looksLikeStatTarget = (target: string | null | undefined): boolean => {
  if (!target) return false;
  const trimmed = target.trim();
  if (!trimmed) return false;
  // If it contains any letters, it's probably not a pure stat threshold.
  if (/[A-Za-z]/.test(trimmed)) return false;
  // Simple patterns like "50", "50.5", "3+", "10.5+"
  return /^-?\d+(?:\.\d+)?\+?$/.test(trimmed);
};

const looksLikeMatchupText = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const lower = value.toLowerCase();
  if (/@/.test(value)) return true;
  if (lower.includes(" vs ")) return true;
  if (lower.includes(" at ")) return true;
  return false;
};

const extractOddsMatchups = (text: string): Map<number, string> => {
  const map = new Map<number, string>();
  if (!text) return map;
  const normalized = normalizeSpaces(text);
  const sgpPattern =
    /Same Game Parlay™\s*\+?(-?\d+)\s+([A-Z][A-Za-z'\s]+@\s+[A-Z][A-Za-z'\s]+)/gi;
  for (const match of normalized.matchAll(sgpPattern)) {
    const oddsVal = parseInt(match[1], 10);
    const matchup = normalizeSpaces(match[2]);
    if (!Number.isNaN(oddsVal)) map.set(oddsVal, matchup);
  }

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
    const legsFromStatText = buildLegsFromStatText(
      headerInfo.rawText,
      legFallbackResult
    );
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
      const bucket = groupedByOdds.get(oddsVal) ?? {
        rows: [],
        legs: [] as BetLeg[],
      };
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
    betType === "sgp" ? [] : legRows.filter((row) => !consumedRows.has(row));
  const extraLegs = remainingRows.length
    ? buildCombinedLegs(remainingRows)
    : [];

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
    const hasAdditionalSelections =
      /includes:\s*\d+\s+same\s+game\s+parlay\s*\+\s*\d+\s+selection/i.test(
        descriptionText
      ) ||
      /includes:\s*\d+\s+same\s+game\s+parlay.*\+.*selection/i.test(
        descriptionText
      );

    // Extract all legs from raw text if we have few/no extra legs or description indicates additional selections
    if (filteredExtras.length === 0 || hasAdditionalSelections) {
      const allLegsFromText = buildLegsFromStatText(
        headerInfo.rawText,
        "PENDING"
      );

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
  // Map combined SGP odds → matchup text (e.g. "+3623 → Golden State @ New Orleans")
  const oddsMatchups = extractOddsMatchups(headerInfo.rawText);

  /**
   * IMPORTANT:
   * - For **straight parlays** we do NOT want per-leg `game` fields in the fixture.
   * - For **SGP / SGP+** we *do* want to infer matchup context onto:
   *   - SGP group legs: `target = "Team A @ Team B"`
   *   - SGP+ extra legs: `game = "Team A @ Team B"` when we can infer it
   */
  if (betType === "sgp" || betType === "sgp_plus") {
    legs.forEach((leg) => {
      if (leg.isGroupLeg) {
        // Group leg: normalize its target to a clean matchup string
        const fromTarget = leg.target || "";
        const fromOdds =
          leg.odds != null ? oddsMatchups.get(leg.odds) ?? "" : "";
        const rawTarget = normalizeSpaces(
          fromTarget ||
            fromOdds ||
            `${headerInfo.rawText} ${headerLi.textContent || ""}`
        );

        const cleanedTarget =
          cleanMatchupTarget(stripScoreboardText(rawTarget)) || leg.target;

        if (cleanedTarget && looksLikeMatchupText(cleanedTarget)) {
          leg.target = cleanedTarget;
        } else if (cleanedTarget) {
          // Fallback – still normalize whitespace
          leg.target = normalizeSpaces(cleanedTarget);
        }
      } else {
        const hasStatTarget = looksLikeStatTarget(leg.target);
        const currentTarget = leg.target || "";

        // --- 1) Try to infer matchup from odds (header text) ---
        if (!(leg as any).game && leg.odds != null) {
          const rawMatchup = oddsMatchups.get(leg.odds);
          if (rawMatchup && looksLikeMatchupText(rawMatchup)) {
            const cleanedMatchup =
              cleanMatchupTarget(stripScoreboardText(rawMatchup)) || rawMatchup;
            (leg as any).game = normalizeSpaces(cleanedMatchup);

            // Only set `target` from matchup when we *don't* already have a stat threshold.
            if (!hasStatTarget && !currentTarget) {
              leg.target = (leg as any).game;
            }
          }
        }

        // --- 2) If we still don't have a game, infer from header/entity teams ---
        if (!(leg as any).game) {
          const inferred =
            inferMatchupForEntity(headerInfo.rawText, leg.entities?.[0]) ||
            inferMatchupFromTeams(headerInfo.rawText);

          if (inferred && looksLikeMatchupText(inferred)) {
            const cleanedMatchup =
              cleanMatchupTarget(stripScoreboardText(inferred)) || inferred;
            (leg as any).game = normalizeSpaces(cleanedMatchup);

            if (!hasStatTarget && !leg.target) {
              leg.target = (leg as any).game;
            }
          }
        }

        // --- 3) If the *target itself* looks like matchup text, keep it aligned with `game` ---
        const maybeMatchup = leg.target;
        if (
          maybeMatchup &&
          !hasStatTarget &&
          looksLikeMatchupText(maybeMatchup)
        ) {
          const cleanedMatchup =
            cleanMatchupTarget(stripScoreboardText(maybeMatchup)) ||
            maybeMatchup;
          const normalized = normalizeSpaces(cleanedMatchup);

          if (!(leg as any).game) {
            (leg as any).game = normalized;
          }
          leg.target = normalized;
        }
      }
    });
  }

  // NOTE: for betType === "parlay" we intentionally DO NOT touch `leg.game` or
  //      force matchup targets here. Straight parlay legs should remain
  //      game-agnostic in the final fixture.

  // Extra cleanup for SGP+ bets: ensure matchup text lives on `game`
  // and does not overwrite real stat targets (e.g. "50+", "3+").
  if (betType === "sgp_plus" && legs.length) {
    legs.forEach((leg) => {
      if (leg.isGroupLeg) return;

      const currentTarget = leg.target;
      const hasStatTarget = looksLikeStatTarget(currentTarget);

      if (
        currentTarget &&
        !hasStatTarget &&
        looksLikeMatchupText(currentTarget)
      ) {
        const cleanedMatchup =
          cleanMatchupTarget(stripScoreboardText(currentTarget)) ||
          currentTarget;
        // Prefer cleaned matchup on `game`
        (leg as any).game = (leg as any).game || cleanedMatchup;
        // For SGP+ extra legs we don't want the matchup duplicated in `target`;
        // keep `target` only for true stat thresholds.
        leg.target = hasStatTarget ? currentTarget : undefined;
      }

      const gameVal = (leg as any).game as string | undefined;
      if (gameVal) {
        const cleanedGame =
          cleanMatchupTarget(stripScoreboardText(gameVal)) || gameVal;
        (leg as any).game = cleanedGame;
      }
    });
  }

  if (betType === "sgp" && legs.length) {
    const childResult = toLegResult(result);
    legs.forEach((leg) => {
      if (leg.children) {
        leg.children = leg.children.map((child) => ({
          ...child,
          result: childResult,
        }));
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
    const settledLegs = allLegResults.filter(
      (r) =>
        r &&
        r !== "PENDING" &&
        r !== "pending" &&
        r !== "UNKNOWN" &&
        r !== "unknown"
    );
    const allWins =
      settledLegs.length > 0 &&
      settledLegs.every((r) => r === "WIN" || r === "win");

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

  const description = legs.length
    ? shouldCondenseGroupDescription
      ? `${formatParlayDescriptionFromLegs(legs[0].children || [])}${
          legs[0].target ? ` ${legs[0].target}` : ""
        }`.trim()
      : formatParlayDescriptionFromLegs(legs)
    : formatDescription(
        headerInfo.description,
        headerInfo.type,
        headerInfo.name,
        headerInfo.line,
        headerInfo.ou,
        betType
      );

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

  const buildSGPPlusDescription = (legsForDesc: BetLeg[]): string => {
    if (!legsForDesc.length) return description;

    const groupLegs = legsForDesc.filter((l) => l.isGroupLeg);
    const extraLegs = legsForDesc.filter((l) => !l.isGroupLeg);

    const collectChildSummaries = (group: BetLeg): string[] =>
      (group.children || []).map(formatLegSummary).filter(Boolean);

    // Case: multiple SGP group legs with no extra legs – flatten all children.
    // (Matches the "Davante / Kupp / Addison / Odunze Rec ladders" fixture.)
    if (groupLegs.length > 1 && extraLegs.length === 0) {
      const allChildSummaries: string[] = [];
      groupLegs.forEach((g) => {
        allChildSummaries.push(...collectChildSummaries(g));
      });
      return allChildSummaries.join(", ");
    }

    const primaryGroup = groupLegs[0];
    const groupChildren = primaryGroup?.children || [];
    const groupMatchup = primaryGroup?.target 
      ? shortenMatchupForDescription(primaryGroup.target) 
      : "";
    const childSummaries = primaryGroup
      ? collectChildSummaries(primaryGroup)
      : [];
    const extraSummaries = extraLegs.map(formatLegSummary).filter(Boolean);

    // Special-case: Rec-only SGP+ with a single extra leg (matches 0027973 fixture).
    const isRecOnlyGroup =
      primaryGroup &&
      groupChildren.length > 0 &&
      groupChildren.every((c) => (c.market || "").toLowerCase() === "rec");
    const isRecOnlyExtra =
      extraLegs.length === 1 &&
      (extraLegs[0].market || "").toLowerCase() === "rec";

    if (
      primaryGroup &&
      extraLegs.length === 1 &&
      isRecOnlyGroup &&
      isRecOnlyExtra
    ) {
      const baseLegCount =
        (primaryGroup.children ? primaryGroup.children.length : 0) +
        extraLegs.length;
      const label =
        baseLegCount > 0
          ? `${baseLegCount}-leg Same Game Parlay Plus:`
          : "Same Game Parlay Plus:";
      const sgpChunk = groupMatchup ? `SGP (${groupMatchup})` : "SGP";
      return `${label} ${sgpChunk} + ${extraSummaries[0]}`.trim();
    }

    // Default SGP+ format with a single SGP group and zero or more extra legs.
    if (primaryGroup) {
      let sgpChunk: string;
      if (groupMatchup) {
        if (childSummaries.length) {
          sgpChunk = `SGP (${groupMatchup} - ${childSummaries.join(", ")})`;
        } else {
          sgpChunk = `SGP (${groupMatchup})`;
        }
      } else if (childSummaries.length) {
        sgpChunk = `SGP (${childSummaries.join(", ")})`;
      } else {
        sgpChunk = "SGP";
      }

      if (extraSummaries.length === 0) {
        const count =
          primaryGroup.children && primaryGroup.children.length
            ? primaryGroup.children.length
            : 0;
        return count
          ? `${count}-leg Same Game Parlay Plus: ${sgpChunk}`
          : sgpChunk;
      }

      const count =
        (primaryGroup.children ? primaryGroup.children.length : 0) +
        extraSummaries.length;
      const suffix = [sgpChunk, ...extraSummaries].join(" + ");
      return `${count}-leg Same Game Parlay Plus: ${suffix}`;
    }

    // Fallback: just describe from legs normally.
    return formatParlayDescriptionFromLegs(legsForDesc);
  };

  // If the description is still just generic SGP text, fall back to leg summary when available.
  const finalDescription =
    betType === "sgp_plus" && legs.length
      ? buildSGPPlusDescription(legs)
      : legs.length && /same game parlay/i.test(description)
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
    const hasSGPText =
      text.includes("same game parlay") ||
      text.includes("same game parlay™") ||
      text.includes("same game parlaytm");
    if (!hasSGPText) return false;

    // Exclude SGP+ parent containers
    if (text.includes("parlay+") || text.includes("parlay plus")) return false;
    if (text.includes("includes:")) return false;

    // Must have an odds span to be a real SGP block
    // Also check for role="button" which is common in SGP containers
    const hasOdds = !!div.querySelector('span[aria-label^="Odds"]');
    const hasLegCards = div.querySelector("div.v.z.x.y.jk.t.ab.h") !== null;
    const hasButtonRole =
      div.getAttribute("role") === "button" ||
      div.querySelector('[role="button"]') !== null;

    // SGP containers typically have either odds or are button-like containers
    // Also check if this div contains leg rows (aria-label elements with market text)
    const hasLegRows = Array.from(div.querySelectorAll("[aria-label]")).some(
      (el) => {
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        return /to record|to score|\d+\+\s+(yards|receptions|points|assists|made threes|triple double)/i.test(
          aria
        );
      }
    );

    // Also check for leg-row class or divs with player names + market text
    const hasLegRowClass = div.querySelector(".leg-row") !== null;
    const hasPlayerMarketPattern =
      /[A-Z][a-z]+\s+[A-Z][a-z]+.*to\s+(record|score).*(triple double|double double|\d+\+\s+\w+)/i.test(
        text
      );

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
        const divLegCount = Array.from(
          div.querySelectorAll(
            '.leg-row, [aria-label*="To Record"], [aria-label*="To Score"]'
          )
        ).length;
        const otherLegCount = Array.from(
          other.querySelectorAll(
            '.leg-row, [aria-label*="To Record"], [aria-label*="To Score"]'
          )
        ).length;
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

// Known team nicknames to validate matchup extraction
const TEAM_NICKNAMES = new Set([
  'ravens', 'browns', 'chiefs', 'broncos', 'seahawks', 'rams', 'cardinals', '49ers', 'niners',
  'bills', 'dolphins', 'patriots', 'jets', 'steelers', 'bengals', 'cowboys', 'eagles', 'giants',
  'commanders', 'bears', 'lions', 'packers', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers',
  'colts', 'texans', 'jaguars', 'titans', 'raiders', 'chargers', 'broncos',
  // NBA
  'hawks', 'celtics', 'nets', 'hornets', 'bulls', 'cavaliers', 'mavericks', 'nuggets', 'pistons',
  'warriors', 'rockets', 'pacers', 'clippers', 'lakers', 'grizzlies', 'heat', 'bucks', 'timberwolves',
  'pelicans', 'knicks', 'thunder', 'magic', 'sixers', '76ers', 'suns', 'blazers', 'trail blazers',
  'kings', 'spurs', 'raptors', 'jazz', 'wizards',
]);

// Strip trailing player names from matchup string
const stripTrailingPlayerName = (matchup: string): string => {
  // Split by "@" or "vs"
  const parts = matchup.split(/\s+@\s+|\s+vs\.?\s+/i);
  if (parts.length !== 2) return matchup;

  const separator = matchup.includes('@') ? ' @ ' : ' vs ';
  const team1 = parts[0].trim();
  let team2 = parts[1].trim();

  // Check if team2 ends with a known team nickname - if so, strip anything after it
  const team2Words = team2.split(/\s+/);
  for (let i = team2Words.length - 1; i >= 0; i--) {
    const word = team2Words[i].toLowerCase();
    if (TEAM_NICKNAMES.has(word)) {
      // Found team nickname - keep only words up to and including this one
      team2 = team2Words.slice(0, i + 1).join(' ');
      break;
    }
  }

  return `${team1}${separator}${team2}`;
};

// Map of full team names to short names for description purposes
const TEAM_SHORT_NAMES: { [key: string]: string } = {
  'Detroit Pistons': 'Detroit',
  'Atlanta Hawks': 'Atlanta',
  'Utah Jazz': 'Utah',
  'Los Angeles Lakers': 'Lakers',
  'Los Angeles Clippers': 'Clippers',
  'Golden State Warriors': 'Golden State',
  'New Orleans Pelicans': 'New Orleans',
  'Phoenix Suns': 'Phoenix',
  'Portland Trail Blazers': 'Portland',
  'Chicago Bulls': 'Chicago',
  'Orlando Magic': 'Orlando',
  'San Francisco 49ers': 'San Francisco',
  // Keep Seattle Seahawks as-is (not shortened)
  'Kansas City Chiefs': 'Kansas City',
  'Denver Broncos': 'Denver',
  'Baltimore Ravens': 'Baltimore',
  'Cleveland Browns': 'Cleveland',
  'Arizona Cardinals': 'Arizona',
  'Dallas Mavericks': 'Dallas',
};

// Shorten team names in matchup for description purposes
const shortenMatchupForDescription = (matchup: string): string => {
  if (!matchup) return matchup;
  let shortened = matchup;
  for (const [full, short] of Object.entries(TEAM_SHORT_NAMES)) {
    shortened = shortened.replace(new RegExp(full, 'gi'), short);
  }
  return shortened;
};

const findMatchupInText = (text: string): string | null => {
  const cleaned = stripScoreboardText(text.replace(/Finished/gi, " "));
  const pattern =
    /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})\s+@\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/g;
  let best: string | null = null;

  for (const match of cleaned.matchAll(pattern)) {
    let candidate = normalizeSpaces(`${match[1]} @ ${match[2]}`);
    if (/(Rebounds|Record|Assists|Points|Made)/i.test(candidate)) continue;
    // Strip any trailing player name that got captured
    candidate = stripTrailingPlayerName(candidate);
    if (!best || candidate.length < best.length) {
      best = candidate;
    }
  }

  if (best) return best;

  const vsPattern =
    /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})\s+vs\.?\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/gi;
  for (const match of cleaned.matchAll(vsPattern)) {
    let candidate = normalizeSpaces(`${match[1]} vs ${match[2]}`);
    if (/(Rebounds|Record|Assists|Points|Made)/i.test(candidate)) continue;
    // Strip any trailing player name that got captured
    candidate = stripTrailingPlayerName(candidate);
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

  normalized = normalized.replace(
    /^(Same Game Parlay|Parlay|Threes|Made Threes|Double|TD)\s+/i,
    ""
  );

  const direct = findMatchupInText(normalized);
  if (direct) return normalizeSpaces(direct);

  // Try inferring from team names first (more reliable than score pattern)
  const teamMatchup = inferMatchupFromTeams(normalized);
  if (teamMatchup) return teamMatchup;

  // Score pattern as last resort: "Team1 35 29 36 27 Team2"
  // But be careful not to match player names or artifact text
  const scorePattern =
    /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})\s+\d{2,}(?:\s+\d{2,})*\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/;
  const scoreMatch = normalized.match(scorePattern);
  if (scoreMatch) {
    const team1 = normalizeSpaces(scoreMatch[1]);
    const team2 = normalizeSpaces(scoreMatch[2]);
    // Validate that both look like team names (not player names, not "Finished", etc.)
    const isValidTeam = (name: string): boolean => {
      const lower = name.toLowerCase();
      // Reject if it contains scoreboard artifacts
      if (/finished|box\s*score|play.by.play/i.test(name)) return false;
      // Reject if it looks like a player name (first last format without city)
      if (name.split(/\s+/).length === 2) {
        // Check if it's a known team nickname
        const lastWord = name.split(/\s+/).pop()?.toLowerCase() || '';
        if (!TEAM_NICKNAMES.has(lastWord)) return false;
      }
      return true;
    };
    if (isValidTeam(team1) && isValidTeam(team2)) {
      return `${team1} @ ${team2}`;
    }
  }

  return undefined;
};

// Extract team names/matchup from a container or row to identify which game it belongs to
const extractGameMatchup = (element: HTMLElement): string | null => {
  const candidates: HTMLElement[] = [element];
  candidates.push(
    ...Array.from(element.querySelectorAll<HTMLElement>("span, div"))
  );

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

  const defaultChildResult = (
    betResult || "pending"
  ).toUpperCase() as LegResult;
  const children = buildLegsFromRows(childRows, {
    result: defaultChildResult,
    skipOdds: true,
    fallbackOdds: null,
    parentForResultLookup: container,
  }).map((child) => ({ ...child, odds: null }));

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
      /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2}\s+@\s+[A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2})/
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
  if (
    !childRows.length ||
    (legRows.length && childRows.length < legRows.length)
  ) {
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
  const legRows = Array.from(
    container.querySelectorAll<HTMLElement>(".leg-row")
  );
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
      if (
        aria.includes("same game parlay") &&
        !aria.includes("to record") &&
        !aria.includes("to score") &&
        !aria.includes("triple double")
      ) {
        return false;
      }

      // The element should be contained within the container
      // querySelectorAll already ensures this, but we need to make sure
      // we're not picking up elements from sibling SGP containers
      // Check if there's another SGP container between el and container
      let current: HTMLElement | null = el.parentElement;
      while (current && current !== container) {
        const currentText = normalizeSpaces(
          current.textContent || ""
        ).toLowerCase();
        // If we hit another SGP container (not the one we're looking for), this element is in the wrong container
        if (
          currentText.includes("same game parlay") &&
          !currentText.includes("parlay+") &&
          !currentText.includes("includes:") &&
          current !== container
        ) {
          // Check if this is a different SGP container (has its own odds)
          const hasOwnOdds = !!current.querySelector(
            'span[aria-label^="Odds"]'
          );
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
      const parentAria = (
        parentDiv.getAttribute("aria-label") || ""
      ).toLowerCase();
      if (
        !parentAria.includes("same game parlay") ||
        parentAria.includes("to record") ||
        parentAria.includes("to score") ||
        parentAria.includes("triple double")
      ) {
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
    const hasPlayerAndMarket =
      /[A-Z][a-z]+\s+[A-Z][a-z]+.*to\s+(record|score).*(triple double|double double|\d+\+\s+(assists|points|rebounds|yards|receptions|made threes))/i.test(
        combined
      );

    if (hasPlayerAndMarket) {
      // Make sure it's not the container itself or a header
      if (
        div !== container &&
        !combined.includes("same game parlay") &&
        !combined.includes("includes:")
      ) {
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
    const hasPlayerNamePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/i.test(
      aria || text
    );
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
    const marketMatch = (text || aria).match(
      /(to\s+record|to\s+score|triple\s+double|\d+\+\s+(assists|points|rebounds|yards|receptions|made\s+threes))/i
    );

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
      return (
        (text && otherText.includes(text)) || (aria && otherAria.includes(aria))
      );
    });

    if (!isContained) {
      unique.push(node);
    }
  }

  return unique;
};

import { Bet, BetResult, BetType, SportsbookName } from "../../types";
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
} from "./common";

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

  // Bet-level odds are shown once at the top of the parlay card
  const betOdds = headerInfo.odds ?? 0;

  // Build legs from structured rows and textual description together
  // Extract individual leg odds when available - they're useful even for SGPs
  const skipLegOdds = false;
  const legsFromRows = buildLegsFromRows(legRows, result, skipLegOdds);
  const legsFromDescription = headerInfo.description
    ? buildLegsFromDescription(headerInfo.description, result, skipLegOdds)
    : [];
  const baseLegs = [...legsFromRows, ...legsFromDescription];
  
  // For SGP+ bets, always try to extract from raw text to catch nested SGP legs
  // For other bets, only do this if we have fewer than 2 legs
  const isSGPPlusStructure = isSGPPlus(headerInfo.rawText);
  const shouldPullExtras = baseLegs.length < 2 || isSGPPlusStructure;
  
  const legsFromStatText = shouldPullExtras
    ? buildLegsFromStatText(headerInfo.rawText, result)
    : [];
  const legsFromSpans = shouldPullExtras
    ? buildLegsFromSpans(headerLi, result)
    : [];

  const fallbackHeaderLegs =
    !baseLegs.length && !legsFromStatText.length && !legsFromSpans.length
      ? buildLegsFromRows([headerLi], result)
      : [];

  const legs = dedupeLegs(
    dropGenericDuplicateLegs(
      filterMeaningfulLegs([
        ...baseLegs,
        ...legsFromStatText,
        ...legsFromSpans,
        ...fallbackHeaderLegs,
      ])
    )
  );

  // Check if this is an SGP+ structure
  // In SGP+, nested SGPs have multiple legs but share one combined odds value
  // This is expected behavior - missing odds in some legs is normal for SGP+ structure
  // (isSGPPlusStructure already declared above)
  
  if (isSGPPlusStructure && legs.length > 0) {
    // For SGP+, some legs may be missing individual odds because they're part of an SGP
    // that has a combined odds value. This is expected and not an error.
    // The SGP+ itself has the overall parlay odds, and each nested SGP has its combined odds.
    // Individual legs within an SGP don't have separate odds - they share the SGP's odds.
  }

  const description = legs.length
    ? formatParlayDescriptionFromLegs(legs)
    : formatDescription(
        headerInfo.description,
        headerInfo.type,
        headerInfo.name,
        headerInfo.line,
        headerInfo.ou,
        betType
      );

  // Give SGPs an explicit short name so UI doesn't fall back to generic header text.
  const legCount = legs.length || legRows.length || undefined;
  const betName =
    betType === "sgp"
      ? legCount
        ? `SGP (${legCount} legs)`
        : "SGP"
      : undefined;

  // If the description is still just generic SGP text, fall back to leg summary when available.
  const finalDescription =
    legs.length && /same game parlay/i.test(description)
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

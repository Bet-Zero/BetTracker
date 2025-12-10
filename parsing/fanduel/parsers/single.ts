import {
  Bet,
  BetType,
  BetResult,
  SportsbookName,
  BetLeg,
} from "../../../types";
import {
  HeaderInfo,
  buildPrimaryLegsFromHeader,
  formatDescription,
  inferMarketCategory,
} from "./common";

export interface SingleBetParams {
  headerLi: HTMLElement;
  betId: string;
  placedAtISO: string;
  meta: {
    stake: number | null;
    payout: number | null;
    rawText: string;
  };
  result: BetResult;
  book: SportsbookName;
  headerInfo: HeaderInfo;
}

export const parseSingleBet = ({
  headerLi,
  betId,
  placedAtISO,
  meta,
  result,
  book,
  headerInfo,
}: SingleBetParams): Bet => {
  const betType: BetType = "single";
  const marketCategory = inferMarketCategory(betType, headerInfo.type);

  // Format the final description
  let finalDescription = formatDescription(
    headerInfo.description,
    headerInfo.type,
    headerInfo.name,
    headerInfo.line,
    headerInfo.ou,
    betType
  );

  // For spread bets, name should not include the line
  let finalName = headerInfo.name;
  if (
    headerInfo.type === "Spread" &&
    headerInfo.line &&
    finalName?.includes(headerInfo.line)
  ) {
    finalName = finalName
      .replace(
        new RegExp(
          `\\s*[\\+\\-]?${headerInfo.line.replace(/[.+]/g, "\\$&")}\\s*$`
        ),
        ""
      )
      .trim();
  }

  // Build a single leg from header info
  const legs: BetLeg[] = buildPrimaryLegsFromHeader(
    headerInfo,
    result,
    betType,
    finalDescription
  );

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
    name: finalName,
    odds: headerInfo.odds ?? 0,
    stake: meta.stake ?? 0,
    payout: meta.payout ?? 0,
    result,
    type: headerInfo.type,
    line: headerInfo.line,
    ou: headerInfo.ou,
    legs,
    tail: "",
    raw: `${headerInfo.rawText}\n----\n${meta.rawText}`,
    isLive: headerInfo.isLive,
    isSample: false,
  };

  return bet;
};

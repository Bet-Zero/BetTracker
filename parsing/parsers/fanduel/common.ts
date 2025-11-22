import {
  BetLeg,
  BetResult,
  BetType,
  MarketCategory,
  SportsbookName,
} from "../../types";

export const FD_DEBUG = false;
export const fdDebug = (...args: any[]) => {
  if (!FD_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[FD-DEBUG]", ...args);
};

export const normalizeSpaces = (text: string): string =>
  (text || "").replace(/\s+/g, " ").trim();

// Remove schedule/time fragments that sometimes get glued to player names
// e.g., "Nov 16, 8:12pm ET Isaiah Collier ..." or "7:42pm ET Josh Giddey"
export const stripDateTimeNoise = (text: string): string => {
  if (!text) return "";

  let cleaned = text.replace(
    /[A-Z][a-z]{2}\s+\d{1,2},\s*\d{1,2}:\d{2}\s*(?:am|pm)\s*ET/gi,
    " "
  );

  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)\s*ET\b/gi, " ");

  // In some HTML snippets the month is jammed against the matchup (e.g., "SunsNov 16, 8:12pm ET")
  cleaned = cleaned.replace(
    /(?:@|\bat\b)?\s*[A-Z][a-z]+\s*[A-Z][a-z]+Nov\s+\d{1,2},\s*\d{1,2}:\d{2}\s*(?:am|pm)\s*ET/gi,
    " "
  );

  return normalizeSpaces(cleaned);
};

export const stripScoreboardText = (text: string): string => {
  let cleaned = normalizeSpaces(text)
    .replace(/Finished/gi, " ")
    .replace(/Box Score.*$/i, " ")
    .replace(/Play-by-play.*$/i, " ");

  // Drop embedded schedule/date fragments that sometimes stick to names
  cleaned = stripDateTimeNoise(cleaned);

  // Remove sequences of quarter/period scores
  cleaned = cleaned.replace(/\b\d{1,3}\b(\s+\d{1,3}){3,}/g, " ");

  // Remove long numeric IDs/score blobs that can cling to names
  cleaned = cleaned.replace(/\b\d{6,}\b/g, " ");

  // Remove trailing actual/stat pairs like "3 6" that follow leg lines
  cleaned = cleaned.replace(/\s+\d{1,3}\s+\d{1,3}\s*$/g, " ");

  return normalizeSpaces(cleaned);
};

export const PLAYER_NAME_PATTERN =
  "[A-Z][A-Za-z'\\.]+(?:\\s+[A-Z][A-Za-z'\\.]+)*";

const TEAM_TOKENS = new Set(
  [
    "spurs",
    "grizzlies",
    "hawks",
    "magic",
    "pistons",
    "pelicans",
    "warriors",
    "mavericks",
    "blazers",
    "suns",
    "lakers",
    "jazz",
    "ravens",
    "chiefs",
    "browns",
    "broncos",
    "seahawks",
    "rams",
    "cardinals",
    "niners",
    "49ers",
  ].map((t) => t.toLowerCase())
);

export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

export const extractOdds = (root: HTMLElement): number | null => {
  // Strategy 1: Look for aria-label with "Odds"
  let oddsSpan = root.querySelector<HTMLElement>('span[aria-label^="Odds"]');

  let txt = oddsSpan?.textContent ?? "";
  txt = txt.trim();

  // Strategy 2: If no aria-label, look for span with odds pattern
  if (!txt) {
    const allSpans = Array.from(root.querySelectorAll("span"));
    for (const span of allSpans) {
      const spanText = span.textContent ?? "";
      const oddsMatch = spanText.match(/^([+\-]\d{3,})$/);
      if (oddsMatch) {
        txt = oddsMatch[1];
        break;
      }
    }
  }

  // Strategy 3: Extract from raw text
  if (!txt) {
    const text = root.textContent ?? "";
    // Look for patterns like "+240", "-120", "+116" (3+ digits after +/-)
    const patterns = [
      /([+\-]\d{3,})\b/, // Standard odds
      /\b([+\-]\d{2,})\b/, // Shorter odds (like -110)
    ];

    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m && m[1]) {
        txt = m[1];
        break;
      }
    }
  }

  if (!txt) return null;

  txt = txt.replace(/\u2212/g, "-"); // unicode minus → ASCII
  txt = txt.replace(/[^+\-0-9]/g, ""); // Remove any non-numeric except +/-
  const n = parseInt(txt, 10);
  return Number.isNaN(n) ? null : n;
};

export interface HeaderInfo {
  description: string;
  name?: string;
  type?: string; // "Pts", "Spread", "Moneyline", etc.
  line?: string; // "30+", "10.5", "224.5", "+2.5"
  ou?: "Over" | "Under";
  odds?: number;
  sport?: string;
  isLive: boolean;
  rawText: string;
}

export const cleanDescriptionFromAria = (aria: string): string => {
  if (!aria) return "";

  let desc = aria.trim();

  // Remove game info (team names, dates, times) - usually after the odds
  // Pattern: ", Team @ Team, Date, Time" or similar
  desc = desc.replace(/,\s*[A-Z][^,]*@[^,]*,\s*[^,]*,\s*[^,]*ET.*$/i, "");
  desc = desc.replace(/,\s*[A-Z][^,]*vs[^,]*,\s*[^,]*,\s*[^,]*ET.*$/i, "");

  // Remove "Odds +240" style
  desc = desc.replace(/,?\s*Odds\s*[+\-]\d+.*$/i, "");

  // Remove trailing odds like ", +600" or " -120"
  desc = desc.replace(/,\s*[+\-]\d+.*$/i, "");
  desc = desc.replace(/\s[+\-]\d+$/i, "");

  // Remove multiple consecutive commas and spaces
  desc = desc.replace(/,\s*,+/g, ",");
  desc = desc.replace(/,\s*$/, "").trim();

  // Remove "Finished" text that sometimes appears in descriptions
  desc = desc.replace(/\s*Finished\s*/gi, " ").trim();

  // Format: "Cade Cunningham, TO SCORE 30+ POINTS" -> "Cade Cunningham To Score 30+ Points"
  // Split by comma and format each part
  const parts = desc
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p);
  if (parts.length >= 2) {
    const name = parts[0];
    const rest = parts.slice(1).join(" ");
    // Convert "TO SCORE 30+ POINTS" to "To Score 30+ Points"
    const formattedRest = rest
      .split(/\s+/)
      .map((word, idx) => {
        if (idx === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word;
      })
      .join(" ");
    return `${name} ${formattedRest}`;
  }

  return desc;
};

export interface DerivedFields {
  name?: string;
  type?: string;
  line?: string;
  ou?: "Over" | "Under";
}

export const deriveFieldsFromDescription = (
  description: string,
  rawText: string
): DerivedFields => {
  const desc = description.trim();
  let name: string | undefined;
  let type: string | undefined;
  let line: string | undefined;
  let ou: "Over" | "Under" | undefined;

  // 1) Name from patterns

  // Pattern: "Player Name To RECORD A TRIPLE DOUBLE" → extract "Player Name" only
  const toRecordTDMatch = desc.match(
    /^([A-Za-z' .-]+?)\s+To\s+RECORD\s+A\s+TRIPLE\s+DOUBLE/i
  );
  if (toRecordTDMatch) {
    name = toRecordTDMatch[1].trim();
    type = "TD";
  }

  // Pattern: "Player Name Top POINTS SCORER" → extract "Player Name" only
  const topScorerMatch = desc.match(
    /^([A-Za-z' .-]+?)\s+Top\s+POINTS?\s+SCORER/i
  );
  if (topScorerMatch) {
    name = topScorerMatch[1].trim();
    type = "Top Pts";
  }

  // Pattern: "Player Name First BASKET" → extract "Player Name" only
  const firstBasketMatch = desc.match(/^([A-Za-z' .-]+?)\s+First\s+BASKET/i);
  if (firstBasketMatch) {
    name = firstBasketMatch[1].trim();
    type = "FB";
  }

  // Pattern: "Player Name To Score X+ Points"
  const toScorePtsMatch = desc.match(
    /^([A-Za-z' .-]+?)\s+To\s+Score\s+(\d+(?:\.\d+)?)\+\s+Points/i
  );
  if (toScorePtsMatch && !name) {
    name = toScorePtsMatch[1].trim();
    line = `${toScorePtsMatch[2]}+`;
    type = "Pts";
  }

  // Pattern: "Over 224.5 Total Points" (no subject)
  const ouLeadingMatch = desc.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)/i);
  const ouLeading = !!ouLeadingMatch;
  if (ouLeadingMatch) {
    ou = ouLeadingMatch[1] === "Over" ? "Over" : "Under";
    line = ouLeadingMatch[2];
    name = undefined; // no subject in this form
  }

  // Pattern: "Cade Cunningham, TO SCORE 30+ POINTS" or "Cade Cunningham To Score 30+ Points"
  const commaIdx = desc.indexOf(",");
  if (!name && commaIdx > 0 && !ouLeading) {
    name = desc.slice(0, commaIdx).trim();
  } else if (!name && !ouLeading) {
    // Pattern: "Ausar Thompson Under 10.5" or "Onyeka Okongwu Over 8.5"
    const ouMatch = desc.match(
      /^([A-Za-z' .-]+)\s+(Over|Under)\s+(\d+(?:\.\d+)?)/i
    );
    if (ouMatch) {
      name = ouMatch[1].trim();
      ou = ouMatch[2] === "Over" ? "Over" : "Under";
      line = ouMatch[3];
    } else {
      // Pattern: "Ausar Thompson Under" (without line) - still extract name
      const ouMatchNoLine = desc.match(/^([A-Za-z' .-]+)\s+(Over|Under)\b/i);
      if (ouMatchNoLine) {
        name = ouMatchNoLine[1].trim();
        ou = ouMatchNoLine[2] === "Over" ? "Over" : "Under";
      } else {
        // Pattern: "Orlando Magic +2.5" - extract name and line separately
        const spreadMatch = desc.match(
          /^([A-Za-z' .-]+)\s*([+\-]\d+(?:\.\d+)?)\b/i
        );
        if (spreadMatch) {
          name = spreadMatch[1].trim();
          line = spreadMatch[2];
        } else {
          // Pattern: "Royce O'Neale 5+ MADE THREES" - extract name before number+
          const madeThreesMatch = desc.match(
            /^([A-Za-z' .-]+?)\s+(\d+)\+\s+(MADE THREES|THREES|3PT)/i
          );
          if (madeThreesMatch) {
            name = madeThreesMatch[1].trim();
            line = `${madeThreesMatch[2]}+`;
          } else {
            // Pattern: "Player Name X+ POINTS" or "Player Name TO SCORE X+ POINTS"
            const pointsMatch = desc.match(
              /^([A-Za-z' .-]+?)\s+(\d+)\+\s+(POINTS|TO SCORE)/i
            );
            if (pointsMatch) {
              name = pointsMatch[1].trim();
              line = `${pointsMatch[2]}+`;
            } else {
              // Pattern: "Player Name 50+ Yards" or "Player Name 3+ Receptions" - extract name before stat
              const statLineMatch = desc.match(
                /^([A-Za-z' .-]+?)\s+(\d+)\+\s+(Yards|Yds|Receptions|Rec|Points|Pts|Rebounds|Reb|Assists|Ast|Made\s+Threes|3pt|Threes)/i
              );
              if (statLineMatch) {
                name = statLineMatch[1].trim();
                line = `${statLineMatch[2]}+`;
                // Type will be set later based on the stat
              } else {
                // Try to extract just the name (first part before any market type)
                const nameMatch = desc.match(
                  /^([A-Za-z' .-]+?)(?:\s+(?:Under|Over|To|Top|First|TO SCORE|MONEYLINE|SPREAD|MADE THREES|THREES|3PT|POINTS|REBOUNDS|ASSISTS|TRIPLE DOUBLE|TOP POINTS|FIRST BASKET))/i
                );
                if (nameMatch) {
                  name = nameMatch[1].trim();
                } else {
                  // Last resort: take first 2-3 words as name
                  const words = desc.split(/\s+/);
                  if (words.length >= 2) {
                    // Take first 2-3 words, but stop if we hit a number
                    let nameWords: string[] = [];
                    for (let i = 0; i < Math.min(words.length, 3); i++) {
                      if (/^\d/.test(words[i])) break;
                      nameWords.push(words[i]);
                    }
                    if (nameWords.length > 0) {
                      name = nameWords.join(" ").trim();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 2) Over / Under lines (only if not already extracted)
  if (!ou || !line) {
    const overMatch = ouLeading
      ? null
      : desc.match(/\bOver\s+(\d+(\.\d+)?)\b/i);
    const underMatch = ouLeading
      ? null
      : desc.match(/\bUnder\s+(\d+(\.\d+)?)\b/i);

    if (overMatch && !ou) {
      ou = "Over";
      if (!line) line = overMatch[1];
    } else if (underMatch && !ou) {
      ou = "Under";
      if (!line) line = underMatch[1];
    }
  }

  // 3) Spread lines: "+2.5" or "-5.5" (if not already set)
  if (!line) {
    const spreadLineMatch = desc.match(/\b([+\-]\d+(?:\.\d+)?)\b/);
    if (spreadLineMatch && !name?.includes(spreadLineMatch[1])) {
      line = spreadLineMatch[1];
    }
  }

  // 4) "TO SCORE 30+ POINTS" style or "5+ MADE THREES" style
  if (!line) {
    const toScoreMatch = desc.match(/TO SCORE\s+(\d+)\+\s+POINTS/i);
    if (toScoreMatch) {
      line = `${toScoreMatch[1]}+`;
    } else {
      // Pattern: "5+ MADE THREES" or "X+ THREES"
      const madeThreesMatch = desc.match(/(\d+)\+\s+(MADE THREES|THREES|3PT)/i);
      if (madeThreesMatch) {
        line = `${madeThreesMatch[1]}+`;
      } else {
        // Pattern: "Player Name 5+ MADE THREES" or "Player Name 30+ POINTS" (already extracted name, now get line)
        const inlineMatch = desc.match(
          /\b(\d+)\+\s+(MADE THREES|THREES|3PT|POINTS|REBOUNDS|ASSISTS)/i
        );
        if (inlineMatch) {
          line = `${inlineMatch[1]}+`;
        } else {
          // Pattern: "To Record 30+ Points" (without player name prefix)
          const toRecordMatch = desc.match(/TO RECORD\s+(\d+)\+\s+(\w+)/i);
          if (toRecordMatch) {
            line = `${toRecordMatch[1]}+`;
          } else {
            // Pattern: "X+ Stat" anywhere (e.g., "10+ Assists", "6+ Assists")
            const statMatch = desc.match(
              /(\d+)\+\s+(ASSISTS|REBOUNDS|POINTS|THREES|MADE THREES)/i
            );
            if (statMatch) {
              line = `${statMatch[1]}+`;
            }
          }
        }
      }
    }
  }

  // 4b) Yards / Receptions style
  if (!line) {
    const yardsMatch = desc.match(/(\d+)\+\s+Yards/i);
    if (yardsMatch) {
      line = `${yardsMatch[1]}+`;
      type = type || "Yds";
    } else {
      const recMatch = desc.match(/(\d+)\+\s+Receptions/i);
      if (recMatch) {
        line = `${recMatch[1]}+`;
        type = type || "Rec";
      } else {
        const yardsAlt = desc.match(/(\d+)\+\s+Yds/i);
        if (yardsAlt) {
          line = `${yardsAlt[1]}+`;
          type = type || "Yds";
        }
      }
    }
  }

  // Set market type for yards/rec if not already set
  if (!type) {
    if (/YARDS|YDS/i.test(desc)) type = "Yds";
    if (/RECEPTIONS|REC\b/i.test(desc)) {
      type = "Rec";
    }
  }

  // 5) Market type from description or surrounding text
  const textCombined = `${desc} ${rawText}`.toUpperCase();
  const descUpper = desc.toUpperCase();

  // Check for Total first (before Points)
  if (/TOTAL POINTS|TOTALS|TOTAL\b/.test(textCombined)) {
    type = "Total";
  } else if (/MONEYLINE/.test(textCombined)) {
    type = "Moneyline";
  } else if (
    /MADE THREES|3PT|THREE POINT|THREES|MADE 3/.test(textCombined) ||
    /MADE THREES|3PT|THREE/.test(descUpper)
  ) {
    type = "3pt";
  } else if (
    /\bSPREAD\b/.test(textCombined) ||
    (/\b[+\-]\d+(?:\.\d+)?\b/.test(desc) &&
      !/POINTS|REBOUNDS|ASSISTS|MADE THREES|THREES/.test(textCombined))
  ) {
    type = "Spread";
  } else if (/FIRST BASKET|FIRST FIELD GOAL|FIRST FG/.test(textCombined)) {
    type = "FB";
  } else if (/TOP SCORER|TOP POINTS|TOP PTS/.test(textCombined)) {
    type = "Top Pts";
  } else if (/TRIPLE DOUBLE/.test(textCombined)) {
    type = "TD";
  } else if (/DOUBLE DOUBLE/.test(textCombined)) {
    type = "DD";
  } else if (/POINTS/.test(textCombined)) {
    type = "Pts";
  } else if (/REBOUNDS/.test(textCombined)) {
    type = "Reb";
  } else if (/ASSISTS/.test(textCombined)) {
    type = "Ast";
  } else if (/YARDS|YDS/.test(textCombined)) {
    type = "Yds";
  } else if (/RECEPTIONS|REC\b/.test(textCombined)) {
    type = "Rec";
  }

  // Clean obvious non-names
  if (
    name &&
    (name.toLowerCase() === "under" || name.toLowerCase() === "over")
  ) {
    name = undefined;
  }

  return { name, type, line, ou };
};

export const guessMarketFromText = (text: string): string => {
  const upper = text.toUpperCase();
  if (upper.includes("SPREAD")) return "Spread";
  if (upper.includes("MONEYLINE")) return "Moneyline";
  if (upper.includes("TRIPLE DOUBLE")) return "TD";
  if (upper.includes("DOUBLE DOUBLE")) return "DD";
  if (
    upper.includes("FIRST BASKET") ||
    upper.includes("FIRST FIELD GOAL") ||
    upper.includes("FIRST FG")
  )
    return "FB";
  if (
    upper.includes("TOP SCORER") ||
    upper.includes("TOP POINT") ||
    upper.includes("TOP PTS")
  )
    return "Top Pts";
  if (upper.includes("TOTAL")) return "Total";
  if (/MADE THREES|3PT|THREES/.test(upper)) return "3pt";
  if (upper.includes("POINT")) return "Pts";
  if (upper.includes("ASSIST")) return "Ast";
  if (upper.includes("REBOUND")) return "Reb";
  if (upper.includes("YARD")) return "Yds";
  if (upper.includes("RECEPTION")) return "Rec";
  return "";
};

export const extractSpreadTarget = (text: string): string | undefined => {
  const match = text.match(
    /\b([+\-]\d+(?:\.\d+)?)(?=(?:\s+[+\-]?\d{2,4})?\s*(?:SPREAD\b|SPREAD BETTING\b|$))/i
  );
  if (match && match[1]) return match[1];
  return undefined;
};

export const stripTargetFromName = (name: string, target?: string): string => {
  if (!target) return name;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`\\s*${escaped}\\s*$`), "").trim();
};

export const cleanEntityName = (raw: string): string => {
  if (!raw) return "";
  let cleaned = normalizeSpaces(raw);
  cleaned = stripDateTimeNoise(cleaned);

  // Filter out generic/invalid entity names
  const genericWords = [
    "made",
    "yards",
    "receptions",
    "available same game",
    "same game",
    "yards",
    "yards",
  ];
  if (genericWords.some((word) => cleaned.toLowerCase() === word)) {
    return "";
  }

  // Strip leftover prefixes from promo/scoreboard text
  cleaned = cleaned.replace(/^play[-\s]*/i, "");
  cleaned = cleaned.replace(/^plus available[-\s]*/i, "");
  cleaned = cleaned.replace(/^includes[-\s]*/i, "");
  cleaned = cleaned.replace(/^available\s+same\s+game\s*/i, "");

  // Strip suffixes: "Top", "First", "To" (when followed by market type)
  cleaned = cleaned.replace(/\s+Top\s*$/i, "");
  cleaned = cleaned.replace(/\s+First\s*$/i, "");
  cleaned = cleaned.replace(/\.?To\s+(Record|Score|RECORD|SCORE).*$/i, "");
  cleaned = cleaned.replace(/\.?To\s*$/i, "");

  // Remove "Triple Double" from entity names (it's a market type, not part of name)
  cleaned = cleaned.replace(/\s+Triple\s+Double\s*$/i, "");
  cleaned = cleaned.replace(/^Triple\s+Double\s+/i, "");

  // Remove stat lines from entity names (e.g., "50+ Yards", "3+ Receptions", "50+ Yds", "3+ Rec")
  cleaned = cleaned.replace(
    /\s+\d+\+\s*(Yards|Yds|Receptions|Rec|Points|Pts|Rebounds|Reb|Assists|Ast|Made\s+Threes|3pt|Threes)\s*$/i,
    ""
  );

  // Remove team name prefixes (e.g., "Cleveland Browns Quinshon" → "Quinshon")
  // Common team patterns that might be combined with player names
  const teamPrefixes = [
    /^(Cleveland\s+Browns|Denver\s+Broncos|Los\s+Angeles\s+Rams|Arizona\s+Cardinals|San\s+Francisco\s+49ers|Seattle\s+Seahawks|Baltimore\s+Ravens)\s+/i,
    /^(Detroit\s+Pistons|Atlanta\s+Hawks|Orlando\s+Magic|Phoenix\s+Suns|Portland\s+Trail\s+Blazers|Utah\s+Jazz|Los\s+Angeles\s+Lakers|Golden\s+State\s+Warriors|New\s+Orleans\s+Pelicans|Chicago\s+Bulls)\s+/i,
  ];
  for (const pattern of teamPrefixes) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Drop trailing market phrases and odds fragments stuck to the name
  cleaned = cleaned.replace(/\d+\+\s*Made.*$/i, "");
  cleaned = cleaned.replace(/\d+\+\s*$/i, "");
  cleaned = cleaned.replace(/\s*[+\-]\d{2,}.*$/i, "");
  cleaned = cleaned.replace(/\s*[+\-]?\d+(?:\.\d+)?\s*(?:Spread)?$/i, "");
  cleaned = cleaned.replace(/\s*[+\-]\s*$/i, "");

  return cleaned.trim();
};

export const parseLegFromText = (
  text: string,
  odds: number | null,
  result: BetResult,
  skipOdds: boolean = false
): BetLeg | null => {
  const cleaned = stripScoreboardText(text);
  if (!cleaned) return null;

  const derived = deriveFieldsFromDescription(cleaned, cleaned);
  const market = derived.type || guessMarketFromText(cleaned) || "Other";
  let target =
    derived.line ||
    (market === "Spread" ? extractSpreadTarget(cleaned) : undefined);

  // For TD (Triple Double) markets, don't extract numeric targets
  if (market === "TD" || market === "DD") {
    target = undefined;
  }

  // Check if target looks like odds and filter it out
  if (target && typeof target === "string") {
    const targetStr = target.replace(/\s+/g, "");
    // Filter out odds patterns:
    // 1. 3+ digits after +/- (like +410, -1200, +120)
    // 2. Common American odds ranges (+100 to +9999, -100 to -9999)
    if (
      /^[+\-]?\d{3,}$/.test(targetStr) ||
      /^[+\-]1[0-9]{2,}$/.test(targetStr) ||
      /^[+\-][2-9]\d{2,}$/.test(targetStr)
    ) {
      target = undefined;
    }
  }

  if (market === "Spread" && !target) {
    const spreadLike = cleaned.match(/[+\-]\d+(?:\.\d+)?/);
    if (spreadLike) {
      const candidate = (spreadLike as RegExpMatchArray)[1] ?? spreadLike[0];
      const numeric = parseFloat(candidate);
      // Only use as target if it's a reasonable spread value (not odds)
      if (!Number.isNaN(numeric) && Math.abs(numeric) <= 60) {
        target = candidate;
      }
    }
  }

  if (!target && market === "Spread") {
    const rawCombined = normalizeSpaces(text);
    const match = rawCombined.match(/[+\-]\d+(?:\.\d+)?/);
    if (match) {
      const candidate = match[0];
      const numeric = parseFloat(candidate);
      // Only use as target if it's a reasonable spread value (not odds)
      if (!Number.isNaN(numeric) && Math.abs(numeric) <= 60) {
        target = candidate;
      }
    }
  }

  if (!market && !derived.name) return null;

  const entityName = derived.name
    ? cleanEntityName(stripTargetFromName(derived.name, target))
    : undefined;

  const leg: BetLeg = {
    entities: entityName ? [entityName] : undefined,
    market,
    target,
    ou: derived.ou,
    odds: skipOdds ? undefined : odds ?? undefined,
    result,
  };

  return leg;
};

export const parseLegFromNode = (
  node: HTMLElement,
  result: BetResult,
  skipOdds: boolean = false
): BetLeg | null => {
  const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
  const text = normalizeSpaces(node.textContent ?? "");
  const source = stripScoreboardText(aria || text);
  const odds = skipOdds ? null : extractOdds(node);

  const derived = deriveFieldsFromDescription(source, source);
  const market = derived.type || guessMarketFromText(source) || "Other";
  let target =
    derived.line ||
    (market === "Spread" ? extractSpreadTarget(source) : undefined);

  // For TD (Triple Double) markets, don't extract numeric targets
  if (market === "TD" || market === "DD") {
    target = undefined;
  }

  // Check if target looks like odds and filter it out
  if (target && typeof target === "string") {
    const targetStr = target.replace(/\s+/g, "");
    // Filter out odds patterns:
    // 1. 3+ digits after +/- (like +410, -1200, +120)
    // 2. Common American odds ranges (+100 to +9999, -100 to -9999)
    if (
      /^[+\-]?\d{3,}$/.test(targetStr) ||
      /^[+\-]1[0-9]{2,}$/.test(targetStr) ||
      /^[+\-][2-9]\d{2,}$/.test(targetStr)
    ) {
      target = undefined;
    }
  }

  // If we have a spread-like target but no market, default to Spread
  let finalMarket = market;
  if (
    (!finalMarket || finalMarket === "Other") &&
    derived.line &&
    /^[+\-]\d+(\.\d+)?$/.test(String(derived.line))
  ) {
    // Only default to Spread if it's not odds (reasonable spread values are <= 60)
    const numeric = parseFloat(String(derived.line));
    if (!Number.isNaN(numeric) && Math.abs(numeric) <= 60) {
      finalMarket = "Spread";
    }
  }

  if (finalMarket === "Spread" && !target) {
    const spreadLike = source.match(/[+\-]\d+(?:\.\d+)?/);
    if (spreadLike) {
      const candidate = (spreadLike as RegExpMatchArray)[1] ?? spreadLike[0];
      const numeric = parseFloat(candidate);
      // Only use as target if it's a reasonable spread value (not odds)
      if (!Number.isNaN(numeric) && Math.abs(numeric) <= 60) {
        target = candidate;
      }
    }
  }
  if (finalMarket === "Spread" && !target) {
    const rawCombined = normalizeSpaces(
      (node?.textContent || "") +
        " " +
        (node?.getAttribute?.("aria-label") || "")
    );
    const match = rawCombined.match(/[+\-]\d+(?:\.\d+)?/);
    if (match) {
      const candidate = match[0];
      const numeric = parseFloat(candidate);
      // Only use as target if it's a reasonable spread value (not odds)
      if (!Number.isNaN(numeric) && Math.abs(numeric) <= 60) {
        target = candidate;
      }
    }
  }

  if (!finalMarket && !derived.name) return null;

  const entityName = derived.name
    ? cleanEntityName(stripTargetFromName(derived.name, target))
    : undefined;

  const leg: BetLeg = {
    entities: entityName ? [entityName] : undefined,
    market: finalMarket,
    target,
    ou: derived.ou,
    odds: odds ?? undefined,
    result,
  };

  return leg;
};

export const buildLegsFromRows = (
  rows: HTMLElement[],
  result: BetResult,
  skipOdds: boolean = false
): BetLeg[] => {
  const legs: BetLeg[] = [];

  for (const row of rows) {
    const leg = parseLegFromNode(row, result, skipOdds);
    if (leg) legs.push(leg);
  }

  return legs;
};

export const buildLegsFromDescription = (
  description: string,
  result: BetResult,
  skipOdds: boolean = false
): BetLeg[] => {
  if (!description) return [];
  const parts = description
    .split(/,\s*/)
    .map((p) => normalizeSpaces(p))
    .filter(Boolean);

  const legs: BetLeg[] = [];
  for (const part of parts) {
    const leg = parseLegFromText(part, null, result, skipOdds);
    if (leg) legs.push(leg);
  }
  return legs;
};

export const buildLegsFromStatText = (
  rawText: string,
  result: BetResult
): BetLeg[] => {
  if (!rawText) return [];

  // Collect stat legs like "Player 80+ Yards" or "Player To Record 10+ Assists"
  const patterns = [
    new RegExp(
      `(${PLAYER_NAME_PATTERN}\\s+\\d+\\+\\s+(?:Yards|Receptions|Yds|Rec|Points|Assists))`,
      "gi"
    ),
    new RegExp(
      `(${PLAYER_NAME_PATTERN}\\s+To\\s+Record\\s+\\d+\\+\\s+\\w+)`,
      "gi"
    ),
  ];

  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = rawText.match(pattern);
    if (found) matches.push(...found);
  }

  const legs: BetLeg[] = [];
  matches.forEach((m) => {
    const leg = parseLegFromText(m, null, result, false);
    if (leg) legs.push(leg);
  });

  return legs;
};

export const buildLegsFromSpans = (
  root: HTMLElement,
  result: BetResult
): BetLeg[] => {
  const spans = Array.from(root.querySelectorAll("span"));
  const legs: BetLeg[] = [];
  const seen = new Set<string>();

  spans.forEach((span) => {
    const txt = normalizeSpaces(span.textContent || "");
    if (!txt) return;
    if (
      /\d+\+\s+(Yards|Receptions|Points|Assists|Made Threes|Threes|Yds|Rec)/i.test(
        txt
      ) ||
      /To Record\s+\d+\+\s+\w+/i.test(txt)
    ) {
      let cleanedTxt = txt.replace(
        new RegExp(`^[A-Z][a-z]+\\s+[A-Z][a-z]+\\s+(${PLAYER_NAME_PATTERN})`),
        "$1"
      );
      if (seen.has(cleanedTxt)) return;
      seen.add(cleanedTxt);
      const leg = parseLegFromText(cleanedTxt, null, result);
      if (leg) legs.push(leg);
    }
  });

  return legs;
};

const cleanParlayLegText = (leg: string): string => {
  let normalized = normalizeSpaces(leg);
  normalized = stripDateTimeNoise(normalized);
  normalized = normalized
    .replace(/FinishedFinished\s*/gi, " ")
    .replace(/Finished\s*/gi, " ")
    .replace(/\b\d{6,}\b/g, " ");

  const statIdx = normalized.search(/\b(To Record|To Score|Made Threes)\b/i);

  if (statIdx > 0) {
    const before = normalized.slice(0, statIdx).trim();
    const after = normalized.slice(statIdx).trim();
    const nameTokens = before.split(/\s+/);
    let trimmedTokens = nameTokens.slice(-3);
    while (
      trimmedTokens.length &&
      TEAM_TOKENS.has(trimmedTokens[0].toLowerCase())
    ) {
      trimmedTokens = trimmedTokens.slice(1);
    }
    const trimmedName =
      trimmedTokens.join(" ") || nameTokens.slice(-1)[0] || "";
    normalized = `${trimmedName} ${after}`;
  }

  return normalizeSpaces(normalized);
};

export const formatLegSummary = (leg: BetLeg): string => {
  const name = cleanEntityName(leg.entities?.[0] ?? "");
  const market = leg.market || "";
  const target = leg.target ?? "";

  if (market.toLowerCase() === "spread" && target) {
    return name ? `${name} ${target}` : String(target);
  }

  if (market.toLowerCase() === "moneyline") {
    return name ? `${name} Moneyline` : "Moneyline";
  }

  if (name && target && market) return `${name} ${target} ${market}`;
  if (name && market) return `${name} ${market}`;
  if (market && target) return `${target} ${market}`;
  return name || market || "";
};

export const formatParlayDescriptionFromLegs = (legs: BetLeg[]): string =>
  legs
    .map(formatLegSummary)
    .filter((s) => s && s.length)
    .join(", ");

export const dedupeLegs = (legs: BetLeg[]): BetLeg[] => {
  const seen = new Map<string, BetLeg>();

  for (const leg of legs) {
    const key = [
      (leg.entities?.[0] || "").toLowerCase(),
      (leg.market || "").toLowerCase(),
      String(leg.target ?? ""),
      leg.ou ?? "",
    ].join("|");

    if (!seen.has(key)) {
      seen.set(key, leg);
    } else {
      const existing = seen.get(key)!;
      if (existing.odds === undefined && leg.odds !== undefined) {
        seen.set(key, { ...existing, odds: leg.odds });
      }
    }
  }

  return Array.from(seen.values());
};

export const filterMeaningfulLegs = (legs: BetLeg[]): BetLeg[] => {
  const promoPatterns =
    /(same game parlay|parlay available|same-game parlay|plus available|includes|profit boost|profitboost)/i;

  // Generic words that should not be entities
  const genericWords = new Set([
    "made",
    "yards",
    "receptions",
    "available same game",
    "same game",
    "yards",
    "yards",
  ]);

  // Team names that should not be entities for prop bets
  const teamNames = new Set([
    "los angeles rams",
    "arizona cardinals",
    "san francisco 49ers",
    "seattle seahawks",
    "baltimore ravens",
    "cleveland browns",
    "denver broncos",
    "detroit pistons",
    "atlanta hawks",
    "orlando magic",
    "phoenix suns",
    "portland trail blazers",
    "utah jazz",
    "los angeles lakers",
    "golden state warriors",
    "new orleans pelicans",
    "chicago bulls",
  ]);

  return legs.filter((leg) => {
    const entity = leg.entities?.[0] ?? "";
    const market = leg.market ?? "";
    const hasEntity = !!entity;
    const hasTarget =
      leg.target !== undefined && leg.target !== null && leg.target !== "";
    const hasUsefulMarket = market && market.toLowerCase() !== "other";
    const targetLooksLikeOdds =
      typeof leg.target === "string" &&
      /^[+\-]?\d{3,}$/.test(String(leg.target).replace(/\s+/g, ""));

    // Filter out generic words as entities
    if (hasEntity && genericWords.has(entity.toLowerCase().trim())) {
      return false;
    }

    // Filter out team names when market is a prop (Pts, Reb, Ast, Yds, Rec, 3pt)
    const marketLower = market.toLowerCase();
    const isPropMarket = ["pts", "reb", "ast", "yds", "rec", "3pt"].includes(
      marketLower
    );
    if (
      hasEntity &&
      isPropMarket &&
      teamNames.has(entity.toLowerCase().trim())
    ) {
      return false;
    }

    const looksPromo = promoPatterns.test(entity) || promoPatterns.test(market);

    // Keep promo-looking legs only if they also carry a target/odds (actual selections)
    if (looksPromo && !hasTarget && !leg.odds) {
      return false;
    }

    if (!hasEntity && !hasTarget && !hasUsefulMarket) {
      return false;
    }

    if (!hasEntity) {
      return false;
    }

    if (/^alt\s+/i.test(entity)) {
      return false;
    }

    if (!hasUsefulMarket && targetLooksLikeOdds) {
      return false;
    }

    return !!(entity || market || leg.target);
  });
};

export const dropGenericDuplicateLegs = (legs: BetLeg[]): BetLeg[] => {
  const specificKeys = new Set<string>();

  legs.forEach((leg) => {
    const entity = leg.entities?.[0]?.toLowerCase() ?? "";
    const target = leg.target ?? "";
    const market = leg.market?.toLowerCase() ?? "";
    if (entity && market && market !== "other") {
      specificKeys.add(`${entity}|${target}`);
    }
  });

  return legs.filter((leg) => {
    const entity = leg.entities?.[0]?.toLowerCase() ?? "";
    const target = leg.target ?? "";
    const market = leg.market?.toLowerCase() ?? "";

    if (market === "other" && specificKeys.has(`${entity}|${target}`)) {
      return false;
    }

    return true;
  });
};

export const buildPrimaryLegsFromHeader = (
  header: HeaderInfo,
  result: BetResult,
  betType?: BetType,
  description?: string
): BetLeg[] => {
  if (betType === "parlay" || betType === "sgp") {
    return [];
  }

  // For single bets, create one leg from header info
  const leg: BetLeg = {
    entities: header.name ? [cleanEntityName(header.name)] : undefined,
    market: header.type ?? "",
    target: header.line,
    ou: header.ou,
    odds: header.odds,
    actual: undefined, // numeric result is embedded in the progress bar; can be parsed later if needed
    result,
  };
  return [leg];
};

export const inferMarketFromStat = (stat: string): string => {
  const statUpper = stat.toUpperCase();
  if (statUpper.includes("ASSIST")) return "Ast";
  if (statUpper.includes("POINT")) return "Pts";
  if (statUpper.includes("REBOUND")) return "Reb";
  if (statUpper.includes("THREE") || statUpper.includes("3PT")) return "3pt";
  return stat;
};

export const formatDescription = (
  description: string,
  type?: string,
  name?: string,
  line?: string,
  ou?: "Over" | "Under",
  betType?: BetType
): string => {
  if (!description) return "";

  // Remove promotional text
  let cleaned = description
    .replace(/^available\s+Same\s+Game\s*/i, "")
    .replace(/\s*available\s+Same\s+Game\s*/gi, "")
    .replace(/^same\s+game\s+parlay\s+available\s*/i, "")
    .replace(/\s*same\s+game\s+parlay\s+available\s*/gi, "")
    .replace(/^parlay\s+available\s*/i, "")
    .replace(/\s*parlay\s+available\s*/gi, "");

  // For parlays, return as-is (already formatted)
  if (betType === "parlay" || betType === "sgp") {
    // Clean up parlay descriptions
    return cleaned
      .replace(/\s*Spread Betting\s*/gi, "")
      .replace(/,\s*/g, ", ")
      .trim();
  }

  if (
    description.includes("Spread Betting") &&
    description.includes(",") &&
    description.split(",").length > 1
  ) {
    // Clean up parlay descriptions
    return description
      .replace(/\s*Spread Betting\s*/gi, "")
      .replace(/,\s*/g, ", ")
      .trim();
  }

  // For other bets, format based on type

  // Handle Total bets (may not have a name/subject)
  if (type === "Total" && line && ou) {
    return `${ou} ${line} Total Points`;
  }

  if (!name) return description;

  if (type === "Pts" && line) {
    if (ou) {
      return `${name} ${ou} ${line} Points`;
    } else if (line.includes("+")) {
      return `${name} To Score ${line} Points`;
    } else {
      return `${name} ${line} Points`;
    }
  }

  if (type === "Total" && line && ou) {
    return `${ou} ${line} Total Points`;
  }

  // Fix case for "Total POINTS" -> "Total Points" (before other formatting)
  if (description && /TOTAL POINTS/i.test(description)) {
    description = description.replace(/TOTAL POINTS/i, "Total Points");
  }

  if (type === "Spread" && line) {
    return `${name} ${line} Spread`;
  }

  if (type === "Moneyline") {
    return `${name} Moneyline`;
  }

  // Fallback to original description
  return description;
};

export const inferMarketCategory = (
  betType: BetType,
  type?: string
): MarketCategory => {
  if (betType === "parlay" || betType === "sgp") {
    return "Parlays";
  }

  if (!type) {
    return "Main Markets";
  }

  const t = type.toLowerCase();
  if (["pts", "reb", "ast", "pra", "3pt"].includes(t)) {
    return "Props";
  }

  if (["spread", "moneyline", "total"].includes(t)) {
    return "Main Markets";
  }

  return "Main Markets";
};

export const inferSportFromText = (
  text: string,
  marketTypes?: string[]
): string => {
  const upper = text.toUpperCase();

  // NBA teams
  if (
    upper.includes("PISTONS") ||
    upper.includes("MAGIC") ||
    upper.includes("HAWKS") ||
    upper.includes("LAKERS") ||
    upper.includes("WARRIORS") ||
    upper.includes("CELTICS") ||
    upper.includes("HEAT") ||
    upper.includes("SUNS") ||
    upper.includes("TRAIL BLAZERS") ||
    upper.includes("GRIZZLIES") ||
    upper.includes("SPURS") ||
    upper.includes("JAZZ") ||
    upper.includes("PELICANS") ||
    upper.includes("BULLS") ||
    upper.includes("MAVERICKS") ||
    upper.includes("NBA") ||
    upper.includes("BASKETBALL")
  ) {
    return "NBA";
  }

  // NFL teams
  if (
    upper.includes("PATRIOTS") ||
    upper.includes("COWBOYS") ||
    upper.includes("PACKERS") ||
    upper.includes("CHIEFS") ||
    upper.includes("RAVENS") ||
    upper.includes("BROWNS") ||
    upper.includes("BRONCOS") ||
    upper.includes("SEAHAWKS") ||
    upper.includes("RAMS") ||
    upper.includes("CARDINALS") ||
    upper.includes("49ERS") ||
    upper.includes("NINERS") ||
    upper.includes("NFL") ||
    upper.includes("FOOTBALL")
  ) {
    return "NFL";
  }

  // MLB
  if (
    upper.includes("YANKEES") ||
    upper.includes("RED SOX") ||
    upper.includes("DODGERS") ||
    upper.includes("MLB") ||
    upper.includes("BASEBALL")
  ) {
    return "MLB";
  }

  // Market-based detection: If we have market types, use them to infer sport
  if (marketTypes && marketTypes.length > 0) {
    const marketsUpper = marketTypes.map((m) => m.toUpperCase());
    // NFL markets: Yds, Rec (Yards, Receptions)
    if (
      marketsUpper.some(
        (m) =>
          m === "YDS" ||
          m === "REC" ||
          m.includes("YARD") ||
          m.includes("RECEPTION")
      )
    ) {
      return "NFL";
    }
    // NBA markets: Pts, Reb, Ast, 3pt (Points, Rebounds, Assists, Threes)
    if (
      marketsUpper.some(
        (m) =>
          m === "PTS" ||
          m === "REB" ||
          m === "AST" ||
          m === "3PT" ||
          m.includes("POINT") ||
          m.includes("REBOUND") ||
          m.includes("ASSIST") ||
          m.includes("THREE")
      )
    ) {
      return "NBA";
    }
  }

  // Check for market keywords in text itself
  if (
    /YARDS|YDS|RECEPTIONS|REC\b/.test(upper) &&
    !/POINTS|REBOUNDS|ASSISTS/.test(upper)
  ) {
    return "NFL";
  }
  if (
    /POINTS|REBOUNDS|ASSISTS|MADE THREES|3PT/.test(upper) &&
    !/YARDS|RECEPTIONS/.test(upper)
  ) {
    return "NBA";
  }

  return "";
};

export const extractHeaderInfo = (
  headerLi: HTMLElement,
  betType?: BetType
): HeaderInfo => {
  const rawText = stripDateTimeNoise(
    (headerLi.textContent ?? "").replace(/\s+/g, " ").trim()
  );

  const odds = extractOdds(headerLi);

  // For parlays, the description might be in a different span
  // Check for parlay text first - use betType if provided, otherwise infer
  const isParlayHeader =
    betType === "parlay" || betType === "sgp" || /leg\s+parlay/i.test(rawText);
  let description = "";

  if (isParlayHeader) {
    // Look for the description span that contains the leg descriptions
    // It's usually a span with class containing "io ip iq jn" or similar
    const allSpans = Array.from(headerLi.querySelectorAll("span"));
    const descSpan = allSpans.find((s) => {
      const text = s.textContent || "";
      return (
        text.includes("Spread Betting") &&
        text.includes(",") &&
        (text.includes("Magic") || text.includes("Pistons"))
      );
    });

    if (descSpan) {
      description = descSpan.textContent?.trim() || "";
      // Clean up: "Orlando Magic -5.5 Spread Betting, Detroit Pistons -5.5 Spread Betting"
      // -> "Orlando Magic -5.5, Detroit Pistons -5.5"
      description = description
        .replace(/\s*Spread Betting\s*/gi, "")
        .replace(/,\s*/g, ", ")
        .trim();
    } else {
      // Fallback: try to extract from raw text - look for pattern like "Team -5.5 Spread Betting, Team -5.5 Spread Betting"
      const parlayMatch = rawText.match(
        /([A-Za-z\s]+[+\-]\d+(?:\.\d+)?\s*Spread Betting[^,]*,\s*[A-Za-z\s]+[+\-]\d+(?:\.\d+)?\s*Spread Betting)/
      );
      if (parlayMatch) {
        description = parlayMatch[1]
          .replace(/\s*Spread Betting\s*/gi, "")
          .replace(/,\s*/g, ", ")
          .trim();
      } else {
        // Try to extract prop parlay legs (e.g., "Player To Record X+ Stat, Player To Record Y+ Stat")
        // First, find the section after "Same Game Parlay" that contains the actual legs
        let parlaySection = rawText;
        const parlayStartMatch = rawText.match(
          /Same Game Parlay[^]*?([A-Z][^]+)/i
        );
        if (parlayStartMatch && parlayStartMatch[1]) {
          parlaySection = parlayStartMatch[1];
        }

        // Extract individual legs - look for patterns like "Player Name To Record X+ Stat"
        const propLegs = parlaySection.match(
          new RegExp(
            `(${PLAYER_NAME_PATTERN}\\s+(?:To Record|To Score)\\s+\\d+\\+\\s+\\w+)`,
            "gi"
          )
        );
        if (propLegs && propLegs.length >= 2) {
          description = propLegs
            .map(cleanParlayLegText)
            .filter(
              (leg) => leg.length > 10 && !leg.includes("Same Game Parlay")
            )
            .join(", ");
        }

        // Try alternative pattern: "Player Name X+ Made Threes"
        if (!description || description.length < 20) {
          const madeThreesLegs = parlaySection.match(
            new RegExp(
              `(${PLAYER_NAME_PATTERN}\\s+\\d+\\+\\s+Made Threes)`,
              "gi"
            )
          );
          if (madeThreesLegs && madeThreesLegs.length >= 1) {
            const otherLegs = parlaySection.match(
              new RegExp(
                `(${PLAYER_NAME_PATTERN}\\s+(?:To Record|To Score)\\s+\\d+\\+\\s+\\w+)`,
                "gi"
              )
            );
            if (otherLegs && otherLegs.length >= 1) {
              description = [...otherLegs, ...madeThreesLegs]
                .map(cleanParlayLegText)
                .filter((leg) => leg.length > 10)
                .join(", ");
            }
          }
        }

        if (!description || description.length < 20) {
          // Try to extract prop parlay legs (e.g., "Player To Record X+ Stat, Player To Record Y+ Stat")
          const propLegs = rawText.match(
            /([A-Z][^,]+(?:To Record|To Score|Made Threes)[^,]+)/gi
          );
          if (propLegs && propLegs.length >= 2) {
            // Clean up each leg - remove odds, team names, dates, etc.
            description = propLegs
              .map(cleanParlayLegText)
              .filter((leg) => leg.length > 10) // Only keep meaningful legs
              .join(", ");
          }

          // Last resort: extract team names and spreads from text
          if (!description) {
            const teams = rawText.match(
              /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*([+\-]\d+(?:\.\d+)?)/g
            );
            if (teams && teams.length >= 2) {
              description = teams
                .map((t) => t.replace(/\s*Spread Betting\s*/gi, "").trim())
                .join(", ");
            }
          }

          if (!description) {
            // Final fallback: extract meaningful text after "parlay" keyword
            const parlayTextMatch = rawText.match(
              /(?:parlay|same game parlay)[^,]*?([A-Z][^]+?)(?:\s+\d{8,}|\s+Finished|\s+Settled|$)/i
            );
            if (parlayTextMatch && parlayTextMatch[1]) {
              description = parlayTextMatch[1]
                .replace(/\b[+\-]\d{3,}\b/g, "") // Remove standalone odds
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 200);
            }
          }
        }
      }
    }

    // Append any "Made Threes" legs that might not have been included above
    const madeThreesExtras =
      rawText.match(
        new RegExp(`(${PLAYER_NAME_PATTERN}\\s+\\d+\\+\\s+Made Threes)`, "gi")
      ) || [];
    if (madeThreesExtras.length) {
      const cleanedExtras = madeThreesExtras
        .map(cleanParlayLegText)
        .filter(Boolean);
      if (cleanedExtras.length) {
        const parts = new Set(
          description
            ? description.split(/,\s*/).map((p) => normalizeSpaces(p))
            : []
        );
        cleanedExtras.forEach((leg) => parts.add(leg));
        description = Array.from(parts).join(", ").trim();
      }
    }
  } else {
    // Regular bet - try multiple strategies for description
    // Strategy 1: aria-label
    const ariaDiv = headerLi.querySelector<HTMLElement>("[aria-label]");
    let aria = ariaDiv?.getAttribute("aria-label") ?? "";

    if (aria) {
      description = cleanDescriptionFromAria(aria);
    }

    // Strategy 2: If no aria-label or empty, try to extract from text content
    if (!description || description.trim() === "") {
      const text = rawText;
      // Look for common patterns in the text
      // Pattern: "Player Name, MARKET TYPE" or "Player Name MARKET TYPE"
      const nameMarketMatch = text.match(
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[,]?\s*(TO SCORE|POINTS|SPREAD|MONEYLINE|TOTAL)/i
      );
      if (nameMarketMatch) {
        description = `${nameMarketMatch[1]} ${nameMarketMatch[2]}`;
      } else {
        // Fallback: use first meaningful text chunk
        const words = text
          .split(/\s+/)
          .filter((w) => w.length > 2 && !/^\d+$/.test(w));
        if (words.length > 0) {
          description = words.slice(0, 5).join(" ");
        }
      }
    }
  }

  // For parlays, don't extract name/type/line/ou from description
  let name: string | undefined;
  let type: string | undefined;
  let line: string | undefined;
  let ou: "Over" | "Under" | undefined;

  if (!isParlayHeader) {
    const derived = deriveFieldsFromDescription(description, rawText);
    name = derived.name;
    type = derived.type;
    line = derived.line;
    ou = derived.ou;
  }

  // Extract market types from description for better sport detection
  const marketTypes: string[] = [];
  if (type) marketTypes.push(type);
  // Also check description for market keywords
  const descUpper = description.toUpperCase();
  if (/YARDS|YDS/.test(descUpper)) marketTypes.push("Yds");
  if (/RECEPTIONS|REC\b/.test(descUpper)) marketTypes.push("Rec");
  if (/POINTS|PTS/.test(descUpper)) marketTypes.push("Pts");
  if (/REBOUNDS|REB/.test(descUpper)) marketTypes.push("Reb");
  if (/ASSISTS|AST/.test(descUpper)) marketTypes.push("Ast");
  if (/MADE THREES|3PT|THREES/.test(descUpper)) marketTypes.push("3pt");

  const sport = inferSportFromText(
    rawText,
    marketTypes.length > 0 ? marketTypes : undefined
  );

  const isLive = /live bet|in-play/i.test(rawText);

  // Fix case for "Total POINTS" -> "Total Points" in description
  if (description && /TOTAL POINTS/i.test(description)) {
    description = description.replace(/TOTAL POINTS/i, "Total Points");
  }

  // Remove promotional text from descriptions
  if (description) {
    description = description
      .replace(/^available\s+Same\s+Game\s*/i, "")
      .replace(/\s*available\s+Same\s+Game\s*/gi, "")
      .replace(/^same\s+game\s+parlay\s+available\s*/i, "")
      .replace(/\s*same\s+game\s+parlay\s+available\s*/gi, "")
      .replace(/^parlay\s+available\s*/i, "")
      .replace(/\s*parlay\s+available\s*/gi, "")
      .trim();
  }

  return {
    description,
    name,
    type,
    line,
    ou,
    odds: odds ?? undefined,
    sport,
    isLive,
    rawText,
  };
};

export const findLegRows = (cardLi: HTMLElement): HTMLElement[] => {
  // Find selection-like blocks: elements with aria-label (not spans) or odds spans that
  // have market text/odds. This skips scoreboard and footer content.
  const candidates: HTMLElement[] = [];

  // Primary: nodes with aria-label
  candidates.push(
    ...Array.from(cardLi.querySelectorAll<HTMLElement>("[aria-label]")).filter(
      (el) => el.tagName.toLowerCase() !== "span"
    )
  );

  // Secondary: parents of odds spans (covers cases where the row itself lacks aria-label)
  const oddsSpans = Array.from(
    cardLi.querySelectorAll<HTMLElement>('span[aria-label^="Odds"]')
  );
  for (const span of oddsSpans) {
    const parentDiv = span.closest<HTMLElement>("div");
    if (parentDiv) candidates.push(parentDiv);
  }

  const marketPattern =
    /SPREAD BETTING|MONEYLINE|TOTAL|TO RECORD|TO SCORE|MADE THREES|ASSISTS|REBOUNDS|POINTS|OVER|UNDER/i;

  const filtered = candidates.filter((node) => {
    const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
    const text = normalizeSpaces(node.textContent || "");
    const hasOdds = !!node.querySelector<HTMLElement>(
      'span[aria-label^="Odds"]'
    );
    const hasMarket = marketPattern.test(aria) || marketPattern.test(text);
    const isParlayHeader =
      /\bleg parlay\b/i.test(aria) || /same game parlay/i.test(aria);
    const isFooterLike =
      /TOTAL WAGER|BET ID|PLACED:/i.test(text) || /TOTAL WAGER/i.test(aria);
    const hasLetters = /[A-Za-z]{3,}/.test(aria || text);

    if (isParlayHeader || isFooterLike) return false;
    if (!hasLetters) return false;
    if (!(hasOdds || hasMarket)) return false;

    return true;
  });

  // Prefer top-level selection blocks: drop nested candidates that live inside another candidate
  const topLevel = filtered.filter(
    (node) => !filtered.some((other) => other !== node && other.contains(node))
  );

  // Deduplicate by reference and by normalized text to avoid double-counting the same row
  const seenText = new Set<string>();
  const unique: HTMLElement[] = [];

  for (const node of topLevel) {
    const text = normalizeSpaces(node.textContent || "");
    if (seenText.has(text)) continue;
    seenText.add(text);
    unique.push(node);
  }

  return unique;
};

export interface FooterMeta {
  betId: string | null;
  placedAtRaw: string | null;
  stake: number | null;
  payout: number | null;
  hasWonOnFanDuel: boolean;
  rawText: string;
}

export const formatParlayLegDescription = (rawText: string): string => {
  // Extract individual legs - look for patterns like "Player Name To Record X+ Stat"
  const propLegs = rawText.match(
    new RegExp(
      `(${PLAYER_NAME_PATTERN}\\s+(?:To Record|To Score)\\s+\\d+\\+\\s+\\w+)`,
      "gi"
    )
  );
  if (propLegs && propLegs.length >= 2) {
    return propLegs
      .map(cleanParlayLegText)
      .filter((leg) => leg.length > 10 && !leg.includes("Same Game Parlay"))
      .join(", ");
  }
  return "";
};

export const inferMarketCategoryFromType = inferMarketCategory;

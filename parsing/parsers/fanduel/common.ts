import {
  BetLeg,
  BetResult,
  BetType,
  MarketCategory,
  SportsbookName,
  LegResult,
} from "../../types";

export const FD_DEBUG = false;
export const fdDebug = (...args: any[]) => {
  if (!FD_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[FD-DEBUG]", ...args);
};

type LegResultInput = LegResult | BetResult | null | undefined;

export const toLegResult = (value: LegResultInput): LegResult => {
  if (!value) return "PENDING";
  const normalized = String(value).toLowerCase();
  if (normalized === "void" || normalized === "voided") return "PUSH";
  if (normalized === "win") return "WIN";
  if (normalized === "loss") return "LOSS";
  if (normalized === "push") return "PUSH";
  if (normalized === "pending") return "PENDING";
  if (normalized === "unknown") return "UNKNOWN";
  return "PENDING";
};

const iconResultFromNode = (node: Element): LegResult | null => {
  const id = (node.getAttribute("id") || "").toLowerCase();
  const fill = (node.getAttribute("fill") || "").toLowerCase();

  if (fill === "#128000") {
    return "WIN";
  }
  if (fill === "#d22839") {
    return "LOSS";
  }
  if (id.includes("cross-circle") || id.includes("cross_circle")) {
    return "LOSS";
  }
  if (id.includes("tick-circle") || id.includes("tick_circle")) {
    return "WIN";
  }

  return null;
};

export const extractLegResultFromRow = (
  row: HTMLElement,
  fallbackParent?: HTMLElement,
  fallback?: LegResultInput
): LegResult => {
  const checkNodes = (root: HTMLElement): LegResult | null => {
    const targets: Element[] = [];
    if (root.matches?.("svg, path")) targets.push(root);
    targets.push(...Array.from(root.querySelectorAll("svg, path, svg *")));

    for (const node of targets) {
      const res = iconResultFromNode(node);
      if (res) return res;
    }
    return null;
  };

  const searchOrder: HTMLElement[] = [row];
  if (fallbackParent && fallbackParent !== row) {
    searchOrder.push(fallbackParent);
  }

  let parent: HTMLElement | null = row.parentElement;
  let depth = 0;
  while (parent && depth < 4) {
    if (!searchOrder.includes(parent)) searchOrder.push(parent);
    parent = parent.parentElement;
    depth += 1;
  }

  const visited = new Set<HTMLElement>();
  for (const element of searchOrder) {
    if (!element || visited.has(element)) continue;
    visited.add(element);
    const found = checkNodes(element);
    if (found) return found;
  }

  const text = normalizeSpaces(row.textContent || "");
  if (/void(ed)?/i.test(text)) {
    return "VOID" as LegResult;
  }

  return toLegResult(fallback ?? "PENDING");
};

export const aggregateChildResults = (
  children: BetLeg[],
  fallback?: LegResultInput
): LegResult => {
  const childResults = children.map((c) => toLegResult(c.result));
  // If any child is PUSH (voided), the whole group is PUSH
  if (childResults.some((r) => r === "PUSH")) return "PUSH";
  if (childResults.some((r) => r === "LOSS")) return "LOSS";
  if (childResults.some((r) => r === "PENDING")) return "PENDING";
  if (childResults.some((r) => r === "UNKNOWN")) return "UNKNOWN";
  if (childResults.length && childResults.every((r) => r === "WIN"))
    return "WIN";
  return toLegResult(fallback ?? "PENDING");
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
    .replace(/FinishedFinished/gi, " ")
    .replace(/Box Score.*$/i, " ")
    .replace(/Play-by-play.*$/i, " ")
    .replace(/Finished\s+Box\s+Score/i, " ")
    .replace(/Finished\s+Play-by-play/i, " ");

  // Drop embedded schedule/date fragments that sometimes stick to names
  cleaned = stripDateTimeNoise(cleaned);

  // Remove sequences of quarter/period scores (e.g., "35293627 127110")
  cleaned = cleaned.replace(/\b\d{1,3}\b(\s+\d{1,3}){3,}/g, " ");

  // Remove long numeric IDs/score blobs that can cling to names (6+ digits)
  cleaned = cleaned.replace(/\b\d{6,}\b/g, " ");

  // Remove trailing actual/stat pairs like "3 6" that follow leg lines
  cleaned = cleaned.replace(/\s+\d{1,3}\s+\d{1,3}\s*$/g, " ");

  // Remove game score patterns (e.g., "Team1 120112 Team2 110127")
  cleaned = cleaned.replace(/\b\d{3,6}\s+\d{3,6}\b/g, " ");

  return normalizeSpaces(cleaned);
};

export const PLAYER_NAME_PATTERN =
  "[A-Z][A-Za-z'\\.]+(?:\\s+[A-Z][A-Za-z'\\.]+)*";

const TEAM_TOKENS = new Set(
  [
    "spurs",
    "grizzlies",
    "hawks",
    "bulls",
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
    "bills",
    "ravens",
    "cardinals",
    "niners",
    "49ers",
    "lakers",
    "celtics",
    "heat",
    "suns",
    "trail blazers",
    "blazers",
    "cavaliers",
    "clippers",
    "kings",
    "wizards",
    "knicks",
    "nets",
    "mavericks",
    "raptors",
  ].map((t) => t.toLowerCase())
);

export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

// Attempt to build a matchup string from known team names in the text.
export const inferMatchupFromTeams = (text: string): string | null => {
  if (!text) return null;
  const TEAM_NAMES = [
    "Chicago Bulls",
    "Utah Jazz",
    "Golden State Warriors",
    "New Orleans Pelicans",
    "Atlanta Hawks",
    "Phoenix Suns",
    "Portland Trail Blazers",
    "Detroit Pistons",
    "Orlando Magic",
    "Los Angeles Lakers",
    "Seattle Seahawks",
    "Los Angeles Rams",
    "San Francisco 49ers",
    "Arizona Cardinals",
    "Kansas City Chiefs",
    "Denver Broncos",
    "Baltimore Ravens",
    "Cleveland Browns",
    "Dallas Mavericks",
    "Memphis Grizzlies",
    "Boston Celtics",
  ];

  const lower = text.toLowerCase();
  const hits: Array<{ name: string; idx: number }> = [];

  for (const name of TEAM_NAMES) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx !== -1) {
      hits.push({ name, idx });
    }
  }

  hits.sort((a, b) => a.idx - b.idx);
  const uniq: string[] = [];
  for (const h of hits) {
    if (!uniq.some((n) => n.toLowerCase() === h.name.toLowerCase())) {
      uniq.push(h.name);
    }
    if (uniq.length === 2) break;
  }

  if (uniq.length === 2) {
    return `${uniq[0]} @ ${uniq[1]}`;
  }

  return null;
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

  // Strategy 3: Check parent elements for odds spans
  if (!txt) {
    let parent = root.parentElement;
    while (parent && parent !== root.ownerDocument?.body) {
      const parentOddsSpan = parent.querySelector<HTMLElement>(
        'span[aria-label^="Odds"]'
      );
      if (parentOddsSpan) {
        txt = parentOddsSpan.textContent?.trim() ?? "";
        if (txt) break;
      }
      // Also check for odds patterns in parent spans
      const parentSpans = Array.from(parent.querySelectorAll("span"));
      for (const span of parentSpans) {
        const spanText = span.textContent ?? "";
        const oddsMatch = spanText.match(/^([+\-]\d{3,})$/);
        if (oddsMatch) {
          txt = oddsMatch[1];
          break;
        }
      }
      if (txt) break;
      parent = parent.parentElement;
    }
  }

  // Strategy 4: Check sibling elements for odds
  if (!txt) {
    const siblings = Array.from(
      (root.parentElement?.children ?? []) as HTMLElement[]
    );
    for (const sibling of siblings) {
      if (sibling === root) continue;
      const siblingOddsSpan = sibling.querySelector<HTMLElement>(
        'span[aria-label^="Odds"]'
      );
      if (siblingOddsSpan) {
        txt = siblingOddsSpan.textContent?.trim() ?? "";
        if (txt) break;
      }
      const siblingText = sibling.textContent ?? "";
      const oddsMatch = siblingText.match(/\b([+\-]\d{3,})\b/);
      if (oddsMatch) {
        txt = oddsMatch[1];
        break;
      }
    }
  }

  // Strategy 5: Extract from raw text (more comprehensive patterns)
  if (!txt) {
    const text = root.textContent ?? "";
    // Look for patterns like "+240", "-120", "+116" (3+ digits after +/-)
    const patterns = [
      /([+\-]\d{3,})\b/, // Standard odds
      /\b([+\-]\d{2,})\b/, // Shorter odds (like -110)
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches[1]) {
        // Validate it's likely odds (not a spread or stat line)
        const value = parseInt(matches[1].replace(/[+\-]/, ""), 10);
        // Odds are typically >= 100 or negative values like -110
        if (value >= 100 || (matches[1].startsWith("-") && value >= 100)) {
          txt = matches[1];
          break;
        }
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

  // Remove redundant text like "Current rebounds: 1" or "Current rebounds: X"
  desc = desc.replace(/\s*Current\s+\w+:\s*\d+\s*/gi, " ").trim();

  // Fix "Over [Name]" patterns - remove redundant name after "Over"
  // Pattern: "Onyeka Okongwu Over Onyeka OKONGWU - REBOUNDS" -> "Onyeka Okongwu Over [line]"
  const overNameMatch = desc.match(
    /^([A-Za-z' .-]+)\s+Over\s+([A-Z][A-Z\s]+)/i
  );
  if (overNameMatch) {
    const name = overNameMatch[1].trim();
    const afterOver = overNameMatch[2].trim();
    // If what comes after "Over" looks like a name (all caps or mixed case), remove it
    if (
      /^[A-Z\s]+$/.test(afterOver) ||
      /^[A-Z][a-z]+\s+[A-Z]/.test(afterOver)
    ) {
      // Extract market type if present
      const marketMatch = desc.match(/-\s*(\w+)/i);
      const market = marketMatch ? marketMatch[1] : "";
      desc = market ? `${name} Over ${market}` : `${name} Over`;
    }
  }

  // Remove duplicate player/team names
  // Pattern: "Name ... Name ..." where name appears twice
  const nameMatch = desc.match(/^([A-Za-z' .-]+?)(?:\s|,)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    // Check if name appears again later in the description
    const nameRegex = new RegExp(
      name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    const matches = desc.match(nameRegex);
    if (matches && matches.length > 1) {
      // Remove the duplicate occurrence (keep the first one)
      const parts = desc.split(nameRegex);
      if (parts.length > 2) {
        // Reconstruct with name only appearing once at the start
        desc = name + " " + parts.slice(1).join(" ").trim();
      }
    }
  }

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

  // Pattern: "Player Name To Record X+ Assists" (check before To Score to avoid misclassification)
  const toRecordAstMatch = desc.match(
    /^([A-Za-z' .-]+?)\s+To\s+Record\s+(\d+(?:\.\d+)?)\+\s+Assists/i
  );
  if (toRecordAstMatch && !name) {
    name = toRecordAstMatch[1].trim();
    line = `${toRecordAstMatch[2]}+`;
    type = "Ast";
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
          // Pattern: "Made Threes Isaiah Collier" or "Made Threes 8+" - extract name after prefix
          const madeThreesPrefixMatch = desc.match(
            /^Made\s+Threes\s+([A-Za-z' .-]+)/i
          );
          if (madeThreesPrefixMatch) {
            name = madeThreesPrefixMatch[1].trim();
            // Also try to extract the line if present
            const lineMatch = desc.match(/(\d+)\+/i);
            if (lineMatch) {
              line = `${lineMatch[1]}+`;
            }
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
  }

  // 2) Over / Under lines (only if not already extracted)
  if (!ou || !line) {
    const overMatch = ouLeading
      ? null
      : desc.match(/\bOver\s+(\d+(?:\.\d+)?)\b/i);
    const underMatch = ouLeading
      ? null
      : desc.match(/\bUnder\s+(\d+(?:\.\d+)?)\b/i);

    if (overMatch) {
      if (!ou) ou = "Over";
      if (!line) line = overMatch[1];
    } else if (underMatch) {
      if (!ou) ou = "Under";
      if (!line) line = underMatch[1];
    }
  }

  // Fallback: If we have ou but no line, try to extract from anywhere in the description
  if (ou && !line) {
    const ouText = ou === "Over" ? "Over" : "Under";
    const fallbackMatch = desc.match(
      new RegExp(`\\b${ouText}\\s+(\\d+(?:\\.\\d+)?)`, "i")
    );
    if (fallbackMatch && fallbackMatch[1]) {
      line = fallbackMatch[1];
    }
  }

  // Special handling for Total bets: if type is Total and description is generic, extract from rawText
  if (type === "Total" && (!line || desc.toLowerCase().trim() === "total")) {
    const totalMatch = rawText.match(/(Over|Under)\s+(\d+(?:\.\d+)?)/i);
    if (totalMatch) {
      if (!ou) ou = totalMatch[1] === "Over" ? "Over" : "Under";
      if (!line) line = totalMatch[2];
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
          // Pattern: "To Record 30+ Points" or "To Record 10+ Assists" (without player name prefix)
          const toRecordMatch = desc.match(/TO RECORD\s+(\d+)\+\s+(\w+)/i);
          if (toRecordMatch) {
            line = `${toRecordMatch[1]}+`;
            // If it's assists, set type to Ast (important for high targets like 8+, 10+)
            if (/ASSIST/i.test(toRecordMatch[2])) {
              type = "Ast";
            }
          } else {
            // Pattern: "X+ Stat" anywhere (e.g., "10+ Assists", "6+ Assists")
            // Check for Assists FIRST to avoid misclassification as 3pt
            const assistsMatch = desc.match(/(\d+)\+\s+ASSISTS/i);
            if (assistsMatch) {
              line = `${assistsMatch[1]}+`;
              type = "Ast";
            } else {
              const statMatch = desc.match(
                /(\d+)\+\s+(REBOUNDS|POINTS|THREES|MADE THREES)/i
              );
              if (statMatch) {
                line = `${statMatch[1]}+`;
              }
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
  } else if (/ASSISTS|TO RECORD.*ASSISTS|\d+\+\s+ASSISTS/i.test(textCombined)) {
    // Check for assists BEFORE checking for 3pt, especially for high targets
    type = "Ast";
  } else if (
    /MADE THREES|3PT|THREE POINT|THREES|MADE 3/.test(textCombined) ||
    /MADE THREES|3PT|THREE/.test(descUpper)
  ) {
    type = "3pt";
  } else if (/POINTS/.test(textCombined)) {
    type = "Pts";
  } else if (/REBOUNDS/.test(textCombined)) {
    type = "Reb";
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
  // Check for assists BEFORE 3pt to avoid misclassification of high targets (8+, 10+)
  if (
    upper.includes("ASSIST") ||
    /TO RECORD.*ASSIST|\d+\+\s+ASSIST/i.test(upper)
  )
    return "Ast";
  if (/MADE THREES|3PT|THREES/.test(upper)) return "3pt";
  if (upper.includes("POINT")) return "Pts";
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

  // Handle aria-labels with comma-separated descriptive text
  // Pattern: "Player Name 50+ Yards, Player Name - Alt Receiving Yds, , +1100, Team @ Team, Date"
  // Extract only the player name before the first comma (if comma is followed by descriptive text)
  const commaMatch = cleaned.match(
    /^([^,]+?)(?:\s+\d+\+\s*(?:Yards|Yds|Receptions|Rec|Points|Pts|Rebounds|Reb|Assists|Ast|Made\s+Threes|3pt|Threes))?\s*,\s*/i
  );
  if (commaMatch) {
    // Check if what comes after the comma looks like descriptive text (not part of the name)
    const afterComma = cleaned.substring(commaMatch[0].length);
    // If after comma contains market indicators, odds, team names, or dates, use the part before comma
    if (
      /alt\s+(receiving|rushing|yards|receptions)|[+\-]\d{3,}|@|et\b|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct/i.test(
        afterComma
      )
    ) {
      cleaned = commaMatch[1].trim();
    }
  }

  // Filter out generic/invalid entity names
  const genericWords = [
    "made",
    "yards",
    "receptions",
    "available same game",
    "same game",
    "parlay",
    "parlay™",
  ];
  if (
    genericWords.some(
      (word) =>
        cleaned.toLowerCase() === word ||
        cleaned.toLowerCase() === word.toLowerCase()
    )
  ) {
    return "";
  }

  // Strip promotional text prefixes (e.g., "Parlay™", "Same Game", etc.)
  cleaned = cleaned.replace(/^parlay™\s*/i, "");
  cleaned = cleaned.replace(/^parlay\s*/i, "");
  cleaned = cleaned.replace(/^same\s+game\s*/i, "");
  cleaned = cleaned.replace(/^play[-\s]*/i, "");
  cleaned = cleaned.replace(/^plus available[-\s]*/i, "");
  cleaned = cleaned.replace(/^includes[-\s]*/i, "");
  cleaned = cleaned.replace(/^available\s+same\s+game\s*/i, "");

  // Strip market prefixes like "Made Threes", "To Record", "To Score" (e.g., "Made Threes Isaiah Collier" → "Isaiah Collier")
  cleaned = cleaned.replace(/^made\s+threes\s+/i, "");
  cleaned = cleaned.replace(/^made\s+three\s+/i, "");
  cleaned = cleaned.replace(/^to\s+record\s+/i, "");
  cleaned = cleaned.replace(/^to\s+score\s+/i, "");
  cleaned = cleaned.replace(/^to\s+record\s+a\s+/i, "");

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

  // Remove " - Alt Receiving Yds" or similar market descriptions that might remain
  cleaned = cleaned.replace(
    /\s*-\s*Alt\s+(Receiving|Rushing)\s+(Yds|Yards|Receptions|Rec)\s*$/i,
    ""
  );
  cleaned = cleaned.replace(
    /^Alt\s+(Receiving|Rushing)\s+(Yds|Yards|Receptions|Rec)\s+/i,
    ""
  );
  cleaned = cleaned.replace(/^Alt\s+(Receptions|Receiving|Rushing)\s+/i, "");
  cleaned = cleaned.replace(/^Points\s+Void\s+/i, "");
  cleaned = cleaned.replace(/^Void\s+/i, "");

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

  // Final cleanup: remove any remaining duplicate player names
  // Pattern: "Player Name Player Name" → "Player Name"
  const nameWords = cleaned.split(/\s+/);
  if (nameWords.length >= 4) {
    // Check if first two words match last two words (duplicate name)
    const firstTwo = nameWords.slice(0, 2).join(" ").toLowerCase();
    const lastTwo = nameWords.slice(-2).join(" ").toLowerCase();
    if (firstTwo === lastTwo) {
      cleaned = nameWords.slice(0, 2).join(" ");
    }
  }

  return cleaned.trim();
};

export const parseLegFromText = (
  text: string,
  odds: number | null,
  result: LegResultInput,
  skipOdds: boolean = false
): BetLeg | null => {
  const cleaned = stripScoreboardText(text);
  if (!cleaned) return null;

  // Check for void status in the text
  // Pattern: "Player Name ... Void" or "Player Name To Score 30+ Points Void"
  let isVoid = false;
  const voidPattern = /\bVoid\b/i;

  // Check if "Void" appears in the original text (before cleaning)
  // This catches cases like "Zion Williamson To Score 30+ Points Void"
  if (voidPattern.test(text)) {
    // Check if void appears right after the leg description
    // Remove void from cleaned text for processing, but remember it was there
    const voidMatch = text.match(/(.+?)\s+Void\b/i);
    if (voidMatch && voidMatch[1]) {
      // Check if the text before "Void" looks like a complete leg description
      const beforeVoid = voidMatch[1].trim();
      const legEndPattern =
        /(?:Points|Assists|Yards|Receptions|Made Threes|Triple Double|Rebounds)\s*$/i;
      if (
        legEndPattern.test(beforeVoid) ||
        /To Score|To Record/i.test(beforeVoid)
      ) {
        isVoid = true;
      }
    }
  }

  // Extract odds from text if not provided
  let extractedOdds = odds;
  if (!extractedOdds && !skipOdds) {
    // Look for odds patterns in text (e.g., "+410", "-120")
    const oddsMatch = cleaned.match(/\b([+\-]\d{3,})\b/);
    if (oddsMatch && oddsMatch[1]) {
      const value = parseInt(oddsMatch[1].replace(/[+\-]/, ""), 10);
      // Validate it's likely odds (>= 100 or negative like -110)
      if (value >= 100 || (oddsMatch[1].startsWith("-") && value >= 100)) {
        extractedOdds = parseInt(oddsMatch[1], 10);
        if (Number.isNaN(extractedOdds)) extractedOdds = null;
      }
    }
  }

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
    odds: skipOdds ? undefined : extractedOdds ?? undefined,
    result: isVoid ? "PUSH" : toLegResult(result),
  };

  return leg;
};

export interface ParseLegOptions {
  fallbackOdds?: number | null;
  fallbackType?: BetType | null;
  fallbackCategory?: MarketCategory | null;
  fallbackDescription?: string | null;
  fallbackResult?: LegResultInput;
  parentForResultLookup?: HTMLElement | null;
  skipOdds?: boolean;
}

export const parseLegFromNode = (
  node: HTMLElement,
  options: ParseLegOptions = {}
): BetLeg | null => {
  const {
    fallbackOdds,
    fallbackType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fallbackCategory,
    fallbackDescription,
    fallbackResult,
    parentForResultLookup,
    skipOdds = false,
  } = options;

  const aria = normalizeSpaces(node.getAttribute("aria-label") || "");
  const text = normalizeSpaces(node.textContent ?? "");
  const rawSource = aria || text || fallbackDescription || "";
  const source = stripScoreboardText(rawSource);
  const extractedOdds = skipOdds ? null : extractOdds(node);

  // Check for void status in HTML structure
  let isVoid = false;
  const hasVoidText =
    /\bVoid(ed)?\b/i.test(text) || /\bVoid(ed)?\b/i.test(aria);
  const warningIcon =
    node.querySelector('svg[fill="#C15400"]') ||
    node.querySelector('svg[fill*="C15400"]') ||
    node.querySelector('svg[id*="warning" i]');
  if (warningIcon || hasVoidText) {
    isVoid = true;
  }

  const spans = node.querySelectorAll("span");
  for (const span of spans) {
    if (/\bVoid(ed)?\b/i.test(span.textContent || "")) {
      isVoid = true;
      break;
    }
  }

  // Strip "Void" from source text if present
  let cleanedSource = source.replace(/\bVoid(ed)?\b/gi, "").trim();
  cleanedSource = cleanedSource.replace(/^\s*Void(ed)?\s+/i, "").trim();

  const legResultRaw = extractLegResultFromRow(
    node,
    parentForResultLookup ?? undefined,
    fallbackResult
  );
  if (legResultRaw === "VOID") {
    isVoid = true;
  }
  const normalizedResult =
    legResultRaw === "VOID" ? ("VOID" as LegResult) : toLegResult(legResultRaw);

  const derived = deriveFieldsFromDescription(cleanedSource, cleanedSource);
  const market =
    derived.type ||
    fallbackType ||
    guessMarketFromText(cleanedSource) ||
    "Other";
  let target =
    derived.line ||
    (market === "Spread" ? extractSpreadTarget(cleanedSource) : undefined);

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
    const spreadLike = cleanedSource.match(/[+\-]\d+(?:\.\d+)?/);
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

  let entityName = derived.name
    ? cleanEntityName(stripTargetFromName(derived.name, target))
    : undefined;

  // Strip "Void" from entity name if it somehow got included
  if (entityName) {
    entityName = entityName.replace(/^Void(ed)?\s+/i, "").trim();
  }

  // Ensure target is set from line when ou is present
  if (!target && derived.ou && derived.line) {
    target = derived.line;
  }

  let odds = extractedOdds;
  if (!skipOdds && odds == null && fallbackOdds != null) {
    odds = fallbackOdds;
  }

  const leg: BetLeg = {
    entities: entityName ? [entityName] : undefined,
    market: finalMarket,
    target,
    ou: derived.ou,
    odds: skipOdds ? null : odds ?? undefined,
    result: isVoid ? ("VOID" as LegResult) : normalizedResult,
  };

  return leg;
};

export interface BuildLegsFromRowsOptions {
  result?: LegResultInput;
  skipOdds?: boolean;
  fallbackOdds?: number | null;
  fallbackType?: BetType | null;
  fallbackCategory?: MarketCategory | null;
  fallbackDescription?: string | null;
  parentForResultLookup?: HTMLElement | null;
}

export const buildLegsFromRows = (
  rows: HTMLElement[],
  options: BuildLegsFromRowsOptions = {}
): BetLeg[] => {
  const {
    result = "PENDING",
    skipOdds = false,
    fallbackOdds,
    fallbackType = null,
    fallbackCategory = null,
    fallbackDescription = null,
    parentForResultLookup = null,
  } = options;

  const legs: BetLeg[] = [];

  for (const row of rows) {
    const leg = parseLegFromNode(row, {
      fallbackOdds,
      fallbackType,
      fallbackCategory,
      fallbackDescription,
      fallbackResult: result,
      parentForResultLookup,
      skipOdds,
    });
    if (leg) legs.push(leg);
  }

  return legs;
};

export const buildLegsFromDescription = (
  description: string,
  result: LegResultInput,
  skipOdds: boolean = false
): BetLeg[] => {
  if (!description) return [];

  // Parse comma-separated leg descriptions
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
  result: LegResultInput
): BetLeg[] => {
  if (!rawText) return [];

  // First, detect "Void" status in the text and mark positions
  // Pattern: "Player Name ... Void" or "Player Name ... Void Player Name ..."
  // We need to track which leg should be marked as void
  const voidPositions = new Map<number, boolean>();

  // Find all "Void" occurrences and check if they're associated with a previous leg
  // Look for patterns like "Player Name To Score 30+ Points Void" or "Player Name ... Void Will Richard"
  const voidPattern = /\bVoid\b/gi;
  let voidMatch;
  while ((voidMatch = voidPattern.exec(rawText)) !== null) {
    const voidIndex = voidMatch.index;
    // Check the text before "Void" to see if it ends with a leg pattern
    const beforeVoid = rawText.substring(
      Math.max(0, voidIndex - 200),
      voidIndex
    );
    // Check if there's a leg pattern ending just before "Void"
    const legEndPattern =
      /(?:Points|Assists|Yards|Receptions|Made Threes|Triple Double)\s*$/i;
    if (legEndPattern.test(beforeVoid.trim())) {
      // This "Void" is associated with the previous leg
      // We'll mark the leg index when we process matches
    }
  }

  // Collect stat legs like "Player 80+ Yards" or "Player To Record 10+ Assists"
  // Enhanced patterns to catch more variations, especially for SGP+ bets
  const patterns = [
    // Pattern for "Made Threes" legs: "Player Name X+ Made Threes" (specific pattern to catch this common case)
    new RegExp(`(${PLAYER_NAME_PATTERN})\\s+(\\d+\\+)\\s+Made\\s+Threes`, "gi"),
    // Pattern for stat-based legs: "Player Name 50+ Yards" or "Player Name 3+ Receptions"
    new RegExp(
      `(${PLAYER_NAME_PATTERN})\\s+(\\d+\\+)\\s+(Yards|Receptions|Yds|Rec|Points|Assists|Receiving Yds|Alt Receiving Yds|Alt Receptions)`,
      "gi"
    ),
    // Pattern for "To Record" legs: "Player Name To Record A Triple Double" or "Player Name To Record 10+ Assists"
    new RegExp(
      `(${PLAYER_NAME_PATTERN})\\s+To\\s+Record\\s+(?:A\\s+)?(Triple Double|\\d+\\+\\s+\\w+)`,
      "gi"
    ),
    // Pattern for "To Score" legs: "Player Name To Score 30+ Points"
    new RegExp(
      `(${PLAYER_NAME_PATTERN})\\s+To\\s+Score\\s+(\\d+\\+)\\s+Points`,
      "gi"
    ),
  ];

  const matches: Array<{
    full: string;
    player: string;
    target?: string;
    market: string;
    isVoid?: boolean;
    matchIndex: number;
  }> = [];
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
      const full = match[0];
      let player = match[1];

      // Strip "Void" from the beginning of player names
      // This handles cases like "Void Will Richard" where "Void" got attached to the name
      player = player.replace(/^Void\s+/i, "").trim();

      let target: string | undefined;
      let market: string | undefined;
      let isVoid = false;

      if (i === 0) {
        // Pattern 0: "Player Name X+ Made Threes" (specific pattern)
        // match[1] = player, match[2] = "X+"
        if (match[2]) {
          target = match[2];
          market = "Made Threes";
        } else {
          continue;
        }
      } else if (i === 1) {
        // Pattern 1: "Player Name 50+ Yards" or "Player Name 3+ Receptions"
        // match[1] = player, match[2] = "50+", match[3] = "Yards" or "Receptions"
        if (match[2] && match[3]) {
          target = match[2];
          market = match[3];
        } else {
          continue;
        }
      } else if (i === 2) {
        // Pattern 2: "Player Name To Record A Triple Double" or "Player Name To Record 10+ Assists"
        // match[1] = player, match[2] = "Triple Double" or "10+ Assists"
        if (
          match[2] === "Triple Double" ||
          match[2]?.includes("Triple Double")
        ) {
          market = "TD";
        } else if (match[2]) {
          // "10+ Assists" format
          const targetMatch = match[2].match(/(\d+\+)\s+(\w+)/);
          if (targetMatch && targetMatch[1] && targetMatch[2]) {
            target = targetMatch[1];
            market = targetMatch[2];
          } else {
            continue;
          }
        } else {
          continue;
        }
      } else if (i === 3) {
        // Pattern 3: "Player Name To Score 30+ Points"
        // match[1] = player, match[2] = "30+", match[3] = "Points"
        if (match[2] && match[3]) {
          target = match[2];
          market = match[3];
        } else {
          continue;
        }
      } else {
        continue;
      }

      // Validate that we have a market before proceeding
      if (!market) {
        continue;
      }

      // Check if "Void" appears right after this match in the text
      // Increase the lookahead window to catch void that might be separated by whitespace
      const matchEnd = match.index + match[0].length;
      const afterMatch = rawText.substring(matchEnd, matchEnd + 20).trim();
      if (/^Void\b/i.test(afterMatch)) {
        isVoid = true;
      }

      // Also check if void appears within the match itself (e.g., "Player To Score 30+ Points Void")
      if (/\bVoid\b/i.test(full)) {
        // Check if void is at the end of the match
        const voidInMatch = full.match(/(.+?)\s+Void\s*$/i);
        if (voidInMatch) {
          isVoid = true;
        }
      }

      // Normalize market names
      if (market.includes("Made Threes") || market === "Made Threes") {
        market = "3pt";
      } else if (
        market.includes("Yards") ||
        market.includes("Yds") ||
        market.includes("Receiving")
      ) {
        market = "Yds";
      } else if (market.includes("Receptions") || market.includes("Rec")) {
        market = "Rec";
      } else if (market.includes("Points") || market.includes("Pts")) {
        market = "Pts";
      } else if (market.includes("Assists") || market.includes("Ast")) {
        market = "Ast";
      } else if (market.includes("Threes") || market.includes("3pt")) {
        market = "3pt";
      }

      matches.push({
        full,
        player,
        target,
        market,
        isVoid,
        matchIndex: match.index,
      });
    }
  }

  const legs: BetLeg[] = [];
  const seen = new Set<string>();

  // First pass: build all legs
  matches.forEach((m) => {
    // Create a unique key to avoid duplicates
    const key = `${m.player}_${m.market}_${m.target || ""}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    // Strip "Void" from the full match text if it was included
    let cleanedFull = m.full.replace(/^Void\s+/i, "");

    // Try parsing the cleaned full match first
    let leg = parseLegFromText(cleanedFull, null, result, false);

    // If that doesn't work, try constructing it manually
    if (!leg) {
      leg = {
        entities: [m.player],
        market: m.market,
        target: m.target,
        result: m.isVoid ? "VOID" : toLegResult(result),
      };
    } else {
      // Update result if this leg is void
      if (m.isVoid) {
        leg.result = "VOID" as LegResult;
      }
      // Also ensure the entity name doesn't have "Void" in it
      if (leg.entities && leg.entities[0]) {
        leg.entities[0] = leg.entities[0].replace(/^Void\s+/i, "").trim();
      }
    }

    if (leg) legs.push(leg);
  });

  return legs;
};

export const buildLegsFromSpans = (
  root: HTMLElement,
  result: LegResultInput
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
  if (leg.isGroupLeg && leg.children?.length) {
    const childSummary = leg.children
      .map(formatLegSummary)
      .filter(Boolean)
      .join(", ");
    const label = leg.target
      ? `Same Game Parlay - ${leg.target}`
      : "Same Game Parlay";
    return childSummary ? `${label}: ${childSummary}` : label;
  }

  const name = cleanEntityName(leg.entities?.[0] ?? "");
  const market = leg.market || "";
  const target = leg.target ?? "";

  if (market.toLowerCase() === "spread" && target) {
    return name ? `${name} ${target}` : String(target);
  }

  if (market.toLowerCase() === "moneyline") {
    return name ? `${name} Moneyline` : "Moneyline";
  }

  if (market.toLowerCase() === "3pt") {
    const madeText = target ? `${target} Made Threes` : "Made Threes";
    return name ? `${name} ${madeText}` : madeText;
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
    /(same game parlay|parlay available|same-game parlay|plus available|includes|profit boost|profitboost|parlay™)/i;

  // Generic words that should not be entities
  const genericWords = new Set([
    "made",
    "yards",
    "receptions",
    "available same game",
    "same game",
    "parlay",
    "parlay™",
    "parlaytm",
  ]);

  // Promotional text patterns that should not be entities
  const promoEntityPatterns = [
    /^parlay™$/i,
    /^parlay$/i,
    /^same\s+game$/i,
    /^available\s+same\s+game$/i,
    /^made\s+threes?$/i,
    /^to\s+record$/i,
    /^to\s+score$/i,
  ];

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

    // Drop legs where the "entity" is clearly just a stat fragment (e.g., "10+ Assists")
    if (hasEntity && /^\d/.test(entity.trim())) {
      return false;
    }

    // Filter out promotional text patterns as entities
    if (
      hasEntity &&
      promoEntityPatterns.some((pattern) => pattern.test(entity))
    ) {
      return false;
    }

    // Filter out single-word entities that are market types (unless they're valid player names)
    if (hasEntity && entity.split(/\s+/).length === 1) {
      const singleWord = entity.toLowerCase().trim();
      if (
        [
          "made",
          "yards",
          "receptions",
          "points",
          "rebounds",
          "assists",
          "threes",
        ].includes(singleWord)
      ) {
        return false;
      }
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

    // Drop SGP promo/header rows entirely
    const entityLower = entity.toLowerCase();
    const marketLower2 = market.toLowerCase();
    if (
      entityLower.includes("same game parlay") ||
      entityLower.includes("same-game parlay") ||
      marketLower2.includes("same game parlay") ||
      marketLower2.includes("same-game parlay")
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
  result: LegResultInput,
  betType?: BetType,
  description?: string
): BetLeg[] => {
  if (betType === "parlay" || betType === "sgp" || betType === "sgp_plus") {
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
    result: toLegResult(result),
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
    .replace(/\s*parlay\s+available\s*/gi, "")
    // Remove "Parlay™" and trademark symbols
    .replace(/^parlay™\s*/i, "")
    .replace(/^parlay™\s*/i, "")
    .replace(/™/g, "")
    .replace(/parlay\s*™/gi, "")
    // Remove "Same Game Parlay" variations at start
    .replace(/^same\s+game\s+parlay\s*/i, "")
    .replace(/^same\s+game\s+parlay™\s*/i, "")
    // Remove promotional prefixes
    .replace(/^includes[:\s]*/i, "")
    .replace(/^plus\s+available\s*/i, "")
    // Clean up leading/trailing spaces and commas
    .replace(/^,\s*/, "")
    .replace(/\s*,\s*$/, "")
    .trim();

  // For parlays, return as-is (already formatted)
  if (betType === "parlay" || betType === "sgp" || betType === "sgp_plus") {
    // Clean up parlay descriptions
    cleaned = cleaned
      .replace(/\s*Spread Betting\s*/gi, "")
      .replace(/,\s*/g, ", ")
      // Remove any remaining promotional text
      .replace(/^parlay™\s*/i, "")
      .replace(/^parlay\s*™\s*/i, "")
      .replace(/^same\s+game\s+parlay\s*/i, "")
      .replace(/^available\s+same\s+game\s*/i, "")
      // Remove "Finished" text
      .replace(/\s*Finished\s*/gi, " ")
      .replace(/\s*FinishedFinished\s*/gi, " ")
      // Remove "Box Score" and "Play-by-play" text
      .replace(/\s*Box\s+Score.*$/i, " ")
      .replace(/\s*Play-by-play.*$/i, " ")
      .replace(/\s*Finished\s+Box\s+Score/i, " ")
      .replace(/\s*Finished\s+Play-by-play/i, " ")
      // Remove game score patterns (e.g., "35293627 127110")
      .replace(/\b\d{6,}\s+\d{6,}\b/g, " ")
      // Remove long numeric IDs
      .replace(/\b\d{6,}\b/g, " ")
      .trim();

    // Truncate to 200 chars with ellipsis if needed
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 197).trim() + "...";
    }

    return cleaned;
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

  // Handle Over/Under bets for Rebounds, Yards, etc.
  // If we have ou, line, name, and type, rebuild the description properly
  // This fixes cases like "Onyeka Okongwu Over Okongwu - REBOUNDS" -> "Onyeka Okongwu Over 8.5 Rebounds"
  if (ou && line && name && type) {
    // Check if description has malformed "Over [Name]" pattern (Over followed by letters, not the line number)
    const hasMalformedOver =
      description &&
      /Over\s+[A-Za-z]/.test(description) &&
      !description.match(
        new RegExp(
          `Over\\s+${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        )
      );

    // Also check if description has "Over" followed by part of the name (like "Over Okongwu" or "Over Pearsall")
    const nameParts = name ? name.split(/\s+/) : [];
    const lastName =
      nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
    const hasOverLastName =
      description &&
      lastName &&
      new RegExp(
        `Over\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(description) &&
      !description.match(
        new RegExp(
          `Over\\s+${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        )
      );

    // Rebuild description for Over/Under bets if:
    // 1. Description is malformed (has "Over [Name]"), OR
    // 2. Type is one that should have Over/Under format
    if (
      hasMalformedOver ||
      hasOverLastName ||
      ["Reb", "Yds", "Rec", "Ast", "3pt"].includes(type)
    ) {
      if (type === "Reb") {
        return `${name} ${ou} ${line} Rebounds`;
      }
      if (type === "Yds") {
        return `${name} ${ou} ${line} Yards`;
      }
      if (type === "Rec") {
        return `${name} ${ou} ${line} Receptions`;
      }
      if (type === "Ast") {
        return `${name} ${ou} ${line} Assists`;
      }
      if (type === "3pt") {
        return `${name} ${ou} ${line} Made Threes`;
      }
    }
  }

  // Final cleanup: remove any remaining HTML artifacts
  description = description
    .replace(/\s*Finished\s*/gi, " ")
    .replace(/\s*FinishedFinished\s*/gi, " ")
    .replace(/\s*Box\s+Score.*$/i, " ")
    .replace(/\s*Play-by-play.*$/i, " ")
    .replace(/\b\d{6,}\s+\d{6,}\b/g, " ") // Remove game score patterns
    .trim();

  // Truncate to 200 chars with ellipsis if needed
  if (description.length > 200) {
    description = description.substring(0, 197).trim() + "...";
  }

  // Fallback to original description
  return description;
};

export const inferMarketCategory = (
  betType: BetType,
  type?: string
): MarketCategory => {
  if (betType === "parlay" || betType === "sgp" || betType === "sgp_plus") {
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

  // PRIORITY 1: Market-based detection from parsed market types (highest priority)
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

  // PRIORITY 2: Market keywords in text itself (high priority)
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

  // PRIORITY 3: Explicit sport mentions (high priority)
  if (upper.includes("NFL") || upper.includes("FOOTBALL")) {
    return "NFL";
  }
  if (upper.includes("NBA") || upper.includes("BASKETBALL")) {
    return "NBA";
  }
  if (upper.includes("MLB") || upper.includes("BASEBALL")) {
    return "MLB";
  }

  // PRIORITY 4: Team name matching (fallback - lower priority)
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
    upper.includes("MAVERICKS")
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
    upper.includes("NINERS")
  ) {
    return "NFL";
  }

  // MLB teams
  if (
    upper.includes("YANKEES") ||
    upper.includes("RED SOX") ||
    upper.includes("DODGERS")
  ) {
    return "MLB";
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
    betType === "parlay" ||
    betType === "sgp" ||
    betType === "sgp_plus" ||
    /leg\s+parlay/i.test(rawText);
  let description = "";

  if (isParlayHeader) {
    // Look for the description span that contains the leg descriptions
    // It's usually a span with class containing "io ip iq jn" or similar
    const allSpans = Array.from(headerLi.querySelectorAll("span"));
    const descSpan = allSpans.find((s) => {
      const text = s.textContent || "";
      return (
        /Spread Betting/i.test(text) &&
        text.includes(",") &&
        /[+\-]\d/.test(text)
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

    // Fallback: If we have ou but no line, try to extract from raw text
    if (ou && !line) {
      const ouText = ou === "Over" ? "Over" : "Under";
      const rawMatch = rawText.match(
        new RegExp(`\\b${ouText}\\s+(\\d+(?:\\.\\d+)?)`, "i")
      );
      if (rawMatch && rawMatch[1]) {
        line = rawMatch[1];
      }
    }

    // Special handling for Total bets: if type is Total and line is missing, extract from rawText
    if (type === "Total" && !line) {
      const totalMatch = rawText.match(/(Over|Under)\s+(\d+(?:\.\d+)?)/i);
      if (totalMatch) {
        ou = totalMatch[1] === "Over" ? "Over" : "Under";
        line = totalMatch[2];
      }
    }

    // Fix "Over [Name]" patterns in description - extract line from rawText
    // Pattern: "Onyeka Okongwu Over Onyeka OKONGWU - REBOUNDS" should become "Onyeka Okongwu Over 8.5"
    if (description && ou && !line) {
      const overNamePattern = new RegExp(
        `^${(name || "").replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}\\s+Over\\s+[A-Z]`,
        "i"
      );
      if (overNamePattern.test(description)) {
        // Try to extract line from rawText
        const ouText = ou === "Over" ? "Over" : "Under";
        const lineMatch = rawText.match(
          new RegExp(`\\b${ouText}\\s+(\\d+(?:\\.\\d+)?)`, "i")
        );
        if (lineMatch && lineMatch[1]) {
          line = lineMatch[1];
        }
      }
    }
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

  // Improve Total bet descriptions: if description is generic "Total" and we have line/ou, rebuild it
  if (
    type === "Total" &&
    line &&
    ou &&
    (description.toLowerCase().trim() === "total" || !description)
  ) {
    description = `${ou} ${line} Total Points`;
  }

  // Fix "Over [Name]" patterns in descriptions - rebuild when we have line value
  // Pattern: "Onyeka Okongwu Over Okongwu - REBOUNDS" -> "Onyeka Okongwu Over 8.5 Rebounds"
  if (name && ou && line && type) {
    // Check if description has "Over" followed by letters (name) instead of the line number
    // More flexible: check if description contains name + "Over" + letters (not numbers)
    const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasMalformedOver =
      description &&
      new RegExp(`${nameEscaped}\\s+Over\\s+[A-Za-z]`, "i").test(description) &&
      !description.match(
        new RegExp(
          `Over\\s+${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        )
      );

    // Also check if description just has "Over" followed by part of the name (like "Over Okongwu" or "Over Pearsall")
    const nameParts = name.split(/\s+/);
    const lastName = nameParts[nameParts.length - 1];
    const hasOverLastName =
      description &&
      new RegExp(
        `Over\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      ).test(description) &&
      !description.match(
        new RegExp(
          `Over\\s+${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        )
      );

    if (hasMalformedOver || hasOverLastName) {
      const typeName =
        type === "Reb"
          ? "Rebounds"
          : type === "Yds"
          ? "Yards"
          : type === "Rec"
          ? "Receptions"
          : type === "Ast"
          ? "Assists"
          : type === "3pt"
          ? "Made Threes"
          : "";
      if (typeName) {
        description = `${name} ${ou} ${line} ${typeName}`;
      } else {
        description = `${name} ${ou} ${line}`;
      }
    }
  }

  // Remove promotional text from descriptions (enhanced)
  if (description) {
    description = description
      .replace(/^available\s+Same\s+Game\s*/i, "")
      .replace(/\s*available\s+Same\s+Game\s*/gi, "")
      .replace(/^same\s+game\s+parlay\s+available\s*/i, "")
      .replace(/\s*same\s+game\s+parlay\s+available\s*/gi, "")
      .replace(/^parlay\s+available\s*/i, "")
      .replace(/\s*parlay\s+available\s*/gi, "")
      // Remove "Parlay™" and trademark symbols
      .replace(/^parlay™\s*/i, "")
      .replace(/^parlay\s*™\s*/i, "")
      .replace(/\bparlay™\b/gi, "")
      .replace(/™/g, "")
      // Remove "Same Game Parlay" variations at start
      .replace(/^same\s+game\s+parlay\s*/i, "")
      .replace(/^same\s+game\s+parlay™\s*/i, "")
      // Remove promotional prefixes
      .replace(/^includes[:\s]*/i, "")
      .replace(/^plus\s+available\s*/i, "")
      // Remove "Finished" text
      .replace(/\s*Finished\s*/gi, " ")
      .replace(/\s*FinishedFinished\s*/gi, " ")
      // Remove "Box Score" and "Play-by-play" text
      .replace(/\s*Box\s+Score.*$/i, " ")
      .replace(/\s*Play-by-play.*$/i, " ")
      .replace(/\s*Finished\s+Box\s+Score/i, " ")
      .replace(/\s*Finished\s+Play-by-play/i, " ")
      // Remove game score patterns (e.g., "35293627 127110")
      .replace(/\b\d{6,}\s+\d{6,}\b/g, " ")
      // Remove long numeric IDs
      .replace(/\b\d{6,}\b/g, " ")
      // Remove redundant text like "Current rebounds: 1"
      .replace(/\s*Current\s+\w+:\s*\d+\s*/gi, " ")
      // Clean up leading/trailing spaces and commas
      .replace(/^,\s*/, "")
      .replace(/\s*,\s*$/, "")
      .trim();

    // If description still starts with promotional text, try to extract actual bet legs
    if (
      /^(parlay|parlay™|same\s+game|available\s+same\s+game)/i.test(description)
    ) {
      // Try to extract meaningful parts after promotional text
      const parts = description.split(/,\s*/);
      const meaningfulParts = parts.filter(
        (part) =>
          !/^(parlay|parlay™|same\s+game|available\s+same\s+game|includes|plus\s+available)/i.test(
            part.trim()
          )
      );
      if (meaningfulParts.length > 0) {
        description = meaningfulParts.join(", ").trim();
      }
    }

    // Truncate to 200 chars with ellipsis if needed
    if (description.length > 200) {
      description = description.substring(0, 197).trim() + "...";
    }
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

  // FanDuel leg cards without aria-labels/odds often use this class cluster.
  candidates.push(
    ...Array.from(
      cardLi.querySelectorAll<HTMLElement>("div.v.z.x.y.jk.t.ab.h")
    )
  );

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

  // Tertiary: For SGP and SGP+ bets, find nested legs that don't have aria-labels or individual odds
  // Look for divs containing player names + market text (e.g., "To Record A Triple Double")
  // These are typically inside nested SGP sections
  const cardText = cardLi.textContent || "";
  const isSGPPlusBet =
    cardText.toLowerCase().includes("same game parlay plus") ||
    cardText.toLowerCase().includes("same game parlay+") ||
    (cardText.toLowerCase().includes("includes:") &&
      /includes:\s*\d+\s+same\s+game\s+parlay/i.test(cardText));
  const isSGPBet =
    cardText.toLowerCase().includes("same game parlay") || isSGPPlusBet;

  // For SGP and SGP+ bets, use raw text extraction as fallback when DOM structure is unclear
  if (isSGPBet && candidates.length === 0) {
    // For SGP+ bets, also extract legs from raw text as a fallback
    // This catches nested SGP legs that don't have aria-labels
    const rawText = cardLi.textContent || "";

    // Look for patterns like "Player Name 50+ Yards" or "Player Name To Record A Triple Double"
    const legPatterns = [
      // Pattern for "Made Threes" legs: "Player Name X+ Made Threes" (specific pattern first)
      new RegExp(
        `(${PLAYER_NAME_PATTERN})\\s+(\\d+\\+)\\s+Made\\s+Threes`,
        "gi"
      ),
      // Pattern for stat-based legs: "Player Name 50+ Yards" or "Player Name 3+ Receptions"
      new RegExp(
        `(${PLAYER_NAME_PATTERN})\\s+(\\d+\\+)\\s+(Yards|Receptions|Points|Assists|Yds|Rec|Receiving Yds|Alt Receiving Yds|Alt Receptions)`,
        "gi"
      ),
      // Pattern for "To Record" legs: "Player Name To Record A Triple Double" or "Player Name To Record 10+ Assists"
      new RegExp(
        `(${PLAYER_NAME_PATTERN})\\s+To\\s+Record\\s+(?:A\\s+)?(Triple Double|\\d+\\+\\s+\\w+)`,
        "gi"
      ),
      // Pattern for "To Score" legs: "Player Name To Score 30+ Points"
      new RegExp(
        `(${PLAYER_NAME_PATTERN})\\s+To\\s+Score\\s+(\\d+\\+)\\s+Points`,
        "gi"
      ),
    ];

    // Extract all leg matches from raw text
    const textLegMatches: Array<{
      player: string;
      target?: string;
      market: string;
    }> = [];
    const seenLegs = new Set<string>();

    for (let i = 0; i < legPatterns.length; i++) {
      const pattern = legPatterns[i];
      let match;
      while ((match = pattern.exec(rawText)) !== null) {
        const player = match[1];
        let target: string | undefined;
        let market: string | undefined;

        if (i === 0) {
          // Pattern 0: "Made Threes"
          target = match[2];
          market = "Made Threes";
        } else if (i === 1) {
          // Pattern 1: stat-based legs
          target = match[2];
          market = match[3];
        } else if (i === 2) {
          // Pattern 2: "To Record"
          if (
            match[2] === "Triple Double" ||
            match[2]?.includes("Triple Double")
          ) {
            market = "TD";
          } else if (match[2]) {
            const targetMatch = match[2].match(/(\d+\+)\s+(\w+)/);
            if (targetMatch) {
              target = targetMatch[1];
              market = targetMatch[2];
            }
          }
        } else if (i === 3) {
          // Pattern 3: "To Score"
          target = match[2];
          market = match[3] || "Points";
        }

        if (!market) continue;

        // Normalize market
        if (market === "Made Threes") market = "3pt";
        else if (market.includes("Yards") || market.includes("Yds"))
          market = "Yds";
        else if (market.includes("Receptions") || market.includes("Rec"))
          market = "Rec";
        else if (market.includes("Points") || market.includes("Pts"))
          market = "Pts";
        else if (market.includes("Assists") || market.includes("Ast"))
          market = "Ast";

        // Create unique key to avoid duplicates
        const legKey = `${player}_${market}_${target || ""}`.toLowerCase();
        if (seenLegs.has(legKey)) continue;
        seenLegs.add(legKey);

        // Skip if this player is already in candidates (from aria-label method)
        const alreadyFound = candidates.some((c) => {
          const cText = normalizeSpaces(c.textContent || "");
          return (
            cText.includes(player) &&
            (cText.includes(target || "") || cText.includes(market))
          );
        });

        if (!alreadyFound) {
          textLegMatches.push({ player, target, market });
        }
      }
    }

    // For each text match, try to find the corresponding div
    // This helps us get the actual DOM element for better parsing
    for (const legMatch of textLegMatches) {
      // Find divs that contain this player name and market text
      const matchingDivs = Array.from(
        cardLi.querySelectorAll<HTMLElement>("div")
      ).filter((div) => {
        const text = normalizeSpaces(div.textContent || "");
        const hasPlayer = text.includes(legMatch.player);
        const hasMarket =
          text.includes(legMatch.target || "") ||
          text.includes(legMatch.market) ||
          (legMatch.market === "TD" && text.includes("Triple Double")) ||
          (legMatch.market === "3pt" &&
            (text.includes("Made Threes") || text.includes("3pt")));

        // Must not be a header/footer/scoreboard
        const isParlayHeader =
          /\b\d+\s+leg\s+parlay\b/i.test(text) ||
          /same game parlay\s*(?:plus|available)/i.test(text);
        const isFooterLike = /TOTAL WAGER|BET ID|PLACED:/i.test(text);
        const hasScoreboard =
          /\d{1,3}\s+\d{1,3}\s*Finished/i.test(text) ||
          /Box Score|Play-by-play/i.test(text);

        return (
          hasPlayer &&
          hasMarket &&
          !isParlayHeader &&
          !isFooterLike &&
          !hasScoreboard
        );
      });

      // Use the most specific div (smallest text content that still matches)
      if (matchingDivs.length > 0) {
        const bestDiv = matchingDivs.reduce((best, current) => {
          const bestText = normalizeSpaces(best.textContent || "");
          const currentText = normalizeSpaces(current.textContent || "");
          // Prefer divs that are more specific (shorter text) but still contain the full leg info
          if (currentText.length < bestText.length && currentText.length > 20) {
            return current;
          }
          return best;
        });

        // Check if not already a candidate
        const isAlreadyCandidate = candidates.some((c) => {
          if (c === bestDiv) return true;
          const cText = normalizeSpaces(c.textContent || "");
          return (
            cText.includes(legMatch.player) &&
            (c.contains(bestDiv) || bestDiv.contains(c))
          );
        });

        if (!isAlreadyCandidate) {
          candidates.push(bestDiv);
        }
      }
    }
  }

  const marketPattern =
    /SPREAD BETTING|MONEYLINE|TOTAL|TO RECORD|TO SCORE|MADE THREES|ASSISTS|REBOUNDS|POINTS|OVER|UNDER|YARDS|RECEPTIONS|REC\b|YDS/i;

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
    // For SGP+ nested legs, allow without odds if they have market text
    if (isSGPPlusBet && hasMarket) {
      return true; // Nested SGP legs may not have individual odds
    }
    if (!(hasOdds || hasMarket)) return false;

    return true;
  });

  // For SGP+ bets, we want to keep nested legs even if they're inside other candidates
  // (because the nested SGP container might also be a candidate)
  // But we still want to avoid true duplicates
  let topLevel: HTMLElement[];
  if (isSGPPlusBet) {
    // For SGP+, be more permissive - only remove if one candidate is a direct child of another
    // and they represent the same leg (same player name)
    topLevel = filtered.filter((node) => {
      const nodeText = normalizeSpaces(node.textContent || "");
      const nodePlayerMatch = nodeText.match(
        new RegExp(`(${PLAYER_NAME_PATTERN})`, "i")
      );
      if (!nodePlayerMatch) return true;

      // Check if another candidate contains this one AND has the same player name
      return !filtered.some((other) => {
        if (other === node || !other.contains(node)) return false;
        const otherText = normalizeSpaces(other.textContent || "");
        const otherPlayerMatch = otherText.match(
          new RegExp(`(${PLAYER_NAME_PATTERN})`, "i")
        );
        return otherPlayerMatch && otherPlayerMatch[1] === nodePlayerMatch[1];
      });
    });
  } else {
    // Original logic for non-SGP+ bets
    topLevel = filtered.filter(
      (node) =>
        !filtered.some((other) => other !== node && other.contains(node))
    );
  }

  // Deduplicate by reference and by normalized text to avoid double-counting the same row
  const seenText = new Set<string>();
  const unique: HTMLElement[] = [];

  for (const node of topLevel) {
    const text = normalizeSpaces(node.textContent || "");
    // For SGP+ bets, use a more lenient deduplication (just player name + market)
    if (isSGPPlusBet) {
      const playerMatch = text.match(
        new RegExp(`(${PLAYER_NAME_PATTERN})`, "i")
      );
      const marketMatch = text.match(/(To Record|To Score|\d+\+\s+\w+)/i);
      const key =
        playerMatch && marketMatch
          ? `${playerMatch[1]}_${marketMatch[1]}`.toLowerCase()
          : text.toLowerCase();
      if (seenText.has(key)) continue;
      seenText.add(key);
    } else {
      if (seenText.has(text)) continue;
      seenText.add(text);
    }
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

/**
 * Identifies if a parlay is an SGP+ (Same Game Parlay Plus) structure.
 * SGP+ is a parlay containing SGP(s) as legs, where each SGP has multiple players/teams
 * but one combined odds value.
 */
export const isSGPPlus = (rawText: string): boolean => {
  const text = rawText.toLowerCase();
  return (
    text.includes("same game parlay plus") ||
    text.includes("same game parlay+") ||
    (text.includes("includes:") &&
      /includes:\s*\d+\s+same\s+game\s+parlay/i.test(rawText))
  );
};

/**
 * Attempts to identify SGP boundaries within an SGP+ structure.
 * Returns an array of SGP groups, where each group contains the indices of legs that belong to that SGP.
 *
 * Note: This is a heuristic approach. In practice, SGP legs are grouped by game/matchup context.
 * For now, we return empty array if we can't reliably detect boundaries.
 */
export const identifySGPBoundaries = (
  legs: BetLeg[],
  rawText: string
): number[][] => {
  // For now, return empty array - SGP+ structure is complex and would require
  // more sophisticated game/matchup detection. The missing odds in some legs
  // is expected behavior for SGP+ where SGP legs share one combined odds value.
  return [];
};

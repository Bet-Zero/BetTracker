const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

// Setup global DOM
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Element = dom.window.Element;

/* COPY OF COMMON.TS UTILS */
const normalizeSpaces = (text) => (text || "").replace(/\s+/g, " ").trim();

const parseMoney = (raw) => {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

const extractHeaderInfo = (element) => {
  const dateEl = element.querySelector(
    'span[data-test-id^="bet-reference-"][data-test-id$="-0"]'
  );
  const dateStr = dateEl?.textContent
    ? normalizeSpaces(dateEl.textContent)
    : "";

  const idEl = element.querySelector(
    'span[data-test-id^="bet-reference-"][data-test-id$="-1"]'
  );
  let betId = idEl?.textContent ? normalizeSpaces(idEl.textContent) : "";

  let placedAt = dateStr;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      placedAt = d.toISOString();
    }
  } catch (e) {}

  return { betId, placedAt };
};

const extractFooterMeta = (element) => {
  const stakeEl = element.querySelector('span[data-test-id^="bet-stake-"]');
  const stakeText = stakeEl?.textContent || "";
  const stake = parseMoney(stakeText);

  const payoutEl = element.querySelector('span[data-test-id^="bet-returns-"]');
  const payoutText = payoutEl?.textContent || "";
  const payout = parseMoney(payoutText);

  const statusEl = element.querySelector(
    'div[data-test-id^="bet-details-status-"]'
  );
  const statusText = statusEl?.textContent?.toLowerCase().trim() || "";

  let result = "pending";
  if (statusText === "won") result = "win";
  else if (statusText === "lost") result = "loss";
  else if (statusText === "void") result = "push";

  return { stake, payout, result };
};

/* COPY OF SINGLE.TS PARSER */
/* COPY OF SINGLE.TS PARSER */
const parseSingleBet = (ctx) => {
  const { element, header, footer } = ctx;
  const legs = [];
  const leg = {
    market: "",
    target: "",
    result: footer.result || "pending",
    odds: 0,
  };

  let isLive = false;
  const titleEl = element.querySelector(
    'span[data-test-id^="bet-details-title-"]'
  );
  const subtitleEl = element.querySelector(
    'span[data-test-id^="bet-details-subtitle-"]'
  );

  if (subtitleEl) {
    let rawMarket = normalizeSpaces(subtitleEl.textContent || "");
    // Check for Live
    if (rawMarket.includes("Live")) {
      isLive = true;
      rawMarket = rawMarket
        .replace(/Live Betting/i, "")
        .replace(/Live/i, "")
        .trim();
    }
    leg.market = rawMarket;

    if (titleEl) {
      leg.target = normalizeSpaces(titleEl.textContent || "");
    }
  } else if (titleEl) {
    let rawMarket = normalizeSpaces(titleEl.textContent || "");
    if (rawMarket.includes("Live")) {
      isLive = true;
      rawMarket = rawMarket
        .replace(/Live Betting/i, "")
        .replace(/Live/i, "")
        .trim();
    }
    leg.market = rawMarket;
  }

  const oddsEl = element.querySelector(
    'span[data-test-id^="bet-details-displayOdds-"]'
  );
  if (oddsEl) {
    const oddsText = normalizeSpaces(oddsEl.textContent || "")
      .replace("−", "-")
      .replace("+", "");
    leg.odds = parseInt(oddsText, 10) || 0;
  }

  const statusEl = element.querySelector(
    'div[data-test-id^="bet-details-status-"]'
  );
  if (statusEl) {
    const statusText = normalizeSpaces(
      statusEl.textContent || ""
    ).toLowerCase();
    if (statusText === "won") leg.result = "win";
    else if (statusText === "lost") leg.result = "loss";
  } else if (footer.result === "win") {
    leg.result = "win";
  } else if (footer.result === "loss") {
    leg.result = "loss";
  }

  legs.push(leg);

  const description =
    (isLive ? "Live " : "") + leg.market + (leg.target ? ` ${leg.target}` : "");

  const eventCard = element.querySelector('div[data-test-id="event-card"]');
  let sport = "unknown";

  if (eventCard) {
    const team1El = eventCard.querySelector(
      'span[data-test-id^="event-team-name-1-"]'
    );
    const team1 = team1El ? normalizeSpaces(team1El.textContent || "") : "";

    if (team1.includes("Suns") || team1.includes("Trail Blazers")) {
      sport = "basketball";
    }
  }

  return {
    id: header.betId,
    betId: header.betId,
    book: "DraftKings",
    placedAt: header.placedAt,
    status: footer.result,
    stake: footer.stake || 0,
    payout: footer.payout || 0,
    result: footer.result || "pending",
    betType: "single",
    marketCategory: "Main Markets",
    isLive: isLive,
    sport: sport,
    description,
    odds: leg.odds || 0,
    legs: legs,
  };
};

const extractLegFromElement = (legEl, defaultResult) => {
  const leg = {
    market: "",
    result: "pending",
    odds: 0,
  };

  // 1. Check for Nested Items (Group Leg)
  const nestedContainer = legEl.querySelector(
    'div[class*="dkcss-"] > div[data-test-id="selection-list-item"]'
  )?.parentElement;

  if (nestedContainer) {
    leg.isGroupLeg = true;
    leg.children = [];
    const nChildren = nestedContainer.querySelectorAll(
      ':scope > div[data-test-id="selection-list-item"]'
    );
    nChildren.forEach((child) => {
      leg.children?.push(extractLegFromElement(child, defaultResult));
    });
  }

  // 2. Extract Basic Info
  let selectionText = "";
  let targetText = "";

  const subEl = legEl.querySelector(
    'div[data-test-id^="bet-selection-subtitle-"]'
  );
  if (subEl) {
    selectionText = normalizeSpaces(subEl.textContent || "");
  }

  const titleEl = legEl.querySelector(
    'div[data-test-id^="bet-selection-title-"]'
  );
  if (titleEl) {
    const t = normalizeSpaces(titleEl.textContent || "");
    if (leg.isGroupLeg) {
      selectionText = t;
    } else {
      targetText = t;
    }
  }

  leg.market = selectionText || "Unknown Market";
  if (targetText && !leg.isGroupLeg) leg.target = targetText;

  const oddsEl = legEl.querySelector(
    'div[data-test-id^="bet-selection-displayOdds-"]'
  );
  if (oddsEl) {
    const o = normalizeSpaces(oddsEl.textContent || "").replace("+", "");
    leg.odds = parseInt(o, 10) || 0;
  }

  const icon = legEl.querySelector("svg title");
  const iconCircle = legEl.querySelector("svg circle");

  const isWin =
    iconCircle?.getAttribute("stroke") === "#53D337" ||
    iconCircle?.getAttribute("fill") === "#53D337";
  const isLoss =
    icon?.textContent?.includes("X sign") ||
    iconCircle?.getAttribute("stroke") === "#E9344A" ||
    iconCircle?.getAttribute("fill") === "#E9344A";

  if (isLoss) leg.result = "loss";
  else if (isWin) leg.result = "win";
  else if (defaultResult === "win") leg.result = "win";

  return leg;
};

const parseParlayBet = (ctx) => {
  const { element, header, footer, betType } = ctx;

  const body = element.querySelector('div[id$="-body"]');
  const allLegs = body
    ? Array.from(
        body.querySelectorAll('div[data-test-id="selection-list-item"]')
      )
    : [];

  const topLevelLegs = [];

  allLegs.forEach((el) => {
    const parent = el.parentElement;
    if (parent && parent.id && parent.id.endsWith("-body")) {
      topLevelLegs.push(extractLegFromElement(el, footer.result || "pending"));
    }
  });

  const collectLeafs = (l) => {
    if (l.isGroupLeg && l.children) {
      return l.children.flatMap(collectLeafs);
    }
    return [l];
  };
  const flatLegs = topLevelLegs.flatMap(collectLeafs);

  const description = flatLegs
    .map((l) => {
      let desc = l.market;
      if (l.target) desc += ` ${l.target}`;
      return desc;
    })
    .join(", ");

  const oddsEl = element.querySelector(
    'span[data-test-id^="bet-details-displayOdds-"]'
  );
  let odds = 0;
  if (oddsEl) {
    const oddsText = normalizeSpaces(oddsEl.textContent || "").replace("+", "");
    odds = parseInt(oddsText, 10) || 0;
  }

  let computedBetType = betType;
  if (element.textContent?.includes("SGPx")) computedBetType = "sgp_plus";

  return {
    id: header.betId,
    betId: header.betId,
    book: "DraftKings",
    placedAt: header.placedAt,
    status: footer.result,
    stake: footer.stake || 0,
    payout: footer.payout || 0,
    result: footer.result || "pending",
    betType: computedBetType || "parlay",
    marketCategory: "SGP/SGP+",
    sport: "mixed",
    description,
    odds,
    legs: topLevelLegs,
  };
};

/* RUNNER - Update to point to SGPx stub */
const htmlPath = path.join(__dirname, "./fixtures/rendered_sgpx_stub.html");
if (fs.existsSync(htmlPath)) {
  console.log("Analyzing SGPx Stub...");
  const html = fs.readFileSync(htmlPath, "utf-8");
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const betCards = doc.querySelectorAll('div[data-test-id^="bet-card-"]');

  const bets = [];
  betCards.forEach((card) => {
    try {
      const header = extractHeaderInfo(card);
      const footer = extractFooterMeta(card);
      const context = { element: card, header, footer, betType: "sgp" };
      const bet = parseParlayBet(context);
      if (bet) bets.push(bet);
    } catch (e) {
      console.error(e);
    }
  });
  console.log(JSON.stringify(bets, null, 2));
} else {
  console.log("SGPx stub not found.");
}

/* RUNNER - Check Total Stub */
const totalHtmlPath = path.join(
  __dirname,
  "./fixtures/rendered_total_stub.html"
);
if (fs.existsSync(totalHtmlPath)) {
  console.log("\nAnalyzing Total Stub...");
  const html = fs.readFileSync(totalHtmlPath, "utf-8");
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const betCards = doc.querySelectorAll('div[data-test-id^="bet-card-"]');

  const bets = [];
  betCards.forEach((card) => {
    try {
      const header = extractHeaderInfo(card);
      const footer = extractFooterMeta(card);
      const context = { element: card, header, footer, betType: "single" };
      const bet = parseSingleBet(context);
      if (bet) bets.push(bet);
    } catch (e) {
      console.error(e);
    }
  });
  console.log(JSON.stringify(bets, null, 2));
} else {
  console.log("Total stub not found.");
}

/* RUNNER - Check Live Bet Stub */
const liveHtmlPath = path.join(
  __dirname,
  "./fixtures/rendered_live_bet_stub.html"
);
if (fs.existsSync(liveHtmlPath)) {
  console.log("\nAnalyzing Live Bet Stub...");
  const html = fs.readFileSync(liveHtmlPath, "utf-8");
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const betCards = doc.querySelectorAll('div[data-test-id^="bet-card-"]');

  const bets = [];
  betCards.forEach((card) => {
    try {
      const header = extractHeaderInfo(card);
      const footer = extractFooterMeta(card);
      const context = { element: card, header, footer, betType: "single" };
      const bet = parseSingleBet(context);
      if (bet) bets.push(bet);
    } catch (e) {
      console.error(e);
    }
  });
  console.log(JSON.stringify(bets, null, 2));
} else {
  console.log("Live bet stub not found.");
}

import { Bet } from '../types';

// Set a fixed "today" for consistent recent dates
const today = new Date('2025-11-15T12:00:00Z');
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(today.getDate() - 2);

const getDate = (daysAgo: number, hour: number = 20) => {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
}

export const sampleBets: Bet[] = [
  // === PENDING BETS ===
  {
    id: 'DK-PENDING-NFL-2025-11-15-1',
    book: 'DraftKings',
    betId: 'DK-PEND-001',
    placedAt: today.toISOString(),
    betType: 'sgp',
    marketCategory: 'SGP/SGP+',
    sport: 'NFL',
    description: "Chiefs vs Bills SGP",
    odds: 450,
    stake: 25,
    payout: 0,
    result: 'pending',
    legs: [
      { entities: ['Patrick Mahomes'], market: 'Passing Touchdowns', ou: 'Over', target: 2.5, result: 'pending' },
      { entities: ['Travis Kelce'], market: 'Receiving Yards', ou: 'Over', target: 70.5, result: 'pending' }
    ]
  },
  {
    id: 'FD-PENDING-NBA-2025-11-15-2',
    book: 'FanDuel',
    betId: 'FD-PEND-002',
    placedAt: today.toISOString(),
    betType: 'single',
    marketCategory: 'Main Markets',
    sport: 'NBA',
    description: "Los Angeles Lakers ML",
    odds: -150,
    stake: 50,
    payout: 0,
    result: 'pending',
    legs: [
      { entities: ['Los Angeles Lakers'], market: 'Moneyline', result: 'pending' }
    ]
  },

  // === SETTLED BETS (MOST RECENT FIRST) ===

  // --- NBA ---
  {
    id: 'FD-SGP1-NBA-2025-11-14',
    book: 'FanDuel',
    betId: 'FD-SGP-NBA-001',
    placedAt: getDate(1),
    settledAt: getDate(1, 22),
    betType: 'sgp',
    marketCategory: 'SGP/SGP+',
    sport: 'NBA',
    description: "Lakers vs Warriors SGP",
    odds: 350,
    stake: 20,
    payout: 90.00,
    result: 'win',
    tail: 'ActionAl',
    legs: [
        { market: "Player Points", entities: ["LeBron James"], result: 'win', ou: 'Over', target: '25.5' },
        { market: "Player Rebounds", entities: ["Anthony Davis"], result: 'win', ou: 'Over', target: '12.5' }
    ]
  },
  {
    id: 'DK-SINGLE1-NBA-2025-11-14',
    book: 'DraftKings',
    betId: 'DK-SINGLE-NBA-001',
    placedAt: getDate(1),
    settledAt: getDate(1, 23),
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NBA',
    description: "Stephen Curry Prop",
    odds: -115,
    stake: 23,
    payout: 0,
    result: 'loss',
    legs: [
        { entities: ['Stephen Curry'], market: 'Player Threes', ou: 'Over', target: 4.5, result: 'loss' }
    ]
  },
   {
    id: 'FD-PARLAY1-NBA-2025-11-13',
    book: 'FanDuel',
    betId: 'FD-PARLAY-NBA-001',
    placedAt: getDate(2),
    settledAt: getDate(2, 22),
    betType: 'parlay',
    marketCategory: 'Parlays',
    sport: 'NBA',
    description: "2-Leg Moneyline Parlay",
    odds: 250,
    stake: 30,
    payout: 105.00,
    result: 'win',
    legs: [
        { market: "Moneyline", entities: ["Boston Celtics"], result: 'win' },
        { market: "Moneyline", entities: ["Milwaukee Bucks"], result: 'win' }
    ]
  },
  {
    id: 'DK-LIVE-NBA-2025-11-13',
    book: 'DraftKings',
    betId: 'DK-LIVE-NBA-001',
    placedAt: getDate(2, 21),
    settledAt: getDate(2, 23),
    betType: 'live',
    marketCategory: 'Main Markets',
    sport: 'NBA',
    description: "Nuggets vs Suns (Live)",
    odds: 150,
    stake: 50,
    payout: 0,
    result: 'loss',
    legs: [
        { market: "Spread", entities: ["Denver Nuggets"], target: 6.5, result: 'loss' }
    ]
  },
  {
    id: 'FD-PROP-NBA-2025-11-12',
    book: 'FanDuel',
    betId: 'FD-PROP-NBA-001',
    placedAt: getDate(3),
    settledAt: getDate(3, 22),
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NBA',
    description: "Nikola Jokic Triple Double",
    odds: 220,
    stake: 25,
    payout: 80.00,
    result: 'win',
    legs: [
      { entities: ['Nikola Jokic'], market: 'To Record a Triple-Double', result: 'win' }
    ]
  },
  {
    id: 'DK-PUSH-NBA-2025-11-12',
    book: 'DraftKings',
    betId: 'DK-PUSH-NBA-001',
    placedAt: getDate(3),
    settledAt: getDate(3, 23),
    betType: 'single',
    marketCategory: 'Main Markets',
    sport: 'NBA',
    description: "Game Total Push",
    odds: -110,
    stake: 110,
    payout: 110,
    result: 'push',
    legs: [
      { entities: ['76ers', 'Heat'], market: 'Total Points', ou: 'Over', target: 215.0, result: 'push' }
    ]
  },

  // --- NFL ---
  {
    id: 'DK-SINGLE1-NFL-2025-11-09',
    book: 'DraftKings',
    betId: 'DK-SINGLE-NFL-001',
    placedAt: getDate(6),
    settledAt: getDate(6, 22),
    betType: 'single',
    marketCategory: 'Main Markets',
    sport: 'NFL',
    description: "Buffalo Bills Spread",
    odds: -110,
    stake: 55,
    payout: 0,
    result: 'loss',
    tail: 'BettingPro',
    legs: [
        { entities: ['Buffalo Bills'], market: 'Spread', target: -3.5, result: 'loss' }
    ]
  },
  {
    id: 'FD-PROP-NFL-2025-11-09',
    book: 'FanDuel',
    betId: 'FD-PROP-NFL-01',
    placedAt: getDate(6),
    settledAt: getDate(6, 22),
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NFL',
    description: "Christian McCaffrey Prop",
    odds: -115,
    stake: 23,
    payout: 43.00,
    result: 'win',
    legs: [
      { entities: ['Christian McCaffrey'], market: 'Rushing Yards', ou: 'Over', target: 85.5, result: 'win' }
    ]
  },
  {
    id: 'DK-SGP-NFL-2025-11-09',
    book: 'DraftKings',
    betId: 'DK-SGP-NFL-01',
    placedAt: getDate(6),
    settledAt: getDate(6, 23),
    betType: 'sgp',
    marketCategory: 'SGP/SGP+',
    sport: 'NFL',
    description: "Eagles vs Cowboys SGP",
    odds: 1200,
    stake: 10,
    payout: 0,
    result: 'loss',
    legs: [
      { market: "Anytime Touchdown Scorer", entities: ["A.J. Brown"], result: 'win' },
      { market: "Player Rushing Yards", entities: ["Tony Pollard"], result: 'win', ou: 'Over', target: '60.5' },
      { market: "Player Passing Yards", entities: ["Jalen Hurts"], result: 'loss', ou: 'Over', target: '250.5' }
    ]
  },
  {
    id: 'FD-PARLAY-NFL-2025-11-02',
    book: 'FanDuel',
    betId: 'FD-PARLAY-NFL-001',
    placedAt: getDate(13),
    settledAt: getDate(13, 23),
    betType: 'parlay',
    marketCategory: 'Parlays',
    sport: 'NFL',
    description: "3-Team ML Parlay",
    odds: 600,
    stake: 10,
    payout: 0,
    result: 'loss',
    tail: 'ActionAl',
    legs: [
        { market: "Moneyline", entities: ["Kansas City Chiefs"], result: 'win' },
        { market: "Moneyline", entities: ["San Francisco 49ers"], result: 'win' },
        { market: "Moneyline", entities: ["Baltimore Ravens"], result: 'loss' }
    ]
  },
  {
    id: 'DK-FUTURE-NFL-2025-08-01',
    book: 'DraftKings',
    betId: 'DK-FUTURE-NFL-01',
    placedAt: '2025-08-01T12:00:00Z',
    settledAt: '2026-02-10T03:00:00Z',
    betType: 'single',
    marketCategory: 'Futures',
    sport: 'NFL',
    description: "Super Bowl Winner",
    odds: 650,
    stake: 100,
    payout: 750.00,
    result: 'win', // Pretend they won
    legs: [
      { entities: ['Kansas City Chiefs'], market: 'Outright Winner', result: 'win' }
    ]
  },
  
  // --- Other Sports ---
  {
    id: 'FD-FUTURE1-TENNIS-2025-08-20',
    book: 'FanDuel',
    betId: 'FD-FUTURE-TENNIS-002',
    placedAt: '2025-08-20T12:00:00Z',
    settledAt: '2025-09-08T15:00:00Z',
    betType: 'single',
    marketCategory: 'Futures',
    sport: 'Tennis',
    description: "US Open Winner",
    odds: 150,
    stake: 100,
    payout: 250.00,
    result: 'win',
    legs: [
        { entities: ['Carlos Alcaraz'], market: 'Outright Winner', result: 'win' }
    ]
  },
  {
    id: 'DK-PROP-NHL-2025-10-25',
    book: 'DraftKings',
    betId: 'DK-PROP-NHL-01',
    placedAt: getDate(21),
    settledAt: getDate(21, 23),
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NHL',
    description: "Connor McDavid Prop",
    odds: 110,
    stake: 20,
    payout: 0,
    result: 'loss',
    legs: [
      { entities: ['Connor McDavid'], market: 'Points', ou: 'Over', target: 1.5, result: 'loss' }
    ]
  },
  {
    id: 'FD-TOTAL-SOCCER-2025-10-18',
    book: 'FanDuel',
    betId: 'FD-TOTAL-SOC-01',
    placedAt: getDate(28),
    settledAt: getDate(28, 23),
    betType: 'single',
    marketCategory: 'Main Markets',
    sport: 'Soccer',
    description: "Man U vs Arsenal Total",
    odds: -125,
    stake: 40,
    payout: 72.00,
    result: 'win',
    legs: [
      { entities: ['Manchester United', 'Arsenal'], market: 'Total Goals', ou: 'Over', target: 2.5, result: 'win' }
    ]
  },
  {
    id: 'DK-PARLAY-MLB-2025-09-10',
    book: 'DraftKings',
    betId: 'DK-PARLAY-MLB-003',
    placedAt: '2025-09-10T17:00:00Z',
    settledAt: '2025-09-10T22:00:00Z',
    betType: 'parlay',
    marketCategory: 'Parlays',
    sport: 'MLB',
    description: "2-Leg Run Line Parlay",
    odds: 450,
    stake: 15,
    payout: 0,
    result: 'loss',
    tail: 'BettingPro',
    legs: [
        { market: "Run Line", entities: ["Los Angeles Dodgers"], result: 'win', target: -1.5 },
        { market: "Run Line", entities: ["Houston Astros"], result: 'loss', target: -1.5 }
    ]
  },
  {
    id: 'FD-SGP-MLB-2025-09-05',
    book: 'FanDuel',
    betId: 'FD-SGP-MLB-003',
    placedAt: '2025-09-05T18:20:00Z',
    settledAt: '2025-09-05T21:00:00Z',
    betType: 'sgp',
    marketCategory: 'SGP/SGP+',
    sport: 'MLB',
    description: "Yankees vs Red Sox SGP",
    odds: 800,
    stake: 5,
    payout: 45.00,
    result: 'win',
    legs: [
        { market: "Player Home Runs", entities: ["Aaron Judge"], result: 'win', ou: 'Over', target: '0.5' },
        { market: "Player Strikeouts", entities: ["Gerrit Cole"], result: 'win', ou: 'Over', target: '6.5' },
        { market: "Moneyline", entities: ["New York Yankees"], result: 'win' }
    ]
  },
  {
    id: 'FD-LIVE-NBA-2025-11-01',
    book: 'FanDuel',
    betId: 'FD-LIVE-NBA-01',
    placedAt: getDate(14, 21),
    settledAt: getDate(14, 22),
    betType: 'live',
    marketCategory: 'Main Markets',
    sport: 'NBA',
    description: "Phoenix Suns ML (Live)",
    odds: 180,
    stake: 50,
    payout: 0,
    result: 'loss',
    tail: 'ActionAl',
    legs: [
      { entities: ['Phoenix Suns'], market: 'Moneyline', result: 'loss' }
    ]
  },
];

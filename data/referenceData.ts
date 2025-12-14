/**
 * Reference data for normalizing sports, teams, and stat types across different sportsbooks.
 * 
 * This provides canonical names and alias mappings to handle variations in formatting
 * across different sportsbooks (e.g., "PHO Suns" vs "Phoenix Suns" vs "Suns").
 */

// ============================================================================
// SPORTS INDEX
// ============================================================================

export const SPORTS = [
  'NBA',
  'NFL',
  'MLB',
  'NHL',
  'NCAAB',
  'NCAAF',
  'UFC',
  'PGA',
  'Soccer',
  'Tennis',
  'Other'
] as const;

export type Sport = typeof SPORTS[number];

// ============================================================================
// TEAM MAPPINGS
// ============================================================================

export interface TeamInfo {
  canonical: string;      // Official display name
  sport: Sport;           // Associated sport
  abbreviations: string[]; // Short forms (e.g., "PHO", "PHX")
  aliases: string[];      // All possible variations
}

export const TEAMS: TeamInfo[] = [
  // NBA Teams
  {
    canonical: 'Atlanta Hawks',
    sport: 'NBA',
    abbreviations: ['ATL'],
    aliases: ['ATL Hawks', 'Hawks', 'ATL', 'Atlanta']
  },
  {
    canonical: 'Boston Celtics',
    sport: 'NBA',
    abbreviations: ['BOS'],
    aliases: ['BOS Celtics', 'Celtics', 'BOS', 'Boston']
  },
  {
    canonical: 'Brooklyn Nets',
    sport: 'NBA',
    abbreviations: ['BKN', 'BRK'],
    aliases: ['BKN Nets', 'BRK Nets', 'Nets', 'BKN', 'BRK', 'Brooklyn']
  },
  {
    canonical: 'Charlotte Hornets',
    sport: 'NBA',
    abbreviations: ['CHA', 'CHO'],
    aliases: ['CHA Hornets', 'CHO Hornets', 'Hornets', 'CHA', 'CHO', 'Charlotte']
  },
  {
    canonical: 'Chicago Bulls',
    sport: 'NBA',
    abbreviations: ['CHI'],
    aliases: ['CHI Bulls', 'Bulls', 'CHI', 'Chicago']
  },
  {
    canonical: 'Cleveland Cavaliers',
    sport: 'NBA',
    abbreviations: ['CLE'],
    aliases: ['CLE Cavaliers', 'Cavaliers', 'Cavs', 'CLE', 'Cleveland']
  },
  {
    canonical: 'Dallas Mavericks',
    sport: 'NBA',
    abbreviations: ['DAL'],
    aliases: ['DAL Mavericks', 'Mavericks', 'Mavs', 'DAL', 'Dallas']
  },
  {
    canonical: 'Denver Nuggets',
    sport: 'NBA',
    abbreviations: ['DEN'],
    aliases: ['DEN Nuggets', 'Nuggets', 'DEN', 'Denver']
  },
  {
    canonical: 'Detroit Pistons',
    sport: 'NBA',
    abbreviations: ['DET'],
    aliases: ['DET Pistons', 'Pistons', 'DET', 'Detroit']
  },
  {
    canonical: 'Golden State Warriors',
    sport: 'NBA',
    abbreviations: ['GSW', 'GS'],
    aliases: ['GSW Warriors', 'GS Warriors', 'Warriors', 'GSW', 'GS', 'Golden State']
  },
  {
    canonical: 'Houston Rockets',
    sport: 'NBA',
    abbreviations: ['HOU'],
    aliases: ['HOU Rockets', 'Rockets', 'HOU', 'Houston']
  },
  {
    canonical: 'Indiana Pacers',
    sport: 'NBA',
    abbreviations: ['IND'],
    aliases: ['IND Pacers', 'Pacers', 'IND', 'Indiana']
  },
  {
    canonical: 'LA Clippers',
    sport: 'NBA',
    abbreviations: ['LAC'],
    aliases: ['LAC Clippers', 'Clippers', 'LAC', 'LA Clippers', 'Los Angeles Clippers', 'L.A. Clippers']
  },
  {
    canonical: 'Los Angeles Lakers',
    sport: 'NBA',
    abbreviations: ['LAL', 'LA'],
    aliases: ['LAL Lakers', 'LA Lakers', 'Lakers', 'LAL', 'LA', 'Los Angeles Lakers', 'L.A. Lakers']
  },
  {
    canonical: 'Memphis Grizzlies',
    sport: 'NBA',
    abbreviations: ['MEM'],
    aliases: ['MEM Grizzlies', 'Grizzlies', 'Grizz', 'MEM', 'Memphis']
  },
  {
    canonical: 'Miami Heat',
    sport: 'NBA',
    abbreviations: ['MIA'],
    aliases: ['MIA Heat', 'Heat', 'MIA', 'Miami']
  },
  {
    canonical: 'Milwaukee Bucks',
    sport: 'NBA',
    abbreviations: ['MIL'],
    aliases: ['MIL Bucks', 'Bucks', 'MIL', 'Milwaukee']
  },
  {
    canonical: 'Minnesota Timberwolves',
    sport: 'NBA',
    abbreviations: ['MIN'],
    aliases: ['MIN Timberwolves', 'Timberwolves', 'T-Wolves', 'Wolves', 'MIN', 'Minnesota']
  },
  {
    canonical: 'New Orleans Pelicans',
    sport: 'NBA',
    abbreviations: ['NOP', 'NO'],
    aliases: ['NOP Pelicans', 'NO Pelicans', 'Pelicans', 'Pels', 'NOP', 'NO', 'New Orleans']
  },
  {
    canonical: 'New York Knicks',
    sport: 'NBA',
    abbreviations: ['NYK', 'NY'],
    aliases: ['NYK Knicks', 'NY Knicks', 'Knicks', 'NYK', 'NY', 'New York']
  },
  {
    canonical: 'Oklahoma City Thunder',
    sport: 'NBA',
    abbreviations: ['OKC'],
    aliases: ['OKC Thunder', 'Thunder', 'OKC', 'Oklahoma City']
  },
  {
    canonical: 'Orlando Magic',
    sport: 'NBA',
    abbreviations: ['ORL'],
    aliases: ['ORL Magic', 'Magic', 'ORL', 'Orlando']
  },
  {
    canonical: 'Philadelphia 76ers',
    sport: 'NBA',
    abbreviations: ['PHI'],
    aliases: ['PHI 76ers', '76ers', 'Sixers', 'PHI', 'Philadelphia']
  },
  {
    canonical: 'Phoenix Suns',
    sport: 'NBA',
    abbreviations: ['PHO', 'PHX'],
    aliases: ['PHO Suns', 'PHX Suns', 'Suns', 'PHO', 'PHX', 'Phoenix']
  },
  {
    canonical: 'Portland Trail Blazers',
    sport: 'NBA',
    abbreviations: ['POR'],
    aliases: ['POR Trail Blazers', 'Trail Blazers', 'Blazers', 'POR', 'Portland']
  },
  {
    canonical: 'Sacramento Kings',
    sport: 'NBA',
    abbreviations: ['SAC'],
    aliases: ['SAC Kings', 'Kings', 'SAC', 'Sacramento']
  },
  {
    canonical: 'San Antonio Spurs',
    sport: 'NBA',
    abbreviations: ['SAS', 'SA'],
    aliases: ['SAS Spurs', 'SA Spurs', 'Spurs', 'SAS', 'SA', 'San Antonio']
  },
  {
    canonical: 'Toronto Raptors',
    sport: 'NBA',
    abbreviations: ['TOR'],
    aliases: ['TOR Raptors', 'Raptors', 'Raps', 'TOR', 'Toronto']
  },
  {
    canonical: 'Utah Jazz',
    sport: 'NBA',
    abbreviations: ['UTA'],
    aliases: ['UTA Jazz', 'Jazz', 'UTA', 'Utah']
  },
  {
    canonical: 'Washington Wizards',
    sport: 'NBA',
    abbreviations: ['WAS', 'WSH'],
    aliases: ['WAS Wizards', 'WSH Wizards', 'Wizards', 'Wiz', 'WAS', 'WSH', 'Washington']
  },

  // NFL Teams
  {
    canonical: 'Arizona Cardinals',
    sport: 'NFL',
    abbreviations: ['ARI', 'ARZ'],
    aliases: ['ARI Cardinals', 'ARZ Cardinals', 'Cardinals', 'ARI', 'ARZ', 'Arizona']
  },
  {
    canonical: 'Atlanta Falcons',
    sport: 'NFL',
    abbreviations: ['ATL'],
    aliases: ['ATL Falcons', 'Falcons', 'ATL', 'Atlanta']
  },
  {
    canonical: 'Baltimore Ravens',
    sport: 'NFL',
    abbreviations: ['BAL'],
    aliases: ['BAL Ravens', 'Ravens', 'BAL', 'Baltimore']
  },
  {
    canonical: 'Buffalo Bills',
    sport: 'NFL',
    abbreviations: ['BUF'],
    aliases: ['BUF Bills', 'Bills', 'BUF', 'Buffalo']
  },
  {
    canonical: 'Carolina Panthers',
    sport: 'NFL',
    abbreviations: ['CAR'],
    aliases: ['CAR Panthers', 'Panthers', 'CAR', 'Carolina']
  },
  {
    canonical: 'Chicago Bears',
    sport: 'NFL',
    abbreviations: ['CHI'],
    aliases: ['CHI Bears', 'Bears', 'CHI', 'Chicago']
  },
  {
    canonical: 'Cincinnati Bengals',
    sport: 'NFL',
    abbreviations: ['CIN'],
    aliases: ['CIN Bengals', 'Bengals', 'CIN', 'Cincinnati']
  },
  {
    canonical: 'Cleveland Browns',
    sport: 'NFL',
    abbreviations: ['CLE'],
    aliases: ['CLE Browns', 'Browns', 'CLE', 'Cleveland']
  },
  {
    canonical: 'Dallas Cowboys',
    sport: 'NFL',
    abbreviations: ['DAL'],
    aliases: ['DAL Cowboys', 'Cowboys', 'DAL', 'Dallas']
  },
  {
    canonical: 'Denver Broncos',
    sport: 'NFL',
    abbreviations: ['DEN'],
    aliases: ['DEN Broncos', 'Broncos', 'DEN', 'Denver']
  },
  {
    canonical: 'Detroit Lions',
    sport: 'NFL',
    abbreviations: ['DET'],
    aliases: ['DET Lions', 'Lions', 'DET', 'Detroit']
  },
  {
    canonical: 'Green Bay Packers',
    sport: 'NFL',
    abbreviations: ['GB', 'GNB'],
    aliases: ['GB Packers', 'GNB Packers', 'Packers', 'GB', 'GNB', 'Green Bay']
  },
  {
    canonical: 'Houston Texans',
    sport: 'NFL',
    abbreviations: ['HOU'],
    aliases: ['HOU Texans', 'Texans', 'HOU', 'Houston']
  },
  {
    canonical: 'Indianapolis Colts',
    sport: 'NFL',
    abbreviations: ['IND'],
    aliases: ['IND Colts', 'Colts', 'IND', 'Indianapolis']
  },
  {
    canonical: 'Jacksonville Jaguars',
    sport: 'NFL',
    abbreviations: ['JAX', 'JAC'],
    aliases: ['JAX Jaguars', 'JAC Jaguars', 'Jaguars', 'Jags', 'JAX', 'JAC', 'Jacksonville']
  },
  {
    canonical: 'Kansas City Chiefs',
    sport: 'NFL',
    abbreviations: ['KC', 'KAN'],
    aliases: ['KC Chiefs', 'KAN Chiefs', 'Chiefs', 'KC', 'KAN', 'Kansas City']
  },
  {
    canonical: 'Las Vegas Raiders',
    sport: 'NFL',
    abbreviations: ['LV', 'LVR'],
    aliases: ['LV Raiders', 'LVR Raiders', 'Raiders', 'LV', 'LVR', 'Las Vegas']
  },
  {
    canonical: 'Los Angeles Chargers',
    sport: 'NFL',
    abbreviations: ['LAC'],
    aliases: ['LAC Chargers', 'Chargers', 'LAC', 'LA Chargers', 'Los Angeles Chargers', 'L.A. Chargers']
  },
  {
    canonical: 'Los Angeles Rams',
    sport: 'NFL',
    abbreviations: ['LAR', 'LA'],
    aliases: ['LAR Rams', 'LA Rams', 'Rams', 'LAR', 'LA', 'Los Angeles Rams', 'L.A. Rams']
  },
  {
    canonical: 'Miami Dolphins',
    sport: 'NFL',
    abbreviations: ['MIA'],
    aliases: ['MIA Dolphins', 'Dolphins', 'MIA', 'Miami']
  },
  {
    canonical: 'Minnesota Vikings',
    sport: 'NFL',
    abbreviations: ['MIN'],
    aliases: ['MIN Vikings', 'Vikings', 'Vikes', 'MIN', 'Minnesota']
  },
  {
    canonical: 'New England Patriots',
    sport: 'NFL',
    abbreviations: ['NE', 'NEP'],
    aliases: ['NE Patriots', 'NEP Patriots', 'Patriots', 'Pats', 'NE', 'NEP', 'New England']
  },
  {
    canonical: 'New Orleans Saints',
    sport: 'NFL',
    abbreviations: ['NO', 'NOR'],
    aliases: ['NO Saints', 'NOR Saints', 'Saints', 'NO', 'NOR', 'New Orleans']
  },
  {
    canonical: 'New York Giants',
    sport: 'NFL',
    abbreviations: ['NYG'],
    aliases: ['NYG Giants', 'Giants', 'NYG', 'NY Giants', 'New York Giants']
  },
  {
    canonical: 'New York Jets',
    sport: 'NFL',
    abbreviations: ['NYJ'],
    aliases: ['NYJ Jets', 'Jets', 'NYJ', 'NY Jets', 'New York Jets']
  },
  {
    canonical: 'Philadelphia Eagles',
    sport: 'NFL',
    abbreviations: ['PHI'],
    aliases: ['PHI Eagles', 'Eagles', 'PHI', 'Philadelphia']
  },
  {
    canonical: 'Pittsburgh Steelers',
    sport: 'NFL',
    abbreviations: ['PIT'],
    aliases: ['PIT Steelers', 'Steelers', 'PIT', 'Pittsburgh']
  },
  {
    canonical: 'San Francisco 49ers',
    sport: 'NFL',
    abbreviations: ['SF', 'SFO'],
    aliases: ['SF 49ers', 'SFO 49ers', '49ers', 'Niners', 'SF', 'SFO', 'San Francisco']
  },
  {
    canonical: 'Seattle Seahawks',
    sport: 'NFL',
    abbreviations: ['SEA'],
    aliases: ['SEA Seahawks', 'Seahawks', 'Hawks', 'SEA', 'Seattle']
  },
  {
    canonical: 'Tampa Bay Buccaneers',
    sport: 'NFL',
    abbreviations: ['TB', 'TAM'],
    aliases: ['TB Buccaneers', 'TAM Buccaneers', 'Buccaneers', 'Bucs', 'TB', 'TAM', 'Tampa Bay', 'Tampa']
  },
  {
    canonical: 'Tennessee Titans',
    sport: 'NFL',
    abbreviations: ['TEN'],
    aliases: ['TEN Titans', 'Titans', 'TEN', 'Tennessee']
  },
  {
    canonical: 'Washington Commanders',
    sport: 'NFL',
    abbreviations: ['WAS', 'WSH'],
    aliases: ['WAS Commanders', 'WSH Commanders', 'Commanders', 'WAS', 'WSH', 'Washington']
  },
];

// ============================================================================
// STAT TYPE MAPPINGS
// ============================================================================

export interface StatTypeInfo {
  canonical: string;      // Standard display code (e.g., "Pts", "Reb")
  sport: Sport;           // Associated sport
  aliases: string[];      // All possible variations
  description: string;    // Human-readable description
}

export const STAT_TYPES: StatTypeInfo[] = [
  // NBA Stats
  {
    canonical: 'Pts',
    sport: 'NBA',
    description: 'Points',
    aliases: ['Pts', 'Points', 'Total Points', 'PTS', 'pts', 'points']
  },
  {
    canonical: 'Reb',
    sport: 'NBA',
    description: 'Rebounds',
    aliases: ['Reb', 'Rebs', 'Rebounds', 'Total Rebounds', 'REB', 'reb', 'rebounds']
  },
  {
    canonical: 'Ast',
    sport: 'NBA',
    description: 'Assists',
    aliases: ['Ast', 'Asst', 'Assists', 'AST', 'ast', 'assists']
  },
  {
    canonical: '3pt',
    sport: 'NBA',
    description: 'Made Threes',
    aliases: ['3pt', '3PT', '3-pt', 'Made Threes', 'MADE THREES', 'Threes', '3-Pointers', '3 Pointers', 'Three Pointers', 'Three-Pointers']
  },
  {
    canonical: 'Stl',
    sport: 'NBA',
    description: 'Steals',
    aliases: ['Stl', 'Steals', 'STL', 'stl', 'steals']
  },
  {
    canonical: 'Blk',
    sport: 'NBA',
    description: 'Blocks',
    aliases: ['Blk', 'Blocks', 'BLK', 'blk', 'blocks']
  },
  {
    canonical: 'TO',
    sport: 'NBA',
    description: 'Turnovers',
    aliases: ['TO', 'Turnovers', 'to', 'turnovers']
  },
  {
    canonical: 'PRA',
    sport: 'NBA',
    description: 'Points + Rebounds + Assists',
    aliases: ['PRA', 'P+R+A', 'Points+Rebounds+Assists', 'Pts+Reb+Ast']
  },
  {
    canonical: 'PR',
    sport: 'NBA',
    description: 'Points + Rebounds',
    aliases: ['PR', 'P+R', 'Points+Rebounds', 'Pts+Reb']
  },
  {
    canonical: 'PA',
    sport: 'NBA',
    description: 'Points + Assists',
    aliases: ['PA', 'P+A', 'Points+Assists', 'Pts+Ast']
  },
  {
    canonical: 'RA',
    sport: 'NBA',
    description: 'Rebounds + Assists',
    aliases: ['RA', 'R+A', 'Rebounds+Assists', 'Reb+Ast']
  },
  {
    canonical: 'Stocks',
    sport: 'NBA',
    description: 'Steals + Blocks',
    aliases: ['Stocks', 'Stl+Blk', 'Steals+Blocks']
  },
  {
    canonical: 'DD',
    sport: 'NBA',
    description: 'Double Double',
    aliases: ['DD', 'Double Double', 'DoubleDouble', 'double double']
  },
  {
    canonical: 'TD',
    sport: 'NBA',
    description: 'Triple Double',
    aliases: ['TD', 'Triple Double', 'TripleDouble', 'triple double']
  },
  {
    canonical: 'FB',
    sport: 'NBA',
    description: 'First Basket',
    aliases: ['FB', 'First Basket', 'First Field Goal', 'First FG', 'first basket']
  },
  {
    canonical: 'Top Pts',
    sport: 'NBA',
    description: 'Top Scorer',
    aliases: ['Top Pts', 'Top Points', 'Top Scorer', 'Leading Scorer', 'Most Points', 'top scorer']
  },

  // NFL Stats
  {
    canonical: 'Pass Yds',
    sport: 'NFL',
    description: 'Passing Yards',
    aliases: ['Pass Yds', 'Passing Yards', 'Passing', 'pass yds', 'passing yards']
  },
  {
    canonical: 'Pass TD',
    sport: 'NFL',
    description: 'Passing Touchdowns',
    aliases: ['Pass TD', 'Passing TD', 'Passing Touchdowns', 'pass td', 'passing touchdowns']
  },
  {
    canonical: 'Rush Yds',
    sport: 'NFL',
    description: 'Rushing Yards',
    aliases: ['Rush Yds', 'Rushing Yards', 'Rushing', 'rush yds', 'rushing yards']
  },
  {
    canonical: 'Rush TD',
    sport: 'NFL',
    description: 'Rushing Touchdowns',
    aliases: ['Rush TD', 'Rushing TD', 'Rushing Touchdowns', 'rush td', 'rushing touchdowns']
  },
  {
    canonical: 'Rec Yds',
    sport: 'NFL',
    description: 'Receiving Yards',
    aliases: ['Rec Yds', 'Receiving Yards', 'Receiving', 'rec yds', 'receiving yards']
  },
  {
    canonical: 'Rec TD',
    sport: 'NFL',
    description: 'Receiving Touchdowns',
    aliases: ['Rec TD', 'Receiving TD', 'Receiving Touchdowns', 'rec td', 'receiving touchdowns']
  },
  {
    canonical: 'Rec',
    sport: 'NFL',
    description: 'Receptions',
    aliases: ['Rec', 'Receptions', 'rec', 'receptions']
  },
  {
    canonical: 'ATTD',
    sport: 'NFL',
    description: 'Anytime Touchdown',
    aliases: ['ATTD', 'Anytime TD', 'Anytime Touchdown', 'Any Time TD', 'attd']
  },
  {
    canonical: 'FTD',
    sport: 'NFL',
    description: 'First Touchdown',
    aliases: ['FTD', 'First TD', 'First Touchdown', 'ftd']
  },

  // MLB Stats
  {
    canonical: 'Hits',
    sport: 'MLB',
    description: 'Hits',
    aliases: ['Hits', 'H', 'hits', 'h']
  },
  {
    canonical: 'HR',
    sport: 'MLB',
    description: 'Home Runs',
    aliases: ['HR', 'Home Runs', 'Homeruns', 'Home Run', 'home runs', 'hr']
  },
  {
    canonical: 'RBI',
    sport: 'MLB',
    description: 'Runs Batted In',
    aliases: ['RBI', 'RBIs', 'Runs Batted In', 'rbi', 'rbis']
  },
  {
    canonical: 'Runs',
    sport: 'MLB',
    description: 'Runs',
    aliases: ['Runs', 'R', 'runs', 'r']
  },
  {
    canonical: 'K',
    sport: 'MLB',
    description: 'Strikeouts',
    aliases: ['K', 'Strikeouts', 'SO', 'Strike Outs', 'strikeouts', 'k']
  },
  {
    canonical: 'SB',
    sport: 'MLB',
    description: 'Stolen Bases',
    aliases: ['SB', 'Stolen Bases', 'stolen bases', 'sb']
  },

  // NHL Stats
  {
    canonical: 'Goals',
    sport: 'NHL',
    description: 'Goals',
    aliases: ['Goals', 'G', 'goals', 'g']
  },
  {
    canonical: 'Assists',
    sport: 'NHL',
    description: 'Assists',
    aliases: ['Assists', 'A', 'assists', 'a']
  },
  {
    canonical: 'SOG',
    sport: 'NHL',
    description: 'Shots on Goal',
    aliases: ['SOG', 'Shots on Goal', 'Shots', 'shots on goal', 'sog']
  },
  {
    canonical: 'Saves',
    sport: 'NHL',
    description: 'Saves',
    aliases: ['Saves', 'SV', 'saves', 'sv']
  },
];

// ============================================================================
// MAIN MARKET TYPES
// ============================================================================

export interface MainMarketTypeInfo {
  canonical: string;
  aliases: string[];
  description: string;
}

export const MAIN_MARKET_TYPES: MainMarketTypeInfo[] = [
  {
    canonical: 'Moneyline',
    aliases: ['Moneyline', 'ML', 'Money Line', 'moneyline', 'ml'],
    description: 'Straight win bet'
  },
  {
    canonical: 'Spread',
    aliases: ['Spread', 'Point Spread', 'Line', 'spread', 'point spread'],
    description: 'Point spread bet'
  },
  {
    canonical: 'Total',
    aliases: ['Total', 'Totals', 'Over/Under', 'O/U', 'total', 'totals'],
    description: 'Over/Under total points'
  },
];

// ============================================================================
// FUTURE TYPES
// ============================================================================

export interface FutureTypeInfo {
  canonical: string;
  sport?: Sport;  // Optional - some futures are sport-specific
  aliases: string[];
  description: string;
}

export const FUTURE_TYPES: FutureTypeInfo[] = [
  {
    canonical: 'NBA Finals',
    sport: 'NBA',
    aliases: ['NBA Finals', 'To Win NBA Finals', 'Win NBA Finals', 'NBA Championship', 'nba finals'],
    description: 'Win NBA Championship'
  },
  {
    canonical: 'Super Bowl',
    sport: 'NFL',
    aliases: ['Super Bowl', 'To Win Super Bowl', 'Win Super Bowl', 'super bowl'],
    description: 'Win Super Bowl'
  },
  {
    canonical: 'World Series',
    sport: 'MLB',
    aliases: ['World Series', 'To Win World Series', 'Win World Series', 'world series'],
    description: 'Win World Series'
  },
  {
    canonical: 'Stanley Cup',
    sport: 'NHL',
    aliases: ['Stanley Cup', 'To Win Stanley Cup', 'Win Stanley Cup', 'stanley cup'],
    description: 'Win Stanley Cup'
  },
  {
    canonical: 'Win Total',
    aliases: ['Win Total', 'Season Wins', 'Regular Season Wins', 'win total'],
    description: 'Season win total over/under'
  },
  {
    canonical: 'Make Playoffs',
    aliases: ['Make Playoffs', 'To Make Playoffs', 'Reach Playoffs', 'make playoffs'],
    description: 'Make the playoffs'
  },
  {
    canonical: 'Miss Playoffs',
    aliases: ['Miss Playoffs', 'To Miss Playoffs', 'miss playoffs'],
    description: 'Miss the playoffs'
  },
  {
    canonical: 'MVP',
    aliases: ['MVP', 'Most Valuable Player', 'To Win MVP', 'mvp'],
    description: 'Win MVP Award'
  },
];

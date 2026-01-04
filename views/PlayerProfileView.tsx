import React, { useState, useMemo, useEffect } from 'react';
import { useBets } from '../hooks/useBets';
import { getTeamInfo, normalizeTeamName, getPlayerInfo } from '../services/normalizationService';
// Phase 1: Resolver for team aggregation
// Phase 2: Extended with player aggregation
import { getTeamAggregationKey, getPlayerAggregationKey } from '../services/resolver';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Sector } from 'recharts';
import { TrendingUp, TrendingDown, Scale, BarChart2, User, ChevronLeft, X } from '../components/icons';
import { Bet, BetLeg } from '../types';
import {

  createDateRangePredicate,
  DateRange,
  CustomDateRange
} from '../utils/filterPredicates';
import { formatCurrency, formatDateShort, formatNet } from '../utils/formatters';
import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  computeStatsByDimension,
  mapToStatsArray,
} from '../services/aggregationService';
import { getNetNumeric, getEntityMoneyContribution } from '../services/displaySemantics';
import { computeOverUnderStats } from '../services/overUnderStatsService';
// Task C: UI Clarity tooltips
// Task C: UI Clarity tooltips
import { InfoTooltip } from '../components/debug/InfoTooltip';
import { StatCard } from '../components/StatCard';
import { FitText } from '../components/FitText';
import LivePreGameChart from '../components/PlayerProfile/LivePreGameChart';

// --- HELPER COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
                <p className="label font-bold mb-1">{`${label}`}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color }}>
                        {`${pld.name}: ${typeof pld.value === 'number' ? pld.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : pld.value}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const ChartContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200">{title}</h2>
        <div className="h-72">{children}</div>
    </div>
);




type StatsData = { name: string; count: number; wins: number; losses: number; stake: number; net: number; roi: number };
interface StatsTableProps {
    data: StatsData[];
    title: string;
}

const StatsTable: React.FC<StatsTableProps> = ({ data, title }) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof StatsData; direction: 'asc' | 'desc' }>({ key: 'net', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');
    
    const sortedData = useMemo(() => {
        const filteredData = data.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return [...filteredData].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig, searchTerm]);

    const requestSort = (key: keyof StatsData) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };
    
    const headers: { key: keyof StatsData | 'win_pct'; label: string; sortable: boolean }[] = [
        { key: 'name', label: 'Market', sortable: true },
        { key: 'count', label: 'Bets', sortable: true },
        { key: 'wins', label: 'Win', sortable: true },
        { key: 'losses', label: 'Loss', sortable: true },
        { key: 'win_pct', label: 'Win %', sortable: false },
        { key: 'stake', label: 'Wagered', sortable: true },
        { key: 'net', label: 'Net', sortable: true },
        { key: 'roi', label: 'ROI', sortable: true },
    ];

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 flex flex-col">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">{title}</h2>
            <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="my-4 p-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800 w-full"
            />
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-neutral-500 dark:text-neutral-400 uppercase sticky top-0 bg-white dark:bg-neutral-900">
                        <tr>
                            {headers.map(header => (
                                <th 
                                    key={header.key} 
                                    className={`px-4 py-2 ${header.sortable ? 'cursor-pointer' : ''} ${['win_pct'].includes(header.key) ? 'text-center' : ''}`} 
                                    onClick={() => header.sortable && requestSort(header.key as keyof StatsData)}
                                >
                                    {header.label} {header.sortable && (sortConfig.key === header.key ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '◇')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {sortedData.map(item => {
                            const netColor = item.net > 0 ? 'text-accent-500' : item.net < 0 ? 'text-danger-500' : 'text-neutral-500';
                            const winPct = item.wins + item.losses > 0 ? (item.wins / (item.wins + item.losses)) * 100 : 0;
                            const winPctColor = winPct > 50 ? 'text-accent-500' : winPct < 50 && (item.wins + item.losses > 0) ? 'text-danger-500' : 'text-neutral-500';
                            
                            return (
                                <tr key={item.name} className="odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-200 dark:even:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                    <td className="px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs">{item.name}</td>
                                    <td className="px-4 py-2">{item.count}</td>
                                    <td className="px-4 py-2">{item.wins}</td>
                                    <td className="px-4 py-2">{item.losses}</td>
                                    <td className={`px-4 py-2 text-center font-semibold ${winPctColor}`}>{winPct.toFixed(1)}%</td>
                                    <td className="px-4 py-2">{formatCurrency(item.stake)}</td>
                                    <td className={`px-4 py-2 font-semibold ${netColor}`}>{formatNet(item.net)}</td>
                                    <td className={`px-4 py-2 font-semibold ${netColor}`}>{item.roi.toFixed(1)}%</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const RecentBetsTable: React.FC<{ bets: Bet[] }> = ({ bets }) => (
  <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
    <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Recent Bets</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
          <tr>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Site</th>
            <th className="p-2 text-left">Sport</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-center">O/U</th>
            <th className="p-2 text-right">Line</th>
            <th className="p-2 text-right">Stake</th>
            <th className="p-2 text-right">Net</th>
            <th className="p-2 text-center">Result</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => {
            const net = getNetNumeric(bet);
            const netColor = net > 0 ? 'text-accent-500' : net < 0 ? 'text-danger-500' : '';
            // Extract first leg info for display (most relevant for player profile)
            const firstLeg = bet.legs?.[0];
            const displayName = firstLeg?.entities?.join(', ') || bet.name || '-';
            const displayType = bet.type || firstLeg?.market || '-';
            // Line: prefer bet-level convenience field, fallback to leg.target
            const displayLine = bet.line ?? firstLeg?.target ?? '-';
            // O/U: prefer bet-level convenience field, fallback to leg.ou (display as O/U abbreviation)
            const ouValue = bet.ou ?? firstLeg?.ou;
            const displayOU = ouValue === 'Over' ? 'O' : ouValue === 'Under' ? 'U' : '-';
            return (
              <tr key={bet.id} className="border-b border-neutral-300 dark:border-neutral-800 odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-200 dark:even:bg-neutral-800/50">
                <td className="p-2 whitespace-nowrap">{formatDateShort(bet.placedAt)}</td>
                <td className="p-2 whitespace-nowrap">{bet.book || '-'}</td>
                <td className="p-2 whitespace-nowrap">{bet.sport || '-'}</td>
                <td className="p-2 whitespace-nowrap truncate max-w-[120px]" title={displayType}>{displayType}</td>
                <td className="p-2 whitespace-nowrap truncate max-w-[150px]" title={displayName}>{displayName}</td>
                <td className="p-2 text-center whitespace-nowrap">{displayOU}</td>
                <td className="p-2 text-right whitespace-nowrap">{displayLine}</td>
                <td className="p-2 text-right whitespace-nowrap">{formatCurrency(bet.stake)}</td>
                <td className={`p-2 text-right font-semibold whitespace-nowrap ${netColor}`}>{formatNet(net)}</td>
                <td className={`p-2 text-center font-semibold capitalize whitespace-nowrap ${netColor}`}>{bet.result}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const ToggleButton: React.FC<{
  value: string;
  label: string;
  currentValue: string;
  onClick: (value: string) => void;
}> = ({ value, label, currentValue, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
      currentValue === value
        ? 'bg-primary-600 text-white shadow'
        : 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
    }`}
  >
    {label}
  </button>
);

const OverUnderBreakdown: React.FC<{ bets: Bet[], selectedPlayer: string | null }> = ({ bets, selectedPlayer }) => {
    
    const data = useMemo(() => {
        // User requested no filters for Player Profile O/U as it's just Props
        // Passing 'all' effectively or just passing all bets if we assume they are already filtered to player
        
        // Custom matcher to handle player aggregation keys
        const entityMatcher = (leg: BetLeg, bet: Bet, targetEntity: string) => {
            if (!leg.entities) return false;
            return leg.entities.some((e: string) => 
                getPlayerAggregationKey(e, '[Unresolved]', { sport: bet.sport as any }) === targetEntity
            );
        };
        
        return computeOverUnderStats(bets, {
            // Entity filter: only count legs where selectedPlayer is involved
            entityFilter: selectedPlayer ? {
                entity: selectedPlayer,
                matcher: entityMatcher,
            } : undefined,
            // P4: Use entity money contribution to exclude parlay money
            useEntityMoneyContribution: true,
        });
    }, [bets, selectedPlayer]);

    const pieData = [
        { name: 'Over', value: data.over.count, color: '#8b5cf6' },
        { name: 'Under', value: data.under.count, color: '#6d28d9' }
    ].filter(d => d.value > 0);

    const isPlaceholder = pieData.length === 0;

    const StatCard = ({ title, stats }: { title: string, stats: any }) => {
        const netColor = stats.net > 0 ? 'text-accent-500' : stats.net < 0 ? 'text-danger-500' : '';
        const winPct = stats.wins + stats.losses > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0;
        return (
            <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 flex-1">
                <h4 className="font-bold text-lg" style={{ color: title === 'Over' ? (pieData.find(d => d.name === 'Over')?.color || '#8b5cf6') : (pieData.find(d => d.name === 'Under')?.color || '#6d28d9') }}>{title}</h4>
                <div className="text-sm mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
                    <p><b>Bets:</b> {stats.count}</p>
                    <p><b>Record:</b> {stats.wins}-{stats.losses}</p>
                    <p><b>Win %:</b> {winPct.toFixed(1)}%</p>
                    <div className="flex justify-between items-center">
                        <b>Net:</b> 
                        <div className="flex items-center ml-1">
                            <div className="w-20 h-6">
                                 <FitText maxFontSize={16} minFontSize={10} className={`justify-end font-bold ${netColor}`}>
                                     {formatCurrency(stats.net)}
                                  </FitText>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <b>ROI:</b>
                        <span className={`font-bold ${netColor}`}>{stats.roi.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        )
    };
    
    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">Over vs. Under</h2>
                    {/* Task C3: PlayerProfileView O/U Breakdown tooltip */}

                </div>
            </div>
            <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            data={isPlaceholder ? [{ name: 'No Data', value: 1 }] : pieData} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={isPlaceholder ? 50 : 0}
                            outerRadius={60} 
                            label={isPlaceholder ? undefined : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            stroke="none"
                            fill={isPlaceholder ? "#e5e5e5" : undefined}
                        >
                            {!isPlaceholder && pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        {!isPlaceholder && <Tooltip />}
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4">
                <StatCard title="Over" stats={data.over} />
                <StatCard title="Under" stats={data.under} />
            </div>
        </div>
    );
}

// --- MAIN VIEW ---



const DateRangeButton: React.FC<{
  range: DateRange;
  label: string;
  currentRange: DateRange;
  onClick: (range: DateRange) => void;
}> = ({ range, label, currentRange, onClick }) => (
  <button
    onClick={() => onClick(range)}
    className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
      currentRange === range
        ? 'bg-primary-600 text-white shadow'
        : 'text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700'
    }`}
  >
    {label}
  </button>
);

interface PlayerProfileViewProps {
  selectedPlayer: string | null;
  setSelectedPlayer: (player: string | null) => void;
}

const PlayerProfileView: React.FC<PlayerProfileViewProps> = ({ selectedPlayer, setSelectedPlayer }) => {
    const { bets, loading } = useBets();
    const [searchTerm, setSearchTerm] = useState(selectedPlayer || '');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });


    useEffect(() => {
        setSearchTerm(selectedPlayer || '');
    }, [selectedPlayer]);

    // Extract players from bet data using leg.entityType and normalization service
    // This ensures players appear even if not manually added to localStorage
    const allPlayers = useMemo(() => {
        const players = new Set<string>();
        
        for (const bet of bets) {
            if (!bet.legs) continue;
            for (const leg of bet.legs) {
                if (!leg.entities) continue;
                for (const entity of leg.entities) {
          // Determine entity type using leg.entityType or fallback to team lookup
          if (leg.entityType === 'player') {
            // Phase 2: Use player aggregation key for player entities
            const aggregationKey = getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
            players.add(aggregationKey);
          } else if (leg.entityType === 'team') {
            const aggregationKey = getTeamAggregationKey(entity, '[Unresolved]');
            players.add(aggregationKey);
          } else {
            // Fallback: check if entity is a known team via normalization service
            const teamInfo = getTeamInfo(entity);
            if (teamInfo) {
              const aggregationKey = getTeamAggregationKey(entity, '[Unresolved]');
              players.add(aggregationKey);
            } else {
              // Assume player if not a known team - use player aggregation
              const aggregationKey = getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
              players.add(aggregationKey);
            }
          }
        }
            }
        }
        
        return Array.from(players).sort();
    }, [bets]);

    const filteredPlayers = useMemo(() => {
        if (!searchTerm) return [];
        return allPlayers.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);
    }, [allPlayers, searchTerm]);

    const handlePlayerSelect = (player: string) => {
        setSelectedPlayer(player);
        setSearchTerm(player);
        setIsSearchFocused(false);
        setDateRange('all');
        setCustomDateRange({ start: '', end: '' });
    };

    const handleClearPlayer = () => {
        setSelectedPlayer(null);
        setSearchTerm('');
        setDateRange('all');
        setCustomDateRange({ start: '', end: '' });
    };

    const playerBets = useMemo(() => {
         if (!selectedPlayer) return [];

        const datePredicate = createDateRangePredicate(dateRange, customDateRange as CustomDateRange);
        
        // Filter to only bets involving the selected player
        // Phase 2: Use player aggregation key to ensure aliases match
        const playerPredicate = (bet: Bet) => bet.legs?.some(leg => leg.entities?.some(e => getPlayerAggregationKey(e, '[Unresolved]', { sport: bet.sport as any }) === selectedPlayer)) ?? false;
        
        // STRICTLY REMOVE PARLAYS: Player profiles should not contain parlay data
        const nonParlayPredicate = (bet: Bet) => !bet.legs || bet.legs.length <= 1;

        return bets.filter(bet => 
            datePredicate(bet) && playerPredicate(bet) && nonParlayPredicate(bet)
        );
    }, [bets, selectedPlayer, dateRange, customDateRange]);
    const processedData = useMemo(() => {
        if (!selectedPlayer || playerBets.length === 0) return null;

        const overallStatsData = computeOverallStats(playerBets);
        const profitOverTime = computeProfitOverTime(playerBets);

        // Compute overallStats object for UI
        // UI expects 'record' string "wins-losses-pushes"
        const overallStats = {
            totalBets: overallStatsData.totalBets,
            totalWagered: overallStatsData.totalWagered,
            netProfit: overallStatsData.netProfit,
            roi: overallStatsData.roi,
            winRate: overallStatsData.winRate,
            record: `${overallStatsData.wins}-${overallStatsData.losses}-${overallStatsData.pushes}`
        };

        // Market Stats: only for markets where selectedPlayer was involved
        const marketMap = computeStatsByDimension(playerBets, (bet) => {
             if (bet.legs) {
                     return bet.legs
                    .filter(leg => leg.entities?.some(e => getPlayerAggregationKey(e, '[Unresolved]', { sport: bet.sport as any }) === selectedPlayer))
                    .map(leg => leg.market);
             }
             return null;
        });

        const marketStats = mapToStatsArray(marketMap).sort((a,b) => b.count - a.count);

        // Sort for recent bets
        const sortedBets = [...playerBets].sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

        return {
            overallStats,
            profitOverTime,
            marketStats,
            recentBets: sortedBets.slice(-10).reverse()
        };
    }, [playerBets, selectedPlayer]);

    /* -- Player Metadata Logic (Inferred + Resolved) -- */

    const playerMetadata = useMemo(() => {
        if (!selectedPlayer) return null;
        
        // 1. Try to get resolved info
        // We might not have sport context easily here without bets, but let's try generic first
        let info = getPlayerInfo(selectedPlayer);
        
        // 2. If no info, or if we want to cross-validate with bets:
        // Use the first bet's sport as a strong hint if metadata is missing sport
        const inferredSport = playerBets.length > 0 ? playerBets[0].sport : undefined;
        
        if (!info && inferredSport) {
             // Try again with sport context
             info = getPlayerInfo(selectedPlayer, { sport: inferredSport as any });
        }

        const sport = info?.sport || inferredSport;
        const team = info?.team; // This might be null if not in our db
        
        // If team is just a code/ID, we might want to resolve it to a name, 
        // but 'team' in PlayerData is usually a display string or ID. 
        // Let's assume it's displayable or we can try to resolve it if it looks like an ID.
        // For now, raw team string is fine.
        
        return {
            name: info?.canonical || selectedPlayer,
            sport,
            team
        };
    }, [selectedPlayer, playerBets]);


    if (loading) return <div className="p-6 text-center">Loading player data...</div>;

    const showSuggestions = isSearchFocused && searchTerm && filteredPlayers.length > 0;

    return (
        <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
            <div className={`transition-all duration-300 ${selectedPlayer ? 'flex flex-row justify-between items-start gap-4 mb-2' : 'flex flex-col space-y-6'}`}>
                <header className={selectedPlayer ? 'flex-shrink-0' : ''}>
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Player Profiles</h1>
                    {!selectedPlayer && <p className="text-neutral-500 dark:text-neutral-400 mt-1">Search for a player to see a deep-dive analysis of your betting performance.</p>}
                </header>
                
                 <div className={`bg-white dark:bg-neutral-900 rounded-lg shadow-md transition-all duration-300 ${selectedPlayer ? 'w-72 p-1 bg-transparent dark:bg-transparent shadow-none' : 'w-full p-6'}`}>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={selectedPlayer ? "Search..." : "Search for a player..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => {
                                // Delay hiding to allow click event on suggestion list to register
                                setTimeout(() => setIsSearchFocused(false), 150);
                            }}
                            className={`w-full bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all duration-300 ${selectedPlayer ? 'p-2 pr-8 text-sm' : 'p-4 pr-10 text-lg'}`}
                        />
                        <User className={`absolute top-1/2 -translate-y-1/2 text-neutral-400 transition-all duration-300 ${selectedPlayer ? 'right-2 w-4 h-4' : 'right-4 w-6 h-6'}`} />
                        {showSuggestions && (
                            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 max-h-60 overflow-y-auto">
                                {filteredPlayers.map(player => (
                                    <li key={player}
                                        onClick={() => handlePlayerSelect(player)}
                                        className="px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700">
                                        {player}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {!selectedPlayer && (
                <div className="flex-grow flex items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
                    <div>
                        <User className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
                        <h3 className="mt-4 text-xl font-semibold">Select a Player</h3>
                        <p className="mt-1">Start typing in the search bar above to find a player.</p>
                    </div>
                </div>
            )}
            {selectedPlayer && (
                <div className="space-y-6">
                    {/* --- NEW HEADER DESIGN --- */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 relative overflow-hidden">
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        {/* Top-Right Close Button */}
                        <button
                            onClick={handleClearPlayer}
                            className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors z-20"
                            title="Close Player Profile"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                            
                            {/* Player Info */}
                            <div className="flex items-start gap-4">
                                <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700 shadow-sm shrink-0">
                                    <User className="w-10 h-10 text-neutral-500 dark:text-neutral-400" />
                                </div>
                                <div className="flex flex-col justify-center h-20">
                                    <div className="flex items-center gap-2 mb-1">
                                        {playerMetadata?.sport && (
                                            <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 rounded-full border border-primary-200 dark:border-primary-800">
                                                {playerMetadata.sport}
                                            </span>
                                        )}
                                        {playerMetadata?.team && (
                                            <span className="px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">
                                                {playerMetadata.team}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight leading-none truncate max-w-lg">
                                        {playerMetadata?.name}
                                    </h2>
                                </div>
                            </div>

                             {/* Controls & Mini Stats */}
                            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
                                    <DateRangeButton range="all" label="All Time" currentRange={dateRange} onClick={setDateRange} />
                                    <DateRangeButton range="1d" label="1D" currentRange={dateRange} onClick={setDateRange} />
                                    <DateRangeButton range="3d" label="3D" currentRange={dateRange} onClick={setDateRange} />
                                    <DateRangeButton range="1w" label="1W" currentRange={dateRange} onClick={setDateRange} />
                                    <DateRangeButton range="1m" label="1M" currentRange={dateRange} onClick={setDateRange} />
                                    <DateRangeButton range="1y" label="1Y" currentRange={dateRange} onClick={setDateRange} />
                                    <DateRangeButton range="custom" label="Custom" currentRange={dateRange} onClick={setDateRange} />
                                </div>
                            </div>
                        </div>

                         {dateRange === 'custom' && (
                            <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex sm:justify-end items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="start-date" className="text-sm font-medium text-neutral-500 dark:text-neutral-400">From</label>
                                    <input
                                        type="date"
                                        id="start-date"
                                        value={customDateRange.start}
                                        onChange={e => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="end-date" className="text-sm font-medium text-neutral-500 dark:text-neutral-400">To</label>
                                    <input
                                        type="date"
                                        id="end-date"
                                        value={customDateRange.end}
                                        onChange={e => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2"
                                    />
                                </div>
                            </div>
                        )}
                        {/* Stats Grid or No Data */}
                        {!processedData ? (
                            <div className="flex items-center justify-center text-center text-neutral-500 dark:text-neutral-400 py-10 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                                <div>
                                    <BarChart2 className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
                                    <h3 className="mt-4 text-xl font-semibold">No Data Found</h3>
                                    <p className="mt-1">No bets found for {selectedPlayer} in the selected date range.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-neutral-200 dark:border-neutral-800 pt-6 mt-6">
                                <StatCard 
                                    title="Net Profit" 
                                    value={formatCurrency(processedData.overallStats.netProfit)} 
                                    icon={<Scale className="w-6 h-6"/>} 
                                    subtitle={`${processedData.overallStats.roi.toFixed(1)}% ROI`}
                                    subtitleClassName={processedData.overallStats.roi > 0 ? "text-accent-500" : processedData.overallStats.roi < 0 ? "text-danger-500" : undefined}
                                />
                                <StatCard title="Total Wagered" value={formatCurrency(processedData.overallStats.totalWagered)} icon={<BarChart2 className="w-6 h-6"/>} />
                                <StatCard title="Total Bets" value={processedData.overallStats.totalBets.toString()} icon={<BarChart2 className="w-6 h-6"/>} />
                                <StatCard 
                                    title="Win/Loss/Push" 
                                    value={processedData.overallStats.record} 
                                    icon={<BarChart2 className="w-6 h-6"/>} 
                                    subtitle={`${processedData.overallStats.winRate.toFixed(1)}% Win Rate`} 
                                    subtitleClassName={processedData.overallStats.winRate > 50 ? "text-accent-500" : processedData.overallStats.winRate < 50 ? "text-danger-500" : undefined}
                                />
                            </div>
                        )}
                    </div>
                    

                    {processedData && (
                        <div className="space-y-6">
                                <ChartContainer title="Profit Over Time">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={processedData.profitOverTime}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                                            <XAxis dataKey="date" stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} tickFormatter={(value) => formatCurrency(value)}/>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            
                            <StatsTable data={processedData.marketStats} title="Performance by Market" />
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <OverUnderBreakdown bets={playerBets} selectedPlayer={selectedPlayer} />
                                <LivePreGameChart bets={playerBets} />
                            </div>
                            
                            <RecentBetsTable bets={processedData.recentBets} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PlayerProfileView;

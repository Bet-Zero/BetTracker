import React, { useState, useMemo, useEffect } from 'react';
import { useBets } from '../hooks/useBets';
import { useInputs } from '../hooks/useInputs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Sector } from 'recharts';
import { TrendingUp, TrendingDown, Scale, BarChart2, User } from '../components/icons';
import { Bet } from '../types';
import {
  createBetTypePredicate,
  createDateRangePredicate,
  DateRange,
  CustomDateRange
} from '../utils/filterPredicates';
import { formatDateShort } from '../utils/formatters';
import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  computeStatsByDimension,
  mapToStatsArray,
} from '../services/aggregationService';
import { getNetNumeric, getEntityMoneyContribution } from '../services/displaySemantics';

// --- HELPER COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
                <p className="label font-bold mb-1">{`${label}`}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color }}>
                        {`${pld.name}: ${typeof pld.value === 'number' ? pld.value.toFixed(2) : pld.value}`}
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

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; change?: string; }> = ({ title, value, icon, change }) => {
    const isPositive = change && parseFloat(change) > 0;
    const isNegative = change && parseFloat(change) < 0;
    const changeColor = isPositive ? 'text-accent-500' : isNegative ? 'text-danger-500' : 'text-neutral-500 dark:text-neutral-400';

    return (
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-md flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase">{title}</p>
                <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-1">{value}</p>
                {change && (
                    <p className={`text-sm font-semibold flex items-center mt-2 ${changeColor}`}>
                        {isPositive && <TrendingUp className="w-4 h-4 mr-1" />}
                        {isNegative && <TrendingDown className="w-4 h-4 mr-1" />}
                        {change}
                    </p>
                )}
            </div>
            <div className="bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 p-3 rounded-full">
                {icon}
            </div>
        </div>
    );
};


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
                                <tr key={item.name} className="odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-50 dark:even:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                    <td className="px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs">{item.name}</td>
                                    <td className="px-4 py-2">{item.count}</td>
                                    <td className="px-4 py-2">{item.wins}</td>
                                    <td className="px-4 py-2">{item.losses}</td>
                                    <td className={`px-4 py-2 text-center font-semibold ${winPctColor}`}>{winPct.toFixed(1)}%</td>
                                    <td className="px-4 py-2">${item.stake.toFixed(2)}</td>
                                    <td className={`px-4 py-2 font-semibold ${netColor}`}>{item.net.toFixed(2)}</td>
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
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-right">Stake</th>
            <th className="p-2 text-right">Net</th>
            <th className="p-2 text-center">Result</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((bet, index) => {
            const net = getNetNumeric(bet);
            const netColor = net > 0 ? 'text-accent-500' : net < 0 ? 'text-danger-500' : '';
            return (
              <tr key={bet.id} className="border-b border-neutral-200 dark:border-neutral-800 odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-50 dark:even:bg-neutral-800/50">
                <td className="p-2 whitespace-nowrap">{formatDateShort(bet.placedAt)}</td>
                <td className="p-2">{bet.description}</td>
                <td className="p-2 text-right">${bet.stake.toFixed(2)}</td>
                <td className={`p-2 text-right font-semibold ${netColor}`}>{net.toFixed(2)}</td>
                <td className={`p-2 text-center font-semibold capitalize ${netColor}`}>{bet.result}</td>
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
    const [filter, setFilter] = useState<'props' | 'totals' | 'all'>('all');

    const data = useMemo(() => {
        const filteredBets = bets.filter(bet => {
            if (filter === 'props') return bet.marketCategory === 'Props';
            if (filter === 'totals') return bet.marketCategory === 'Main Markets';
            return bet.marketCategory === 'Props' || bet.marketCategory === 'Main Markets';
        });

        const stats = { 
            over: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 }, 
            under: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 }
        };

        filteredBets.forEach(bet => {
            if (bet.legs?.length) {
                // P4: Use entity money contribution to exclude parlay money from player stats
                const moneyContribution = getEntityMoneyContribution(bet);
                bet.legs.forEach(leg => {
                    if (leg.ou && (!selectedPlayer || leg.entities?.includes(selectedPlayer))) {
                        const ou = leg.ou.toLowerCase() as 'over' | 'under';
                        stats[ou].count++; 
                        stats[ou].stake += moneyContribution.stake; // P4: excludes parlays
                        stats[ou].net += moneyContribution.net; // P4: excludes parlays
                        if (bet.result === 'win') stats[ou].wins++; 
                        if (bet.result === 'loss') stats[ou].losses++;
                    }
                });
            }
        });

        // Using imported calculateRoi from aggregationService
        
        return { 
            over: {...stats.over, roi: calculateRoi(stats.over.net, stats.over.stake)}, 
            under: {...stats.under, roi: calculateRoi(stats.under.net, stats.under.stake)}
        };
    }, [bets, filter, selectedPlayer]);

    const pieData = [
        { name: 'Over', value: data.over.count, color: '#8b5cf6' },
        { name: 'Under', value: data.under.count, color: '#6d28d9' }
    ];

    const StatCard = ({ title, stats }: { title: string, stats: any }) => {
        const netColor = stats.net > 0 ? 'text-accent-500' : stats.net < 0 ? 'text-danger-500' : '';
        const NetIcon = stats.net > 0 ? TrendingUp : TrendingDown;
        const winPct = stats.wins + stats.losses > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0;
        return (
            <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 flex-1">
                <h4 className="font-bold text-lg" style={{ color: title === 'Over' ? pieData[0].color : pieData[1].color }}>{title}</h4>
                <div className="text-sm mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
                    <p><b>Bets:</b> {stats.count}</p>
                    <p><b>Win/Loss:</b> {stats.wins}-{stats.losses}</p>
                    <p><b>Win %:</b> {winPct.toFixed(1)}%</p>
                    <p className={`flex items-center ${netColor}`}><b>Net:</b><NetIcon className="w-4 h-4 mx-1"/> ${stats.net.toFixed(2)}</p>
                    <p className={netColor}><b>ROI:</b> {stats.roi.toFixed(1)}%</p>
                </div>
            </div>
        )
    };
    
    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">Over vs. Under</h2>
                <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
                    <ToggleButton value="props" label="Props" currentValue={filter} onClick={(v) => setFilter(v as any)} />
                    <ToggleButton value="totals" label="Totals" currentValue={filter} onClick={(v) => setFilter(v as any)} />
                    <ToggleButton value="all" label="All" currentValue={filter} onClick={(v) => setFilter(v as any)} />
                </div>
            </div>
            <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
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
    const { players } = useInputs();
    const [searchTerm, setSearchTerm] = useState(selectedPlayer || '');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [betTypeFilter, setBetTypeFilter] = useState<"singles" | "parlays" | "all">("singles");

    useEffect(() => {
        setSearchTerm(selectedPlayer || '');
    }, [selectedPlayer]);

    const allPlayers = useMemo(() => {
        return Array.from(new Set(Object.values(players).flat())).sort();
    }, [players]);

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
        const typePredicate = createBetTypePredicate(betTypeFilter);
        
        // Filter to only bets involving the selected player
        const playerPredicate = (bet: Bet) => bet.legs?.some(leg => leg.entities?.includes(selectedPlayer)) ?? false;

        return bets.filter(bet => 
            datePredicate(bet) && playerPredicate(bet) && typePredicate(bet)
        );
    }, [bets, selectedPlayer, dateRange, customDateRange, betTypeFilter]);

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
                    .filter(leg => leg.entities?.includes(selectedPlayer))
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

    if (loading) return <div className="p-6 text-center">Loading player data...</div>;

    const showSuggestions = isSearchFocused && searchTerm && filteredPlayers.length > 0;

    return (
        <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
            <header>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Player Profiles</h1>
                <p className="text-neutral-500 dark:text-neutral-400 mt-1">Search for a player to see a deep-dive analysis of your betting performance.</p>
            </header>
            
             <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search for a player..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => {
                            // Delay hiding to allow click event on suggestion list to register
                            setTimeout(() => setIsSearchFocused(false), 150);
                        }}
                        className="w-full p-4 pr-10 text-lg bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700 focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-400" />
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

            {!selectedPlayer ? (
                <div className="flex-grow flex items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
                    <div>
                        <User className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
                        <h3 className="mt-4 text-xl font-semibold">Select a Player</h3>
                        <p className="mt-1">Start typing in the search bar above to find a player.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                                <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
                                    <div className="px-3 py-1.5 rounded-md font-semibold text-xs bg-primary-600 text-white shadow">
                                        PLAYER: {selectedPlayer}
                                    </div>
                                    <button
                                        onClick={handleClearPlayer}
                                        className="px-3 py-1.5 rounded-md font-semibold text-xs text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/50"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
                                        <button
                                            onClick={() => setBetTypeFilter("singles")}
                                            className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                                                betTypeFilter === "singles"
                                                    ? "bg-primary-600 text-white shadow"
                                                    : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                                            }`}
                                        >
                                            Singles Only
                                        </button>
                                        <button
                                            onClick={() => setBetTypeFilter("parlays")}
                                            className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                                                betTypeFilter === "parlays"
                                                    ? "bg-primary-600 text-white shadow"
                                                    : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                                            }`}
                                        >
                                            Parlays Only
                                        </button>
                                        <button
                                            onClick={() => setBetTypeFilter("all")}
                                            className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                                                betTypeFilter === "all"
                                                    ? "bg-primary-600 text-white shadow"
                                                    : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                                            }`}
                                        >
                                            All Bets
                                        </button>
                                    </div>
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
                                <div className="flex sm:justify-end items-center space-x-4">
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
                        </div>
                        
                        {!processedData ? (
                            <div className="flex-grow flex items-center justify-center text-center text-neutral-500 dark:text-neutral-400 py-10">
                                <div>
                                    <BarChart2 className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
                                    <h3 className="mt-4 text-xl font-semibold">No Data Found</h3>
                                    <p className="mt-1">No bets found for {selectedPlayer} in the selected date range.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-neutral-200 dark:border-neutral-800 pt-6">
                                <StatCard title="Net Profit" value={`${processedData.overallStats.netProfit >= 0 ? '$' : '-$'}${Math.abs(processedData.overallStats.netProfit).toFixed(2)}`} icon={<Scale className="w-6 h-6"/>} change={`${processedData.overallStats.roi.toFixed(1)}% ROI`}/>
                                <StatCard title="Total Wagered" value={`$${processedData.overallStats.totalWagered.toFixed(2)}`} icon={<BarChart2 className="w-6 h-6"/>} />
                                <StatCard title="Total Bets" value={processedData.overallStats.totalBets.toString()} icon={<BarChart2 className="w-6 h-6"/>} />
                                <StatCard title="Win/Loss/Push" value={processedData.overallStats.record} icon={<BarChart2 className="w-6 h-6"/>} change={`${processedData.overallStats.winRate.toFixed(1)}% Win Rate`} />
                            </div>
                        )}
                    </div>

                    {processedData && (
                        <div className="space-y-6">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ChartContainer title="Profit Over Time">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={processedData.profitOverTime}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                                            <XAxis dataKey="date" stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`}/>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                                <OverUnderBreakdown bets={playerBets} selectedPlayer={selectedPlayer} />
                            </div>

                            <StatsTable data={processedData.marketStats} title="Performance by Market" />
                            
                            <RecentBetsTable bets={processedData.recentBets} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PlayerProfileView;

import React, { useMemo, useState } from 'react';
import { useBets } from '../hooks/useBets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Scale, BarChart2, ChevronDown } from '../components/icons';

// --- HELPER COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
                <p className="label font-bold mb-1">{`${label}`}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color || pld.fill }}>
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

type DateRange = 'all' | '1d' | '3d' | '1w' | '1m' | '1y' | 'custom';

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


// --- MAIN VIEW ---

const SportsbookBreakdownView: React.FC = () => {
    const { bets, loading } = useBets();
    // FIX: The selected book is a string (the sportsbook name) or 'all', not a Sportsbook object.
    const [selectedBook, setSelectedBook] = useState<string | 'all'>('all');
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });


    const availableBooks = useMemo(() => {
        if (loading) return [];
        const books = new Set(bets.map(b => b.book));
        // FIX: The list of available books is an array of strings. The incorrect cast to `Sportsbook[]` is removed.
        return ['all', ...Array.from(books).sort()];
    }, [bets, loading]);

    const filteredBets = useMemo(() => {
        let betsToFilter = bets;

        if (selectedBook !== 'all') {
            // FIX: This comparison is now valid (string === string) because selectedBook's type is corrected.
            betsToFilter = betsToFilter.filter(b => b.book === selectedBook);
        }
        
        if (dateRange === 'all') {
            return betsToFilter;
        }

        if (dateRange === 'custom') {
            const customStart = customDateRange.start ? new Date(`${customDateRange.start}T00:00:00.000Z`) : null;
            const customEnd = customDateRange.end ? new Date(`${customDateRange.end}T23:59:59.999Z`) : null;
            
            return betsToFilter.filter(bet => {
                const betDate = new Date(bet.placedAt);
                if (customStart && betDate < customStart) return false;
                if (customEnd && betDate > customEnd) return false;
                return true;
            });
        }

        let startDate: Date;
        const now = new Date();

        switch (dateRange) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '3d':
                startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
                break;
            case '1w':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                startDate = oneMonthAgo;
                break;
            case '1y':
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                startDate = oneYearAgo;
                break;
            default:
                return betsToFilter;
        }
        
        return betsToFilter.filter(bet => new Date(bet.placedAt) >= startDate);
    }, [bets, selectedBook, dateRange, customDateRange]);

    const processedData = useMemo(() => {
        if (filteredBets.length === 0) return null;

        const sortedBets = [...filteredBets].sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

        let cumulativeProfit = 0;
        const profitOverTime = sortedBets.map(bet => {
            cumulativeProfit += (bet.payout - bet.stake);
            return { date: new Date(bet.placedAt).toLocaleDateString('en-CA'), profit: cumulativeProfit };
        });

        const stats = {
            totalBets: filteredBets.length,
            totalWagered: 0,
            netProfit: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            roi: 0
        };
        const profitBySport = new Map<string, number>();

        for (const bet of filteredBets) {
            const net = bet.payout - bet.stake;
            stats.totalWagered += bet.stake;
            stats.netProfit += net;
            if (bet.result === 'win') stats.wins++;
            if (bet.result === 'loss') stats.losses++;

            profitBySport.set(bet.sport, (profitBySport.get(bet.sport) || 0) + net);
        }

        stats.roi = stats.totalWagered > 0 ? (stats.netProfit / stats.totalWagered) * 100 : 0;
        stats.winRate = (stats.wins + stats.losses) > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0;
        
        const profitBySportData = Array.from(profitBySport.entries()).map(([name, profit]) => ({ name, profit })).sort((a,b) => b.profit - a.profit);

        return { stats, profitOverTime, profitBySportData };
    }, [filteredBets]);

    if (loading) return <div className="p-6 text-center">Loading breakdown...</div>;
    if (bets.length === 0) return <div className="p-6 text-center text-neutral-500">No data to display. Please import some bets first.</div>;
    
    const FAVORITE_BOOKS = ['FanDuel', 'DraftKings'];
    const mainBooks: string[] = ['all'];
    const dropdownBooks: string[] = [];

    const otherBooks: string[] = [];
    availableBooks.forEach(book => {
        if (book === 'all') return;
        if (FAVORITE_BOOKS.includes(book)) {
            mainBooks.push(book);
        } else {
            otherBooks.push(book);
        }
    });
    dropdownBooks.push(...otherBooks.sort());

    const isDropdownBookSelected = dropdownBooks.includes(selectedBook as string);

    return (
         <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
            <header>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">By Sportsbook</h1>
                <p className="text-neutral-500 dark:text-neutral-400 mt-1">A detailed performance analysis for each sportsbook.</p>
            </header>
            
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
                        {mainBooks.map(book => (
                            <button
                                key={book}
                                onClick={() => setSelectedBook(book)}
                                className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                                selectedBook === book
                                    ? 'bg-primary-600 text-white shadow'
                                    : 'text-neutral-700 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                                }`}
                            >
                                {book === 'all' ? 'All Books' : book}
                            </button>
                        ))}
                        {dropdownBooks.length > 0 && (
                            <div className="relative">
                                <select
                                    value={isDropdownBookSelected ? selectedBook : 'more'}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value !== 'more') {
                                            setSelectedBook(value);
                                        }
                                    }}
                                    className={`w-full px-3 py-1.5 rounded-md font-medium text-xs transition-colors appearance-none pr-8 text-left ${
                                        isDropdownBookSelected
                                        ? 'bg-primary-600 text-white shadow'
                                        : 'text-neutral-700 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                                    }`}
                                >
                                    <option value="more" disabled>More...</option>
                                    {dropdownBooks.map(book => (
                                        <option key={book} value={book}>{book}</option>
                                    ))}
                                </select>
                                <ChevronDown 
                                    className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDropdownBookSelected ? 'text-white' : 'text-neutral-500'}`} 
                                />
                            </div>
                        )}
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
            
                {processedData ? (
                    <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Net Profit" value={`${processedData.stats.netProfit >= 0 ? '$' : '-$'}${Math.abs(processedData.stats.netProfit).toFixed(2)}`} icon={<Scale className="w-6 h-6"/>} change={`${processedData.stats.roi.toFixed(1)}% ROI`}/>
                            <StatCard title="Total Wagered" value={`$${processedData.stats.totalWagered.toFixed(2)}`} icon={<BarChart2 className="w-6 h-6"/>} />
                            <StatCard title="Total Bets" value={processedData.stats.totalBets.toString()} icon={<BarChart2 className="w-6 h-6"/>} />
                            <StatCard title="Win Rate" value={`${processedData.stats.winRate.toFixed(1)}%`} icon={<BarChart2 className="w-6 h-6"/>} change={`${processedData.stats.wins}-${processedData.stats.losses}`} />
                        </div>

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
                            
                            <ChartContainer title="Net Profit by Sport">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={processedData.profitBySportData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                                        <XAxis type="number" stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`}/>
                                        <YAxis type="category" dataKey="name" stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} width={80} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="profit" name="Profit">
                                            {processedData.profitBySportData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="text-center text-neutral-500 dark:text-neutral-400 p-8">
                            <BarChart2 className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
                            <h3 className="mt-4 text-xl font-semibold">No Data Found</h3>
                            <p className="mt-1">No betting data found for the selected sportsbook and date range.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SportsbookBreakdownView;
import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Bet } from '../../types';
import { FitText } from '../FitText';
import { TrendingUp, TrendingDown } from '../icons';
import { calculateRoi } from '../../services/aggregationService';
import { getNetNumeric } from '../../services/displaySemantics';

interface LivePreGameChartProps {
    bets: Bet[];
}

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
        ? "bg-primary-600 text-white shadow"
        : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
    }`}
  >
    {label}
  </button>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
        <p className="label font-bold mb-1">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color || pld.fill }}>
            {`${pld.name}: ${
              typeof pld.value === "number" ? pld.value.toFixed(2) : pld.value
            }`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const LivePreGameChart: React.FC<LivePreGameChartProps> = ({ bets }) => {
  // User requested to remove filters for Player Profiles as they are implicitly Props
  // so we process all passed bets directly.
  
  const data = useMemo(() => {
    const stats = {
      live: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
      preMatch: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
    };

    bets.forEach((bet) => {
      const result = bet.result;
      const net = getNetNumeric(bet);
      const liveTarget = bet.isLive ? stats.live : stats.preMatch;
      liveTarget.count++;
      liveTarget.stake += bet.stake;
      liveTarget.net += net;
      if (result === "win") liveTarget.wins++;
      if (result === "loss") liveTarget.losses++;
    });

    return {
      live: { ...stats.live, roi: calculateRoi(stats.live.net, stats.live.stake) },
      preMatch: { ...stats.preMatch, roi: calculateRoi(stats.preMatch.net, stats.preMatch.stake) },
    };
  }, [bets]);

  const pieData = [
    { name: "Pre-Match", value: data.preMatch.count, color: "#4c1d95" },
    { name: "Live", value: data.live.count, color: "#a78bfa" },
  ].filter((d) => d.value > 0);

  const isPlaceholder = pieData.length === 0;

  const BreakdownStatCard = ({
    title,
    stats,
    color,
  }: {
    title: string;
    stats: any;
    color: string;
  }) => {
    const netColor =
      stats.net > 0
        ? "text-accent-500"
        : stats.net < 0
        ? "text-danger-500"
        : "";
    const winPct =
      stats.wins + stats.losses > 0
        ? (stats.wins / (stats.wins + stats.losses)) * 100
        : 0;
    return (
      <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 flex-1">
        <h4 className="font-bold text-lg" style={{ color }}>
          {title}
        </h4>
        <div className="text-sm mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
          <p>
            <b>Bets:</b> {stats.count}
          </p>
          <p>
            <b>Record:</b> {stats.wins}-{stats.losses}
          </p>
          <p>
            <b>Win %:</b> {winPct.toFixed(1)}%
          </p>
          <div className={`flex justify-between items-center ${netColor}`}>
            <b>Net:</b>
            <div className="flex items-center ml-1">
              <div className="w-20 h-6">
                 <FitText maxFontSize={16} minFontSize={10} className="justify-end font-bold">
                   ${stats.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </FitText>
              </div>
            </div>
          </div>
          <div className={`flex justify-between items-center ${netColor}`}>
            <b>ROI:</b>
            <span className="font-bold">{stats.roi.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          Live vs. Pre-Game
        </h2>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={isPlaceholder ? [{ name: "No Data", value: 1 }] : pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={isPlaceholder ? 50 : 0}
              outerRadius={60}
              label={
                isPlaceholder
                  ? undefined
                  : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
              }
              stroke="none"
              fill={isPlaceholder ? "#e5e5e5" : undefined}
            >
              {!isPlaceholder &&
                pieData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
            </Pie>
            {!isPlaceholder && <Tooltip content={<CustomTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-4">
        <BreakdownStatCard
          title="Pre-Game"
          stats={data.preMatch}
          color={
            pieData.find((d) => d.name === "Pre-Match")?.color || "#4c1d95"
          }
        />
        <BreakdownStatCard
          title="Live"
          stats={data.live}
          color={pieData.find((d) => d.name === "Live")?.color || "#a78bfa"}
        />
      </div>
    </div>
  );
};

export default LivePreGameChart;

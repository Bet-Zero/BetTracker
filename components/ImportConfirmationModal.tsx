import React, { useState, useMemo } from 'react';
import { Bet, Sportsbook } from '../types';
import { X, AlertTriangle, CheckCircle2 } from './icons';

interface ImportConfirmationModalProps {
  bets: Bet[];
  onConfirm: () => void;
  onCancel: () => void;
  onEditBet: (index: number, updates: Partial<Bet>) => void;
  availableSports: string[];
  availablePlayers: Record<string, string[]>; // sport -> player names
  sportsbooks: Sportsbook[];
  onAddPlayer: (sport: string, playerName: string) => void;
  onAddSport: (sport: string) => void;
}

export const ImportConfirmationModal: React.FC<ImportConfirmationModalProps> = ({
  bets,
  onConfirm,
  onCancel,
  onEditBet,
  availableSports,
  availablePlayers,
  sportsbooks,
  onAddPlayer,
  onAddSport,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Map sportsbook names to abbreviations
  const siteShortNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    sportsbooks.forEach((book) => {
      map[book.name] = book.abbreviation;
    });
    return map;
  }, [sportsbooks]);

  // Check for issues in each bet and return issues by field
  const getBetIssues = (bet: Bet, index: number): { field: string; message: string }[] => {
    const issues: { field: string; message: string }[] = [];
    
    if (!bet.sport || bet.sport.trim() === '') {
      issues.push({ field: 'sport', message: 'Sport is missing' });
    } else if (!availableSports.includes(bet.sport)) {
      issues.push({ field: 'sport', message: `Sport "${bet.sport}" not in database` });
    }
    
    if (bet.marketCategory === 'Other' || !bet.marketCategory) {
      issues.push({ field: 'category', message: 'Category is missing or invalid' });
    }
    
    if (bet.name) {
      const sportPlayers = availablePlayers[bet.sport] || [];
      if (!sportPlayers.includes(bet.name)) {
        issues.push({ field: 'name', message: `Player "${bet.name}" not in database` });
      }
    }
    
    if (!bet.type && bet.marketCategory === 'Props') {
      issues.push({ field: 'type', message: 'Stat type is missing' });
    }
    
    return issues;
  };

  const handleAddPlayer = (sport: string, playerName: string) => {
    if (sport && playerName) {
      onAddPlayer(sport, playerName);
    }
  };

  const handleAddSport = (sport: string) => {
    if (sport) {
      onAddSport(sport);
    }
  };

  const hasAnyIssues = bets.some((bet, index) => getBetIssues(bet, index).length > 0);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid Date";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const calculateToWin = (stake: number, odds: number): number => {
    if (isNaN(stake) || isNaN(odds) || stake <= 0) return 0;
    if (odds > 0) {
      return stake + (stake * (odds / 100));
    } else if (odds < 0) {
      return stake + (stake / (Math.abs(odds) / 100));
    }
    return 0;
  };

  const formatOdds = (odds: number | undefined): string => {
    if (odds === undefined || odds === null) return "";
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-[95vw] w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Review Bets Before Import
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              <span className="font-semibold text-neutral-900 dark:text-white">{bets.length}</span> bet{bets.length !== 1 ? 's' : ''} ready to import. Review and fix any issues before importing.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Bets Table */}
        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400">
              <thead className="text-xs text-neutral-700 uppercase bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 sticky top-0 z-10">
                <tr className="whitespace-nowrap">
                  <th className="px-2 py-3">Date</th>
                  <th className="px-2 py-3">Site</th>
                  <th className="px-2 py-3">Sport</th>
                  <th className="px-2 py-3">Category</th>
                  <th className="px-2 py-3">Type</th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-2 py-3 text-center">O/U</th>
                  <th className="px-2 py-3 text-center">Line</th>
                  <th className="px-2 py-3">Odds</th>
                  <th className="px-2 py-3">Bet</th>
                  <th className="px-2 py-3">To Win</th>
                  <th className="px-2 py-3">Result</th>
                  <th className="px-2 py-3">Net</th>
                  <th className="px-2 py-3 text-center">Live</th>
                  <th className="px-2 py-3">Tail</th>
                  <th className="px-2 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet, index) => {
                  const issues = getBetIssues(bet, index);
                  const isEditing = editingIndex === index;
                  const toWin = calculateToWin(bet.stake, bet.odds);
                  
                  // Calculate net based on result
                  let net = 0;
                  if (bet.result === 'win') {
                    net = bet.payout ? bet.payout - bet.stake : toWin - bet.stake;
                  } else if (bet.result === 'loss') {
                    net = -bet.stake;
                  } else if (bet.result === 'push') {
                    net = 0;
                  }
                  // pending: net stays 0

                  return (
                    <tr
                      key={index}
                      className={`border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 ${
                        issues.length > 0
                          ? 'bg-yellow-50 dark:bg-yellow-900/20'
                          : 'odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-50 dark:even:bg-neutral-800/50'
                      }`}
                    >
                      <td className="px-2 py-3 whitespace-nowrap">{formatDate(bet.placedAt)}</td>
                      <td className="px-2 py-3 font-bold">{siteShortNameMap[bet.book] || bet.book}</td>
                      <td className="px-2 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <select
                              value={bet.sport || ''}
                              onChange={(e) => onEditBet(index, { sport: e.target.value })}
                              className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                            >
                              <option value="">Select</option>
                              {availableSports.map((sport) => (
                                <option key={sport} value={sport}>{sport}</option>
                              ))}
                            </select>
                            {bet.sport && !availableSports.includes(bet.sport) && (
                              <button
                                onClick={() => handleAddSport(bet.sport!)}
                                className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                title="Add Sport"
                              >
                                +
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={!bet.sport ? 'text-red-500' : ''}>{bet.sport || '(missing)'}</span>
                            {issues.find(i => i.field === 'sport') && (
                              <button
                                onClick={() => {
                                  const issue = issues.find(i => i.field === 'sport');
                                  if (issue?.message.includes('not in database') && bet.sport) {
                                    handleAddSport(bet.sport);
                                  } else {
                                    setEditingIndex(index);
                                  }
                                }}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'sport')?.message}
                              >
                                <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {isEditing ? (
                          <select
                            value={bet.marketCategory || ''}
                            onChange={(e) => onEditBet(index, { marketCategory: e.target.value })}
                            className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                          >
                            <option value="">Select</option>
                            <option value="Props">Props</option>
                            <option value="Main Markets">Main Markets</option>
                            <option value="Futures">Futures</option>
                            <option value="Parlays">Parlays</option>
                            <option value="SGP/SGP+">SGP/SGP+</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={!bet.marketCategory ? 'text-red-500' : ''}>{bet.marketCategory || '(missing)'}</span>
                            {issues.find(i => i.field === 'category') && (
                              <button
                                onClick={() => setEditingIndex(index)}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'category')?.message}
                              >
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 capitalize">
                        {isEditing ? (
                          <input
                            type="text"
                            value={bet.type || ''}
                            onChange={(e) => onEditBet(index, { type: e.target.value })}
                            className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                            placeholder="e.g., 3pt"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <span>{bet.type || ''}</span>
                            {issues.find(i => i.field === 'type') && (
                              <button
                                onClick={() => setEditingIndex(index)}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'type')?.message}
                              >
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 font-medium text-neutral-900 dark:text-white truncate">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={bet.name || ''}
                              onChange={(e) => onEditBet(index, { name: e.target.value })}
                              className="flex-1 p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                              placeholder="Player name"
                            />
                            {bet.name && bet.sport && !(availablePlayers[bet.sport] || []).includes(bet.name) && (
                              <button
                                onClick={() => handleAddPlayer(bet.sport!, bet.name!)}
                                className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                title="Add Player"
                              >
                                +
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={bet.name && bet.sport && !(availablePlayers[bet.sport] || []).includes(bet.name) ? 'text-yellow-600' : ''}>
                              {bet.name || ''}
                            </span>
                            {issues.find(i => i.field === 'name') && (
                              <button
                                onClick={() => {
                                  const issue = issues.find(i => i.field === 'name');
                                  if (issue?.message.includes('not in database') && bet.name && bet.sport) {
                                    handleAddPlayer(bet.sport, bet.name);
                                  } else {
                                    setEditingIndex(index);
                                  }
                                }}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'name')?.message}
                              >
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center capitalize">
                        {bet.ou ? bet.ou[0] : ''}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {bet.line || ''}
                      </td>
                      <td className="px-2 py-3">{formatOdds(bet.odds)}</td>
                      <td className="px-2 py-3">${bet.stake.toFixed(2)}</td>
                      <td className="px-2 py-3">${toWin.toFixed(2)}</td>
                      <td className="px-2 py-3 capitalize">{bet.result || 'pending'}</td>
                      <td className={`px-2 py-3 ${
                        net > 0 ? 'text-accent-500' : net < 0 ? 'text-danger-500' : ''
                      }`}>
                        {bet.result === 'pending' ? '' : `$${net.toFixed(2)}`}
                      </td>
                      <td className="px-2 py-3 text-center whitespace-nowrap">{bet.betType === 'live' ? '✓' : ''}</td>
                      <td className="px-2 py-3 whitespace-nowrap truncate">{bet.tail || ''}</td>
                      <td className="px-2 py-3">
                        {isEditing ? (
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingIndex(index)}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {hasAnyIssues && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {bets.filter((bet, i) => getBetIssues(bet, i).length > 0).length} bet(s) have issues
              </span>
            )}
            {!hasAnyIssues && (
              <span className="text-green-600 dark:text-green-400">All bets look good!</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Import {bets.length} Bet{bets.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


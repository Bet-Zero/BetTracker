import React, { useState, useMemo } from 'react';
import { Bet, Sportsbook, FinalRow } from '../types';
import { X, AlertTriangle, CheckCircle2 } from './icons';
import { betToFinalRows } from '../parsing/betToFinalRows';

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

interface FinalRowWithBetRef extends FinalRow {
  _betIndex: number; // Reference to original bet for editing
  _legIndex?: number; // Reference to leg index if multi-leg bet
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

  // Convert Bets to FinalRows
  const finalRows = useMemo<FinalRowWithBetRef[]>(() => {
    const rows: FinalRowWithBetRef[] = [];
    bets.forEach((bet, betIndex) => {
      const betRows = betToFinalRows(bet);
      const hasLegs = bet.legs && bet.legs.length > 0;
      betRows.forEach((row, legIndex) => {
        rows.push({
          ...row,
          _betIndex: betIndex,
          // Set legIndex whenever bet has legs structure (even for single-leg bets)
          _legIndex: hasLegs ? legIndex : undefined,
        });
      });
    });
    return rows;
  }, [bets]);

  // Map sportsbook names to abbreviations
  const siteShortNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    sportsbooks.forEach((book) => {
      map[book.name] = book.abbreviation;
    });
    return map;
  }, [sportsbooks]);

  // Check for issues in each FinalRow and return issues by field
  const getRowIssues = (row: FinalRow): { field: string; message: string }[] => {
    const issues: { field: string; message: string }[] = [];
    
    if (!row.Sport || row.Sport.trim() === '') {
      issues.push({ field: 'Sport', message: 'Sport is missing' });
    } else if (!availableSports.includes(row.Sport)) {
      issues.push({ field: 'Sport', message: `Sport "${row.Sport}" not in database` });
    }
    
    if (!row.Category || row.Category.trim() === '') {
      issues.push({ field: 'Category', message: 'Category is missing or invalid' });
    }
    
    if (row.Name && row.Name.trim()) {
      const sportPlayers = availablePlayers[row.Sport] || [];
      if (!sportPlayers.includes(row.Name)) {
        issues.push({ field: 'Name', message: `Player "${row.Name}" not in database` });
      }
    }
    
    if (!row.Type && row.Category === 'Props') {
      issues.push({ field: 'Type', message: 'Stat type is missing' });
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

  const hasAnyIssues = finalRows.some((row) => getRowIssues(row).length > 0);

  // Handle editing a FinalRow field by updating the original Bet
  const handleEditRow = (rowIndex: number, field: keyof FinalRow, value: string) => {
    const row = finalRows[rowIndex];
    const betIndex = row._betIndex;
    const legIndex = row._legIndex;
    
    // For now, we'll update the bet directly
    // This is a simplified approach - a full implementation would need to
    // map FinalRow changes back to Bet structure
    const bet = bets[betIndex];
    
    // Update based on field
    const updates: Partial<Bet> = {};
    
    switch (field) {
      case 'Sport':
        updates.sport = value;
        break;
      case 'Category':
        updates.marketCategory = value;
        break;
      case 'Type':
        if (legIndex !== undefined && bet.legs) {
          // Update leg market
          const newLegs = [...bet.legs];
          newLegs[legIndex] = { ...newLegs[legIndex], market: value };
          updates.legs = newLegs;
        } else {
          updates.type = value;
        }
        break;
      case 'Name':
        if (legIndex !== undefined && bet.legs) {
          // Update leg entity
          const newLegs = [...bet.legs];
          newLegs[legIndex] = { ...newLegs[legIndex], entities: [value] };
          updates.legs = newLegs;
        } else {
          updates.name = value;
        }
        break;
    }
    
    if (Object.keys(updates).length > 0) {
      onEditBet(betIndex, updates);
    }
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
                {finalRows.map((row, index) => {
                  const issues = getRowIssues(row);
                  const isEditing = editingIndex === index;

                  return (
                    <tr
                      key={index}
                      className={`border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 ${
                        issues.length > 0
                          ? 'bg-yellow-50 dark:bg-yellow-900/20'
                          : 'odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-50 dark:even:bg-neutral-800/50'
                      }`}
                    >
                      <td className="px-2 py-3 whitespace-nowrap">{row.Date}</td>
                      <td className="px-2 py-3 font-bold">{siteShortNameMap[row.Site] || row.Site}</td>
                      <td className="px-2 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <select
                              value={row.Sport || ''}
                              onChange={(e) => handleEditRow(index, 'Sport', e.target.value)}
                              className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                            >
                              <option value="">Select</option>
                              {availableSports.map((sport) => (
                                <option key={sport} value={sport}>{sport}</option>
                              ))}
                            </select>
                            {row.Sport && !availableSports.includes(row.Sport) && (
                              <button
                                onClick={() => handleAddSport(row.Sport)}
                                className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                title="Add Sport"
                              >
                                +
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={!row.Sport ? 'text-red-500' : ''}>{row.Sport || '(missing)'}</span>
                            {issues.find(i => i.field === 'Sport') && (
                              <button
                                onClick={() => {
                                  const issue = issues.find(i => i.field === 'Sport');
                                  if (issue?.message.includes('not in database') && row.Sport) {
                                    handleAddSport(row.Sport);
                                  } else {
                                    setEditingIndex(index);
                                  }
                                }}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'Sport')?.message}
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
                            value={row.Category || ''}
                            onChange={(e) => handleEditRow(index, 'Category', e.target.value)}
                            className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                          >
                            <option value="">Select</option>
                            <option value="Props">Props</option>
                            <option value="Main">Main</option>
                            <option value="Futures">Futures</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={!row.Category ? 'text-red-500' : ''}>{row.Category || '(missing)'}</span>
                            {issues.find(i => i.field === 'Category') && (
                              <button
                                onClick={() => setEditingIndex(index)}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'Category')?.message}
                              >
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`px-2 py-3 ${!row.Type ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={row.Type || ''}
                            onChange={(e) => handleEditRow(index, 'Type', e.target.value)}
                            className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                            placeholder="e.g., 3pt, Pts"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={!row.Type ? 'text-yellow-700 dark:text-yellow-400 font-semibold' : ''}>{row.Type || '(needs review)'}</span>
                            {issues.find(i => i.field === 'Type') && (
                              <button
                                onClick={() => setEditingIndex(index)}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'Type')?.message}
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
                              value={row.Name || ''}
                              onChange={(e) => handleEditRow(index, 'Name', e.target.value)}
                              className="flex-1 p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                              placeholder="Player/Team name only"
                            />
                            {row.Name && row.Sport && !(availablePlayers[row.Sport] || []).includes(row.Name) && (
                              <button
                                onClick={() => handleAddPlayer(row.Sport, row.Name)}
                                className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                title="Add Player"
                              >
                                +
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={row.Name && row.Sport && !(availablePlayers[row.Sport] || []).includes(row.Name) ? 'text-yellow-600' : ''}>
                              {row.Name || ''}
                            </span>
                            {issues.find(i => i.field === 'Name') && (
                              <button
                                onClick={() => {
                                  const issue = issues.find(i => i.field === 'Name');
                                  if (issue?.message.includes('not in database') && row.Name && row.Sport) {
                                    handleAddPlayer(row.Sport, row.Name);
                                  } else {
                                    setEditingIndex(index);
                                  }
                                }}
                                className="flex-shrink-0"
                                title={issues.find(i => i.field === 'Name')?.message}
                              >
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {row.Over === '1' ? 'O' : row.Under === '1' ? 'U' : ''}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {row.Line || ''}
                      </td>
                      <td className="px-2 py-3">{row.Odds}</td>
                      <td className="px-2 py-3">${row.Bet}</td>
                      <td className="px-2 py-3">${row['To Win']}</td>
                      <td className="px-2 py-3 capitalize">{row.Result}</td>
                      <td className={`px-2 py-3 ${
                        parseFloat(row.Net) > 0 ? 'text-accent-500' : parseFloat(row.Net) < 0 ? 'text-danger-500' : ''
                      }`}>
                        {row.Net ? `$${row.Net}` : ''}
                      </td>
                      <td className="px-2 py-3 text-center whitespace-nowrap">{row.Live === '1' ? '✓' : ''}</td>
                      <td className="px-2 py-3 text-center whitespace-nowrap">{row.Tail === '1' ? '✓' : ''}</td>
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
                {finalRows.filter((row) => getRowIssues(row).length > 0).length} row(s) have issues
              </span>
            )}
            {!hasAnyIssues && (
              <span className="text-green-600 dark:text-green-400">All rows look good!</span>
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
              Import {bets.length} Bet{bets.length !== 1 ? 's' : ''} ({finalRows.length} row{finalRows.length !== 1 ? 's' : ''})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


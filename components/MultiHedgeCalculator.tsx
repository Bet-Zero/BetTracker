/**
 * Multi-Outcome Hedge Calculator
 * 
 * An advanced hedge calculator for futures positions that supports:
 * - Multiple hedge outcomes (not just binary yes/no)
 * - Adjustable balance slider for risk preference
 * - Multiple hedge strategies (lock profit, balance exposure, middle ground)
 * - Visual breakdown of profit scenarios
 * 
 * Formula:
 * For each outcome, the hedge stake is calculated based on the desired profit distribution.
 * The slider controls how much profit is allocated to the original vs hedge outcomes.
 */

import React, { useState, useMemo } from 'react';
import { Scale, Info, X, Plus, Trash2 } from './icons';

interface HedgeOutcome {
  id: string;
  name: string;
  odds: number;
  hedgeStake: number;
}

interface FuturesPosition {
  key: string;
  entity: string;
  futuresType: string;
  sport: string;
  totalStake: number;
  totalPotentialPayout: number;
  averageOdds: number;
  maxProfit: number;
}

interface MultiHedgeCalculatorProps {
  position: FuturesPosition;
  onClose: () => void;
}

/**
 * Convert American odds to decimal multiplier.
 */
function americanToDecimal(odds: number): number {
  if (odds > 0) return 1 + (odds / 100);
  if (odds < 0) return 1 + (100 / Math.abs(odds));
  return 1;
}

/**
 * Format American odds for display.
 */
function formatOdds(odds: number): string {
  if (!odds) return '';
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

/**
 * Format currency with proper negative handling.
 * Negative amounts are displayed as "-$50.00"
 */
function formatCurrency(amount: number): string {
  if (amount < 0) {
    return `-$${Math.abs(amount).toFixed(2)}`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Generate unique outcome ID using crypto.randomUUID.
 */
function generateOutcomeId(): string {
  return `outcome-${crypto.randomUUID()}`;
}

const MultiHedgeCalculator: React.FC<MultiHedgeCalculatorProps> = ({
  position,
  onClose,
}) => {
  // Hedge balance: 0 = maximize original win profit, 100 = equal profit all outcomes
  const [balanceSlider, setBalanceSlider] = useState(50);
  
  // Hedge outcomes
  const [outcomes, setOutcomes] = useState<HedgeOutcome[]>([
    { id: generateOutcomeId(), name: 'Hedge Option 1', odds: -110, hedgeStake: 0 },
  ]);
  
  // Add new outcome
  const addOutcome = () => {
    setOutcomes([
      ...outcomes,
      { id: generateOutcomeId(), name: `Hedge Option ${outcomes.length + 1}`, odds: -110, hedgeStake: 0 },
    ]);
  };
  
  // Remove outcome
  const removeOutcome = (id: string) => {
    setOutcomes(outcomes.filter(o => o.id !== id));
  };
  
  // Update outcome
  const updateOutcome = (id: string, field: 'name' | 'odds', value: string | number) => {
    setOutcomes(outcomes.map(o => 
      o.id === id ? { ...o, [field]: value } : o
    ));
  };
  
  // Calculate hedge amounts and scenarios
  const hedgeResults = useMemo(() => {
    const originalStake = position.totalStake;
    const originalPayout = position.totalPotentialPayout;
    const originalProfit = originalPayout - originalStake;
    
    // Filter valid outcomes (with valid odds)
    const validOutcomes = outcomes.filter(o => o.odds !== 0 && !isNaN(o.odds));
    
    if (validOutcomes.length === 0) {
      return null;
    }
    
    // Calculate hedge stakes based on balance slider
    // Balance = 0: No hedging (keep all potential profit on original)
    // Balance = 50: Equal guaranteed profit regardless of outcome
    // Balance = 100: Maximum hedging (minimize variance)
    
    const balanceFactor = balanceSlider / 100;
    
    // Target profit when original wins (decreases as balance increases)
    const targetOriginalWinProfit = originalProfit * (1 - balanceFactor);
    
    // Calculate hedge stakes
    const calculatedOutcomes = validOutcomes.map(outcome => {
      const hedgeMultiplier = americanToDecimal(outcome.odds);
      
      // When balance = 50, we want equal profit for all outcomes
      // hedgeStake * hedgeMultiplier - hedgeStake - originalStake = targetProfit
      // hedgeStake * (hedgeMultiplier - 1) = targetProfit + originalStake
      
      // For equal profit: targetProfit for hedge win should equal targetProfit for original win
      // We distribute the potential based on balance
      
      // Total possible value to distribute: originalPayout
      // We want: originalWinProfit + sum(hedgeStakes) = total hedge cost
      
      // Simple formula: hedge stake to guarantee profit
      // If original wins: profit = originalPayout - originalStake - totalHedgeStakes
      // If hedge wins: profit = hedgeStake * hedgeMultiplier - hedgeStake - originalStake - otherHedgeStakes
      
      // For single hedge outcome, using classic formula with balance adjustment:
      const fullHedgeStake = originalPayout / hedgeMultiplier;
      const adjustedHedgeStake = fullHedgeStake * balanceFactor;
      
      return {
        ...outcome,
        hedgeStake: adjustedHedgeStake,
        hedgeMultiplier,
        hedgePayout: adjustedHedgeStake * hedgeMultiplier,
      };
    });
    
    // Calculate total hedge cost
    const totalHedgeCost = calculatedOutcomes.reduce((sum, o) => sum + o.hedgeStake, 0);
    
    // Calculate profit scenarios
    const scenarios = [
      {
        name: `${position.entity} wins (Original)`,
        profit: originalPayout - originalStake - totalHedgeCost,
        isOriginal: true,
      },
      ...calculatedOutcomes.map(outcome => ({
        name: outcome.name,
        profit: outcome.hedgePayout - outcome.hedgeStake - originalStake - 
          calculatedOutcomes.filter(o => o.id !== outcome.id).reduce((sum, o) => sum + o.hedgeStake, 0),
        isOriginal: false,
      })),
    ];
    
    // Guaranteed profit = minimum of all scenarios
    const guaranteedProfit = Math.min(...scenarios.map(s => s.profit));
    
    // Recommendation
    let recommendation: 'strong' | 'moderate' | 'not_recommended';
    let recommendationText: string;
    
    if (guaranteedProfit > 0.5 * originalStake) {
      recommendation = 'strong';
      recommendationText = '✅ Strong hedge opportunity - lock in 50%+ ROI';
    } else if (guaranteedProfit > 0) {
      recommendation = 'moderate';
      recommendationText = '⚖️ Moderate hedge opportunity - consider your risk tolerance';
    } else {
      recommendation = 'not_recommended';
      recommendationText = '❌ Hedging not recommended at current odds - would result in guaranteed loss';
    }
    
    return {
      calculatedOutcomes,
      totalHedgeCost,
      scenarios,
      guaranteedProfit,
      recommendation,
      recommendationText,
      originalStake,
      originalPayout,
      originalProfit,
    };
  }, [position, outcomes, balanceSlider]);
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-primary-500" />
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Hedge Calculator
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {position.entity} • {position.futuresType}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Original Position Info */}
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-3">
              Your Position
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Stake</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(position.totalStake)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Avg Odds</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatOdds(position.averageOdds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Potential</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(position.totalPotentialPayout)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Max Profit</p>
                <p className="text-lg font-bold text-accent-500">
                  {formatCurrency(position.maxProfit)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Hedge Outcomes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Hedge Against
              </h3>
              <button
                onClick={addOutcome}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Outcome
              </button>
            </div>
            
            <div className="space-y-3">
              {outcomes.map((outcome, index) => (
                <div 
                  key={outcome.id}
                  className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg"
                >
                  <div className="flex-1">
                    <input
                      type="text"
                      value={outcome.name}
                      onChange={(e) => updateOutcome(outcome.id, 'name', e.target.value)}
                      placeholder="Outcome name"
                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
                      Odds
                    </label>
                    <input
                      type="number"
                      value={outcome.odds}
                      onChange={(e) => updateOutcome(outcome.id, 'odds', parseFloat(e.target.value) || 0)}
                      placeholder="-110"
                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                  </div>
                  {outcomes.length > 1 && (
                    <button
                      onClick={() => removeOutcome(outcome.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Balance Slider */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Hedge Balance
              </h3>
              <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400">
                {balanceSlider}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={balanceSlider}
              onChange={(e) => setBalanceSlider(parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              <span>No hedge (max original profit)</span>
              <span>Full hedge (equal profit)</span>
            </div>
          </div>
          
          {/* Results */}
          {hedgeResults && (
            <div className="space-y-4">
              {/* Hedge Stakes Required */}
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-3">
                  Recommended Hedge Stakes
                </h3>
                <div className="space-y-2">
                  {hedgeResults.calculatedOutcomes.map(outcome => (
                    <div key={outcome.id} className="flex items-center justify-between">
                      <span className="text-sm text-primary-600 dark:text-primary-400">
                        {outcome.name} ({formatOdds(outcome.odds)})
                      </span>
                      <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                        {formatCurrency(outcome.hedgeStake)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-primary-200 dark:border-primary-800 flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                      Total Hedge Cost
                    </span>
                    <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                      {formatCurrency(hedgeResults.totalHedgeCost)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Profit Scenarios */}
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Profit Scenarios
                </h3>
                <div className="space-y-2">
                  {hedgeResults.scenarios.map((scenario, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        scenario.isOriginal 
                          ? 'bg-amber-50 dark:bg-amber-900/20' 
                          : 'bg-white dark:bg-neutral-900'
                      }`}
                    >
                      <span className={`text-sm ${
                        scenario.isOriginal 
                          ? 'text-amber-700 dark:text-amber-400 font-medium' 
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {scenario.name}
                      </span>
                      <span className={`text-lg font-bold ${
                        scenario.profit >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {scenario.profit >= 0 ? '+' : ''}{formatCurrency(scenario.profit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Guaranteed Profit */}
              <div className={`rounded-lg p-4 ${
                hedgeResults.guaranteedProfit >= 0 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      hedgeResults.guaranteedProfit >= 0 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      Guaranteed Profit (Worst Case)
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Minimum profit regardless of outcome
                    </p>
                  </div>
                  <p className={`text-2xl font-bold ${
                    hedgeResults.guaranteedProfit >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {hedgeResults.guaranteedProfit >= 0 ? '+' : ''}{formatCurrency(hedgeResults.guaranteedProfit)}
                  </p>
                </div>
              </div>
              
              {/* Recommendation */}
              <div className={`rounded-lg p-4 ${
                hedgeResults.recommendation === 'strong'
                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : hedgeResults.recommendation === 'moderate'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800'
                  : 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
              }`}>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {hedgeResults.recommendationText}
                </p>
              </div>
              
              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Quick presets:</span>
                <button
                  onClick={() => setBalanceSlider(0)}
                  className="px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  No Hedge
                </button>
                <button
                  onClick={() => setBalanceSlider(25)}
                  className="px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Light
                </button>
                <button
                  onClick={() => setBalanceSlider(50)}
                  className="px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Balanced
                </button>
                <button
                  onClick={() => setBalanceSlider(75)}
                  className="px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Heavy
                </button>
                <button
                  onClick={() => setBalanceSlider(100)}
                  className="px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Full Lock
                </button>
              </div>
            </div>
          )}
          
          {!hedgeResults && (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              <Info className="w-12 h-12 mx-auto text-neutral-400 dark:text-neutral-600 mb-3" />
              <p>Enter valid hedge odds to calculate your optimal position</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiHedgeCalculator;

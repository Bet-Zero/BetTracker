/**
 * Hedge Calculator Component
 * 
 * Calculates how much to bet on the opposite side to guarantee profit.
 * 
 * Inputs:
 * - originalStake: Amount bet on original position
 * - originalOdds: American odds (e.g., +150 or -110)
 * - potentialPayout: What you'd win if original bet hits
 * - currentOdds: American odds for hedge bet (user input)
 * 
 * Formula:
 * hedgeStake = potentialPayout / hedgeMultiplier
 * 
 * Recommendations based on guaranteed profit vs original stake.
 */

import React, { useState, useMemo } from 'react';

interface HedgeCalculatorProps {
  originalStake: number;
  originalOdds: number;
  potentialPayout: number;
  onClose: () => void;
}

interface HedgeResult {
  hedgeStake: number;
  originalWinProfit: number;
  hedgeWinProfit: number;
  guaranteedProfit: number;
  recommendation: 'strong' | 'moderate' | 'not_recommended';
  recommendationText: string;
}

/**
 * Convert American odds to decimal multiplier.
 * 
 * If odds > 0 (e.g., +150): multiplier = 1 + (odds / 100)
 *   Example: +150 -> 1 + 1.5 = 2.5
 * 
 * If odds < 0 (e.g., -110): multiplier = 1 + (100 / abs(odds))
 *   Example: -110 -> 1 + (100/110) = 1.909
 */
function americanToDecimalMultiplier(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + (americanOdds / 100);
  } else if (americanOdds < 0) {
    return 1 + (100 / Math.abs(americanOdds));
  }
  return 1; // Even odds (shouldn't happen but safe default)
}

/**
 * Format American odds for display.
 */
function formatAmericanOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

const HedgeCalculator: React.FC<HedgeCalculatorProps> = ({
  originalStake,
  originalOdds,
  potentialPayout,
  onClose,
}) => {
  const [currentOddsInput, setCurrentOddsInput] = useState<string>('');

  const hedgeResult = useMemo<HedgeResult | null>(() => {
    const currentOdds = parseFloat(currentOddsInput);
    
    if (isNaN(currentOdds) || currentOdds === 0) {
      return null;
    }

    // Convert hedge odds to decimal multiplier
    const hedgeMultiplier = americanToDecimalMultiplier(currentOdds);
    
    // Hedge stake formula
    const hedgeStake = potentialPayout / hedgeMultiplier;
    
    // Profit scenarios
    // Original bet wins: potentialPayout - originalStake - hedgeStake
    const originalWinProfit = potentialPayout - originalStake - hedgeStake;
    
    // Hedge bet wins: (hedgeStake * hedgeMultiplier) - hedgeStake - originalStake
    const hedgeWinProfit = (hedgeStake * hedgeMultiplier) - hedgeStake - originalStake;
    
    // Guaranteed profit = minimum of both scenarios
    const guaranteedProfit = Math.min(originalWinProfit, hedgeWinProfit);
    
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
      recommendationText = '❌ Hedging not recommended - would result in guaranteed loss';
    }
    
    return {
      hedgeStake,
      originalWinProfit,
      hedgeWinProfit,
      guaranteedProfit,
      recommendation,
      recommendationText,
    };
  }, [currentOddsInput, originalStake, potentialPayout]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            🔄 Hedge Calculator
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Original Bet Info */}
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-2">
            Original Position
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Stake</p>
              <p className="font-semibold text-neutral-900 dark:text-white">
                ${originalStake.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Odds</p>
              <p className="font-semibold text-neutral-900 dark:text-white">
                {formatAmericanOdds(originalOdds)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Potential</p>
              <p className="font-semibold text-accent-500">
                ${potentialPayout.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Hedge Odds Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Current Hedge Odds (American)
          </label>
          <input
            type="number"
            value={currentOddsInput}
            onChange={(e) => setCurrentOddsInput(e.target.value)}
            placeholder="e.g., -110 or +150"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Enter the odds for the opposite side of your bet
          </p>
        </div>

        {/* Results */}
        {hedgeResult && (
          <div className="space-y-4">
            {/* Hedge Stake Required */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
              <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                Hedge Stake Required
              </p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                ${hedgeResult.hedgeStake.toFixed(2)}
              </p>
            </div>

            {/* Guaranteed Profit */}
            <div className={`rounded-lg p-4 ${
              hedgeResult.guaranteedProfit > 0 
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <p className={`text-sm font-medium ${
                hedgeResult.guaranteedProfit > 0 
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                Guaranteed Profit
              </p>
              <p className={`text-2xl font-bold ${
                hedgeResult.guaranteedProfit > 0 
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                ${hedgeResult.guaranteedProfit.toFixed(2)}
              </p>
            </div>

            {/* Profit Scenarios */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  If original wins
                </p>
                <p className={`text-lg font-semibold ${
                  hedgeResult.originalWinProfit >= 0 
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  ${hedgeResult.originalWinProfit.toFixed(2)}
                </p>
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  If hedge wins
                </p>
                <p className={`text-lg font-semibold ${
                  hedgeResult.hedgeWinProfit >= 0 
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  ${hedgeResult.hedgeWinProfit.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Recommendation */}
            <div className={`rounded-lg p-4 ${
              hedgeResult.recommendation === 'strong'
                ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                : hedgeResult.recommendation === 'moderate'
                ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800'
                : 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
            }`}>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {hedgeResult.recommendationText}
              </p>
            </div>
          </div>
        )}

        {!hedgeResult && (
          <div className="text-center py-6 text-neutral-500 dark:text-neutral-400">
            <p>Enter hedge odds to calculate your optimal position</p>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HedgeCalculator;

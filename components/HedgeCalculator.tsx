/**
 * Hedge Calculator Component
 *
 * A comprehensive hedge calculator with multiple modes:
 * - Lock Profit: Calculate optimal hedge for equal guaranteed profit
 * - Target Profit: Specify desired guaranteed profit
 * - Custom Amount: Enter custom hedge amount to see results
 *
 * Features:
 * - ROI calculation
 * - Total investment breakdown
 * - Breakeven odds analysis
 * - Hedge vs No-Hedge comparison
 * - Interactive help guide
 */

import React, { useState, useMemo } from "react";
import { Scale, TrendingUp, Lock, X, ChevronDown, HelpCircle } from "./icons";

// ============================================================================
// Tooltip Component
// ============================================================================

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="cursor-help"
      >
        {children}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-neutral-800 dark:bg-neutral-700 rounded-lg shadow-lg whitespace-nowrap z-50 max-w-xs">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800 dark:border-t-neutral-700" />
        </span>
      )}
    </span>
  );
};

// ============================================================================
// Help Guide Content
// ============================================================================

const HelpGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h4 className="font-semibold text-blue-800 dark:text-blue-300">
          How Hedging Works
        </h4>
      </div>
      <button
        onClick={onClose}
        className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
      <div>
        <p className="font-medium">What is hedging?</p>
        <p className="text-blue-700 dark:text-blue-300">
          Hedging means placing a bet on the opposite outcome to lock in profit
          regardless of who wins. You sacrifice some potential upside for
          guaranteed returns.
        </p>
      </div>
      <div>
        <p className="font-medium">The Three Modes:</p>
        <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1 ml-2">
          <li>
            <strong>Lock Equal Profit</strong> – Calculates the optimal hedge so
            you make the same profit either way
          </li>
          <li>
            <strong>Target Profit</strong> – You choose how much guaranteed
            profit you want
          </li>
          <li>
            <strong>Custom Amount</strong> – Enter any hedge amount to see what
            happens
          </li>
        </ul>
      </div>
      <div>
        <p className="font-medium">Key Terms:</p>
        <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1 ml-2">
          <li>
            <strong>Guaranteed Profit</strong> – The minimum you&apos;ll make no
            matter who wins
          </li>
          <li>
            <strong>ROI</strong> – Return on Investment (profit ÷ total money at
            risk)
          </li>
          <li>
            <strong>Breakeven Odds</strong> – The worst hedge odds where you
            still profit
          </li>
        </ul>
      </div>
      <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          💡 Tip: Better hedge odds mean more guaranteed profit. Shop around for
          the best line!
        </p>
      </div>
    </div>
  </div>
);

// ============================================================================
// Types
// ============================================================================

interface HedgeCalculatorProps {
  originalStake: number;
  originalOdds: number;
  potentialPayout: number;
  onClose: () => void;
  /** Optional label for the position being hedged */
  positionLabel?: string;
}

type HedgeMode = "lock" | "target" | "custom";

interface HedgeAnalysis {
  hedgeStake: number;
  totalInvestment: number;
  originalWinProfit: number;
  hedgeWinProfit: number;
  guaranteedProfit: number;
  roi: number;
  hedgeOdds: number;
  isValid: boolean;
  validationMessage?: string;
}

interface BreakevenInfo {
  minOddsAmerican: number;
  minOddsDecimal: number;
  canHedge: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert American odds to decimal multiplier.
 * +150 -> 2.5 (win $150 on $100 bet, return $250)
 * -110 -> 1.909 (win $90.91 on $100 bet, return $190.91)
 */
function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  } else if (americanOdds < 0) {
    return 1 + 100 / Math.abs(americanOdds);
  }
  return 1;
}

/**
 * Convert decimal multiplier to American odds.
 */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else if (decimal > 1) {
    return Math.round(-100 / (decimal - 1));
  }
  return 0;
}

/**
 * Format American odds for display.
 */
function formatOdds(odds: number): string {
  if (!odds || isNaN(odds)) return "—";
  if (odds > 0) return `+${Math.round(odds)}`;
  return Math.round(odds).toString();
}

/**
 * Format currency consistently.
 */
function formatCurrency(amount: number, showSign = false): string {
  if (isNaN(amount)) return "$0.00";
  const absAmount = Math.abs(amount).toFixed(2);
  if (amount < 0) {
    return `-$${absAmount}`;
  }
  return showSign && amount > 0 ? `+$${absAmount}` : `$${absAmount}`;
}

/**
 * Format percentage.
 */
function formatPercent(value: number, showSign = false): string {
  if (isNaN(value)) return "0%";
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  if (value < 0) return `-${formatted}`;
  return showSign && value > 0 ? `+${formatted}` : formatted;
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate the optimal hedge stake for equal profit in both scenarios.
 *
 * Math:
 * - If original wins: profit = payout - stake - hedgeStake
 * - If hedge wins: profit = hedgeStake * multiplier - stake - hedgeStake
 *
 * For equal profit: payout - hedgeStake = hedgeStake * multiplier - hedgeStake
 * Solving: hedgeStake = payout / multiplier
 */
function calculateLockProfitHedge(
  originalStake: number,
  potentialPayout: number,
  hedgeOdds: number,
): HedgeAnalysis {
  const hedgeMultiplier = americanToDecimal(hedgeOdds);

  // Validation
  if (hedgeMultiplier <= 1) {
    return {
      hedgeStake: 0,
      totalInvestment: originalStake,
      originalWinProfit: potentialPayout - originalStake,
      hedgeWinProfit: -originalStake,
      guaranteedProfit: -originalStake,
      roi: -100,
      hedgeOdds,
      isValid: false,
      validationMessage: "Invalid hedge odds (must be positive)",
    };
  }

  // Optimal hedge for equal profit
  const hedgeStake = potentialPayout / hedgeMultiplier;
  const totalInvestment = originalStake + hedgeStake;

  // Calculate profit scenarios
  const originalWinProfit = potentialPayout - originalStake - hedgeStake;
  const hedgeWinProfit =
    hedgeStake * hedgeMultiplier - originalStake - hedgeStake;
  const guaranteedProfit = Math.min(originalWinProfit, hedgeWinProfit);

  // ROI based on total investment
  const roi = (guaranteedProfit / totalInvestment) * 100;

  return {
    hedgeStake,
    totalInvestment,
    originalWinProfit,
    hedgeWinProfit,
    guaranteedProfit,
    roi,
    hedgeOdds,
    isValid: true,
  };
}

/**
 * Calculate hedge stake needed for a specific target profit.
 *
 * For target profit T:
 * - Original wins: payout - stake - hedgeStake = T
 * - hedgeStake = payout - stake - T
 *
 * We also need to verify the hedge side achieves at least T.
 */
function calculateTargetProfitHedge(
  originalStake: number,
  potentialPayout: number,
  hedgeOdds: number,
  targetProfit: number,
): HedgeAnalysis {
  const hedgeMultiplier = americanToDecimal(hedgeOdds);

  // Calculate max possible guaranteed profit (at optimal lock)
  const optimalAnalysis = calculateLockProfitHedge(
    originalStake,
    potentialPayout,
    hedgeOdds,
  );
  const maxGuaranteedProfit = optimalAnalysis.guaranteedProfit;

  // Validation
  if (hedgeMultiplier <= 1) {
    return {
      hedgeStake: 0,
      totalInvestment: originalStake,
      originalWinProfit: potentialPayout - originalStake,
      hedgeWinProfit: -originalStake,
      guaranteedProfit: -originalStake,
      roi: -100,
      hedgeOdds,
      isValid: false,
      validationMessage: "Invalid hedge odds",
    };
  }

  if (targetProfit > maxGuaranteedProfit) {
    return {
      ...optimalAnalysis,
      isValid: false,
      validationMessage: `Target profit exceeds maximum achievable (${formatCurrency(maxGuaranteedProfit)})`,
    };
  }

  // Calculate hedge stake for target profit when original wins
  // payout - stake - hedgeStake = target
  const hedgeStakeForOriginalWin =
    potentialPayout - originalStake - targetProfit;

  // Verify hedge side profit meets target
  // hedgeStake * multiplier - stake - hedgeStake >= target
  const hedgeWinProfit =
    hedgeStakeForOriginalWin * hedgeMultiplier -
    originalStake -
    hedgeStakeForOriginalWin;

  // Use the calculated hedge stake
  const hedgeStake = Math.max(0, hedgeStakeForOriginalWin);
  const totalInvestment = originalStake + hedgeStake;
  const originalWinProfit = potentialPayout - originalStake - hedgeStake;
  const guaranteedProfit = Math.min(originalWinProfit, hedgeWinProfit);
  const roi = (guaranteedProfit / totalInvestment) * 100;

  return {
    hedgeStake,
    totalInvestment,
    originalWinProfit,
    hedgeWinProfit,
    guaranteedProfit,
    roi,
    hedgeOdds,
    isValid: hedgeStake >= 0,
    validationMessage:
      hedgeStake < 0
        ? "Target profit requires negative hedge (not possible)"
        : undefined,
  };
}

/**
 * Calculate results for a custom hedge amount.
 */
function calculateCustomHedge(
  originalStake: number,
  potentialPayout: number,
  hedgeOdds: number,
  customHedgeStake: number,
): HedgeAnalysis {
  const hedgeMultiplier = americanToDecimal(hedgeOdds);
  const hedgeStake = Math.max(0, customHedgeStake);
  const totalInvestment = originalStake + hedgeStake;

  const originalWinProfit = potentialPayout - originalStake - hedgeStake;
  const hedgeWinProfit =
    hedgeStake * hedgeMultiplier - originalStake - hedgeStake;
  const guaranteedProfit = Math.min(originalWinProfit, hedgeWinProfit);
  const roi = (guaranteedProfit / totalInvestment) * 100;

  return {
    hedgeStake,
    totalInvestment,
    originalWinProfit,
    hedgeWinProfit,
    guaranteedProfit,
    roi,
    hedgeOdds,
    isValid: hedgeMultiplier > 1,
    validationMessage: hedgeMultiplier <= 1 ? "Invalid hedge odds" : undefined,
  };
}

/**
 * Calculate the minimum hedge odds needed for profitable hedging.
 *
 * For hedging to be profitable, guaranteed profit > 0:
 * At optimal hedge (hedgeStake = payout / multiplier):
 * guaranteedProfit = payout - stake - payout/multiplier > 0
 * payout * (1 - 1/multiplier) > stake
 * payout * (multiplier - 1) / multiplier > stake
 * multiplier > payout / (payout - stake)
 */
function calculateBreakevenOdds(
  originalStake: number,
  potentialPayout: number,
): BreakevenInfo {
  const maxProfit = potentialPayout - originalStake;

  if (maxProfit <= 0) {
    return {
      minOddsAmerican: Infinity,
      minOddsDecimal: Infinity,
      canHedge: false,
    };
  }

  const minMultiplier = potentialPayout / maxProfit;
  const minOddsAmerican = decimalToAmerican(minMultiplier);

  return {
    minOddsAmerican,
    minOddsDecimal: minMultiplier,
    canHedge: true,
  };
}

// ============================================================================
// Component
// ============================================================================

const HedgeCalculator: React.FC<HedgeCalculatorProps> = ({
  originalStake,
  originalOdds,
  potentialPayout,
  onClose,
  positionLabel,
}) => {
  // State
  const [mode, setMode] = useState<HedgeMode>("lock");
  const [hedgeOddsInput, setHedgeOddsInput] = useState<string>("");
  const [targetProfitInput, setTargetProfitInput] = useState<string>("");
  const [customHedgeInput, setCustomHedgeInput] = useState<string>("");
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Derived values
  const hedgeOdds = parseFloat(hedgeOddsInput) || 0;
  const targetProfit = parseFloat(targetProfitInput) || 0;
  const customHedge = parseFloat(customHedgeInput) || 0;

  // Max profit if no hedge
  const maxProfitNoHedge = potentialPayout - originalStake;

  // Breakeven analysis
  const breakevenInfo = useMemo(
    () => calculateBreakevenOdds(originalStake, potentialPayout),
    [originalStake, potentialPayout],
  );

  // Main hedge calculation based on mode
  const analysis = useMemo<HedgeAnalysis | null>(() => {
    if (!hedgeOdds || hedgeOdds === 0) return null;

    switch (mode) {
      case "lock":
        return calculateLockProfitHedge(
          originalStake,
          potentialPayout,
          hedgeOdds,
        );
      case "target":
        return calculateTargetProfitHedge(
          originalStake,
          potentialPayout,
          hedgeOdds,
          targetProfit,
        );
      case "custom":
        return calculateCustomHedge(
          originalStake,
          potentialPayout,
          hedgeOdds,
          customHedge,
        );
      default:
        return null;
    }
  }, [
    mode,
    originalStake,
    potentialPayout,
    hedgeOdds,
    targetProfit,
    customHedge,
  ]);

  // Optimal analysis for comparison
  const optimalAnalysis = useMemo(() => {
    if (!hedgeOdds || hedgeOdds === 0) return null;
    return calculateLockProfitHedge(originalStake, potentialPayout, hedgeOdds);
  }, [originalStake, potentialPayout, hedgeOdds]);

  // Recommendation
  const recommendation = useMemo(() => {
    if (!analysis || !analysis.isValid) return null;

    const { guaranteedProfit, roi } = analysis;

    if (guaranteedProfit > 0.5 * originalStake) {
      return {
        type: "strong" as const,
        icon: "🎯",
        text: "Strong hedge opportunity",
        detail: `Lock in ${formatPercent(roi)} ROI on your total investment`,
        color: "green",
      };
    } else if (guaranteedProfit > 0.2 * originalStake) {
      return {
        type: "good" as const,
        icon: "✅",
        text: "Good hedge opportunity",
        detail: `Secure ${formatCurrency(guaranteedProfit)} profit regardless of outcome`,
        color: "green",
      };
    } else if (guaranteedProfit > 0) {
      return {
        type: "moderate" as const,
        icon: "⚖️",
        text: "Moderate hedge opportunity",
        detail: "Small guaranteed profit - consider your risk tolerance",
        color: "yellow",
      };
    } else {
      return {
        type: "avoid" as const,
        icon: "⚠️",
        text: "Hedging not recommended",
        detail: "Current odds result in guaranteed loss",
        color: "red",
      };
    }
  }, [analysis, originalStake]);

  // Mode descriptions
  const modeInfo = {
    lock: {
      title: "Lock Equal Profit",
      description: "Calculate optimal hedge for identical profit either way",
      icon: Lock,
    },
    target: {
      title: "Target Profit",
      description: "Specify your desired guaranteed profit amount",
      icon: TrendingUp,
    },
    custom: {
      title: "Custom Amount",
      description: "Enter any hedge amount to see the results",
      icon: Scale,
    },
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Scale className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Hedge Calculator
                </h2>
                {positionLabel && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {positionLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`p-2 transition-colors rounded-lg ${
                  showHelp
                    ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
                title="How it works"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Help Guide */}
          {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}
          {/* Original Position */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
              Your Position
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Stake
                </p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(originalStake)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Odds
                </p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatOdds(originalOdds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Potential Return
                </p>
                <p className="text-lg font-bold text-accent-500">
                  {formatCurrency(potentialPayout)}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                Max profit (no hedge)
              </span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(maxProfitNoHedge, true)}
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
              Mode
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(modeInfo) as HedgeMode[]).map((m) => {
                const info = modeInfo[m];
                const Icon = info.icon;
                const isActive = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isActive
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mb-1 ${
                        isActive
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-neutral-400"
                      }`}
                    />
                    <p
                      className={`text-xs font-medium ${
                        isActive
                          ? "text-primary-700 dark:text-primary-300"
                          : "text-neutral-600 dark:text-neutral-400"
                      }`}
                    >
                      {info.title}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              {modeInfo[mode].description}
            </p>
          </div>

          {/* Hedge Odds Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Hedge Odds (American)
            </label>
            <input
              type="number"
              value={hedgeOddsInput}
              onChange={(e) => setHedgeOddsInput(e.target.value)}
              placeholder="e.g., -110 or +150"
              className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {breakevenInfo.canHedge && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                Minimum for profit: {formatOdds(breakevenInfo.minOddsAmerican)}{" "}
                or better
              </p>
            )}
          </div>

          {/* Mode-specific inputs */}
          {mode === "target" && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Target Profit
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  $
                </span>
                <input
                  type="number"
                  value={targetProfitInput}
                  onChange={(e) => setTargetProfitInput(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              {optimalAnalysis && optimalAnalysis.isValid && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                  Max achievable:{" "}
                  {formatCurrency(optimalAnalysis.guaranteedProfit)}
                </p>
              )}
            </div>
          )}

          {mode === "custom" && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Hedge Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  $
                </span>
                <input
                  type="number"
                  value={customHedgeInput}
                  onChange={(e) => setCustomHedgeInput(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              {optimalAnalysis && optimalAnalysis.isValid && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                  Optimal hedge: {formatCurrency(optimalAnalysis.hedgeStake)}
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {analysis && analysis.isValid ? (
            <div className="space-y-4">
              {/* Primary Result */}
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                    {mode === "custom" ? "Hedge Amount" : "Recommended Hedge"}
                  </p>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(analysis.hedgeStake)}
                    </p>
                    <p className="text-xs text-primary-500 dark:text-primary-400">
                      @ {formatOdds(analysis.hedgeOdds)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guaranteed Profit */}
              <div
                className={`rounded-lg p-4 ${
                  analysis.guaranteedProfit >= 0
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`text-sm font-medium flex items-center gap-1 ${
                        analysis.guaranteedProfit >= 0
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      Guaranteed Profit
                      <Tooltip content="The minimum profit you'll make no matter which side wins">
                        <HelpCircle className="w-3.5 h-3.5 opacity-60" />
                      </Tooltip>
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Locked in regardless of outcome
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-2xl font-bold ${
                        analysis.guaranteedProfit >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatCurrency(analysis.guaranteedProfit, true)}
                    </p>
                    <p
                      className={`text-xs font-medium flex items-center justify-end gap-1 ${
                        analysis.roi >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatPercent(analysis.roi, true)} ROI
                      <Tooltip content="Return on Investment: profit ÷ total money at risk">
                        <HelpCircle className="w-3 h-3 opacity-60" />
                      </Tooltip>
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div>
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors w-full"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
                  />
                  Detailed Breakdown
                </button>

                {showBreakdown && (
                  <div className="mt-3 space-y-3">
                    {/* Investment Summary */}
                    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">
                        Total Investment
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-600 dark:text-neutral-400">
                            Original stake
                          </span>
                          <span className="text-neutral-900 dark:text-white">
                            {formatCurrency(originalStake)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600 dark:text-neutral-400">
                            Hedge stake
                          </span>
                          <span className="text-neutral-900 dark:text-white">
                            {formatCurrency(analysis.hedgeStake)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-neutral-200 dark:border-neutral-700 font-semibold">
                          <span className="text-neutral-700 dark:text-neutral-300">
                            Total at risk
                          </span>
                          <span className="text-neutral-900 dark:text-white">
                            {formatCurrency(analysis.totalInvestment)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Outcome Scenarios */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                          If Original Wins
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            analysis.originalWinProfit >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatCurrency(analysis.originalWinProfit, true)}
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                          If Hedge Wins
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            analysis.hedgeWinProfit >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatCurrency(analysis.hedgeWinProfit, true)}
                        </p>
                      </div>
                    </div>

                    {/* Comparison */}
                    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">
                        Hedge vs No Hedge
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600 dark:text-neutral-400">
                            No hedge (if wins)
                          </span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {formatCurrency(maxProfitNoHedge, true)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600 dark:text-neutral-400">
                            No hedge (if loses)
                          </span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {formatCurrency(-originalStake, true)}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                              With hedge (guaranteed)
                            </span>
                            <span
                              className={`font-bold ${
                                analysis.guaranteedProfit >= 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {formatCurrency(analysis.guaranteedProfit, true)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendation */}
              {recommendation && (
                <div
                  className={`rounded-lg p-4 ${
                    recommendation.color === "green"
                      ? "bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
                      : recommendation.color === "yellow"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800"
                        : "bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{recommendation.icon}</span>
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-white">
                        {recommendation.text}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {recommendation.detail}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : analysis && !analysis.isValid ? (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                ⚠️ {analysis.validationMessage}
              </p>
            </div>
          ) : hedgeOddsInput ? (
            <div className="text-center py-6 text-neutral-500 dark:text-neutral-400">
              <p>Invalid odds entered</p>
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-500 dark:text-neutral-400">
              <Scale className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
              <p>Enter hedge odds to calculate</p>
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

export default HedgeCalculator;

/**
 * Multi-Outcome Hedge Calculator
 *
 * Advanced hedge calculator for futures positions supporting:
 * - Single hedge (against the field)
 * - Multiple specific hedges (e.g., against top 2-3 contenders)
 * - Tiered profit targets (different profit goals per outcome)
 * - Clear profit scenario breakdown
 *
 * Key insight: With multiple hedge outcomes, you can ONLY guarantee profit
 * if one of your hedged outcomes wins. Hedging against multiple outcomes
 * locks profit ONLY when one of those specific outcomes occurs.
 */

import React, { useState, useMemo } from "react";
import {
  Scale,
  X,
  Plus,
  Trash2,
  TrendingDown,
  ChevronDown,
  Lock,
  AlertTriangle,
  HelpCircle,
} from "./icons";

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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-neutral-800 dark:bg-neutral-700 rounded-lg shadow-lg whitespace-normal z-50 max-w-[200px] text-center">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800 dark:border-t-neutral-700" />
        </span>
      )}
    </span>
  );
};

// ============================================================================
// Help Guide Component
// ============================================================================

const MultiHedgeHelpGuide: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => (
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h4 className="font-semibold text-blue-800 dark:text-blue-300">
          Multi-Outcome Hedging Guide
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
        <p className="font-medium">When to use this?</p>
        <p className="text-blue-700 dark:text-blue-300">
          Your futures bet is in a strong position and you want protection
          against specific contenders — not just &quot;the field.&quot; You can
          hedge one or many outcomes at once.
        </p>
      </div>
      <div>
        <p className="font-medium">Strategies:</p>
        <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-2 ml-2">
          <li>
            <strong>Full Lock</strong> — Calculates stakes so you profit equally
            no matter which covered outcome wins. Best when you just want a
            guaranteed number.
          </li>
          <li>
            <strong>Tiered Targets</strong> — Set a different profit goal per
            hedge outcome using the slider (0–100%). Each percentage is relative
            to what your original pick would net after all hedge costs are
            accounted for.
            <ul className="mt-1 ml-3 space-y-0.5 text-xs text-blue-600 dark:text-blue-400">
              <li>
                100% = same profit as your original pick winning (Full Lock)
              </li>
              <li>50% = half that profit if this outcome wins</li>
              <li>0% = break even — just recover your total investment</li>
            </ul>
          </li>
        </ul>
      </div>
      <div>
        <p className="font-medium">How multiple hedges interact:</p>
        <p className="text-blue-700 dark:text-blue-300">
          Every hedge stake you add increases total investment, which is
          subtracted from all outcomes&apos; profits. The calculator solves all
          stakes simultaneously so the profit shown for each outcome is already
          net of every other hedge bet you placed.
        </p>
      </div>
      <div>
        <p className="font-medium">⚠️ The un-hedged risk:</p>
        <p className="text-blue-700 dark:text-blue-300">
          You&apos;re only protected if your original pick or one of your hedged
          outcomes wins. If something you didn&apos;t hedge wins, you lose your
          entire investment — original stake plus all hedge stakes.
        </p>
      </div>
      <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          💡 Tip: Use Tiered Targets to demand full profit on likely contenders
          and just break even on long shots — minimizing hedge cost while
          staying covered.
        </p>
      </div>
    </div>
  </div>
);

// ============================================================================
// Types
// ============================================================================

interface HedgeOutcome {
  id: string;
  name: string;
  odds: number;
  /** For tiered strategy: target profit as % of max original profit (0-100) */
  targetProfitPercent: number;
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

interface CalculatedOutcome extends HedgeOutcome {
  hedgeStake: number;
  multiplier: number;
  hedgePayout: number;
  targetProfit: number;
  actualProfit: number;
}

interface HedgeResults {
  calculatedOutcomes: CalculatedOutcome[];
  totalHedgeCost: number;
  scenarios: Array<{
    name: string;
    profit: number;
    isOriginal: boolean;
    isHedged: boolean;
  }>;
  guaranteedProfit: number;
  worstCaseProfit: number;
  bestCaseProfit: number;
  originalStake: number;
  originalPayout: number;
  originalProfit: number;
  totalInvestment: number;
  roi: number;
  recommendation: {
    type: "strong" | "good" | "moderate" | "caution" | "avoid";
    icon: string;
    text: string;
    detail: string;
    color: string;
  };
}

type HedgeStrategy = "lock" | "tiered";

// ============================================================================
// Utility Functions
// ============================================================================

function americanToDecimal(odds: number): number {
  if (odds > 0) return 1 + odds / 100;
  if (odds < 0) return 1 + 100 / Math.abs(odds);
  return 1;
}

function formatOdds(odds: number): string {
  if (!odds || isNaN(odds)) return "—";
  if (odds > 0) return `+${Math.round(odds)}`;
  return Math.round(odds).toString();
}

function formatCurrency(amount: number, showSign = false): string {
  if (isNaN(amount)) return "$0.00";
  const absAmount = Math.abs(amount).toFixed(2);
  if (amount < 0) return `-$${absAmount}`;
  return showSign && amount > 0 ? `+$${absAmount}` : `$${absAmount}`;
}

function formatPercent(value: number, showSign = false): string {
  if (isNaN(value)) return "0%";
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  if (value < 0) return `-${formatted}`;
  return showSign && value > 0 ? `+${formatted}` : formatted;
}

function generateId(): string {
  return `outcome-${crypto.randomUUID()}`;
}

/**
 * Calculate hedge stakes for tiered profit targets.
 *
 * Semantics:
 *   targetProfitPercent = 100 → when this hedge wins, profit equals Full Lock profit
 *   targetProfitPercent = 0   → when this hedge wins, profit = 0 (break even)
 *   targetProfitPercent = 50  → half of Full Lock profit
 *
 * In other words, 100% makes tiered identical to Full Lock — all covered outcomes
 * (including your original pick) yield the same profit.
 *
 * Closed-form derivation:
 *   Let p_i = targetProfitPercent[i] / 100
 *   When hedge i wins: hedgeStake_i × mult_i - totalInvestment = p_i × originalPickProfit
 *   Where originalPickProfit = originalPayout - totalInvestment (same variable on both sides)
 *
 *   Rearranging: hedgeStake_i = (p_i × P + (1 - p_i) × totalInvestment) / mult_i
 *   Summing all i and solving for C = totalHedgeCost:
 *     C = (A + S × B) / (1 - B)
 *     where A = Σ p_i × P / mult_i, B = Σ (1 - p_i) / mult_i
 */
function calculateTieredHedgeStakes(
  originalStake: number,
  originalPayout: number,
  outcomes: HedgeOutcome[],
): CalculatedOutcome[] {
  const ps = outcomes.map((o) => o.targetProfitPercent / 100);
  const multipliers = outcomes.map((o) => americanToDecimal(o.odds));

  const A = outcomes.reduce(
    (sum, _, i) => sum + (ps[i] * originalPayout) / multipliers[i],
    0,
  );
  const B = outcomes.reduce(
    (sum, _, i) => sum + (1 - ps[i]) / multipliers[i],
    0,
  );

  // Solve for total hedge cost
  const totalHedgeCost = B < 1 ? (A + originalStake * B) / (1 - B) : A;
  const totalInvestment = originalStake + totalHedgeCost;

  return outcomes.map((outcome, i) => {
    const hedgeStake = Math.max(
      0,
      (ps[i] * originalPayout + (1 - ps[i]) * totalInvestment) / multipliers[i],
    );
    const hedgePayout = hedgeStake * multipliers[i];
    const actualProfit = hedgePayout - totalInvestment;

    return {
      ...outcome,
      multiplier: multipliers[i],
      hedgeStake,
      hedgePayout,
      targetProfit: actualProfit,
      actualProfit,
    };
  });
}

// ============================================================================
// Component
// ============================================================================

const MultiHedgeCalculator: React.FC<MultiHedgeCalculatorProps> = ({
  position,
  onClose,
}) => {
  // State
  const [strategy, setStrategy] = useState<HedgeStrategy>("lock");
  const [outcomes, setOutcomes] = useState<HedgeOutcome[]>([
    {
      id: generateId(),
      name: "Field / Other",
      odds: -110,
      targetProfitPercent: 100,
    },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Original profit for reference
  const originalProfit = position.totalPotentialPayout - position.totalStake;

  // Outcome management
  const addOutcome = () => {
    // Default new outcomes to 50% target profit in tiered mode
    setOutcomes([
      ...outcomes,
      {
        id: generateId(),
        name: `Contender ${outcomes.length + 1}`,
        odds: -110,
        targetProfitPercent: 50,
      },
    ]);
  };

  const removeOutcome = (id: string) => {
    if (outcomes.length > 1) {
      setOutcomes(outcomes.filter((o) => o.id !== id));
    }
  };

  const updateOutcome = (
    id: string,
    field: "name" | "odds" | "targetProfitPercent",
    value: string | number,
  ) => {
    setOutcomes(
      outcomes.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    );
  };

  // Calculate hedge results
  const results = useMemo<HedgeResults | null>(() => {
    const originalStake = position.totalStake;
    const originalPayout = position.totalPotentialPayout;
    const originalProfit = originalPayout - originalStake;

    // Filter valid outcomes
    const validOutcomes = outcomes.filter(
      (o) => o.odds !== 0 && !isNaN(o.odds),
    );
    if (validOutcomes.length === 0) return null;

    let calculatedOutcomes: CalculatedOutcome[];

    if (strategy === "tiered") {
      // Use tiered calculation with individual target profits
      calculatedOutcomes = calculateTieredHedgeStakes(
        originalStake,
        originalPayout,
        validOutcomes,
      );
    } else {
      // Full lock strategy
      calculatedOutcomes = validOutcomes.map((outcome) => {
        const multiplier = americanToDecimal(outcome.odds);
        const hedgeStake = originalPayout / multiplier;
        const hedgePayout = hedgeStake * multiplier;

        return {
          ...outcome,
          hedgeStake,
          multiplier,
          hedgePayout,
          targetProfit: originalProfit,
          actualProfit: hedgePayout - originalStake - hedgeStake,
        };
      });
    }

    // Total hedge cost
    const totalHedgeCost = calculatedOutcomes.reduce(
      (sum, o) => sum + o.hedgeStake,
      0,
    );
    const totalInvestment = originalStake + totalHedgeCost;

    // Recalculate actual profits with total hedge cost
    calculatedOutcomes.forEach((outcome) => {
      outcome.actualProfit = outcome.hedgePayout - totalInvestment;
    });

    // Calculate profit scenarios
    const scenarios: HedgeResults["scenarios"] = [];

    // Scenario: Original wins (your pick wins)
    const originalWinsProfit = originalPayout - originalStake - totalHedgeCost;
    scenarios.push({
      name: `${position.entity} wins`,
      profit: originalWinsProfit,
      isOriginal: true,
      isHedged: false,
    });

    // Scenarios: Each hedge outcome wins
    calculatedOutcomes.forEach((outcome) => {
      scenarios.push({
        name: outcome.name,
        profit: outcome.actualProfit,
        isOriginal: false,
        isHedged: true,
      });
    });

    // Scenario: Nothing you hedged wins (total loss of hedges)
    const noneWinsProfit = -totalInvestment;
    if (calculatedOutcomes.length > 0) {
      scenarios.push({
        name: "Other outcome (not hedged)",
        profit: noneWinsProfit,
        isOriginal: false,
        isHedged: false,
      });
    }

    // Calculate key metrics
    const hedgedScenarioProfits = scenarios
      .filter((s) => s.isHedged)
      .map((s) => s.profit);
    const guaranteedProfit =
      hedgedScenarioProfits.length > 0
        ? Math.min(originalWinsProfit, ...hedgedScenarioProfits)
        : originalWinsProfit;

    const worstCaseProfit = Math.min(...scenarios.map((s) => s.profit));
    const bestCaseProfit = Math.max(...scenarios.map((s) => s.profit));

    // ROI based on worst case among hedged scenarios
    const roi = (guaranteedProfit / totalInvestment) * 100;

    // Generate recommendation
    let recommendation: HedgeResults["recommendation"];

    if (guaranteedProfit > 0.5 * originalStake) {
      recommendation = {
        type: "strong",
        icon: "🎯",
        text: "Strong hedge opportunity",
        detail: `Lock in ${formatPercent(roi)} ROI when your pick or hedge wins`,
        color: "green",
      };
    } else if (guaranteedProfit > 0.2 * originalStake) {
      recommendation = {
        type: "good",
        icon: "✅",
        text: "Good hedge opportunity",
        detail: `Secure ${formatCurrency(guaranteedProfit)} profit on covered outcomes`,
        color: "green",
      };
    } else if (guaranteedProfit > 0) {
      recommendation = {
        type: "moderate",
        icon: "⚖️",
        text: "Moderate opportunity",
        detail: "Small guaranteed profit on covered scenarios",
        color: "yellow",
      };
    } else if (originalWinsProfit > 0) {
      recommendation = {
        type: "caution",
        icon: "⚡",
        text: "Partial coverage only",
        detail: "Profit only if your pick wins; hedges reduce variance",
        color: "yellow",
      };
    } else {
      recommendation = {
        type: "avoid",
        icon: "⚠️",
        text: "Over-hedged",
        detail: "Current settings result in guaranteed loss",
        color: "red",
      };
    }

    return {
      calculatedOutcomes,
      totalHedgeCost,
      scenarios,
      guaranteedProfit,
      worstCaseProfit,
      bestCaseProfit,
      originalStake,
      originalPayout,
      originalProfit,
      totalInvestment,
      roi,
      recommendation,
    };
  }, [position, outcomes, strategy]);

  // Check if we have multiple outcomes (important for warnings)
  const hasMultipleHedges = outcomes.length > 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 rounded-t-xl shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Scale className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Multi-Outcome Hedge Calculator
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {position.entity} • {position.futuresType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`p-2 transition-colors rounded-lg ${
                  showHelp
                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
                title="Toggle help guide"
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

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Help Guide */}
          {showHelp && (
            <MultiHedgeHelpGuide onClose={() => setShowHelp(false)} />
          )}

          {/* Original Position */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
              Your Position
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Stake
                </p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(position.totalStake)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Avg Odds
                </p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatOdds(position.averageOdds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Potential
                </p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(position.totalPotentialPayout)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Max Profit
                </p>
                <p className="text-lg font-bold text-accent-500">
                  {formatCurrency(position.maxProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Strategy Selector */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
              Strategy
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStrategy("lock")}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  strategy === "lock"
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                }`}
              >
                <Lock
                  className={`w-4 h-4 mb-1 ${
                    strategy === "lock"
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-neutral-400"
                  }`}
                />
                <p
                  className={`text-xs font-medium ${
                    strategy === "lock"
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  Full Lock
                </p>
              </button>
              <button
                onClick={() => setStrategy("tiered")}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  strategy === "tiered"
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                }`}
              >
                <TrendingDown
                  className={`w-4 h-4 mb-1 ${
                    strategy === "tiered"
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-neutral-400"
                  }`}
                />
                <p
                  className={`text-xs font-medium ${
                    strategy === "tiered"
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  Tiered Targets
                </p>
              </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              {strategy === "lock" && (
                <>
                  <strong>Full Lock:</strong> Calculates stakes to guarantee
                  equal profit regardless of which hedged outcome wins.
                </>
              )}
              {strategy === "tiered" && (
                <>
                  <strong>Tiered:</strong> Set different profit targets per
                  outcome. 100% = full profit lock, 0% = just break even on that
                  outcome.
                </>
              )}
            </p>
          </div>

          {/* Hedge Outcomes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Hedge Against
              </h3>
              <button
                onClick={addOutcome}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {hasMultipleHedges && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-medium">
                      Multiple hedges reduce guaranteed profit
                    </p>
                    <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                      You&apos;re only protected if one of your hedged outcomes
                      wins. If an un-hedged outcome wins, you lose all hedge
                      stakes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={outcome.name}
                        onChange={(e) =>
                          updateOutcome(outcome.id, "name", e.target.value)
                        }
                        placeholder="Outcome name"
                        className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        value={outcome.odds || ""}
                        onChange={(e) =>
                          updateOutcome(
                            outcome.id,
                            "odds",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        placeholder="Odds"
                        className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  {strategy === "tiered" && (
                    <div className="mt-2 flex items-center gap-2 pl-1">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        Target profit:
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={outcome.targetProfitPercent}
                        onChange={(e) =>
                          updateOutcome(
                            outcome.id,
                            "targetProfitPercent",
                            parseInt(e.target.value),
                          )
                        }
                        className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                      />
                      <span
                        className={`text-xs font-mono font-medium w-10 text-right ${
                          outcome.targetProfitPercent === 100
                            ? "text-green-600 dark:text-green-400"
                            : outcome.targetProfitPercent === 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-primary-600 dark:text-primary-400"
                        }`}
                      >
                        {outcome.targetProfitPercent}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          {results ? (
            <div className="space-y-4">
              {/* Recommended Stakes */}
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-3">
                  Recommended Hedge Stakes
                </h3>
                <div className="space-y-2">
                  {results.calculatedOutcomes.map((outcome) => (
                    <div
                      key={outcome.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <span className="text-sm text-primary-600 dark:text-primary-400">
                          {outcome.name}
                        </span>
                        <span className="text-xs text-primary-500 dark:text-primary-400 ml-2">
                          @ {formatOdds(outcome.odds)}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                        {formatCurrency(outcome.hedgeStake)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-primary-200 dark:border-primary-800 flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                      Total Hedge Cost
                    </span>
                    <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                      {formatCurrency(results.totalHedgeCost)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-primary-600 dark:text-primary-400">
                    <span>Total Investment</span>
                    <span>{formatCurrency(results.totalInvestment)}</span>
                  </div>
                </div>
              </div>

              {/* Profit Scenarios */}
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Profit Scenarios
                </h3>
                <div className="space-y-2">
                  {results.scenarios.map((scenario, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2.5 rounded-lg ${
                        scenario.isOriginal
                          ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                          : scenario.isHedged
                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                            : "bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {scenario.isOriginal && (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded font-medium">
                            YOUR PICK
                          </span>
                        )}
                        {scenario.isHedged && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded font-medium">
                            HEDGED
                          </span>
                        )}
                        <span
                          className={`text-sm ${
                            scenario.isOriginal
                              ? "text-amber-700 dark:text-amber-400 font-medium"
                              : scenario.isHedged
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-neutral-500 dark:text-neutral-400"
                          }`}
                        >
                          {scenario.name}
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          scenario.profit >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(scenario.profit, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-lg p-4 ${
                    results.guaranteedProfit >= 0
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  }`}
                >
                  <Tooltip content="The minimum profit you'll make IF your original pick OR one of your hedged outcomes wins. Negative means you could still lose money.">
                    <p
                      className={`text-xs font-medium inline-flex items-center gap-1 cursor-help ${
                        results.guaranteedProfit >= 0
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      Guaranteed Profit*
                      <HelpCircle className="w-3 h-3 opacity-60" />
                    </p>
                  </Tooltip>
                  <p
                    className={`text-xl font-bold ${
                      results.guaranteedProfit >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(results.guaranteedProfit, true)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    *If your pick or hedge wins
                  </p>
                </div>
                <div className="rounded-lg p-4 bg-neutral-100 dark:bg-neutral-800">
                  <Tooltip content="Return On Investment — your guaranteed profit as a percentage of your total investment (original stake + all hedge stakes).">
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 inline-flex items-center gap-1 cursor-help">
                      ROI
                      <HelpCircle className="w-3 h-3 opacity-60" />
                    </p>
                  </Tooltip>
                  <p
                    className={`text-xl font-bold ${
                      results.roi >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatPercent(results.roi, true)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    On total investment
                  </p>
                </div>
              </div>

              {/* Recommendation */}
              <div
                className={`rounded-lg p-4 ${
                  results.recommendation.color === "green"
                    ? "bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
                    : results.recommendation.color === "yellow"
                      ? "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800"
                      : "bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{results.recommendation.icon}</span>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">
                      {results.recommendation.text}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {results.recommendation.detail}
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Details Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors w-full"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
                Advanced Details
              </button>

              {showAdvanced && (
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Original stake
                    </span>
                    <span className="text-neutral-900 dark:text-white">
                      {formatCurrency(results.originalStake)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Total hedge cost
                    </span>
                    <span className="text-neutral-900 dark:text-white">
                      {formatCurrency(results.totalHedgeCost)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-700 dark:text-neutral-300">
                      Total at risk
                    </span>
                    <span className="text-neutral-900 dark:text-white">
                      {formatCurrency(results.totalInvestment)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Best case profit
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      {formatCurrency(results.bestCaseProfit, true)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Worst case profit
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      {formatCurrency(results.worstCaseProfit, true)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Max profit (no hedge)
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      {formatCurrency(results.originalProfit, true)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              <Scale className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
              <p>Enter valid hedge odds to see calculations</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-4 shrink-0">
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

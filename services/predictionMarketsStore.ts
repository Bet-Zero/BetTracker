/**
 * Prediction Markets Storage Service
 * 
 * Manages localStorage for prediction market data.
 * Designed for future Firestore migration but currently localStorage-only.
 * 
 * PRIVACY & SECURITY NOTES:
 * - Only user-entered prediction market data is stored.
 * - No account identifiers, passwords, or sensitive PII are stored.
 * - All data is local to the browser; no backend transmission occurs.
 */

import {
  PredictionMarket,
  PredictionPosition,
  PredictionTrade,
  PredictionPositionMetrics,
} from '../types';

// Storage keys
export const PM_MARKETS_KEY = 'bettracker-pm-markets';
export const PM_POSITIONS_KEY = 'bettracker-pm-positions';
export const PM_TRADES_KEY = 'bettracker-pm-trades';

// ================================
// Safe JSON Parsing
// ================================

function safeParseJSON<T>(json: string | null, fallback: T[]): T[] {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
    return fallback;
  } catch {
    console.error('[predictionMarketsStore] Failed to parse JSON');
    return fallback;
  }
}

// ================================
// Markets CRUD
// ================================

export function getMarkets(): PredictionMarket[] {
  return safeParseJSON<PredictionMarket>(localStorage.getItem(PM_MARKETS_KEY), []);
}

export function setMarkets(markets: PredictionMarket[]): void {
  localStorage.setItem(PM_MARKETS_KEY, JSON.stringify(markets));
}

export function addMarket(market: PredictionMarket): PredictionMarket {
  const markets = getMarkets();
  markets.push(market);
  setMarkets(markets);
  return market;
}

export function updateMarket(id: string, updates: Partial<PredictionMarket>): PredictionMarket | null {
  const markets = getMarkets();
  const index = markets.findIndex(m => m.id === id);
  if (index === -1) return null;
  
  markets[index] = {
    ...markets[index],
    ...updates,
    updatedAtIso: new Date().toISOString(),
  };
  setMarkets(markets);
  return markets[index];
}

export function deleteMarket(id: string): boolean {
  const markets = getMarkets();
  const filtered = markets.filter(m => m.id !== id);
  if (filtered.length === markets.length) return false;
  
  setMarkets(filtered);
  
  // Cascade delete: remove positions for this market (and their trades)
  const positions = getPositions().filter(p => p.marketId === id);
  positions.forEach(p => deletePosition(p.id));
  
  return true;
}

// ================================
// Positions CRUD
// ================================

export function getPositions(): PredictionPosition[] {
  return safeParseJSON<PredictionPosition>(localStorage.getItem(PM_POSITIONS_KEY), []);
}

export function setPositions(positions: PredictionPosition[]): void {
  localStorage.setItem(PM_POSITIONS_KEY, JSON.stringify(positions));
}

export function addPosition(position: PredictionPosition): PredictionPosition {
  const positions = getPositions();
  positions.push(position);
  setPositions(positions);
  return position;
}

export function updatePosition(id: string, updates: Partial<PredictionPosition>): PredictionPosition | null {
  const positions = getPositions();
  const index = positions.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  positions[index] = {
    ...positions[index],
    ...updates,
    updatedAtIso: new Date().toISOString(),
  };
  setPositions(positions);
  return positions[index];
}

export function deletePosition(id: string): boolean {
  const positions = getPositions();
  const filtered = positions.filter(p => p.id !== id);
  if (filtered.length === positions.length) return false;
  
  setPositions(filtered);
  
  // Cascade delete: remove trades for this position
  const trades = getTrades().filter(t => t.positionId !== id);
  setTrades(trades);
  
  return true;
}

// ================================
// Trades CRUD
// ================================

export function getTrades(): PredictionTrade[] {
  return safeParseJSON<PredictionTrade>(localStorage.getItem(PM_TRADES_KEY), []);
}

export function setTrades(trades: PredictionTrade[]): void {
  localStorage.setItem(PM_TRADES_KEY, JSON.stringify(trades));
}

export function addTrade(trade: PredictionTrade): PredictionTrade {
  const trades = getTrades();
  trades.push(trade);
  setTrades(trades);
  return trade;
}

export function updateTrade(id: string, updates: Partial<PredictionTrade>): PredictionTrade | null {
  const trades = getTrades();
  const index = trades.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  trades[index] = {
    ...trades[index],
    ...updates,
  };
  setTrades(trades);
  return trades[index];
}

export function deleteTrade(id: string): boolean {
  const trades = getTrades();
  const filtered = trades.filter(t => t.id !== id);
  if (filtered.length === trades.length) return false;
  
  setTrades(filtered);
  return true;
}

// ================================
// Query Helpers
// ================================

export function getTradesForPosition(positionId: string): PredictionTrade[] {
  return getTrades()
    .filter(t => t.positionId === positionId)
    .sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());
}

export function getPositionsForMarket(marketId: string): PredictionPosition[] {
  return getPositions().filter(p => p.marketId === marketId);
}

export function getMarketById(id: string): PredictionMarket | undefined {
  return getMarkets().find(m => m.id === id);
}

export function getPositionById(id: string): PredictionPosition | undefined {
  return getPositions().find(p => p.id === id);
}

// ================================
// WAC (Weighted Average Cost) Accounting
// ================================

/**
 * Calculate position metrics using Weighted Average Cost (WAC) accounting.
 * 
 * Algorithm:
 * 1. Process trades sorted by dateIso ascending
 * 2. BUY: Add to position, recalculate weighted average cost
 * 3. SELL: Realize P/L based on (sellPrice - avgCost) * sharesSold
 * 4. Fees reduce realized P/L
 * 
 * @param trades - Array of trades for the position
 * @param lastKnownPrice - Optional manual price for unrealized P/L
 * @param market - Optional market for resolved state calculation
 */
export function calculatePositionMetrics(
  trades: PredictionTrade[],
  lastKnownPrice?: number,
  market?: PredictionMarket
): PredictionPositionMetrics {
  // Sort trades by date ascending
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime()
  );

  let runningShares = 0;
  let runningAvgCost = 0;
  let totalBuyCost = 0;
  let totalSellProceeds = 0;
  let totalFees = 0;
  let realizedPnl = 0;

  for (const trade of sortedTrades) {
    const fee = trade.fee || 0;
    totalFees += fee;

    if (trade.side === 'BUY') {
      // Calculate new weighted average cost
      const tradeTotal = trade.shares * trade.price;
      totalBuyCost += tradeTotal;
      
      const newTotalCost = runningShares * runningAvgCost + tradeTotal;
      const newTotalShares = runningShares + trade.shares;
      
      runningAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;
      runningShares = newTotalShares;
      
      // BUY fees increase cost basis (reduce realized P/L)
      realizedPnl -= fee;
    } else {
      // SELL: Realize P/L
      const sellProceeds = trade.shares * trade.price;
      totalSellProceeds += sellProceeds;
      
      // Realized P/L = (sellPrice - avgCost) * sharesSold - fee
      const pnlFromSale = (trade.price - runningAvgCost) * trade.shares;
      realizedPnl += pnlFromSale - fee;
      
      // Reduce shares held
      runningShares = Math.max(0, runningShares - trade.shares);
      
      // If shares hit 0, avg cost stays (or could reset - keeping for consistency)
      if (runningShares === 0) {
        runningAvgCost = 0;
      }
    }
  }

  const sharesHeld = runningShares;
  const avgEntryPrice = runningAvgCost;
  const costBasisHeld = sharesHeld * avgEntryPrice;

  const metrics: PredictionPositionMetrics = {
    sharesHeld,
    avgEntryPrice,
    costBasisHeld,
    totalBuyCost,
    totalSellProceeds,
    totalFees,
    realizedPnl,
  };

  // Calculate estimated value if lastKnownPrice is set
  if (lastKnownPrice !== undefined && lastKnownPrice !== null && sharesHeld > 0) {
    metrics.estValue = sharesHeld * lastKnownPrice;
    metrics.estUnrealizedPnl = metrics.estValue - costBasisHeld;
  }

  // Calculate final value if market is resolved
  if (market?.status === 'resolved' && market.resolvedPrice !== undefined && sharesHeld > 0) {
    metrics.finalValue = sharesHeld * market.resolvedPrice;
    metrics.finalPnl = realizedPnl + (metrics.finalValue - costBasisHeld);
  }

  return metrics;
}

// ================================
// Sorting Helpers
// ================================

/**
 * Sort markets by updatedAt descending (most recent first).
 */
export function sortMarketsByUpdated(markets: PredictionMarket[]): PredictionMarket[] {
  return [...markets].sort(
    (a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime()
  );
}

/**
 * Sort positions by market title, then by outcome.
 */
export function sortPositionsByMarketAndOutcome(
  positions: PredictionPosition[],
  markets: PredictionMarket[]
): PredictionPosition[] {
  const marketMap = new Map(markets.map(m => [m.id, m]));
  
  return [...positions].sort((a, b) => {
    const marketA = marketMap.get(a.marketId);
    const marketB = marketMap.get(b.marketId);
    
    const titleA = marketA?.title || '';
    const titleB = marketB?.title || '';
    
    if (titleA !== titleB) {
      return titleA.localeCompare(titleB);
    }
    
    return a.outcome.localeCompare(b.outcome);
  });
}

// ================================
// ID Generation
// ================================

export function generateId(): string {
  return crypto.randomUUID();
}
